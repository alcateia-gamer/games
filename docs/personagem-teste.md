# Sprite de teste

O encaixe por quadro, as quatro armas do PDF e as prévias estão documentados em
[encaixe-armas.md](encaixe-armas.md).

No menu **SOLO**, selecione **TESTE // 05** (original) ou **TESTE 2 // 06** (nova personagem)
e clique em **INICIAR SOLO**.

O PNG original permanece em `assets/PERSONAGENS/personagens-teste/personagem-teste.png`.
A folha usa quadros de 240×240, com oito quadros de idle (a última célula está vazia).
No jogo, o quadro ocupa 64×64 e os pés ficam alinhados com a colisão dos personagens
existentes. O idle também serve de caminhada; a esquerda espelha a imagem.
O teste está disponível somente na seleção solo.

## Nova personagem e combo

**TESTE 2 // 06** usa `personagem-teste-2(idle).png` (8 frames, 8 FPS) e
`personagem-teste-2(walk).png` (16 frames, 12 FPS). Ambas usam células de 240×240,
reduzidas a 64×64 no jogo, com os pés e a colisão alinhados ao mesmo chão. Caminhar para
a esquerda espelha a folha; mirando em um inimigo, a personagem olha para ele mesmo
ao recuar.

Ela começa com `Assassin_13_starter.webp`. O botão de troca percorre espada ciano,
florete branco, rifle AK e arma dourada (`arma-test3.webp`), retornando à espada.
A seleção da primeira personagem continua independente. A dourada usa os valores
de estocada aprovados do florete, com pivô, orientação e escala próprios.

O botão padrão de ataque e o clique no cenário executam **Slash 3 → Slash 2 → Slash 1**
(ordem M → N → B), um golpe por toque. Um toque nos últimos 200 ms do efeito prepara
somente o próximo ataque. Ele começa depois de todos os frames do anterior, continuando
da posição atual da lâmina, sem retornar ao repouso entre os dois. Sem outro toque, o
ataque termina normalmente. Depois de 900 ms sem continuar, a sequência volta ao Slash 3.
Menus, morte, respawn e troca de fase descartam o próximo ataque preparado.

As definições ficam em `PERSONAGEM_TESTE_2` no arquivo `js/player/PersonagemTeste.js`.
O combo usa os mesmos efeitos e regras de dano da espada, sem alterar o ataque da
personagem de teste original.

## Rifle e laser

A arma `arma-test-2.png` gira pela empunhadura. Na personagem do PDF, sua posição
segue a palma/luva do quadro atual, transformada pela origem, escala e espelhamento do corpo.
O PNG atual mede 1254×1254; o recorte elimina as margens transparentes e mantém a arma
com 34 pixels de largura no jogo. A empunhadura e a ponta do cano usam esse novo recorte.
Sem alvo, acompanha o movimento, inclusive nas diagonais, e mantém a direção ao parar.
À esquerda, a imagem da arma é invertida para que continue na posição correta.

O botão de ataque (ou clique esquerdo no cenário) dispara um laser. Ao se aproximar de um
inimigo visível a até 300 pixels, a arma foca nele para auxiliar a mira, sem disparar sozinha.
Ela mantém o foco até o alvo morrer, sair do alcance ou ficar atrás de uma parede.
Com um alvo, o personagem fica virado para a mira mesmo andando na direção oposta,
recuando de costas sem alterar a velocidade ou a direção dos controles. Ao perder o
alvo, volta a se orientar pelo movimento.
O disparo é sempre manual. Inimigos e boss recebem dano; paredes interrompem os
lasers. O tiro não interrompe o idle ou a caminhada e não consome estamina.

O disparo tem clarão e pequeno recuo feitos por código, sem precisar de animação pronta.
A cadência é de um tiro a cada 240 ms, com 25 de dano e alcance de 700 pixels. O personagem
continua sem habilidade especial.

No bloco `arma` de `js/player/PersonagemTeste.js`, ficam grip, cano e largura.
`WeaponSocketsTeste.js` define os pontos medidos da segunda personagem; `maoX` e
`maoY` permanecem como fallback para a primeira. Esta revisão preserva alcance de
mira, cadência, dano e velocidade. O valor
`disparoAutomatico: false` mantém somente a mira assistida e o disparo manual.

## Espada e animação de golpe

Na primeira personagem, o botão de troca alterna entre o rifle e a espada
`Assassin_13_starter.webp`. A segunda usa as quatro armas descritas acima. A espada
mede 240×240 na origem; o recorte remove as margens transparentes e deixa a arma com
44 pixels de largura, cerca de 35 pixels da mão até a ponta. A comparação usa a área
visível dos sprites: 43–45 pixels de altura na primeira personagem e 53–54 na segunda,
descontando a margem transparente das células de 240×240. Na primeira personagem,
`encaixeArmas.espada` posiciona o cabo 10 pixels à frente e 15 abaixo da origem do corpo;
na segunda, o ponto medido da palma varia conforme idle/walk e quadro. O
espelhamento transforma esse ponto pela origem fixa da célula. A inclinação
da arte é compensada para girar pelo cabo. A mira
assistida funciona a até 100 pixels; o golpe é manual e não cria laser.

Os efeitos usam todos os PNGs de 128×128, cor 2, em
`Tilesets/attack/attack-64x64/attack-128x128`:

| Tecla | Ataque | Quadros |
| --- | --- | --- |
| B | Slash 1 | 9 |
| N | Slash 2 | 7 |
| M | Slash 3 | 9 |

Na personagem original, equipe a espada pelo botão de troca antes de usar as teclas.
Cada toque executa um golpe; segurar a tecla não repete o ataque. Nela, botão de ataque e
mouse continuam usando o Slash 3; a nova personagem usa o combo descrito acima.
Os atalhos existem apenas nas personagens de teste e são removidos ao encerrar ou recriar a arma.

Um único relógio controla o ângulo da lâmina, o quadro visível e o dano, evitando que o
efeito se adiante ou atrase em relação à espada. Cada Slash tem seu arco, pivô e ângulos
da lâmina. `origemEfeito` mantém um pivô fixo na empunhadura durante toda a sequência;
`raioEfeito` dimensiona o arco pelo comprimento real da lâmina. A escala acompanha
automaticamente futuros ajustes no tamanho da espada. Os ângulos seguem a frente do
corte nos PNGs, com interpolação contínua de velocidade entre quadros, sem ultrapassar
o arco. O efeito gira junto com a lâmina entre os quadros e permanece acima dela.
Preparo e recuperação têm aceleração e desaceleração suaves.
São 90 ms de preparo, quadros de 50 ms e 95 ms de recuperação: 635 ms para Slash 1/3 e
535 ms para Slash 2, com intervalo mínimo de 660 ms entre comandos na personagem original.
Na nova, o próximo toque pode encadear o ataque após o fim do efeito, sem esperar o
retorno ao repouso.
Se uma atualização atrasar, o relógio retoma pelo próximo
quadro, preservando a sequência completa, inclusive o desaparecimento final. Nessa situação,
o golpe dura mais e a troca continua bloqueada até a animação terminar.

O dano de 35 fica ativo do segundo ao sétimo quadro no Slash 1, do segundo ao quarto no
Slash 2 e do segundo ao sexto no Slash 3. Cada alvo recebe dano uma vez por golpe,
inclusive o boss. O arco de dano acompanha a
lâmina e respeita paredes; uma atualização lenta não pula a janela de acerto nem causa
dano antes de exibir o efeito correspondente.
O movimento do jogador continua livre, mas a mira do golpe permanece fixa até terminar.

Na segunda personagem, arma e arco alternam frente/atrás conforme a mira ou a
trajetória do corte. Uma pequena cópia dos pixels originais da palma cobre a empunhadura
quando está à frente. A primeira personagem conserva sua composição anterior.
Ao trocar de fase, reaparecer, morrer ou abrir o gerador, efeitos pendentes
são removidos. A troca de arma fica bloqueada durante o golpe para não separar a espada
da animação.

Os ajustes estão em `ESPADA_PERSONAGEM_TESTE` e `GOLPES_ESPADA_TESTE` no arquivo
`js/player/PersonagemTeste.js`;
a execução do golpe está isolada em `js/player/EspadaPersonagemTeste.js`.

## Florete da segunda personagem

`florete-test.png` usa um recorte de 270×72 da imagem de 288×288, com 46 pixels de
largura no mundo e cerca de 41 pixels entre a empunhadura e a ponta. A arte aponta
originalmente à esquerda; sua rotação e pivô compensam isso e mantêm o cabo na mão
em todas as direções, inclusive com espelhamento.

O botão padrão executa uma estocada por toque: 70 ms de preparo, 85 ms de extensão e
180 ms de retorno suave à guarda. A área de estocada mantém o recuo de 4 pixels e
a extensão de até 11 pixels. Na personagem com socket medido, a mão permanece no
cabo, e o rastro existente cobre essa extensão, pois não há pose de braço estendido.
O efeito continua estreito junto à ponta, com um brilho breve no acerto. Não usa os
Slash da espada nem cria projéteis. O dano é 28, uma vez por alvo na fase de extensão;
paredes interrompem o alcance e o boss recebe dano pelo sistema existente.

As duas primeiras estocadas dão um passo mínimo de cerca de 3 pixels. A terceira
estocada consecutiva dá um dash de aproximadamente 36 pixels durante a extensão
de 140 ms (em vez de 85 ms), com pico de velocidade de 420 pixels/s,
e reinicia o ciclo. Uma pausa de 900 ms, troca de arma ou interrupção reinicia a contagem.
Toques recusados durante um ataque não contam como novos golpes. O movimento
usa velocidade pela física Arcade: nos dois primeiros golpes reduz a influência da
entrada; no terceiro, assume a direção da mira durante o avanço e devolve o controle na recuperação,
sem alterar diretamente a posição. Colisões continuam ativas; dash e impulso de dano têm
prioridade. O avanço extra é limitado a 4 pixels por atualização nas estocadas normais
e 12 no terceiro golpe, abaixo da largura do corpo, inclusive em FPS baixo.
Menus, morte, respawn e troca de fase limpam o rastro e o impulso pendente. A troca de
arma aguarda o fim da estocada; trocar de volta à espada reinicia o combo no Slash 3.

A definição está em `FLORETE_PERSONAGEM_TESTE`; a execução está isolada em
`js/player/FloretePersonagemTeste.js`, com uma integração de velocidade em
`js/controls/PlayerMovement.js`.

## Botões exclusivos do personagem de teste

O botão principal fica em ataque normalmente. Ao entrar no alcance de um coletável,
porta ou gerador, a mão aparece na mesma posição. A interação usa a lógica existente e
o toque não dispara laser; ao se afastar ou concluir a interação, o ataque reaparece.
A tecla E continua funcionando.

As duas personagens de teste usam as novas artes de `assets/PERSONAGENS/personagens-teste`:
`Attack_Button.webp`, `Action_Button.webp` (acionar/interagir) e `Weapon_Button.webp`.
Ataque e interação ocupam a mesma posição e medem **92 × 92 pixels na tela**.
A troca de arma ocupa a posição antiga da mão e mantém 60 pixels de largura,
preservando a proporção do desenho e a miniatura da arma equipada no centro.
Os três botões compensam o zoom, inclusive quando cada eixo usa um valor diferente.
O antigo `Tilesets/extras/botao-troca.png` e o novo `Extra_Button.webp` foram preservados.

Na personagem original, o botão alterna entre o rifle e a espada. Para incluir
outras armas, adicione suas definições à lista `ARMAS_PERSONAGEM_TESTE` em
`js/player/PersonagemTeste.js`, cada uma com `id`, textura, arquivo, recorte, empunhadura,
cano e parâmetros de disparo. O botão alterna as armas da lista, atualiza a miniatura e
preserva a seleção entre fases e reaparecimentos. Tiros já disparados mantêm o dano e a
velocidade da arma de origem.

O comportamento dos demais personagens continua com ataque e interação separados.
A adaptação dos botões está em `js/controls/PlayerTestActionControls.js`.

## Desativar ou remover

Para desativar uma personagem, mude seu `ativo: true` para `ativo: false` em
`js/player/PersonagemTeste.js`. Desativar as duas restaura os quatro cartões na posição original.
Os ajustes de tamanho, quadros, velocidade e colisão estão nesse mesmo arquivo. A lógica
da arma está isolada em `js/player/ArmaPersonagemTeste.js`; seus objetos e eventos são
removidos ao encerrar a fase e recriados ao reaparecer.

Para remover o código completamente, retire os imports e os pequenos blocos que usam
`PERSONAGEM_TESTE`, `personagemTesteAtivo` e as funções da arma nos seguintes arquivos:

- `js/scenes/start.js`
- `js/scenes/preloader.js`
- `js/player/Player.js`
- `js/player/PlayerAnimations.js`
- `js/controls/PlayerAnimations.js`
- `js/controls/PlayerControls.js`
- `js/controls/PlayerMovement.js`
- `js/inventory/ItemPickup.js`

Depois remova `js/player/PersonagemTeste.js`, `js/player/ArmaPersonagemTeste.js` e o teste
`js/player/ArmaPersonagemTeste.test.mjs`, além de
`js/player/EspadaPersonagemTeste.js`, `js/player/FloretePersonagemTeste.js`,
`js/controls/PlayerTestActionControls.js` e seu
arquivo de teste.

O PNG pode ser mantido para outros testes.
