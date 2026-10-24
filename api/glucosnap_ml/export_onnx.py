"""Export the trained CGM encoder to ONNX so the server runs it with onnxruntime instead of PyTorch.

  python api/glucosnap_ml/export_onnx.py api/models

Writes models/encoder.onnx: input "cgm" (batch, 72) mg/dL on a 5-minute grid, output "embedding" (batch, 256).
"""
import os, sys
import numpy as np, onnx, onnxruntime as ort, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import DualStreamEncoder

out = sys.argv[1] if len(sys.argv) > 1 else "models"


class Embed(torch.nn.Module):
    def __init__(self, enc):
        super().__init__()
        self.enc = enc

    def forward(self, x):
        return self.enc.embed(x)


enc = DualStreamEncoder()
enc.load_state_dict(torch.load(os.path.join(out, "encoder.pt"), map_location="cpu"))
enc.eval()
x = torch.tensor(np.random.default_rng(0).normal(120, 30, (8, 72)), dtype=torch.float32)
path = os.path.join(out, "encoder.onnx")
torch.onnx.export(Embed(enc).eval(), (x,), path, input_names=["cgm"], output_names=["embedding"],
                  dynamic_shapes=({0: torch.export.Dim("batch")},), dynamo=True)
# one self-contained file (the exporter may split the weights into encoder.onnx.data)
onnx.save_model(onnx.load(path), path, save_as_external_data=False)
if os.path.exists(path + ".data"):
    os.remove(path + ".data")

enc.eval()
sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
for b in (1, 8):
    with torch.no_grad():
        ref = enc.embed(x[:b]).numpy()
    err = float(np.abs(sess.run(None, {"cgm": x[:b].numpy()})[0] - ref).max())
    assert err < 1e-4, f"ONNX output differs from PyTorch by {err}"
print(f"wrote {path}, max difference from PyTorch {err:.1e}")
