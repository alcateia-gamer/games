# Gerador cooperativo

O painel continua individual (abrir um não interrompe o aliado), mas os encaixes
pertencem ao gerador da equipe. Um jogador pode arrastar sua bateria e o outro o
seu galão cheio. Ambos veem as peças conectadas, e qualquer jogador próximo pode
pressionar LIGAR quando o circuito estiver completo.

No multiplayer, conectar retira a peça do inventário do contribuinte e cria uma
reserva identificada. O host valida remetente, proximidade, estado do jogador,
tipo de encaixe e duplicação antes de publicar o circuito em
`room.coopProgress.generator`. O inventário mantém o modelo local já usado pelo
jogo: a reserva só é criada após `Inventory.removeItems` confirmar a peça; galões
vazios/parciais não são aceitos. A ativação usa as peças depositadas, sem consumir
novamente os inventários dos jogadores.

Fechar/reabrir o painel não desfaz os encaixes. Peças confirmadas também permanecem
quando o contribuinte sai. Uma reserva pendente fica no registry local, pode ser
reenviada com o mesmo ID após perder a confirmação e é reembolsada se o depósito
for rejeitado. Se não houver espaço para devolver a peça, a reserva aguarda espaço.
Não há timers ou listeners próprios nessa sincronização; o runtime existente faz
a atualização. Uma nova partida limpa as reservas juntamente com os inventários.

O host aceita a partida do motor somente após os dois encaixes, grava o horário
uma vez e usa a sincronização existente de energia/som. Painéis abertos mostram
a partida e fecham automaticamente. Snapshots antigos não apagam encaixes. No solo,
o painel mantém a reserva visual e o consumo conjunto na ativação.

Arquivos principais: `js/multiplayer/CoopGenerator.js`, `CoopWorld.js`,
`CoopProtocol.js`, `js/interactions/FactoryGenerator.js`, `FactoryGeneratorPanel.js`
e `js/scenes/BootPartida.js`.

Verificação: 65 testes passaram nas suítes CoopGenerator, FactoryGenerator,
CoopRegression, CoopProtocol, FactoryGeneratorDisplay e InventoryFuel.
`tests/shared-generator.browser.mjs` passou com dois clientes completos e broker
MQTT local: bateria em um inventário, galão no outro, arraste em painéis diferentes,
reabertura sem perder a contribuição, ativação pelo cliente e iluminação/fechamento
sincronizados. Capturas em `/tmp/shared-generator`.
