# Especificação do asset 3D (modelo feminino premium, rigado)

> **Substituído em parte.** A especificação final, o briefing para o fornecedor e os critérios de aceitação estão em `EXECUTIVE_AVATAR_ART_DIRECTION.md`, `EXECUTIVE_AVATAR_ASSET_BRIEF.md`, `ASSET_ACCEPTANCE_TEST.md` e `EXECUTIVE_AVATAR_SOURCING_OPTIONS.md`. Os valores deste arquivo foram revistos lá (orçamentos por fase, cabeça primeiro, nota 0 a 100). Em caso de diferença, vale o briefing.

Este documento é o briefing para quem vai produzir (ou licenciar) o modelo que o `GLBAvatar` vai receber.
Ele existe porque a geometria procedural **não chega ao nível visual de uma executiva de altíssimo nível** (ver
`README.md`, seção "Veredito visual"). O que falta é arte: escultura facial, textura de pele, cabelo, olhos. Isso não se resolve com código.

A arquitetura já está pronta para receber o arquivo. Esta especificação diz exatamente o que o arquivo precisa conter para que a integração seja
"trocar a URL" e não "reescrever o rig". Cada item abaixo é verificável: `avatar.getRigReport()` mede a conformidade (item 13).

> Fontes citadas no fim. Os links foram escritos de memória e **não foram abertos neste ambiente** (o proxy bloqueia a maioria dos domínios externos): confira antes de enviar o briefing a um fornecedor.

## 1. Formato

| Requisito | Valor |
|---|---|
| Contêiner | glTF 2.0 binário, **um único `.glb`** (sem arquivos externos) |
| Eixos e unidades | Y para cima, **+Z para a frente** (rosto olha para +Z), metros |
| Escala | Altura real em metros (o kit normaliza). Sem escala não uniforme em ossos ou malhas; *transforms* aplicados (freeze) |
| Pose de repouso | Pose A ou T neutra, rosto neutro, olhos de frente, boca fechada sem tensão |
| Extensões aceitas | `KHR_materials_clearcoat`, `KHR_materials_sheen`, `KHR_materials_specular`, `KHR_materials_ior`, `KHR_materials_emissive_strength`, `KHR_texture_transform`, `KHR_mesh_quantization`, `EXT_meshopt_compression`, `KHR_draco_mesh_compression`*, `KHR_texture_basisu`* |
| Não incluir | Câmeras, luzes, animações de câmera, *morph targets* de normais/tangentes, vários cenários |

\* Draco só quando o carregador DRACO é configurado (`dracoPath`); texturas KTX2/Basis precisam do carregador correspondente. A recomendação é **meshopt** (item 11).

## 2. Contagem de polígonos (LOD0, close-up)

| Parte | Triângulos |
|---|---|
| Cabeça + pescoço (pele) | 18.000 a 28.000 |
| Olhos (2 globos, córnea separada) | 2 × 1.500 |
| Dentes, gengiva, língua | 3.000 |
| Cílios, sobrancelhas (cartões) | 2.500 |
| Cabelo (cartões/fios agrupados) | 12.000 a 20.000 |
| Tronco, braços, mãos | 12.000 |
| Roupa (vestido preto, colar) | 8.000 |
| Pernas, sapatos (só plano geral) | 6.000 |
| **Total LOD0** | **≤ 75.000** |

LOD1 (plano médio / dispositivos fracos): ≤ 30.000. LOD2 (plano geral): ≤ 10.000. Entregar LOD1 como arquivo separado; o kit carrega um ou outro (`loadAvatar`).
O rosto precisa de *edge loops* para boca, olhos, sobrancelhas e sulcos nasolabiais, senão as *blendshapes* deformam mal.

## 3. Texturas

| Mapa | Resolução | Observação |
|---|---|---|
| Pele: albedo | 2048² (rosto), 1024² (corpo) | sem iluminação "assada", sem sombra pintada; poros e variação de cor sutis |
| Pele: normal | 2048² | mais um normal de micro-detalhe repetível 1024² opcional |
| Pele: ORM (AO / rugosidade / metal) | 2048², canais empacotados | rugosidade variando por zona (testa, nariz, lábios) |
| Olho: íris, esclera | 1024² | veias na esclera, anel límbico, profundidade pintada |
| Cabelo: atlas com alfa + mapa de fluxo/ID | 2048² | alfa sem franja serrilhada (usar *alpha to coverage* ou *hashed*) |
| Roupa | 1024² a 2048² | |

Compressão: **KTX2** (BasisU: UASTC para normal e ORM, ETC1S para albedo) para reduzir VRAM e arquivo. Dimensões potência de 2, com *mipmaps*.
**Memória de textura total na GPU: ≤ 64 MB (desktop), ≤ 32 MB (celular).** Nada de 4K nem 8K na versão de entrega.

## 4. Materiais PBR

* Fluxo *metallic-roughness* do glTF núcleo. No máximo **8 materiais** (menos *draw calls*): pele, olho, córnea, dentes/língua, cabelo, cílios/sobrancelhas, roupa, acessório.
* Pele: não existe extensão de espalhamento subsuperficial estável no glTF; o brilho macio deve vir do albedo e da rugosidade bem pintados, não de efeito de shader.
* Córnea: malha separada com `clearcoat` (a reflexão do softbox do `StudioLighting` vira o brilho no olho, o que dá vida).
* Tecido do vestido: `KHR_materials_sheen` leve; cor de base quase preta, rugosidade alta.
* Cabelo: sem transmissão; especular suave. Sem `KHR_materials_transmission`/`volume` (custo alto para o ganho no navegador).

## 5. Esqueleto

* Humanoide, **nomes compatíveis com Mixamo** (o `RigMap` padrão os reconhece): `Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder, RightShoulder, LeftEye, RightEye, Jaw` (e braços/pernas/mãos como de costume). Outros nomes funcionam, desde que informados no `RigMap`.
* No máximo **75 ossos**; 4 influências por vértice; pesos normalizados.
* Pivôs: `Head` na base do crânio; `LeftEye/RightEye` **no centro do globo ocular**, eixo +Z para a frente; `Jaw` na articulação da mandíbula.
* Pescoço com dois ossos é bem-vindo (`Neck`, `Neck1`): o kit distribui a rotação da cabeça 70/30.

## 6. Rig facial: 52 blendshapes ARKit

* Os **52 nomes exatos** do conjunto ARKit (`eyeBlinkLeft`, `jawOpen`, `mouthSmileRight`, `browInnerUp`, `tongueOut`, ...), como *morph targets* da malha da cabeça.
* Os mesmos nomes também nas malhas que deformam junto (dentes, língua, cílios, sobrancelhas, olhos), para que o kit os mova em conjunto.
* "Left/Right" = lado **do personagem** (esquerda do sujeito), como no ARKit. Se o autor inverteu, não é erro: `rigMap.options.swapLeftRight = true`.
* Extensão opcional: `jawClench` (tensão do masseter), usada nos estados FIRM/DECISIVE.
* Qualidade mínima exigida para a nossa direção de atuação: sobrancelha **assimétrica** (para CÉTICA), `mouthPress`, `cheekSquint`, `eyeSquint` e `noseSneer` bem esculpidos. Sem eles a expressão firme e a cética não existem.

## 7. Qualidade das blendshapes

* Deltas só de posição; **sem** deltas de normal/tangente (o motor recalcula).
* Cada *target* toca só a região do rosto que muda (usar acessores *sparse* do glTF para economizar tamanho).
* Combinações precisam ser limpas: `jawOpen + mouthSmile`, `browDown + eyeSquint`, `mouthPress + jawClench` não podem criar dobras ou interpenetrações. Entregar *correctives* embutidos se necessário.
* Simetria: pares L/R esculpidos separadamente (não espelhados mecanicamente), para permitir assimetria natural.

## 8. Visemas (fala)

* **15 visemas Oculus nativos**, como *morph targets*: `viseme_sil, viseme_PP, viseme_FF, viseme_TH, viseme_DD, viseme_kk, viseme_CH, viseme_SS, viseme_nn, viseme_RR, viseme_aa, viseme_E, viseme_I, viseme_O, viseme_U`.
* Autorados com lábios, **dentes e língua** (TH, DD, nn, RR precisam de língua visível). Não derivar dos ARKit por soma: o resultado é a boca "borrachuda" que denuncia boneco.
* Sem visemas nativos o kit converte visemas em canais ARKit, o que funciona (e é testado), mas com precisão menor. É o plano B, não o alvo.

## 9. Rastreamento ocular

* Ossos `LeftEye`/`RightEye` com globos separados; amplitude ±30° de giro, ±25° de inclinação.
* Além dos ossos, os 8 canais `eyeLook{Up,Down,In,Out}{Left,Right}` como morphs **das pálpebras e pele ao redor**, para que as pálpebras acompanhem o olhar (olhar para baixo abaixa a pálpebra superior). Este é o detalhe que separa olhar vivo de olho de boneca.
* Linha d'água / lágrima como malha ou textura; córnea com leve abaulamento.
* Pupila e íris com profundidade (não decalque plano). Pupila pode ter *morph* de dilatação (opcional).

## 10. Animações (somente ossos, sem trilhas de morph)

| Clipe | Duração | Conteúdo |
|---|---|---|
| `Idle` | 4 a 6 s, laço sem emenda | respiração (tórax, ombros), micro-ajuste de peso. Sutil: o kit soma micro-movimentos por cima |
| `Talk` (opcional) | 6 a 10 s | gestos pequenos de mão/ombro; o kit controla o peso |
| `ListenNod` (opcional) | 1 s | aceno curto |

30 fps, sem *root motion*. Trilhas de *morph target* não devem existir nos clipes (conflitam com o motor de expressão).

## 11. Requisitos web

| Item | Meta |
|---|---|
| Tamanho do `.glb` | **meta 12 MB, teto 15 MB** (LOD1: ≤ 6 MB) |
| Compressão de geometria | **`EXT_meshopt_compression`** (comprime *morph targets*, ao contrário do Draco). Quantização de posição/UV (`KHR_mesh_quantization`) |
| Texturas | KTX2, ver item 3 |
| *Draw calls* | ≤ 12 para o personagem |
| Malhas skinned | ≤ 6 |
| Dados de morph | ≤ 6 MB descomprimidos (usar *sparse*) |
| Desempenho | 60 fps a 1080p em GPU integrada atual (Apple M1 / Intel Iris Xe); 30 fps estáveis em celular médio no LOD1 |
| Sem dependência externa | nada de URLs relativas, nada de texturas fora do arquivo |

## 12. Tamanho máximo

* **15 MB** (limite duro) para o `.glb` LOD0; **6 MB** para LOD1.
* Acima disso o primeiro carregamento passa de 8 s em conexão média e a experiência deixa de ser "instantânea". Se a arte exigir mais, o caminho é carregamento progressivo (LOD1 primeiro), não arquivo maior.

## 13. Aceitação (o que o kit mede)

O asset está aprovado quando, carregado com o `RigMap` padrão (ou um `RigMap` de poucas linhas):

```js
const r = await avatar.loadAvatar({ source: 'glb', url: 'wendy.glb', rigMap });
r.rigReport.grade === 'full'          // cobertura ARKit >= 90%
r.rigReport.coverage >= 0.98          // 51 de 52 canais, no mínimo
r.rigReport.visemesNative === true    // 15 visemas
r.rigReport.essentialMissing.length === 0
r.rigReport.warnings.length === 0     // sem aviso de olho, cabeça ou mandíbula
r.info.triangles <= 75000 && r.info.fileMB <= 15 && r.info.textureMemoryMB <= 64
```

Mais a checagem **visual** na página `Avatar Lab`: as 10 expressões e os 9 estados cognitivos legíveis em CLOSE/conversation, sem dobras, sem
dente atravessando lábio, sem olho "morto", olhar para baixo com pálpebra acompanhando, fala com língua visível em TH/DD.

## 14. Entregáveis do fornecedor

1. `.glb` LOD0 e LOD1 conforme acima.
2. Arquivos-fonte (Blender/Maya/ZBrush) e texturas em resolução cheia, com a licença de uso comercial **sem restrição de plataforma**.
3. Declaração de originalidade: personagem **original**, sem semelhança com pessoa real (a diretriz do projeto é não copiar a atriz).
4. Lista dos nomes de *morph*, ossos e clipes (para o `RigMap`) e as decisões de espelhamento.
5. Relatório de contagem: triângulos por malha, memória de textura, tamanho do arquivo.

## 15. Caminhos de obtenção (a avaliar, não recomendados às cegas)

| Caminho | Prós | Contras / a verificar |
|---|---|---|
| Encomenda a estúdio/artista de personagens *real-time* | arte sob medida, estilo e identidade originais | prazo e custo: pedir orçamento; geralmente semanas, não dias |
| Base licenciada + customização (ex.: Character Creator, MetaHuman) | rápido | licença e conversão a conferir; risco de rosto genérico. **Ready Player Me foi encerrado em 31/01/2026.** Ver `EXECUTIVE_AVATAR_SOURCING_OPTIONS.md` |
| Blender + ferramenta de blendshapes ARKit (ex.: Faceit) | controle total | exige artista experiente; o rosto continua sendo o trabalho difícil |

Recomendação de processo: **encomendar um único teste de rosto (cabeça + olhos + 52 + 15) antes do corpo**, validar no `Avatar Lab` e só então liberar o resto.

## Fontes

* Apple, *ARFaceAnchor.BlendShapeLocation* (os 52 nomes ARKit): https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation
* Meta, *Viseme Reference* (15 visemas Oculus): https://developer.oculus.com/documentation/unity/audio-ovrlipsync-viseme-reference/
* Ready Player Me (serviço encerrado em jan/2026; a documentação serviu de referência de nomes de morph targets): https://docs.readyplayer.me/ready-player-me/api-reference/avatars/morph-targets
* Khronos, glTF 2.0 e extensões (`KHR_materials_*`, `EXT_meshopt_compression`, `KHR_texture_basisu`, `KHR_mesh_quantization`): https://github.com/KhronosGroup/glTF/tree/main/extensions
* meshoptimizer / gltfpack (compressão de geometria e morph targets): https://github.com/zeux/meshoptimizer
* glTF-Transform (otimização de GLB, sparse, KTX2): https://gltf-transform.dev/
* three.js, `Mesh.morphTargetInfluences`, `GLTFLoader`: https://threejs.org/docs/
