# Avaliação de fornecedores

Ninguém foi contratado. Este documento tem três partes: (1) a matriz para comparar fornecedores, (2) o teste pago da Fase 0 que transforma "parece bom no portfólio" em evidência, (3) os 5 candidatos pré-selecionados pela pesquisa, com notas e o que falta verificar.

**Aviso de método (leia primeiro).** A pesquisa foi feita por buscas na web em outubro de 2026. **Não consegui abrir os sites, os portfólios nem os vídeos dos fornecedores** (o ambiente bloqueia esses domínios); as informações vêm de descrições públicas em resultados de busca. Portanto **todas as notas dos candidatos são estimativas por evidência nível C** (descrição pública), limitadas a 3 em qualquer critério visual até que você veja o trabalho. O que a pesquisa permite afirmar é "este fornecedor declara fazer isto"; o que ela não permite afirmar é "isto é bom". Quem decide é você, olhando o portfólio e, principalmente, o **vídeo de fala**.

## 1. A matriz

### 1.1 Prioridade (a ordem que você definiu) e pesos

| # | Prioridade | Peso | Critérios |
|---|---|---|---|
| 1 | Qualidade visual | 20 | C1 |
| 2 | Qualidade facial | 20 | C2 |
| 3 | Qualidade de expressão | 15 | C3 |
| 4 | Qualidade do rig | 15 | C4, C5, C6 |
| 5 | Compatibilidade web | 10 | C7 a C11 |
| 6 | Propriedade e licenciamento | 10 | C12, C13 |
| 7 | Velocidade de entrega | 5 | C14 |
| 8 | Preço | 5 | C15 |

Preço pesa 5. Ele só desempata quando duas notas totais estão a menos de 5 pontos uma da outra. **Não escolha o mais barato.**

### 1.2 Critérios (nota 0 a 5; peso em pontos dos 100)

| ID | Critério | Peso | O que procurar | Como verificar |
|---|---|---|---|---|
| C1 | **Qualidade de personagem** | 20 | personagens femininos adultos realistas ou realistas estilizados, com identidade própria, acabamento de cinema (olhos, pele, cabelo), não "avatar de serviço" | portfólio em close, ao vivo ou vídeo; **mais de um personagem** (não só um destaque) |
| C2 | **Qualidade facial** | 20 | rostos que seguram close-up: olhos vivos, pele com variação, boca com dentes e língua, cabelo que sobrevive | renders em close **sem retoque de pós**; peça wireframe e malha dos olhos |
| C3 | **Qualidade de expressão e de fala** | 15 | microexpressões sutis; **o rosto não morre quando fala** | **vídeo de um personagem deles falando** (sem edição) e uma sequência de expressões |
| C4 | Rig facial | 6 | FACS/ARKit, olhos com pivô, mandíbula, correctives, assimetria autoral | rig sheet de um projeto anterior; entrevista técnica |
| C5 | Blendshapes | 5 | 52 ARKit esculpidos separadamente (L/R), sutis bem feitos, sem alvos mortos | **enviar-nos um GLB/FBX anterior; rodamos o validador** |
| C6 | Visemas | 4 | 15 Oculus nativos, esculpidos com língua e dentes | amostra de visemas renderizados; pergunta direta |
| C7 | Experiência web | 2 | já entregou personagem para navegador/WebGL/AR | casos, links, referências |
| C8 | GLB | 2 | exporta glTF limpo (nomes, morphs, pesos, sem extensões estranhas) | arquivo de teste aberto no nosso Lab |
| C9 | three.js | 2 | conhece os limites do r147 (influências ativas, materiais, alpha), valida no navegador | conversa técnica; pede o nosso `GLTFLoader`+meshopt |
| C10 | Otimização | 2 | meshopt/KTX2, orçamento de triângulos e texturas, LODs, sparse morphs | declaração + arquivo de teste dentro do orçamento |
| C11 | Compatível com o nosso teste de aceitação | 2 | aceita o validador e o scorecard como contrato, roda antes de enviar | aceite por escrito; primeira entrega já com relatório |
| C12 | **Direitos** | 5 | cessão total, todas as plataformas, código-fonte incluso, sem uso para treinar IA, licenças de terceiros declaradas | cláusulas no contrato; ferramentas com licença comercial |
| C13 | **Originalidade** | 5 | cria o rosto do zero (ou transformação forte); **não parte de uma pessoa real** nem de preset reconhecível | pergunta direta; folha de design da Fase 0; teste de semelhança |
| C14 | Prazo e capacidade de revisão | 5 | prazo por marcos; revisões incluídas e rápidas; responde em até 2 dias | proposta; referências de clientes |
| C15 | Preço | 5 | preço fixo da Fase 1, claro, com revisões incluídas | cotação |

Nota por critério: **0** não declara/ausente · **1** declara, sem evidência · **2** evidência fraca · **3** evidência razoável (nível C com bom indício, ou nível B) · **4** verificado por nós em amostra · **5** verificado por nós e excepcional. Pontos = peso × nota / 5.

### 1.3 Eliminatórias (qualquer uma tira o fornecedor)

| # | Eliminatória |
|---|---|
| K1 | Sem rosto feminino realista ou realista estilizado **com rig facial em tempo real** no portfólio verificável |
| K2 | Não mostra, nem aceita produzir, **vídeo de um personagem falando** (lip sync) de qualidade |
| K3 | Recusa cessão total de direitos ou declaração de originalidade |
| K4 | Não entrega GLB (nem aceita um passo de conversão com nosso técnico) **ou** recusa rodar o validador |
| K5 | Precisa de fotos ou scan de uma pessoa real como fonte do rosto, sem termo de imagem aprovado por nós |
| K6 | Não fixa preço e número de revisões da Fase 1 |

### 1.4 Níveis de evidência

| Nível | O que é | Teto de nota |
|---|---|---|
| **A** | Verificado por nós: vimos o portfólio, o vídeo de fala, e/ou rodamos o validador em um arquivo dele | 5 |
| **B** | Afirmado por escrito pelo fornecedor, sem verificação | 3 |
| **C** | Descrição pública (site, entrevista) | 3 (visual: 3) |

## 2. O teste pago da Fase 0 (o mesmo para todos)

Objetivo: descobrir **quem consegue fazer a personagem certa**, não quem tem o portfólio mais bonito. Pague a mesma taxa (valor a definir) a 2 ou 3 finalistas, por 2 a 3 semanas.

| Teste | Pedido | O que revela |
|---|---|---|
| **T1. Vídeo de fala** | Um vídeo, sem edição, de **um personagem deles já existente** falando uma frase de 10 s, com a boca visível em close | o risco principal: bonito mas morto quando fala. Eliminatória K2 |
| **T2. Folha de design** | Com a Bible: frente, três quartos e perfil; close de olho; close de pele; estudos de cabelo e gola; 2 renders de luz; o still de presença | se entendem **quem é ela**; pontuado no scorecard (fase 0) |
| **T3. Arquivo de rig** | Um GLB (ou FBX/blend) de um projeto anterior, com ARKit e visemas, mesmo de outro estilo | rodamos o validador: nomes, alvos mortos, espelho mecânico, visemas distintos |
| **T4. Entrevista técnica (45 min)** | pipeline, como criam visemas, como evitam a pele de plástico, como entregam web, o que acham irrealista no briefing | maturidade e franqueza |
| **T5. Proposta** | Fase 1 com preço fixo, marcos, revisões, quem faz o quê | K6 e C14/C15 |

Critério de passagem para a Fase 1: nota total ≥ 75 com evidência nível A em C1 a C3, nenhuma eliminatória, e o T1 aprovado pelos revisores sem ressalva de "rosto morto".

## 3. Candidatos pré-selecionados

Selecionados por: capacidade declarada de **personagem + rosto + rig facial + entrega em tempo real**, e por haver texto público específico. A lista é curta de propósito. **Nenhum anuncia GLB/three.js**: esse é um achado, não um detalhe. Estúdios de personagem de alto nível trabalham em Maya/ZBrush/Unreal/Unity; a ponte para a web precisa estar no contrato (C8, C10, K4) ou ser uma contratação separada e pequena de um artista técnico para exportar com meshopt/KTX2.

Notas de 0 a 10 por **estimativa a partir de descrição pública (nível C)**.

### 3.1 Mimic Productions (Berlim, Alemanha)
| | |
|---|---|
| **Site** | https://www.mimicproductions.com/ · serviços de personagem: https://www.mimicproductions.com/3d-character-services · avatares de IA: https://www.mimicproductions.com/ai-avatars |
| **Portfólio** | no site (não verificado por nós) |
| **Especialidade** | humanos digitais fotorrealistas, rostos 3D, scan, rig facial e corporal, mocap, integração em tempo real |
| **Pontos fortes** | declara a cadeia inteira: modelagem de personagem, texturas, **rigs faciais de blendshape a partir de scans de expressão**, otimização para Unity e Unreal, **serviços de "AI Avatar"** (humanos digitais interativos). Clientes públicos de marcas (Nike, Swatch, Cartier) e animação/rig facial para jogos. É o que mais se aproxima de "personagem + rosto + expressão + rig + tempo real" |
| **Riscos** | trabalho baseado em **scan de pessoas** e dublês digitais: precisa provar que cria um rosto **original** sem pessoa real (K5, C13). Entrega para web/GLB não declarada. Preço de estúdio com clientes de marca, provavelmente acima do piso |
| **Tecnologia** | scan, ZBrush/Maya (inferido), Unreal, Unity |
| **Qualidade visual (declarada)** | fotorrealista; o estilo "realismo estilizado cinematográfico" precisa ser verificado |
| **Web/GLB** | não declarado: perguntar e testar (T3) |
| **Preço estimado** | não publicado. Guias de terceiros dão US$ 4 mil a 20 mil+ por personagem de estúdio, que é só um piso de referência; **a confirmar com cotação** |
| **Notas (0 a 10)** | **Visual 8 · Rig 8 · Web 5 · Originalidade 6 · Execução 8** |

### 3.2 Roarty Digital (Vancouver, Canadá)
| | |
|---|---|
| **Site** | https://www.roartydigital.com/ · personagem realista: https://www.roartydigital.com/character-artist-realistic · rigger/tech art: https://www.roartydigital.com/characterrigger |
| **Portfólio** | https://www.roartydigital.com/gallery (não verificado por nós) |
| **Especialidade** | personagens para jogos AAA, TV, filme, VR e publicidade; **estilos realista e estilizado**; cabelo para grooms do Unreal; rigging |
| **Pontos fortes** | estúdio fundado em 2016, com mais de 200 pessoas segundo a descrição pública; faz o personagem **do conceito à entrega**; equipe separada de rigging/tech art e de textura; trabalho em publicidade (um comercial Sony Bravia: modelagem, texturas, cabelo e animação). **Originalidade**: parte de conceito, não de scan |
| **Riscos** | estúdio de co-desenvolvimento de grande porte: pode ter **mínimo de projeto** e processo pesado para uma cabeça única; rig facial de **performance** (ARKit + visemas) não está declarado; web/GLB não declarado; a equipe que fará o seu rosto pode não ser a do portfólio |
| **Tecnologia** | Unreal Engine, ZBrush/Maya/Substance (inferido), grooms de cabelo |
| **Qualidade visual** | AAA; precisa de verificação de **rostos em close falando** |
| **Web/GLB** | não declarado |
| **Preço estimado** | não publicado; estúdio de grande porte, **a confirmar** |
| **Notas (0 a 10)** | **Visual 8 · Rig 6 · Web 4 · Originalidade 8 · Execução 8** |

### 3.3 Eisko (Paris, França)
| | |
|---|---|
| **Site** | https://eisko.com/ |
| **Portfólio** | https://vimeo.com/eisko3d · modelo e rig gratuitos "Louise" (cgchannel, 2017) |
| **Especialidade** | **humanos digitais**: scan 3D, **rig facial FACS (ossos + blendshapes)**, shading de pele PBR para tempo real, experiência em jogos, mobile, AR e VR |
| **Pontos fortes** | é, dos cinco, o que mais se especializa no **rig facial**: rig FACS padronizado para Maya e Unreal; um serviço de "Rig on Demand" que gera um rig de ossos e blendshapes para qualquer personagem; publicou um rig e uma cabeça de referência abertos, o que **permite avaliar a qualidade antes de contratar** |
| **Riscos** | foco em duplos digitais fotorrealistas por scan (originalidade, K5); estilo cinematográfico estilizado e **web/GLB** não declarados; pode ser melhor como **parceiro de rig** de um modelador do que como autor do personagem |
| **Tecnologia** | Maya, Unreal, FACS, scan |
| **Qualidade visual** | fotorrealista (a verificar) |
| **Web/GLB** | não declarado |
| **Preço estimado** | não publicado; a confirmar |
| **Notas (0 a 10)** | **Visual 8 · Rig 9 · Web 4 · Originalidade 6 · Execução 7** |

### 3.4 IMPERSONAS (fundadora Nour Hassoun)
| | |
|---|---|
| **Site** | não localizado nas buscas. Evidência: caso público na Epic, https://www.unrealengine.com/spotlights/crafting-stylized-digital-humans-on-daughter-of-the-inner-stars-with-metahuman-and-ue5 |
| **Portfólio** | o caso acima (série "Daughter of the Inner Stars"); resto não verificado |
| **Especialidade** | humanos digitais estilizados em **UE5 com MetaHuman**; animação facial com MetaHuman Animator |
| **Pontos fortes** | personalizou o personagem principal com **groom de cabelo próprio em Blender, olhos ampliados e texturas de pele próprias**; domina o ciclo MetaHuman → personagem com identidade; trabalho de TV |
| **Riscos** | base MetaHuman: risco de **aparência de MetaHuman genérico** (justamente o que rejeitamos) e a conversão para a web é pesada; o estilo mostrado é pintado à mão, mais estilizado que o alvo; tamanho e localização da equipe **não verificados** |
| **Tecnologia** | Unreal Engine 5, MetaHuman, Blender |
| **Qualidade visual** | estilizada; precisa de prova de rosto **adulto sóbrio** realista |
| **Web/GLB** | não declarado |
| **Preço estimado** | não publicado |
| **Notas (0 a 10)** | **Visual 7 · Rig 6 · Web 3 · Originalidade 6 · Execução 6** |

### 3.5 Polywink (online, França)
| | |
|---|---|
| **Site** | https://polywink.com/ · estúdio: https://polywink.com/en/57-studio.html |
| **Portfólio** | casos no site (não verificado) |
| **Especialidade** | **blendshapes e rigs faciais para qualquer cabeça 3D**: 52 ARKit, **73 (ARKit + visemas)**, 236 (conjunto completo), em cerca de 24 horas (declarado); suporte ao rig do MetaHuman; serviço de estúdio sob medida |
| **Papel** | **não cria o personagem.** É o candidato para ser a **parceira de rig** de um modelador, e para o **teste barato**: enviar uma cabeça e medir no validador a qualidade que um rig automático alcança |
| **Pontos fortes** | cobre exatamente os 52 + 15 que exigimos, rápido, previsível; integra em Unity |
| **Riscos** | blendshapes gerados automaticamente dependem da topologia; **a nuance autoral** (assimetria, sutis como `browOuterUp`, `noseSneer`, `jawClench`, visemas com língua) pode ficar abaixo do nosso piso; não cria o personagem; saída GLB a confirmar |
| **Tecnologia** | geração automática de blendshapes e rigs; Unity; Maya |
| **Qualidade visual** | não se aplica ao personagem |
| **Web/GLB** | a confirmar |
| **Preço estimado** | serviço online; **a confirmar** (não consegui abrir a tabela de preços) |
| **Notas (0 a 10)** | **Visual n/a · Rig 8 · Web 5 · Originalidade n/a · Execução 7** |

### 3.6 Considerados e descartados
| Quem | Por quê |
|---|---|
| Soul Machines | entrou em recuperação judicial em fev/2026 e foi comprada pela AppDirect em set/2026; é plataforma, não entrega de ativo |
| UneeQ (Studio) | cria "embaixadores" digitais sob medida, mas dentro da **própria plataforma** (assinatura, Synanim): provável **lock-in** e sem entrega de GLB. Vale perguntar, mas não é o caminho do asset próprio |
| Digital Domain, Hyperreal | escala e foco em celebridades/filme; fora do alcance e do tipo de projeto |
| Ready Player Me | encerrado em 31/01/2026 |
| MetaPerson (Avatar SDK), Avaturn | geram avatar a partir de foto: o rosto vem de uma pessoa real |
| Freelancers de baixo custo (Fiverr/Upwork) | um anúncio de abril/2026 pede um avatar feminino estilizado para web com ARKit + visemas por US$ 600 fixos: é o piso do mercado e mostra o que **não** queremos como padrão de qualidade. Serviços de 52 blendshapes por US$ 50 a 100 fazem só o rig sobre malha existente |

## 4. Minha recomendação

1. **Fase 0 paga com Mimic Productions e Roarty Digital** (rosto + personagem + rig + tempo real, escala de estúdio, originalidade de conceito), pelo teste T1 a T5. Mimic como candidata principal pelo texto público mais completo (rigs faciais de blendshape, tempo real, avatares de IA); Roarty como concorrente direta para manter a tensão e a comparação.
2. **Teste barato em paralelo:** enviar uma cabeça de teste à **Polywink** e rodar o resultado no validador. Mede o piso de um rig automático e pode virar a parceira de rig/visemas se o modelador não os entregar no nível exigido. Pedir também à **Eisko** um rig de referência (o "Louise" aberto) para comparar.
3. **IMPERSONAS** só entra se você quiser uma rota baseada em MetaHuman; o risco de aparência genérica é alto.
4. **Ponte web:** deixar no contrato que a entrega inclui um `.blend`/FBX com texturas e que, se o fornecedor não exportar GLB com meshopt/KTX2, **contratamos um artista técnico** para isso (pequeno, de baixo risco).

Nada disso é uma contratação. É a ordem em que eu **pediria cotações e testes**.

## 5. Modelo de e-mail (RFQ), em inglês

> Subject: RFQ: proprietary executive character, real-time head (Phase 0 + 1)
>
> Hello [name], we are building a proprietary, original female executive character for a real-time web product. The face matters most. We would like to run a paid Phase 0 test and, if it goes well, a Phase 1 head. The attached brief (11 parts) is requirement, not inspiration; please read Part 1 first.
> 1. Please send a **video of one of your characters speaking** (a 10-second line, mouth in close-up, no editing) and your best two **realistic close-up faces with facial rigs**.
> 2. Please send a **rigged file** (GLB, FBX or .blend) from a previous project with ARKit and viseme targets; we will run it through our validator and send you the report.
> 3. Confirm you accept the visual scorecard and the validator as acceptance criteria, full rights assignment and the originality declaration (Part 11).
> 4. Quote Phase 0 (design sheet) and Phase 1 (head, 52 ARKit + 15 visemes, GLB with meshopt/KTX2), fixed price, milestones, revision rounds included, who sculpts/rigs/textures, and your realistic timeline.
> 5. Tell us anything in the brief you consider unrealistic.
> No photos or scans of real people may be used as the face source. We will pay Phase 0 to all finalists. Regards, [name]

## 6. Folha de pontuação (copiar por fornecedor)

```
Fornecedor: ____________   Data: ________   Revisores: ________
Eliminatórias:  K1 [ ] K2 [ ] K3 [ ] K4 [ ] K5 [ ] K6 [ ]    (marcar se acionada)
Evidência:  C1 _  C2 _  C3 _   (A/B/C)

C1 _/5 (x4)  C2 _/5 (x4)  C3 _/5 (x3)  C4 _/5 (x1.2)  C5 _/5 (x1)  C6 _/5 (x0.8)
C7 _  C8 _  C9 _  C10 _  C11 _  (x0.4)   C12 _  C13 _ (x1)   C14 _ (x1)   C15 _ (x1)
TOTAL (0-100): ____    Preço só desempata se |diferença| < 5.
```

## 7. Fontes

* Mimic Productions: https://www.mimicproductions.com/3d-character-services · https://www.mimicproductions.com/ai-avatars
* Roarty Digital: https://www.roartydigital.com/ · https://www.roartydigital.com/character-artist-realistic
* Eisko: https://eisko.com/ · https://www.cgchannel.com/2016/10/eisko-launches-automated-onine-facial-rigging-service/ · https://www.cgchannel.com/2017/11/download-eiskos-free-hi-res-model-of-a-human-head/
* IMPERSONAS (caso na Epic): https://www.unrealengine.com/spotlights/crafting-stylized-digital-humans-on-daughter-of-the-inner-stars-with-metahuman-and-ue5
* Polywink: https://polywink.com/en/9-automatic-expressions-blendshapes-on-demand.html · https://polywink.com/en/15-facial-animation-for-iphone-x.html · https://80.lv/articles/polywink-on-creating-characters-with-metahuman-rig
* Soul Machines (recuperação e compra): https://syntheticrapport.com/dispatches/soul-machines-fall/ · https://wisevoter.com/world/2026/09/28/appdirect-acquires-soul-machines
* UneeQ (embaixadores sob medida): https://www.digitalhumans.com/use-cases/ai-brand-ambassadors
* Ready Player Me encerrado: https://avatarsdk.com/blog/2026/01/15/switch-from-ready-player-me-to-avatar-sdk-fast-familiar-production-ready/
* Mercado freelancer (referência de piso): https://www.upwork.com/freelance-jobs/apply/Stylized-Female-Avatar-with-ARKit-Blendshapes-Oculus-Visemes-GLB-Export-for-Web_~022048346165186060949/ · https://www.fiverr.com/gigs/52-arkit-blendshape
* Preços de personagens 3D (guia de terceiros): https://rocketbrush.com/blog/3d-character-art-prices-guide
