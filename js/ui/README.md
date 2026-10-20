# Minimapa de exploração

`MiniMapManager` recebe a cena, o Tilemap já criado e o perfil `cidade` ou
`fabrica`. A janela local acompanha o jogador com escala uniforme, preservando
ruas, corredores, áreas desconectadas e coordenadas negativas. Não usa imagens
externas nem altera os tiles, as colisões ou a câmera do jogo.

`MiniMapData.js` seleciona as camadas estruturais pelo nome exato. A origem de
cada `LayerData` é combinada com as coordenadas locais dos tiles; a decodificação
dos chunks continua sendo feita pelo parser Tiled do Phaser. Sombras e luzes não
entram na geometria. Objetos importantes e colisões retangulares/poligonais
também são representados.

A geometria e o atlas ficam em cache por recurso de mapa. O atlas tem no máximo
1024 pixels no maior eixo; somente a janela de 328 × 200 pixels é enviada à GPU.
Não existem objetos Phaser individuais para os tiles ou as células.

A descoberta usa células de 32 pixels, raio de 170 pixels e verificações de
linha de visão contra um índice espacial das colisões. É atualizada a cada
100 ms, se houver deslocamento de 16 pixels, troca de célula ou mudança da porta
da fábrica. O marcador é atualizado a cada frame. A grade tem limite de 262144
células e aumenta o tamanho das células para mapas excepcionalmente grandes.

Os saves são separados: `minimap_mapa1_cidade` e `minimap_mapa1_fabrica`.
O `game.registry` mantém a grade da sessão; o `localStorage` recebe os bits
compactados, no máximo uma vez a cada dois segundos, além do encerramento da
cena e do evento `pagehide`. Saves de outra geometria são ignorados. Falhas de
armazenamento não impedem jogar ou preservar a exploração na sessão.

O posicionamento utiliza o listener existente de controles fixos em
`PlayerInput.js`. A moldura fica no canto superior direito, a 12 pixels das
bordas. O DEV fica 12 pixels abaixo dela, com compensação do zoom. Em telas sem espaço suficiente ela diminui ou
fica oculta para preservar os controles. O minimapa não recebe eventos de toque
e fica oculto durante o menu do gerador.

Ao encerrar a cena, a textura da janela, os elementos da interface e o listener
de `pagehide` são removidos. Apenas o atlas estático compartilhado e a exploração
da sessão permanecem disponíveis para o retorno ao mapa.

## Verificação automática

Execute na raiz do projeto:

```sh
node --test js/ui/MiniMap.test.mjs
```

Os testes cobrem os dois JSONs reais, coordenadas negativas, leitura sem mutação,
transformação proporcional, paredes e polígonos, portas dinâmicas, saves
compactados, zoom, orientação, diagnóstico de camadas ausentes e limites de RAM.
O desempenho e os gestos em aparelhos físicos devem ser conferidos no celular.
