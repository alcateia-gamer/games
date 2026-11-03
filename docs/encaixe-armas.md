# Encaixe e combate das armas do PDF

## Resultado e escopo

As quatro armas estão integradas à **TESTE 2 // 06**, a personagem de cabelo
escuro do PDF: espada ciano → branca → AK → dourada. A seleção persiste nas
trocas de cena. A primeira personagem, a criatura dourada em grade 3×3, conserva
suas armas e o fallback de encaixe anteriores; seu sprite não foi tratado como arma.

- [x] Etapa 1: inspeção de Git, PDF, sprites, animações e módulos; plano apresentado antes de editar.
- [x] Etapa 2: protótipo AK, socket por quadro, grip, mira, cano, recuo e camadas.
- [x] Etapa 3: idle, caminhada, disparo, oito direções, comparação de rotação e teste no mapa.
- [x] Etapa 4: ciano, branca e dourada; movimento individual, efeitos e dano sincronizados.
- [x] Etapa 5: quatro combinações, regressão, reinício, prévias e preservação dos arquivos.

Abra **`debug/armas.html` pelo servidor do jogo** para avaliar a composição. Há
seletores de personagem, arma, quadro, idle/walk e ângulo, reprodução do corpo,
ataque, cancelamento e overlay desativável. Usa o Phaser e os módulos reais do jogo.

## Recursos identificados

Todos estão em `assets/PERSONAGENS/personagens-teste/`.

| Referência do PDF | Arquivo real | Dimensões e uso |
| --- | --- | --- |
| Personagem de cabelo escuro, página 3 | `personagem-teste-2(idle).png` | 720×720, células 240×240, 8 quadros; última célula vazia |
| Caminhada da mesma personagem | `personagem-teste-2(walk).png` | 960×960, células 240×240, 16 quadros |
| Criatura dourada da página 3 | `personagem-teste.png` | 720×720, células 240×240, 8 quadros; primeira personagem de teste |
| AK, página 2 | `arma-test-2.png` | 1254×1254; recorte de textura 1075×467 em (90,423) |
| Lâmina curva ciano | `Assassin_13_starter.webp` | 240×240; recorte 216×60 em (12,90) |
| Dourada comprida | `arma-test3.webp` | 240×240; recorte 186×66 em (24,84) |
| Branca com extremidade curva | `florete-test.png` | 288×288; recorte 270×72 em (6,108) |
| Outra cópia da branca | `desenho_fundo_transparente.png` | Preservada; não adicionada como equipamento duplicado |
| Variante maior da ciano | `espada-teste.png` | 1536×1024; preservada; mantém-se a versão WebP já integrada |
| GIF e botões da pasta | `9a30a21a014d8e6e3230b8f2345ed746.gif`, `*_Button.webp` | Preservados; não participam da correção dos sockets |

O PDF foi usado somente para reconhecer os recursos. Não contém o código do
sistema e não foi usado como fonte para substituir os arquivos de imagem.

## Como funcionava e o que causava o problema

`PersonagemTeste.js` registra as folhas e cria as oito animações idle/walk por
direção. Para esta personagem, todas usam a mesma vista lateral: as linhas das
folhas representam tempo da animação, não poses direcionais. O corpo tem 64×64
pixels no mundo; a origem alinha os pés e a hitbox ao chão.

`PlayerMovement.js` escolhe caminhada conforme a velocidade e
`controls/PlayerAnimations.js` seleciona a animação. A arma usa POST_UPDATE para
seguir a posição física final; seu alvo vem da mira assistida já existente.
`ArmaPersonagemTeste.js` gira o sprite independente pelo grip, espelha a arma e
emite o laser pelo cano. `EspadaPersonagemTeste.js` controla os três cortes,
enquanto `FloretePersonagemTeste.js` controla estocadas e o terceiro avanço.

As causas encontradas foram:

1. `maoX/maoY` fixos ignoravam a origem visual do corpo e o movimento da palma
   entre quadros. Na segunda personagem, a arma se apoiava no tronco, à direita
   da mão realmente desenhada.
2. O recuo deslocava a arma e o grip sem movimentar a mão do corpo.
3. Arma sempre em `player.depth + 0.1`, mesmo mirando para cima ou passando
   atrás do corpo durante um corte.
4. Faltava restaurar a sobreposição da palma sobre o cabo.
5. A extensão de estocada movia o grip até 11 pixels para longe do braço,
   embora a folha não possua animação de braço estendido.
6. A dourada ainda não tinha cadastro de equipamento nem combate.

## Como os pontos foram definidos

Os sockets foram medidos sobre as células originais com uma grade: centro da
palma quando há pele visível e extremidade da luva nos demais quadros. No idle,
só existem dois pontos necessários: `(93,195)` e `(93,189)`, este último para
quadros 1–4. Na caminhada, os 16 quadros têm posições relevantes diferentes;
os dados estão em `WeaponSocketsTeste.js`, sem gerar centenas de coordenadas.

Cada ponto é convertido usando a origem, a escala, o espelhamento e a rotação
do corpo. O frame permanece inteiro. A mesma mão serve de pivô para a arma,
que conserva seus próprios pontos, orientação e largura.

As coordenadas abaixo pertencem ao **recorte da arma**, não à folha inteira:

| Arma | Grip | Cano/ponta | Largura no mundo | Método |
| --- | --- | --- | --- | --- |
| AK | (285,257) | (1074,153) | 34 | Região superior da empunhadura marrom junto ao gatilho; cano à direita |
| Ciano | (44,33) | (215,3) | 44 | Cabo escuro anterior à guarda dourada; compensa a inclinação original |
| Branca | (239,36) | (0,33) | 46 | Punho vermelho à direita da guarda; a ponta original aponta à esquerda |
| Dourada | (24,48) | (180,18) | ≈47,68 | Cabo azul anterior à guarda; orientação própria de atan2(-30,156) |

Os três equipamentos já integrados mantiveram seus grips e larguras, após
conferência visual. A principal correção está no socket do corpo. A dourada
recebeu escala calculada para conservar exatamente a distância mão–ponta do
florete, em vez de copiar a largura e alterar o alcance.

Uma imagem adicional usa apenas um recorte 18×18 da palma do **mesmo frame e
da mesma textura original**, com posição, escala e espelhamento do corpo. Ela
cobre o grip quando a arma está à frente. Nenhum arquivo de sprite foi editado;
não houve pintura, remoção de fundo, reamostragem ou invenção de dedos.

## Mira, recuo, categorias e camadas

- A mira assistida, suas distâncias e linha de visão continuam iguais. O ponto
  de linha de visão agora parte da mão medida. Movimento e mira continuam independentes.
- Espelhamento transforma a mão e os pontos da arma. Na mira vertical sem
  alvo, conserva o último lado para evitar trocas repentinas.
- O recuo do AK é angular, até 3° em 90 ms, com retorno suave pelo grip. O
  frame do disparo mantém o ângulo balístico existente; o laser nasce no cano.
  O clarão acompanha o cano transformado durante o recuo.
- Mira para cima desenha a arma atrás do corpo. No repouso, usa a direção da
  mira; durante o corte, usa a posição da lâmina. Há histerese entre as camadas
  para evitar cintilação. A inclinação de guarda da ciano não a oculta indevidamente.
- A ciano conserva os três arcos, preparo, janelas ativas e recuperação do
  sistema existente. Dano e efeito usam o mesmo relógio e respeitam paredes.
- Branca e dourada mantêm a mão no cabo. O avanço físico já existente continua;
  o rastro estreito mostra a extensão de ataque até o mesmo ponto usado pela
  varredura de dano, sem criar uma pose de braço inexistente.
- A dourada usa a estocada do florete com **aprovação do usuário**: 28 de dano,
  cadência de 350 ms, mesmo alcance, tempos, terceiro avanço e colisões. Tem
  recorte, grip, orientação, escala e tom de rastro próprios.
- AK e ciano conservam dano, cadência, alcance e consumo anteriores. Texturas
  das armas usam nearest, sem o filtro de suavização na arma. Nenhum sistema
  de combate paralelo foi criado.

## Validação e prévias

Foram inspecionados o [antes/depois](previas-armas/antes-depois.png),
os [ataques nos dois lados](previas-armas/ataques.png), a
[sequência dos 16 quadros do AK](previas-armas/rifle-teste-caminhada.png) e o
[comparativo contínua/8/16 direções](previas-armas/rotacao.png).
O [GIF do AK caminhando](previas-armas/rifle-teste-caminhada.gif) também permite
avaliar o acompanhamento da mão. As quatro armas têm PNGs e GIFs de caminhada
na mesma pasta. A dourada não tem captura de "antes", pois ainda não era equipamento.

Na comparação de 8 e 16 direções, a quantização introduz degraus visíveis e
desvia a orientação de alguns ângulos de mira. A versão integrada mantém
rotação contínua com nearest. O seletor de comparação só existe no laboratório.

- **32 arquivos Node passaram**, cobrindo armas, controles, inventário,
  projéteis, colisões, animações e o novo encontro da boss.
- O novo arquivo tem sete casos: transformação dos 24 sockets, quatro grips
  em 16 direções, cano/recuo/cadência, alcance da dourada, mão fixa na estocada,
  profundidade e dano único/preparo/parede na estocada com socket medido.
- `armas-encaixe.browser.mjs`: quatro armas × 24 quadros × oito direções no
  Phaser real, verificando as matrizes do grip/cano, camadas e capturas. Usa
  os módulos anteriores por interceptação local para o comparativo. São
  768 composições atuais, além das amostras de ataque e recuo.
- `armas-jogo.browser.mjs`: WASD na fábrica, caminhada para a direita com mira
  para a boss à esquerda, disparo durante o movimento, cano, quatro armas,
  screenshots e limpeza de sprite, palma, clarão e debug ao reiniciar.
- `novo-boss-botoes-morte-teleporte.browser.mjs`: cliques reais de troca,
  interação e ataque; zoom; morte/teleporte da boss e reinício continuam passando.
  Seu percurso de troca foi atualizado para as quatro armas.
- As sessões Chromium concluídas não registraram erros JavaScript ou de assets.

## Debug e reprodução

No laboratório, verde marca a mão, rosa o grip/pivô, amarelo a ponta/cano e
azul a mira; o painel informa frame e camada. O checkbox desliga o overlay.
No jogo normal, ele **não é criado por padrão**. Durante um playtest, pode ser
ativado com `scene.debugEncaixeArmas = true` e desativado com `false`.

Sirva o repositório com `python3 -m http.server 8765` e abra `/debug/armas.html`.
Para automatizar, configure `PLAYWRIGHT_MODULE` para a instalação do Playwright:

```sh
node tests/armas-encaixe.browser.mjs
node tests/armas-jogo.browser.mjs
python3 scripts/gerar-previas-armas.py
```

`ARMAS_BASELINE` é opcional: aponta para um snapshot com `js/player` anterior.
Sem ele e sem o snapshot temporário desta sessão, o roteiro valida somente
a versão atual; não inventa um "antes". `ARMAS_CAPTURAS` e `BASE_URL` permitem
alterar a pasta de saída e a URL do servidor.

## Limitações da arte preservadas

As folhas não têm corpo de costas, braço estendido ou uma segunda mão em
posição de apoio ao AK. A composição usa a vista lateral existente e uma mão,
sem criar essas poses. Mirando para cima, parte ou toda a arma pode ficar
oculta pelo corpo, conforme seu comprimento. O debug permite conferir o pivô
mesmo quando há essa oclusão. Esta entrega aproxima a composição e a separação
de movimento/mira; não promete poses corporais que não existem nos arquivos.

## Arquivos modificados e motivo

| Arquivo | Alteração |
| --- | --- |
| `js/player/PersonagemTeste.js` | Cadastro individual da dourada e quatro equipamentos na personagem do PDF |
| `js/player/ArmaPersonagemTeste.js` | Socket transformado, recuo no pivô, cano, camadas, palma original, nearest, debug e limpeza |
| `js/player/EspadaPersonagemTeste.js` | Efeito do corte acompanha a camada da lâmina na personagem com socket |
| `js/player/FloretePersonagemTeste.js` | Mão fixa, rastro da extensão e varredura de dano preservada |
| `js/player/ArmaPersonagemTeste.test.mjs` | Carregamento da dourada, ciclo das quatro armas e restauração |
| `js/controls/PlayerTestActionControls.test.mjs` | Interação contextual após percorrer as quatro armas |
| `tests/novo-boss-botoes-morte-teleporte.browser.mjs` | Percurso de troca compatível com os quatro equipamentos |
| `docs/personagem-teste.md` | Atualiza seleção de armas, sockets, camadas e estocada |

Arquivos novos: `WeaponSocketsTeste.js`, `WeaponSocketDebug.js` e
`WeaponSocketsTeste.test.mjs` em `js/player`; `debug/armas.html` e `debug/armas.js`;
os dois roteiros `tests/armas-*.browser.mjs`; `scripts/gerar-previas-armas.py`;
este relatório e as capturas em `docs/previas-armas`.

Foi registrado um SHA-256 dos 1158 arquivos existentes antes das alterações.
Nenhum arquivo existente foi excluído ou renomeado, e nenhum asset original foi
alterado. Mapa, cenas, boss antigo, novo boss, outros personagens, multiplayer,
atalhos, efeitos e trabalhos anteriores dos colegas foram preservados. Não
houve commit, reset ou alteração destrutiva do Git.

## Referências consultadas

- [Sprites de armas — wiki comunitária](https://soul-knight.fandom.com/wiki/Category:Weapon_Sprites)
  e [armas](https://soul-knight.fandom.com/wiki/Weapons): referência de equipamentos
  independentes e categorias, sem presumir implementação interna.
- [Controles — wiki comunitária](https://soul-knight.fandom.com/wiki/Controls):
  consulta limitada aos resultados indexados; leitura integral bloqueada pelo site.
- [ChillyRoom — Klash of Knights](https://soulknight.chillyroom.com/et/article/base/67):
  trata especificamente do PvP; seus controles não foram aplicados à campanha deste jogo.
- [Godot — animação de recorte e pivôs](https://docs.godotengine.org/pt-br/4.x/tutorials/animation/cutout_animation.html):
  conceitos de transformação relativa ao pivô e ordem de desenho. O projeto
  continua em Phaser; não usa código nem presume a engine de Soul Knight.
