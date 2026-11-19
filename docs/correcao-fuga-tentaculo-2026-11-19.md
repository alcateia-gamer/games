# Fuga do tentáculo — 19/11/2026

## Causa e correção

Solo e multiplayer contavam entradas em listeners globais de `pointerdown`, incluindo cliques vazios no cenário. O multiplayer reconhecia somente a referência do círculo de ataque. O controle legado da Aria também tinha seu próprio caminho de entrada.

A entrada agora parte dos listeners do botão e ícone de ataque, passando por `criarEntradaLibertacaoAtaque()`. O controle legado da Aria utiliza o mesmo adaptador. Durante a contenção, esse caminho consome a entrada antes do ataque normal, sem carregar arco, consumir estamina ou criar projéteis. O clique normal de combate no cenário permanece disponível fora da captura e é ignorado durante ela.

O adaptador mantém o ponteiro pressionado até a soltura e deduplica círculo/ícone. Outros dedos não liberam o estado. Há limpeza em soltura fora do botão, cancelamento de toque, pausa, perda de foco, fim da captura e destruição dos controles. Uma duplicação do evento que completa a fuga também não inicia um ataque normal nesse mesmo pressionamento.

No solo, o controle emite um evento local para o encontro registrar o aperto e atualizar o HUD. O host registra diretamente no contexto local, sem mandar uma solicitação de rede. O cliente reutiliza a ação `escape`; o host verifica jogador vivo, participante, captura atual, mapa e sessão e aplica somente um aperto ao contexto do remetente. Uma identidade única por captura impede reaproveitar pedidos antigos. A deduplicação do envelope continua sendo a do protocolo existente. O estado de controle existente transmite o progresso atualizado.

Não foram alterados apertos necessários, animações, duração, dano, puxão, sons ou balanceamento do boss. Não foram criados botões ou objetos gráficos.

## Arquivos alterados

- `js/enemies/novoBoss/NovoBossLibertacao.js`: adaptador compartilhado e retirada da entrada global de fuga.
- `js/controls/PlayerAttackControls.js`: botão/ícone encaminham a fuga antes do combate normal.
- `js/controls/AriaAttackJoystick.js`: mesma entrada no controle legado da Aria.
- `js/player/PlayerControlEffects.js`: identidade da captura e notificação local de liberação.
- `js/multiplayer/CoopRuntime.js`: remoção do listener global, validação da captura e envio de progresso pelo canal existente.
- `js/enemies/novoBoss/NovoBossHud.js`: o HUD do host consulta a captura do próprio jogador, sem usar a restrição vazia do contexto geral do boss.
- `js/enemies/novoBoss/NovoBossLibertacao.test.mjs`: deduplicação, cenário, múltiplos dedos, soltura e cancelamento.
- `js/multiplayer/CoopRegression.test.mjs`: identidade, sessão, mapa, jogador vivo e isolamento do contexto remoto.
- `js/controls/PlayerJoystick.test.mjs`: listeners reais do botão/ícone, sem ataque normal durante a fuga.
- `js/controls/AriaAttackJoystick.test.mjs`: fuga no controle legado sem carregar ou disparar flecha.

## Testes executados

As seis suítes solicitadas passaram em processos Node separados:

| Suíte | Aprovados |
| --- | --- |
| NovoBossLibertacao | 3 |
| PlayerControlEffects | 11 |
| CoopRegression | 33 |
| CoopProtocol | 15 |
| PlayerJoystick | 22 |
| AriaAttackJoystick | 40 |

Total: **124 testes aprovados, zero falhas**. `git diff --check` também passou.

Foi executado `tests/novo-boss-aviso-libertacao.browser.mjs` com Brave/Playwright. O roteiro falhou na assertiva do aviso visual do ataque `pulso`, linha 42, antes de alcançar a etapa de fuga. Portanto, esse teste de navegador não foi aprovado nem comprova a fuga real nesta execução. Log: `/tmp/tentaculo-browser.log`.

## Validação complementar

- Suítes ampliadas: todos os testes de `js/enemies/novoBoss/`, mais as cinco suítes relacionadas a controles e protocolo: **28 arquivos, 378 testes aprovados**, incluindo a regressão adicional do HUD do host.
- `tests/tentaculo-solo.browser.mjs`: aprovado para Kai e Aria, com mouse e touchscreen emulado. Verifica toques no cenário ignorados, botão segurado contando somente uma vez, oito apertos, libertação e limpeza do HUD.
- `tests/tentaculo-coop.browser.mjs`: cenário com dois jogos completos e MQTT/WebSocket local; verifica captura do host e do cliente, entrada pelo botão real, cenário ignorado, isolamento do jogador, botão segurado, contador visível e limpeza do HUD.
- Evidências: `/tmp/tentaculo-solo.log`, `/tmp/tentaculo-coop.log`, `/tmp/tentaculo-coop/report.json` e `/tmp/tentaculo-unit/summary.json`.

Os testes focados usam capturas controladas pela API existente para isolar a entrada, sem depender do aviso visual do ataque pulso. Não foi realizado teste em aparelho celular físico. A alteração local em `assets/map/parte2-fase1.json` foi preservada; não faz parte desta correção.
