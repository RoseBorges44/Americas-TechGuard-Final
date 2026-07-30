import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import ATG from "../atg_core.js"; // fonte única (mesmo arquivo que o navegador carrega)
const { toC1Bin, toHex, assess } = ATG;

// caminhos relativos à raiz do repositório (este arquivo mora em tests/)
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const REF = ROOT + "tests/ref.json";
if (!existsSync(REF)) {
  console.error("\nFalta tests/ref.json, que é a referência gerada pelo Python.");
  console.error("Rode primeiro:\n\n    python tests/gen_ref.py\n");
  process.exit(1);
}
const ref = JSON.parse(readFileSync(REF, "utf8"));

// limiares do próprio metrics.json (fonte única, Regra §1.1): não chumbar aqui
const th = JSON.parse(readFileSync(ROOT + "python/outputs/metrics.json", "utf8"))
             .data.rain_thresholds;

let byteOK=0, byteBad=[], riskOK=0, riskBad=[];
for (const r of ref) {
  const p = { node_num:r.node, timestamp:r.ts, latitude:r.lat, longitude:r.lon,
              sensor_type:r.st, sensor_value:r.val, rate_of_change:r.rate,
              accum_24h_mm:r.a24, risk_level:r.risk_stored, battery_pct:r.batt };
  const hex = toHex(toC1Bin(p));
  hex === r.hex ? byteOK++ : byteBad.push({ts:r.ts, py:r.hex, js:hex});
  assess(p, th).risk_level === r.risk_stored ? riskOK++ : riskBad.push(r);
}
const n = ref.length;
console.log(`\n=== PARIDADE PYTHON <-> JAVASCRIPT (${n} payloads reais, out/2023) ===\n`);
console.log(`ATG-C1-BIN, 23 bytes : ${byteOK}/${n} identicos  ${byteBad.length?'FALHOU':'OK'}`);
console.log(`risk_level           : ${riskOK}/${n} identicos  ${riskBad.length?'('+riskBad.length+' divergencia(s))':'OK'}`);
byteBad.slice(0,3).forEach(b=>console.log(`   ! ${b.ts}\n     py=${b.py}\n     js=${b.js}`));
riskBad.forEach(b=>console.log(`   ! ${b.ts} ${b.st} val=${b.val} a24=${b.a24} gravado=${b.risk_stored}`));
const pk = ref.filter(r=>r.st==="river_level").sort((a,b)=>b.val-a.val)[0];
console.log(`\npico do evento: ${pk.val} m em ${pk.ts}`);
console.log(`quadro no radio: ${pk.hex}  (${pk.hex.length/2} bytes)`);
