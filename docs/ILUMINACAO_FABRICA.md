# Iluminação da fábrica

O sistema é exclusivo de `Level1Parte2`. Lê os pontos de `LuzesFabrica` por
`map.getObjectLayer`, depois da criação do mapa. Preserva posições, coordenadas
negativas, gerador, partida elétrica, falhas e estado persistente da energia.
O jogador não emite luz na fábrica.

## Configuração no Tiled

Cada fonte deve ser um objeto **Point**:

| Propriedade | Tipo | Padrão | Comportamento |
| --- | --- | --- | --- |
| `Raio` | int | 170 | Alcance de referência em pixels de mundo; a dispersão usa 1,5 × esse valor. Inteiro positivo. |
| `Intensidade` | float | 1.0 | Número finito não negativo; zero apaga a fonte, valores acima de 1 são limitados. |
| `Cor` | color | `#FFD27A` | RGB ou ARGB do Tiled (`#AARRGGBB`); alpha controla a força da fonte. |
| `Piscando` | bool | false | Quedas suaves de 650–1300 ms, em intervalos aleatórios de 3–9 s. |
| `Ligada` | bool | true | Permite acender a fonte apenas quando o gerador fornece energia. |
| `Orientacao` | string | `horizontal` | `horizontal` ou `vertical`; orienta o segmento luminoso em cápsula. |

Propriedades ausentes ou inválidas usam os padrões. Objetos sem Point ou sem
coordenadas válidas são ignorados com aviso. Uma camada ausente também gera aviso
e mantém a escuridão, sem inventar lâmpadas. As luminárias físicas do mapa não são
alteradas pela forma da projeção luminosa.

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
node --test
```

Os testes usam parser, câmera e matrizes do Phaser incluído no projeto. O Canvas
simulado amostra alpha e RGBA pelas equações Porter-Duff. Conferem propriedades,
pontos reais, energia, partida, falhas, cápsula sem platô, transições contínuas,
limite do alcance ampliado, 80 fontes sobrepostas, cores do piso, ausência de lanterna,
alinhamento, persistência e limpeza. Não substituem navegador ou GPU reais.

Validação manual:

1. Entre com o gerador desligado e confira o escurecimento ambiente configurado sem luz do jogador.
2. Ligue o gerador. Confira a partida progressiva e a revelação do piso perto de
   cada luminária, mantendo sombras e sem retângulos ou anéis luminosos.
3. Compare locais com uma e com várias fontes: o brilho deve se combinar suavemente,
   preservando os detalhes e as cores do cenário.
4. Teste `Orientacao = vertical`, raios diferentes e `Piscando = true`. As posições
   não devem mudar; apenas as fontes defeituosas oscilam depois da estabilização.
5. Mova a câmera, altere zoom, redimensione e gire o celular. Saia e retorne à fábrica
   para conferir energia persistida e ausência de erros ou vazamentos.
6. Confira a cidade e a loja e meça FPS/memória em um celular intermediário.
