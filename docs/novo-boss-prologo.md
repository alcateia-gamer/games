# Prólogo dos quatro geradores

Revisão mais recente: [ajustes de recarga, portais, clones, ataques e cadáver](boss-revisao-combate.md).

**Atualização dos portais e colisões:** os portais agora usam os sete quadros do
GIF original `Tilesets/mechanics/portal.gif`, preservando transparência e duração
(100/100/100/100/100/100/200 ms). Foram gerados apenas uma spritesheet e um
manifesto em `derivados/portal/`; o GIF original permanece intacto. Sempre há um
portal em cada lateral, inclusive no fallback. Pontos centrais não são aceitos.

Os Robôs Bola receberam uma proteção varrida após cada passo da física, cobrindo
paredes finas, recuo, empurrões e frames longos. As unidades da onda também ficam
limitadas à arena. O escudo ativo bloqueia jogador, robôs e companheiro, inclusive
unidades criadas depois da ativação. Encostar nele não desliga mais a colisão.
Quando os geradores terminam de descer, o quadro original da tampa fechada fica
visível sob os atores, sem colisão nem seleção como alvo.

Arquivos desta atualização: `NovoBossPortais.js`, `NovoBossAssets.js`,
`NovoBossTorres.js`, `NovoBossGeradores.js`, `RoboBola.js`;
novos módulos `NovoBossBarreiraColisao.js` e `js/enemies/RoboBolaColisao.js`;
script `scripts/preparar-portal-boss.py`; spritesheet/manifesto em
`assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/portal/`;
testes `RoboBolaColisao.test.mjs`, `NovoBossGeradores.test.mjs`,
`NovoBossPrologo.test.mjs` e `tests/novo-boss-portais-colisoes.browser.mjs`.
As alterações anteriores do workspace foram preservadas.

Validação específica: 332 casos em 31 arquivos pertinentes passaram. O teste
integrado novo verificou as tampas e a animação, cinco cenários de paredes/quinas
com impulsos de 1.600 px/s em passos de 250 ms, 32 aproximações ao escudo
(quatro tipos de atores em oito direções), passagem com escudo desligado e
2.400 passos com IA real. A simulação prolongada teve zero violações de paredes
ou limites e zero desalinhamento entre sprite e corpo. Saída e reinício também
passaram. Prévia e relatório: `/tmp/boss-portais-colisoes/`.
Os quatro ciclos completos também foram reexecutados e passaram (86 verificações).
A suíte geral atual soma 872 casos em 79 arquivos: 862 passaram e permanecem as
10 falhas preexistentes nos três arquivos de iluminação/colisões citados no
registro original. `git diff --check` passou; o GIF original, os mapas e os
arquivos do boss antigo não foram alterados nesta atualização.

O registro abaixo descreve a entrega inicial do prólogo; as referências ao
portal Graphics correspondem à versão anterior, substituída nesta atualização.

Implementação no encontro existente de `Level1Parte2`, em `js/enemies/novoBoss/`.
O encontro é o boss principal. O código e os recursos exclusivos do boss anterior
foram removidos; veja a [migração definitiva](boss-principal.md).

## Sequência integrada

A apresentação original invoca as quatro torres e forma o escudo. Quando termina,
o controlador recolhe as torres invertendo os quadros de `summon`, abre dois portais
e inicia uma onda finita de Robôs Bola. A IA, vida, animações, tiros pelo olho,
colisões e morte dos robôs são as mesmas dos inimigos existentes.

| Ciclo | Robôs totais | Limite vivo | Padrões do boss |
| --- | ---: | ---: | --- |
| 1 | 4 | 2 | Espiral reduzida |
| 2 | 5 | 3 | Espiral e anéis abertos |
| 3 | 6 | 3 | Anéis e rajadas |
| 4 | 6 | 4 | Alternância entre os três |

Os portais abrem em 650 ms, seguidos de 1.500 ms de preparação. Os robôs são
invocados alternadamente, separados por 950 ms, com proteção inicial de 1.000 ms
contra movimento/disparo instantâneo. A reposição espera pelo menos 700 ms após
a morte observada. Nunca se excede o limite simultâneo ou o total da onda.

O boss executa somente um padrão por vez, com 1.800 ms entre execuções. Os lasers
usam o GIF energético e a implementação existente de colisão varrida, reflexão,
dano e defesas especiais. A espiral tem 18 disparos; os anéis deixam uma abertura
de 120 graus; as rajadas anunciam sua direção e deixam corredores laterais.
Velocidade inicial dos lasers: 115 px/s. A configuração fica em
`NovoBossConfig.js`, propriedade `prologo`.

Somente depois de todos os robôs invocados morrerem, os portais fecham e as
torres sobreviventes sobem. Não há cronômetro para atacar os geradores. Sua vida
inicial continua em 120 e não é restaurada entre ciclos.

Destruir uma torre bloqueia imediatamente novos danos às demais e inicia sua
descida. Impactos de área são resolvidos por ID: o dano não fatal dos
sobreviventes é aplicado e apenas uma torre pode morrer. A vida de uma segunda
torre que também receberia dano fatal é limitada a 1 nesse impacto simultâneo.

Nos três primeiros ciclos, o escudo falha visualmente e sua proteção física e
lógica é desligada. Depois do recolhimento, abre uma janela sem limite de tempo
para **dois impactos distintos**. Cada golpe/projétil fornece sua identidade;
repetições do mesmo ataque não consomem a segunda oportunidade. Há também um
intervalo mínimo configurável de 180 ms entre impactos aceitos.

Após o segundo impacto, o escudo recarrega. Sua colisão só volta quando a região
estiver livre: o jogador pode sair normalmente, sem ser teletransportado ou preso.
O HUD informa quando é preciso se afastar. Então começa a próxima onda.

O quarto gerador causa o colapso definitivo. Não existe quinta onda ou outra
janela de dois golpes: após a transição curta, voltam os ataques, movimentação,
teleporte, ilusões, clones e fases da luta principal. A vida restante é preservada.
Se estiver abaixo de 50%, a fase 2 é avaliada na transição, antes de iniciar suas
ondas normais de clones.

Para impedir uma morte antes dos quatro geradores, o prólogo mantém pelo menos
1 HP e guarda todo dano excedente. Esse crédito é aplicado junto ao primeiro
golpe válido da luta principal. Nenhum dano legítimo é descartado.

## Estados, colisões e encerramento

`NovoBossPrologo.js` controla os oito estados em um único relógio:
`PORTAIS_ABRINDO`, `ONDA_ROBOS`, `GERADORES_SUBINDO`, `GERADORES_EXPOSTOS`,
`GERADORES_DESCENDO`, `BOSS_VULNERAVEL`, `ESCUDO_RECARREGANDO`, `COMBATE_PRINCIPAL`.
Não há timers de spawn ou de transição espalhados pela cena.

Cada torre possui os estados subterrâneo, emergindo, exposto, recolhendo e
destruído, mantendo posição, origem, escala e profundidade da arte existente.
Somente os quatro corpos específicos do Tiled mudam de estado:

| Objeto `TorreBoss` | Objeto `collision` |
| --- | --- |
| 1593 | 1598 |
| 1594 | 1599 |
| 1596 | 1600 |
| 1597 | 1601 |

Recolher desliga o corpo correspondente e invalida o cache de navegação. Subir
espera a animação terminar e a base ficar livre antes de restaurar a colisão.
Enquanto a torre está exposta, armas atingem sua hitbox em vez de serem barradas
pela própria base invisível. A base continua bloqueando movimento. As outras
colisões do mapa não são alteradas.

Seis posições candidatas são calculadas dos limites da arena, entre as bases das
torres. A seleção valida obstáculos, folga de circulação, boss, geradores,
jogador, entidades e distância entre portais. Um fallback em grade usa os mesmos
critérios. Sem dois pontos seguros, aguarda e tenta novamente; não relaxa a
segurança. O spawn também revalida o local imediatamente antes de criar o robô.

Robôs e lasers recebem identificação do encontro e da onda. A transição remove
somente projéteis próprios. Morte, saída ou reinício encerram portais, padrões e
robôs do prólogo. Reentrar reinicia uma onda interrompida, preservando torres
destruídas e danos; reiniciar a cena cria um encontro novo. O multiplayer continua
sem instanciar o encontro solo.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `js/enemies/novoBoss/NovoBossPrologo.js` | Máquina de estados, ondas, janelas, dano adiado e limpeza. |
| `js/enemies/novoBoss/NovoBossPortais.js` | Seleção segura, fallback, spawn validado e efeitos Graphics reutilizáveis. |
| `js/enemies/novoBoss/NovoBossPadroesPrologo.js` | Formações e avisos usando o laser existente. |
| `js/enemies/novoBoss/NovoBossColisoesTorres.js` | Controle individual dos corpos Tiled e verificação de ocupação. |
| `js/enemies/novoBoss/NovoBossPrologo.test.mjs` | Geometria do mapa real, colisões, posicionamento e impactos simultâneos. |
| `tests/novo-boss-prologo.browser.mjs` | Sequência completa, física Arcade, limites, vida, fase 2 e encerramentos. |
| `tests/novo-boss-prologo-personagens.browser.mjs` | Toque real, ataques dos quatro personagens, especial de Magnus e dano excedente. |
| `docs/novo-boss-prologo.md` | Este relatório. |

## Arquivos modificados

| Arquivos | Alteração |
| --- | --- |
| `BossPrincipal.js`, `NovoBossEstados.js` | Integração do controlador, ciclo de vida e roteamento do dano. |
| `NovoBossConfig.js` | Valores ajustáveis do prólogo. |
| `NovoBossTorres.js`, `NovoBossGeradores.js` | Recolhimento/subida, seleção de alvos, escudo e colisões seguras. |
| `NovoBossAtaques.js`, `NovoBossFases.js`, `NovoBossTeleporte.js` | Bloqueio temporário da IA principal durante o prólogo. |
| `NovoBossApresentacao.js` | Boss permanece parado durante as janelas do prólogo, sem recuo acumulado. |
| `NovoBossHud.js` | Indicadores discretos vinculados aos estados reais. |
| `NovoBossServicosAtaques.js` | Identidade dos lasers refletidos no roteamento de dano. |
| `ataques/LasersEspiral.js`, `ataques/LasersEspiral.test.mjs` | Agenda opcional de emissões para anéis/rajadas e sua validação. |
| `js/enemies/RoboBola.js`, `js/enemies/RoboBola.test.mjs` | Spawn explícito opcional, proteção inicial, expiração cancelável e grupo válido após reinício. |
| `js/map/ColisoesMapa.js` | Identificação do objeto Tiled nos corpos, sem mudar sua geometria. |
| `js/enemies/EnemyPathfinding.js` | Exceção opcional de linha de visão para a própria base da torre atingida. |
| `js/combat/CombatTargets.js` | Identidade dos impactos e resolução determinística de dano em área. |
| `js/combat/PlayerSpecialAbilities.js` | Identidade de especiais/reflexões e impacto de Magnus contra torres. |
| `js/player/ArrowCollision.js` | Flechas e lâminas atingem a torre exposta sem bater antes na própria base. |
| `js/player/Player.js`, `PlayerProjectiles.js` | Encaminhamento da identidade do golpe/projétil, sem alterar dano, alcance, cadência ou recursos. |
| `docs/novo-boss-desenvolvimento.md` | Referência ao checklist e à entrega do prólogo. |

Os nomes `NovoBoss*` da tabela ficam em `js/enemies/novoBoss/`. Nenhum arquivo foi
excluído ou renomeado. Sprites, GIFs, mapas originais, sons, o boss antigo e os
controles touchscreen foram preservados. Não houve commit ou reset do Git.

## Checklist e validação executada

- [x] Análise do repositório, Git, mapa Tiled, IA, combate, apresentação e testes.
- [x] Torres com estados explícitos, animação reversa, vida persistente e colisões individuais.
- [x] Dois portais seguros e quatro ondas finitas com limites e reposição.
- [x] Três padrões próprios, avisos e colisão/defesa compartilhadas.
- [x] Exposição sem tempo limite, uma morte por ciclo e dois impactos distintos.
- [x] Recarga sem prender entidades e colapso definitivo no quarto gerador.
- [x] IA principal e fase 2 retomadas com vida preservada; dano excedente conservado.
- [x] Saída, reentrada, morte, reinício e exclusão do modo multiplayer.
- [x] Ataques reais dos quatro personagens em viewport mobile, incluindo flecha e especial.
- [x] Apresentação original com câmera, iluminação, torres, escudo e portas.

Resultados:

- Suite Node: **866 casos em 78 arquivos; 856 passaram e 10 falharam**. Os três
  arquivos com falhas já falhavam antes da implementação:
  `js/effects/FactoryLighting.test.mjs`, `js/map/ColisoesMapa.test.mjs` e
  `js/player/colisoes/PlayerCollisionConfig.test.mjs`. Nenhum arquivo passou a
  falhar por causa desta entrega.
- `novo-boss-prologo.browser.mjs`: quatro ciclos com 4/5/6/6 mortes reais;
  limites simultâneos atingidos e respeitados: 2/3/3/4. Verificação da travessia
  física das bases subterrâneas e bloqueio das expostas, preservação de vida,
  dano em área, dois impactos, deduplicação, recarga segura e limpeza. Transição
  com 400 HP para a fase 2, sem reinicialização, seguida dos nove clones normais.
- `novo-boss-prologo-personagens.browser.mjs`: **passou**. Kai, Magnus, Aria e Nyx
  atacaram por toque real em uma tela de 844×390. Cada golpe normal retirou
  25 HP da torre e do boss, contabilizando um impacto. O especial de Magnus
  retirou os 8 HP previstos. Também passou o percurso restante até o colapso com
  dano excedente, seguido de derrota no primeiro golpe principal.
- `novo-boss-introducao-luzes.browser.mjs`: **passou**, com a apresentação original
  e reinício completos, sem erros JavaScript ou de assets.
- `novo-boss-ajustes-finais.browser.mjs`: falha em “Perdeu abertura de aproximação”.
  A mesma falha foi reproduzida servindo os arquivos originais do **HEAD**, sem
  modificar o workspace. Esse roteiro antigo começa a atacar sem aguardar a
  introdução e ainda contém expectativas antigas de invulnerabilidade dos clones.
  Ele foi preservado; os roteiros novos validam as regras atuais do prólogo.
- `git diff --check`: passou.

Prévia e relatórios dos testes novos: `/tmp/novo-boss-prologo/`, incluindo os
estados de portais, torres expostas, recarga e combate principal. As composições
foram inspecionadas visualmente.

Para repetir os roteiros, sirva a raiz com `python3 -m http.server 8765`, instale
Playwright fora do projeto e execute os arquivos `tests/novo-boss-prologo*.browser.mjs`.
O helper aceita `BASE_URL`, `PLAYWRIGHT_MODULE` e `CHROMIUM_PATH`.

Os testes de navegador usam Chromium/WebGL com SwiftShader. Não houve medição de
FPS em aparelho físico; os valores de densidade e velocidade são o balanceamento
inicial configurável. Os portais usam os quadros derivados do GIF original,
preservado no repositório. As falhas preexistentes descritas acima permanecem fora do escopo.

## Ajuste de portais e áreas de Robô Bola no mapa 2

- [x] Portal esquerdo espelhado; direito conserva a orientação original.
- [x] Robô nasce no centro do portal e emerge gradualmente para dentro da arena
  durante 600 ms, com deslocamento físico de aproximadamente 48 px e aparição
  progressiva. A hitbox conserva o tamanho original; a IA aguarda a saída.
  Se o centro estiver ocupado, a invocação espera em vez de aparecer ao lado.
- [x] Leitura das 18 áreas da camada `SpawnRoboBola`, sem editar o JSON do usuário.
- [x] Ativação apenas com o gerador ligado e jogador a até **180 px da borda**
  do retângulo, inclusive do lado de fora. Não precisa entrar no retângulo.
- [x] Uma onda por área por visita à cena. Quantidade:
  `min(7, max(1, ceil(largura × altura / 40000)))`; intervalo de 450 ms entre
  invocações. Reaproximar-se não reinicia uma onda já concluída.
- [x] Corpo inteiro dentro da área, em piso desenhado, sem sobrepor paredes,
  jogador ou outros inimigos. Obstáculos internos são contornados escolhendo
  outros pontos do mesmo retângulo. Quando não há espaço, aguarda e tenta de
  novo; áreas pequenas podem concluir depois que o jogador se afasta.
- [x] Somente o host cria inimigos em cooperação; aproximação de aliados remotos
  também é considerada. Morte e saída da cena interrompem futuras invocações.

Arquivos desta alteração: `RoboBolaSpawnAreas.js` e seu teste (leitura, proximidade,
quantidades e posições seguras), `RoboBolaEmergencia.js` e seu teste (saída física),
`RoboBola.js` (animação e espera inicial), `NovoBossPortais.js` (espelho e corredor
de saída), `NovoBossPrologo.js` (invocação central) e `Level1Parte2.js` (integração
do controlador de áreas). O mapa e todos os assets originais foram preservados.

Validação deste ajuste: **370 testes em 36 arquivos passaram**, incluindo IA,
colisões, prólogo e contorno do mapa. O roteiro
`tests/robo-bola-portais-areas.browser.mjs` passou no Phaser real: portal espelhado,
aparição e deslocamento físico sem atravessar paredes, bloqueio antes do gerador,
ativação fora da área e todas as 18 áreas completando as quantidades previstas,
sempre com piso, sem colisão e dentro dos limites. Relatório e prévias:
`/tmp/robo-bola-portais-areas/`.

O roteiro `tests/novo-boss-prologo.browser.mjs` também passou novamente nos quatro
ciclos, com limites simultâneos de 2/3/3/4 e conclusão das ondas de 4/5/6/6.
Sua simulação das ondas agora executa a IA e a física dos robôs, além do relógio
do encontro: congelá-los no centro do portal impediria validar a reposição central.

### Limite conjunto próximo de (-1067, -4478)

Os retângulos `1625`, `1629` e `1630` compartilham um orçamento máximo de **7
robôs por visita**, em vez de somar as antigas quantidades de 5 + 4 + 7.
A distribuição proporcional atual é **2 + 2 + 3**. O controlador calcula essas
cotas antes de invocar; mudar de retângulo ou derrotar os inimigos não libera
spawns adicionais nessa região. As demais áreas continuam com seus limites
individuais. A configuração fica em `CONFIG_SPAWN_ROBO_BOLA.limitesRegionais`,
sem modificar o mapa do usuário.

O teste de regressão em `RoboBolaSpawnAreas.test.mjs` percorre os retângulos,
confirma sete invocações no total, preservação da quantidade vizinha e ausência
de reposição após as mortes. O roteiro de navegador também verifica o total
conjunto após percorrer as 18 áreas reais.
