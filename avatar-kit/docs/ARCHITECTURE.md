# Arquitetura

```
 agente executivo (não alterado)
        │  setExpression · setCognitiveState · speak · lookAt · setShot · idle
        ▼
 ┌──────────────────────────── AvatarAPI ────────────────────────────┐
 │  loop de simulação (dt), eventos, diagnóstico, resolução adaptativa │
 └───────┬───────────────────────────────────────────────────┬────────┘
         ▼                                                   ▼
  controladores (não conhecem malhas)                  cena (não conhece o modelo)
  ExpressionComposer ← ExpressionController            CameraController  ← landmarks do modelo
        ↑ CognitiveState                               StudioLighting    ← landmarks do modelo
  GazeController · AnimationController
  LipSyncController ← VisemeEngine | AmplitudeFallback
  FaceMixer
         │  canais canônicos: 52 ARKit (+jawClench), 15 visemas Oculus,
         │  alvo do olhar, rotação da cabeça, pose do corpo
         ▼
   AvatarAdapter  (valida o contrato, troca modelo em runtime, isola falhas)
         ▼
   ProceduralAvatar            GLBAvatar  ←  RigMap (dados, não código)
   (fallback, sem assets)      (qualquer GLB rigado)
```

## Princípios

1. **Um vocabulário só.** Os controladores escrevem *canais canônicos* (nomes ARKit e visemas Oculus). Os modelos leem esses nomes. Nada mais cruza a fronteira.
2. **Nenhum nome de asset é presumido.** `RigMap` é dado: nomes explícitos → *aliases* embutidos → casamento por tokens → relatório do que não foi achado. Nome desconhecido não é "adivinhado": vira aviso e nota no relatório.
3. **O modelo diz o que sabe fazer** (`capabilities()`), e o resto se adapta: sem visemas nativos, o `FaceMixer` converte visemas em canais ARKit; sem *morph targets*, a mandíbula vira osso; sem ossos de olho, o olhar vai por `eyeLook*`.
4. **Enquadramento e luz vêm de landmarks** (altura, cabeça, olhos, queixo, ombros), não de números fixos: qualquer modelo é enquadrado e iluminado igual.
5. **Tempo é de um lugar só.** Os canais do rosto só mudam no `ExpressionComposer`, por *critically damped smoothing*; nenhuma expressão é instantânea e nenhuma ultrapassa o alvo.
6. **Falhas são tipadas e não derrubam o produto.** `AvatarError(code, message)`. GLB ruim → fallback procedural com o motivo; modelo que lança erro no `update` → isolado e, se persistir, troca para o fallback.

## Contrato `AvatarModel`

| Método | Entrada |
|---|---|
| `load()` | promessa; resolve `getInfo()` |
| `dispose()` | libera geometria, materiais, texturas, *mixers* |
| `setExpression(channels)` | mapa parcial: nomes ARKit (+ `jawClench`) → 0..1 |
| `setViseme(weights)` | 15 visemas → 0..1 (só se `capabilities().visemes`) |
| `setMouthLevel(level)` | abertura da boca 0..1 (para modelos que só têm mandíbula) |
| `setEyeTarget(yaw, pitch, perEye?)` | radianos; yaw>0 = direita da tela; `perEye = {yawL,yawR,pitchL,pitchR}` |
| `setHeadRotation(yaw, pitch, roll)` | radianos |
| `setBodyPose(pose)` | `breath, chest, sway, bodyRoll, bodyYaw, shoulderL/R, lean, armSwing` |
| `setIdle(k)` / `setSpeaking(on)` | escala o clipe *idle* / ativa clipe de fala |
| `update(dt)` | trabalho adiado, uma vez por quadro |
| `getLandmarks()` / `capabilities()` / `getInfo()` / `getRigReport()` | descrição |

`AvatarModel.check(obj)` devolve os métodos que faltam. Novo tipo de modelo: estender `AvatarModel` e `AvatarKit.registerModel('nome', fábrica)`.

## Fala

```
 speak(áudio, { visemes | phonemes | characters | alignment | marks, provider })
   ├─ com dados fonéticos → VisemeEngine: eventos {t,d,v} → coarticulação (antecipação, ataque, soltura,
   │                         fechamentos labiais têm prioridade sobre vogais) → 15 visemas
   │                         relógio = relógio do áudio (WebAudio ou elemento <audio>)
   └─ só áudio            → AmplitudeFallback: ganho adaptativo + dica espectral (arredondado/aberto/largo)
```

Provedores: ARPAbet com tempos, ids de visema Azure (0–21, *offset* em ticks de 100 ns), marcas de fala do Amazon Polly, tempos por caractere (formato de alinhamento de TTS), visemas Oculus diretos.
As tabelas de mapeamento estão em `VisemeEngine.js` (`AvatarKit.VisemeTables`) e podem ser trocadas com `opts.map`: **confira com a documentação da sua voz**.

Depois do `LipSyncController`, o `FaceMixer` acrescenta o que faz a fala parecer humana: bochechas que sobem em sons largos e inflam em plosivas, mandíbula e lábios levemente assimétricos, lábios que se encostam nas pausas, e uma respiração (boca entreaberta, narinas, tórax) depois de pausas longas.

## Expressão, estado cognitivo, contexto

`ExpressionComposer` combina: emoção (+ intensidade ou mistura) · estado cognitivo · contexto (`conversation | executive | intimate`) · fala · atenção.

* **Emoções (11):** neutral, listening, thinking, analyzing, confident, firm, skeptical, empathetic, surprised, concerned, decisive.
* **Estados cognitivos (9):** LISTENING, PROCESSING, THINKING, SPEAKING, DECIDING, WARNING, EMPATHY, CHALLENGE, CONFIDENCE. Cada um é um perfil: mistura de emoções, modo de olhar, movimento, taxa de piscada, acenos.
  `CHALLENGE` = cética 0,8 + firme 0,3, olhar fixo. `WARNING` = firme 0,85 + preocupada 0,3.
* `setExpression()` explícito depois de um estado vence a emoção do estado (mas mantém o olhar e a postura) até o próximo `setCognitiveState()`.
* Ao falar, o estado vira SPEAKING sozinho (e volta ao anterior no fim), a menos que `autoState: false`.

## Olhar (`GazeController`)

Modos: `attend` (maior parte no interlocutor, desvios curtos), `think` (desce/desvia 1–3 s e **volta ao direto**), `scan`, `glance`, `speak` (desvia ao começar a falar, volta na ênfase), `direct`, `hold`.
Sempre ligados: micro-sacadas (0,1–0,5°, várias por segundo) e deriva lenta; olhos convergem levemente, um olho é um pouco mais lento e mais trêmulo; piscada acoplada a saltos grandes; nenhum olhar direto passa de ~8–11 s sem um desvio.
Alvos: `camera`, `cursor`, `center`, `left`, `right` (direções da tela), `down`, `up`, ou `{x,y}`.

## Câmera e luz

`CLOSE | MEDIUM | FULL` × `conversation | executive | intimate`: o plano diz quanto da pessoa entra (em alturas de cabeça), o estilo diz a lente, a altura, o ângulo e a "respiração". Movimentos com *ease in-out* de 1,8–2,2 s; deriva em repouso de poucos milímetros.
`StudioLighting`: key (sombra suave), fill, dois rims, hemisfério; ambiente de *softboxes* pré-filtrado (PMREM) que dá brilho à pele, catchlight aos olhos e especular ao cabelo; fundo 3D com *shader*; piso só de sombra; estilos suaves; qualidade `low|medium|high`.

## Desempenho

Resolução adaptativa (reduz o *pixel ratio* se o quadro passar de 26 ms por 2 s; recupera após 6 s abaixo de 15 ms). Pausa fora da tela e com a aba oculta. Modelos GLB: influências de *morph* escritas só nos canais que o rig tem; `frustumCulled=false` em malhas com skin.
O `ProceduralAvatar` reconstrói a malha da cabeça na CPU, por isso só reconstrói quando um canal muda mais de 0,004.

## Mapa de arquivos

```
src/core/util.js                  matemática, ruído, RNG, Emitter, AvatarError
src/model/channels.js             vocabulário canônico (52 ARKit, 15 visemas, receitas viseme→ARKit)
src/model/RigMap.js               nomes → canais, relatório e nota do rig
src/model/AvatarModel.js          contrato
src/model/AvatarAdapter.js        troca de modelo, isolamento de falhas
src/model/loadAvatar.js           seleção/fallback/registro
src/model/procedural/*            fallback (Avatar3D + adaptador)
src/model/glb/GLBAvatar.js        modelo GLB
src/control/*                     fala, expressão, estado, olhar, animação, mixer
src/scene/*                       câmera, iluminação
src/AvatarAPI.js                  a única superfície pública
tools/                            build, gerador de GLB de teste
tests/unit, tests/browser         testes
demo/shell.html                   Avatar Lab
```
