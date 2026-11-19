# Porta do boss e equipe viva — 19/11/2026

Correção implementada sobre o workspace existente. Foram preservadas as alterações anteriores dos robôs e dos mapas.

## Causa real

`CoopBossLoading.confirmCard()` validava o solicitante, a distância, a energia e o cartão, mas não a vida dos demais participantes. Chamava `abrirPortasArenaAposCartao()`, que persistia `bossAccessCardAuthenticated` e iniciava a abertura física antes de `assemble()` impedir a reunião de uma equipe com caídos.

A atualização automática de `FactoryDoor` também podia chamar `releaseAccess()` por conta própria quando as credenciais estavam completas. Os helpers de abertura e a aplicação de flags não tinham a mesma verificação coletiva. Além disso, a criação das portas ocorre antes do runtime multiplayer: esse intervalo não pode ser interpretado como uma partida solo.

## Validação centralizada

A função `verificarEquipeViva(runtime)`, exportada por `CoopRevival.js`, consulta a lista **atual** de `manager.room.players` e cruza:

- Vida e morte publicadas na sala.
- Os participantes e identificadores de queda do sistema existente de revivida.
- Vida e transição de morte dos contextos de combate do host.
- Estado dos atores e das representações remotas.

Morte, vida zerada, queda pendente ou transição de morte negam acesso. Um estado ausente, sem vida finita confirmada ou divergente também não autoriza a abertura. Um sprite ativo, isoladamente, não comprova que o jogador está vivo. Jogadores removidos da lista vigente não são inventados como participantes pendentes.

Essa consulta não modifica o sistema de resgate. O tempo de três segundos, a proximidade, as animações, a restauração de vida e a sincronização da revivida permanecem iguais.

## Caminhos de abertura analisados

| Caminho | Tratamento |
| --- | --- |
| Leitor e painel local | A tentativa apresenta a fala antes de abrir o painel quando a equipe já está indisponível. |
| Confirmação assíncrona após a animação | O callback original chega a `confirmCard()`, que verifica novamente a equipe no host antes da autenticação e abertura. |
| Solicitação `bossAccess` | Host valida solicitante, posição, cartão e equipe; sala, mapa e sessão impedem reaproveitar solicitações de outra visita. |
| API anterior `doorOpen` para `porta02`/`porta03` | Continua encaminhada a `confirmCard()` e, portanto, à mesma validação do host. |
| `releaseAccess()` e atualização automática | Recusam sem equipe viva; não iniciam preparação ou fala repetida por frame. |
| `abrirPortasArenaAposCartao()` | Valida host e equipe antes de gravar `bossAccessCardAuthenticated`. |
| `liberarPortasArenaAutorizadas()` | Valida host e equipe antes de iniciar qualquer persiana. |
| `porta.abrirPelaRede()` | O início físico de uma nova abertura da arena também exige host e equipe viva. |
| `CoopWorld.applyFlags()` | No host, flags de portas não criam nova entrada enquanto a equipe está indisponível e não existe preparação autorizada. |
| `porta.aplicarEstadoRede()` | No host, uma persiana fechada não passa a aberta/abrindo com equipe indisponível. Clientes continuam aplicando os estados autorizados do host. |
| Criação antes do runtime | Uma cena multiplayer sem runtime confirmado não libera novas aberturas como se fosse solo. |
| Save, retomada, DEV e transição já autorizada | Preservados os contratos existentes: portas historicamente salvas como abertas não são fechadas sobre jogadores; entrada DEV/retomada não foi confundida com nova autenticação normal pelo leitor. |

Uma tentativa negada não consome cartão, autentica credenciais, anima portas, remove colisões, inicia preparação, teleporta jogadores ou bloqueia a exploração. A checagem não invalida uma credencial que tenha sido legitimamente autenticada antes de uma morte; impede nova autorização e nova abertura enquanto houver caídos. A autenticação física antes da conclusão do BruteForce continua funcionando quando a equipe está viva, preservando a autenticação dupla original.

## Falas no solicitante correto

As mensagens usam `CHARACTER_NAMES`, já existente em `UpgradeDefinitions.js`, com os identificadores reais de Kai Mercer, Magnus, Aria e Nyx. Há variações para um caído, mensagens com dois nomes e mensagens curtas sobre toda a equipe para três caídos. Estados ainda sem confirmação recebem uma fala de espera, sem inventar um companheiro morto.

O balão é o `PlayerSpeechBubble` já pertencente ao leitor. O controle de repetição existente continua ativo. A atualização automática das portas não exibe falas.

Quando a tentativa vem do cliente, o host responde usando a ação **existente** `bossAccess`, com negativa autoritativa e `targetId` do solicitante. A resposta pertence à mesma sala, mapa e sessão. O cliente mostra a fala no próprio personagem; `CoopPlayers.localState()` e a replicação de balões existente a levam aos outros navegadores. Não foi criado outro sistema de falas nem um envio adicional por frame. A negativa também interrompe as retentativas automáticas daquela solicitação.

## Nova tentativa depois da revivida

Não existe uma flag persistente de “equipe recusada”. Cada tentativa consulta novamente os participantes. Depois que a revivida e seus estados publicados concordam, o acesso é permitido normalmente. Foram testadas tanto a nova leitura quanto a preparação coletiva até a autorização da introdução, sem reiniciar a fase.

As proteções existentes para morte durante uma transição já autorizada foram mantidas. Uma abertura em andamento não é revertida fechando uma porta fisicamente sobre os personagens.

## Arquivos modificados nesta correção

| Arquivo | Alteração |
| --- | --- |
| `js/multiplayer/CoopRevival.js` | Consulta centralizada, sem alterar a mecânica de resgate. |
| `js/multiplayer/CoopBossLoading.js` | Guardas do cartão e abertura automática, negativa direcionada, falas e validação de sala/mapa/sessão. |
| `js/interactions/FactoryDoor.js` | Guardas antes da autenticação, início físico e helpers; feedback na tentativa; intervalo anterior ao runtime. |
| `js/multiplayer/CoopWorld.js` | Impede aplicação de flags de portas como nova entrada indevida no host. |
| `js/multiplayer/CoopBossLoading.test.mjs` | Cenários de 2/3/4 jogadores, caídos, solicitações simultâneas, estado divergente, desconexão, negativas e recuperação. |
| `js/interactions/FactoryDoor.test.mjs` | Leitor e confirmação assíncrona reais do módulo, cartão preservado, fala, bypasses e nova tentativa. |
| `tests/boss-door-team.browser.mjs` | Dois jogos completos com MQTT local, falas replicadas, mortes, resgates e portas sincronizadas. |
| `docs/correcao-porta-boss-equipe-viva-2026-11-19.md` | Este relatório. |

Não foi necessário modificar `CoopRuntime`, `CoopPlayers`, `PlayerSpeechBubble`, a interface do painel, os requisitos de hacking ou o boss.

## Testes executados

Node 24.11.1, cada arquivo em processo separado para isolar os mocks globais do Phaser.

| Suíte obrigatória | Resultado |
| --- | --- |
| `CoopBossLoading.test.mjs` | 34 aprovados |
| `CoopRevival.test.mjs` | 8 aprovados |
| `FactoryDoor.test.mjs` | 64 aprovados |
| `CoopRegression.test.mjs` | 32 aprovados |
| `CoopProtocol.test.mjs` | 15 aprovados |

**Obrigatórios: 153 testes aprovados, zero falhas.** A verificação ampliada incluiu todos os testes de `js/multiplayer/` e os atalhos `DeveloperFactory` e `DeveloperBoss`: **13 arquivos, 253 testes aprovados, zero falhas**.

O navegador real `tests/boss-door-team.browser.mjs` passou com dois jogos e broker MQTT/WebSocket local:

1. Cliente Magnus caído: Kai recebe a fala correta; o outro navegador a mostra sobre Kai; cartão intacto e portas fechadas.
2. Host Kai caído: Magnus recebe a fala correta; o host a vê sobre Magnus. A solicitação direta ao host também recebe negativa, sem depender da checagem do cliente.
3. Resgate real pelo sistema existente, respeitando seu tempo, com nova tentativa disponível.
4. Morte durante a leitura do painel real: nenhuma autenticação, abertura ou preparação; cartão preservado.
5. Novo resgate e nova leitura: autenticação, duas portas abertas e colisões removidas em ambos os navegadores.
6. Entrada na arena: recursos prontos, boss visualmente presente e introdução autorizada nos dois navegadores.

Também foi executada uma checagem de navegador em **exploração solo normal da fábrica**: leitura real, fechamento do painel, cartão preservado e duas portas abertas. O roteiro está em `/tmp/boss-door-solo-check.mjs` e o resultado em `/tmp/boss-door-team/solo.json`.

`git diff --check` passou.

Evidências: `/tmp/boss-door-team-unit/summary.json`, logs individuais na mesma pasta, `/tmp/boss-door-team/report.json`, `/tmp/boss-door-team-browser.log`, `/tmp/boss-door-team/equipe-revivida.png` e `/tmp/boss-door-solo-check.log`.

## Limitações e teste preexistente

- O teste existente `tests/factory-card-reader.browser.mjs` também foi executado, mas falha na preparação do cenário: `areas.iniciais[0]` está ausente em sua linha 32. A mesma falha foi reproduzida com as versões anteriores dos quatro módulos modificados. Esse teste completo não foi declarado aprovado. A checagem solo adicional usou a exploração normal, sem depender dessa fixture. Logs: `/tmp/boss-door-solo-browser.log` e `/tmp/boss-door-solo-baseline.log`.
- O teste de navegador desta correção usou dois jogadores. As partidas com três e quatro participantes foram verificadas nos testes unitários.
- O cenário de navegador desativa ataques e a apresentação cinematográfica longa na configuração de teste para isolar a entrada; verifica a preparação e a autorização da introdução. A máquina de estados da introdução, seu compromisso coletivo e os contratos de retomada são cobertos pelas suítes existentes, que passaram.
