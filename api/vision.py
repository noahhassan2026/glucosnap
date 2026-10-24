"""Meal photo -> foods and macros with a vision model.

Provider is picked from the environment:
  NAVIGATOR_TOOLKIT_API_KEY  UF NaviGator AI Toolkit (OpenAI-compatible), model GLUCOSNAP_VISION_MODEL
                             (default gemma-4-31b-it), base URL NAVIGATOR_BASE_URL (default https://api.ai.it.ufl.edu/v1)
  ANTHROPIC_API_KEY          Claude through the Anthropic SDK (default model claude-opus-5-5)
With neither set, photo analysis is unavailable and the app asks for macros instead.
"""
import base64, json, os, re
from typing import List

import anthropic
import openai
from pydantic import BaseModel, Field, ValidationError

NAVIGATOR_KEY = os.environ.get("NAVIGATOR_TOOLKIT_API_KEY")
NAVIGATOR_URL = os.environ.get("NAVIGATOR_BASE_URL", "https://api.ai.it.ufl.edu/v1")
PROVIDER = "navigator" if NAVIGATOR_KEY else ("anthropic" if os.environ.get("ANTHROPIC_API_KEY") else None)
MODEL = os.environ.get("GLUCOSNAP_VISION_MODEL", "claude-opus-5-5" if PROVIDER == "anthropic" else "gemma-4-31b-it")

PROMPT = """You estimate nutrition from a single meal photo for a blood-sugar app.
List each visible food with an estimated portion, then give totals for the whole plate as served:
calories (kcal), carbs, protein, fat and fiber (grams). Estimate portions from plate size, utensils and
packaging. If the photo shows no food, return an empty items list, zeros, and confidence 0.
confidence is 0 to 1: how sure you are about the totals (low for mixed dishes, hidden sauces, or unclear portions)."""


class FoodItem(BaseModel):
    name: str
    portion: str = Field(description="e.g. '1 cup', '150 g', '2 slices'")
    carbs: float


class MealEstimate(BaseModel):
    label: str = Field(description="short name for the meal, e.g. 'Chicken rice bowl'")
    items: List[FoodItem]
    calories: float
    carbs: float
    protein: float
    fat: float
    fiber: float
    confidence: float


class VisionUnavailable(RuntimeError):
    pass


_clients = {}


def estimate_meal(image: bytes, media_type: str) -> MealEstimate:
    if media_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        raise ValueError("photo must be JPEG, PNG, GIF or WebP")
    if PROVIDER is None:
        raise VisionUnavailable("no vision API key is set on the server")
    data = base64.standard_b64encode(image).decode()
    est = _navigator(data, media_type) if PROVIDER == "navigator" else _claude(data, media_type)
    est.confidence = max(0.0, min(1.0, est.confidence))
    return est


# ---------- UF NaviGator (OpenAI-compatible chat completions) ----------------------------
def _parse_json(text: str) -> MealEstimate:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", (text or "").strip())
    try:
        return MealEstimate.model_validate_json(text)
    except ValidationError as e:
        m = re.search(r"\{.*\}", text, re.S)          # tolerate prose around the JSON
        if m:
            try:
                return MealEstimate.model_validate_json(m.group(0))
            except ValidationError:
                pass
        raise VisionUnavailable("the vision model did not return valid meal JSON; enter the macros by hand") from e


def _navigator(data: str, media_type: str) -> MealEstimate:
    client = _clients.get("navigator") or _clients.setdefault(
        "navigator", openai.OpenAI(api_key=NAVIGATOR_KEY, base_url=NAVIGATOR_URL, timeout=60))
    schema = MealEstimate.model_json_schema()
    messages = [{"role": "user", "content": [
        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{data}"}},
        {"type": "text", "text": PROMPT + "\nAnswer with only a JSON object matching this schema:\n" + json.dumps(schema)},
    ]}]
    try:
        try:
            r = client.chat.completions.create(
                model=MODEL, messages=messages, temperature=0, max_tokens=1500,
                response_format={"type": "json_schema",
                                 "json_schema": {"name": "meal_estimate", "schema": schema}})
        except openai.BadRequestError:
            # some deployments reject json_schema; the prompt already carries the schema
            r = client.chat.completions.create(model=MODEL, messages=messages, temperature=0, max_tokens=1500)
    except openai.AuthenticationError as e:
        raise VisionUnavailable("the server's NaviGator API key was rejected") from e
    except openai.APIConnectionError as e:
        raise VisionUnavailable("could not reach the NaviGator API") from e
    except openai.APIError as e:              # model not enabled for this key, rate limit, image not accepted
        raise VisionUnavailable(f"photo analysis failed ({type(e).__name__})") from e
    return _parse_json(r.choices[0].message.content)


# ---------- Claude (Anthropic SDK) -------------------------------------------------------
def _claude(data: str, media_type: str) -> MealEstimate:
    client = _clients.get("anthropic") or _clients.setdefault("anthropic", anthropic.Anthropic())
    try:
        response = client.beta.messages.parse(
            model=MODEL,
            max_tokens=4000,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}},
                    {"type": "text", "text": PROMPT},
                ],
            }],
            output_format=MealEstimate,
        )
    except anthropic.AuthenticationError as e:
        raise VisionUnavailable("the server's Anthropic API key was rejected") from e
    except anthropic.APIConnectionError as e:
        raise VisionUnavailable("could not reach the Anthropic API") from e
    except anthropic.APIError as e:            # rate limit, overload, bad request
        raise VisionUnavailable(f"photo analysis failed ({type(e).__name__})") from e
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise VisionUnavailable("the photo could not be analyzed; enter the macros by hand")
    return response.parsed_output
