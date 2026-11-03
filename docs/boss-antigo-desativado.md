# Boss antigo desativado

O boss antigo deixou de ser criado e atualizado na fábrica. Sua implementação e seus
recursos permanecem no repositório. Nenhum arquivo foi excluído ou renomeado.

## Alteração no funcionamento

Somente [Level1Parte2.js](../js/scenes/Level1Parte2.js) teve código de produção alterado:

- A cena deixou de importar e chamar `prepararIABoss(this)` no `create()`.
- A cena deixou de importar e chamar `atualizarIABoss(this, delta)` no `update()`.
- O `create()` usa a função original `localizarPecasBoss`, de
  [BossConfig.js](../js/enemies/bossFinal/BossConfig.js), para ocultar as peças visuais
  do boss. Caso tenham corpo físico, ele fica desabilitado. Os objetos continuam
  existentes e os dados do mapa não são alterados.
- No mapa atual, essas peças são os objetos **222–227** da camada `ObjetosBoss`.
  Os outros 28 objetos dessa camada são decoração da arena e foram preservados.

Sem `prepararIABoss`, não é registrado o gatilho `POST_UPDATE` de entrada na arena.
Assim, entrar, sair ou reaparecer nessa sala não chama `vincularIABoss` nem
`criarBoss`. Não são criados sprite animado, IA, hitboxes, HUD, controle de estamina,
controle de zoom da arena, monitores sonoros ou efeitos de rachadura e eletricidade.
Sem a chamada de atualização, a cena também não executa ataques, cura, laser ou
processamento de combate do boss por quadro.

Os listeners específicos de combate e dos efeitos não são registrados. As referências
a `boss:ataque-iniciado`, `boss:ataque-frame`, `boss:ataque-finalizado`,
`boss:ataque-raio-anunciado`, `boss:laser-disparado`, `boss:acertou-jogador`,
`boss:vida-alterada` e `boss:derrotado` continuam preservadas nos módulos antigos,
sem um boss em execução para produzi-los.

## Implementação preservada sem alterações

| Arquivo | Implementação preservada |
| --- | --- |
| `js/enemies/BossFinal.js` | API pública e reexportações. |
| `js/enemies/bossFinal/BossFinal.js` | Integração, `prepararIABoss`, `vincularIABoss` e API de combate. |
| `js/enemies/bossFinal/BossFinalCore.js` | Criação, atualização, estamina, câmera, solicitação de ataques e limpeza. |
| `js/enemies/bossFinal/BossEntrada.js` | Gatilho de entrada e restauração das peças para criação do boss. |
| `js/enemies/bossFinal/BossConfig.js` | Configurações, geometria, eventos e seleção das peças do mapa. A seleção continua sendo usada apenas para ocultá-las. |
| `js/enemies/bossFinal/BossIA.js` | Escolha de ataques, observação e previsão do jogador. |
| `js/enemies/bossFinal/BossAnimacoes.js` | Animações e callbacks de frames, impactos, cura e laser. |
| `js/enemies/bossFinal/BossHitboxes.js` | Colisões, zonas ofensivas e vulneráveis. |
| `js/enemies/bossFinal/BossCombate.js` | Dano, cura, ataques do jogador e derrota. |
| `js/enemies/bossFinal/BossHud.js` | Barras de vida e estamina. |
| `js/enemies/bossFinal/BossRaioZonas.js` | Zonas elétricas, efeitos, máscaras e dano. |
| `js/enemies/bossFinal/BossChaoQuebrado.js` | Eventos de impacto, carregamento e desenho das rachaduras. |
| `js/sounds/bossRaio.js` | Reprodução, monitoramento e limpeza do som elétrico. |
| `js/sounds/inimigos.js` | Sons compartilhados dos robôs e sons e listeners do soco do boss. |

Os testes antigos `BossEntrada.test.mjs` e `BossHud.test.mjs` também foram mantidos.
Continuam testando a implementação arquivada, sem ativá-la no jogo.

## Recursos e referências preservados

- `assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/`: todos os sprites, folhas
  de animação, barras, raios e imagens de chão, incluindo os recursos alternativos.
- `assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/`: recursos locais de teste,
  sem alterações.
- `js/sounds/SOUNDS_INIMIGOS.js/`: `raio_boss.mp3`, `soco_boss_1.mp3`,
  `soco_boss_2.mp3` e os demais áudios.
- `Tilesets/extras/EnergiaBoss.png` e `assets/map/parte2-fase1.json`: tileset,
  camada `ObjetosBoss`, objetos, colisões e restante da sala intactos em disco.
- `js/scenes/preloader.js`: carregamento dos recursos `boss-*` e `energiaBoss`,
  além de `prepararNovoRaioBase`. Carregar texturas não instancia nem ativa o boss.
- `js/map/Tilesets.js`, `js/map/ObjetosMapa.js`, `js/map/ProfundidadeMapa.js` e
  `js/ui/MiniMapData.js`: referências ao tileset, criação de objetos, profundidade e
  geometria do cenário no minimapa. A construção do mapa e os sistemas compartilhados
  continuam funcionando.
- `js/combat/PlayerSpecialAbilities.js`, `js/player/Player.js` e
  `js/player/PlayerProjectiles.js`: referências opcionais a `scene.bossFinal` e
  `causarDanoBoss`. Sem instância ativa, esses ramos não são executados; dano,
  projéteis e habilidades contra os outros inimigos permanecem iguais.
- `js/player/ArmaPersonagemTeste.js`, `js/player/EspadaPersonagemTeste.js` e
  `js/player/FloretePersonagemTeste.js`: integrações opcionais de dano ao boss
  preservadas junto ao trabalho local dos personagens de teste.
- `js/combat/PlayerHitEffects.test.mjs`, `js/controls/AriaAttackJoystick.test.mjs`,
  `js/player/ArmaPersonagemTeste.test.mjs` e `tests/aria-controls.browser.mjs`:
  referências de teste ao dano do boss preservadas.
- Documentação anterior em `README.md`, `docs/GUIA_CODIGO.md`,
  `docs/aria-attack-joystick.md`, `docs/personagem-teste.md`, `Mapas/ map.md` e
  `assets/PERSONAGENS/INIMIGOS PRINCIPAIS/ descrição.md` preservada.

Não foram alterados robôs, personagens, armas, controles, inventário, gerador,
porta, iluminação, multiplayer, minimapa, transições ou arquivos de mapa.
As alterações locais que já existiam antes desta tarefa foram preservadas.

## Verificação

- Sintaxe da cena e `git diff --check`: aprovados.
- Ciclo simulado de `create()`/`update()` da cena, com dados reais do mapa e a
  seleção original de peças: aprovado em quatro combinações de solo/multiplayer e
  início dentro/fora da arena, com 600 quadros em cada combinação. Verificados
  entrada e saída da arena, ausência de boss e listeners de combate, seis peças
  ocultas sem exclusão, decoração preservada, câmera normal, atualizações dos
  serviços compartilhados e transição de retorno à cidade.
- Executados os 27 arquivos `*.test.mjs` em `js/`: 23 passaram e quatro falharam
  em código não alterado por esta tarefa: `TerrorLighting.test.mjs` (mock sem
  `game.renderer`), `FactoryDoor.test.mjs` (mock sem `textures.getFrame`),
  `ColisoesMapa.test.mjs` (limites e formas de colisão) e
  `PlayerCollisionConfig.test.mjs` (dimensões esperadas dos personagens).
- O ciclo simulado não substitui uma verificação visual no navegador; não havia
  navegador instalado no ambiente.
