# Iluminação da fábrica

O sistema é exclusivo de `Level1Parte2`. Lê os pontos de `LuzesFabrica` por
`map.getObjectLayer`, depois da criação do mapa. Preserva posições, coordenadas
negativas, gerador, partida elétrica, falhas e estado persistente da energia.
Sem energia, a lanterna do jogador ilumina a fábrica; ela apaga quando a energia liga.

## Lanterna na barriga

`FlashlightPose.js` posiciona a origem no centro da barriga de cada personagem,
respeitando a origem visual, escala, espelhamento e rotação do sprite. O movimento
dos braços e as mudanças de direção não deslocam esse ponto pelo corpo.

O feixe segue a velocidade nas oito direções e conserva o último ângulo ao parar.
Uma mudança explícita de direção parado atualiza a mira. A abertura do cone começa
perto da barriga, com transição suave nos primeiros 8 pixels. Para baixo, quadros
animados com a mesma posição do tronco reutilizam a máscara; com energia, a lanterna apaga.

O feixe apontando para cima, inclusive nas diagonais, passa por trás do jogador.
A silhueta do frame atual bloqueia só a contribuição da lanterna, mantendo a
cabeça e o corpo na sombra sem recortar o cenário transparente ao redor. Para
baixo, a luz passa sobre o personagem. Um carimbo local reutilizado acompanha
frame, escala, origem, rotação, espelhamento e alpha; as luzes da fábrica continuam
iluminando o personagem normalmente quando há energia.

`FlashlightWalls.js` limita o feixe e seu halo à região visível desde a barriga.
Os tiles de `ParedeAbaixoPerso` e `ParedeAcimaPerso` e os objetos de `ParedePortaBoss`
bloqueiam a luz. `BordaAlta` e `BordaCurvas` ficam fora desse bloqueio. Colisões comuns de máquinas e
móveis deixam os objetos receberem o feixe; a física de movimento permanece igual.
Uma colisão extra só bloqueia luz quando seu tipo é `parede` ou `wall`. Portas com
colisão bloqueiam até terminar a abertura. Abrir uma porta atualiza a sombra mesmo
com o jogador parado. Aberturas e quinas preservam a passagem da luz onde há visão.
Um índice espacial consulta só os contornos próximos; o polígono é reutilizado
enquanto origem e portas não mudam. O recorte usa a matriz atual da câmera.

A primeira parede atingida recebe luz em toda sua face, até a borda de trás da
superfície. O espaço depois dessa borda permanece escuro. Cruzamentos de contornos
levam em conta paredes sobrepostas e quinas; uma segunda parede não recebe luz
através da primeira. Portas fechadas também recebem luz na superfície e bloqueiam
o cenário atrás delas.

## Configuração no Tiled

Cada fonte deve ser um objeto **Point**:

| Propriedade | Tipo | Padrão | Comportamento |
| --- | --- | --- | --- |
| `Raio` | int | 170 | Alcance de referência em pixels de mundo; a dispersão usa 1,5 × esse valor. Inteiro positivo. |
| `Intensidade` | float | 1.0 | Número finito não negativo; zero apaga a fonte, valores acima de 1 são limitados. |
| `Cor` | color | `#FFD27A` | RGB ou ARGB do Tiled (`#AARRGGBB`); alpha controla a força da fonte. |
| `Piscando` | bool | false | `true` mantém piscadas contínuas; `false` ou ausente permite apenas falhas ocasionais espaçadas. |
| `Ligada` | bool | true | Permite acender a fonte apenas quando o gerador fornece energia. |
| `Orientacao` | string | `horizontal` | `horizontal` ou `vertical`; orienta o segmento luminoso em cápsula. |

A leitura de `Orientacao` aceita maiúsculas, minúsculas e espaços nas extremidades.
Os valores `Vetical` e `Vertical` são interpretados como `vertical`, sem precisar
alterar a grafia no mapa. O foco gira no próprio ponto da lâmpada, preservando
suas coordenadas X/Y.

Propriedades ausentes ou inválidas usam os padrões. Objetos sem Point ou sem
coordenadas válidas são ignorados com aviso. Uma camada ausente também gera aviso
e mantém a escuridão, sem inventar lâmpadas. As luminárias físicas do mapa não são
alteradas pela forma da projeção luminosa.

## Piscadas contínuas e falhas ocasionais

Após estabilizar o gerador, cada lâmpada ligada segue um relógio independente.
Com `Piscando=true`, a luminária repete continuamente um perfil de 2,37–8,17 segundos,
com 2–3 falhadas bruscas separadas por respiros de 0,85–2,1 segundos. O perfil é sorteado uma
vez por luminária e reutilizado, inclusive ao religar a energia, sem novas alocações
ou sorteios a cada ciclo.

Nas demais luminárias, a primeira falha ocorre após 20–60 segundos. Cada sequência
dura 1,19–5,45 segundos com apenas 1–2 falhadas, seguida por uma pausa estável de
30–90 segundos. Cada falhada corta a luz para 0–6% em 16–32 ms, sustenta o apagão
por 100–180 ms, tenta reacender brevemente a 65–90% e corta novamente para 0–3%.
Após mais 90–170 ms de mau contato, volta ao brilho normal em 40–75 ms. Um único
estalo acompanha o corte e o repique, mantendo o intervalo maior entre falhadas.
Várias lâmpadas podem falhar ao mesmo tempo.
`Ligada`, intensidade, cor, orientação e o pulso de emergência continuam sendo
respeitados.

Os relógios também avançam fora da tela. Cada queda visível emite um estalo quando
atinge 60% da descida, acompanhando o mau contato em vez de tocar apenas no início
do ciclo. Luz e áudio compartilham o instante da queda; o som compensa o atraso do
quadro com `seek`, mantendo a velocidade original. Eventos com mais de 100 ms de
atraso são descartados. Quedas simultâneas escolhem o estalo mais próximo e não
interrompem um estalo em reprodução. Ao suspender o jogo, eventos vencidos são
descartados, evitando uma fila de piscadas ao retornar. Desligar a energia cancela
as sequências e os relógios. As falhas ocasionais sorteiam um perfil por sequência;
as contínuas avançam diretamente ao ciclo atual após uma suspensão. Não há ruído
aleatório por quadro nem temporizadores adicionais. Só fontes que alcançam a câmera
têm seu brilho interpolado; a quantização de alpha e o cache da máscara evitam
uploads quando a iluminação visível não muda.

## Causa das manchas e correção

O perfil anterior usava uma área retangular de intensidade praticamente constante,
com pico de 0,995 e remoção de sombra multiplicada por 0,99. O centro ficava com
aproximadamente 1% de sombra; fontes sobrepostas removiam ainda mais. A transição
em torno desse platô produzia a aparência de retângulo com blur.

Não havia um filtro de blur nem uma imagem branca desenhada diretamente sobre o
piso: a textura branca era usada em `destination-out`. A causa estava no formato
do perfil e na remoção quase total e repetida da sombra.

O novo perfil em `TerrorLighting.js` calcula a distância a um segmento curto de reta.
Três quedas contínuas representam núcleo, dispersão e halo. A intensidade também
varia ao longo do segmento, evitando uma faixa central uniforme. Uma função
`smootherstep` leva todo o efeito suavemente a zero no limite de `Raio × MULTIPLICADOR_ALCANCE_FABRICA`, sem anel
separado ou degraus entre as regiões. A orientação vertical gira o mesmo perfil.
Um ganho suave de 1,2 reforça o núcleo e a dispersão sem recortar o gradiente.
A dispersão e o halo recebem ganho de 2 fora do núcleo. Uma transição contínua
reduz esse reforço ao se aproximar do foco, preservando a intensidade máxima do centro.
O alcance da dispersão e do halo é 50% maior (255 px para `Raio = 170`); o núcleo
conserva suas dimensões e sua queda de intensidade originais.

## Composição e exposição

Existe uma única máscara de tela inteira. Os carimbos brancos apenas removem
escuridão; o cenário e suas cores continuam sendo os tiles e objetos originais.
A sombra ambiente segue `ESCURIDAO_AMBIENTE_FABRICA` (**90%** na configuração local atual). Mesmo com várias fontes coincidentes,
a sombra nunca cai abaixo de **20%**.

Depois de acumular a remoção, `source-in` normaliza o campo e `destination-over`
reintroduz a sombra residual. Para sombra restante `q` entre 0 e 1:

```text
alpha final = 0,20 + (escuridão ambiente - 0,20) × q
```

Uma lâmpada padrão deixa aproximadamente 24,4% de sombra no centro. A combinação
de várias fontes se aproxima do limite de 20%, sem revelar o piso de forma
excessiva. Isso dispensa leitura de pixels por quadro.

A coloração usa `source-atop` depois da composição e preserva o alpha. Seu peso
somado é limitado a 2,5%, inclusive com muitas fontes próximas, mantendo o amarelo
como complemento discreto.

## Integração e desempenho

- `FactoryLighting.js` lê propriedades, controla energia, progressão, falhas e
  seleção das luzes pelo alcance ampliado na matriz atual da câmera.
- `TerrorLighting.js` prepara o perfil de cápsula uma vez por visita e reutiliza
  uma máscara branca e as máscaras de cor. Cada fonte exige dois desenhos,
  em vez dos quatro do antigo foco mais halo separados.
- O gerador mantém sua API, áudio, sequência e registry. O progresso do áudio
  controla a partida; sem áudio, usa o relógio existente de cinco segundos.
- O evento `Phaser.Renderer.Events.RENDER` fornece a matriz depois de
  `camera.preRender`, preservando alinhamento durante movimento, zoom e resize.
- Quadros sem mudança na câmera ou intensidade reutilizam a textura. Não há
  novos shaders, canvas de tela inteira adicionais ou processamento de pixels por frame.
- O giroflex em aparelhos com toque ou sistema móvel atualiza a orientação a 30 Hz,
  sem alterar a duração da volta. Câmera, portas e zonas continuam reagindo a cada quadro.
- `GiroflexLightCache.js` guarda os recortes de paredes e estátuas por luz visível.
  A máscara e a cor compartilham o mesmo carimbo: girar só redesenha o feixe,
  sem refazer as silhuetas. O cache é invalidado ao mudar portas, estátuas ou a fonte.
- Os três canvases locais de cada giroflex têm até 256 × 256 pixels no celular
  (512 × 512 no desktop), mesmo com raios grandes. São liberados quando a fonte
  sai da tela. Estátuas fora do alcance são descartadas antes do desenho.
- O encerramento remove listener, overlay, textura e canvases temporários.

## Comparação com o GitHub

Comparação realizada com a `main` em
[`ce810993a24df2c55e7446a2ad537beb3ce89a77`](https://github.com/alcateia-gamer/games/commit/ce810993a24df2c55e7446a2ad537beb3ce89a77).
A cópia local parte de `bdcbce570084617b28f0012130f706ee66183b57`, com alterações
locais ainda não commitadas.

Na versão consultada do GitHub, `FactoryLighting.js` não existe.
[`TerrorLighting.js`](https://github.com/alcateia-gamer/games/blob/ce810993a24df2c55e7446a2ad537beb3ce89a77/js/effects/TerrorLighting.js)
ainda desenha o cone da lanterna e esconde a máscara inteira quando o gerador
estabiliza. Também contém áudio de oscilações e uma otimização de resolução móvel
que não fazem parte da cópia local. Esta correção foi aplicada ao sistema local,
sem substituir arquivos por versões remotas ou publicar alterações.

## Verificação

```sh
node --test js/effects/FactoryLighting.test.mjs
node --test js/effects/EmergencyLighting.test.mjs js/effects/GiroflexLightCache.test.mjs
node --test
```

Os testes usam parser, câmera e matrizes do Phaser incluído no projeto. O Canvas
simulado amostra alpha e RGBA pelas equações Porter-Duff. Conferem propriedades,
pontos reais, energia, partida, falhas, cápsula sem platô, transições contínuas,
limite do alcance ampliado, 80 fontes sobrepostas, cores do piso, lanterna condicionada à energia,
alinhamento, persistência e limpeza. Não substituem navegador ou GPU reais.

Validação manual:

1. Entre com o gerador desligado e confira a lanterna na barriga ao caminhar
   nas oito direções e ao parar, sem deslocar a origem junto com os braços durante a animação.
2. Ligue o gerador. Confira a partida progressiva e a revelação do piso perto de
   cada luminária, mantendo sombras e sem retângulos ou anéis luminosos.
3. Compare locais com uma e com várias fontes: o brilho deve se combinar suavemente,
   preservando os detalhes e as cores do cenário.
4. Teste `Orientacao = vertical` e raios diferentes. As posições não devem mudar.
   Após estabilizar o gerador, lâmpadas com `Piscando=true` devem piscar continuamente;
   as demais devem ter falhas de 1–2 quedas com pausas de 30–90 segundos.
5. Mova a câmera, altere zoom, redimensione e gire o celular. Saia e retorne à fábrica
   para conferir energia persistida e ausência de erros ou vazamentos.
6. Confira a cidade e a loja e meça FPS/memória em um celular intermediário.
