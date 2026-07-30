# data/

Dados da maquete. Gerados a partir dos arquivos reais do repositório
`Americas-TechGuard-Semana8` - nada é inventado ou recalculado.

- `event.json` - ✅ **gerado (tarefa 2.2).** 1.297 payloads compactados,
  951 KB → 116,4 KB. Estrutura: `meta` + tabela `nodes` (5) + `records` (1.297).
  Cada registro guarda só o que varia no tempo:
  `n`=índice do nó · `t`=timestamp · `v`=sensor_value · `r`=rate_of_change ·
  `a`=accum_24h_mm · `k`=risk_level · `s`=alertablu_stage · `b`=battery_pct.
  Reproduzível por `node build_event.mjs`, que **valida por SHA-256** que nenhum
  valor preservado mudou (`meta.sha256_preserved`).
- `alerts.json` - 36 transições de alerta. **Tarefa 2.8.** Ainda não gerado.

## Proveniência

- `meta.source_sha256` fixa o hash do `payloads.jsonl` de origem.
- `meta.sha256_preserved` é o hash dos 17 campos preservados; bate com o hash
  calculado direto de `payloads.jsonl`.
- Descartados na compactação: `alert_message` (mensagem vem de `alerts.jsonl`),
  `radio.rssi/snr/hops` (todos null; agregados vêm de `metrics.json`),
  e constantes (`schema`, `fw`, `quality`, `radio.preset/region`).
