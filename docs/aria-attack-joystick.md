# Joystick híbrido de ataque da Aria

> Histórico: o jogo voltou a usar o botão de ataque padrão para a Aria. Pressionar
> carrega o arco; soltar dispara na direção atual da personagem, que acompanha a
> caminhada. A implementação de joystick descrita abaixo está desconectada dos
> controles do jogo; seus testes isolados e o roteiro de navegador ficam como referência.

A Aria usa um joystick rosa no centro lógico `(720, 350)`. A base mede 55 px de raio; a área interativa mantém os 46 px do botão anterior para preservar o espaço de dash e holograma. O polegar acompanha o dedo até 45 px. Os outros personagens continuam com o botão de espada.

## Comportamento

- Toques de até 180 ms disparam com dano 25 e velocidade 420. Há um intervalo de 250 ms entre solturas rápidas.
- Acima de 180 ms, a carga interpola dano e velocidade até 45 e 600 em 1200 ms. Segurar além disso mantém o limite. Um disparo carregado pode sair durante o intervalo dos rápidos.
- A carga usa o relógio `scene.time.now`, compartilhado entre mouse e joystick. O timestamp nativo posiciona a entrada entre quadros, preservando a duração de toques rápidos mesmo com FPS baixo. Pausa, perda de foco e cancelamentos encerram a carga sem disparar. A Aria não enfileira uma nova carga após a animação de soltura.
- A caminhada mantém sua direção independente da mira. Após 600 ms de carga, aplica multiplicador 0,90 à velocidade calculada naquele quadro. Dash continua tendo prioridade sobre essa velocidade.
- O vetor físico da flecha preserva os 360 graus. Só a animação usa quatro setores com histerese de 5 graus. A rotação visual desconta a orientação original do frame da flecha.
- Flechas usam varredura contínua de um retângulo orientado de 32 × 6 px. O primeiro obstáculo ou alvo resolve o disparo, com prioridade para paredes nos empates. A busca espacial reutiliza os corpos estáticos do mapa. O alcance continua em 1800 px.
- O anel mostra a carga e pulsa no máximo; a linha de mira fica no mundo, abaixo do HUD, e termina no primeiro obstáculo.
- Holograma pode ser invocado enquanto a Aria ataca. A restrição existente de invocar durante dash permanece; a troca com holograma continua prioritária, inclusive durante dash. Cooldowns, arte e efeitos dessas habilidades permanecem em seus módulos atuais.

Os parâmetros ficam em `js/controls/AriaAttackConfig.js`. Uma cena pode fornecer valores em `scene.ariaAttackConfig` antes da criação dos controles. O limite de quatro dedos está em `js/core/config.js`.

O alinhamento visual da folha de ataque de 64 px compensa a diferença em relação à caminhada de 128 px, mantendo o corpo na mesma posição relativa aos pés. As configurações de hitboxes não foram alteradas.

## Testes

Testes de eventos e geometria, sem dependências adicionais:

```sh
node --test js/controls/AriaAttackJoystick.test.mjs js/player/ArrowCollision.test.mjs js/player/PlayerAttackTransitions.test.mjs js/controls/PlayerJoystick.test.mjs
```

Os testes novos cobrem toque rápido, carga máxima, diagonais, movimento independente, dash, dedos alheios, soltura duplicada, cooldown, cancelamentos, respawn, zoom, reconstrução, limpeza, alcance, varredura contra paredes finas e dano ao boss. Os testes de transição continuam verificando os quatro personagens; a expectativa de fila da Aria foi atualizada para exigir novo toque.

O teste de navegador usa a fase Level1 completa, Phaser e eventos de toque nativos via CDP. Requer Chromium e `playwright-core`. Instalação opcional fora do repositório:

```sh
npm install --prefix /tmp/aria-browser --no-audit --no-fund playwright-core
python3 -m http.server 8765 --bind 127.0.0.1
```

Em outro terminal:

```sh
PLAYWRIGHT_MODULE=/tmp/aria-browser/node_modules/playwright-core/index.mjs \
CHROMIUM_PATH=/caminho/do/chromium \
node tests/aria-controls.browser.mjs
```

É possível usar `CHROME_CDP=http://127.0.0.1:9222` para conectar a um Chromium já aberto. `BASE_URL` configura o servidor; `ARIA_SCREENSHOT` configura a captura, cujo padrão é `/tmp/aria-charge.png`.

O teste expõe a instância do jogo por interceptação restrita à sessão de teste. Para isolar a entrada, desativa o collider do jogador com o mapa e liga o modo desenvolvedor nessa sessão. As colisões das flechas são verificadas separadamente com corpos estáticos reais e as funções existentes de dano. Os alvos de robô e boss usados no teste são objetos de teste com as interfaces esperadas, sem executar suas IAs.

A suíte geral foi comparada com o `HEAD` original em uma cópia temporária. As quatro suítes abaixo já falhavam antes da implementação e continuam com suas falhas anteriores:

- `js/effects/TerrorLighting.test.mjs`: mock sem `game.renderer`.
- `js/interactions/FactoryDoor.test.mjs`: mock sem `textures.getFrame`.
- `js/map/ColisoesMapa.test.mjs`: divergências entre os obstáculos esperados e a implementação existente.
- `js/player/colisoes/PlayerCollisionConfig.test.mjs`: expectativas divergentes das configurações atuais.

Não houve teste em celular físico. Ergonomia do polegar, cancelamentos específicos de cada navegador móvel, áudio em dispositivos reais e sincronização visual entre dois clientes multiplayer ainda precisam de validação manual. O envio da rotação foi adicionado ao protocolo existente de projéteis, com valor padrão zero para mensagens antigas.

## Arquivos criados

- `js/controls/AriaAttackConfig.js`
- `js/controls/AriaAttackJoystick.js`
- `js/controls/AriaAttackJoystick.test.mjs`
- `js/player/ArrowCollision.js`
- `js/player/ArrowCollision.test.mjs`
- `tests/aria-controls.browser.mjs`
- `docs/aria-attack-joystick.md`

## Arquivos modificados

- `js/controls/PlayerAttackControls.js`
- `js/controls/PlayerAnimations.js`
- `js/controls/PlayerMovement.js`
- `js/controls/PlayerDashControls.js`
- `js/combat/PlayerSpecialAbilities.js`
- `js/core/config.js`
- `js/player/Player.js`
- `js/player/PlayerProjectiles.js`
- `js/player/PlayerAttackTransitions.test.mjs`
- `js/scenes/Level1.js`
- `js/scenes/Level1Parte2.js`
