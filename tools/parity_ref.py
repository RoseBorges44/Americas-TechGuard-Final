# parity_ref.py - Fase 2.11
# Referência PYTHON independente para o botão "Verificar paridade" do navegador.
# Espelha fielmente src/atg_mesh/codec.py (layout <BIIiihhBB, round half-to-even)
# e risk.py, roda sobre os 1.297 payloads reais e emite:
#   - o SHA-256 dos 1.297 hexes concatenados (referência de BYTES);
#   - a contagem de risco Python vs risco gravado (cross-check).
# O navegador recomputa em JS e compara contra este SHA-256 → prova JS ↔ Python.

import json, struct, hashlib
from datetime import datetime, timezone
from pathlib import Path

# caminhos relativos à raiz do repositório (este arquivo mora em tools/)
ROOT = Path(__file__).resolve().parent.parent

SENSOR_CODE = {"river_level": 1, "rain_gauge": 2, "repeater": 3, "gateway": 4, "river_discharge": 5}
RISK_CODE = {"safe": 0, "attention": 1, "alert": 2, "critical": 3}
RISK_ORDER = ["safe", "attention", "alert", "critical"]
SCALE = {"river_level": 100.0, "rain_gauge": 10.0, "river_discharge": 1.0, "repeater": 1.0, "gateway": 1.0}
VERSION = 1
LADDER = [(0.0, "normalidade", "safe"), (3.0, "observacao", "attention"),
          (4.0, "atencao", "attention"), (6.0, "alerta", "alert"), (8.0, "alerta_maximo", "critical")]
RATE1, RATE2 = 0.25, 0.40

def clamp16(v): return max(-32768, min(32767, v))

def to_c1_bin(p):
    st = p["sensor_type"]; v = p["sensor_value"]
    ts = int(datetime.strptime(p["timestamp"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())
    b0 = (VERSION << 4) | SENSOR_CODE[st]
    lat = round(p["latitude"] * 1e6); lon = round(p["longitude"] * 1e6)     # round() é half-to-even
    val = clamp16(round(v * SCALE[st]))
    rate = 0 if p.get("rate_of_change") is None else clamp16(round(p["rate_of_change"] * 1000))
    risk = RISK_CODE[p["risk_level"]]
    batt = 100 if p.get("battery_pct") is None else p["battery_pct"]
    return struct.pack("<BIIiihhBB", b0, p["node_num"] & 0xFFFFFFFF, ts, lat, lon, val, rate, risk, batt)

def stage_from_level(m):
    stage, risk = LADDER[0][1], LADDER[0][2]
    for lo, name, rl in LADDER:
        if m >= lo: stage, risk = name, rl
    return stage, risk

def classify_river(level, rate):
    _, risk = stage_from_level(level); i = RISK_ORDER.index(risk)
    if rate is not None and rate > 0:
        bump = 2 if rate >= RATE2 else (1 if rate >= RATE1 else 0)
        if bump: i = min(i + bump, len(RISK_ORDER) - 1)
    return RISK_ORDER[i]

def classify_rain(rain1h, accum24h, th):
    return "attention" if (rain1h >= th["h1_attention"] or accum24h >= th["h24_attention"]) else "safe"

def assess(p, th):
    rain = classify_rain(p["sensor_value"] if p["sensor_type"] == "rain_gauge" else 0.0,
                          p.get("accum_24h_mm") or 0.0, th)
    if p["sensor_type"] != "river_level":
        return rain
    riv = classify_river(p["sensor_value"], p.get("rate_of_change"))
    return riv if RISK_ORDER.index(riv) >= RISK_ORDER.index(rain) else rain

th = json.load(open(ROOT / "python/outputs/metrics.json"))["data"]["rain_thresholds"]

hexes, risk_ok = [], 0
payloads = [json.loads(l) for l in open(ROOT / "python/outputs/payloads.jsonl") if l.strip()]
for p in payloads:
    hexes.append(to_c1_bin(p).hex())
    if assess(p, th) == p["risk_level"]:
        risk_ok += 1

concat = "".join(hexes)
sha = hashlib.sha256(concat.encode("ascii")).hexdigest()

ref = {"n": len(payloads), "bytes_sha256": sha, "py_risk_match": risk_ok}
with open(ROOT / "data/parity_ref.js", "w", encoding="utf-8", newline="\n") as f:
    f.write("// Referência Python (parity_ref.py) para o botão de paridade. NÃO editar à mão.\n")
    f.write("window.ATG_PARITY = " + json.dumps(ref) + ";\n")

print("payloads      :", len(payloads))
print("bytes sha256  :", sha)
print("risco Python vs gravado:", risk_ok, "/", len(payloads))
