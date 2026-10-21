# Minimapa do cenário

`MiniMapManager` recebe a cena, o Tilemap já criado e o perfil `cidade` ou
`fabrica`. Todo o cenário está disponível desde o início, sem descoberta por
proximidade, linha de visão ou progresso salvo. A janela local acompanha o
jogador com escala uniforme, preservando ruas, corredores e coordenadas negativas.

`MiniMapAtlas.js` cria uma planta com fundo grafite e caminhos em verde azulado,
inspirada na referência do Cyberpunk 2077. A moldura fina e a faixa inferior
do nome usam ciano; uma seta verde marca o jogador. Os pisos formam os caminhos
e os trechos vizinhos são agrupados em retângulos maiores. Objetos e suas colisões
não recortam o desenho dos pisos; contornos discretos destacam ruas e corredores
sem divisões entre tiles. Cercas e paredes compridas preservam a separação entre
áreas, com espessura mínima para continuarem visíveis no radar. Colisões pequenas
e corpos de veículos não recortam os pisos. As colisões também identificam ligações
entre asfalto e calçada; sem elas, paredes e construções aproximam essas barreiras.
Texturas, objetos decorativos, sombras e iluminação não entram nessa planta.
Os veículos usam a camada `Vehicles` e os grupos de `ObjAcimaPerso` que encostam
nela, também aceitando o nome `ObjSobPerso`. Os nomes não diferenciam maiúsculas
e minúsculas. A relação entre as coordenadas do mapa e as peças na folha original
identifica cada veículo. A ligação aceita sobreposição ou contato por uma borda
apenas entre peças do mesmo carro; veículos vizinhos continuam separados.
A torre (`TorreTileset`) é excluída, inclusive quando encosta em veículos.
Cada grupo conectado vira um retângulo sólido escuro com um único contorno,
preenchendo recortes e eliminando linhas entre suas partes, sem alterar a máscara
das ruas e calçadas.
Na cidade (fase 1), o asfalto recebe a cor dos caminhos. Calçadas alcançáveis
a partir dele, sem cruzar colisões, recebem a mesma cor e compartilham o contorno,
conectando visualmente os trechos de rua.
Cada trecho conectado de calçada é desenhado inteiro, ignorando recortes de
objetos sobre ele. Calçadas isoladas, pisos internos e marcações decorativas
não são preenchidos, exceto o piso e o tapete da loja de armas. O interior da loja
aparece como uma área sólida com contorno, acompanhando o jogador após o teleporte.
`MiniMapData.js` calcula os limites do mapa e as transformações da interface.
O minimapa não altera os tiles, as colisões ou a câmera do jogo.

O atlas fica em cache por recurso de mapa, com no máximo 1024 pixels no maior
eixo. A janela quadrada mede 86 × 86 pixels, com textura de 172 × 172 pixels
enviada à GPU e moldura de 1 pixel. A janela acompanha o personagem a cada frame,
inclusive em movimentos curtos e no dash. A textura só é reenviada quando a janela
se desloca; parada ou limitada pelas bordas, apenas os marcadores são atualizados.
Robôs comuns e de serra dentro da janela aparecem como
pontos vermelhos com uma seta na direção em que olham. Os marcadores acompanham
movimento e mudanças de direção mesmo com o jogador parado, e somem ao morrer
ou sair da janela. Também usam os estados dos robôs remotos no multiplayer.
Itens coletáveis aparecem como exclamações amarelas com contorno escuro. O mesmo
ícone flutua acima do item no cenário, mas permanece fixo na posição do chão no
minimapa. Os dois avisos desaparecem ao recolher o item.
Um raio amarelo fixo marca o centro da área de interação do gerador e desaparece
quando a luz da fábrica acende. A escala local de 0,09 mostra aproximadamente 956 pixels do cenário
por lado na janela de 86 pixels.
Uma katana amarela marca a entrada da loja de armas na cidade,
acompanhando as coordenadas do teleporte de entrada.
Uma lupa amarela fixa marca o ponto X=26, Y=-219 no minimapa da cidade.
Ela desaparece quando o jogador passa a até 32 pixels do ponto e continua oculta
ao se afastar.
Não há acesso ao armazenamento de exploração antigo.

O posicionamento utiliza o listener de controles fixos em `PlayerInput.js`.
A moldura fica no canto superior direito, a 12 pixels das bordas. O nome da área
fica centralizado abaixo do mapa, sem indicador N. O DEV fica 12 pixels abaixo
do conjunto, com compensação do zoom. Em telas sem espaço suficiente
ela diminui ou fica oculta para preservar os controles. O minimapa não recebe
eventos de toque e fica oculto durante o menu do gerador.

Ao encerrar a cena, a textura da janela, os elementos da interface e seus
listeners são removidos. O atlas estático compartilhado permanece disponível
para o retorno ao mapa.

## Verificação automática

```sh
node --test js/ui/MiniMap.test.mjs
```

Os testes cobrem os dois JSONs reais, coordenadas negativas, leitura sem mutação,
transformação proporcional, zoom, orientação, caminhos, agrupamento dos pisos
e exibição de áreas ainda não visitadas. Os substitutos de canvas e
Phaser verificam chamadas de desenho sem executar a renderização do navegador.
