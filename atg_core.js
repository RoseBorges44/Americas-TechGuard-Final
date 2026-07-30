// ATG-C1 codec + motor de risco - porte JavaScript
// Espelha src/atg_mesh/codec.py e src/atg_mesh/risk.py (Americas TechGuard, Período 8).
// Verificado por paridade byte a byte contra a implementação Python.
//
// FONTE ÚNICA. Este mesmo arquivo é consumido por:
//   - o navegador, como <script src="atg_core.js"> clássico (abre por file://,
//     sem servidor, sem CORS de módulo - exige Wi-Fi desligado na demo);
//   - o Node, pelo teste de paridade (parity.mjs), via `import ATG from ...`.
// Por isso NÃO usa a palavra-chave `export`: um módulo ES externo é bloqueado
// por CORS quando a página abre em file:// no Chrome. A lógica abaixo é idêntica
// à versão anterior - só mudou o empacotamento (global ATG / module.exports).

(function (global) {
  "use strict";

  // ---- constantes (espelham config.py) ----
  const RISK_ORDER = ["safe", "attention", "alert", "critical"];
  const RISK_CODE = { safe: 0, attention: 1, alert: 2, critical: 3 };
  const SENSOR_CODE = { river_level: 1, rain_gauge: 2, repeater: 3, gateway: 4, river_discharge: 5 };
  const SCALE = { river_level: 100.0, rain_gauge: 10.0, river_discharge: 1.0, repeater: 1.0, gateway: 1.0 };

  // escada OFICIAL da Defesa Civil de Blumenau
  const LADDER = [
    [0.0, "normalidade", "safe"],
    [3.0, "observacao", "attention"],
    [4.0, "atencao", "attention"],
    [6.0, "alerta", "alert"],
    [8.0, "alerta_maximo", "critical"],
  ];
  const RATE_ESCALATE_1 = 0.25; // m/h -> +1 degrau
  const RATE_ESCALATE_2 = 0.40; // m/h -> +2 degraus
  const VERSION = 1;

  // Python round() é half-to-even. Math.round() é half-up.
  // Sem isto, val e rate divergem em ~.5 exato.
  function pyRound(x) {
    const f = Math.floor(x), d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }
  const clamp16 = (v) => Math.max(-32768, Math.min(32767, v));

  // ---- ATG-C1-BIN: 23 bytes, little-endian, layout "<BIIiihhBB" ----
  function toC1Bin(p) {
    const v = p.sensor_value;
    if (v === null || v === undefined || !Number.isFinite(v))
      throw new Error(`sensor_value invalido (${v}): um no nunca deve transmitir NaN.`);

    const buf = new ArrayBuffer(23);
    const dv = new DataView(buf);
    const st = p.sensor_type;

    dv.setUint8(0, (VERSION << 4) | SENSOR_CODE[st]);
    dv.setUint32(1, p.node_num >>> 0, true);
    dv.setUint32(5, Math.floor(Date.parse(p.timestamp) / 1000), true);
    dv.setInt32(9, pyRound(p.latitude * 1e6), true);
    dv.setInt32(13, pyRound(p.longitude * 1e6), true);
    dv.setInt16(17, clamp16(pyRound(v * SCALE[st])), true);
    dv.setInt16(19, clamp16(p.rate_of_change == null ? 0 : pyRound(p.rate_of_change * 1000)), true);
    dv.setUint8(21, RISK_CODE[p.risk_level]);
    dv.setUint8(22, p.battery_pct == null ? 100 : p.battery_pct);
    return new Uint8Array(buf);
  }

  const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");

  // ---- motor de risco ----
  function stageFromLevel(m) {
    let stage = LADDER[0][1], risk = LADDER[0][2];
    for (const [lo, name, rl] of LADDER) if (m >= lo) { stage = name; risk = rl; }
    return { stage, risk };
  }

  function classifyRiver(levelM, rateMH) {
    const { stage, risk } = stageFromLevel(levelM);
    let i = RISK_ORDER.indexOf(risk), driver = "nivel";
    if (rateMH != null && rateMH > 0) {
      const bump = rateMH >= RATE_ESCALATE_2 ? 2 : rateMH >= RATE_ESCALATE_1 ? 1 : 0;
      if (bump) { i = Math.min(i + bump, RISK_ORDER.length - 1); driver = "nivel+taxa"; }
    }
    return { risk_level: RISK_ORDER[i], stage, driver };
  }

  // A chuva é indicador ANTECEDENTE: teto em 'attention'.
  // Quem alaga Blumenau é o rio. Regra nascida do alarme falso da §6.4.
  function classifyRain(rain1h, accum24h, th) {
    const trig = rain1h >= th.h1_attention || accum24h >= th.h24_attention;
    return { risk_level: trig ? "attention" : "safe", stage: null, driver: "chuva" };
  }

  function combine(...as) {
    const best = as.reduce((a, b) =>
      RISK_ORDER.indexOf(b.risk_level) > RISK_ORDER.indexOf(a.risk_level) ? b : a);
    const stage = as.find((a) => a.stage)?.stage ?? null;
    return { risk_level: best.risk_level, stage, driver: best.driver };
  }

  // risco de um payload completo - o nó do rio também carrega chuva acumulada
  function assess(p, th) {
    const rain = classifyRain(p.sensor_type === "rain_gauge" ? p.sensor_value : 0.0,
                              p.accum_24h_mm ?? 0.0, th);
    if (p.sensor_type !== "river_level") return rain;
    return combine(classifyRiver(p.sensor_value, p.rate_of_change), rain);
  }

  // ---- superfície pública (fonte única: navegador + Node) ----
  const ATG = {
    RISK_ORDER, RISK_CODE, SENSOR_CODE, SCALE, LADDER,
    RATE_ESCALATE_1, RATE_ESCALATE_2, VERSION,
    pyRound, toC1Bin, toHex, stageFromLevel,
    classifyRiver, classifyRain, combine, assess,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = ATG; // Node / CommonJS
  global.ATG = ATG;                                                          // navegador (window.ATG)
})(typeof globalThis !== "undefined" ? globalThis : this);
