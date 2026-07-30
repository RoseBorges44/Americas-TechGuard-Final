import json, sys
from pathlib import Path

# raiz do repositório (este arquivo mora em tests/); o pipeline Python vive em python/src
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python/src"))

from atg_mesh.codec import to_c1_bin
from atg_mesh.risk import classify_river, classify_rain, combine, RainThresholds

# limiares de chuva do proprio metrics.json (percentis da serie ERA5-Land observada);
# nao chumbar valores aqui -> fonte unica, Regra §1.1
_th = json.load(open(ROOT / "python/outputs/metrics.json"))["data"]["rain_thresholds"]
th = RainThresholds(**{k: _th[k] for k in ("h1_attention", "h1_alert", "h1_critical",
                                          "h24_attention", "h24_alert", "h24_critical")})

def risco_py(p):
    """Mesma composicao do pipeline (pipeline._build, linhas 69-74): para o no do
    rio o risco final e o MAXIMO entre rio (nivel+taxa) e chuva acumulada."""
    acc = p.get("accum_24h_mm")
    if p["sensor_type"] != "river_level":
        return classify_rain(p["sensor_value"], acc or 0.0, th).risk_level
    a_river = classify_river(p["sensor_value"], p.get("rate_of_change"))
    if acc is None:
        return a_river.risk_level
    return combine(a_river, classify_rain(0.0, acc, th)).risk_level

out, mismatch = [], 0
for line in open(ROOT / "python/outputs/payloads.jsonl"):
    p = json.loads(line)
    b = to_c1_bin(p)
    r = risco_py(p)
    if r != p["risk_level"]:
        mismatch += 1
    out.append({"ts": p["timestamp"], "node": p["node_num"],
                "st": p["sensor_type"], "val": p["sensor_value"],
                "rate": p.get("rate_of_change"), "a24": p.get("accum_24h_mm"),
                "batt": p.get("battery_pct"), "lat": p["latitude"], "lon": p["longitude"],
                "risk_stored": p["risk_level"], "risk_py": r, "hex": b.hex()})

json.dump(out, open(ROOT / "tests/ref.json", "w"))
print(f"payloads      : {len(out)}")
print(f"bytes/payload : {len(bytes.fromhex(out[0]['hex']))}")
print(f"risco Python vs risco gravado -> divergencias: {mismatch}")
