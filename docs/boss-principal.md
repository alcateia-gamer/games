# Boss principal da fábrica

O encontro que usava a arte `Boss-test` é o único boss da fábrica, no solo e no
multiplayer. As fases, prólogo, torres, clones, ataques, iluminação e regras de
dano continuam usando o mesmo encontro.

- Entrada: `js/enemies/BossPrincipal.js`, com `prepararBoss`, `atualizarBoss` e
  `destruirBoss`. A cena e a autoridade do multiplayer usam essa entrada.
- Subsistemas e configurações: `js/enemies/novoBoss/`. Os identificadores internos
  `scene.novoBoss`, as chaves de textura e os eventos foram mantidos para preservar
  as integrações de combate e rede.
- Arte: `assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/`, com os sprites
  `boss-idle.png` e `boss-ataque.png`. Os scripts de preparação usam a mesma pasta.
- Armas, flechas, mira automática e especiais atingem o encontro por
  `CombatTargets.js`; não importam implementação de outro boss.

Foram removidos `js/enemies/BossFinal.js`, `js/enemies/bossFinal/`, seus testes
exclusivos, `js/sounds/bossRaio.js`, a pasta de sprites `BOSS_FINAL` e os três
áudios exclusivos de raio/soco. O preloader não enfileira esses recursos nem
prepara a antiga folha de raios em memória. Os sons dos robôs continuam ativos.

O tileset não utilizado `EnergiaBoss` saiu do registro, da fila do preloader e
do mapa da fábrica, junto com sua imagem. Seus GIDs não eram usados no mapa.
As zonas, portas, colisões, luzes e decoração da arena foram preservadas.

`tests/novo-boss.browser.mjs` verifica o carregamento dos recursos atuais,
a criação única do boss ao entrar na arena, suspensão na morte, reinício e
nenhuma requisição de código, imagem ou áudio exclusivo do boss anterior.

Validação da migração: 417 testes unitários passaram. No Chromium, passaram o
ciclo de entrada/morte/reinício, o prólogo completo dos quatro geradores e a sessão
com dois jogadores, incluindo apresentação do boss e dano do cliente replicado
pelo host. Não houve requisições de recursos exclusivos do boss anterior.

A troca para a arena no teste cooperativo revelou uma réplica de robô colocando
um retângulo geométrico em `GameObject.body`. Essa geometria agora fica em
`coopBody`, preservando a ordenação pelos pés e permitindo que o Phaser destrua
as réplicas corretamente ao mudar de mapa.
