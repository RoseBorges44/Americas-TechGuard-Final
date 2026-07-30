# build_hand.py - Fase 2.4
# Pré-processa o HAND real (Semana 6) para uma grade compacta carregável por file://.
#
# Por que não usar o .tif direto na demo:
#   - GeoTIFF não é nativo do navegador (exigiria geotiff.js -> CDN, proibido §4);
#   - ler pixels de imagem em file:// é bloqueado (canvas "tainted").
# Solução: recortar na região dos nós, reamostrar e EMBUTIR os valores de HAND
# como dados (base64 uint8) em assets/hand/hand.js -> window.ATG_HAND.
# O navegador então inunda onde HAND < cota (consulta real ao HAND por cota).
#
# Nada é inventado: os valores vêm do hand_blumenau_hand.tif (EPSG:4326, ~30 m).

import base64, json
from pathlib import Path
import numpy as np
import tifffile

# caminhos relativos à raiz do repositório (este arquivo mora em tools/)
ROOT = Path(__file__).resolve().parent.parent
# o raster de 27 MB NÃO é versionado (ver .gitignore e assets/hand/README.md):
# baixe-o do repositório da Semana 6 e coloque-o neste caminho para regenerar.
SRC = ROOT / "assets/hand/hand_blumenau_hand.tif"
OUT = ROOT / "assets/hand/hand.js"

# georreferência lida do próprio .tif (tags ModelPixelScale / ModelTiepoint)
SCALE = 0.00026949458523585647          # graus/pixel (lon e lat)
LON0  = -49.23585223883527              # borda oeste do pixel (0,0)
LAT0  = -26.52581303559488              # borda norte do pixel (0,0)
NODATA_IN = -32768

# recorte regional em torno dos 5 nós (linhas/colunas do raster) + flancos.
# Janela ~quadrada (~27x25 km) para preencher o painel; vale e nós ao centro.
R0, R1 = 740, 1640
C0, C1 = 110, 1010
F = 3                                    # fator de reamostragem (30 m -> ~90 m)

VSCALE = 4                               # HAND_m = valor/VSCALE ; 255 = sem dado
NODATA_OUT = 255

a = tifffile.imread(SRC).astype("float64")
H, W = a.shape

# apara o recorte para múltiplos de F
H2 = (R1 - R0) // F * F
W2 = (C1 - C0) // F * F
crop = a[R0:R0 + H2, C0:C0 + W2]
valid = (crop != NODATA_IN) & np.isfinite(crop)

gh, gw = H2 // F, W2 // F
cropv = np.where(valid, crop, 0.0)
s = cropv.reshape(gh, F, gw, F).sum(axis=(1, 3))
cnt = valid.reshape(gh, F, gw, F).sum(axis=(1, 3))
mean = np.where(cnt > 0, s / np.maximum(cnt, 1), np.nan)

enc = np.full((gh, gw), NODATA_OUT, np.uint8)
mvalid = cnt > 0
enc[mvalid] = np.minimum(254, np.round(mean[mvalid] * VSCALE)).astype(np.uint8)

# limites lat/lon do recorte aparado (bordas)
lonW = LON0 + C0 * SCALE
lonE = LON0 + (C0 + W2) * SCALE
latN = LAT0 - R0 * SCALE
latS = LAT0 - (R0 + H2) * SCALE

# área aproximada de uma célula (para exibir a lâmina em km²)
latmid = (latN + latS) / 2.0
dlat_m = SCALE * F * 111320.0
dlon_m = SCALE * F * 111320.0 * np.cos(np.radians(latmid))
cell_km2 = (dlat_m * dlon_m) / 1e6

meta = {
    "gw": gw, "gh": gh,
    "bounds": {"lonW": lonW, "lonE": lonE, "latS": latS, "latN": latN},
    "cell_km2": round(float(cell_km2), 5),
    "vscale": VSCALE, "nodata": NODATA_OUT,
    "classes": {"alta": 5, "media": 15, "baixa": 40},   # limiares HAND (Semana 6)
    "source": "hand_blumenau_hand.tif (Semana 6) · HAND EPSG:4326 · ~30 m · reamostrado ~90 m",
    "src_shape": [H, W], "crop_rows": [R0, R0 + H2], "crop_cols": [C0, C0 + W2],
    "data_b64": base64.b64encode(enc.tobytes()).decode("ascii"),
}

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("// Gerado por build_hand.py - grade HAND real (Semana 6) para carga por file://.\n")
    f.write("// NÃO editar à mão. HAND_m = valor/vscale ; valor 255 = sem dado.\n")
    f.write("window.ATG_HAND = " + json.dumps(meta) + ";\n")

# ---- diagnóstico ----
vals = enc[mvalid].astype("float64") / VSCALE
def frac_below(c): return float((vals < c).mean()) * 100.0
print("=== 2.4 · build_hand ===")
print(f"recorte px          : rows {R0}..{R0+H2} cols {C0}..{C0+W2}  ({H2}x{W2})")
print(f"grade final         : {gw} x {gh}  ({gw*gh} células, {mvalid.sum()} com dado)")
print(f"bounds lon          : {lonW:.5f} .. {lonE:.5f}")
print(f"bounds lat          : {latS:.5f} .. {latN:.5f}")
print(f"hand.js (bytes)     : {len(open(OUT,'rb').read())}")
print(f"inundação @ cota  3 m: {frac_below(3):.1f}% do recorte válido")
print(f"inundação @ cota  6 m: {frac_below(6):.1f}%")
print(f"inundação @ cota 9,93m: {frac_below(9.93):.1f}%")
print(f"classe ALTA (<=5 m) : {frac_below(5):.1f}% (referência Semana 6: 16,75% da bacia)")
