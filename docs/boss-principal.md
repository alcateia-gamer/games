# Boss principal da fábrica

O encontro que usava a arte `Boss-test` é o único boss da fábrica, no solo e no
multiplayer. As fases, prólogo, torres, clones, ataques, iluminação e regras de
dano continuam usando o mesmo encontro.

## Atalho DEV: segunda fase com 1 HP

Com **DEV ligado**, pressione **M** dentro da arena para colocar o boss na segunda
fase com **1 de vida**. O atalho encerra as ondas/portais do prólogo, recolhe e desativa
os geradores e retira o escudo. A transição usa o sistema de fases existente, mantendo
o boss vivo para testar o combate e acertar o golpe final. Usar M novamente mantém
1 HP, sem repetir a transição. Menus, introdução e transições bloqueiam o atalho.
No cooperativo, o host valida o DEV e a posição do solicitante antes de aplicar a mudança.

O percurso de teste pode chegar ao boss sem passar pelo primeiro puzzle. Ao usar M,
o host registra também a liberação obrigatória da fábrica (`factoryHackingComplete`),
preservando os pré-requisitos da saída e do terminal final. Isso vale somente para
o atalho DEV: os bônus opcionais e a conclusão da MATRIX continuam separados.
A saída permanece fechada enquanto o boss estiver vivo e pode ser aberta normalmente
após o golpe fatal, inclusive quando a luta começou pelo teleporte DEV.

Implementação: `js/controls/DeveloperBoss.js`, registrada por `PlayerInput.js`.
Os testes cobrem autorização, fase real, fim do prólogo sem recriação de ondas,
repetição do atalho e morte normal somente após o próximo golpe válido.
Regressão da saída: verificado o percurso M → fase 2/1 HP → golpe fatal → abertura
da porta05 com remoção da colisão. A liberação também foi verificada no fluxo de
progresso host/cliente. A suíte de portas conserva uma falha anterior de coordenadas
da colisão no Tiled; a nova regressão passa.

## Estrutura e migração

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
