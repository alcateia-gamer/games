# Auditoria de bugs — 18/11/2026

Código inicial: `45fbb38`. Foram executados os 146 arquivos unitários de `js/`,
cada um em processo separado, usando Node 24.11.1 com
`--test --test-isolation=none`. Isso evita que os mocks globais do Phaser de um
arquivo contaminem outro. Resultado inicial: **1.460 testes aprovados e 14 falhas**.

Após as correções, os mesmos 146 arquivos passaram: **1.474 testes aprovados,
zero falhas**. Resumo final em `/tmp/nullborns-bug-fixes/unit-summary.json`.

## Bug reproduzido e corrigido

A abertura preta da introdução aguardava a imagem da TV até para mostrar ações
de recuperação. Se o vídeo falhasse e a imagem permanecesse sem resposta, a
mensagem e o botão de continuar ficavam atrás da máscara preta.

`CutsceneLoading.revealOpening` agora aguarda a arte apenas no fluxo normal.
`setAction` libera a abertura sem essa dependência para mostrar ações de erro
ou permissão de reprodução. O fluxo normal continua esperando a arte e um
quadro decodificado, com oval, piscada e abertura completa.

O novo caso de `tests/cutscene-opening.browser.mjs` mantém a requisição da
imagem pendente e aborta o vídeo. Antes da correção, a abertura não iniciava;
depois, a máscara é removida mesmo com a imagem pendente. Os casos normais
de desktop e celular também passaram.

## Navegador e multiplayer

Passaram no Chromium/Brave local:

- Abertura da TV em 1100 × 740 e 390 × 844, incluindo piscada, carregamento
  atrasado, limpeza e falha simultânea de vídeo/imagem.
- Host Connection: todas as 32 posições, retorno ao início, identidade do
  clique, erro e autenticação por mouse e toque.
- Torres com duas instâncias e MQTT: ordem real de desenho e profundidade
  coincidem no host e cliente, atrás, à frente e na linha dos pés.
- Campanha cooperativa completa: operador único, cancelamento, snapshot antigo,
  Breach, BruteForce, cartão, portas, memória, transferência de operador com
  checkpoint e encerramento nas duas telas.

## Falhas preexistentes resolvidas

Os oito arquivos que falharam foram executados novamente contra `75d0b21`, com
os mesmos recursos do diretório atual. Reproduziram as mesmas 14 falhas; os
arquivos de teste em questão também não mudaram entre as duas revisões.
A revisão seguinte corrigiu os problemas reais e atualizou as fixtures e
expectativas que não correspondiam ao funcionamento atual, sem alterar as
hitboxes nem a aparência da iluminação em produção.

| Arquivo | Falhas | Evidência e situação |
| --- | ---: | --- |
| `js/controls/DeveloperBoss.test.mjs` | 1 | Fixture de CoopWorld passou a fornecer `generator.receive`; validações de DEV e autoridade continuam cobertas. |
| `js/core/AssetLoading.test.mjs` | 1 | Fixture do preloader passou a fornecer `cutscene.setLoadProgress`; shutdown e retentativa continuam verificados. |
| `js/effects/FactoryLighting.test.mjs` | 4 | Teste do halo azul isola a aura vermelha; teste do personagem verifica a ausência do antigo foco branco artificial; perfil usa o ganho atual de 1,6. Inclui a falha do teste pai do escudo. Nenhum ajuste visual em produção. |
| `js/enemies/EnemySpawnManager.test.mjs` | 1 | Busca alternativa refinada de 48 para 16 px nas áreas pequenas, com cerca de 1.600 candidatos nas grandes. A grade antiga pulava espaços válidos. Preservadas as colisões, margens, distância entre inimigos e quantidade de robôs. |
| `js/player/colisoes/PlayerCollisionConfig.test.mjs` | 2 | Expectativas atualizadas para as configurações atuais dos quatro personagens; hitboxes de produção preservadas. |
| `js/sounds/interacoesSerra.test.mjs` | 1 | Módulo legado passa a carregar `walk_robo_serra.mp3`, áudio existente da serra, em vez de um arquivo ausente. Não foi ativado um novo som de ataque no fluxo atual. |
| `js/systems/Upgrades.test.mjs` | 3 | Fixture com atualizador responsivo e contagem de chamadas; expectativas alinhadas à paginação atual e à faixa de profundidade pelos pés. |
| `js/ui/MiniMap.test.mjs` | 1 | Fixture passou a fornecer `scene.game.canvas`, mantendo a verificação do atlas, atualização e limpeza. |

## Validação adicional das correções

- `tests/spawns-seguros.browser.mjs`: aprovado com sprites e corpos Arcade reais
  nas 7 zonas da cidade, 18 áreas da fábrica, portais e limites do mapa.
- `tests/upgrade-factory.browser.mjs`: aprovado; compras, níveis e saldo
  preservados entre cidade e fábrica, HUD oculto durante o boss e restaurado
  depois, sem duplicar o menu ao retornar à cidade.
- A bateria unitária completa foi repetida após todas as correções, com os
  mesmos processos separados por arquivo: 1.474 aprovados, nenhum reprovado.

## Artefatos e limites

Logs individuais e resumos JSON: `/tmp/nullborns-bug-audit/`.
Logs das correções e da bateria final: `/tmp/nullborns-bug-fixes/`.
Relatórios da campanha e das torres: subdiretórios `campaign/` e `tower/`.
Capturas da abertura: `/tmp/cutscene-opening/`.

Não foram executados todos os roteiros de navegador do projeto. Esta revisão
cobre os fluxos recentes acima e a bateria unitária completa. Toque foi
emulado no Chromium; celular físico e conexões MQTT externas não foram testados.
