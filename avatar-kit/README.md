# Avatar Kit 2.0

# Wendy Avatar Kit 2.0

Camada de apresentação 3D do agente executivo: um personagem feminino que ouve, pensa, desafia e fala, **pronto para receber um modelo GLB premium rigado**.
O agente executivo não é alterado: ele continua falando só com a API (`setExpression`, `setCognitiveState`, `speak`, `lookAt`, `setShot`, `idle`).

```
AvatarAPI → AvatarAdapter → ProceduralAvatar | GLBAvatar
```

* **Sem asset?** Funciona com o personagem procedural (fallback). Ele existe para o produto nunca ficar sem rosto e para os testes rodarem em qualquer lugar. **Não é o alvo visual** (ver "Veredito visual").
* **Com asset?** `loadAvatar({ source: 'glb', url, rigMap })`. O `RigMap` diz quais nomes do seu arquivo significam o quê; o relatório diz o que foi encontrado e o que falta.

## Uso

```html
<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/libs/meshopt_decoder.js"></script>
<script src="avatar-kit.js"></script>
<script>
  const avatar = AvatarKit.createAvatar(document.getElementById('stage'), {
    avatar: { source: 'auto', url: 'wendy.glb', rigMap: { preset: 'arkit' } },   // GLB se carregar; procedural se não
    shot: 'CLOSE', style: 'executive', look: 'cursor'
  });
  avatar.ready.then(r => console.log(r.source, r.fallback, r.error, r.rigReport.grade));

  avatar.setExpression('firm');                       // neutral listening thinking analyzing confident firm skeptical empathetic surprised concerned decisive
  avatar.setCognitiveState('CHALLENGE');              // LISTENING PROCESSING THINKING SPEAKING DECIDING WARNING EMPATHY CHALLENGE CONFIDENCE
  avatar.speak(audioBlob, { visemes: ttsVisemes, provider: 'azure' });   // com fonemas; sem eles, segue o áudio
  avatar.pauseSpeech(); avatar.resumeSpeech(); avatar.stopSpeaking();
  avatar.lookAt('camera');                            // camera cursor center left right | x, y
  avatar.setShot('CLOSE', { style: 'intimate' });     // CLOSE MEDIUM FULL × conversation executive intimate
  avatar.setContext('executive');                     // quanto o rosto mostra
  avatar.idle({ intensity: 0.6 });
</script>
```

**Three.js 0.147 (r147), não r128.** O rig facial usa 52 + 15 *morph targets* ativos ao mesmo tempo; o r128 limita a 8 influências ativas e o r147 guarda os alvos em texturas de dados. O kit declara isso para quem integra.

### Tudo que a v1 oferecia continua valendo
`setExpression · getExpression · speak · stopSpeaking · setLevel · setViseme · setSpeaking · isSpeaking · lookAt · idle · setShot · getShot · shots · on/off · pause/resume · advance · renderNow · debug · destroy`.
Os nomes antigos de plano (`closeup`, `medium`, `full`) e de visema (`aa ee ih oh oo mm ff th ss rest`) são aceitos.

### Novo na 2.0
`setCognitiveState · setContext · setAttention · pauseSpeech · resumeSpeech · setCameraStyle · setLighting · setQuality · loadAvatar · getModelInfo · getRigReport · capabilities · stats · ready · model`

## Dados fonéticos (TTS)

| Formato | Como passar |
|---|---|
| Visemas Oculus com tempo | `speak(a, { visemes: [{ t, d, v: 'aa' }] })` (segundos) |
| Azure (ids 0–21, `audioOffset` em ticks de 100 ns) | `{ visemes: evs, provider: 'azure' }` |
| Amazon Polly (speech marks, NDJSON ou array) | `{ marks: texto, provider: 'polly' }` |
| Fonemas ARPAbet com tempo | `{ phonemes: [{ ph: 'AA', t: 0.4, d: 0.12 }] }` |
| Tempos por caractere | `{ alignment: { characters, character_start_times_seconds, character_end_times_seconds } }` |
| Só áudio | `speak(a)`: `AmplitudeFallback` (ganho adaptativo + dica espectral) |

`audio` pode ser `AudioBuffer`, `Float32Array` PCM (`sampleRate`), `ArrayBuffer`, `Blob/File`, `<audio>`, `MediaStream`, URL, ou `null` (só linha do tempo, sem som).
Erros tipados: `NO_SOURCE`, `BAD_AUDIO`, `DECODE_FAILED`, `PLAY_BLOCKED`, `NO_WEBAUDIO`.

## RigMap

```js
rigMap: {
  preset: 'arkit',                                  // 'arkit' | 'arkit-visemes' | 'bones-only'
  morphs:  { jawOpen: ['Mouth_Open_Wide'] },        // canal → nomes possíveis no seu arquivo
  visemes: { viseme_aa: ['PH_AA'] },
  bones:   { head: ['rig_Head'], leftEye: ['rig_L_Eye'] },
  clips:   { idle: ['Idle_Loop'] },
  options: { swapLeftRight: false, ignoreTokens: ['fc'], eyeMode: 'auto', morphGain: 1, gains: { jawOpen: 0.9 }, landmarks: { eyeY: 6.6 } }
}
```
Ordem de busca por canal: nomes do `RigMap` → *aliases* embutidos → casamento por tokens (`Jaw_Open`, `blendShape1.jawOpen`, `Mouth_Smile_L`). Nada é presumido: o que não casa vai para `rigReport.missing` e `rigReport.unmatchedMorphs`.
Nota (`rigReport.grade`): `full` ≥ 90% dos canais ARKit · `good` ≥ 70% · `basic` (essenciais presentes) · `bones-only` (sem morphs, com ossos de cabeça/mandíbula) · `insufficient` (o `auto` cai no fallback).

## Asset: do motor ao personagem premium

A arquitetura está congelada; o que falta é o asset. Documentos (nesta ordem):

| Documento | Para quê |
|---|---|
| `docs/EXECUTIVE_AVATAR_CHARACTER_BIBLE.md` | **a personagem**: quem é, cada medida, cor e expressão; decisões travadas; DNA visual; moodboard textual |
| `docs/EXECUTIVE_AVATAR_ART_DIRECTION.md` | como decidimos e julgamos: princípios, trocas, política de referências, fluxo de aprovação |
| `docs/EXECUTIVE_AVATAR_ASSET_BRIEF.md` | **pacote para o artista/fornecedor** (11 partes; gerado a partir da Bible, sem a referência interna) |
| `docs/EXECUTIVE_AVATAR_VISUAL_SCORECARD.md` | nota visual de 100 pontos com 14 barreiras |
| `docs/EXECUTIVE_AVATAR_VENDOR_EVALUATION.md` | matriz de fornecedores, teste pago da Fase 0, 5 candidatos |
| `docs/ASSET_ACCEPTANCE_TEST.md` | como o asset é aceito ou rejeitado; nota 0 a 100; como validar qualquer GLB |
| `docs/EXECUTIVE_AVATAR_SOURCING_OPTIONS.md` | rotas para obter o asset, comparação e recomendação |
| `docs/HEAD_PROTOTYPE_GATE.md` | **Fase 1**: o gate da cabeça (fluxo, estados, critérios, 14 barreiras, comandos `tools/head-gate.js`) |
| `docs/HEAD_REVIEW_PROTOCOL.md` | como uma pessoa revisa um candidato, passo a passo |
| `docs/HEAD_001_DELIVERY_SPEC.md` | **Fase 1B**: contrato técnico da primeira cabeça (para o artista) |
| `docs/HEAD_001_RFQ.md` | RFQ em inglês, pronto para enviar a estúdios (revisão humana antes) |
| `docs/HEAD_001_VENDOR_TEST.md` | o mesmo teste A a E para todos os fornecedores, com a linha do tempo da frase |
| `docs/HEAD_001_PROCUREMENT_CHECKLIST.md` | checklist de contratação, portão da Fase 0 do fornecedor e registro de evidência |
| `docs/AVATAR_RUNTIME_CONTRACT.md` | **o contrato do runtime**: a aplicação depende dele, não do personagem; como trocar o asset |
| `docs/VERA_PRODUCTION_STRATEGY.md` | estratégia para o rosto profissional da Vera: direções, rotas, gate de rosto, fases, custos, shortlist |
| `docs/VERA_RFQ_TEMPLATE.md` | o RFQ final (modelo, não enviado) |
| `docs/VERA_VENDOR_VALIDATION.md` | validação dos fornecedores: evidência, scorecard, quem indicar para revisão humana |
| `docs/ASSET_SPEC.md` | primeira especificação (substituída pelo briefing) |

Validar um GLB: Avatar Lab, seção **Asset Validation** (carregar → validar → revisão guiada → notas), ou `node tools/validate-glb.js arquivo.glb --phase=head`.
O validador mede estrutura e comportamento (54 dos 100 pontos); a aparência (46) é uma rubrica humana, e nenhum asset é aceito só pela parte técnica.
`node tools/gen-docs.js` regenera as tabelas dos documentos a partir do código (canais, emoções, verificações, rubrica).

## Testes

```bash
node tools/build.js                           # dist/avatar-kit.js e dist/avatar-lab.html
node --test tests/unit/*.test.js              # lógica pura (sem navegador)
node --test tests/browser/avatar.test.js      # WebGL real (software), three.js real, GLBs de teste
node tools/make-test-glb.js                   # regenera os GLBs de teste
```
Os GLBs de `tests/fixtures` são **fixtures**: elipsoide + boneco de palito com a *estrutura* de um rig real (52 ARKit + 15 visemas + esqueleto Mixamo + clipe). Provam o caminho de integração, não a qualidade visual.

Página de teste: `dist/avatar-lab.html` (Expressions · Cognitive State · Camera · Voice · Gaze, relatório do rig, diagnóstico, carregar GLB, modo limpo com `H`).

## Veredito visual (autocrítica)

Pergunta: executiva de altíssimo nível ou boneco 3D? **Boneco 3D.** O personagem procedural lê como um boneco, e a causa é de arte, não de ajuste:

* rosto: elipsoide esculpido na CPU com feições pintadas; sem poros, sem espalhamento de luz na pele, sem volume real de pálpebra, nariz e lábios;
* cabelo: fitas com brilho plástico; pescoço cilíndrico; ombros e vestido blocados; sem dentes nem língua reais;
* a *atuação* (expressões assimétricas, olhar, respiração, fala com pausas) funciona e é legível: CHALLENGE mostra uma sobrancelha só, FIRM aperta a mandíbula, o olhar desvia e volta. O que falta é o rosto que a recebe.

**Isso não será resolvido por código; precisamos de um asset 3D profissional.** Por isso não houve mais cosmética no procedural. O caminho está em `docs/ASSET_SPEC.md`.

## Medições (Chromium + SwiftShader, sem GPU; números de CPU são os confiáveis)

| | Procedural | GLB de teste |
|---|---|---|
| Triângulos / draw calls | 116.228 / 50 | 3.298 / 6 |
| Simulação completa por quadro (`stepMs`) | 4,1 ms | 0,15 ms |
| Update do modelo | 3,8 ms (reconstrói a cabeça na CPU) | 0,01 ms |

O GLB de teste é minúsculo: o custo real de um asset premium (60 k triângulos, 67 morphs densos, texturas 2K) só se mede com o asset. Bundle: 189 KB (57,6 KB gzip), build em ~10 ms. Suíte: 79 testes unitários + 31 de navegador, todos passando.

## Limitações conhecidas

* Sem GPU real neste ambiente: FPS e custo de renderização não foram medidos em hardware de usuário.
* Draco/KTX2 só com os carregadores configurados; meshopt vem incluído.
* Tabelas de visema de Azure/Polly e a conversão visema→ARKit são pontos de partida: conferir com a sua voz e o seu rig.
* Direções de atuação (valores das 11 emoções, tempos do olhar) foram definidas por pesquisa de comportamento e ajuste, **não validadas com o rosto final**: devem ser reajustadas com o asset.
* A página usa three r147 e GLTFLoader do jsDelivr; o ambiente de build bloqueou esse domínio, então as URLs CDN não foram abertas aqui (os mesmos arquivos foram testados localmente).
