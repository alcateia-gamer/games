# Diálogos da oficina

A interação existente com o NPC da cidade e da fábrica chama `scene.upgradeDialogue.open()`.
O `DialogueManager` mantém o índice, Typewriter e UI somente no cliente local. Ao concluir,
restaura os controles e chama a mesma `UpgradeShopUI.open()` usada anteriormente.
Nenhuma letra, retrato ou progresso de conversa é enviado pela rede; a simulação continua.

## Conteúdo e tempos

`js/narrative/NPCDialogues.js` contém primeiro encontro e quatro conversas recorrentes
para os IDs reais `kai-mercer`, `nyx`, `aria-kade`, `magnus-force`. Os roteiros anteriores
da oficina não estavam no repositório; foram escritas conversas equivalentes conforme
as personalidades solicitadas. As transmissões existentes do Hollow foram preservadas.
O histórico por jogador/personagem fica no registry local e sobrevive à troca de mapa;
nenhuma conta de sucatas recebe estado de diálogo.

`DialogueManager` aceita `{ characterMs: 30, punctuationMs: 90, holdMs: 1000 }` como
terceiro argumento. O avanço usa `scene.events.update`, sem intervalos nem timers.
Mouse, toque e E/Enter/Espaço revelam a fala em andamento ou avançam uma fala completa.
Escape ou SAIR cancelam a conversa, sem abrir a loja. Desconexão, morte, transição,
afastamento e shutdown também cancelam a sequência e removem a UI.

## Retratos

`DialogueUI.headPortrait` usa os frames já carregados: NPC `upgrade-npc:180`, Kai
`walk:18`, Magnus `personagem2-walk:18`, Aria `personagem3-walk:18`, Nyx
`personagem4-walk:18`. A região superior da área opaca é recortada em canvas e armazenada
em cache por TextureManager. A exibição mantém proporção e `image-rendering: pixelated`.
Não há assets adicionais a fornecer nem alteração dos sprites originais.

## Loja e rede

As compras continuam por `ScrapSystem.requestPurchase` → ação `upgradeBuy` → host
`ScrapSystem.buy` → `purchase`. O host escolhe o personagem pelo contexto do remetente,
valida proximidade, vida, nível esperado e saldo: individual no solo, compartilhado
pela equipe no multiplayer (ver `docs/shared-scrap.md`). O protocolo
existente deduplica ações e autentica a autoridade/target. A transação síncrona verifica
o nível antes de debitar e o estado econômico atualizado é replicado como antes.
Preços e balanceamento não foram alterados.

A loja exibe comentários de compra, falta de sucata, máximo e despedida. Uma solicitação
sem resposta libera a interface após seis segundos; tentativas repetidas continuam
protegidas pelo nível esperado no host. Fechar ou destruir limpa callbacks de compra.

## Verificação

- `node js/narrative/NPCDialogues.test.mjs`: sequência, Unicode, cliques, histórico,
  cancelamento e isolamento de dois controladores.
- `node js/systems/Upgrades.test.mjs`: integração da interação, restauração dos controles,
  compras concorrentes, saldo por jogador e caminho host/cliente.
- `node tests/upgrade-dialogue.browser.mjs`: jogo real, DOM/retratos/responsividade,
  avanço automático, dois clientes com broker MQTT local, compra durante a conversa
  do outro jogador e desconexão. Usa Playwright, aedes 0.51 e ws/mqtt em
  `/tmp/nullborns-test-tools/node_modules` (ou `ROBOT_TEST_TOOLS`). Chrome pode ser
  configurado em `CHROME_PATH`; servidor do projeto em `GAME_URL` (padrão porta 8765).

## Arquivos desta implementação

Novos: `js/narrative/NPCDialogues.js`, `js/narrative/TypewriterText.js`,
`js/narrative/DialogueManager.js`, `js/ui/DialogueUI.js`,
`js/narrative/NPCDialogues.test.mjs`, `tests/upgrade-dialogue.browser.mjs`,
`docs/upgrade-dialogue.md`.

Alterados: `js/interactions/UpgradeNPC.js`, `js/inventory/ItemPickup.js`,
`js/ui/UpgradeShopUI.js`, `style.css`, `js/systems/Upgrades.test.mjs`,
`tests/upgrade-factory.browser.mjs` (Chrome configurável e pressionamento de tecla
com duração suficiente para o loop do Phaser).

Resultados: 81 testes unitários/regressão passaram nas suítes NPCDialogues (9),
Upgrades (31), ItemPickup (3), CoopRegression (27) e CoopProtocol (11).
O teste no navegador passou com dois clientes completos e broker MQTT local:
conversas simultâneas, movimento independente, compra remota enquanto o host
conversa, saldo compartilhado/níveis individuais corretos e desconexão com remoção da UI local. As capturas
ficam em `/tmp/upgrade-dialogue`. Não foi testado um broker público nem dispositivos
físicos; as resoluções móveis foram verificadas no Chrome automatizado.
O teste existente `upgrade-factory.browser.mjs` também passou: compra na cidade,
compra na fábrica, retorno com saldo e níveis preservados, nenhuma duplicação da
loja e restauração correta do HUD após o boss.
