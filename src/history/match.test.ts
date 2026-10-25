import { describe, expect, it } from "vitest";
import type { CgmPoint, Curve } from "../api/types";
import { actualCurve, compare, predictedAt } from "./match";

const AT = "2026-10-24T12:00:00.000Z";
const curve: Curve = {
  minutes: [0, 15, 30, 45, 60, 75, 90, 105, 120],
  delta_mg_dl: [0, 10, 30, 45, 40, 30, 20, 10, 5],
  delta_low: [0, 0, 10, 25, 20, 10, 0, 0, 0],
  delta_high: [0, 20, 50, 65, 60, 50, 40, 30, 25],
  baseline_mg_dl: 100,
  peak_delta_mg_dl: 45,
  peak_minute: 45,
  mae_mg_dl: 18,
  tier: "sensor",
};

// Readings every 5 minutes starting 30 minutes before the meal, offset by 2 minutes.
function sensor(f: (min: number) => number, until = 150): CgmPoint[] {
  const out: CgmPoint[] = [];
  for (let m = -28; m <= until; m += 5) out.push({ t: new Date(Date.parse(AT) + m * 6e4).toISOString(), mg_dl: f(m) });
  return out;
}

describe("actual curve", () => {
  it("matches sensor readings to the 15-minute grid", () => {
    const a = actualCurve(AT, sensor((m) => 100 + Math.max(0, m) * 0.5));
    expect(a.source).toBe("sensor");
    expect(a.points.map((p) => p.minute)).toEqual([0, 15, 30, 45, 60, 75, 90, 105, 120]);
    expect(a.pre).toBe(101);
    expect(a.points[4].delta).toBeCloseTo(30, 0);
  });

  it("shows only what has happened so far for a meal in progress", () => {
    const a = actualCurve(AT, sensor(() => 110, 40));
    expect(a.points.map((p) => p.minute)).toEqual([0, 15, 30, 45]);
  });

  it("ignores sensor data that doesn't cover the meal", () => {
    const old = sensor(() => 100).map((p) => ({ ...p, t: new Date(Date.parse(p.t) - 864e5).toISOString() }));
    expect(actualCurve(AT, old).points).toEqual([]);
  });

  it("uses typed readings, with the prediction's baseline when there is no before reading", () => {
    const a = actualCurve(AT, [], [{ minute: 60, mg_dl: 150 }], 100);
    expect(a.source).toBe("manual");
    expect(a.points).toEqual([{ minute: 0, mg_dl: 100, delta: 0 }, { minute: 60, mg_dl: 150, delta: 50 }]);
  });

  it("lets typed readings override the sensor at the same minute", () => {
    const a = actualCurve(AT, sensor(() => 110), [{ minute: 0, mg_dl: 98 }, { minute: 30, mg_dl: 141 }]);
    expect(a.source).toBe("both");
    expect(a.pre).toBe(98);
    expect(a.points.find((p) => p.minute === 30)?.delta).toBe(43);
    expect(a.points.find((p) => p.minute === 60)?.delta).toBe(12);
  });

  it("needs a pre-meal level to compare", () => {
    expect(actualCurve(AT, [], [{ minute: 60, mg_dl: 150 }]).points).toEqual([]);
  });
});

describe("compare", () => {
  it("interpolates the prediction and scores the error", () => {
    expect(predictedAt(curve, 52.5)).toBeCloseTo(42.5);
    const c = compare(curve, actualCurve(AT, [], [{ minute: 0, mg_dl: 100 }, { minute: 45, mg_dl: 155 }, { minute: 90, mg_dl: 120 }]))!;
    expect(c.mae).toBeCloseTo(5);
    expect(c.actualPeak).toBe(55);
    expect(c.actualPeakMinute).toBe(45);
    expect(c.withinTypical).toBe(true);
  });
});
