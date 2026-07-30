// build_event.mjs - Fase 2.2
// Compacta payloads.jsonl (1.297 payloads reais, out/2023) -> data/event.json.
//
// GARANTIA (Regra §1.1 / §2): a compactação NÃO altera valor algum.
// Todo campo preservado é validado por SHA-256: reconstruímos cada payload a
// partir da estrutura compacta e conferimos, campo a campo e na ordem do arquivo,
// contra o original. Se um único valor divergir, o script aborta e NÃO grava.
//
// O que é descartado (e por quê):
//   - schema, fw, quality            : constantes -> meta.constants
//   - alert_message                  : a mensagem do celular vem de alerts.jsonl (2.8)
//   - radio.rssi_dbm/snr_db/hops     : TODOS null nos payloads; os agregados de
//                                      malha (RSSI/SNR/saltos/PDR) vêm de metrics.json (2.7)
//   - radio.preset/region            : constantes LONG_FAST/ANZ -> meta.constants
// Nada mais é descartado: device_id e os metadados de nó são preservados na
// tabela `nodes` (5 entradas), então a validação cobre TODOS esses campos.

import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

// caminhos relativos à raiz do repositório (este arquivo mora em tools/),
// para que `node tools/build_event.mjs` funcione de qualquer diretório
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = ROOT + "python/outputs/payloads.jsonl";
const OUT = ROOT + "data/event.json";

const raw = readFileSync(SRC);
const payloads = raw.toString("utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

// campos constantes por nó (repetidos em todos os payloads do mesmo node_num)
const NODE_CONST = ["node_num", "device_id", "node_name", "site",
                    "latitude", "longitude", "altitude", "sensor_type", "unit", "source"];
// campos que variam por registro
const PER_REC = ["timestamp", "sensor_value", "rate_of_change",
                 "accum_24h_mm", "risk_level", "alertablu_stage", "battery_pct"];
// tudo o que a compactação PRESERVA (é o que a validação por hash cobre)
const PRESERVED = [...NODE_CONST, ...PER_REC];

// serialização canônica de um subconjunto (chaves ordenadas) - só primitivos aqui
function canon(obj, fields) {
  const o = {};
  for (const k of [...fields].sort()) o[k] = obj[k] === undefined ? null : obj[k];
  return JSON.stringify(o);
}

// --- 1) verifica que os campos "de nó" são realmente constantes por node_num ---
const byNode = new Map();
for (const p of payloads) {
  if (!byNode.has(p.node_num)) byNode.set(p.node_num, p);
  const first = byNode.get(p.node_num);
  for (const k of NODE_CONST) {
    if (JSON.stringify(p[k]) !== JSON.stringify(first[k])) {
      console.error(`ABORT: campo "${k}" varia dentro do nó ${p.node_num} - não é constante de nó.`);
      process.exit(1);
    }
  }
}

// --- 2) monta tabela de nós (ordem de primeira aparição) e índice ---
const nodes = [...byNode.values()].map((p) => {
  const n = {};
  for (const k of NODE_CONST) n[k] = p[k];
  return n;
});
const nodeIndex = new Map(nodes.map((n, i) => [n.node_num, i]));

// --- 3) registros compactos (só o que varia no tempo) ---
// n=indice do nó · t=timestamp · v=sensor_value · r=rate_of_change
// a=accum_24h_mm · k=risk_level · s=alertablu_stage · b=battery_pct
const records = payloads.map((p) => ({
  n: nodeIndex.get(p.node_num),
  t: p.timestamp,
  v: p.sensor_value,
  r: p.rate_of_change,
  a: p.accum_24h_mm,
  k: p.risk_level,
  s: p.alertablu_stage,
  b: p.battery_pct,
}));

// --- 4) VALIDAÇÃO POR HASH: original vs. reconstruído a partir do compacto ---
const hOrig = createHash("sha256");
for (const p of payloads) hOrig.update(canon(p, PRESERVED) + "\n");

const hComp = createHash("sha256");
for (const rec of records) {
  const node = nodes[rec.n];
  const reconstructed = {
    node_num: node.node_num, device_id: node.device_id, node_name: node.node_name,
    site: node.site, latitude: node.latitude, longitude: node.longitude,
    altitude: node.altitude, sensor_type: node.sensor_type, unit: node.unit, source: node.source,
    timestamp: rec.t, sensor_value: rec.v, rate_of_change: rec.r, accum_24h_mm: rec.a,
    risk_level: rec.k, alertablu_stage: rec.s, battery_pct: rec.b,
  };
  hComp.update(canon(reconstructed, PRESERVED) + "\n");
}

const digestOrig = hOrig.digest("hex");
const digestComp = hComp.digest("hex");

if (digestOrig !== digestComp) {
  console.error("ABORT: hash dos campos preservados DIVERGE - a compactação alterou algum valor.");
  console.error("  original    :", digestOrig);
  console.error("  compactado  :", digestComp);
  process.exit(1);
}

// --- 5) meta + gravação (só chega aqui se a validação passou) ---
const timestamps = payloads.map((p) => p.timestamp).sort();
const counts = {};
for (const p of payloads) counts[p.risk_level] = (counts[p.risk_level] || 0) + 1;

const event = {
  meta: {
    source_file: "Americas-TechGuard-Semana8/outputs/outputs/payloads.jsonl",
    source_bytes: raw.length,
    source_sha256: createHash("sha256").update(raw).digest("hex"),
    count: payloads.length,
    window: [timestamps[0], timestamps[timestamps.length - 1]],
    risk_counts: counts,
    seed: 42, preset: "LONG_FAST", region: "ANZ", // §2 Fatos Verificados
    constants: { schema: "atg-env/1.0", fw: "atg-node/1.0", quality: "ok",
                 radio_preset: "LONG_FAST", radio_region: "ANZ" },
    dropped: {
      alert_message: "mensagem do celular vem de alerts.jsonl (tarefa 2.8)",
      "radio.rssi_dbm/snr_db/hops": "todos null nos payloads; agregados de malha vêm de metrics.json (2.7)",
    },
    record_fields: { n: "índice em nodes", t: "timestamp", v: "sensor_value",
                     r: "rate_of_change", a: "accum_24h_mm", k: "risk_level",
                     s: "alertablu_stage", b: "battery_pct" },
    preserved_fields: PRESERVED,
    sha256_preserved: digestOrig, // hash dos campos preservados (original == compactado)
  },
  nodes,
  records,
};

const json = JSON.stringify(event);
writeFileSync(OUT, json);

// Espelho carregável por file:// (fetch de JSON é bloqueado por CORS em file://).
// Mesmo payload exato do event.json - sem duplicação de fonte, sem divergência.
const OUT_JS = ROOT + "data/event.js";
writeFileSync(OUT_JS,
  "// Gerado por build_event.mjs - espelho de data/event.json para carga por file://.\n" +
  "// NÃO editar à mão. Mesmo conteúdo do event.json, exposto como window.ATG_EVENT.\n" +
  "window.ATG_EVENT = " + json + ";\n");

console.log("=== 2.2 · compactação payloads.jsonl -> data/event.json ===");
console.log(`payloads            : ${payloads.length}`);
console.log(`nós                 : ${nodes.length}`);
console.log(`origem (bytes)      : ${raw.length}`);
console.log(`event.json (bytes)  : ${Buffer.byteLength(json, "utf8")}  (${(Buffer.byteLength(json,"utf8")/1024).toFixed(1)} KB)`);
console.log(`data/event.js       : espelho window.ATG_EVENT (carga por file://)`);
console.log(`alvo                : < 200 KB  -> ${Buffer.byteLength(json,"utf8") < 200*1024 ? "OK" : "ESTOUROU"}`);
console.log(`hash preservados    : ${digestOrig}`);
console.log(`validação campo-a-campo (${PRESERVED.length} campos): ${digestOrig === digestComp ? "IDÊNTICO - nenhum valor alterado ✅" : "DIVERGIU ❌"}`);
