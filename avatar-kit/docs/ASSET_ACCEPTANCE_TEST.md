# Teste de aceitação do asset

Nenhum asset é aceito porque abre no three.js, tem 52 blendshapes, tem rig, fala ou pisca. Ele precisa passar por **dois** critérios.

| Critério | Quem julga | Pergunta |
|---|---|---|
| **Técnico** | o código (`AssetValidator`), automático e repetível | O arquivo é válido, o rig funciona, os alvos se comportam, cabe no orçamento da web? |
| **Visual** | uma pessoa (você), com roteiro | **"Parece uma executiva digital premium ou parece um avatar 3D genérico?"** Se genérico: **rejeitar.** |

O código não julga beleza. Por isso 54 dos 100 pontos são automáticos e 46 vêm do roteiro visual, e **nenhum asset pode ser aceito só pela parte técnica** (o veredito fica `PENDENTE` até a avaliação visual).

## 0. Aprovação em quatro frentes

Uma cabeça só é aprovada quando passa **ao mesmo tempo** por:

| Frente | Condição | Onde |
|---|---|---|
| **Qualidade visual** | scorecard visual ≥ 85, nenhuma barreira, nenhum item abaixo de 3 | `EXECUTIVE_AVATAR_VISUAL_SCORECARD.md` |
| **Presença executiva** | as 3 perguntas do teste de 1,5 s com ≥ 80% de "sim" | scorecard, seção 5 |
| **Identidade da personagem** | I1 a I4 ≥ 4: originalidade, consistência, DNA visual, comparação cega | scorecard |
| **Validação técnica** | validador sem barreira reprovada **e** ≥ 85% dos 54 pontos automáticos | este documento |

Nenhuma nota alta em uma frente compensa a falha em outra. As seções abaixo detalham a frente técnica e o roteiro de revisão; a rubrica de 13 itens do Avatar Lab é a forma rápida do scorecard visual (mapeamento na seção 8 dele). Se o Lab disser "premium" e uma barreira do scorecard for acionada, o resultado é REJEITAR.

## 1. Nota (0 a 100)

Os pesos partem da sugestão original (25/15/10/10/15/10/5/5/5). Ajuste feito: cada categoria é dividida entre o que o código consegue medir e o que só uma pessoa julga, porque "Facial Quality" e "Hair" não são mensuráveis por código, e "Eyes", "Materials" e "Lip Sync" são metade estrutura, metade aparência.

<!-- BEGIN:categories -->
| Category | Points | Automatic | Human rubric |
|---|---|---|---|
| Facial Quality | 25 | 0 | 25 |
| Eyes | 15 | 8 | 7 |
| Materials | 10 | 6 | 4 |
| Hair | 10 | 3 | 7 |
| Facial Rig | 15 | 15 | 0 |
| Lip Sync | 10 | 7 | 3 |
| Animation Readiness | 5 | 5 | 0 |
| Performance | 5 | 5 | 0 |
| Web Delivery | 5 | 5 | 0 |
| **Total** | **100** | **54** | **46** |
<!-- END:categories -->

Regras de cálculo:
* a parte automática de cada categoria é a média ponderada das verificações **medidas**; uma verificação que não pôde ser medida (por exemplo FPS em renderização por software) não pontua nem penaliza, e a categoria é reescalada;
* a parte humana de uma categoria só conta quando **todos** os seus itens foram avaliados; enquanto isso a nota total é `—` e o veredito é `PENDENTE`;
* Fase 1 (cabeça) não cobra o que só existe no corpo: sheen do tecido, clipe idle, ossos de coluna e ombros, e usa o orçamento menor de triângulos, arquivo e texturas.

Veredito:

| Resultado | Condição |
|---|---|
| **ACEITAR** | nota ≥ 85 **e** nenhuma barreira reprovada |
| **REVISAR** | nota 70 a 84, nenhuma barreira reprovada: devolver ao artista com a lista numerada do relatório |
| **REJEITAR** | nota < 70, **ou** qualquer barreira reprovada, **ou** "parece avatar genérico" |
| **PENDENTE** | parte técnica sem reprovação, falta a avaliação visual |

### Barreiras (reprovam o asset, qualquer que seja a nota)

<!-- BEGIN:gates -->
* GLB válido e carregado
* Rig com cobertura full ou good
* Mandíbula presente
* Olhos com rig (ossos ou eyeLook)
* Visemas nativos (≥ 13 de 15)
* Arquivo ≤ 15 MB (limite duro)
* Sem URIs externas
* Expressões sem valores inválidos (NaN)
* Parece executiva digital premium (e não avatar 3D genérico)
* Qualidade facial ≥ 3.5/5 e nenhum item ≤ 1
<!-- END:gates -->

Mais as duas barreiras visuais, ativas quando você avalia: **"Parece executiva digital premium"** (o botão "avatar genérico" rejeita) e **qualidade facial média ≥ 3,5/5 sem nenhum item abaixo de 2**.

## 2. Teste técnico (automático)

Orçamentos por fase:

<!-- BEGIN:phases -->
| | Phase 1 (head) | Final character |
|---|---|---|
| File size (target / hard limit) | 6 MB / 8 MB | 12 MB / 15 MB |
| Triangles (all meshes) | 45,000 | 75,000 |
| Draw calls | 8 | 12 |
| Texture memory (GPU) | 40 MB | 64 MB |
| Skinned meshes | 4 | 6 |
<!-- END:phases -->

Verificações (pontos dentro da parte automática de cada categoria):

<!-- BEGIN:checks -->
| Category | Check | Points (auto) |
|---|---|---|
| Eyes | Ossos dos dois olhos | 2 |
| Eyes | Pivô do olho no centro do globo (≤ 0,25 do raio) | 1.5 |
| Eyes | Globos oculares como malhas separadas (≥ 2) | 1 |
| Eyes | Córnea/reflexo (malha de córnea ou material com clearcoat/transmissão) | 1.5 |
| Eyes | Morphs eyeLook (8) para as pálpebras acompanharem o olhar | 1.5 |
| Eyes | Piscada independente esquerda/direita | 0.5 |
| Materials | Pele com mapa de cor (albedo) | 1 |
| Materials | Pele com mapa de normal (microdetalhe) | 1.5 |
| Materials | Pele com rugosidade variável (mapa de rugosidade ou ORM) | 1.5 |
| Materials | Resolução da pele ≥ 1024 (rosto), ≤ 4096 | 0.5 |
| Materials | No máximo 8 materiais | 0.5 |
| Materials | Sem materiais sem iluminação (unlit) | 0.5 |
| Materials | Tecido com sheen (vestido) | 0.5 |
| Hair | Malha de cabelo presente | 1.5 |
| Hair | Cabelo entre 3 mil e 25 mil triângulos | 0.75 |
| Hair | Transparência do cabelo tratada (alphaTest, blend ou alpha-to-coverage) | 0.75 |
| Facial Rig | Cobertura dos 52 canais ARKit (≥ 98%) | 4.5 |
| Facial Rig | Nenhum blendshape morto (sem deslocamento) | 2 |
| Facial Rig | Deslocamentos dentro de limites (≤ 20% da altura da cabeça) | 1.5 |
| Facial Rig | Pares esquerda/direita coerentes (razão ≥ 0,55) e assimetria autoral | 1.5 |
| Facial Rig | Dentes acompanham mandíbula/boca (morphs nos dentes) | 1.5 |
| Facial Rig | Língua com morphs (tongueOut e visemas de língua) | 1 |
| Facial Rig | Mandíbula (morph jawOpen ou osso Jaw) | 1 |
| Facial Rig | Extensão jawClench (tensão da mandíbula para FIRM/DECISIVE) | 0.5 |
| Facial Rig | Composição: as 11 emoções produzem rosto vivo e sem distorção | 1.5 |
| Facial Rig | CÉTICA é assimétrica (≥ 0,12 entre os lados) | 0.5 |
| Lip Sync | 15 visemas nativos | 3 |
| Lip Sync | Visemas distintos entre si (sem cópias) | 1.5 |
| Lip Sync | Língua e dentes participam dos visemas | 1 |
| Lip Sync | Fala completa: a boca abre e fecha, não fica aberta | 1.5 |
| Animation Readiness | Clipe idle (laço de 3 a 8 s, fechado) | 1.5 |
| Animation Readiness | Ossos necessários (cabeça, pescoço, olhos, mandíbula, coluna, ombros) | 2 |
| Animation Readiness | Clipes só de ossos (sem trilhas de morph) | 1 |
| Animation Readiness | Clipes extras (Talk, ListenNod): opcional | 0.5 |
| Performance | Triângulos dentro do orçamento (75.000) | 2 |
| Performance | Draw calls ≤ 12 | 1 |
| Performance | Malhas com skin ≤ 6 | 0.5 |
| Performance | FPS ≥ 55 em GPU real | 1.5 |
| Web Delivery | Arquivo ≤ 12 MB | 2 |
| Web Delivery | Geometria comprimida (meshopt ou Draco) | 1 |
| Web Delivery | Texturas KTX2 (Basis) | 1 |
| Web Delivery | Memória de textura ≤ 64 MB | 0.5 |
| Web Delivery | Sem recursos externos (tudo dentro do .glb) | 0.5 |
<!-- END:checks -->

O que é medido de verdade, além de contar nomes:
* **Blendshapes:** o deslocamento de cada alvo, em alturas de cabeça (1,0 = a cabeça inteira). *Morto* (< 0,00003), *explosivo* (> 0,20), pares esquerda/direita quebrados (razão < 0,55) e **espelho mecânico** (pares idênticos: o artista copiou um lado).
* **Visemas:** distinção entre os 15 (pares quase idênticos = cópia), presença de língua e dentes nos visemas.
* **Olhos:** pivô do osso contra o centro do globo (≤ 0,25 do raio), córnea, `eyeLook` para as pálpebras.
* **Expressões (teste real):** o motor aplica as 11 emoções e os 9 estados e o validador mede o deslocamento real da malha: emoção "morta" (< 0,0003 da cabeça), distorção (> 0,14), valores inválidos, e se CÉTICA é assimétrica (≥ 0,12).
* **Lip sync (teste real):** os 15 visemas ao peso 1, quão distintos são entre si e quanto do movimento fica na metade de baixo do rosto; depois uma fala de 10 sons: a boca precisa abrir e fechar.
* **Entrega:** tamanho do arquivo, meshopt/Draco, KTX2, memória de textura, URIs externas, tempo de carregamento.

Limites conhecidos do teste automático (declarados no relatório):
* não vê penetração de dentes nos lábios, pálpebra atravessando o olho, dobras ruins nem "pele de plástico": isso é visual;
* sem GPU real (como no ambiente de testes da CI) o FPS **não** é válido e não pontua; meça na sua máquina com o Avatar Lab;
* espalhamento subsuperficial é julgado por proxy (mapas na pele) e visualmente, porque o glTF não define SSS padrão;
* classifica malhas pelo **nome** (`Head`, `EyeLeft`, `Teeth`, `Tongue`, `Hair`...): por isso o briefing exige esses nomes.

## 3. Teste visual (humano)

Faça na ordem. Use o **Avatar Lab**: botão "Revisão guiada" (percorre tudo) e depois as notas em "Asset Validation".

**3.1 Luz e plano.** Veja o rosto nos 3 estilos de câmera/luz (conversation, executive, intimate) e nos planos CLOSE e MEDIUM. Pele que só funciona numa luz é reprovada.

**3.2 Revisão guiada (Fase 2).** neutral, listening, thinking, analyzing, firm, skeptical, empathy, confidence, speaking com fonemas, lip sync só com áudio, eye tracking (esquerda, direita, baixo, cima, câmera), blinking, teste de presença de 1,5 s.

**3.3 Notas (0 a 5).**

<!-- BEGIN:rubric -->
| Category | Item (score 0 to 5) |
|---|---|
| Facial Quality | Proporções humanas, mandíbula, queixo, maçãs e nariz elegantes |
| Facial Quality | Pele: poros, variação de cor, brilho que varia por zona, sem aparência de plástico |
| Facial Quality | Lábios com volume, dentes, língua e interior da boca convincentes |
| Facial Quality | Pequenas assimetrias e imperfeições que a tornam humana |
| Facial Quality | Microexpressões legíveis: listening, thinking, firm, skeptical, empathetic |
| Facial Quality | Autoridade, inteligência e serenidade: a pessoa mais atenta da sala |
| Eyes | Íris, esclera, córnea e brilho (catchlight) com profundidade |
| Eyes | Olhar vivo: micro-sacadas, pálpebras acompanham, sem olhar fixo de boneca |
| Eyes | O olhar comunica os estados (ouvindo, analisando, firme, empatia, confiança), sem olhos arregalados |
| Materials | Pele sob os três estilos de luz (conversation, executive, intimate) |
| Materials | Reflexo/refração do olho, tecido do vestido, sem brilho exagerado |
| Hair | Parece cabelo: volume, variação, sem fitas plásticas nem capacete |
| Lip Sync | Lip sync: fechamentos em p/b/m, f/v, dentes e língua visíveis; não é só abrir e fechar |
<!-- END:rubric -->

Âncoras: **0** = defeito evidente, quebra a ilusão · **2** = visível e incômodo · **3** = aceitável, genérico · **4** = bom, de produção profissional · **5** = excepcional, sustenta close-up de cinema. Um 3 em tudo é "genérico", não "bom".

**3.4 Pergunta final.** "Parece uma executiva digital premium ou parece um avatar 3D genérico?" Responda no botão correspondente. Se tiver dúvida, é genérico.

**3.5 Teste de presença.** O usuário terminou de falar; 1,5 s de silêncio; olhar direto; pequena mudança de sobrancelha; respiração; inclinação de cabeça de poucos graus; ela responde. Pergunta: *inteligência ou animação?*

**3.6 Teste de semelhança** (Fase 3, antes da aprovação): mostre uma imagem a 10 pessoas sem contexto: "com quem ela se parece?". Duas ou mais citando a mesma pessoa real → devolver.

### Lista de defeitos que reprovam na hora

* olhos mortos ou sempre arregalados; olhar que não acompanha a pálpebra; catchlight chapado;
* dentes atravessando o lábio; lábios que se separam ao fechar (p/b/m); língua inexistente em th/d/n/r;
* cantos da boca que "estouram" nas combinações; dobras e interpenetração em sorriso + mandíbula aberta;
* pele de plástico, sem variação de rugosidade, sem microdetalhe; pele que muda de cor sob outra luz;
* cabelo de capacete, fitas, brilho de espelho, borda de alfa serrilhada;
* simetria perfeita (rosto de boneca); assimetria só nas expressões;
* rosto reconhecível como pessoa real; aparência de avatar genérico de serviço.

## 4. Como validar qualquer GLB que você receber

**Pelo navegador (recomendado):** abra `dist/avatar-lab.html` (ou o link do Avatar Lab) → "Carregar GLB" (se os nomes forem diferentes, cole um `RigMap` JSON antes) → escolha a fase (cabeça ou completo) → **Validar asset carregado** (≈ 10 s) → leia a nota técnica, as barreiras e os relatórios (rig, blendshapes, visemas, olhos, boca, materiais, geometria/arquivo/animação, FPS, expressões, lip sync) → rode a **Revisão guiada** → dê as notas e o veredito visual → **Copiar relatório (JSON)** e envie ao fornecedor.

**Pela linha de comando (também serve para o fornecedor):**

```bash
node tools/validate-glb.js exec_head_v001.glb --phase=head --json=report.json
node tools/validate-glb.js exec_full_v003.glb --phase=full --rigmap=rigmap.json --scores=manual.json
```

Códigos de saída: `0` ACEITAR · `2` PENDENTE (técnico ok) · `3` REVISAR · `1` REJEITAR ou erro. `manual.json` tem a forma `{ "scores": { "f_skin": 4, ... }, "overall": "premium" }`.
A linha de comando usa Chromium sem GPU: o FPS sai "não medido".

**O que mandar de volta ao fornecedor:** o JSON, a lista "itens abaixo de 70%" e as barreiras reprovadas. Cada item tem o valor medido, então a correção é objetiva.

## 5. Critérios por fase

| Fase | Aceita quando |
|---|---|
| 1. Cabeça | nota técnica sem barreira reprovada **e** nota visual com facial ≥ 3,5 **e** "premium"; nota total ≥ 85 com o orçamento de cabeça |
| 3. Aprovação visual | sua aprovação por escrito, mais o teste de semelhança |
| 4. Final | nota ≥ 85 no orçamento completo, FPS ≥ 55 em GPU real, e as mesmas barreiras |

## 6. Calibração (para não confiar cegamente na nota)

* O validador foi testado com quatro arquivos sintéticos (rig completo; sem ossos de olho/visemas; só ossos; nomes de estúdio com lados invertidos). O arquivo de rig completo, que **é** só um elipsoide, passa nas barreiras e fica em ~60% técnico, e **nunca** é aceito porque o código não vê beleza: esse é o comportamento desejado.
* Na primeira entrega real, rode o validador **e** compare a nota com a sua impressão visual. Se divergirem muito, o ajuste é nos pesos ou limites (`AssetValidator.js`), não no veredito humano.
* Os limites numéricos (0,00003 / 0,14 / 0,20 / 0,25) são pontos de partida defensáveis, não normas da indústria: reavalie com o primeiro asset profissional.
