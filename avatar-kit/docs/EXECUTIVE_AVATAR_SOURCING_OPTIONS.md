# Rotas para obter o asset

Nada foi comprado nem contratado. Este documento compara caminhos, recomenda um e diz o que verificar antes de gastar.

**Como ler os números.** Preços e condições vêm de pesquisa na web feita em outubro de 2026 (links no fim). São **estimativas de guias e páginas de terceiros**, não orçamentos: peça cotação. Onde não consegui confirmar, está escrito "a confirmar". Licenças mudam: leia o contrato vigente antes de decidir.

## Requisito que decide tudo

O asset precisa ser, ao mesmo tempo: (1) **original** (identidade própria, direitos totais), (2) **rigado com 52 ARKit + 15 visemas** nomeados, (3) **leve o bastante para a web** (cabeça ≤ 45 mil triângulos, ≤ 8 MB), (4) com **rosto de nível cinematográfico**. Poucas rotas cumprem os quatro.

## Resumo

| Rota | Qualidade do rosto | Controle | Rig / blendshapes | Custo aproximado | Risco | Integração | Chega ao visual desejado? |
|---|---|---|---|---|---|---|---|
| **1. Artista/estúdio de personagens** | alta a muito alta (depende do portfólio) | total | ARKit + visemas nativos, como no briefing | US$ 4 mil a 20 mil+ para personagem de estúdio com rig; cabeça isolada menos (cotar) | médio (escolha do fornecedor) | fácil (o briefing já usa nossos nomes) | **sim**, é a única que controla identidade e nuance |
| **2. MetaHuman (Epic) + conversão** | muito alta (barra de referência) | médio | rig próprio de ~800 juntas; ARKit via ferramentas de terceiros; visemas a construir | criador gratuito com conta Epic (a confirmar) + engenharia de conversão | médio a alto | difícil (conversão e redução para a web) | sim na qualidade; cuidado com o "look MetaHuman" genérico |
| **3. Character Creator (Reallusion)** | média a alta | médio | perfil de expressões estendido (140+); conversão para ARKit com scripts; GLB via FBX/Blender | US$ 299 perpétua ou ~US$ 99/ano (CC365, a confirmar) + artista | médio | médio | parcialmente: bom ponto de partida, teto abaixo do cinematográfico |
| **4. Gerador de avatar por foto (MetaPerson, Avaturn)** | média (semirrealista) | baixo | GLB rigado; ARKit/visemas varia | plano Pro ~US$ 800/mês (US$ 800/mês nos dois, a confirmar) | alto (identidade vem de foto de pessoa real) | fácil | **não** para a personagem principal |
| **5. Pipeline Blender + Faceit (você ou freelancer)** | depende só do artista | total | 52 ARKit automáticos sobre sua malha | Faceit ~US$ 78 a 99 + horas do artista | médio a alto | fácil | só com artista sênior; o rosto continua sendo o trabalho difícil |
| **6. Scan de modelo humano contratada + limpeza** | muito alta (pele real) | alto | exige retopo, rig e blendshapes feitos por artista | alto (sessão de scan + estúdio) | alto (direitos de imagem e semelhança) | médio | sim na pele; viola "não é pessoa real" salvo contrato e transformação |
| **7. Modelo pronto de marketplace** | genérica (US$ 20 a 30 em ArtStation) | nenhum | raramente ARKit completo | US$ 20 a 30 | alto | variável | **não**: servir só como arquivo de calibração do validador, com licença verificada |

## Detalhe por rota

### Rota 1: personagem feito por artista 3D / estúdio (recomendada)
* **Por que:** é a única rota que entrega ao mesmo tempo identidade original, rig nomeado como o nosso motor espera (zero conversão), orçamento web e atuação sutil. O briefing foi escrito para ela.
* **Preço:** guias de preço de terceiros colocam personagem fotorrealista de estúdio em US$ 4 mil a 20 mil+; rigging/deformação em plataforma de freelancers em US$ 4,5 mil a 7 mil; serviço de 52 blendshapes ARKit sobre malha pronta em US$ 50 a 100 (**só o rig, sem arte**, qualidade imprevisível). Uma cabeça isolada deve custar menos que o personagem inteiro, mas **cotar**.
* **Risco:** escolher mal o fornecedor. Mitigação: portfólio de rostos femininos em tempo real com close-up; teste pago curto com 2 ou 3 candidatos (Fase 0, folha de design); contrato por marcos; aceitação pelo validador + avaliação visual; direitos totais.
* **Prazo:** semanas, não dias (estimativa; cotar).

### Rota 2: MetaHuman
* **Licença:** em junho de 2025 a Epic passou a permitir o uso de MetaHumans em qualquer engine ou DCC e em projetos comerciais (inclusive vender em marketplaces), com restrição quanto a treinar ou melhorar modelos de IA. **Ler o EULA vigente**; antes disso era só Unreal.
* **Exportação:** uma exportação FBX comum do rosto sai como malha estática, sem rig facial nem blendshapes (relato de fórum, UE 5.7). Existem ferramentas de comunidade: um plugin que exporta a cabeça em glTF + ARKit, o BlendShapeExporterV2 (ARKit 52 a partir do DNA), um pipeline MetaHuman → GLB → three.js e tutoriais para Blender. Todas exigem engenharia e não são suporte oficial.
* **Pontos fracos:** malha e cabelo pesados para a web (precisa decimar e converter o groom em cartões), visemas Oculus a construir, e o **risco de parecer "MetaHuman genérico"**, justamente o que o critério de rejeição proíbe. A originalidade depende de esculpir o rosto de verdade, não de usar um preset.
* **Quando considerar:** como **referência de qualidade** (ver o que "premium" significa) ou como base que o artista da Rota 1 transforma, desde que a licença permita e o resultado cumpra o briefing.

### Rota 3: Character Creator (Reallusion)
* O CC4 trouxe um perfil de expressões estendido com mais de 140 blendshapes; há scripts de comunidade para renomear para ARKit. Licença: perpétua a US$ 299 ou assinatura (CC365: ~US$ 29/mês ou US$ 99/ano), com os mesmos direitos pelo EULA; **o conteúdo (roupas, cabelos) tem política de licença própria**. Hoje existe o Character Creator 5 (a confirmar diferenças).
* É uma boa ferramenta para um artista, ou para um protótipo de pipeline. Sozinha, tende a um rosto reconhecível como "CC" e a cabelo/pele abaixo do cinematográfico. Exportar GLB limpo exige passar por FBX/Blender.

### Rota 4: gerador de avatar por foto
* **Ready Player Me foi encerrado em 31 de janeiro de 2026** (adquirido pela Netflix; avatares já exportados em GLB continuam funcionando). **Não usar.** Alternativas: MetaPerson (Avatar SDK) e Avaturn: o primeiro gera avatar realista **a partir de uma selfie**, o segundo mais estilizado; planos Pro por volta de US$ 800/mês.
* Para uma personagem proprietária isso é um problema de origem: o rosto sai da foto de uma pessoa real (direitos e semelhança). Qualidade de pele, olho e boca insuficiente para o padrão pedido. Útil para avatares de usuários, não para esta personagem.

### Rota 5: Blender + Faceit
* Faceit gera os 52 shape keys ARKit sobre a topologia do artista (licença GPL; ~US$ 78 para o pacote ARKit, ~US$ 99 ilimitado, ~US$ 289 estúdio). Resolve a parte mecânica do rig; **não resolve o rosto, a pele, o olho nem o cabelo**, que são a arte. Visemas Oculus continuam sendo trabalho manual.
* Viável se você já tem um artista de personagens sênior. Na prática é uma **ferramenta dentro da Rota 1**.

### Rota 6: scan de modelo contratada
* Dá pele e microdetalhe reais, mas exige contrato de imagem, retopologia, rig e blendshapes (de novo a Rota 1), e o resultado se parece com uma pessoa real, o que contraria a regra de originalidade. Só faz sentido com transformação forte e contrato explícito.

### Rota 7: marketplace
* Modelos prontos custam dezenas de dólares e são genéricos por definição; raramente têm ARKit + visemas completos. **Não servem como personagem.** Um único modelo barato pode servir como arquivo de calibração do validador, depois de conferir que a licença permite o uso.

## Recomendação (uma só)

**Rota 1, em duas etapas pequenas:**
1. **Fase 0 paga com 2 ou 3 candidatos** (folha de design: frente, três quartos, perfil; renders de luz; conceito de pele), com o briefing `EXECUTIVE_AVATAR_ASSET_BRIEF.md`. Escolher por qualidade do rosto e por entender o rig, não pelo menor preço.
2. **Fase 1 (cabeça) com um fornecedor**, preço fixo, dois ciclos de revisão, pagamento por marcos, aceitação pelo validador e pela avaliação visual. Só depois da sua aprovação: corpo, roupa e cabelo final.

O fornecedor pode usar qualquer ferramenta (inclusive MetaHuman ou CC como ponto de partida), desde que a licença permita o uso comercial na web e o resultado cumpra o briefing.

## Como escolher o fornecedor (checklist)

* Portfólio de **rostos femininos realistas em tempo real**, em close, com rig facial; peça um rig de exemplo.
* Sabe exportar glTF com meshopt e KTX2? Entende ARKit e visemas Oculus? Já entregou para three.js ou web?
* Aceita o validador como critério de aceite e a avaliação visual como veto?
* Preço fixo da Fase 1, revisões incluídas, prazo por marcos, cessão total de direitos, declaração de originalidade, sem uso para treino de IA.
* Reconhece limites do briefing e propõe alternativas fundamentadas (item 19 do briefing).

## O que verificar antes de pagar

1. A licença vigente de qualquer ferramenta ou base (MetaHuman, Reallusion, marketplace).
2. Que o fornecedor entende que o rosto **não pode lembrar uma pessoa real**.
3. Que a entrega roda no validador **antes** de ser enviada (o fornecedor tem a ferramenta).
4. O contrato: marcos, rodadas de revisão, aceite por escrito.

## Fontes

* Epic: licença do MetaHuman estendida a outras engines e DCCs (jun/2025): https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/
* Exportar MetaHuman como glTF + ARKit (plugin): https://forums.unrealengine.com/t/holotype-pte-ltd-export-metahuman-as-gltf-arkit/2710791
* BlendShapeExporterV2 (DNA → ARKit 52): https://forums.unrealengine.com/t/community-tutorial-blendshapeexporterv2-convert-dna-to-arkit-52-or-metahuman-blendshapes/2688321
* Pipeline MetaHuman → GLB → three.js: https://github.com/smorchj/metahuman-to-glb
* Reallusion: licenças e assinaturas em 2026: https://www.cgchannel.com/2026/01/reallusion-switches-up-iclone-and-character-creator-licensing/ · preços: https://www.g2.com/products/character-creator/pricing
* Character Creator 4 (perfil de expressões estendido): https://www.cgchannel.com/2022/05/reallusion-releases-character-creator-4/ · política de conteúdo: https://www.reallusion.com/license/content.html · scripts de renomeação ARKit: https://github.com/proudgenius/CC-Toolset
* Encerramento do Ready Player Me: https://avatarsdk.com/blog/2026/01/15/switch-from-ready-player-me-to-avatar-sdk-fast-familiar-production-ready/ · https://variety.com/2025/digital/news/netflix-acquires-ready-player-me-games-avatar-creation-1236612915/
* MetaPerson e Avaturn (planos e estilo): https://avatarsdk.com/metahuman-alternative/
* Faceit: https://superhivemarket.com/products/faceit
* Preços de personagens 3D: https://rocketbrush.com/blog/3d-character-art-prices-guide · https://www.upwork.com/hire/character-artists/ · https://www.fiverr.com/gigs/52-arkit-blendshape · https://www.artstation.com/marketplace/p/7B7yp/advanced-realistic-base-game-character-with-rig
