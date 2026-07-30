# assets/hand/

Camada HAND (Semana 6) para o mapa. **Tarefa 2.4 - ✅ implementada.**

- `hand.js` - grade recortada e reamostrada (300×300, ~90 m), embutida como
  `window.ATG_HAND` (base64 uint8; `HAND_m = valor/vscale`, 255 = sem dado).
  É o único arquivo HAND de que a demo precisa. Necessário porque GeoTIFF não é
  nativo do navegador e ler pixels de imagem em `file://` é bloqueado.
- `hand_blumenau_hand.tif` - o raster HAND original (real, EPSG:4326, ~30 m).
  **Não está neste repositório**: 27 MB, ignorado pelo `.gitignore`. Vive no
  repositório da Semana 6. Verificado na Semana 6: fração HAND ≤ 5 m =
  **16,78 %**, batendo com os 16,75 % dos Fatos Verificados.

Para **regenerar** `hand.js`: baixe o `.tif` da Semana 6, coloque-o nesta pasta e
rode `python tools/build_hand.py` (precisa de `numpy` e `tifffile`). Sem o `.tif`
a demo continua funcionando normalmente - só não é possível regenerar a grade.

A lâmina d'água é desenhada **consultando o HAND por cota** (inunda onde
HAND < cota) - não é animação livre. Raster real ✅; mapeamento cota→inundação
simplificado 🔶.
