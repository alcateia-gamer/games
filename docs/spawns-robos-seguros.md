# Revisão dos spawns de inimigos — cidade e fábrica

## Problemas encontrados

1. Alguns caminhos de criação do robô-bola e do olhão verificavam obstáculos, mas não exigiam piso. Uma posição vazia fora do mapa passava nesse teste.
2. O contorno que incluía qualquer tile podia considerar telhados, decoração e sombras como ampliação da área jogável.
3. Os corpos estáticos eram dimensionados com `setSize` isolado. No StaticBody do Phaser, isso deslocava os limites em relação ao retângulo do Tiled. A cidade também não tratava corretamente polígonos e cápsulas; as aproximações de polígonos da fábrica aceitavam células apenas pelo centro.
4. A consulta de espaço livre podia reaproveitar limites antigos após mover ou substituir um obstáculo, mantendo a mesma quantidade de corpos.
5. As áreas do robô-bola somavam novamente offsets que o parser Phaser já havia aplicado.
6. O planejamento da cidade tratava um robô adicional como obrigatório quando ele repetia o tipo do par inicial. Em regiões estreitas, como a zona 639, isso podia cancelar a onda inteira quando o alvo sorteado era cinco.

## Correções

- O piso usado pelos inimigos vem das camadas `Chão` da cidade e `chão`/`ChãoProdução` da fábrica. São conferidos todos os tiles tocados pelo corpo, incluindo recortes, buracos e coordenadas negativas. A área é calculada uma vez por tilemap e compartilhada.
- Atualização de 19/11/2026: na cidade, toda a hitbox dos pés precisa caber exclusivamente no retângulo original de `SpawnRobo`/`SpawnRobos`. Não existe expansão ou posição de emergência. A imagem inteira e as margens continuam sendo validadas contra obstáculos e limites do mapa. A região não restringe a patrulha após o nascimento. A fábrica mantém sua regra própria de faixa próxima. Veja `correcao-robos-mapa1-2026-11-19.md`.
- A cidade reserva 20 px ao redor do sprite inteiro e dos pés; a fábrica reserva 20 px além do corpo físico do robô-bola. A busca detalhada só entra quando a grade normal não encontra posição, cobrindo corredores estreitos como o da área 1616 sem dispensar a margem.
- Os spawns mantêm pelo menos 120 px entre centros e 24 px entre os limites visuais dos robôs, inclusive entre tipos e áreas diferentes. Posições planejadas contam como ocupadas antes da criação. Entre candidatos seguros, o sistema prefere os mais separados dos inimigos atuais.
- As consultas de espaço livre usam os corpos estáticos atuais e o índice espacial do Phaser. A barreira física ativa do boss também impede criar um robô em seu interior.
- Os retângulos físicos usam `displaySize` e `refreshBody`, preservando as coordenadas fracionárias do Tiled. Polígonos, elipses e cápsulas são aproximados por faixas internas de até 2 px; essas faixas não ultrapassam o desenho da colisão. Os IDs usados pelas torres permanecem nos corpos.
- Os construtores dos robôs terrestres, bola e olhão também validam o mapa antes de criar sprites, áudio ou outros recursos. O bola/olhão verifica a distância dos jogadores remotos, além do jogador local.
- As criações automáticas continuam ligadas às áreas do Tiled. Na cidade, não há entorno permitido; sem ponto válido dentro do retângulo original, aguardam uma nova tentativa. A faixa próxima continua específica da fábrica. Os atalhos DEV mantêm seu funcionamento, com validação de piso e obstáculos. Os portais do boss preservam suas posições e verificam também o piso na saída física do robô.
- O par obrigatório da cidade permanece obrigatório; robôs adicionais só são criados quando existe espaço seguro. Foram preservados os limites de quantidade, energia/proximidade e o orçamento compartilhado de sete robôs nos retângulos 1625, 1629 e 1630.
- Os robôs recebem o contorno do piso para a navegação e para a proteção física já existente contra atravessamentos. A criação continua sob autoridade do host no cooperativo.

## Arquivos desta revisão

| Arquivo | Motivo |
| --- | --- |
| `js/enemies/EnemySpawnValidation.js` | Validação compartilhada de piso, colisões e barreira; faixa próxima, separação visual e distribuição; cache por mapa. |
| `js/enemies/EnemySpawnArea.js` | Tolerância numérica para coordenadas fracionárias/rotações na borda. |
| `js/enemies/EnemySpawnManager.js` | Piso da ocupação inteira e correção do planejamento dos robôs adicionais. |
| `js/enemies/EnemyTest.js` | Validação final antes da criação e associação ao contorno navegável. |
| `js/enemies/RoboBola.js` | Validação em criações explícitas/manuais, jogadores remotos e contorno navegável; também atende ao olhão. |
| `js/enemies/RoboBolaSpawnAreas.js` | Offsets aplicados uma vez, margem real e piso específico para inimigos. |
| `js/enemies/EnemyPathfinding.js` | Consulta dos corpos atuais e rotas limitadas ao piso permitido. |
| `js/enemies/novoBoss/NovoBossPortais.js` | Piso obrigatório no nascimento e na saída do portal. |
| `js/map/AreaMapa.js` | Seleção das camadas de piso dos dois mapas. |
| `js/map/ColisoesMapa.js` | Alinhamento dos corpos estáticos e representação das formas do Tiled. |
| `js/enemies/EnemySpawnValidation.test.mjs` | Todas as áreas reais dos dois mapas, separação diagonal entre sprites e expansão de áreas rotacionadas. |
| `js/enemies/RoboBola.test.mjs` | Cobertura de jogador remoto ocupando o ponto solicitado. |
| `js/effects/FlashlightWalls.test.mjs` | Fixture de corpo estático atualizada para a API de dimensionamento correta; mesmas verificações de luz e solidez. |
| `tests/spawn-map-fixture.mjs` | Parser e StaticBody da biblioteca do projeto com os dados reais dos mapas. |
| `tests/spawns-seguros.browser.mjs` | Criação dos inimigos no Phaser real, nos dois mapas, com capturas e relatório. |

Os JSONs dos mapas, sprites, animações e arquivos do boss antigo foram preservados. Nenhum arquivo foi excluído ou renomeado. As mudanças de revivida e portas já presentes no workspace foram mantidas.

## Verificação

- Testes dos corpos estáticos reais: limites dos retângulos, elipses, cápsulas e polígonos dos dois mapas.
- Testes com parser e mapas reais: 7 zonas da cidade, 18 áreas da fábrica, limites regionais, offsets de grupos e rejeição de pisos falsos/vazio.
- Navegador: quatro rodadas em cada zona da cidade com alvo máximo de cinco, verificação dos sprites e corpos; todas as 18 áreas da fábrica; posições dos dois portais; rejeição de criação direta de bola/olhão fora do mapa.
- Todas as ondas da fábrica completaram suas cotas; os três retângulos do corredor totalizaram sete robôs. Também foram verificadas as primeiras atualizações da física, com os inimigos visíveis e em posições válidas. Sem erros JavaScript no cenário.
- Na suíte geral, 122 de 126 arquivos passaram: 1.259 casos aprovados e nove falhas em quatro arquivos. As mesmas falhas foram reproduzidas em uma cópia isolada do HEAD anterior às mudanças: `FactoryLighting`, `FactoryDoor`, `PlayerCollisionConfig` e `interacoesSerra`. Os testes de colisão dos mapas, que antes falhavam, passaram após a correção dos corpos estáticos. Os testes específicos desta revisão passaram.

Para reproduzir os testes específicos:

```sh
node js/map/ColisoesMapa.test.mjs
node js/enemies/EnemySpawnValidation.test.mjs
node js/enemies/EnemySpawnManager.test.mjs
node js/enemies/RoboBolaSpawnAreas.test.mjs
node js/enemies/RoboBola.test.mjs
node js/enemies/EnemyPathfinding.test.mjs
```

Para o navegador, sirva o repositório por HTTP e execute com Playwright Core/Chromium disponíveis:

```sh
BASE_URL=http://127.0.0.1:8765 \
PLAYWRIGHT_MODULE=/caminho/playwright-core/index.mjs \
CHROMIUM_PATH=/caminho/chrome \
node tests/spawns-seguros.browser.mjs
```

As capturas e o relatório são gravados em `/tmp/spawns-seguros`, ou no diretório definido por `ARTIFACT_DIR`.
