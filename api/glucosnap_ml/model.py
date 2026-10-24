"""GlucoFM-style dual-stream CGM encoder (simplified re-implementation).

The 6h window is split into a slow trend (1h moving average) and fast deviations
(window minus trend). Each stream is cut into 30-minute patches and encoded by its
own small transformer; the two token sets are fused by a shared transformer layer.
Pre-training predicts the *latent* of masked patches (from an EMA target encoder),
not the raw glucose values.
"""
import copy, math
import torch, torch.nn as nn, torch.nn.functional as F

PATCH = 6           # 6 x 5 min = 30 min
MEAN, STD = 120.0, 35.0


def split_streams(x):
    """x: (B, T) mg/dL -> trend, deviation, both normalised, shape (B, T)."""
    x = (x - MEAN) / STD
    k = 12
    pad = F.pad(x.unsqueeze(1), (k // 2, k - 1 - k // 2), mode="replicate")
    trend = F.avg_pool1d(pad, k, stride=1).squeeze(1)
    return trend, x - trend


class Stream(nn.Module):
    def __init__(self, n_patch, d, layers, heads):
        super().__init__()
        self.embed = nn.Linear(PATCH, d)
        self.pos = nn.Parameter(torch.randn(1, n_patch, d) * 0.02)
        layer = nn.TransformerEncoderLayer(d, heads, d * 2, dropout=0.1, batch_first=True, norm_first=True)
        self.enc = nn.TransformerEncoder(layer, layers, enable_nested_tensor=False)

    def forward(self, s, mask=None, mask_tok=None):
        p = self.embed(s.unfold(1, PATCH, PATCH))          # (B, P, d)
        if mask is not None:
            p = torch.where(mask.unsqueeze(-1), mask_tok.expand_as(p), p)
        return self.enc(p + self.pos)


class DualStreamEncoder(nn.Module):
    def __init__(self, win=72, d=64, layers=2, heads=4):
        super().__init__()
        n = win // PATCH
        self.trend = Stream(n, d, layers, heads)
        self.dev = Stream(n, d, layers, heads)
        self.mask_tok = nn.Parameter(torch.zeros(1, 1, d))
        fuse = nn.TransformerEncoderLayer(d, heads, d * 2, dropout=0.1, batch_first=True, norm_first=True)
        self.fuse = nn.TransformerEncoder(fuse, 1, enable_nested_tensor=False)
        self.stream_type = nn.Parameter(torch.randn(1, 2, 1, d) * 0.02)
        self.norm = nn.LayerNorm(d)
        self.n, self.d = n, d

    def forward(self, x, mask=None):
        """Returns tokens (B, 2P, d): first P trend tokens, then P deviation tokens."""
        tr, dv = split_streams(x)
        a = self.trend(tr, mask, self.mask_tok) + self.stream_type[:, 0]
        b = self.dev(dv, mask, self.mask_tok) + self.stream_type[:, 1]
        return self.norm(self.fuse(torch.cat([a, b], 1)))

    def embed(self, x):
        """Fixed-size embedding for downstream tasks: mean of each stream + last 30 min of each."""
        t = self.forward(x)
        n = self.n
        return torch.cat([t[:, :n].mean(1), t[:, n:].mean(1), t[:, n - 1], t[:, -1]], 1)   # (B, 4d)


class LatentMaskedPretrainer(nn.Module):
    def __init__(self, enc, ema=0.996):
        super().__init__()
        self.enc = enc
        self.target = copy.deepcopy(enc)
        for p in self.target.parameters():
            p.requires_grad = False
        d = enc.d
        self.pred = nn.Sequential(nn.Linear(d, d * 2), nn.GELU(), nn.Linear(d * 2, d))
        self.ema = ema

    def loss(self, x, ratio=0.4):
        B, n = x.shape[0], self.enc.n
        mask = torch.rand(B, n, device=x.device) < ratio
        with torch.no_grad():
            tgt = F.layer_norm(self.target(x), (self.enc.d,))
        ctx = self.enc(x, mask)
        m2 = torch.cat([mask, mask], 1)
        pred = self.pred(ctx)
        l_lat = F.smooth_l1_loss(pred[m2], tgt[m2])
        # variance term keeps embeddings from collapsing to a constant
        z = ctx.mean(1)
        l_var = F.relu(1 - torch.sqrt(z.var(0) + 1e-4)).mean()
        return l_lat + 0.1 * l_var

    @torch.no_grad()
    def update_target(self):
        for p, q in zip(self.enc.parameters(), self.target.parameters()):
            q.mul_(self.ema).add_(p.detach(), alpha=1 - self.ema)


def pretrain(windows, epochs=8, bs=256, lr=1e-3, seed=0, log=print):
    torch.manual_seed(seed)
    enc = DualStreamEncoder()
    m = LatentMaskedPretrainer(enc)
    opt = torch.optim.AdamW([p for p in m.parameters() if p.requires_grad], lr=lr, weight_decay=0.05)
    X = torch.tensor(windows)
    steps = epochs * math.ceil(len(X) / bs)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, lr, total_steps=steps)
    for ep in range(epochs):
        perm = torch.randperm(len(X)); tot = 0
        m.train()
        for i in range(0, len(X), bs):
            xb = X[perm[i:i + bs]]
            # light augmentation: random offset and scale of the glucose level
            xb = xb * (1 + 0.05 * torch.randn(len(xb), 1)) + 5 * torch.randn(len(xb), 1)
            l = m.loss(xb)
            opt.zero_grad(); l.backward(); opt.step(); sched.step(); m.update_target()
            tot += l.item() * len(xb)
        log(f"  pretrain epoch {ep + 1}/{epochs} loss {tot / len(X):.4f}")
    enc.eval()
    return enc


@torch.no_grad()
def embed_np(enc, windows, bs=512):
    enc.eval()
    out = [enc.embed(torch.tensor(windows[i:i + bs])) for i in range(0, len(windows), bs)]
    return torch.cat(out).numpy()
