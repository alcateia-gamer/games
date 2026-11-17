# Sucata da equipe no multiplayer

No cooperativo há um caixa único (`economy.teamWallet.scrap`). A sucata coletada
por qualquer jogador fica disponível para toda a equipe; compras de todos os
jogadores consomem esse mesmo saldo. Os níveis e bônus continuam pertencendo ao
jogador/personagem comprador. HUD e loja identificam o saldo como sucata da equipe.
O solo preserva o saldo individual e os drops anteriores.

O host gera a quantidade de cada drop proporcionalmente ao tamanho atual da sala:

| Jogadores | Multiplicador | Comum / Bola | Serra | Olhão |
| --- | --- | --- | --- | --- |
| 1 | 1× | 1–3 | 2–4 | 4–7 |
| 2 | 2× | 2–6 | 4–8 | 8–14 |
| 3 | 3× | 3–9 | 6–12 | 12–21 |
| 4 | 4× | 4–12 | 8–16 | 16–28 |

O multiplicador aumenta unidades por componente, preservando a renda esperada
por jogador. Chances de drop, preços, limites por zona/campanha e limite de
48 objetos no chão permanecem iguais. Sair da sala ajusta os drops futuros;
o dinheiro já coletado continua na equipe. Não há multiplicação ao coletar:
cada componente credita o caixa uma única vez.

A validação e a transação continuam no host. Coleta duplicada é rejeitada pelo
ID do drop; compras repetidas pelo nível esperado. Duas compras concorrentes
verificam o caixa atualizado e não podem gastá-lo além do saldo.

`enableSharedScrap` converte estados antigos somando os saldos pessoais ao caixa
e zerando os campos anteriores uma única vez. A migração não muda os níveis.
`accountFor` continua sendo a conta de melhorias; `walletFor` retorna o saldo
a utilizar na UI e nas transações. O estado serializado preserva o caixa
nas trocas de mapa e de host.

Validação: 76 testes passaram nas suítes Upgrades, CoopProtocol e CoopRegression.
No Chrome, dois jogos completos com MQTT local confirmaram drop ampliado,
coleta única no caixa compartilhado, atualização do saldo em ambos os clientes
e compra individual da Nyx enquanto Kai continuava no diálogo, sem receber
indevidamente o bônus. Os multiplicadores para 2/3/4 jogadores foram verificados
por testes determinísticos e pelo caminho real de geração de drops do host.
