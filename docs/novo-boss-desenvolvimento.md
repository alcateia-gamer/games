# Desenvolvimento do novo boss

Especificação principal:
`assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/Especificacao_Mestre_Novo_Boss.md`.
A ordem abaixo segue as oito etapas solicitadas pelo desenvolvedor.

**Refinamento de combate solicitado após os playtests:** concluído. Os itens
1–9 e os ajustes finais de aberturas e mobilidade da segunda fase estão
implementados e testados. O checklist original registra a entrega anterior;
veja o [checklist do refinamento](#refinamento-do-combate-uma-parte-por-vez)
e o registro dos ajustes finais ao fim deste documento.

## Checklist

- [x] Análise do repositório, especificação, ZIP e sprites.
- [x] **1. Estrutura principal e integração:** entidade própria na fábrica,
  carregamento dos recursos, animação idle, criação ao entrar na arena e limpeza.
- [x] **2. Vida, estados e teletransporte:** dano das armas e habilidades, HUD,
  vulnerabilidade, derrota e quatro destinos válidos.
- [x] **3. Ataques individuais:** pulso com repulsão, chuva de raios com Heavens
  Fury, lasers em espiral e tentáculos com agarrão de 2–3 segundos.
- [x] **4. Geradores e barreira:** entidades e estado independentes do gerador
  de iluminação da fábrica, conforme as regras de design que forem definidas.
- [x] **5. Ilusões e clones:** quatro aparições com uma verdadeira e sistema
  configurável de 8–10 clones móveis.
- [x] **6. Segunda fase:** transição abaixo de 50% de vida, verdadeira em movimento
  entre os clones e coordenação dos ataques.
- [x] **7. Animações e efeitos visuais:** refinamento de poses, transições,
  teletransporte, barreira, clones, impactos e derrota.
- [x] **8. Integração final, balanceamento e testes:** luta completa, combinações
  aprovadas, desempenho, regressão e escopo de multiplayer confirmado.

**As oito etapas do escopo solo estão concluídas, integradas e testadas.**
A entrega cobre as mecânicas obrigatórias e as decisões confirmadas. Os registros
abaixo descrevem cada etapa; o [resultado final](#resultado-da-luta-completa) e a
[lista de arquivos](#arquivos-da-entrega) consolidam a versão atual.

Validação final: **155 casos da nova boss passaram em 15 arquivos de testes**,
e os **oito roteiros Chromium** da entrega inicial foram validados. A atualização
dos GIFs acrescenta um roteiro próprio e repetiu geradores e luta completa.
A auditoria geral anterior registrou 37 de 41 arquivos passando; as quatro
falhas preexistentes estão documentadas na etapa 8. Nenhum arquivo do boss antigo ou asset original foi excluído/renomeado.

## Etapa 1: comportamento integrado

- O encontro é preparado por `Level1Parte2.create()` e atualizado pelo `update()`
  da mesma cena, usando `scene.novoBoss`, separado de `scene.bossFinal` e dos robôs.
- O jogador encontra a entidade na sala do boss antigo, ao norte da fábrica.
  A criação ocorre ao entrar na área definida em `NovoBossConfig.js`; uma visita
  que já começa dentro da sala também cria a entidade imediatamente.
- A posição inicial configurada é **X −1080, Y −5810**. A etapa 2 acrescenta os
  quatro destinos, descritos abaixo.
- O corpo precisa caber na arena e estar livre dos obstáculos físicos do mapa.
- Sair e voltar à arena mantém uma única instância durante a visita à fábrica.
- A sobreposição entre boss e jogador acompanha a posição dos pés, usando a regra
  genérica da fábrica sem atravessar as camadas próximas do cenário.
- Morte ou inatividade do jogador ocultam a entidade, desabilitam seu corpo e
  pausam a animação. O encerramento da cena remove os recursos e listeners próprios.
- Na etapa 1, a apresentação ainda não iniciava ataques. O corpo continua sem
  dano por contato e sem bloquear o jogador. Câmera, iluminação, gerador da fábrica,
  porta e minimapa mantêm suas regras.
- A entrega confirmada é solo. A etapa 8 impede a instanciação do encontro no
  multiplayer e preserva os sistemas de rede existentes.

## Recursos utilizados

Os arquivos de origem permanecem intactos; os recortes são feitos pelo Phaser:

| Arquivo | Chave própria | Recorte |
| --- | --- | --- |
| `Boss-test/boss-test-idle.png` | `novo-boss-idle` | 16 quadros de 288×288, idle em repetição. |
| `Boss-test/boss-test-attack.png` | `novo-boss-ataque` | 48 quadros de 336×336, ataque a 16 fps. |
| `Tilesets/mechanics/HeavensFury_preview(transparente).png` | `novo-boss-heavens-fury` | Células de 384×384, índices 0–12; chuva integrada com impacto no quadro 4. |

A chuva tem avisos vermelhos antes dos impactos. As células e o instante de
impacto foram conferidos na etapa 3 e novamente na etapa visual.
O ZIP e a especificação são referências e não precisam ser extraídos em execução.

## Arquivos da etapa 1

Criados:

- `js/enemies/novoBoss/NovoBossConfig.js`: limites da arena, posição e corpo.
- `js/enemies/novoBoss/NovoBossAssets.js`: carregamento e animação próprias.
- `js/enemies/novoBoss/NovoBoss.js`: ciclo de vida, apresentação e suspensão.
- `js/enemies/novoBoss/NovoBoss.test.mjs`: testes de regras, recursos e ciclo.
- `tests/novo-boss.browser.mjs`: teste integrado com Phaser e WebGL no Chromium.
- `docs/novo-boss-desenvolvimento.md`: este checklist e registro.

Alterados pontualmente:

- `js/scenes/preloader.js`: importa e chama `carregarAssetsNovoBoss`.
- `js/scenes/Level1Parte2.js`: importa e chama `prepararNovoBoss` e
  `atualizarNovoBoss`, mantendo a desativação do boss antigo.

Na etapa 1 não foram alterados os módulos do boss antigo, os PNGs/GIFs/ZIPs, o mapa,
as armas, os controles, o inventário ou os sistemas de outros inimigos. As
alterações locais que já existiam antes daquela etapa foram preservadas.

## Validação da etapa 1

Os **12 testes iniciais passaram**. Verificam entrada e reentrada, início dentro da
arena, obstáculos, assets ausentes, dimensões reais dos PNGs, profundidade,
suspensão na morte e limpeza idempotente.
Executar:

```sh
node js/enemies/novoBoss/NovoBoss.test.mjs
```

O teste de navegador foi executado com Chromium e Phaser reais. Verificou recursos
carregados, criação apenas ao entrar, avanço dos frames idle, hitbox própria,
ausência do boss antigo, suas seis peças ocultas, reentrada sem duplicação, morte,
reinício da cena e ausência de exceções JavaScript e erros de recursos da nova boss.
A captura dessa execução fica em `/tmp/novo-boss-etapa1.png`.

Para repetir, iniciar um servidor HTTP na raiz do projeto e fornecer Playwright e
Chromium instalados no ambiente, sem adicionar dependências ao repositório:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Em outro terminal:

```sh
PLAYWRIGHT_MODULE=/tmp/novo-boss-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/novo-boss-browsers \
node tests/novo-boss.browser.mjs
```

Também são aceitos `CHROMIUM_PATH`, `BASE_URL`, `CHROME_CDP` e
`NOVO_BOSS_SCREENSHOT`, conforme o cabeçalho do teste.

A suíte completa tem agora **28 arquivos de testes: 24 passaram e quatro falharam**.
As quatro falhas reproduzem a linha de base anterior, em código não alterado:

- `js/effects/TerrorLighting.test.mjs`: mock sem `game.renderer`.
- `js/interactions/FactoryDoor.test.mjs`: mock sem `textures.getFrame`.
- `js/map/ColisoesMapa.test.mjs`: expectativas de limites e formas de colisão.
- `js/player/colisoes/PlayerCollisionConfig.test.mjs`: expectativas de dimensões.

A etapa 1 foi verificada no navegador desktop; desempenho em celular, combate e
sincronização entre clientes continuam nas etapas correspondentes.

## Etapa 2: vida, estados e teletransporte

O corpo principal recebe os ataques existentes por um contrato próprio
(`receberDano`), sem usar vida, zonas verdes ou IA do boss antigo e sem entrar na
lista dos robôs. A ponte mantém as regras anteriores de cada arma, incluindo
varredura das flechas, paredes, dano por golpe, parry do Kai e especiais de Magnus
e Nyx. Atacar fora da abertura não reduz a vida da boss.

Os estados do encontro são `aguardando`, `posicionada`, `preparando`, `vulneravel`,
`teletransportando`, `derrotada` e `encerrada`. A preparação e a vulnerabilidade
alternam enquanto os ataques da etapa 3 ainda não foram incorporados. Um acerto
válido fecha a abertura e agenda uma troca de posição, respeitando o intervalo
mínimo entre teletransportes. O dano fatal encerra o combate e emite a derrota
uma única vez.

Uma HUD própria mostra vida e estado na parte inferior da tela, sem substituir a
HUD do jogador. Corpo, hitbox e posição acompanham a mesma entidade durante as
trocas de ponto. A apresentação de derrota nesta etapa usa pausa e transparência;
a animação final permanece na etapa 7. Não há recompensa, desbloqueio de porta ou
mudança de sala inventados como consequência da derrota.

Os parâmetros estão centralizados em `NovoBossConfig.js` e são **valores
provisórios de teste**, não decisões finais de balanceamento:

| Parâmetro | Valor inicial |
| --- | --- |
| Vida máxima | 1000, comparável aos acertos normais existentes de 25 de dano. |
| Preparação / abertura | 1500 ms / 2500 ms. |
| Intervalo mínimo de teletransporte | 2400 ms entre inícios. |
| Teletransporte preventivo | 10000 ms sem aproximação a até 180 px. |
| Desaparecer / reaparecer | 250 ms / 250 ms. |
| Reavaliação de destino indisponível | 500 ms. |

Os quatro pontos iniciais foram conferidos com as colisões do mapa real:

| Ponto | X | Y |
| --- | --- | --- |
| Centro | −1080 | −5810 |
| Esquerda | −1400 | −5770 |
| Direita | −760 | −5770 |
| Superior | −1080 | −6020 |

A escolha prefere um ponto diferente e mais distante do jogador. O corpo inteiro
deve caber na arena e ficar livre de paredes, jogador e obstáculos registrados
pelo encontro. Os destinos são revalidados durante a viagem. Sem ponto seguro,
o encontro reavalia a situação sem duplicar a boss nem habilitar uma colisão sobre
o jogador. Se o destino for ocupado durante o reaparecimento, a mesma entidade
recomeça a entrada em outro ponto livre ou recua à origem. Caso todos estejam
ocupados, permanece como uma silhueta visível, sem corpo habilitado, até haver um
destino seguro; a reavaliação ocorre a cada 500 ms.

Sair da arena ou morrer pausa o relógio do encontro. Retornar durante a mesma
visita não recupera a vida nem ressuscita uma boss derrotada. Reiniciar a cena
limpa a entidade e sua HUD e prepara uma nova visita. Nenhum timer global foi
criado para os teletransportes.

O combate é **solo**, conforme decisão confirmada pelo desenvolvedor. A etapa 8
consolidou esse isolamento: multiplayer não instancia a boss, seus ataques,
clones ou geradores. O protocolo dos robôs e os ataques dos jogadores em rede
continuam preservados.

### Arquivos da etapa 2

Criados:

- `js/enemies/novoBoss/NovoBossEstados.js` e `NovoBossTeleporte.js`.
- `js/enemies/novoBoss/NovoBossHud.js`.
- `js/enemies/novoBoss/NovoBossEstados.test.mjs`.
- `js/combat/CombatTargets.js` e `CombatTargets.test.mjs`.
- `js/combat/NovoBossPlayerDamage.test.mjs`.
- `tests/novo-boss-etapa2.browser.mjs`.

Alterados:

- `js/enemies/novoBoss/NovoBoss.js`, `NovoBossConfig.js` e `NovoBoss.test.mjs`.
- `js/player/Player.js` e `PlayerProjectiles.js`: alvos e despacho de dano.
- `js/combat/PlayerSpecialAbilities.js`: alvos e dano dos especiais.
- `js/player/ArmaPersonagemTeste.js`, `EspadaPersonagemTeste.js` e
  `FloretePersonagemTeste.js`: inclusão do alvo adicional, preservando as armas.
- `tests/novo-boss.browser.mjs`: o teste de ciclo de vida acompanha a evolução
  dos estados sem exigir que `posicionada` seja permanente.
- Este checklist.

Os arquivos do boss antigo, os recursos originais, o mapa e os sistemas de
iluminação, porta, inventário, gerador da fábrica e controles foram preservados.
As mudanças nas armas são restritas à inclusão do novo alvo e ao encaminhamento
do dano; os ramos anteriores continuam presentes.

### Validação da etapa 2

A suíte passou a ter **31 arquivos: 27 passaram e quatro reproduziram as falhas
anteriores** documentadas acima. Os testes do novo encontro cobrem regras de
estado e dano, destinos, intervalos, deltas longos, pausa, derrota e ciclo da cena.
Os testes de integração dos ataques usam os caminhos reais das armas e um contrato
substituto de dano para isolar colisões e encaminhamento.

Na versão final passaram **44 casos específicos**: 13 do controlador, 15 de
estados/teletransporte, quatro da ponte de alvos e 12 dos ataques do jogador.
Também passaram os testes de regressão pertinentes das armas, transições de
ataque, flechas e efeitos de dano.

```sh
node js/enemies/novoBoss/NovoBoss.test.mjs
node js/enemies/novoBoss/NovoBossEstados.test.mjs
node js/combat/CombatTargets.test.mjs
node js/combat/NovoBossPlayerDamage.test.mjs
```

O roteiro de navegador usa Phaser, física e mapa reais, incluindo uma flecha
real acertando a boss. Confere HUD, abertura, os quatro destinos, teletransporte
reativo e preventivo, suspensão no meio da viagem, reentrada, derrota e reinício.
Os roteiros das etapas 1 e 2 passaram completos no Chromium após as correções,
sem exceções JavaScript ou falhas de recursos do novo boss. A validação da
ocupação do destino durante o reaparecimento também tem testes de regressão.
Executar com servidor HTTP e as mesmas variáveis de ambiente da etapa 1:

```sh
PLAYWRIGHT_MODULE=/tmp/novo-boss-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/novo-boss-browsers \
node tests/novo-boss-etapa2.browser.mjs
```

A captura da etapa 2 fica em `/tmp/novo-boss-etapa2.png`. Os sistemas de combate
restantes foram incorporados e validados nas etapas 3–8, descritas a seguir.


## Regras de design confirmadas

O desenvolvedor confirmou quatro geradores desligados por interação; a barreira
só cai com os quatro desligados. A verdadeira tem núcleo pulsante. Clones
imitam os ataques sem dano e desaparecem no primeiro acerto. O agarrão dura
2,5 segundos, sem dano extra ou escape antecipado. A entrega cobre a luta solo
e preserva o multiplayer atual, sem acrescentar protocolo de combate novo.

## Etapa 3: ataques individuais — concluída e testada

Os módulos `ataques/PulsoRepulsao.js`, `ChuvaRaios.js`, `LasersEspiral.js` e
`Tentaculos.js` usam avisos vermelhos, relógios locais, cancelamento e limpeza
própria. Seus 37 testes individuais passaram. `NovoBossAtaques.js` seleciona
um ataque ofensivo por vez e abre a vulnerabilidade após a execução;
`NovoBossServicosAtaques.js` usa o dano e as defesas existentes dos personagens.
`NovoBossAvisos.js` desenha as regiões de aviso. A sequência configurável é
chuva, espiral, tentáculos e pulso; aproximar-se pode priorizar o pulso.

Heavens Fury usa o PNG fornecido, com aviso de 1000 ms e impacto no quadro 4
(400 ms após iniciar o efeito). O alvo direcionado fica fixo desde o aviso.
Os 20 lasers partem em espiral, a 145 px/s, com aviso de 700 ms, colisão varrida
e interrupção nas paredes. A lista própria de projéteis participa do parry,
da onda Magnus, do corte Nyx e do holograma Aria, sem usar o grupo dos robôs.

`PlayerControlEffects.js` mantém o agarrão separado dos bloqueios de outros
sistemas; os controles de movimento, dash, impulso do florete e troca com
holograma consultam essa restrição. Morte, saída, cancelamento e encerramento
liberam a fonte. O pulso aplica 14 de dano e repulsão; chuva, 16; laser, 10;
tentáculos, nenhum dano. Esses valores ficam em `NovoBossConfig.js`.

Arquivos ajustados na integração: `NovoBoss.js`, `NovoBossEstados.js`,
`NovoBossConfig.js`, `NovoBossHud.js`, `Level1Parte2.js` (configuração explícita
do encontro), `PlayerSpecialAbilities.js`, `PlayerMovement.js`,
`PlayerDashControls.js` e `FloretePersonagemTeste.js`. Os testes antigos usam
configurações isoladas para continuarem verificando suas etapas sem ataques.
Os desenhos de laser, onda e agarrão são efeitos temporários por código,
conforme autorização; nenhum PNG, GIF, ZIP ou arquivo antigo foi alterado.

Validação final da etapa 3: 37 testes dos ataques, seis de contenção, 13 do
controlador, 15 dos estados, 12 das armas e quatro do contrato de alvos passaram.
Os testes Chromium das etapas 1 e 2 passaram novamente.
`tests/novo-boss-etapa3.browser.mjs` passou 11 cenários reais, incluindo dano,
esquiva, PNG/quadro 4, espiral/parry, WASD/dash/troca Aria durante e após
contenção, cancelamento/saída/morte/reinício e sequência automática. Nenhum
erro JavaScript ou de recursos foi registrado. Captura: `/tmp/novo-boss-etapa3.png`.
A legibilidade foi revista na etapa 7; o fade congelado no teste foi corrigido,
sem alterar a iluminação compartilhada.


## Etapa 4: quatro geradores e barreira — concluída e testada

`NovoBossGeradores.js` e seu teste acrescentam quatro geradores exclusivos,
desativados por **E** ou pelo texto **TOQUE** próximo. Não consomem itens,
não se reativam e não alteram `FactoryGenerator.js`, energia ou inventário.
A barreira circular ciano é independente do pulso vermelho: bloqueia todo dano
ao corpo até o último gerador desligar. A HUD informa quantos ainda estão ativos.

| Gerador | X | Y |
| --- | --- | --- |
| Superior esquerdo | −1460 | −5920 |
| Superior direito | −740 | −5920 |
| Inferior esquerdo | −1450 | −5620 |
| Inferior direito | −720 | −5620 |

As posições e caminhos foram verificados no mapa real: quatro corpos de
36×36 livres e alcançáveis desde a entrada, sem ocupar os destinos da boss.
Cada gerador registra apenas seu collider e obstáculo próprios. Saída, morte,
menus, agarrão e multiplayer impedem interação; reentrar conserva os desligados.
Uma configuração inválida aguarda preparação sem criar uma barreira impossível
de derrubar. Encerramento/derrota removem somente seus recursos e listener.

Arquivos da etapa: criados `NovoBossGeradores.js` e `.test.mjs`; ajustados
`NovoBoss.js`, `NovoBossEstados.js`, `NovoBossConfig.js`, `NovoBossHud.js` e
`NovoBossEstados.test.mjs`. Os 11 testes do módulo e 16 dos estados passaram.
`tests/novo-boss-etapa4.browser.mjs` verifica teclado e clique reais.

Validação integrada da etapa 4: **oito cenários Chromium passaram**, incluindo
três desligamentos com E real, último desligamento por clique, barreira/dano,
saída/reentrada, morte/reinício e isolamento em multiplayer. Nenhum erro JS ou
de recursos. As 1291 células livres da grade de passagem permaneceram conectadas
à entrada, mesmo com os quatro corpos sólidos. Captura: `/tmp/novo-boss-etapa4.png`.
O helper `tests/novo-boss-browser-helpers.mjs` centraliza a preparação dos próximos
roteiros, sem instrumentar o código de produção.


## Etapa 5: aparições e clones — concluída e testada

`NovoBossIlusoes.js` escolhe aleatoriamente a verdadeira entre os quatro pontos
válidos e cria três alvos falsos. A verdadeira mantém a única vida do encontro
e recebe uma pista de núcleo pulsante. As demais aparições desaparecem ao
primeiro acerto positivo sem transferir dano. O teletransporte encerra as quatro
aparições; todos os corpos e pontos continuam sendo validados.

`NovoBossClones.js` libera nove clones a partir do corpo (quantidade configurável
e limitada a 8–10), com duração inicial de 18 s e velocidade de 55 px/s. O
movimento usa passos de no máximo 8 px e valida o corpo inteiro contra mapa,
geradores, arena e jogador. Os clones imitam pulso, chuva, lasers e tentáculos
com gestos/efeitos pequenos; não chamam os serviços ofensivos.

O contrato de `CombatTargets.js` reconhece os alvos ilusórios nas armas normais,
nas armas de teste, nos especiais e nos lasers refletidos. Nenhum falso entra na
lista de robôs ou recebe a implementação antiga. Sair, morrer e encerrar removem
alvos e efeitos próprios. O ciclo normal da fase 1 combina quatro aparições com
tentáculos; continua havendo apenas um ataque ofensivo por vez. A ativação
automática dos clones abaixo de metade da vida pertence à etapa 6.

Arquivos: criados `NovoBossIlusoes.js`, `NovoBossClones.js` e seus testes;
ajustados `NovoBoss.js`, `NovoBossConfig.js`, `NovoBossAtaques.js`,
`NovoBossEstados.js`, `NovoBossTeleporte.js`, `CombatTargets.js` e seu teste.
O roteiro integrado é `tests/novo-boss-etapa5.browser.mjs`.

Validação final da etapa 5: **21 testes dos módulos e cinco do contrato de alvos
passaram**. O Chromium passou **10 cenários**, verificando sorteio, quatro
aparições/uma verdadeira, pista pulsante, flechas reais contra falso e verdadeira,
nove clones e movimento, quatro imitações inofensivas, dispersão por flecha,
saída/morte/reinício e 12 s de movimento com os quatro geradores sólidos reais.
Nenhum erro JS ou de recursos. Captura: `/tmp/novo-boss-etapa5.png`.


## Etapa 6: segunda fase — concluída e testada

`NovoBossFases.js` faz uma transição única quando a vida fica **estritamente
abaixo de 50%**; 500/1000 ainda pertence à fase 1. O acerto que cruza o limiar
conserva seu teletransporte reativo, inclusive quando precisa aguardar a recarga.
Depois do reaparecimento, nove clones saem do corpo e a verdadeira se movimenta
entre eles com a mesma hitbox, respeitando paredes, geradores e jogador.
A HUD informa a fase e a preparação da onda.

A transição cancela qualquer ataque/contenção remanescente; os ataques continuam
no mesmo controlador, com aberturas de dano preservadas. Ao terminar a onda de
18 s, o retorno a um ponto fixo respeita a recarga e o ataque em andamento.
A primeira versão executa uma onda por transição, sem inventar repetição
automática, ainda listada como decisão em aberto no documento. Sair durante a
onda a encerra; retornar prepara novamente os clones, mantendo vida e fase.
Não há cura, multiplicação da vida ou dano dos falsos.

Criados `NovoBossFases.js` e `.test.mjs`; ajustados `NovoBoss.js`,
`NovoBossEstados.js`, `NovoBossConfig.js` e `NovoBossHud.js`. Os **12 testes de
fases passaram**, incluindo a corrida entre limiar e recarga do teletransporte.
O roteiro integrado é `tests/novo-boss-etapa6.browser.mjs`.

Validação integrada da etapa 6: **sete cenários Chromium passaram**, incluindo
500 vs. 475 de vida, espera da recarga de 400 ms e viagem de 500 ms antes dos
clones, verdadeira móvel/hitbox, chuva e imitações, dano por flecha real,
saída/morte/retomada, fim da onda e derrota. Nenhum erro JS ou de recursos.
Captura: `/tmp/novo-boss-etapa6.png`.

A investigação da legibilidade identificou um problema do roteiro de testes:
a pausa da cena congelava o fade de entrada de 250 ms e escurecia toda a câmera.
O helper agora aguarda o fade terminar antes de pausar; a captura da etapa 5 foi
refeita e ficou legível. A iluminação compartilhada não precisou ser alterada.


## Etapa 7: animações e efeitos — concluída e testada

`NovoBossApresentacao.js` separa pose e efeitos das regras de combate. A folha
idle usa 16 quadros; a folha de ataque usa os 48 quadros a 16 fps, uma execução
por ataque. A comparação dos pixels identificou margens de +18 px em X e
+48 px em Y na folha de ataque. Origem (162,192) e offset de corpo (106,124)
conservam o retângulo físico e a hitbox no mundo ao mudar de folha.

O núcleo pulsante foi alinhado à região real do rosto (150,120 no idle).
Os falsos imitam a pose sem criar ataques reais e usam ordenação pelos próprios
pés. Anéis violetas comunicam teletransporte; um marcador verde informa a
abertura sem barreira; dano produz flash de 180 ms; a fase 2 tem uma expansão
de 900 ms; a derrota desvanece o sprite em 900 ms. Todos são recursos próprios,
sem alteração na iluminação da fábrica ou nos arquivos de imagem fornecidos.

Criados `NovoBossApresentacao.js` e `.test.mjs`; ajustados `NovoBossAssets.js`,
`NovoBossIlusoes.js` e seu teste, `NovoBoss.js` e `NovoBossHud.js`. Os 14 testes
do módulo passaram. O roteiro é `tests/novo-boss-etapa7.browser.mjs`.

Validação final da etapa 7: **14 testes unitários e seis grupos Chromium
passaram**, incluindo avanço real dos frames, alinhamento ao trocar folhas,
Heavens Fury, imitações, flash, teletransporte, transição, derrota e limpeza.
Nenhum erro JS ou de recursos. Captura: `/tmp/novo-boss-etapa7-heavens.png`.

## Etapa 8: integração final — concluída e testada

A revisão corrigiu a instanciação local no multiplayer: a nova luta solo agora
não cria sprite, corpo, geradores ou HUD nesse modo. A mudança de solo para
multiplayer oculta e suspende a instância local; voltar ao solo a recupera sem
duplicação. O controlador vazio conserva apenas sua API de ciclo de vida.
O teste `NovoBoss.test.mjs` cobre essa transição e passou seus 14 casos.

A suíte completa foi executada: **41 arquivos, 37 passaram e quatro falharam**.
As quatro falhas são as mesmas da linha de base: `TerrorLighting.test.mjs`
(mock sem renderer), `FactoryDoor.test.mjs` (mock sem textures.getFrame),
`ColisoesMapa.test.mjs` (geometria esperada) e `PlayerCollisionConfig.test.mjs`
(dimensões esperadas). Os respectivos arquivos de produção não foram alterados
pela nova boss. O relatório desta execução está em `/tmp/novo-boss-suite-final.json`.

A conferência de preservação confirmou arquivos antigos, mapa e assets
rastreados idênticos ao Git; nenhum arquivo removido. Os PNGs, GIFs, ZIPs e sons
do snapshot da retomada também permanecem byte a byte idênticos. A luta completa
com configuração padrão e flechas reais foi validada no roteiro
`tests/novo-boss-etapa8.browser.mjs`.


### Resultado da luta completa

`tests/novo-boss-etapa8.browser.mjs` passou integralmente com **a configuração
padrão de produção**. A vida foi de 1000 a 0 por **40 impactos reais de flechas
de 25**, além de uma flecha bloqueada pela barreira. O roteiro não altera vida,
dano, velocidade, vulnerabilidade ou estado da boss; controla o posicionamento
do jogador para esquivar e avança os relógios reais dos timers/projéteis.
O jogador terminou com 100 de vida, sem cura, modo desenvolvedor ou alteração
de invulnerabilidade. O relógio simulado percorreu cerca de 270 segundos.

Foram confirmados:

- Quatro geradores: três desligados com E real e o último por clique real;
  inventário e energia da fábrica preservados.
- Quatro ataques automáticos, quatro aparições com uma verdadeira e pista
  pulsante, teletransportes preventivo e reativo.
- Fase 1 em 500 de vida; fase 2 em 475, uma única transição, nove clones,
  movimento da verdadeira e janelas de dano preservadas.
- Derrota com HUD em zero, remoção de clones, lasers, geradores, colisores e
  contenção; WASD continua funcionando.
- Sair e voltar não ressuscita a boss; reiniciar recria 1000 de vida e quatro
  geradores; o portal original leva à cidade e limpa o encontro.
- Zero erros de JavaScript, console ou recursos durante toda a luta.

O perfil de 10,31 s com nove clones e avisos registrou **13,10 FPS**, com
percentil 95 de **112 ms**, no Chromium com **SwiftShader por software**. Isso
registra o comportamento desse ambiente; desempenho com GPU e celular físicos
não foi medido. Nenhuma mudança na iluminação ou renderização compartilhada
foi feita para alterar esse resultado.

### Arquivos da entrega

Todos os módulos abaixo estão em `js/enemies/novoBoss/` e são independentes do
boss antigo:

| Arquivos | Responsabilidade |
| --- | --- |
| `NovoBoss.js` | Criação, atualização, suspensão, integração dos sistemas e limpeza. |
| `NovoBossConfig.js` | Arena, vida, janelas, posições e parâmetros de balanceamento. |
| `NovoBossAssets.js` | Carregamento e animações dos sprites fornecidos. |
| `NovoBossEstados.js`, `NovoBossTeleporte.js` | Dano, aberturas, derrota, troca e validação de destinos. |
| `NovoBossAtaques.js`, `NovoBossServicosAtaques.js`, `NovoBossAvisos.js` | Sequência ofensiva, colisões, dano/defesas e marcações. |
| `ataques/PulsoRepulsao.js`, `ataques/ChuvaRaios.js` | Repulsão e chuva com Heavens Fury. |
| `ataques/LasersEspiral.js`, `ataques/Tentaculos.js` | Projéteis em espiral e contenção por 2,5 s. |
| `NovoBossGeradores.js` | Interação, quatro geradores e barreira. |
| `NovoBossIlusoes.js`, `NovoBossClones.js`, `NovoBossFases.js` | Aparições, alvos falsos, movimento e segunda fase. |
| `NovoBossApresentacao.js`, `NovoBossHud.js` | Poses, efeitos e interface própria. |

Novas pontes compartilhadas e testes:

- `js/combat/CombatTargets.js` e `.test.mjs`: contrato dos alvos adicionais.
- `js/player/PlayerControlEffects.js` e `.test.mjs`: contenção com fonte própria.
- `js/combat/NovoBossPlayerDamage.test.mjs`: armas e especiais existentes.
- `js/enemies/novoBoss/*.test.mjs` e `ataques/*.test.mjs`: regras e ciclos.
- `tests/novo-boss.browser.mjs`, `novo-boss-etapa2.browser.mjs` até
  `novo-boss-etapa8.browser.mjs`, mais `novo-boss-browser-helpers.mjs`:
  integração no Phaser real.

Integrações alteradas pontualmente:

| Arquivo | Alteração necessária |
| --- | --- |
| `js/scenes/preloader.js` | Carrega os recursos da nova boss. |
| `js/scenes/Level1Parte2.js` | Desativa a antiga, prepara e atualiza a nova; aceita configuração explícita do encontro nos testes. |
| `js/player/Player.js`, `js/player/PlayerProjectiles.js` | Incluem os novos alvos no dano normal e nas flechas. |
| `js/player/ArmaPersonagemTeste.js`, `EspadaPersonagemTeste.js`, `FloretePersonagemTeste.js` | Reconhecem os novos alvos; o impulso do florete respeita o agarrão. |
| `js/combat/PlayerSpecialAbilities.js` | Especiais reconhecem os alvos e lasers próprios; troca com holograma respeita contenção. |
| `js/controls/PlayerMovement.js`, `PlayerDashControls.js` | Consultam a contenção somente durante o agarrão. |
| `docs/novo-boss-desenvolvimento.md` | Checklist, decisões, arquivos e validação. |

Outras alterações locais que já existiam no workspace foram preservadas.
O inventário, FactoryGenerator, FactoryDoor, mapa, robôs, câmera, minimapa e
protocolo multiplayer não receberam implementação específica da nova boss.

### Preservação e apresentação provisória

A lista completa dos arquivos e referências do boss antigo preservados e
desativados está em [boss-antigo-desativado.md](boss-antigo-desativado.md).
`prepararIABoss` e `atualizarIABoss` não são chamados pela fábrica; as seis peças
222–227 continuam no mapa e ficam ocultas em execução. Nenhum arquivo foi
excluído ou renomeado. Sprites, animações, sons, implementação antiga, ZIP,
especificação e PNGs originais foram preservados.

Idle, ataque, chuva, escudo e explosão usam os arquivos fornecidos. Laser,
agarrão, teletransporte e derrota mantêm efeitos temporários por código,
conforme autorização para as artes ainda ausentes. As regras funcionais estão
separadas da apresentação para permitir substituir esses efeitos futuramente.
Padrões de laser adicionais, repetição automática de ondas de clones e
intensificações sugeridas no documento permanecem opcionais; não substituem
nenhum requisito obrigatório implementado.


A regressão final repetiu os roteiros das etapas **1–7** após a integração
completa; todos passaram. O roteiro **8** passou integralmente, incluindo o
portal original e a limpeza no retorno à cidade. `git diff --check` não apontou
problemas. Os quatro testes gerais já falhos permaneceram com as mesmas falhas,
sem alteração dos respectivos sistemas fora do escopo.


## Atualização: GIFs de escudo e explosão

Conforme a separação confirmada pelo desenvolvedor, são animações independentes:

- `escudo-energia.gif`: **barreira de proteção**, repetindo seus cinco quadros
  originais a cada 500 ms. O círculo visível foi alinhado ao corpo, com raio de
  95 px. Acompanha o teletransporte e some quando os quatro geradores desligam.
- `ataque-explosão.gif`: **golpe em área de repulsão**, com oito quadros em
  640 ms. Nasce após o aviso de 900 ms, centrado no corpo e dimensionado ao raio
  de 145 px. O dano continua limitado aos 250 ms da expansão, uma vez por
  execução; o restante da animação é somente visual.

Os GIFs originais permanecem idênticos. `disparo-energia.gif` e `tentáculo.gif`
não foram integrados nem alterados, conforme solicitado. Heavens Fury também
foi preservado.

O Phaser utiliza os quadros completos em folhas PNG, em
`Boss-test/derivados/escudo-energia-quadros.png` e
`Boss-test/derivados/ataque-explosao-quadros.png`. Não há redimensionamento ou
recorte dos pixels de origem. `gifs-originais.json` registra SHA-256, dimensões,
quadros e durações; `scripts/preparar-gifs-novo-boss.py` permite regenerar as
folhas com Pillow. Executar com `--verificar` compara todos os pixels RGBA
extraídos e confirma o manifesto, sem gravar as fontes.

Arquivos desta atualização:

- Criados `NovoBossEfeitosEnergia.js` e `.test.mjs`, com renderização e sete testes
  de temporização, encaixe, fidelidade e limpeza.
- Alterados `NovoBossAssets.js`, `NovoBossGeradores.js`, `NovoBoss.js`,
  `NovoBossApresentacao.js`, `NovoBossServicosAtaques.js`, `NovoBossAtaques.js` e
  `ataques/PulsoRepulsao.js`: carregamento, animações independentes e limpeza.
- Atualizados `NovoBoss.test.mjs` e `tests/novo-boss-etapa4.browser.mjs` para os
  novos recursos; criado `tests/novo-boss-gifs.browser.mjs`.
- Criados o script de extração e as duas folhas PNG com seu manifesto.

Validação: os 155 casos da nova boss passaram. O teste específico dos GIFs
passou no Chromium com escudo animado, oito quadros da explosão, dano único,
teletransporte, geradores, cancelamento, saída e reinício, sem erros de JS,
console ou recursos. O roteiro dos geradores também passou novamente.
Capturas: `/tmp/novo-boss-gif-escudo.png` e `/tmp/novo-boss-gif-explosao.png`.

A luta completa foi repetida com os dois GIFs finais: **40 impactos reais de
25 levaram a boss de 1000 a 0**, mantendo as duas fases, clones, geradores,
teletransportes, movimento após a vitória, reinício e retorno à cidade. O
roteiro terminou sem erros de JS, console ou recursos. A verificação RGBA
confirmou novamente todos os quadros derivados e os quatro GIFs originais
continuaram com seus hashes inalterados. Nenhum arquivo foi excluído/renomeado.

## Refinamento do combate: uma parte por vez

Conforme a orientação mais recente, cada item será implementado e validado
separadamente. Os itens 1–9 e os dois ajustes gerais estão concluídos e validados.

- [x] **1. Direção:** verdadeira, aparições e clones olham para o jogador,
  espelhando a arte quando ele está à esquerda.
- [x] **2. Quatro aparições:** mudar a verdadeira de lugar ao criar as cópias.
- [x] **3. Animações:** sincronizar integralmente os ataques das cópias.
- [x] **4. Ataques das cópias:** reproduzir os ataques completos sem dano.
- [x] **5. Explosão:** ampliar o raio e executar a partir do centro da arena.
- [x] **6. Espiral:** executar no centro por aproximadamente 10 s, intercalando
  os disparos para cobrir os espaços entre trajetórias.
- [x] **7. Heavens Fury:** ampliar áreas, quantidade de raios e animações.
- [x] **8. Mira:** direcionar Heavens Fury para a posição do jogador.
- [x] **9. Segunda fase:** repetir ondas no centro, sincronizar as cópias e
  proteger a verdadeira por aproximadamente 2 s ao se clonar.
- [x] **Aberturas:** facilitar oportunidades de atingir a boss.
- [x] **Movimento da fase 2:** combinar deslocamentos rápidos com teleporte.

### Item 1: direção e alinhamento — concluído

O sprite usa `flipX` conforme o lado do jogador, em espera e durante os ataques.
Quando ambos têm o mesmo X, conserva a direção anterior. A folha de ataque tem
margens diferentes da folha de espera: sua origem horizontal e o offset físico
são compensados ao espelhar, mantendo a posição, o corpo e a única hitbox de dano.
A virada não reinicia a animação. O núcleo pulsante acompanha o capuz espelhado,
com a apresentação atualizada antes da pista visual no mesmo quadro.

A função de pose já é compartilhada pelas aparições e pelos clones móveis;
todos acompanham a posição do jogador. Seus comportamentos e ataques permanecem
para os itens seguintes.

Arquivos desta parte:

- `js/enemies/novoBoss/NovoBossApresentacao.js`: direção, pivô espelhado,
  compensação do corpo e posição do núcleo.
- `js/enemies/novoBoss/NovoBoss.js`: atualizar a apresentação antes do núcleo.
- `js/enemies/novoBoss/NovoBossApresentacao.test.mjs`: três novos casos de
  direção, alinhamento e continuidade da animação.
- `tests/novo-boss-direcao.browser.mjs`: novo roteiro integrado dos dois lados,
  animação de ataque, quatro aparições e nove clones móveis no Phaser real.
- `tests/novo-boss-etapa7.browser.mjs`: considerar a direção nas verificações
  geométricas do núcleo e das poses.
- `docs/novo-boss-desenvolvimento.md`: este checklist e registro.

Validação desta parte: **158 testes passaram em 15 arquivos**. O novo roteiro
Chromium passou nos quatro grupos; a regressão visual da etapa 7 também passou,
incluindo Heavens Fury, teleporte, transição de fase, derrota e reinício, sem
erros de JavaScript, console ou recursos. `git diff --check` passou.
Os 26 arquivos verificados de arte, pacote, especificação e implementação antiga
permaneceram idênticos byte a byte. Nenhum arquivo foi excluído ou renomeado.

### Item 2: troca de posição nas quatro aparições — concluído

Ao criar as quatro aparições, a verdadeira sorteia um destino seguro diferente
da posição atual. Quando já ocupa um dos quatro pontos, esse ponto recebe uma
falsa, e os outros três continuam elegíveis para a verdadeira. A exclusão usa
tolerância de 1 px, evitando tratar um deslocamento mínimo como troca de lugar.
Se estiver fora dos quatro pontos, todos os destinos seguros continuam elegíveis.

As validações de mapa, arena, jogador e geradores foram mantidas. Sem outro
destino seguro, o sistema não cria aparições nem reposiciona parcialmente a
verdadeira. A entidade, sua vida e a referência da hitbox são preservadas.

Arquivos alterados nesta parte:

- `js/enemies/novoBoss/NovoBossIlusoes.js`: excluir a posição atual do sorteio.
- `js/enemies/novoBoss/NovoBossIlusoes.test.mjs`: cobrir os quatro pontos de
  origem, os três destinos alternativos, posições próximas, execuções
  consecutivas e ausência de outro destino seguro.
- `tests/novo-boss-etapa5.browser.mjs`: verificar a troca na primeira execução
  e em 12 ataques consecutivos de ilusões pelo controlador real.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta parte.

Validação: **161 testes passaram em 15 arquivos**. O roteiro Chromium de
ilusões/clones passou, incluindo flechas reais contra falsas e verdadeira,
colisões do mapa e dos geradores, limpeza, saída e reinício, sem erros de
JavaScript ou recursos. A regressão de direção do item 1 também passou nos
quatro grupos, sem erros de JavaScript, console ou recursos. Corpo, hitbox,
núcleo e direção permanecem alinhados após as trocas. `git diff --check` passou.
Os mesmos 26 arquivos de arte, especificação, pacote e boss antigo permaneceram
idênticos byte a byte. Nenhum arquivo foi excluído ou renomeado.

### Item 3: animações de ataque sincronizadas — concluído

A pose das cópias acompanha a execução inteira do ataque da verdadeira, em vez
de voltar à espera após o efeito holográfico de 500 ms. Ao final de cada update,
as cópias vivas adotam o quadro, o acumulador de tempo e o estado de reprodução
da animação da verdadeira. Isso cobre as três falsas das quatro aparições e
os nove clones móveis, inclusive com a verdadeira em movimento na segunda fase.

As folhas originais continuam com 48 quadros a 16 fps, reproduzidos uma vez.
Nos ataques longos, todos conservam o último quadro juntos; ao terminar ou
cancelar o ataque, voltam à espera na mesma atualização. Virar para o jogador
não reinicia a animação, e as hitboxes conservam o alinhamento.

Esta parte sincroniza as animações dos corpos. A reprodução completa dos
ataques pelas cópias, sem dano, continua reservada ao item 4; os efeitos
holográficos breves existentes foram preservados.

Arquivos desta parte:

- `js/enemies/novoBoss/NovoBossApresentacao.js`: sincronizador de quadros e
  relógio de animação, sem reiniciar a reprodução a cada atualização.
- `js/enemies/novoBoss/NovoBossIlusoes.js`: desacoplar a duração da pose da
  duração do efeito holográfico; a implementação é compartilhada com os clones.
- `js/enemies/novoBoss/NovoBoss.js`: sincronizar as cópias após a atualização da
  apresentação e dos dois sistemas de aparições.
- `js/enemies/novoBoss/NovoBossApresentacao.test.mjs` e
  `js/enemies/novoBoss/NovoBossIlusoes.test.mjs`: três novos casos de sincronia,
  fim da animação, entrada tardia, alvos removidos e duração integral da pose.
- `tests/novo-boss-sincronia.browser.mjs`: novo roteiro dos quatro ataques em
  cada grupo, com frames normais e longos, cena ativa, segunda fase acionada por
  dano na abertura, movimento real, dissipação de cópias e cancelamento.
- `tests/novo-boss-etapa7.browser.mjs`: verificar que as falsas conservam a pose
  e o quadro da verdadeira além dos antigos 500 ms.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta parte.

Validação: **164 testes passaram em 15 arquivos**. O novo roteiro Chromium
passou nos quatro grupos de verificações, sem erros de JavaScript, console ou
recursos. A sequência de teste usa duração estendida de aparições e teleporte
preventivo adiado para acompanhar os quatro ataques completos com o mesmo
grupo; a configuração do jogo permanece igual. A regressão visual da etapa 7
também passou nos seis grupos, incluindo Heavens Fury, teleporte, transição de
fase, derrota e reinício. `git diff --check` passou. Os mesmos 26 arquivos
protegidos de arte, pacote, especificação e boss antigo permaneceram idênticos
byte a byte. Nenhum arquivo foi excluído ou renomeado.

### Item 4: ataques completos das cópias sem dano — concluído

As falsas das quatro aparições e os nove clones vivos reproduzem pulso com
explosão, Heavens Fury, espiral de lasers e tentáculos usando as mesmas fábricas
de ataque da verdadeira. Iniciam junto dela e avançam pelo mesmo tempo consumido
pelo controlador, inclusive quando um frame atravessa fronteiras de estados.
Pulso e disparos nascem na posição de cada cópia; chuva e tentáculos mantêm as
marcações no mundo do padrão sorteado pelo ataque real. Reutilizar os sorteios
não consome aleatoriedade extra nem muda a sequência dos ataques verdadeiros.

Os efeitos das cópias são translúcidos, em tons de holograma, abaixo dos avisos
vermelhos e efeitos ofensivos da verdadeira. Os lasers falsos não recebem corpo
Arcade, não entram em `projeteisBoss` e não participam de parry ou hologramas dos
personagens. Dano e repulsão são zero, e os serviços de captura, liberação do
jogador e dano por reflexão ficam desativados nas cópias. A verdadeira conserva
suas regras e valores de dano.

Dissipar uma cópia remove imediatamente somente seus próprios ataques. O fim
natural encerra a execução junto da verdadeira e conserva a cauda visual da
explosão até completar os oito quadros. Cancelamento, saída da arena, morte,
multiplayer e reinício removem todos os efeitos pendentes. A implementação
anterior das pequenas imitações holográficas permanece disponível para a API
de prévia; o combate usa os ataques completos.

Arquivos desta parte:

- Criado `js/enemies/novoBoss/NovoBossFabricaAtaques.js`: definições comuns dos
  quatro ataques, preservando as implementações individuais existentes.
- Criado `js/enemies/novoBoss/NovoBossAtaquesIlusorios.js`: cena visual própria,
  serviços sem consequências de combate, reprodução e limpeza por cópia.
- Alterado `js/enemies/novoBoss/NovoBossAtaques.js`: iniciar, avançar e encerrar
  as reproduções no mesmo relógio do ataque real e compartilhar seus sorteios.
- Alterado `js/enemies/novoBoss/NovoBossIlusoes.js`: cada falsa/clone possui seu
  controlador; dissipação e cancelamento limpam os respectivos efeitos.
- Criado `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs`: oito testes de
  padrões completos, ausência de dano e captura, RNG, relógio, cauda da explosão,
  cancelamento e destruição idempotente.
- Criado `tests/novo-boss-ataques-ilusorios.browser.mjs`: comparação com e sem
  cópias usando o mapa real, timers e sistemas originais de dano/controle.
- Atualizado `docs/novo-boss-desenvolvimento.md`: checklist e registro.

Validação: **172 testes passaram em 16 arquivos**. No Chromium, os oito casos
de ataques completos (quatro com três falsas e quatro com nove clones) mantiveram
a mesma evolução de vida, invulnerabilidade, velocidade e captura do combate
sem cópias. Foram verificados cinco raios, vinte disparos e três tentáculos por
cópia com sorteio determinístico de pontos válidos; lasers falsos atravessaram o
jogador sem dano, e dissipar uma cópia não liberou o agarrão real. Cinco casos
adicionais confirmaram a limpeza durante cancelamento, saída, morte, multiplayer
e reinício. Sem erros de JavaScript, console ou recursos.

O roteiro de sincronia da parte 3 passou novamente nos quatro grupos, incluindo
segunda fase real e movimento da verdadeira entre os nove clones. A regressão
da luta completa também passou: **1000 → 0 com quarenta impactos reais de 25**,
geradores, barreira, ataques, duas fases, vitória, controles, reinício e portal
original de retorno à cidade. Nenhum erro de inicialização no console.
`git diff --check` passou. Os mesmos 26 arquivos de arte, pacote, especificação
e boss antigo permaneceram idênticos byte a byte; os sistemas compartilhados
existentes fora da nova boss não foram alterados nesta parte.

### Item 5: explosão ampliada no centro — concluído

O raio do pulso passou de **145 para 310 px**, com diâmetro de **620 px** e área
aproximadamente **4,57 vezes maior**. O aviso dura **1500 ms**, seguido de
**450 ms** de expansão. Dano de 14 e repulsão de 230 permanecem iguais. O GIF
original continua percorrendo seus oito quadros em 640 ms, dimensionado ao novo
raio; a cauda da animação não prolonga o dano.

Antes de usar o pulso, a verdadeira vai ao ponto central da arena
`(-1080, -5810)`. Quando precisa viajar, o teleporte usa os dois estágios de
250 ms existentes. O aviso, a animação de ataque e as reproduções das cópias só
começam após concluir a chegada. Se já estiver no centro, começa diretamente.
Na segunda fase, a verdadeira fica parada no centro durante esse ataque e
retoma seu movimento na abertura seguinte.

Os destinos continuam sendo validados contra mapa, jogador e geradores. Se o
centro estiver ocupado antes da viagem, o comando não cria um pulso fora dele.
Se for ocupado durante o teleporte, a recuperação existente leva a um ponto
seguro e abandona esse pulso. A sequência automática continua funcionando, e
cancelar o pedido impede uma explosão tardia.

As quatro aparições são preservadas durante esse deslocamento. Quando uma
falsa ocupa o centro, ela troca para a origem da verdadeira, evitando sprites
sobrepostos; isso também funciona se o ataque for cancelado durante a viagem.
Os nove clones continuam se movendo e usam a explosão ampliada nas próprias
posições, com os serviços sem dano já implementados na parte 4.

Arquivos desta parte:

- `js/enemies/novoBoss/NovoBossConfig.js`: novo raio, aviso e expansão.
- `js/enemies/novoBoss/NovoBossAtaques.js`: pedido de pulso central, início
  após chegada, cancelamento e alternativa da sequência quando o centro é ocupado.
- `js/enemies/novoBoss/NovoBossTeleporte.js`: destino explícito opcional e
  preservação das aparições, mantendo o comportamento dos teleportes normais.
- `js/enemies/novoBoss/NovoBossEstados.js`: concluir o posicionamento antes de
  iniciar o pulso e consumir corretamente o excedente de frames longos.
- `js/enemies/novoBoss/NovoBossIlusoes.js`: preservar as falsas durante a
  viagem central e trocar a ocupante do destino pela origem.
- `js/enemies/novoBoss/NovoBossFases.js`: segurar a verdadeira durante o pulso.
- Criado `js/enemies/novoBoss/NovoBossPulsoCentral.test.mjs`, com nove casos.
- Atualizado `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs` para os
  novos tempos, preservando a verificação dos oito quadros completos.
- Criado `tests/novo-boss-pulso-central.browser.mjs`: chegada pelos quatro
  pontos, alcance, GIF, fuga andando com teclas reais, recuperação e segunda fase.
- Atualizados `tests/novo-boss-gifs.browser.mjs`,
  `tests/novo-boss-sincronia.browser.mjs` e
  `tests/novo-boss-ataques-ilusorios.browser.mjs` para considerar a preparação
  central e os novos parâmetros do pulso.
- `tests/novo-boss-etapa8.browser.mjs`: o piloto de regressão calcula sua margem
  de esquiva pelo raio configurado, em vez do antigo valor fixo.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta parte.

Validação: **181 testes passaram em 17 arquivos**. No Chromium, o pulso atingiu
uma hitbox a 270 px, causou dano uma única vez, manteve a abertura normal e teve
o GIF dimensionado ao diâmetro de 620 px. Uma fuga com teclas reais, caminhando
a 200 px/s, terminou em aproximadamente 1,23–1,33 s, sem dash, dano ou saída da
arena. A ocupação do centro durante o reaparecimento cancelou o golpe com
recuperação segura. A segunda fase manteve a verdadeira centralizada durante
todo o pulso, com nove cópias sincronizadas, e retomou o movimento na abertura.

Também passaram os quatro grupos dos GIFs, os quatro grupos da regressão de
sincronia e os oito cenários de combate com/sem cópias mais cinco cenários de
limpeza da parte 4, sem erros de JavaScript, console ou recursos. A luta completa
passou novamente: **1000 → 0 com quarenta impactos reais de 25**, mantendo
geradores, barreira, duas fases, vitória, controles, reinício e portal original.
As verificações de whitespace passaram, incluindo os arquivos não rastreados.
Os mesmos 26 arquivos de arte, pacote, especificação e boss antigo permaneceram
idênticos byte a byte. Nenhum arquivo foi excluído ou renomeado, e os sistemas
compartilhados existentes fora da nova boss não foram alterados nesta parte.

### Item 6: espiral central prolongada e intercalada — concluído

A verdadeira vai ao centro `(-1080, -5810)` antes da espiral, usando o mesmo
posicionamento seguro do pulso. A chegada termina antes do aviso de **700 ms**,
da animação de ataque e das reproduções das cópias. Se já estiver no centro,
começa diretamente. Durante a espiral, a verdadeira permanece nesse ponto,
inclusive na segunda fase; os clones continuam se movendo e emitindo a partir
das próprias posições. O movimento da verdadeira retoma na abertura seguinte.

São **100 disparos, um a cada 100 ms, durante dez segundos após o aviso**.
A duração de emissão determina a quantidade efetiva, sem disparo extra na
fronteira final. Velocidade de 145 px/s, raio de 6 px, alcance de 650 px e dano
de 10 permanecem iguais. Depois dos dez segundos não surgem novos projéteis;
os últimos continuam até colidir ou atingir seu limite de alcance/vida. Portanto,
o ataque completo inclui aviso e cauda de voo: no teste da segunda fase durou
14,7 s. A janela normal de dano começa quando terminam os projéteis reais.

O passo base continua em 22,5°, com 16 emissões por volta. As seis primeiras
voltas recebem deslocamentos de **0°, 11,25°, 3,75°, 15°, 7,5° e 18,75°**:
uma volta ocupa os intervalos anteriores e as seguintes preenchem novos caminhos.
As 96 direções dessas voltas ficam espaçadas em 3,75°. O ciclo seguinte também
recebe deslocamento, evitando repetir os mesmos caminhos ao longo da emissão.
São ondas espaçadas no tempo, com velocidade constante e colisão com as paredes,
permitindo esquiva por movimento. Não foi usado o GIF de disparo reservado para
um tratamento posterior; os projéteis mantêm a apresentação procedural existente.

As três falsas e os nove clones usam o mesmo padrão e relógio enquanto vivos,
com animações sincronizadas e sem dano, repulsão, captura ou participação nas
defesas dos personagens. A duração de vida das cópias permanece igual: uma cópia
que expirar ou for dissipada interrompe somente seus próprios efeitos. A troca
da falsa que ocupa o centro, os destinos bloqueados e o cancelamento durante a
viagem continuam tratados pelo posicionamento compartilhado com o pulso.

A emissão mais longa poderia vencer o timer preventivo de dez segundos durante
o próprio ataque e provocar teleporte imediato ao final, eliminando a abertura.
Ao concluir essa espiral, o relógio de afastamento recomeça e somente a pendência
preventiva é retirada, preservando a janela de 2500 ms e o teleporte reativo
após um acerto. O balanceamento geral das aberturas permanece no item pendente.

Arquivos desta parte:

- `js/enemies/novoBoss/NovoBossConfig.js`: centralização, dez segundos,
  cem emissões e intercalação configuráveis.
- `js/enemies/novoBoss/ataques/LasersEspiral.js`: duração da emissão independente
  da cauda, ângulos intercalados e informações de execução para validação.
- `js/enemies/novoBoss/NovoBossAtaques.js`: generaliza o pedido central já
  existente para pulso e espiral, preservando chegada, cancelamento e falsas.
- `js/enemies/novoBoss/NovoBossFases.js`: mantém a verdadeira parada também
  durante a espiral, retomando o movimento ao terminar.
- `js/enemies/novoBoss/NovoBossEstados.js`: preserva a abertura após a espiral
  longa, sem um teleporte preventivo acumulado durante o ataque.
- `js/enemies/novoBoss/ataques/LasersEspiral.test.mjs`: cinco casos adicionais
  de duração, cobertura dos vãos, jogador parado, deltas e limpeza.
- `js/enemies/novoBoss/NovoBossPulsoCentral.test.mjs`: quatro casos adicionais
  de centralização da espiral, destinos ocupados, cancelamento, falsas e fase 2.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs`: valida a reprodução
  dos cem disparos por dez segundos e a ausência de serviços ofensivos.
- Criado `tests/novo-boss-espiral-central.browser.mjs`: chegada pelos quatro
  pontos, emissão, dano no antigo vão, abertura, recuperação segura e fase 2.
- `tests/novo-boss-sincronia.browser.mjs`: permite a nova duração completa.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: valida cem disparos, dano
  apenas da verdadeira e limpeza com projéteis efetivamente em voo.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta parte.

Validação: **190 testes passaram em 17 arquivos**, incluindo colisão varrida,
paredes, reflexão e defesas dos personagens, estados, geradores, ilusões,
clones, dano e controles. Comandos:

```sh
node --test js/enemies/novoBoss/*.test.mjs js/enemies/novoBoss/ataques/*.test.mjs js/combat/CombatTargets.test.mjs js/combat/NovoBossPlayerDamage.test.mjs js/player/PlayerControlEffects.test.mjs
```

No Chromium/Phaser reais passaram os quatro roteiros:

- `tests/novo-boss-espiral-central.browser.mjs`: seis grupos. Nenhum disparo
  antes da chegada/aviso, exatamente cem emissões, abertura aceitando dano,
  recuperação de centro ocupado, cancelamento e nove clones móveis na fase 2.
  O jogador parado no vão inicial ficou com 100 de vida durante a primeira
  volta e caiu para 90 com a seguinte, sem mover sua posição ou desativar defesas.
- `tests/novo-boss-sincronia.browser.mjs`: quatro grupos, incluindo os quatro
  ataques com três falsas e nove clones, verificando frames e relógios completos.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: oito combinações de ataques
  e cópias mantiveram exatamente a mesma evolução de vida, invulnerabilidade,
  velocidade e captura que o combate sem cópias. As cópias emitiram cem disparos
  cada, e os cinco cenários de limpeza passaram novamente.
- `tests/novo-boss-etapa8.browser.mjs`, sem alterar parâmetros de produção:
  **1000 → 0 com quarenta impactos reais de 25**, jogador sem cura/vida infinita,
  quatro geradores, barreira, todos os ataques, duas fases, vitória, WASD,
  reinício e portal original. O piloto manteve 100 de vida. Máximo observado
  de 35 lasers reais simultâneos nessa luta, sem crescimento sem limite.

Nenhum erro de JavaScript, console ou recurso da nova boss. A captura inspecionada
da espiral está em `/tmp/novo-boss-parte6/espiral-central.png`; os logs e o estado
anterior dos arquivos estão em `/tmp/novo-boss-parte6`. Os testes de navegador
usam o servidor e as dependências temporárias descritos nas etapas anteriores.
O registro de FPS do roteiro completo usa Chromium/SwiftShader e não permite
concluir desempenho em hardware físico.

As verificações de whitespace passaram também nos arquivos não rastreados.
A comparação por SHA-256 com o início desta parte confirmou a preservação de
todos os arquivos existentes fora da lista acima, incluindo boss antigo, arte,
GIFs, PNGs, pacote, especificação, mapa e sistemas compartilhados. Nenhum arquivo
foi excluído ou renomeado. Os itens 7–9 e os ajustes gerais de abertura/movimento
continuam pendentes, conforme a orientação de avançar uma parte por vez.

### Item 7: Heavens Fury ampliado — concluído

O raio de cada impacto passou de **48 para 96 px**, com diâmetro de **192 px**
e área quatro vezes maior. A sequência passou de **5 para 15 raios**, com
intervalo de **400 ms** entre avisos. A animação começa após 1000 ms e atinge
no quadro 4, após mais 400 ms: cada alvo continua avisado por **1400 ms antes
do dano**. Dano de 16, perigo de 150 ms e os treze quadros do PNG original
permanecem iguais. A sequência completa dura **7900 ms** e termina na abertura
normal de vulnerabilidade.

O PNG original não foi editado. A largura opaca de 150 px na faixa do impacto
do quadro 4 determina automaticamente a escala: `192 / 150 = 1,28`, cerca de
2,13 vezes a escala anterior de 0,6. A origem horizontal acompanha o centro
dessa faixa em X=198 da célula 384; a origem vertical continua em Y=288.
Assim, o brilho no chão fica centrado no alvo e dimensionado ao diâmetro do
aviso. O tamanho da célula transparente não é usado como largura do impacto.

Os círculos maiores exigem distribuição temporal para caber no mapa. Os centros
ficam separados por pelo menos **216 px** enquanto seus avisos/perigos
coexistirem. Uma região pode voltar à sequência após terminar o perigo anterior,
sempre com outro aviso completo. Os alvos ficam fixos durante a execução.
A busca usa tentativas aleatórias, reaproveitamento de pontos livres e uma
grade de até 32 px, validando arena, paredes e geradores. A busca mais fina
corrigiu sorteios que deixavam de preencher a quantidade configurada.
A mira direcionada para a posição do jogador pertence ao item 8 do checklist,
que continua pendente.

As três falsas e os nove clones reproduzem os quinze raios ampliados com o
mesmo relógio, animações e escala, conservando a apresentação translúcida abaixo
dos avisos reais e os serviços sem dano. Cancelar, sair, morrer ou reiniciar
limpa os avisos, sprites e impactos pendentes.

Arquivos desta parte:

- `js/enemies/novoBoss/NovoBossConfig.js`: raio 96, quinze emissões, intervalo
  de 400 ms, reutilização temporal e ajuste automático da escala.
- `js/enemies/novoBoss/NovoBossAssets.js`: medidas do impacto no PNG para
  calcular a escala e alinhar a origem, sem alterar o arquivo de imagem.
- `js/enemies/novoBoss/ataques/ChuvaRaios.js`: espaçamento temporal, busca fina,
  reutilização segura de pontos e dimensionamento da apresentação.
- `js/enemies/novoBoss/ataques/ChuvaRaios.test.mjs`: seis casos adicionais de
  parâmetros, distribuição, dano ampliado, deltas, cancelamento e áreas estreitas.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs`: quinze marcas,
  dimensões e animação completa das cópias sem consequências de combate.
- Criado `tests/novo-boss-chuva-ampliada.browser.mjs`: distribuição no mapa,
  pixels reais do PNG, dano, fuga por teclado, quadros completos e limpeza.
- `tests/novo-boss-etapa7.browser.mjs`: verifica a origem e a escala ampliadas
  no roteiro existente de apresentação.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: quinze raios por cópia e
  comparação com o dano da sequência real sem cópias.
- `tests/novo-boss-etapa8.browser.mjs`: o piloto considera o raio configurado
  e os intervalos de aviso/perigo, permitindo avaliar a sequência ampliada.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta parte.

Validação: **196 testes passaram em 17 arquivos**, incluindo os seis casos
adicionais da chuva. Comando:

```sh
node --test js/enemies/novoBoss/*.test.mjs js/enemies/novoBoss/ataques/*.test.mjs js/combat/CombatTargets.test.mjs js/combat/NovoBossPlayerDamage.test.mjs js/player/PlayerControlEffects.test.mjs
```

No Chromium com Phaser real passaram os cinco roteiros:

- `tests/novo-boss-chuva-ampliada.browser.mjs`: **34 distribuições** entregaram
  quinze alvos válidos com os quatro geradores presentes, incluindo RNG
  constante. Um jogador a 90 px foi atingido somente no quadro 4; a análise dos
  pixels confirmou largura de 192 px no chão e centro alinhado. A fuga com
  **tecla D real, caminhada a 200 px/s e sem dash** saiu da área em cerca de
  **747 ms**, sem dano. Os quinze sprites percorreram os treze quadros, mantiveram
  os alvos fixos e foram removidos; os quatro cenários de limpeza passaram.
- `tests/novo-boss-etapa7.browser.mjs`: seis grupos de apresentação passaram,
  incluindo folhas, alinhamento, Heavens Fury, falsas, teleporte e derrota.
- `tests/novo-boss-sincronia.browser.mjs`: quatro grupos passaram, incluindo
  chuva completa de aproximadamente 7,9 s com três falsas e nove clones.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: oito combinações de ataques
  e cópias tiveram a mesma evolução de vida, invulnerabilidade, velocidade e
  captura que o combate sem cópias. Quinze raios por cópia e cinco cenários
  de limpeza passaram sem consequências extras para o jogador.
- `tests/novo-boss-etapa8.browser.mjs`: luta com parâmetros de produção,
  **1000 → 0 com quarenta impactos reais de 25**, jogador com 100 de vida ao
  final, sem cura ou vida infinita. Quatro geradores, barreira, todos os ataques,
  duas fases, vitória, WASD, reinício e portal de retorno continuaram funcionando.

As execuções finais encerraram normalmente, sem erros de JavaScript ou de
recursos da nova boss. A captura inspecionada está em
`/tmp/novo-boss-parte7/heavens-fury.png`; logs e cópias anteriores dos arquivos
ficam em `/tmp/novo-boss-parte7`. As verificações de whitespace passaram também
nos arquivos não rastreados. A comparação SHA-256 com o início da parte confirmou
que todos os arquivos existentes fora da lista acima permaneceram idênticos,
incluindo boss antigo, sprites, GIFs, PNG, ZIP, especificação, mapa e sistemas
compartilhados. Nenhum arquivo foi excluído ou renomeado.

### Item 8: Heavens Fury com mira por aviso — concluído

Cada um dos quinze raios escolhe seu alvo **quando seu aviso começa**, usando
o centro da hitbox de dano atual do jogador. Se essa área não estiver disponível,
usa o centro do corpo ou a posição do sprite. Assim, os avisos seguintes
acompanham o deslocamento do jogador ao longo da chuva. Depois de anunciado,
o alvo fica fixo até o impacto e o fim da animação. Os alvos futuros permanecem
pendentes, com coordenadas nulas, até o próprio aviso.

A configuração de produção ativa `mirarJogador`. Continuam iguais os **quinze
raios**, **raio de 96 px**, intervalo de **400 ms**, **1400 ms antes do dano**,
impacto no quadro 4, perigo de 150 ms, dano de 16, escala de 1,28 e duração
total de 7900 ms. O PNG fornecido permanece intacto. O pulso em área, os lasers,
os tentáculos e os sistemas compartilhados mantêm seus comportamentos.

Na chuva mirada, avisos podem se sobrepor ao seguir o caminho do jogador.
Os impactos continuam espaçados por 400 ms, com perigo de 150 ms e aviso completo
para sair da posição anterior. Aplicar a separação espacial de 216 px do modo
distribuído impediria mirar os deslocamentos curtos do jogador; esse modo
anterior continua disponível com `mirarJogador: false`, com sua implementação
e os testes de distribuição preservados.

O alvo respeita as margens da arena e da entrada. Se o círculo não couber junto
de uma parede ou gerador, a busca por áreas livres usa uma grade de até 32 px
e prioriza a distância à posição atual do jogador. A escolha não consome RNG.
Se toda a área estiver bloqueada, a marca é encerrada sem aviso, visual ou dano
invisível; o aviso seguinte volta a tentar normalmente.

As cópias leem as coordenadas já anunciadas pela verdadeira, em vez de escolher
outra mira entre atualizações. O registro continua disponível após o fim para
consumir frames longos corretamente. As três falsas e os nove clones mantêm
alvos, avisos, frames e relógios sincronizados, com os serviços sem dano já
existentes. Cancelamento e suspensão impedem a seleção dos alvos restantes.

Arquivos desta parte:

- `js/enemies/novoBoss/NovoBossConfig.js`: ativa a mira por aviso na produção.
- `js/enemies/novoBoss/ataques/ChuvaRaios.js`: seleção no início de cada aviso,
  alvo fixo, posição do corpo/hitbox, validação de destino e registro para cópias.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.js`: reproduz os alvos anunciados
  pela verdadeira, mantendo a ausência de serviços ofensivos.
- `js/enemies/novoBoss/ataques/ChuvaRaios.test.mjs`: oito casos adicionais de
  mira, limites, obstáculos, esquiva, tempo de aviso e cancelamento; conserva
  os testes do modo distribuído com sua configuração explícita.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs`: dois casos adicionais
  de alvo compartilhado e supressão de uma marca bloqueada.
- Criado `tests/novo-boss-chuva-mira.browser.mjs`: mira em movimento, dano,
  obstáculos, caminhada por teclado, três falsas, nove clones e interrupções.
- `tests/novo-boss-chuva-ampliada.browser.mjs`: verifica separadamente o modo
  distribuído preservado e a imobilidade de cada marca depois de anunciada.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: usa a mesma rota determinística
  na chuva com/sem cópias, aceitando um impacto real antes de esquivar dos demais,
  sem alterar vida ou defesas.
- `tests/novo-boss-etapa3.browser.mjs`: considera somente marcas já anunciadas
  na verificação inicial de coordenadas da chuva.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta parte.

Validação: **206 testes passaram em 17 arquivos**, com os dez novos casos.
Comando:

```sh
node --test js/enemies/novoBoss/*.test.mjs js/enemies/novoBoss/ataques/*.test.mjs js/combat/CombatTargets.test.mjs js/combat/NovoBossPlayerDamage.test.mjs js/player/PlayerControlEffects.test.mjs
```

Os cinco roteiros Chromium/Phaser desta rodada verificaram:

- `tests/novo-boss-chuva-mira.browser.mjs`: quatro mudanças de posição criaram
  novos avisos nos centros atuais, sem mover os anteriores. Um jogador parado
  recebeu 16 de dano somente após 1400 ms. Quatro geradores e duas bordas
  produziram alvos livres, priorizando a proximidade. Com **tecla D real e
  caminhada a 200 px/s**, nove avisos acompanharam mais de 400 px do percurso,
  sem dano ou dash. Três falsas e nove clones reproduziram os quinze alvos com
  frames e relógios iguais. Cancelamento, saída, morte, multiplayer e reinício
  destruíram os visuais e impediram selecionar os alvos restantes.
- `tests/novo-boss-chuva-ampliada.browser.mjs`: cinco grupos passaram novamente,
  incluindo 34 distribuições do modo anterior, pixels do PNG, raio 96, impacto,
  fuga andando, treze quadros por raio e limpeza.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: oito combinações de ataques
  e cópias mantiveram a mesma vida, invulnerabilidade, velocidade e captura do
  combate sem cópias. Na chuva, o jogador recebeu o primeiro impacto e seguiu
  a mesma rota nos três cenários. Os cinco casos de limpeza passaram.
- `tests/novo-boss-sincronia.browser.mjs`: quatro grupos passaram, com os quatro
  ataques completos, três falsas e a segunda fase real com nove clones.
- `tests/novo-boss-etapa8.browser.mjs`: **1000 → 0 com quarenta impactos reais
  de 25**, usando os parâmetros de produção e todos os ataques. O jogador
  terminou com 100 de vida, sem cura ou vida infinita. Geradores, barreira,
  duas fases, vitória, WASD, reinício e portal original continuaram funcionando.

Sem erros de JavaScript ou de recursos da nova boss nas execuções finais.
A captura inspecionada fica em `/tmp/novo-boss-parte8/chuva-mirada.png`; logs
e estado anterior dos arquivos ficam em `/tmp/novo-boss-parte8`.
As verificações de whitespace passaram também nos arquivos não rastreados.
A comparação SHA-256 confirmou que os demais arquivos existentes permaneceram
idênticos ao início desta parte, incluindo boss antigo, arte, GIFs, PNGs, ZIP,
especificação, mapa e sistemas compartilhados. Nenhum arquivo foi excluído ou
renomeado. O item 9 e os ajustes gerais de aberturas/movimento continuam pendentes.

### Item 9: ondas recorrentes no centro e proteção da clonagem — concluído

A segunda fase continua começando estritamente abaixo de 50% de vida, com
uma única transição de fase. Agora os **nove clones** reaparecem em novas ondas
durante a luta. Cada onda mantém os **18 segundos** de duração existentes;
depois de seu encerramento há **10 segundos de intervalo**, configuráveis em
`fase2.intervaloOndasMs`. O agendamento usa o relógio do combate, que não avança
fora da arena ou durante suspensão.

Antes de cada onda, a verdadeira vai ao centro `(-1080, -5810)`. A primeira
mantém a viagem reativa do acerto que atravessou o limiar, seguida do
posicionamento central. As seguintes também validam mapa, jogador e geradores.
Se o centro estiver ocupado antes ou durante a viagem, a recuperação existente
conserva uma posição segura e a onda aguarda outra tentativa; ela não nasce em
um ponto alternativo. Ao chegar, a entidade e sua hitbox são alinhadas ao centro.

Uma onda vencida aguarda ataques, teleportes e janelas de dano em andamento.
O controlador reserva a próxima preparação para a clonagem, inclusive quando
um frame cruza a fronteira de estados. A duração das aberturas e a regra de
um acerto por abertura continuam iguais. A fila de clonagem mantém o rótulo
de vulnerabilidade durante uma abertura aproveitável pelo jogador.

Cada onda concede **2000 ms de invulnerabilidade**, contados a partir do
nascimento real dos clones, por `fase2.invulneravelAoClonarMs`. A recusa de dano
ocorre no contrato da boss, sem modificar armas, especiais ou defesas do jogador.
Durante a proteção há um **anel violeta**, barra violeta e a indicação
**CLONAGEM · PROTEGIDA**; o indicador verde só aparece quando a vulnerabilidade
pode ser aproveitada. O tempo anterior à chegada não envelhece os novos clones;
somente o excedente posterior ao nascimento é consumido no mesmo frame.

Ataques e animações continuam sincronizados e os ataques das cópias permanecem
sem dano. Foi corrigido um caso em que os lasers de uma cópia terminavam antes
dos reais ao atingir uma parede: seu relógio agora continua acompanhando a
fonte até o ataque real encerrar, sem recriar projéteis já removidos.

Sair, morrer ou entrar em multiplayer remove os clones e a proteção; a retomada
preserva fase e vida e prepara uma única onda central com proteção renovada.
Derrota e encerramento eliminam também o agendamento. Reiniciar recria fase 1,
vida e sistemas próprios sem reutilizar clones ou efeitos da visita anterior.

Arquivos desta parte:

- `js/enemies/novoBoss/NovoBossConfig.js`: intervalo entre ondas e duração da
  proteção, mantendo quantidade, duração e velocidade atuais dos clones.
- `js/enemies/novoBoss/NovoBossFases.js`: fila recorrente, contagem de ondas,
  posição central segura, proteção e respeito aos estados do combate.
- `js/enemies/novoBoss/NovoBossAtaques.js`: prioridade da onda na próxima
  preparação, preservando o ataque e a abertura que já estiverem em curso.
- `js/enemies/novoBoss/NovoBossEstados.js`: conclusão da viagem central,
  recusa de dano durante a proteção e limpeza do agendamento na derrota.
- `js/enemies/novoBoss/NovoBoss.js`: tempo dos clones após seu nascimento,
  preservação da rejeição de deltas inválidos e limpeza ao suspender/encerrar.
- `js/enemies/novoBoss/NovoBossHud.js`: indicação da proteção e manutenção do
  rótulo de vulnerabilidade quando uma onda estiver aguardando.
- `js/enemies/novoBoss/NovoBossApresentacao.js`: anel violeta durante a proteção
  e indicação verde somente quando a boss puder receber dano.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.js`: relógio sincronizado mesmo
  se os projéteis de uma cópia encerrarem antes dos reais.
- `js/enemies/novoBoss/NovoBossFases.test.mjs`: oito casos novos de recorrência,
  centro, proteção, ataques/aberturas, prioridade, falha temporária e derrota;
  atualiza os casos anteriores para a chegada central e os dois segundos.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs`: novo caso de relógio
  após encerramento antecipado dos projéteis da cópia.
- Criado `tests/novo-boss-ondas-clones.browser.mjs`: três ondas reais, centro,
  proteção, quatro ataques completos, obstáculos, deltas inválidos e interrupções.
- `tests/novo-boss-etapa6.browser.mjs`: valida repetição com intervalo, chegada
  central e reproduções completas dos ataques, substituindo expectativas antigas
  de uma onda única e de pequenas imitações visuais.
- `tests/novo-boss-etapa8.browser.mjs`: exige ondas automáticas recorrentes e
  verifica centro e proteção de cada nascimento durante a luta completa.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta parte.

Validação: **215 testes passaram em 17 arquivos**, incluindo os nove novos casos.
Comando:

```sh
node --test js/enemies/novoBoss/*.test.mjs js/enemies/novoBoss/ataques/*.test.mjs js/combat/CombatTargets.test.mjs js/combat/NovoBossPlayerDamage.test.mjs js/player/PlayerControlEffects.test.mjs
```

Os cinco roteiros Chromium/Phaser desta rodada verificaram:

- `tests/novo-boss-ondas-clones.browser.mjs`: três ondas no centro, proteção
  recusando dano aos 1999 ms e aceitando em 2000 ms, intervalo de dez segundos,
  quatro ataques completos com nove clones sincronizados, recuperação do centro
  ocupado antes/durante a viagem, deltas inválidos, retomada e limpeza da derrota.
- `tests/novo-boss-etapa6.browser.mjs`: sete grupos da segunda fase passaram,
  incluindo limiar estrito, movimento, flecha real, interrupções e repetição
  sem acumular clones ou repetir a transição de fase.
- `tests/novo-boss-sincronia.browser.mjs`: quatro grupos com os quatro ataques,
  três falsas e a fase 2 real com nove clones, conferindo quadros e relógios.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: oito combinações mantiveram
  vida, invulnerabilidade, velocidade e captura iguais ao combate sem cópias;
  os cinco cenários de limpeza também passaram.
- `tests/novo-boss-etapa8.browser.mjs`: **oito ondas automáticas** nasceram no
  centro com dois segundos de proteção cada. A luta terminou em **1000 → 0 com
  quarenta impactos reais de 25**, jogador com 100 de vida, sem cura ou vida
  infinita. Geradores, barreira, todos os ataques, duas fases, vitória, WASD,
  reinício e portal de retorno continuaram funcionando.

As execuções finais não registraram erros de JavaScript ou recursos da nova
boss. A captura inspecionada está em `/tmp/novo-boss-parte9/onda-clones.png`;
logs e cópias anteriores ficam em `/tmp/novo-boss-parte9`. Playwright foi
restaurado do cache em `/tmp`, sem adicionar dependências ao repositório.
As verificações de whitespace passaram também nos arquivos não rastreados.
A comparação SHA-256 confirmou a preservação de todos os demais arquivos
existentes, incluindo boss antigo, sprites, GIFs, PNGs, ZIP, especificação,
mapa e sistemas compartilhados. Nenhum arquivo foi excluído ou renomeado.
Na conclusão do item 9, os ajustes gerais de aberturas e de movimento rápido
com teleporte ainda estavam pendentes. A rodada seguinte está registrada abaixo.

### Ajustes finais: aberturas e mobilidade — concluídos

O primeiro acerto encerrava a janela inteira e a verdadeira continuava andando
entre os clones durante a vulnerabilidade. Agora a abertura dura **até 4000 ms**
e permite **três acertos**, com intervalo mínimo de **250 ms** entre acertos
aceitos. O primeiro golpe conserva a oportunidade de completar um combo; o
terceiro encerra a janela e agenda o teleporte reativo. Se houver apenas um ou
dois golpes, a viagem reativa espera o fim da janela. Aberturas novas reiniciam
a contagem; barreira, proteção da clonagem, hitbox e derrota continuam valendo.

Teleportes preventivos e de retorno dos clones também esperam a abertura acabar.
O tempo de afastamento do jogador continua sendo contabilizado durante ataques
longos; adiar a viagem não desativa o teleporte preventivo. A verdadeira permanece
parada durante as aberturas nas duas fases, inclusive entre os nove clones.

Na segunda fase, a verdadeira se desloca a **250 px/s**, com ou sem clones,
aproximando-se de longe, flanqueando perto e recuando quando o jogador encosta.
Alterna o sentido do flanqueio a cada **1200 ms**. A cada **6000 ms** sem viagem,
pode agendar um teleporte de pressão na preparação, respeitando a recarga e os
destinos seguros existentes. Ataques em andamento e janelas vulneráveis não são
interrompidos por esse reposicionamento.

A caminhada usa subpassos de no máximo 8 px e valida o corpo inteiro contra o
mapa, limites, jogador e geradores, mantendo sprite, corpo e hitbox sincronizados.
Não anda durante o teleporte, na formação dos clones ou durante as quatro
aparições fixas. Explosão e espiral continuam ancoradas no centro durante toda a
execução. O quadro de chegada/criação só usa o tempo transcorrido após a mudança
de estado; não converte o tempo da janela anterior em deslocamento instantâneo.

Arquivos de funcionamento alterados:

- `js/enemies/novoBoss/NovoBossConfig.js`: janela, limite de acertos, intervalo
  entre acertos e parâmetros da mobilidade da segunda fase.
- `js/enemies/novoBoss/NovoBossEstados.js`: combos na abertura, recarga de dano,
  reinício da contagem e adiamento dos teleportes durante a vulnerabilidade.
- `js/enemies/novoBoss/NovoBossFases.js`: início do relógio da fase 2, integração
  da caminhada rápida e suspensão do movimento durante as aberturas.
- Criado `js/enemies/novoBoss/NovoBossMovimento.js`: flanqueio, reposicionamento
  por teleporte, validação de colisões e sincronização física da verdadeira.

Testes e documentação alterados/criados:

- `js/enemies/novoBoss/NovoBoss.test.mjs`: integração de três acertos, viagem,
  preservação da entidade e derrota.
- `js/enemies/novoBoss/NovoBossEstados.test.mjs`: três casos com a configuração
  de produção para combos, limite temporal, proteção e retorno. Casos antigos
  de destino e recarga isolam o limite mínimo configurável de um acerto.
- `js/enemies/novoBoss/NovoBossFases.test.mjs`: aberturas paradas e regressões
  da ordem dos eventos com o limite mínimo configurável de um acerto.
- `js/enemies/novoBoss/NovoBossPulsoCentral.test.mjs`: verdadeira parada tanto
  durante os ataques centrais quanto na abertura seguinte.
- Criado `js/enemies/novoBoss/NovoBossMovimento.test.mjs`: sete casos para
  velocidade, clones, obstáculos, estados, recarga, deltas e transições.
- Criado `tests/novo-boss-ajustes-finais.browser.mjs`: katana real, fase 2 por
  60 segundos, segurança física, combos e ataques centrais.
- `tests/novo-boss-etapa6.browser.mjs`: transição respeita a abertura completa;
  retorno dos clones espera o evento real de viagem, evitando tempos fixos.
- `tests/novo-boss-ondas-clones.browser.mjs`: limite de deslocamento no quadro
  de nascimento considera a nova velocidade da verdadeira.
- `docs/novo-boss-desenvolvimento.md`: checklist e registro desta entrega.

Validação: **225 testes Node passaram em 18 arquivos**, sem falhas, com o mesmo
comando registrado no item 9. Os seis roteiros Chromium/Phaser passaram:

- **Ajustes finais:** após 2,2 s reservados para aproximação, três golpes reais
  de katana causaram 75 de dano na mesma abertura, consumindo estamina e sem
  duplicar dano por golpe. Em 60 s da fase 2, foram observados 592 passos rápidos
  e seis teleportes de pressão, com caminhada também fora das ondas, corpo
  seguro, aberturas paradas e ondas centrais protegidas. Explosão e espiral
  permaneceram no centro durante toda a execução.
- **Etapa 6:** limiar estrito, transição após a abertura, movimento com clones,
  flecha real, interrupções, retomada, ondas recorrentes e derrota passaram.
- **Ondas:** três ondas, proteção até 1999 ms/liberação em 2000 ms, quatro
  ataques completos sincronizados, centro bloqueado e limpeza/retomada passaram.
- **Sincronia:** os quatro ataques mantiveram quadros e relógios comuns às
  três falsas e aos nove clones; cena ativa, dissipação e cancelamento passaram.
- **Ataques ilusórios:** oito combinações preservaram dano e controles do
  combate sem cópias; os cenários de cancelamento e interrupção passaram.
- **Luta completa, configuração de produção:** quatro geradores desativados por
  E/clique reais, barreira, todos os ataques, ilusões, duas fases e **três ondas
  automáticas** no centro com proteção de 2 s. Vitória em **1000 → 0 por quarenta
  impactos reais de 25**, jogador com 100 de vida, sem cura ou vida infinita.
  WASD após vitória, reinício e portal de retorno também passaram.

Não houve erros de JavaScript nem falhas de recursos da boss nessas execuções.
Logs, cópias anteriores e manifesto SHA-256 estão em
`/tmp/novo-boss-ajustes-finais`. A captura da luta completa foi inspecionada em
`/tmp/novo-boss-etapa8-clones.png`. Chromium usa renderização por software neste
ambiente; os testes não certificam desempenho em hardware do jogador.

Preservação: nenhum arquivo foi excluído ou renomeado. Permanecem intactos o
boss antigo desativado, sua implementação e assets; todos os PNGs, GIFs, ZIP e
especificação; mapa, cena, armas, outros inimigos e sistemas compartilhados.
Na conclusão dos ajustes finais, os GIFs de disparo e tentáculo ainda estavam
reservados. As solicitações posteriores autorizaram o disparo e depois o
tentáculo, registrados nas seções seguintes. O multiplayer mantém a integração
anterior e não recebe a luta solo.


### Disparo de energia: transparência e integração — concluído

- [x] Analisar os 61 quadros, dimensões, cores, sequência e tempos.
- [x] Apresentar uma prévia antes da conversão integral, incluindo os quadros
  1, 31 e 46 sobre fundo claro e escuro.
- [x] Consultar sobre o preto fechado pelos anéis: o usuário escolheu **B**,
  tornando transparentes também esses espaços, sem apagar os azuis escuros.
- [x] Exportar e verificar GIF transparente, spritesheet e páginas para o jogo.
- [x] Integrar aos cem disparos da espiral e às cópias inofensivas.
- [x] Testar frames, direção, colisão, reflexão, cancelamento e luta completa.

A fonte `disparo-energia.gif` permanece byte a byte intacta, SHA-256
`e71cb22c38baab1d8812338760106ff8254275f6d2f5b95ca1044c2e185c08c6`.
Cada quadro mantém **660 × 499 pixels**, **20 ms** e sua posição original na
sequência; o ciclo dura **1220 ms**, repetindo como o GIF original. O processamento
altera somente o alfa de **RGB (0, 0, 0)**, incluindo os interiores autorizados.
Os pixels brancos, cianos e azuis, inclusive os tons escuros, mantêm seus RGB
exatos. Não há redesenho, suavização, redimensionamento, limiar aproximado ou
quantização de cores. A paleta de saída preserva as **200 cores visíveis** mais
um índice transparente; não sobra preto opaco nas bordas ou entre os anéis.

Derivados criados em `assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/derivados/`:

- `disparo-energia-previa.png`: comparação dos quadros 1, 31 e 46 antes da
  conversão integral, no original e sobre fundos claro/escuro.
- `disparo-energia-previa-interiores.png`: alternativas A/B do quadro 46,
  usadas para a decisão sobre espaços fechados pelos anéis.
- `disparo-energia-transparente.gif`: 61 quadros, transparência, tempos e loop
  originais. Descarte de quadros configurado para não deixar rastros opacos.
- `disparo-energia-quadros.png`: spritesheet completa, oito colunas, quadros
  de 660 × 499 sem alterar os pixels.
- `disparo-energia-pagina-1.png` e `disparo-energia-pagina-2.png`: os mesmos
  quadros divididos em 32 + 29 células para o carregamento no jogo. Cada página
  tem no máximo 4096 pixels por dimensão, sem redimensionar os quadros.
- `disparo-energia.json`: hash da fonte, dimensões, 61 durações, ordem das
  páginas, regra aprovada e contagem de pixels removidos por quadro.

Arquivos de código alterados/criados:

- Criado `scripts/preparar-disparo-energia.py`: conversão determinística com
  paleta exata e verificação de todos os pixels contra o original, GIF e PNGs.
- `js/enemies/novoBoss/NovoBossAssets.js`: carrega as duas páginas em chaves
  próprias, com células e limites exatos.
- Criado `js/enemies/novoBoss/NovoBossDisparoEnergia.js`: anima cada projétil
  pelo seu tempo de vida, troca de página no quadro 33 e repete após o 61º.
  Orienta a frente luminosa para o voo, inclusive após reflexão. A escala de
  exibição no mundo acompanha o raio do projétil; os arquivos exportados mantêm
  o tamanho original. O corpo é um círculo de raio 6, não o retângulo transparente.
  Adaptadores locais de estilo preservam a reflexão do Kai sem editar o sistema
  compartilhado; a coloração especial só se aplica quando um disparo é refletido.
- `js/enemies/novoBoss/ataques/LasersEspiral.js`: usa o efeito animado no lugar
  do círculo e risco rosa. Mantém o padrão, cem emissões em dez segundos,
  velocidade, alcance, dano e colisões; mantém o fallback geométrico se o recurso
  estiver indisponível. Os clones usam a mesma fábrica sem dano ou corpo físico.
- `js/enemies/novoBoss/NovoBossServicosAtaques.js`: ajusta o círculo físico do
  novo sprite para o raio existente, mantendo o contrato de defesas/registro.
- `js/enemies/novoBoss/NovoBoss.test.mjs`: verifica as duas novas folhas.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs`: simulação de sprite
  atualizada para troca de textura e rotação, mantendo as verificações ofensivas.
- Criado `js/enemies/novoBoss/NovoBossDisparoEnergia.test.mjs`: sete casos de
  fonte, temporização, duas páginas, orientação, raio, reflexão e limpeza.
- Criado `tests/novo-boss-disparo-energia.browser.mjs`: teste no Phaser real
  de alfa, sequência completa, collider, nove clones, cancelamento e parry do Kai.
- `docs/novo-boss-desenvolvimento.md`: checklist, decisão da prévia e entrega.

Validação:

- **232 testes Node em 19 arquivos**, sem falhas, com o comando do item 9.
- `python3 scripts/preparar-disparo-energia.py --verificar`, com Pillow:
  conferiu **todos os pixels dos 61 quadros**, dimensões, ordem, durações,
  transparência e loop do GIF; também conferiu a folha completa, as duas páginas
  e a preservação dos RGB e do original.
- `tests/novo-boss-disparo-energia.browser.mjs`: os quadros 1–61 aparecem em
  ordem por 20 ms e repetem sem salto; alfa real sem preto opaco e com azuis
  escuros preservados; collider circular de raio 6 centrado durante as trocas;
  nove clones com frames iguais e sem física/dano; reflexão real do Kai mantém
  vida do jogador em 100; cancelamento e saída não deixam sprites residuais.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: as oito combinações de
  quatro ataques e três/nove cópias preservam dano e controles do combate sem
  cópias; cenários de interrupção removem todos os efeitos.
- `tests/novo-boss-etapa8.browser.mjs`: luta completa com geradores, barreira,
  todos os ataques e duas fases; duas ondas automáticas nasceram no centro com
  proteção de 2 s. Vitória em **1000 → 0 com quarenta impactos reais de 25**,
  jogador vivo, sem cura ou vida infinita; WASD, reinício e portal passaram.

A captura do efeito em uso foi inspecionada em
`/tmp/novo-boss-disparo/espiral-energia.png`. Logs, cópias anteriores e manifesto
SHA-256 ficam em `/tmp/novo-boss-disparo`. Nenhum arquivo foi excluído ou
renomeado. Boss antigo, GIFs originais, tentáculo, escudo, explosão, Heavens Fury,
mapa, cena, armas e sistemas compartilhados permanecem intactos nesta rodada.


### Tentáculo vermelho: recorte, agarrão separado e integração — concluído

- [x] Analisar paleta e textura, dimensões, tempos, loop e quadros representativos.
- [x] Mostrar cinco amostras antes da conversão integral: quadros 1, 11, 26,
  46 e 111, com original e transparência sobre fundos claro/escuro.
- [x] Receber aprovação explícita do recorte/vermelho e da entrega PNG principal
  com GIF compatível de transparência binária.
- [x] Converter os 140 quadros, preservar o original e exportar PNGs individuais.
- [x] Exportar GIF, spritesheet integral, atlas e relatório quadro a quadro.
- [x] Criar 20 quadros adicionais de agarrão em uma cópia separada.
- [x] Integrar e testar animação, captura de 2,5 s, clones e cancelamento.

A fonte `tentáculo.gif` permanece intacta, SHA-256
`d0ff1698291b251d558cc60e7de4e30079da28ce3f4df75d53b78150e9f64b24`.
São **140 quadros de 800 × 600**, **40 ms por quadro**, ciclo de **5600 ms** e
loop original. A escrita do GIF não funde quadros iguais nem soma suas durações.
A conversão integral começou somente após a aprovação da prévia pelo usuário.

A paleta original contém **127 cores**. O modelo fixo separa **88 tons do
fundo texturizado**, **20 tons sólidos do tentáculo** e **19 tons de borda já
mesclados ao fundo**. A remoção não usa uma única cor. O mesmo mapeamento RGB
é usado em todos os quadros, sem filtros espaciais, erosão, expansão de máscara,
deformação ou ajuste variável que possa fazer as bordas piscarem.

A recoloração usa uma conversão fixa por canal, ancorando o roxo
`(84,44,137)` no vermelho da boss `(209,31,18)`. Mantém as variações locais,
textura, sombra e iluminação. A arte da fonte tem bordas suavizadas; não foi
pixelizada nem redesenhada. As dimensões e posições dos 140 quadros permanecem
as mesmas.

**Limite documentado e aprovado:** os pixels de borda da fonte já misturam
roxo e fundo. Seu alfa não pode ser recuperado com certeza a partir desse GIF;
a entrega PNG usa a estimativa de mistura mostrada na prévia. O GIF só admite
alfa 0/255 e usa corte 128, sem acrescentar dithering ou filtros.
Pode, portanto, perder cobertura sutil de borda em comparação ao PNG. O jogo
usa o atlas PNG com alfa parcial, e o GIF serve como versão de compatibilidade.

O relatório lista os **140 quadros**. Não houve perda detectada dos pixels
sólidos classificados como tentáculo. Cada quadro contém **70–144 pixels de
borda com maior incerteza de estimativa**; o GIF descarta **1125–1375 pixels de
cobertura parcial por quadro**, já identificados no relatório, e não os pixels
sólidos. Não se promete recuperar um contorno original anterior à composição
com o fundo; os PNGs individuais permitem correção manual se desejada.

Entregas em `assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/derivados/`:

- `tentaculo-previa/comparacao.png`, cinco PNGs roxos e cinco vermelhos e
  `relatorio-previa.json`: resultado apresentado e aprovado antes da conversão.
- `tentaculo/tentaculo-vermelho-transparente.gif`: sequência completa e loop.
- `tentaculo/tentaculo-vermelho-quadros.png`: folha integral, 10 colunas,
  **8000 × 8400**, sem redimensionar as células. Não é carregada diretamente no jogo.
- `tentaculo/quadros/quadro-001.png` até `quadro-140.png`: PNG RGBA individual,
  cada um com 800 × 600.
- `tentaculo/tentaculo-atlas-1.png` e `.json`: atlas de **4072 × 2632** para o
  jogo. Recorta somente margens transparentes na textura de runtime; sourceSize
  e spriteSourceSize reconstroem o quadro original de 800 × 600 sem deslocamento
  ou redimensionamento da arte.
- `tentaculo/tentaculo-agarrao.gif`, `tentaculo-agarrao-quadros.png` e
  `tentaculo/agarrao/quadro-001.png` até `quadro-020.png`: animação adicional.
- `tentaculo/agarrao-atlas-1.png` e `.json`: atlas separado de agarrão,
  **3944 × 712**, também com dimensões lógicas originais.
- `tentaculo/relatorio-quadros.md`, `.json` e `tentaculo.json`: limites de
  segmentação, contagens por quadro, durações, hash, paleta e metadados.
- `tentaculo-vermelho-pacote.zip`: conjunto completo dos derivados e PNGs.

O agarrão usa **cópias do quadro 26**, espelhadas e deslocadas por números
inteiros de pixels. As curvas, detalhes e pixels da fonte não são redesenhados,
esticados ou suavizados. Duas pontas fecham em torno do corpo: oito quadros de
fechamento, quatro poses de contenção e oito de abertura para reutilização.
Os 20 quadros não são inseridos nos 140 originais. No jogo, o fechamento leva
320 ms e a contenção alterna as poses enquanto dura a captura existente de
2500 ms; a liberação limpa o efeito, sem esperar uma animação para liberar o
controle. A abertura também fica disponível nos arquivos entregues.

A inspeção visual encontrou inicialmente um agarrão alto demais. Sua origem foi
centralizada no corpo e a escala de exibição passou a acompanhar a altura da
hitbox do jogador, preservando os arquivos nativos. A animação-base continua
ancorada no chão. Aviso, três armadilhas, raio de captura 18, duração ativa,
contenção e ausência de dano adicional permanecem iguais. Clones reproduzem o
visual-base sem corpo físico ou captura. Expiração e cancelamentos podem encerrar
a exibição, como já acontecia com os efeitos anteriores.

Arquivos de código alterados/criados:

- Criado `scripts/prever-tentaculo.py`: análise da paleta e cinco amostras,
  mantendo o original e produzindo o relatório da prévia.
- Criado `scripts/preparar-tentaculo.py`: conversão integral aprovada, exportação
  determinística, GIF sem fusão de quadros, atlas sem reamostragem, agarrão separado
  e verificação de pixels, tempos, loop e posições.
- `js/enemies/novoBoss/NovoBossAssets.js`: dois atlas em chaves próprias e
  carregamento de atlas além das folhas já existentes.
- Criado `js/enemies/novoBoss/NovoBossTentaculoVisual.js`: relógio de 40 ms,
  origem fixa, troca para agarrão, encaixe no corpo e limpeza idempotente.
- `js/enemies/novoBoss/ataques/Tentaculos.js`: associa os sprites às armadilhas
  e à captura; mantém a marcação do raio e o desenho geométrico como fallback.
- `js/enemies/novoBoss/NovoBoss.test.mjs`: carregamento, atlas e dimensões lógicas.
- `js/enemies/novoBoss/NovoBossAtaquesIlusorios.test.mjs`: simulação de visibilidade
  de sprites, mantendo as proibições de dano, física e controle nas cópias.
- Criado `js/enemies/novoBoss/NovoBossTentaculoVisual.test.mjs`: seis casos de
  fonte, frames, loop, origem, agarrão separado, liberação e captura recusada.
- Criado `tests/novo-boss-tentaculo.browser.mjs`: teste dos atlas e captura real.
- `docs/novo-boss-desenvolvimento.md`: checklist, aprovação, limitações e entrega.

Validação:

- **238 testes Node em 20 arquivos**, sem falhas, incluindo os seis novos casos.
- `scripts/preparar-tentaculo.py --verificar`: todos os 140 PNGs correspondem
  ao modelo aprovado; GIF mantém 140 quadros, tempos, loop e máscara compatível;
  folha e atlas reconstroem todos os quadros sem alterar pixels. Também confere
  os 20 PNGs extras, seu GIF, folha e atlas. Hash da fonte preservado.
- `tests/novo-boss-tentaculo.browser.mjs`: 140 poses a 40 ms, loop, origem fixa,
  resolução lógica 800 × 600, alfa parcial e ausência de verde/roxo residual;
  aviso não captura, agarrão envolve o corpo, contenção dura 2500 ms sem dano,
  liberação, esquiva, cancelamento, cópias inofensivas e saída sem resíduos.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: oito combinações dos quatro
  ataques com três/nove cópias preservaram dano e controles do combate sem cópias;
  cancelamento, saída, morte, multiplayer e reinício removeram os efeitos.
- `tests/novo-boss-etapa8.browser.mjs`: luta completa **1000 → 0 com quarenta
  impactos reais de 25**, duas ondas automáticas centrais protegidas, geradores,
  barreira, todos os ataques, duas fases e jogador vivo; WASD, reinício e portal
  de retorno passaram.

Captura final inspecionada: `/tmp/novo-boss-tentaculo/agarrao-no-jogo.png`.
Logs e manifesto de preservação ficam em `/tmp/novo-boss-tentaculo`.
Nenhum arquivo foi excluído ou renomeado. Boss antigo, GIF original, imagens,
escudo, explosão, disparo de energia, Heavens Fury, mapa, cenas, armas e sistemas
compartilhados permanecem intactos nesta rodada.


## Novas artes: botões, morte e teleporte

- [x] Analisar os três botões WebP, a pose de morte e os 26 quadros do GIF.
- [x] Trocar os botões das duas personagens de teste; interação e ataque em 92 × 92 px.
- [x] Integrar a pose `boss-death.webp`, alinhada ao corpo e espelhada, sem colisão.
- [x] Produzir e inspecionar prévia representativa antes da exportação completa.
- [x] Exportar saída e chegada transparentes, duas folhas e 27 PNGs individuais.
- [x] Integrar a transformação ciano ao relógio e às posições reais do teleporte.
- [x] Conferir pixels, transparência, durações, fontes e preservação dos originais.
- [x] Validar 24 arquivos de testes Node, cliques e visuais em Chromium e luta completa.

Detalhes, entregáveis, arquivos alterados e diferenças de tempo estão em
[botoes-morte-teleporte.md](botoes-morte-teleporte.md).


## Zoom da sala reaproveitado do boss anterior

- [x] Identificar o comportamento preservado em `bossFinal/BossFinalCore.js`: fator
  0,8, transição exponencial com velocidade 5 e margens de saída 70/80 px.
- [x] Integrar um controlador próprio `NovoBossCamera.js` ao ciclo do encontro atual,
  sem instanciar o antigo nem modificar sua implementação.
- [x] Afastar suavemente ao entrar e restaurar o zoom anterior ao sair, morrer ou
  vencer; restauração imediata ao encerrar/reiniciar ou trocar a câmera.
- [x] Preservar zoom por eixo, seguimento do jogador, combate e comportamento multiplayer.
- [x] Atualizar a barra após o zoom para manter seu tamanho fixo durante a transição.
- [x] Validar 22 arquivos de testes Node e o roteiro real
  `tests/novo-boss-camera.browser.mjs`, incluindo tamanho/posição de botão e HUD,
  entrada, margem, saída, zoom anterior por eixo, vitória, reinício e multiplayer.

Configuração em `NovoBossConfig.js`, bloco `cameraArena`. Os limites e a ativação
do combate continuam independentes da margem visual da câmera. Nenhum asset ou
arquivo do boss antigo foi alterado. Captura inspecionada:
`/tmp/zoom-novo-boss/arena-zoom.png`.


## Revisão do combate: seis ajustes solicitados

- [x] 1. Alinhar destinos esquerdo/direito ao centro em Y = -5810, também nas quatro aparições. Validação: testes do encontro, destinos e ilusões passaram.
- [x] 2. Colisão circular do escudo: testes de ciclo de vida e Phaser real em cinco direções passaram; desligamento no teleporte e após os quatro geradores.
- [x] 3. Retirados anéis de vulnerabilidade/proteção; núcleo oculto durante clones móveis. HUD e pista das quatro aparições preservados. Testes de apresentação e ilusões passaram.
- [x] 4. Removidos alfa/tint/profundidade artificiais dos ataques falsos e transparência dos clones. Testes dos quatro ataques mantêm as proibições de dano, física e controle.
- [x] 5. Compartilhados velocidade de 250 px/s, pausas, fração de frame e validação de caminhos da fase 2. Testes de movimento/clones/fases passaram; rotas individuais preservam a dispersão.
- [x] 6. Tentáculos fixos: jogador puxado pelos pés em 180 ms, com trajetória verificada contra paredes/geradores/escudo. Abertura e borda no piso sem alterar sprites; aviso e círculo persistente removidos quando o sprite surge. Captura mantém 2500 ms sem dano extra. Validação Node e Phaser real passou.

As alterações de assets já existentes no Git pertencem ao usuário e serão preservadas.


Arquivos de implementação desta revisão (prefixo `js/enemies/novoBoss/`, exceto onde indicado):

| Etapa | Arquivos | Alteração |
| --- | --- | --- |
| 1 | `NovoBossConfig.js` | Destinos laterais na mesma altura do centro; ponto superior preservado. |
| 2 | `NovoBossGeradores.js` | Corpo circular exclusivo do escudo, sincronização de posição, ativação e limpeza. Colide somente com o jogador. |
| 3 | `NovoBossApresentacao.js`, `NovoBossIlusoes.js` | Removidos anéis de vulnerabilidade/proteção; núcleo oculto enquanto há clones móveis. Pista previamente aprovada das quatro aparições e HUD preservados. |
| 4 | `NovoBossAtaquesIlusorios.js`, `NovoBossClones.js` | Mesmas cores, alfa e camadas da fábrica real, sem aplicar transparência à cópia. Serviços ofensivos continuam desabilitados. |
| 5 | `NovoBossMovimento.js`, `NovoBossClones.js` | Mesma velocidade, pausas e subpassos de até 8px, com rotas individuais para dispersar os clones. Aberturas e ataques centrais continuam parados para todos. |
| 6 | `ataques/Tentaculos.js`, `NovoBossTentaculoVisual.js` | Base fixa inclusive no agarrão, origem medida no pé da arte, abertura no piso, sem círculo vermelho persistente. O desenho da abertura é reutilizado entre quadros. |
| 6 | `NovoBossPuxao.js` (novo), `NovoBossServicosAtaques.js`, `js/player/PlayerControlEffects.js` | Captura recebe o ponto fixo da armadilha, interpola jogador/física/hitbox e verifica trajeto em subpassos de até 4px. Trajeto obstruído recusa/cancela a captura sem mover através da parede. |

Testes novos/atualizados:

- Testes Node: `NovoBoss.test.mjs`, `NovoBossGeradores.test.mjs`,
  `NovoBossApresentacao.test.mjs`, `NovoBossIlusoes.test.mjs`,
  `NovoBossAtaquesIlusorios.test.mjs`, `NovoBossClones.test.mjs`,
  `NovoBossTentaculoVisual.test.mjs`, `js/player/PlayerControlEffects.test.mjs`.
- Roteiro novo `tests/novo-boss-seis-ajustes.browser.mjs`: mapa real, cinco direções
  de colisão, desaparecimento da colisão, ausência dos marcadores, quatro ataques
  com cores/alfa/camadas iguais, dez corpos a 250px/s e tentáculo fixo puxando o jogador.
- `tests/novo-boss-tentaculo.browser.mjs`: atualiza ancoragem no chão e alfa das cópias;
  140 quadros, captura, soltura, cancelamento e saída passaram.
- `tests/novo-boss-ataques-ilusorios.browser.mjs`: compara também as posições do
  jogador com/sem cópias, permitindo o novo puxão da verdadeira. Passaram as oito
  combinações de quatro ataques × três/nove cópias e as cinco formas de limpeza.
- `tests/novo-boss-disparo-energia.browser.mjs`: expectativa de alfa atualizada para 1.
- `tests/novo-boss-etapa8.browser.mjs`: exige núcleo oculto nas ondas móveis.
  Luta completa passou: vida 1000→0 com quarenta impactos reais de 25, três ondas
  centrais com proteção de 2 s, todos os ataques, vitória, WASD, reinício e portal.
  Nenhum erro JavaScript, de carregamento ou de console durante o roteiro.
  O trecho de 10 s com nove clones também rodou em Chromium/SwiftShader; a taxa de
  quadros desse renderizador por software não caracteriza desempenho em hardware físico.

Validação geral: os 20 arquivos Node do boss e contenção passaram. Na suíte inteira,
46 dos 50 arquivos passaram; os quatro abaixo também falham numa cópia isolada do
`HEAD` anterior às alterações:

- `js/effects/TerrorLighting.test.mjs`: fixture sem `renderer`.
- `js/interactions/FactoryDoor.test.mjs`: fixture de textura sem `getFrame`.
- `js/map/ColisoesMapa.test.mjs`: divergências preexistentes das formas do mapa.
- `js/player/colisoes/PlayerCollisionConfig.test.mjs`: expectativas preexistentes
  divergentes das dimensões de colisão atuais.

Preservação verificada por SHA-256 contra o início desta tarefa: nenhuma nova
exclusão, nenhum asset alterado e todos os arquivos do boss antigo intactos.
As duas alterações de assets já presentes no Git foram preservadas. Mapas, cenas,
armas, inventário, energia da fábrica e código de multiplayer não foram modificados.
Manifesto: `/tmp/boss-seis-ajustes/preservacao.json`.
Prévia inspecionada: `/tmp/boss-seis-ajustes/tentaculo-no-chao.png`.


## Corpo após a derrota e impacto no zero do aviso

Regra confirmada: o jogador pode sair até o aviso terminar. Quem estiver dentro
no zero recebe o impacto naquele momento; sair durante a animação posterior não
desfaz o dano. Entrar depois não provoca um acerto atrasado. A colisão continua
usando a interseção exata do círculo anunciado com a hitbox de dano do jogador.

- [x] Manter a pose de morte visível e opaca enquanto a sala existir, sem física,
  ataques, HUD ou ressuscitar ao sair/voltar à área. Reinício/troca de cena continua
  destruindo os recursos antigos. Se faltar a textura de morte, conserva o sprite
  parado em vez de apagá-lo.
- [x] Resolver o pulso inteiro ao terminar o aviso de 1500 ms, com raio 310.
  A explosão continua animada, mas o dano não aguarda uma frente expansiva.
- [x] Resolver cada Heavens Fury uma vez no zero do seu aviso, sincronizado ao
  quadro quatro. Preservados os 1400 ms totais até impacto (1000 ms + quatro
  quadros iniciais de 100 ms), raio 96, quantidade, duração e arte.
- [x] Preservar valores de dano, defesas/invulnerabilidade do jogador, repulsão
  condicionada ao dano e ataques ilusórios sem consequências.
- [x] Passaram 21 arquivos Node: boss, ataques, contenção e integração das armas.
- [x] `tests/novo-boss-impacto-corpo.browser.mjs`: dano real na borda do círculo,
  ausência de dano nos cantos externos, esquiva 1 ms antes do zero, saída depois
  do impacto, ausência de dano ao entrar na cauda visual; corpo visível após 60 s,
  saída/reentrada, limpeza no reinício e nenhum erro de console/JavaScript/assets.
- [x] Regressão das oito combinações de ataques com três/nove cópias, incluindo
  dano, posição, controle e cinco formas de limpeza.
- [x] Luta completa 1000→0 com quarenta impactos reais de 25, três ondas de clones,
  corpo visível após vitória, WASD, reinício e portal; nenhum erro no console.

Arquivos de implementação: `js/enemies/novoBoss/NovoBossApresentacao.js`,
`js/enemies/novoBoss/ataques/PulsoRepulsao.js`,
`js/enemies/novoBoss/ataques/ChuvaRaios.js`.

Testes ajustados: `NovoBossApresentacao.test.mjs`, `ataques/PulsoRepulsao.test.mjs`,
`ataques/ChuvaRaios.test.mjs`, `tests/novo-boss-botoes-morte-teleporte.browser.mjs`,
`tests/novo-boss-etapa8.browser.mjs`; roteiro novo:
`tests/novo-boss-impacto-corpo.browser.mjs`. Checklist atualizado neste documento.
Nenhum asset, mapa, código compartilhado ou arquivo do boss antigo foi alterado
nesta rodada. Prévia inspecionada: `/tmp/boss-corpo-impactos/corpo-apos-60s.png`.


## Marcação animada e nova libertação dos tentáculos

- [x] Inspecionar `are-de-ataque.gif`: 109 quadros de 221×157, com tempos de
  60/70 ms e fundo verde composto por trás do rosa. Original preservado por SHA-256.
- [x] Desfazer a contribuição do verde em uma cópia RGBA, com alfa parcial nas
  bordas. Exportar spritesheet, GIF transparente, prévia PNG e manifesto em
  `assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/derivados/area-ataque/`.
  O GIF tem alfa binário; a spritesheet PNG é a versão principal usada no jogo.
- [x] Integrar os 109 quadros aos avisos de pulso, chuva, lasers e tentáculos,
  incluindo cópias inofensivas. No jogo, a sequência acompanha o progresso de cada
  aviso e termina junto do impacto; os tempos originais ficam no manifesto/GIF.
  O oval original é ajustado somente na exibição para coincidir com o círculo real
  de dano, sem redimensionar os arquivos originais.
- [x] Reproduzir o puxão com a física ativa: `body.reset()` guardava o canto da
  imagem sem o offset, e `postUpdate` somava esse offset ao sprite outra vez.
  Sincronizar `prev`, `prevFrame` e `autoFrame` após atualizar a hitbox. Agora o
  jogador vai continuamente até a base; não retorna nem recebe deslocamento extra.
- [x] Exigir oito apertos distintos do ataque para libertar. Segurar conta uma
  vez; cliques do mouse e botão na tela funcionam. Movimento, troca de arma e
  botão direito não contam. Durante a captura, novas tentativas não executam
  ataques nem consomem estamina. HUD mostra `AGARRADO · APERTE ATAQUE 0/8`.
- [x] Remover a soltura automática de 2,5 s no combate de produção. O ataque
  aguarda a libertação; saída, morte, derrota, cancelamento e shutdown continuam
  liberando o jogador. Após escapar há 600 ms sem recaptura por outro tentáculo,
  para evitar puxões sucessivos imediatos. Isso não dá invulnerabilidade a dano.
- [x] Sortear 8–12 tentáculos por execução, a 120–300 px da posição do boss na
  criação. Pontos ficam fixos e separados, respeitando paredes, geradores, arena
  e entrada. A busca alternativa permanece nesse mesmo anel local. Não há mais
  um primeiro tentáculo automaticamente colocado sobre o jogador distante.
- [x] Conferir PNG/GIF: `scripts/preparar-aviso-boss.py --verificar` passou,
  incluindo todos os 109 quadros, tempos, transparência e hash da fonte.
- [x] Passaram 23 arquivos Node do boss, controles, captura e integração de dano.
- [x] `tests/novo-boss-aviso-libertacao.browser.mjs`: transparência real da textura,
  quatro avisos e limpeza; 20 ondas nas quatro posições, sempre com a quantidade
  sorteada; puxão monotônico e oito cliques nativos para Kai, Aria e personagem
  de teste, sem tiros ou consumo de estamina. Segurar contou exatamente uma vez.
- [x] `tests/novo-boss-ataques-ilusorios.browser.mjs`: oito combinações com três/nove
  cópias preservaram vida, controles, posição e limpeza. Clones não capturam.
- [x] `tests/novo-boss-tentaculo.browser.mjs`: 140 poses intactas, captura, oito
  apertos, liberação, esquiva, cancelamento e saída passaram.
- [x] `tests/novo-boss-etapa8.browser.mjs`: luta 1000→0 com quarenta impactos reais,
  três ondas de clones, vitória, corpo persistente, WASD, reinício e portal,
  sem erros JavaScript, assets ou console. Chromium/SwiftShader é renderização
  por software e não representa desempenho em hardware físico.

Implementação alterada nesta rodada:

| Arquivos | Motivo |
| --- | --- |
| `NovoBossAssets.js`, `NovoBossAvisos.js` | Carregar e reproduzir a nova marcação transparente. |
| `NovoBossConfig.js`, `ataques/Tentaculos.js` | Quantidade, anel local e duração da captura ligada à libertação. |
| `NovoBossPuxao.js` | Corrigir a aplicação duplicada do offset na física ativa. |
| `NovoBossLibertacao.js` (novo), `NovoBoss.js` | Escutar apertos reais e limpar os listeners junto do encontro. |
| `NovoBossHud.js` | Mostrar o progresso dos oito apertos. |
| `NovoBossServicosAtaques.js`, `NovoBossAtaquesIlusorios.js` | Consultar a captura real e manter cópias inofensivas. |
| `js/player/PlayerControlEffects.js`, `js/player/Player.js` | Contar apertos e bloquear ataques normais enquanto preso. |

Os nomes sem prefixo acima pertencem a `js/enemies/novoBoss/`. Também foram
atualizados os testes correspondentes e os roteiros de tentáculo, ataques
ilusórios, luta completa e seis ajustes. Novos testes: `NovoBossAvisos.test.mjs`,
`NovoBossLibertacao.test.mjs` e `tests/novo-boss-aviso-libertacao.browser.mjs`.
Script novo: `scripts/preparar-aviso-boss.py`. Nenhum arquivo original foi
excluído, renomeado ou substituído. Nenhum mapa ou implementação do boss antigo
foi alterado; as alterações de assets que já pertenciam ao usuário continuam
preservadas. Captura inspecionada: `/tmp/boss-aviso-libertacao/agarrado-7-de-8.png`.

### Permanência dos tentáculos: 18 segundos

- [x] Aumentado `ativoMs` de 3500 para 18000 em `NovoBossConfig.js` e no padrão de
  `ataques/Tentaculos.js`. A contagem começa após o aviso de um segundo.
- [x] Mantida a libertação por oito apertos: um tentáculo que esteja segurando o
  jogador aguarda a libertação mesmo após a janela de surgimento terminar.
- [x] Ajustados os testes de duração em `ataques/Tentaculos.test.mjs`,
  `NovoBossAtaquesIlusorios.test.mjs` e `tests/novo-boss-tentaculo.browser.mjs`.
- [x] Passaram os 23 arquivos de testes Node de boss, captura e dano. No Chromium,
  os tentáculos restantes continuaram visíveis e ativos até 17999 ms após surgir
  e foram removidos aos 18000 ms; captura, libertação, cancelamento, cópias e
  saída da arena também passaram, sem erros de JavaScript, assets ou console.

Nenhum sprite ou arquivo original foi alterado nesta mudança.

### Cinco tentáculos como obstáculos e dano contínuo sem escudo

Esta revisão substitui as regras anteriores de 8–12 tentáculos, dano restrito às
aberturas e proteção de dois segundos ao clonar.

- [x] Invoca cinco tentáculos reais, em posições aleatórias próximas do boss,
  conservando o aviso de um segundo e os 18 segundos de permanência após surgir.
- [x] Os tentáculos possuem execução própria em `tentaculosAtivos`. Não ocupam
  `ataqueAtual`; o seletor automático inicia o próximo ataque no mesmo turno.
  Enquanto a onda existir, novas invocações não acumulam outras armadilhas.
- [x] Armadilhas e capturas avançam pelo tempo efetivamente consumido pelo
  combate, inclusive durante outros ataques e teletransportes. Não somem quando
  o ataque ofensivo termina. A mudança para a fase 2 conserva os tentáculos reais.
- [x] Cópias podem manter os seus tentáculos visuais enquanto reproduzem outro
  ataque, no mesmo relógio da verdadeira, sem dano ou captura.
- [x] A libertação mantém os oito apertos de ataque. Sair da arena, morrer,
  encerrar o encontro ou cancelar integralmente limpa as armadilhas e a captura.
- [x] Sem barreira, golpes válidos podem acertar na preparação, durante ataques,
  movimento, clonagem e teleporte. Foram retirados o bloqueio por estado e os
  períodos de imunidade da clonagem e de 250 ms entre acertos. A cadência e a
  proteção contra repetir o mesmo golpe continuam sob controle das armas.
- [x] O corpo Arcade continua desligado durante o teleporte para preservar a
  segurança das colisões; o alvo de combate usa a hitbox sincronizada. O HUD
  deixou de anunciar proteção por clonagem. A barreira dos geradores continua
  bloqueando dano normalmente.

Arquivos de implementação alterados, todos em `js/enemies/novoBoss/`:

| Arquivo | Alteração |
| --- | --- |
| `NovoBossConfig.js`, `ataques/Tentaculos.js` | Quantidade fixa de cinco, mantendo duração e captura. |
| `NovoBossAtaques.js` | Ciclo independente das armadilhas, seleção imediata de outro ataque e limpeza. |
| `NovoBossAtaquesIlusorios.js` | Tentáculos visuais persistentes coexistindo com o ataque imitado. |
| `NovoBossEstados.js` | Avanço das armadilhas pelo relógio do combate; dano sem janelas de imunidade. |
| `NovoBoss.js` | Hitbox de combate disponível durante o teleporte. |
| `NovoBossFases.js` | Clonagem sem proteção adicional e preservação das armadilhas na transição. |
| `NovoBossHud.js` | Remoção da indicação de imunidade por clonagem. |

Validação:

- [x] Passaram os 24 arquivos Node de boss, captura, alvos adicionais e dano do
  jogador. Quatro cenários novos em `NovoBossPulsoCentral.test.mjs` verificam
  simultaneidade, duração exata, limite de uma onda, cópias e limpeza.
- [x] `tests/novo-boss-tentaculo.browser.mjs`: animação, captura, oito apertos,
  permanência de 18 segundos, cancelamento, cópias e saída da arena.
- [x] `tests/novo-boss-aviso-libertacao.browser.mjs`: 20 ondas de cinco tentáculos
  e entradas reais nos três personagens, com puxão sem retorno e sem gasto de
  estamina ou disparos ao tentar se libertar.

Os testes existentes afetados foram atualizados para consultar a execução
persistente. Novo roteiro integrado: `tests/novo-boss-tentaculos-arena.browser.mjs`.
Nenhum arquivo de arte, mapa, arma, multiplayer ou boss antigo foi modificado.
- [x] `tests/novo-boss-ataques-ilusorios.browser.mjs`: todas as combinações dos
  quatro recursos com três/nove cópias passaram, com vida e controles iguais à
  execução sem cópias. Cancelar, sair, morrer, multiplayer e reiniciar limparam
  os efeitos próprios.
- [x] `tests/novo-boss-tentaculos-arena.browser.mjs`: invocação e chuva no mesmo
  turno, libertação durante ataque, pulso coexistente, dano por alvo real em
  preparação/ataque/teleporte/clonagem, escudo dos quatro geradores, expiração
  exata e saída passaram. A composição foi inspecionada em
  `/tmp/boss-tentaculos-arena/combate.png`.
- [x] `tests/novo-boss-etapa8.browser.mjs`: luta completa de 1000 a zero com
  quarenta impactos reais de flechas, todos os ataques, três ondas de clones,
  limpeza das ameaças e tentáculos na derrota, corpo persistente, WASD,
  reinício e portal de retorno passaram. Nenhum erro JavaScript, asset ou
  console. O teste usa Chromium/SwiftShader e não mede desempenho em hardware
  físico.
