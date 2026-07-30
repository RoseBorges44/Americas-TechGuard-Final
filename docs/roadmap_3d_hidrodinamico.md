# Próximos passos - inundação 3D hidrodinâmica (rua e edificação)

> **Estado honesto:** ⬜ **não implementado / não validado.** Este documento
> especifica o caminho. A demo atual usa o HAND como **proxy de primeira ordem**
> (🔶 lâmina cota→inundação simplificada) - não uma previsão hidrodinâmica.

## 1. Onde estamos vs. onde isto chega

| | Demo atual (HAND) | Alvo (hidrodinâmico 2D/3D) |
|---|---|---|
| Modelo | Height Above Nearest Drainage - geométrico | Equações de águas rasas (física) |
| Saída | Extensão da lâmina (onde molha) | Profundidade **e** velocidade por célula, no tempo |
| Escala | Regional (~30-90 m) | Rua/edificação (~1 m) |
| Custo | Segundos, offline, sem dado extra | Dado + malha + compute + calibração |
| Selo | 🔶 aproximação declarada | ⬜ requer dado e validação |

O HAND responde *"até onde a água chega"*. O hidrodinâmico responde *"quão fundo,
com que velocidade e em quanto tempo"* - que é o que permite falar de **ruas e
edificações**.

## 2. O gargalo real (não é o software)

QGIS/ArcGIS, HEC-RAS 2D, Iber, LISFLOOD-FP e SFINCS são **gratuitos**. O que falta:

1. **DEM de alta resolução** que hoje **não temos**: LiDAR aerotransportado
   (~1 m, solo nu) ou fotogrametria de drone (SfM, ~cm). Sem ele, o "3D" recai
   no mesmo DEM ~30 m que o HAND já usa - seria HAND com passos a mais.
2. **Calibração e validação** contra a cheia real de outubro/2023. Sem validar,
   é animação, não previsão.

## 3. Requisitos de dado

- **DEM/DSM:** LiDAR ≤ 1 m (preferido) ou drone (RTK/PPK para acurácia vertical
  ≤ 10 cm). DTM (solo nu) para o escoamento; DSM (com edificações) para bloquear
  o fluxo em prédios.
- **Batimetria do canal** do Itajaí-Açu (o LiDAR aéreo não enxerga o leito submerso).
- **Uso do solo** → coeficiente de rugosidade de Manning por classe.
- **Condição de contorno de entrada:** hidrograma de vazão (GloFAS / telemetria
  AlertaBlu de 15 min) na seção de montante.
- **Estruturas:** pontes, diques, bueiros (se houver dado).

## 4. Ferramentas e pipeline

1. **QGIS/ArcGIS** - preparo: fusão LiDAR+batimetria, recorte, rugosidade, seções.
2. **Motor 2D** - HEC-RAS 2D (ou Iber / LISFLOOD-FP / SFINCS): malha, condições
   de contorno, simulação do evento.
3. **Pós** - rasters de profundidade e velocidade por passo de tempo; exportar
   para o mesmo formato de grade embutida que a demo já usa (ver `build_hand.py`),
   de modo que a tela **pré-computada** rode offline, sem dependência de rede.

> A demo **nunca** roda o solver ao vivo no navegador - ele é pesado e offline é
> regra. O padrão é **pré-computar** e **embutir** os resultados, exatamente como
> foi feito com o HAND.

## 5. Calibração e validação (o que torna isto sério)

- **Âncora observada:** cota oficial da Defesa Civil de **10,19 m em 09/10/2023**;
  a demo já deriva **9,93 m** (erro 0,26 m / 2,6 %) pela curva-chave aproximada.
- **Marcas de cheia** pintadas em prédios do centro de Blumenau (calibração de
  extensão).
- **Métrica de aceite:** ajustar Manning até a **extensão simulada** casar com a
  mancha observada (índice de acerto/Fit ≥ alvo) e a **cota nas seções** cair
  dentro de ± X cm das réguas.

## 6. Critérios de aceite

- [ ] DEM ≤ 1 m validado (RMSE vertical reportado).
- [ ] Modelo 2D rodado para o evento 04-14/10/2023.
- [ ] Extensão simulada vs. observada: Fit ≥ 0,7 (ou critério acordado com a Defesa Civil).
- [ ] Profundidade nas seções dentro da tolerância das réguas.
- [ ] Resultado exportado como grade embutida (offline, mesmo padrão do HAND).
- [ ] Selo atualizado de ⬜ para ✅ **somente após validação**.

## 7. Limitações e honestidade

Enquanto os itens acima não fecharem, **não se apresenta previsão 3D como real ou
validada** (Regras Invioláveis §1 e §3). A vista 2.5D disponível na demo é uma
**visualização da lâmina do HAND** (regional, 🔶) - extrusão do dado que já temos,
não física nova nem escala de rua.
