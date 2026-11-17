# Puzzles de hacking — fábrica e MATRIX

Implementação baseada no prompt de hacking fornecido pelo usuário. Os computadores já existentes no segundo mapa são utilizados diretamente; o mapa, os sprites e os arquivos do boss antigo não foram substituídos. As alterações anteriores de reanimação solo, portas cooperativas e spawns seguros foram preservadas.

## Fluxo no jogo

### Terminal da fábrica — (1032, -1954)

1. Ligue o gerador da fábrica e aproxime-se do computador.
2. Use o botão de interação existente ou **E**. O personagem caminha para um ponto lateral livre; N.O.V.A. vai até o computador.
3. Selecione códigos na matriz 5 × 5. A primeira seleção é na primeira linha; depois alterne coluna e linha, sem reutilizar células.
4. Complete a sequência **PORTAS**. Confirme imediatamente ou continue tentando os dois bônus no mesmo buffer de dez códigos.
5. O bônus de robôs interrompe temporariamente os inimigos; o registro AXIOM fornece uma pista para a memória da MATRIX.

O limite é de 90 segundos, contados a partir da primeira seleção. Falhas permitem reiniciar; sair não concede recompensas. A geração reserva um caminho válido para os três objetivos, e as escolhas continuam exigindo planejamento. O tempo de primeira tentativa pretendido é 45–90 segundos; testes automatizados não substituem uma rodada de avaliação com jogadores.

Todas as portas interativas da fábrica ficam bloqueadas até essa invasão. Concluí-la libera a interação, preservando as condições anteriores de energia, cartão e derrota do boss. Câmeras e mecanismos industriais citados como exemplos no prompt não possuem sistemas de hacking equivalentes no projeto: os objetivos adicionais implementados são interrupção dos robôs e obtenção do registro, com consequências reais.

### Registro recuperado no mesmo computador

Depois de concluir o primeiro puzzle, o terminal passa a mostrar **REGISTRO DA AXIOM · LER**. Aproxime-se e use **E** ou o botão de interação para abrir o arquivo e reler quando quiser. Essa consulta fica disponível após liberar as portas, incluindo a pista dos 04 segundos. O objetivo opcional de extração continua habilitando a mensagem automática ao entrar na MATRIX.

O texto é apresentado como cinco fragmentos censurados de uma pessoa da equipe original, agora escondida das máquinas: as guerras e o colapso do abastecimento que motivaram a criação da AXIOM; a transformação das recomendações em controle; o Reset; as pessoas presas ao EDEN; a falha escondida na memória e uma última gravação interrompida. A anotação na margem orienta comparar **VISUAL** e **REDE** no instante de **04 segundos**. A fonte narrativa é o GDD e o diálogo atual de The Hollow (`js/narrative/HollowDialogue.js`), respeitando a preservação do suporte à vida e o despertar gradual.

O autor é anônimo e suas datas foram suprimidas; as anotações são um novo texto ficcional para esse arquivo. As censuras são estáticas, deixando o conteúdo recuperável legível. Há rolagem em telas pequenas e botões de fechamento sempre acessíveis. **Esc** também fecha a leitura.

A leitura conserva o progresso e as recompensas. No solo, pausa o mundo enquanto estiver aberta; no cooperativo, cada jogador pode consultar o registro localmente e os demais continuam jogando. Fechar, morrer, desconectar ou sair da cena limpa a interface e restaura os controles.

### Terminal final — (-242, -5882)

Disponível depois da invasão da fábrica **e da morte do boss**. O personagem se posiciona ao lado e N.O.V.A. opera o computador. A MATRIX abre como uma cena jogável própria, com plataformas, passagens e movimentação contínua do robô.

- **Memória:** vá ao arquivo, percorra a linha do tempo e examine o evento em 04 segundos nas camadas visual e de rede. A divergência entre a porta fechada e o token negado revela a vulnerabilidade.
- **Anomalia:** a conexão aparece e desaparece, alterando o piso realmente atravessável. A plataforma permite estabilizá-la por dez segundos.
- **Infraestrutura:** isole os circuitos vitais A e B e ative a comunicação para o despertar gradual. Esses circuitos continuam alimentando as pessoas.
- **Roteador:** escolha entre uma rota vital insegura, uma conexão direta protegida por ICE ou o desvio inferior. Uma tentativa de enviar o vírus à infraestrutura vital é contida com falha recuperável, sem dano humano.
- **Vírus Zero:** libere-o na entrada. Ele percorre as conexões automaticamente; as decisões do jogador abrem o caminho até o núcleo.
- **ICE:** barreira com fases visíveis de abertura, aviso e bloqueio; interceptador em patrulha; rastreamento progressivo. O abrigo reduz o rastro e interrompe o interceptador temporariamente. Uma interceptação devolve N.O.V.A. à entrada ou recua o pacote do vírus.
- **Conclusão:** o núcleo só é acessível com os dois isoladores e a comunicação ativos. A execução transforma progressivamente a rede, inicia o despertar e apresenta a conclusão da partida. AXIOM continua mantendo o suporte à vida.

Controles: **WASD/setas**, **E** para ação e **Esc** para sair; no celular, direcional e botões por toque. A câmera acompanha N.O.V.A. em telas pequenas. O registro tem rolagem própria em telas horizontais baixas. Na fábrica, células e botões mantêm áreas de toque de pelo menos 44 pixels CSS nas proporções verificadas.

## Integração e estados

A interação reutiliza o seletor de proximidade de `ItemPickup`, o registro de progresso do Phaser, as condições de `FactoryDoor`, o pet existente e os sons do leitor de cartão. O posicionamento lateral valida o corpo e o trajeto contra as colisões do mapa; se não houver trajeto livre, mantém uma posição segura em vez de atravessar paredes.

No solo, o mundo físico pausa durante o hacking. No cooperativo, somente o operador fica reservado; os demais continuam jogando. O host simula ambos os puzzles, valida o dono, a sessão e a sequência dos comandos e compartilha os resultados. Um cliente não pode conceder a si mesmo a conclusão nem abrir portas bloqueadas. Como o cooperativo não cria normalmente o pet, há um N.O.V.A. temporário no terminal do operador, replicado pelos visuais existentes e removido ao sair.

Movimentos da MATRIX aproveitam os snapshots regulares do mundo; decisões e encerramentos usam as ações confiáveis existentes. Uma revisão crescente impede que um snapshot anterior ao cancelamento reabra a interface. Não foi criado um transporte de rede paralelo.

Cancelar, morrer, desconectar, mudar de cena ou migrar a autoridade encerra a sessão e restaura os controles. Repetições e comandos de sessões antigas não duplicam recompensas. O HUD normal fica oculto durante a MATRIX. Interfaces, eventos e pet temporário são limpos ao fechar.

Na tela do operador, a cena da fábrica deixa de ser desenhada enquanto a MATRIX cobre o jogo. Ela continua ativa para lógica e rede; a visibilidade original é restaurada ao sair. As telas dos outros jogadores permanecem normais.

Progresso de partida: `factoryHackingComplete`, `factoryHackingRobots`, `factoryHackingIntel`, `matrixZeroComplete`. O início de uma nova partida limpa esses indicadores. Eventos locais: `hacking:fabrica-concluida` e `hacking:matrix-concluida`. Ações cooperativas: `hacking` e `hackingState`, além dos snapshots já existentes.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `js/puzzles/HackingConfig.js` | Terminais, chaves de progresso e arquitetura digital. |
| `js/puzzles/BreachPuzzle.js` | Geração, alternância, buffer, objetivos e tempo. |
| `js/puzzles/MatrixPuzzle.js` | Exploração, memória, conexões, vida, vírus e ICE. |
| `js/puzzles/HackingSession.js` | Operador único, comandos e conclusão idempotente. |
| `js/interactions/FactoryHacking.js` | Integração com mundo, progressão, multiplayer e conclusão. |
| `js/interactions/HackingPetDock.js` | Movimento lateral seguro e pet no terminal. |
| `js/ui/HackingPanel.js` | Interface responsiva da matriz de códigos. |
| `js/ui/HackingRecordPanel.js` | Diário censurado sobre a AXIOM, contexto do projeto e pista consultável. |
| `js/ui/MatrixPuzzleUI.js` | Controles por toque, investigação e feedback da MATRIX. |
| `js/scenes/MatrixHacking.js` | Ambiente digital jogável e efeitos de conclusão. |
| `js/puzzles/HackingPuzzles.test.mjs` | Regras, geração, rotas, ICE, falhas e sessões. |
| `tests/hacking-browser-helpers.mjs` | Inicialização e interação real para testes. |
| `tests/hacking-puzzles.browser.mjs` | Fluxo solo completo e telas móveis. |
| `tests/hacking-coop.browser.mjs` | Duas instâncias reais com MQTT local. |
| `tests/hacking-record-fixture.mjs` | Cena Phaser/Arcade leve usando o controlador real para testar a consulta. |
| `tests/hacking-record.browser.mjs` | Texto, telas, releitura, controles e encerramento do registro. |
| `docs/puzzles-hacking.md` | Este relatório e roteiro de validação. |
| `debug/hacking-validation/.gitignore` | Mantém ferramentas, capturas e logs locais fora do versionamento. |

## Arquivos existentes modificados nesta tarefa

| Arquivo | Alteração dos puzzles |
| --- | --- |
| `js/scenes/Level1Parte2.js` | Cria e atualiza os terminais antes do combate. |
| `js/scenes/BootPartida.js` | Limpa progresso dos puzzles na nova partida. |
| `js/scenes/DeathScreen.js` | Cancela hacking antes de iniciar o fluxo de morte/reanimação. |
| `js/interactions/FactoryDoor.js` | Bloqueio anterior ao hacking, inclusive abertura por rede. |
| `js/interactions/FactoryDoor.test.mjs` | Regressão do bloqueio e das condições originais. |
| `js/inventory/ItemPickup.js` | Inclui terminais no botão/E de interação existente. |
| `js/player/CompanionPet.js` | Reserva do pet no computador e limpeza ao destruí-lo. |
| `js/multiplayer/CoopPlayers.js` | Conserva o posicionamento reservado do operador no host. |
| `js/multiplayer/CoopWorld.js` | Autoridade, ações, progresso e snapshots dos puzzles. |
| `js/multiplayer/CoopRegression.test.mjs` | Rejeita conclusão forjada e abertura indevida por cliente. |

Outros arquivos já modificados no workspace pertencem às tarefas anteriores, não à implementação dos puzzles.

## Arte, áudio e manutenção

Os terminais e N.O.V.A. usam os recursos existentes. A arquitetura digital, os fragmentos e as mudanças da rede são desenhados pelo Phaser; não há arte externa obrigatória faltando. Sons existentes de acesso/negação dão feedback ao terminal. Falas são apresentadas em texto, sem novos arquivos de dublagem. Uma trilha exclusiva e arte dedicada podem ser acrescentadas posteriormente, sem impedir o funcionamento atual.

Melhorias futuras recomendadas: testar a dificuldade com jogadores de primeira viagem, medir latência em aparelhos físicos e em redes móveis, e ajustar tempos/ICE após essa avaliação. Não há afirmação de desempenho em aparelhos ou brokers públicos não medidos.

## Verificação

Os roteiros de navegador usam o jogo real. O posicionamento inicial e a derrota do boss são acelerados apenas no teste; seleção de códigos, botões, investigação, movimentação digital e progresso passam pelas interfaces e pela autoridade do jogo.

O percurso solo usa teclado e toque. No cooperativo há uma verificação de teclado nativo; o percurso final extenso usa pulsos no controlador público de movimento do cliente e aguarda a confirmação do host antes de cada parada. Isso testa o transporte e a simulação completos sem confundir atraso entre dois navegadores com teclas intencionalmente mantidas pressionadas pela automação. Nenhuma posição digital é teleportada ou escrita diretamente.

```sh
node js/puzzles/HackingPuzzles.test.mjs
node js/multiplayer/CoopRegression.test.mjs
node js/interactions/FactoryDoor.test.mjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Em outro terminal, com Playwright/Chromium instalados fora do repositório:

```sh
PLAYWRIGHT_MODULE=/caminho/playwright-core/index.mjs CHROMIUM_PATH=/caminho/chrome node tests/hacking-puzzles.browser.mjs
HACKING_TEST_TOOLS=/caminho/ferramentas CHROMIUM_PATH=/caminho/chrome node tests/hacking-coop.browser.mjs
HACKING_COOP_FINISH=1 HACKING_TEST_TOOLS=/caminho/ferramentas CHROMIUM_PATH=/caminho/chrome ARTIFACT_DIR=/tmp/hacking-coop-final node tests/hacking-coop.browser.mjs
```

O teste cooperativo usa `playwright-core`, `aedes@0.51.3`, `ws` e `mqtt`, com broker WebSocket local na porta 18884. `BASE_URL` e `ARTIFACT_DIR` são configuráveis. Não é necessário alterar o broker de produção.

### Resultados de lógica e regressão

- `HackingPuzzles.test.mjs`: **10/10**. Inclui cem sementes, seleção, tempo, objetivos opcionais, sessão única, percurso final, isolamento vital, ICE e falhas.
- `CoopRegression.test.mjs`: **27/27**, incluindo rejeição de progresso de hacking forjado por cliente.
- `FactoryDoor.test.mjs`: **52/53**. O novo teste do bloqueio por hacking passa; a falha preexistente compara coordenadas antigas da colisão do leitor com o mapa atual.
- Suíte geral: **123/127 arquivos passam**. Continuam falhando os mesmos quatro arquivos já identificados antes dos puzzles: `FactoryLighting.test.mjs`, `FactoryDoor.test.mjs`, `PlayerCollisionConfig.test.mjs` e `interacoesSerra.test.mjs`. São divergências anteriores de iluminação/coordenadas/configuração e recurso de áudio ausente; não foram alterados para mascarar o resultado.

### Resultado solo no navegador

Fluxo completo aprovado com Chromium: botão real de interação, pet no terminal, cancelamento e restauração, timeout e nova tentativa, morte durante hacking seguida da reanimação solo existente, objetivos opcionais, porta abrindo, restrição do terminal final antes da morte do boss, investigação, exploração contínua, vírus até o núcleo e conclusão. Sem erros JavaScript de página.

Interfaces verificadas em **1100 × 700**, **568 × 320** e **390 × 844**; o percurso completo da MATRIX foi executado em 568 × 320. Inspeção visual das capturas confirmou pet, grade, registro, circuitos, transformação da rede e conclusão. Registros e capturas finais em `debug/hacking-validation/solo/`, reproduzíveis pelo roteiro de teste com `ARTIFACT_DIR`.

### Resultado cooperativo — conclusão

Percurso completo aprovado com duas instâncias Phaser e MQTT/WebSocket local: cliente como operador, exclusividade, N.O.V.A. temporário no computador, cancelamento, rejeição de snapshot atrasado, resolução dos três objetivos da fábrica e progresso idêntico nos dois jogadores. Na MATRIX, teclado nativo com simulação no host, fechamento/reabertura, restauração da visibilidade da fábrica, exploração, investigação, roteador, dois isoladores, comunicação e condução do vírus pelo cliente. O host validou o núcleo e **ambas as telas apresentaram a missão concluída**. Sem erros JavaScript de página.

A revisão final corrigiu uma reserva que permanecia após a vitória. Uma nova execução completa verificou que o dock é liberado, o contexto do operador sai de hacking e o pet temporário do cooperativo é destruído antes de exibir a conclusão.

A passagem solo foi repetida após essa correção e confirmou também o dock vazio e o pet original fora do estado de hacking na vitória. As três execuções finais terminaram com código zero: conclusão cooperativa, desconexão cooperativa e percurso solo. Resultados consolidados em `debug/hacking-validation/resultados.json` e logs de lógica em `*-unit.log`. A checagem de sintaxe dos doze módulos/scripts novos e `git diff --check` também passaram; não há exclusões, renomeações ou alterações em `assets/` e `Tilesets/` nesta tarefa.

O ambiente reiniciou durante a bateria de verificação e apagou os primeiros arquivos temporários. A execução final passou a guardar os resultados em `debug/hacking-validation/`: `coop-final/relatorio.json`, capturas, logs e dependências de teste ficam nessa pasta ignorada pelo Git. Não há dependências adicionais no jogo de produção. O teste final utiliza Chromium Headless Shell, com o mesmo renderizador WebGL configurado no jogo.

### Resultado cooperativo — desconexão

Uma segunda execução independente confirmou a saída do operador da sala durante a MATRIX: a sessão do host encerra, a interface do cliente fecha, os controles são liberados e a conclusão final não é concedida. O cancelamento anterior também restaurou a visibilidade da fábrica. Relatório em `debug/hacking-validation/coop-disconnect/relatorio.json`; sem erros JavaScript de página.

### Ampliação — diário consultável após o primeiro puzzle

- Arquivos desta ampliação: novo `js/ui/HackingRecordPanel.js`; integração em `js/interactions/FactoryHacking.js`; extensão dos roteiros solo/cooperativo e novas fixtures de leitura listadas acima; este relatório.
- Texto em cinco fragmentos, com autoria/datas censuradas, contexto das guerras, início do projeto, Reset, EDEN, anotação sobre as camadas da memória e gravação final interrompida. A consulta local contém a pista mesmo quando o jogador conclui apenas o objetivo obrigatório.
- **37 testes de lógica/regressão passaram**: dez de hacking e 27 de cooperativo.
- O roteiro completo do jogo verificou a abertura após a vitória do primeiro puzzle, releitura, três termos da pista, orientações, preservação do progresso e morte com reanimação. Encontrou um erro ao fechar a cena depois de a física ser encerrada; o fechamento foi corrigido para respeitar o ciclo de vida do Phaser.
- As novas execuções completas excederam a memória disponível do ambiente. A validação final focada usou **Phaser e Arcade reais**, o controlador de produção e o painel de produção, em uma cena pequena. O progresso inicial e os contextos de conexão são fixtures; esse teste não representa uma nova medição do transporte MQTT.
- `tests/hacking-record.browser.mjs` passou: 1100 × 700, 568 × 320 e 390 × 844; texto final, rolagem, botões com pelo menos 44 pixels, tecla E, fechamento por Esc/botões, releitura, progresso preservado, morte, shutdown, consultas independentes em contextos cooperativos e fechamento por desconexão. **Zero erros JavaScript.** Capturas e relatório em `debug/hacking-validation/record-fixture/`.

Para reproduzir a validação leve, com servidor local e os mesmos caminhos de Playwright/Chromium descritos acima:

```sh
PLAYWRIGHT_MODULE=/caminho/playwright-core/index.mjs CHROMIUM_PATH=/caminho/chrome node tests/hacking-record.browser.mjs
```

Os roteiros completos mantêm a nova cobertura de leitura. `HACKING_PHASE=factory` limita o roteiro solo à fábrica e ao fechamento de cena; `HACKING_PHASE=records` limita o cooperativo à invasão, às consultas e à desconexão durante a leitura.

### Checklist de entrega

- [x] Análise do prompt, lore, mapas, interação, portas, pet e cooperativo.
- [x] Plano incremental apresentado antes da implementação.
- [x] Terminal da fábrica, bônus e consequências no mundo.
- [x] Posicionamento do personagem e atuação de N.O.V.A.
- [x] MATRIX jogável, memória, anomalia, ICE e condução do vírus.
- [x] Isolamento vital e conclusão coerente com a lore.
- [x] Autoridade de host, operador único e sincronização.
- [x] Testes de lógica e regressão dos puzzles.
- [x] Navegador: fluxo solo completo, toque, orientações e proporções de tela.
- [x] Navegador: resolução pelo cliente, autoridade do host e conclusão nos dois jogadores.
- [x] Navegador: cancelamento, restauração, morte, nova tentativa e desconexão.
- [x] Nova verificação de limpeza do pet/dock na vitória solo e cooperativa.
- [x] Suíte geral revisada; quatro arquivos com falhas anteriores documentados acima.
- [x] Relatório, limitações e roteiro de testes finalizados; originais preservados.
- [x] Ampliação: diário censurado consultável no mesmo computador, com pista e contexto do projeto.
- [x] Ampliação: leitura e limpeza validadas no Phaser, inclusive na troca de cena e desconexão.
