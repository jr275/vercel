# Direção de arte: como decidimos e como julgamos

Documento interno. A **definição da personagem** (quem ela é, cada medida, cor e expressão) está em `EXECUTIVE_AVATAR_CHARACTER_BIBLE.md`: aquele é o documento mestre. Este aqui diz **como a direção de arte funciona**: os princípios, as trocas permitidas, o que o artista pode e não pode decidir, e o fluxo de aprovação. Ele existe para que o fornecedor não interprete livremente.

| Documento | Função |
|---|---|
| `EXECUTIVE_AVATAR_CHARACTER_BIBLE.md` | **Quem é e como parece.** Decisões travadas (DEC-01 a DEC-09), rosto, olhos, pele, cabelo, roupa, paleta, linguagem cinematográfica, expressões, DNA visual |
| **este documento** | Princípios, trocas, política de referências, liberdade do artista, fluxo de aprovação |
| `EXECUTIVE_AVATAR_ASSET_BRIEF.md` | O pacote que o fornecedor recebe (11 partes; incorpora a Bible sem a referência interna) |
| `EXECUTIVE_AVATAR_VISUAL_SCORECARD.md` | Nota visual de 100 pontos com barreiras |
| `ASSET_ACCEPTANCE_TEST.md` | Teste técnico e as quatro frentes de aprovação |
| `EXECUTIVE_AVATAR_VENDOR_EVALUATION.md` | Matriz de fornecedores e o teste pago da Fase 0 |

## 1. Personagem, não avatar

Um avatar genérico pergunta "como faço uma mulher 3D bonita?". Nós perguntamos **"quem é essa mulher?"** e a resposta determina cada decisão visual: Vera Halden (nome provisório), 43 anos, conselheira executiva de formação psicológica, a pessoa em quem o CEO confia para ouvir o que não quer ouvir. A severidade está na estrutura do rosto; o calor, na atenção. Se uma decisão de arte não serve a essa mulher, ela está errada, ainda que fique bonita.

O nome "Wendy" e o rosto da atriz não fazem parte da identidade do produto. **Wendy Behavioral System** é o nome interno do motor de comportamento; a personagem visual é tratada como **proprietary executive character**.

## 2. O dial de estilo

**Premium cinematic animated character, realismo estilizado.** Em termos práticos:

| Dimensão | Posição | Consequência |
|---|---|---|
| Proporções e materiais | **Realistas** | olhos de tamanho humano, pele que se comporta como pele, tecido que cai como tecido |
| Idealização | **Baixa** | nenhum filtro de beleza, nenhuma simetria perfeita, linhas de expressão presentes |
| Estilização | No **acabamento** | microdetalhe controlado, subsurface pintado, cabelo e tecido construídos sem mostrar costura, luz de retrato de cinema |
| Fotorrealismo | **Não é a meta** | perseguir o fotorrealismo total leva ao vale da estranheza; perseguimos um rosto que aguenta o close e parece vivo |

## 2.1 Onde gastar detalhe (ordem)

1. **Olhos** (forma, íris, córnea, pálpebras, brilho). 2. **Boca em fala** (lábios, dentes, língua, cantos). 3. **Pele do rosto** (variação, microdetalhe). 4. **Sobrancelhas e linha do cabelo.** 5. Cabelo. 6. Pescoço e clavícula. 7. Roupa. 8. Corpo. Qualquer trade-off segue essa ordem: **o rosto vence o corpo, os olhos vencem o resto do rosto.**

## 3. Trocas permitidas

| Conflito | Regra |
|---|---|
| Rosto × corpo | Rosto. O corpo pode ficar mais simples; o rosto não |
| Realismo × desempenho na web | Preservar olhos, boca e pele do rosto; reduzir cabelo, roupa e corpo primeiro |
| Fidelidade × originalidade | Originalidade. Se um traço lembra uma pessoa real, muda |
| Beleza × caráter | Caráter. Preferimos um rosto marcante a um rosto "perfeito" |
| Detalhe × consistência | Consistência de identidade entre luzes, planos, expressões e fala |
| Velocidade × qualidade | Qualidade. Prazo é critério 7 e preço é critério 8 |

## 4. Onde o vale da estranheza costuma aparecer (e como evitar)

| Sintoma | Causa mais comum | Prevenção no briefing |
|---|---|---|
| Olhos mortos | sem córnea/brilho, íris chapada, olhar sem micro-movimento | Bible 3; barreira B2; eyeLook morphs |
| Boca "borrachuda" quando fala | visemas derivados de ARKit, sem língua/dentes | visemas nativos; teste de fala; barreira B11 |
| Rosto de boneca | simetria perfeita, pele lisa | assimetria no neutro; barreira B7/B8 |
| Dez rostos | expressões grandes demais ou alvos que mudam a identidade | orçamento de amplitude; teste de sobreposição (X1) |
| Pele que muda sob outra luz | cor assada, rugosidade uniforme | S5; três estilos de luz |
| Cabelo de capacete | cartões sem variação, brilho de espelho | Bible 6; barreira B9 |

## 5. Política de referências

* **Nenhum rosto de pessoa real** como referência de modelagem, nem fotos da atriz, nem de qualquer outra pessoa identificável. O fornecedor recebe **palavras** (moodboard textual da Bible, seção 14) e medidas, não rostos.
* Aceitável no quadro de estilo: referências de **iluminação, câmera, tecido, cor, textura de pele em close genérico sem identificar pessoa, cabelo (só o tipo de queda e de volume, sem identificar a pessoa)**, e frames de cinema **apenas para luz e composição, nunca para feição**. Qualquer imagem anexada precisa de autorização de uso.
* O fornecedor não deve pedir fotos de pessoas reais para "ajudar". Se pedir, é sinal de que o briefing não está claro ou de que o processo dele depende de uma pessoa real: avaliar com cuidado.

## 6. O que o artista decide e o que não decide

| Travado (não interpretar) | Livre dentro do limite |
|---|---|
| Proporções e razões do rosto, assimetrias numéricas, idade, tom de pele, cor e forma dos olhos, cor/comprimento/repartição do cabelo, vestido, acessórios, paleta, regra de não sorrir por padrão, amplitudes das expressões | Esculpir os detalhes dentro das tolerâncias (±5% das razões, ±6% da cor), pintar poros e linhas, construir o groom ou os cartões, topologia, UVs, escolher a técnica de rig, o nome interno de cada alvo **dentro** da convenção ARKit/Oculus |

Qualquer desvio das colunas "travado" precisa de **aprovação por escrito** antes de ser feito (barreira B14).

## 7. Fluxo de aprovação

| Fase | O que mostrar | Quem aprova | Critério |
|---|---|---|---|
| **0. Folha de design** | frente, três quartos, perfil; close de olho e de pele; estudos de cabelo e gola; 2 renders de luz; o still de presença | dono + 2 revisores | scorecard (stills), teste de presença em stills, teste de semelhança, DNA visual (≥ 9 de 10) |
| **1. Cabeça** | GLB + relatório do validador + reference renders + **vídeo de fala** | dono + 5 revisores | **quatro frentes** (visual ≥ 85, presença ≥ 80%, identidade, validação técnica) |
| **3. Aprovação** | revisões da Fase 2 | **somente o dono**, por escrito | libera a Fase 4 |
| **4. Final** | personagem completo | dono + revisores | scorecard completo + validador no orçamento completo |

Regra do vídeo de fala: **a primeira coisa que olhamos em qualquer entrega é ela falando**. Um rosto bonito que morre quando fala é o risco principal.

## 8. Decisões que ainda dependem de você (antes do kickoff)

| ID | Decisão | Padrão (já travado) | O que confirmar |
|---|---|---|---|
| DEC-01 | Nome | Vera Halden (provisório) | busca de marca e domínio; checar que não é figura pública |
| DEC-03 | Tom de pele | oliva neutro, Fitzpatrick III, sem origem única | se você prefere outro tom: muda a paleta de pele da Bible (seção 5) e a pintura do subsurface |
| DEC-08 | Fios prateados | 3 a 5 fios na têmpora esquerda | manter ou remover |
| — | Quadro de estilo | vazio | anexar apenas luz, câmera, tecido e cor (política da seção 5) |
| — | Orçamento e prazo da Fase 0/1 | a definir | ver a matriz de fornecedores |

Tudo o mais está travado como escrito na Bible.

## 9. O que o motor já faz e o que o asset precisa fazer

O motor (não alterado) compõe expressões a partir de canais ARKit, controla olhar, piscadas, respiração, cabeça e fala. **O asset precisa dar a ele um rosto que mereça essa atuação**: 52 canais bem esculpidos (principalmente os sutis), 15 visemas nativos com língua e dentes, olhos com pivô correto e pálpebras que acompanham, e assimetria autoral. Esses requisitos são testados pelo validador; a aparência, pelo scorecard.
