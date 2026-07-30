# Protocolo de ensaio de campo

**Objetivo:** especificar, com precisão suficiente para outra pessoa executar, o
ensaio de campo que fecha a limitação mais séria desta entrega: **nenhum RSSI
real foi medido**. Todos os números de rádio do projeto vêm de simulação.

Este documento não pede confiança no modelo. Ele declara as previsões do modelo
**antes** da medição, com números, para que o ensaio possa **derrubá-las**. Um
protocolo que não pode falhar não valida nada.

> **Estado:** ⬜ não executado. Nenhuma placa foi montada. Nada aqui deve ser
> lido como resultado. Ver a seção "Limitações conhecidas" do README.

---

## 1. O que exatamente está sendo posto à prova

O modelo de propagação do projeto (`python/src/atg_mesh/lora.py`) é
log-distância:

```
PL(d) = 121,7 dB + 10 x 3,5 x log10(d em km)  [+ sombreamento]  [- 12 dB se LOS]
```

Ele **não foi ajustado aos dados deste projeto**. O `PL0` de 121,7 dB é a perda
de espaço livre a 1 km em 915 MHz (91,7 dB) somada a 30 dB de perda em excesso,
valor tabelado para ambiente urbano denso e vegetado. O expoente 3,5 é o valor
de literatura para NLOS urbano com relevo, que é o caso do Vale do Itajaí.

O modelo foi **validado, não calibrado**, contra o único ponto de campo
disponível na bibliografia: enlace de 2,47 km, TX 22 dBm, antenas stock, com
RSSI medido de -110 dBm. O modelo prevê -109,4 dBm, erro de 0,6 dB. Um ponto
não valida um modelo. Este ensaio existe para trazer os outros.

Parâmetros fixos do sistema (de `python/src/atg_mesh/config.py`):

| Parâmetro | Valor |
|---|---|
| Frequência | 915 MHz (região Meshtastic `ANZ`, 915 a 928 MHz) |
| Potência de transmissão | 22 dBm |
| Preset ativo | `LONG_FAST`: BW 250 kHz, SF 11, CR 4/5 |
| Figura de ruído | 6 dB |
| Piso de ruído calculado | -114,0 dBm |
| SNR mínimo de demodulação, SF 11 | -17,5 dB |
| Sensibilidade resultante | **-131,5 dBm** |
| `hop_limit` | 3 |
| Sombreamento assumido | log-normal, sigma 6 dB |

---

## 2. As previsões, declaradas antes de medir

### 2.1 Topologia prevista

Sete nós: cinco emissores, um repetidor em ponto elevado e o gateway na Defesa
Civil. Enlaces de cada emissor **direto ao gateway**, antenas de 5 dBi no campo
e 8 dBi no gateway (de `python/outputs/topology.csv`):

| Nó | Distância ao gateway | Margem prevista | Fecha? |
|---|---|---|---|
| ATG-BLU-01 Vila Itoupava | 18,44 km | **+0,5 dB** | no limite |
| ATG-BLU-02 Itoupava Central | 10,25 km | +21,4 dB | sim |
| ATG-BLU-03 Morro do Aipim (repetidor) | 2,66 km | +45,0 dB | sim |
| ATG-BLU-04 Garcia | 2,31 km | +32,1 dB | sim |
| ATG-BLU-05 Velha | ~3,8 km | +24,5 dB | sim |
| ATG-BLU-06 Prainha (régua) | ~0,1 km | +81,9 dB | sim |

Alcance máximo previsto, no ponto em que a margem chega a zero:

- **15,66 km** entre nós de campo, ambos com 5 dBi, sem linha de visada;
- **42,02 km** de um nó de campo para o repetidor elevado, com linha de visada e
  antena de 8 dBi.

### 2.2 A previsão central

**Vila Itoupava é o teste que importa.** É o único enlace direto ao gateway com
margem quase nula: **+0,5 dB**. Com sombreamento log-normal de sigma 6 dB, a
probabilidade de um pacote individual fechar esse enlace é:

```
P = Phi(margem / sigma) = Phi(0,5 / 6) = 53,3 %
```

E o PDR medido na simulação da topologia estrela, nesse nó, foi **52,7 %**.
A diferença é de 0,6 ponto percentual. Ou seja, os 52,7 % não são um número
arbitrário: são a probabilidade de sobrevivência de um enlace de margem 0,5 dB
sob sombreamento de 6 dB.

**Isso é o que o ensaio de campo tem de confirmar ou derrubar.** Se em campo o
nó de Vila Itoupava entregar 95 % dos pacotes direto ao gateway, o modelo de
sombreamento está errado. Se entregar 20 %, o `PL0` ou o expoente estão
subestimados. As duas respostas são úteis e as duas são publicáveis.

### 2.3 A hipótese da malha

Com `hop_limit = 3`, Vila Itoupava não depende do enlace direto: ele alcança
ATG-BLU-02 Itoupava Central a 8,76 km com margem de **+8,8 dB** (P = 93 %) e o
repetidor do Morro do Aipim a 16,65 km com **+2,1 dB**. A previsão é que a
retransmissão eleve o PDR desse nó de cerca de 53 % para próximo de 100 %.

Este é o resultado central do projeto inteiro. É ele que precisa de medição real.

### 2.4 Tempo no ar e ciclo de trabalho

Para o quadro ATG-C1 de 23 bytes, mais 16 bytes de cabeçalho Meshtastic:

| Preset | BW | SF | ToA previsto | Ciclo de trabalho a 1 pacote por hora |
|---|---|---|---|---|
| `LONG_FAST` | 250 kHz | 11 | **0,5591 s** | 0,0155 % |
| `LONG_SLOW` | 125 kHz | 12 | 2,2364 s | 0,0621 % |
| `MEDIUM_FAST` | 250 kHz | 9 | 0,1500 s | 0,0042 % |
| `SHORT_FAST` | 250 kHz | 7 | 0,0452 s | 0,0013 % |

Fórmula do datasheet Semtech SX1276, seção 4.1.1.7.

---

## 3. Material

| Item | Quantidade | Observação |
|---|---|---|
| ESP32 LoRa 915 MHz (T-Beam V1.1 ou Heltec V3) | 4 mínimo, 7 ideal | 2 para bancada, 3 para multi-hop |
| Antena 5 dBi SMA 915 MHz | 1 por nó de campo | |
| Antena 8 dBi SMA 915 MHz | 2 | repetidor e gateway |
| Sensor ultrassônico HC-SR04 | 1 | nó do rio |
| Divisor resistivo 1 kΩ / 2 kΩ | 1 | ECHO de 5 V para 3,3 V |
| Bateria LiPo 3,7 V 2000 a 3000 mAh ou 18650 | 1 por nó | |
| Multímetro com medição de corrente, ou medidor USB tipo INA219 | 1 | ensaio de consumo |
| GPS (o do T-Beam serve) | 1 por nó | registrar coordenada de cada ponto |
| Trena a laser ou aplicativo de distância | 1 | conferir a linha de visada |
| Notebook com Python e a CLI do Meshtastic | 1 | |

**Segurança em campo.** Nenhuma medição deve ser feita durante evento de chuva
forte ou com o rio acima da cota de observação (3 m). Margem da água em cheia
não é local de ensaio. Os pontos de medição próximos ao rio devem ser visitados
em tempo seco, com duas pessoas, e com a Defesa Civil avisada.

---

## 4. Configuração dos nós

```bash
./firmware/meshtastic_cli_config.sh /dev/ttyUSB0 ATG-BLU-06 06
```

Confirmar antes de qualquer medição, com `meshtastic --info` em cada nó:

- [ ] Região **`ANZ`**. Não usar `BR_902`: opera em 902 a 907,5 MHz, e a
      atividade exige 915 MHz. Nós em regiões diferentes não se falam.
- [ ] Preset **`LONG_FAST`** idêntico em todos os nós.
- [ ] Canal primário `ATG-Blumenau`.
- [ ] Canal `mqtt` existente, com downlink habilitado, se for testar downlink.
- [ ] `hop_limit` igual a 3.
- [ ] Relógio sincronizado em todos os nós, para o pareamento dos registros.

Registrar a versão exata do firmware Meshtastic. Uma mudança de versão pode
alterar retransmissão e resultados.

---

## 5. Ensaio 0: bancada, antes de ir a campo

**Pergunta:** o ESP32 produz o mesmo byte que o Python?

1. Dois nós na mesa, a 1 m de distância, antenas conectadas. **Nunca energizar
   sem antena:** o estágio de saída pode ser danificado.
2. Transmitir um quadro ATG-C1 conhecido pelo nó sensor.
3. Decodificar com o Python:

```bash
python -c "
import sys; sys.path.insert(0,'python/src')
from atg_mesh.codec import from_c1_bin
print(from_c1_bin(bytes.fromhex('1106006ca780422365d44065fefc4d13fde1030900034e')))"
```

**Critério de aceite:** os 23 bytes recebidos pelo rádio são idênticos, byte a
byte, aos gerados pelo Python para a mesma leitura. Zero divergência aceitável.
Se este ensaio falha, nada depois dele significa nada.

Este é o único ensaio que já pode ser feito **sem sair da mesa** e é o que
verifica a terceira implementação do codec, a de C++, contra as outras duas.

---

## 6. Ensaio 1: alcance por fator de espalhamento

**Pergunta:** a que distância o enlace deixa de decodificar, em cada SF?

Segue o protocolo de Zakaria et al. (2023), que varreu 100 a 600 m com SF 7 e
SF 12. Aqui a varredura é mais longa, porque o vale exige.

**Procedimento.** Nó A fixo em ponto conhecido. Nó B caminhando em linha, com o
módulo *Range Test* do Meshtastic ativo. Paradas **de 100 em 100 m até 1 km, e
de 500 em 500 m a partir daí**, até a perda total do enlace.

Em cada parada, **30 pacotes** e o registro de:

| Campo | Origem |
|---|---|
| coordenada GPS, altitude | GPS do nó |
| distância ao nó A | haversine sobre as coordenadas |
| RSSI de cada pacote | firmware |
| SNR de cada pacote | firmware |
| pacotes recebidos de 30 | contagem |
| obstrução (visada livre, vegetação, edificação, relevo) | observação anotada |

Repetir a varredura para **SF 7, SF 9, SF 11 e SF 12** (os quatro presets da
tabela da seção 2.4). São quatro varreduras: reservar um dia inteiro.

**Critério de aceite:** a distância de perda medida em SF 11 fica entre
**11 e 20 km** para o par campo a campo (previsão de 15,66 km, com tolerância de
um sigma de sombreamento em cada lado).

---

## 7. Ensaio 2: validação do modelo de propagação

**Pergunta:** o erro do modelo é compatível com o sombreamento que ele assume?

Usa os dados já coletados no Ensaio 1. Para cada parada, comparar o RSSI médio
medido com o previsto:

```bash
python -c "
import sys; sys.path.insert(0,'python/src')
from atg_mesh import lora
print(lora.link(5, 5, 2.47))"
```

**Critérios de aceite**, sobre pelo menos 12 pontos de medição:

| Métrica | Aceite | Por quê |
|---|---|---|
| Erro médio (viés) do RSSI | dentro de **±3 dB** | viés maior indica `PL0` errado |
| Desvio padrão do erro | **até 8 dB** | o modelo assume sigma de 6 dB |
| Inclinação ajustada de RSSI contra log10(d) | equivalente a expoente entre **3,0 e 4,0** | o modelo usa 3,5 |

Se o viés exceder 3 dB, **não ajustar o modelo silenciosamente**. Publicar o
`PL0` medido ao lado do `PL0` de literatura e declarar a correção.

---

## 8. Ensaio 3: multi-hop, a hipótese central

**Pergunta:** a retransmissão recupera o nó que a topologia estrela perde?

Este ensaio mede o resultado que sustenta o projeto inteiro. Três nós:
**origem**, **repetidor** em ponto elevado, **gateway**.

**Procedimento.**

1. Posicionar origem e gateway a uma distância em que o enlace **direto** fique
   marginal, isto é, com PDR medido entre 40 % e 70 %. A previsão do modelo diz
   que isso ocorre em torno de 18 km com 5 e 8 dBi, mas **usar o PDR medido, não
   a distância prevista**, para definir a posição. Este é o ponto do ensaio.
2. **Fase A, estrela:** `hop_limit = 1`, repetidor desligado. Transmitir
   **200 pacotes** a intervalo de 30 s. Registrar PDR, RSSI, SNR.
3. **Fase B, malha:** `hop_limit = 3`, repetidor ligado, sem mover nada mais.
   Repetir os 200 pacotes.
4. **Fase C, queda:** com a malha ativa, **desligar o repetidor** no meio de uma
   sequência de 200 pacotes e registrar o momento exato. Mede o tempo de
   recuperação e se a malha encontra caminho alternativo.

**Critérios de aceite:**

| | Previsão | Aceite |
|---|---|---|
| PDR na fase A (estrela) | ~53 % | entre 40 % e 70 % |
| PDR na fase B (malha) | próximo de 100 % | **acima de 95 %** |
| Ganho da malha sobre a estrela | ~47 pontos | **acima de 25 pontos percentuais** |
| Saltos médios na fase B | 1,09 | entre 1,0 e 2,0 |

O ganho é o número que o projeto afirma. Se a fase B não superar a fase A por
uma margem clara, a tese do projeto está errada e isso precisa ser dito.

---

## 9. Ensaio 4: tempo no ar e ciclo de trabalho reais

**Pergunta:** o ToA calculado corresponde ao medido?

1. Ler o *airtime* que o firmware Meshtastic reporta por pacote.
2. Comparar com `lora.time_on_air_s(23)`, cuja previsão é **0,5591 s** em
   `LONG_FAST`.
3. Medir o ciclo de trabalho agregado com os cinco nós transmitindo por 24 h,
   incluindo as retransmissões, que são o que realmente ocupa o canal.

**Critérios de aceite:**

- ToA medido dentro de **±10 %** dos 0,5591 s previstos.
- Ciclo de trabalho agregado **abaixo de 1 %**, com folga confortável em relação
  ao limite regulatório da faixa.

Atenção: a previsão de 0,0155 % por nó considera **um** pacote por hora. Com
5,97 transmissões por pacote medidas na simulação e reporte adaptativo em
evento, o valor real sobe. É isso que o ensaio de 24 h mede.

---

## 10. Ensaio 5: consumo e autonomia

**Pergunta:** o nó sobrevive à duração de uma cheia?

Uma cheia no Itajaí-Açu dura dias. Um nó que morre em 12 h não serve. Medir:

| Medição | Como |
|---|---|
| Corrente em repouso (deep sleep) | multímetro em série, média de 10 min |
| Corrente em transmissão | pico e média durante um envio |
| Corrente do HC-SR04 por leitura | isolar o sensor |
| Autonomia com reporte de 1 por hora | log de `battery_level` por 72 h |
| Autonomia com reporte adaptativo em risco `critical` | log por 24 h |

**Critério de aceite:** autonomia estimada de **pelo menos 7 dias** no regime
normal de 1 pacote por hora, e de **pelo menos 72 h** no regime de evento.
Sete dias é o mínimo defensável: cobre a duração de uma cheia mais a janela de
acesso para trocar bateria depois que a água baixa.

Registrar também a temperatura da caixa ao sol. Bateria LiPo em caixa fechada
exposta perde capacidade e é risco de segurança.

---

## 11. Ensaio 6: validação operacional com a Defesa Civil

**Pergunta:** a mensagem serve para quem decide a evacuação?

Os cinco ensaios anteriores medem rádio. Este mede utilidade, e é o que separa
um projeto de engenharia de um sistema de alerta.

**Procedimento.**

1. Levar à Defesa Civil de Blumenau o registro real de 36 transições de alerta
   de `python/outputs/alerts.jsonl`, referentes ao evento de outubro de 2023, que
   é um evento que eles viveram.
2. Para cada transição, perguntar:
   - A mensagem está correta quanto ao estágio oficial?
   - A instrução ao morador é a que vocês dariam?
   - O momento do disparo foi cedo, tarde ou adequado?
   - Faltou informação? Sobrou?
3. Apresentar especificamente o quadro do pico, com 169 caracteres:

```
[ATG-BLU] ALERTA MAXIMO: Rio Itajai-Acu 9.93m (estavel) em Prainha.
Cota 1as vias 7.4m. Deixe areas de risco AGORA. Procure ponto alto/abrigo.
Emerg 199/193. 08/10 21:00
```

4. Perguntar sobre o **falso positivo**, não só sobre o acerto: qual taxa de
   alarme falso tornaria o sistema inútil para eles? Essa resposta é o
   requisito operacional que o projeto ainda não tem.
5. Registrar as respostas verbatim, com data e nome de quem respondeu, mediante
   autorização.

**Critério de aceite:** a Defesa Civil considera a mensagem **utilizável sem
reescrita** em pelo menos 30 das 36 transições. Toda discordância entra no
documento como requisito, não como crítica descartada.

Levar também a pergunta do nó 03: o Morro do Aipim é de fato o melhor ponto
elevado para o repetidor, na avaliação de quem conhece o terreno?

---

## 12. Planilha de coleta

Um arquivo por ensaio, em CSV, com estas colunas mínimas:

```csv
ensaio,timestamp_utc,no_tx,no_rx,lat_tx,lon_tx,alt_tx,lat_rx,lon_rx,alt_rx,
distancia_km,preset,sf,bw_hz,tx_dbm,antena_tx_dbi,antena_rx_dbi,
pacotes_enviados,pacotes_recebidos,rssi_dbm,snr_db,saltos,
obstrucao,tempo,observacao
```

Regras de registro:

- **Uma linha por pacote** quando possível, não só a média. A distribuição do
  RSSI é o que valida o sigma do sombreamento, e ela se perde na média.
- `obstrucao`: `visada`, `vegetacao`, `edificacao` ou `relevo`.
- `tempo`: condição meteorológica. Chuva forte atenua em 915 MHz e precisa ser
  anotada, não descartada.
- Nunca sobrescrever uma medição ruim. Anotar o motivo e manter a linha.

---

## 13. O que fazer se o modelo falhar

Este é o item mais importante do protocolo, e a razão de ele existir.

| Resultado | Leitura | Ação |
|---|---|---|
| RSSI medido muito **melhor** que o previsto | `PL0` ou expoente pessimistas | publicar os dois valores; o alcance real é maior, e o projeto ganha |
| RSSI medido muito **pior** | o vale atenua mais que a literatura | recalcular a topologia; pode exigir mais repetidores |
| PDR da estrela muito acima de 53 % | modelo de sombreamento otimista demais na cauda | o ganho da malha é menor que o afirmado, e isso precisa ser corrigido no README |
| PDR da malha abaixo de 95 % | a retransmissão não resolve como previsto | é a descoberta mais valiosa do ensaio, e precisa ir para o texto |
| Consumo acima do esperado | autonomia insuficiente | rever período de reporte e o regime adaptativo |

**Regra:** nenhum resultado medido é descartado por contrariar a simulação. Se o
campo discordar do modelo, o campo está certo e o texto do projeto muda. Um
resultado que derruba a previsão vale mais, academicamente, do que um que a
confirma, porque é o único que prova que a medição foi real.

---

## 14. Resumo dos critérios de aceite

| Ensaio | Critério |
|---|---|
| 0. Bancada | 23 bytes idênticos ao Python, zero divergência |
| 1. Alcance | perda do enlace em SF 11 entre 11 e 20 km |
| 2. Propagação | viés do RSSI em ±3 dB, desvio até 8 dB, expoente entre 3,0 e 4,0 |
| 3. Multi-hop | PDR da malha acima de 95 %, ganho acima de 25 pontos |
| 4. ToA | dentro de ±10 % de 0,5591 s; ciclo de trabalho abaixo de 1 % |
| 5. Consumo | 7 dias em regime normal, 72 h em evento |
| 6. Defesa Civil | 30 das 36 mensagens utilizáveis sem reescrita |

Executados os seis, a limitação 6 do README deixa de existir, e as métricas de
rádio do projeto passam de 🔶 simulado para ✅ medido.
