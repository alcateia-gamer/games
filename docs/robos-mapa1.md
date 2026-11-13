# Robôs da cidade: spawn, colisão e remoção

A correção mantém o `EnemySpawnManager` existente. O mapa e a IA não foram substituídos.

## Origem autorizada e código removido

A camada real é **`SpawnRobo`**, em `assets/map/InicioFase1 (1).json`. Contém sete retângulos: 637 a 643. O alias antigo `SpawnRobos` continua aceito. O parser do Phaser já aplica os offsets dos grupos e das camadas; o gerenciador não os soma novamente. Camadas agrupadas são reconhecidas pelo nome final. No JSON atual não há offsets ou rotações nas zonas.

A cadeia de criação encontrada foi:

- `EnemySpawnManager.spawnRegion` → `criarInimigoTeste`: geração automática por proximidade.
- `DeveloperSpawns` → `criarRobos` / `criarRoboSerra`: atalhos antigos, inclusive solicitações remotas encaminhadas ao host por `CoopRuntime`.
- `Level1.atualizarInimigosRemotos`: representação dos snapshots do protocolo anterior.
- `CoopRuntime` / `CoopVisuals`: representações do protocolo cooperativo atual, sem simulação de física no cliente.

Foram removidos o sorteio radial ao redor do jogador/centro, o fallback de coordenadas do construtor, os colliders individuais desses atalhos e a API sem uso `addCollidersForNewEnemies`. Os atalhos dos dois tipos agora apenas solicitam ativação ao gerenciador existente. Robôs bola/olhão, próprios da fábrica, não são gerados pelos atalhos na cidade. Não foi encontrado outro timer ativo criando automaticamente esses dois robôs fora do gerenciador.

Também foram removidos os limites mundiais fixos de emergência e o despawn por distância de 1350 px após 5 segundos: estar longe do jogador não significa estar fora do mapa.

## Validação do spawn

`RobotBody.js` reúne as medidas antes duplicadas entre criação e gerenciador:

| Tipo | Escala | Corpo no mundo | Offset na folha |
| --- | --- | --- | --- |
| Atirador (`padrao`) | 0,23 | 41,4 × 25,3 px | 65 × 270 px |
| Serra | 0,36 | 68,4 × 36 px | 44 × 160 px |

O sorteio desconta a ocupação do sprite e dos pés com a margem existente de 14 px, inclusive para retângulos rotacionados. O corpo inteiro precisa caber na zona e no contorno. Preservou-se a regra anterior, mais conservadora, que também mantém a imagem inteira dentro da zona e livre dos objetos sólidos no nascimento.

As consultas reutilizam `retanguloLivreDoMapa` e seu índice espacial da própria `collisionGroup`, originada da camada `Collision`. Não existe uma segunda lista de paredes. Também são verificadas as distâncias e sobreposições com jogadores, inimigos existentes e posições planejadas.

Mantidos os valores existentes: 65 tentativas por inimigo, ativação a 600 px, 3–5 unidades por zona, limite global de 10, separação de 70 px, distância mínima de 150 px dos jogadores, consulta a cada 400 ms e retentativa em 2500 ms. Falha de planejamento não cria unidade de emergência; com debug ligado, a zona sem espaço emite aviso. O construtor local na cidade exige uma zona autorizada e revalida a posição antes de criar o sprite.

`spawnOnce: true` continua sendo o padrão: uma zona concluída não repete sua população. A reposição já disponível com `spawnOnce: false` continua passando pelas mesmas validações. Não se habilitou respawn infinito como alteração de dificuldade.

## Contorno e borda preta

`AreaMapa.js`, já utilizado pelo jogo, ganhou opções para selecionar camadas e métodos de interseção e varredura. A área dos robôs é calculada uma vez ao carregar o gerenciador.

As camadas `Sombra*` não ampliam o piso. A imagem do tile 1429 em `SombraGeral` é preta com alpha 128 e cobre 4126 dos 4166 tiles do chão: portanto não é uma barreira. Foram confirmados como opacos os tiles locais 0 de `A5_SciFi_Outside_Rasak` e 8 de `A5_SciFi_Inside_Rasak`, usados em 266 células da camada `Sombra`. Esses trechos fecham bordas externas; os demais recortes são definidos pelo contorno dos tiles do cenário.

Não se transformaram sombras em corpos físicos. A regra adicional só limita os robôs da cidade. No JSON da fábrica existem pretos também no chão, em objetos e em `BraçosRoboticos`; não se generalizou a regra por cor para o outro mapa. Nenhum JSON foi editado nesta correção.

## Profundidade

Os dois tipos já chamavam `calcularDepthAtor`, a mesma função dos jogadores. Foi preservada a ordenação comum por pés em `atualizarDepthAtores`, executada no `POST_UPDATE`, depois da física e da interpolação. Removeu-se o cálculo duplicado durante o update da IA. A criação ainda define o depth inicial.

Permanecem as prioridades de camadas, bases dos postes, overlays e cercas do cenário. Nenhuma fórmula nova substituiu a regra do jogador. Os testes verificam a troca de ordem com os pés dos atores e as exceções existentes de cidade/fábrica.

## Knockback e causa identificada

O impacto usa velocidade física, não teletransporte. A proteção varrida existente tratava os obstáculos físicos e a arena do boss, mas não o contorno da cidade. Os limites do gerenciador eram usados apenas no nascimento e podiam incluir o vazio dos chunks ou utilizar coordenadas fixas. Assim, não havia proteção contínua contra sair pelo contorno.

`EnemyCollision` agora limita o segmento físico ao primeiro recorte do contorno e depois aplica a varredura dos obstáculos já existente. A correção acontece antes da sincronização final do corpo com o sprite. Não há reposicionamento contínuo de robôs válidos para a zona de origem.

A força padrão de 110 e a duração de 90 ms foram preservadas. Para esses dois tipos, parâmetros extremos são limitados a 320 px/s e 250 ms. Golpes sucessivos substituem a velocidade; não somam impulsos. Alvos mortos ou com corpo desabilitado não recebem novo impulso. Não foi identificada acumulação de forças no código original.

## Remoção de segurança e multiplayer

A cada ciclo de 400 ms, somente a autoridade verifica se o corpo deixou completamente a área válida ou tem coordenadas não finitas. Fora da câmera, atrás de objetos ou longe dos jogadores não são motivos para remoção.

A remoção cancela combate, velocidade, rota, tween e flashes pendentes; desliga listeners de física/áudio e destrói sons, visuais auxiliares, corpo e sprite. Retira as referências da cena, da zona e do grupo. Não chama a rotina de morte, não solta sucata, não altera estatísticas nem marca os robôs como eliminados pelo jogador.

O host continua criando as unidades e atribuindo seus IDs. A retirada aparece no próximo snapshot/delta existente, e o cliente descarta a representação. Novos spawns recebem novos IDs. Não se criou um segundo protocolo. O snapshot do protocolo anterior também passou a carregar `tipoRobo`, para preservar a distinção entre atirador e serra.

## Arquivos desta correção

Produção:

- `js/enemies/EnemySpawnManager.js`
- `js/enemies/EnemyTest.js`
- `js/enemies/RobotBody.js` (novo, medidas compartilhadas)
- `js/enemies/EnemyCollision.js`
- `js/enemies/EnemyHealth.js`
- `js/map/AreaMapa.js`
- `js/combat/CombatEffects.js`
- `js/controls/DeveloperSpawns.js`
- `js/sounds/inimigos.js`
- `js/scenes/Level1.js`
- `js/scenes/Level1Parte2.js` (somente remoção de dois imports sem uso)
- `js/multiplayer/multiplayerManager.js` (campo `tipoRobo` no snapshot anterior)

Testes:

- `js/enemies/EnemySpawnManager.test.mjs`
- `js/enemies/EnemyCollision.test.mjs` (novo)
- `js/map/AreaMapa.test.mjs`
- `js/map/ProfundidadeMapa.test.mjs`
- `tests/city-robots.browser.mjs` (novo)
- `tests/city-robots-multiplayer.browser.mjs` (novo)

Mudanças de tarefas anteriores permanecem no workspace; esta lista se limita à correção dos robôs.

## Verificação executada

210 testes passaram, executando diretamente com Node os seguintes 12 arquivos:

- `js/enemies/EnemyCollision.test.mjs`: 3
- `js/enemies/EnemySpawnManager.test.mjs`: 11
- `js/map/AreaMapa.test.mjs`: 4
- `js/map/ProfundidadeMapa.test.mjs`: 14
- `js/enemies/EnemyAI.test.mjs`: 23
- `js/enemies/EnemyBalance.test.mjs`: 35
- `js/enemies/EnemyPathfinding.test.mjs`: 17
- `js/combat/PlayerHitEffects.test.mjs`: 8
- `js/enemies/RoboSerraMorte.test.mjs`: 5
- `js/multiplayer/CoopAudio.test.mjs`: 53
- `js/multiplayer/CoopRegression.test.mjs`: 26
- `js/multiplayer/CoopProtocol.test.mjs`: 11

`tests/city-robots.browser.mjs` usa o jogo completo e o Phaser real no Chromium: as sete zonas e os dois corpos, zona pequena/bloqueada, ausência de fallback, rejeição de sobreposição, troca de profundidade com o jogador, impactos contra parede de dois pixels, 250 recuos em direção à borda real, limpeza sem drop, listeners removidos, morte normal com drop e reposição dentro da zona.

`tests/city-robots-multiplayer.browser.mjs` abriu partidas completas pelo lobby com **2, 3 e 4 jogadores**, usando broker MQTT local. Todos passaram: mesmos IDs nos clientes, cliente sem autoridade para spawn, dano enviado por cada personagem, remoção sem recompensa propagada, reposição com novos IDs e ausência de reaparecimento dos IDs removidos. Relatórios em `/tmp/city-robots/solo.json` e `/tmp/city-robots/multiplayer.json`.

Uma execução do teste de navegador exigiu ajuste: a zona 641 pode esgotar uma rodada de tentativas por ocupação. O teste passou a admitir os ciclos limitados de retentativa previstos pelo sistema, verificando que não surgem unidades de emergência durante uma rodada sem posição. A regra de produção não foi relaxada.

Limitações: não foi feito teste em aparelho físico, medição comparativa de FPS ou inspeção visual manual de cada carro/poste. As consultas de spawn reutilizam o índice de colisões; não há varredura completa do mapa por frame. A navegação existente permanece, com seus testes de passagem, rota, recuperação e orçamento por frame. Não há detecção nova de acessibilidade global para futuras edições do Tiled: um retângulo desenhado dentro de um recinto fechado e sem obstáculos em seu interior ainda exigirá corrigir o mapa ou acrescentar uma regra de conectividade.
