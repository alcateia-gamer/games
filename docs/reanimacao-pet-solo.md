# Reanimação pelo robô pet no solo

## Comportamento

- A primeira e a segunda morte executam a animação de queda do personagem. O robô se aproxima e faz a reanimação com indicação de progresso, sem feixe ou partículas.
- A queda dura 750 ms, a aproximação 650 ms e a reanimação 2.200 ms. Movimento, ataques e física ficam bloqueados durante o resgate.
- O jogador retorna no mesmo ponto, com a vida máxima do personagem, a stamina que tinha e o inventário preservado. Recebe 2 segundos de proteção para evitar outra morte imediata ou recaptura por tentáculos.
- A cena e a luta não reiniciam. A atualização do resgate ocorre antes da atualização do boss, preservando o encontro durante a queda.
- Na terceira morte, a animação de queda antecede a sequência de derrota existente e a tela **GAME OVER**. O descarte normal do inventário ocorre apenas nessa derrota definitiva.
- São dois resgates por partida, compartilhados entre cidade e fábrica. Trocar de mapa não renova os usos; iniciar uma nova partida solo renova os dois.
- O cooperativo mantém suas regras existentes. Se não houver um pet ativo no solo, a queda termina na derrota, sem consumir resgate.

## Arquivos

| Arquivo | Alteração |
| --- | --- |
| `js/player/SoloRunState.js` | Contagem por partida no registry, limite de dois usos e reinício. |
| `js/player/SoloPetRevival.js` | Queda, aproximação do pet, reanimação, proteção e limpeza ao sair da cena. |
| `js/scenes/BootPartida.js` | Renova os resgates ao iniciar uma partida solo. |
| `js/scenes/DeathScreen.js` | Encaminha as mortes solo ao resgate e mantém a derrota definitiva na terceira morte. |
| `js/scenes/Level1.js` e `Level1Parte2.js` | Inicializam e atualizam o resgate nos dois mapas. |
| `js/player/SoloPetRevival.test.mjs` | Oito testes da mecânica, limites, transição, limpeza e isolamento do multiplayer. |
| `tests/solo-pet-revival.browser.mjs` | Verificação no Phaser real com capturas e relatório. |

As spritesheets de queda existentes e a função `animarQuedaCoop` são reutilizadas sem modificar seus arquivos. A reanimação não altera assets originais, o código do pet nem as regras do multiplayer. Nenhum arquivo foi excluído ou renomeado.

## Validação

- **598 testes aprovados em 49 arquivos** relacionados a jogador, controles, cooperativo e boss.
- No navegador: seis quadros de queda dos quatro personagens; resgate na cidade e na fábrica; limite de dois usos entre mapas; terceira morte com GAME OVER; inventário preservado; controles e colisão restaurados; cancelamento da carga da Aria; vida e ataque do boss mantidos; renovação dos dois usos pela inicialização real de uma nova partida.
- Inspeção visual das quedas, da aproximação/reanimação e da tela de derrota. Sem alteração nas imagens originais.
- A varredura geral também encontrou falhas preexistentes em `ColisoesMapa`, `FactoryLighting`, `interacoesSerra`, `FactoryDoor` e `PlayerCollisionConfig`. Elas foram reproduzidas em uma cópia isolada do HEAD anterior às mudanças e ficaram fora desta tarefa.

Para os testes unitários desta mecânica:

```sh
node js/player/SoloPetRevival.test.mjs
```

Para a validação visual, sirva o repositório por HTTP e instale Playwright Core em um ambiente de testes com Chromium disponível:

```sh
BASE_URL=http://127.0.0.1:8765 \
PLAYWRIGHT_MODULE=/caminho/playwright-core/index.mjs \
CHROMIUM_PATH=/caminho/chrome \
node tests/solo-pet-revival.browser.mjs
```

As capturas e o relatório são gravados em `/tmp/solo-pet-revival`, ou no diretório definido por `ARTIFACT_DIR`. A verificação de renovação do contador pode ser executada isoladamente com `SOLO_TEST_CASE=nova-partida`. O teste usa renderização por software; a nova partida é verificada em outro processo do navegador para liberar as texturas acumuladas dos mapas e personagens anteriores.
