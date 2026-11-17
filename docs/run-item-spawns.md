# Sorteio dos itens de missão por partida

A camada `Coletaveis` (ou `Itens`) do Tiled define os candidatos por propriedade
`ItemID`. A cidade tem quatro pontos de `gasolina` e quatro de `bateria`;
a fábrica tem quatro pontos de `card`. O jogo cria **um objeto por tipo**, não
um objeto em cada ponto. Não há chance de sorteio vazio.

`js/inventory/RunItemSpawns.js` filtra posições, quantidade e alcance inválidos
antes da escolha. Se não restar candidato de um item obrigatório, usa o ponto
original desse item como reserva. Outros itens e objetos continuam com o
comportamento anterior. Os mapas e suas posições não são alterados.

No solo, uma semente fica no registry até começar outra partida em `BootPartida`.
No multiplayer, o host gera `room.itemSpawnSeed` ao iniciar o jogo, e o estado
existente da sala distribui esse valor. Todos os clientes escolhem os mesmos
objetos, independentemente da ordem de carregamento. A semente persiste na troca
de mapas e de autoridade. A coleta continua sendo validada pelo host.

`BootPartida` limpa a semente solo e os inventários da partida anterior, incluindo
IDs coletados. Visitar novamente um mapa durante a mesma run mantém a escolha e
não recria o item coletado. Uma nova run refaz o sorteio; o acaso pode escolher o
mesmo ponto da run anterior.

Para adicionar outros locais, basta duplicar o objeto no Tiled e manter seu
`ItemID`. A seleção passa a considerar todos os candidatos válidos automaticamente.
As imagens continuam usando os assets e o carregamento existentes.

Verificação:

- `node js/inventory/RunItemSpawns.test.mjs`: mil sementes nos mapas reais,
  cobertura dos 12 pontos, um item garantido por tipo, ordem de carregamento,
  candidatos inválidos, reserva e isolamento da semente por partida.
- `node tests/run-item-spawns.browser.mjs`: criação real, coleta, reinício do mapa,
  nova run e igualdade de posições entre dois clientes MQTT. Usa o mesmo ambiente
  de testes descrito em `docs/upgrade-dialogue.md`.

Resultados: 56 testes unitários/regressão passaram (RunItemSpawns, ItemPickup,
Inventory, CoopProtocol e CoopRegression). O teste no Chrome também passou no solo,
no reinício do mapa, em nova run e com dois clientes completos em broker MQTT local.
