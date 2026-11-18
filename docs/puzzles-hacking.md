# NULLNET — puzzles e reformulação da AXIOM

## Experiência atual

O terminal da fábrica mantém o Breach Protocol, os arquivos de Elias Voss e seus bônus. O computador industrial existente em **(-378, -2996)** mantém o BruteForce de oito colunas verticais, com a velocidade já ajustada para 3×. Nenhum sprite adicional de computador foi criado. A entrada do SENTINEL exige tanto cartão autenticado quanto BruteForce concluído. Mapas, combate e funcionamento do SENTINEL não foram alterados nesta reformulação.

Depois da batalha, o terminal final abre **AXIOM // MEMORY DECRYPTION**. O jogador vê os três arquivos, quantos recuperou e somente o objetivo atual. Não há roteadores, conexões editáveis, classificações ocultas, diagnóstico de rotas ou timer no Memory Decryption.

1. **Identificação:** tocar no servidor de processamento central entre três alternativas. Os identificadores vêm da missão. A ordem varia entre sessões e muda após erro, sem apagar acertos anteriores.
2. **Integridade:** marcar os dois módulos SEC e executar isolamento. LIFE e BIO nunca são desligados: qualquer configuração que os inclua é rejeitada. O contorno ciano indica seleção.
3. **Autorização:** tocar nos três fragmentos na ordem documentada. Tocar numa posição remove o fragmento; “Limpar sequência” permite recomeçar. A confirmação depende da assinatura gerada para a missão.

Os registros LEVEL 5 do Breach explicam CORE/SEC/LIFE/BIO e fornecem o selo final. O arquivo LEVEL 7 do BruteForce contém os dois primeiros fragmentos, sua ordem e o endereço numérico do host. Os documentos e validadores recebem a mesma configuração. A história de Voss, sua fuga pela manutenção e a descoberta sobre o EDEN continuam nos arquivos. NULLNET exibe cada grupo de documentos somente quando a flag de conclusão do terminal correspondente está confirmada; os demais permanecem como CRIPTOGRAFADO, inclusive na consulta feita durante Memory Decryption.

“CONSULTAR REGISTROS” abre o banco existente na categoria relevante, preservando escolhas e arquivos. Cada etapa apresenta uma instrução e orientação curta da N.O.V.A. O botão “Como jogar” abre uma única ilustração da etapa atual, operada por toque. Não há tutorial longo automático no terminal final; os tutoriais da fábrica continuam disponíveis na entrada. A ajuda pausa o modelo autoritativo. Erros repetidos recebem sugestão de consulta e depois uma pista contextual, sem resolver o módulo automaticamente.

## HOST e encerramento

Após três arquivos, uma transição de 900 ms apresenta INITIALIZING HOST CONNECTION. O **HOST CONNECTION** exibe quatro linhas de oito números. A matriz avança uma casa à direita a cada 1000 ms; ao ultrapassar a última coluna, o número passa ao início da linha de cima. Depois do topo, reaparece na base. Não há deslizamento contínuo nem velocidades diferentes por linha. O jogador toca no primeiro número do grupo de quatro e confirma. O alvo é derivado dos dados da missão e consta nos registros. Erros permitem repetir essa busca, preservando Memory Decryption.

Uma única seleção correta estabelece a conexão. Foram removidas as seis buscas adicionais de assinatura/sincronização. A transmissão existente dura 6,5 segundos e conclui a campanha com o Vírus Zero e suporte vital preservado. O evento final mantém o nome existente `hacking:matrix-concluida`; não foi criada outra sequência de encerramento.

## Estado e multiplayer

`HackingSession` continua sendo a autoridade: um operador, identificador de sessão, sequência crescente de comandos e recompensa idempotente. O host valida todas as respostas. Os espectadores continuam podendo consultar NULLNET sem pausar o mundo cooperativo. Animações permanecem locais e interpolam snapshots existentes.

O checkpoint canônico é `{ memoryModules: 0..3, hostConnected: boolean }`. Cada módulo e a captura do HOST são salvos no próprio comando, antes do frame seguinte. Cancelar libera o terminal e outro jogador retoma o próximo módulo. Seleções incompletas não são checkpoints. Réplicas antigas não reduzem arquivos recuperados. O novo host reconstrói a sessão a partir dos dados compartilhados após desconexão.

`memoryDecryptionComplete` substitui `networkReconstructionComplete`. O formato anterior `{network, hostPasso}` é convertido: rede concluída corresponde aos três arquivos recuperados; buscas HOST antigas ainda incompletas retomam a nova busca única; sete buscas antigas concluídas retomam a transmissão. A flag antiga é convertida/removida, e uma campanha nova limpa ambos os nomes. Configurações anteriores continuam utilizáveis.

O salvamento segue a infraestrutura atual: registry da campanha e progresso da sala. Não foi acrescentada persistência de campanha após fechar/recarregar o navegador. Durante uma nova campanha os estados são reiniciados.

## Arquivos desta reformulação

Criados:

- `js/puzzles/MemoryDecryption.js`: objetivos, validações e ajuda progressiva.
- `js/puzzles/HackingProgress.js`: checkpoint único e migração.
- `js/ui/MemoryDecryptionPanel.js`: módulos, escolhas e interação por toque.
- `tests/memory-decryption.browser.mjs`: erros, escolhas, registros e transição pela interface real.

Adaptados:

- `js/puzzles/CoreInvasion.js`, `HostConnection.js`, `HackingSession.js`, `MissionIntelligence.js`, `HackingConfig.js`.
- `js/ui/CoreInvasionPanel.js`, `HackConnectPanel.js`, `HackingRecordPanel.js`, `NullnetPanel.js`, `PuzzleTutorial.js`.
- `js/interactions/FactoryHacking.js`, `js/multiplayer/CoopProtocol.js`, `js/multiplayer/CoopRuntime.js`, `js/scenes/BootPartida.js`.
- Testes `CoreInvasion.test.mjs`, `HackingMotion.test.mjs`, `PuzzleTutorial.test.mjs`, `CoopRegression.test.mjs`, `CoopBossLoading.test.mjs`.
- Roteiros `nullnet-browser-helpers.mjs`, `nullnet-campaign.browser.mjs`, `nullnet-coop.browser.mjs`, `puzzle-tutorial-fixture.mjs`, `puzzle-tutorial.browser.mjs`, `hacking-motion.browser.mjs`, `hacking-record.browser.mjs`.
- `README.md` e este documento.

Removidos: `js/puzzles/NetworkReconstruction.js`, renderização/estilos do grafo, tutorial de roteamento e seis buscas extras do HOST. Componentes legados de exploração Matrix que ainda possuem dependências em testes foram preservados fora do fluxo ativo. Não há roteamento antigo oculto no novo terminal.

Alguns arquivos acima já estavam presentes como alterações locais não commitadas. Esta lista descreve a reformulação atual, preservando o trabalho anterior.

## Validação

Os testes unitários podem ser executados com Node 22:

```sh
node --test js/puzzles/CoreInvasion.test.mjs js/puzzles/HackingMotion.test.mjs js/puzzles/PuzzleTutorial.test.mjs js/multiplayer/CoopRegression.test.mjs
```

Os testes de navegador precisam de um servidor HTTP do projeto, Chromium e Playwright. Configure `BASE_URL`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `ARTIFACT_DIR`; o cooperativo também usa `HACKING_TEST_TOOLS` com aedes/ws/mqtt. `NULLNET_COOP_DISCONNECT=1` verifica migração de host após dois arquivos recuperados.

A suíte geral executada abrangeu 139 arquivos: **135 passaram e 4 falharam**. As falhas já existiam antes da reformulação: `DeveloperBoss.test.mjs` (fixture sem `generator.receive`), `FactoryLighting.test.mjs` (asserções de iluminação), `PlayerCollisionConfig.test.mjs` (dimensões de colisão) e `interacoesSerra.test.mjs` (assets de áudio ausentes). Esses subsistemas não foram alterados para maquiar o resultado.

O balanceamento de aproximadamente dois minutos é uma meta, não uma duração obrigatória: leitura, decisões e velocidade individual variam. Não foram impostos atrasos artificiais nos três arquivos. Testes de campanha aceleram deslocamentos, recursos e combate; ações dos puzzles e encerramento passam pelas interfaces e validadores reais.

Verificações concluídas nesta execução:

- Lógica: 300 sementes do Memory Decryption, erros locais, validação da autorização, migração de flags e checkpoints, salvamento imediato, operadores e evento final único; movimento e validação temporal do BruteForce/HOST; tutoriais e porta do boss passaram nos sete arquivos de regressão direcionados.
- Navegador: os seis guias passaram por toque em 390×844, 568×320 e desktop. Memory Decryption passou com erros, dicas, consulta sem perda, seleção de SEC, remoção/limpeza de fragmentos e transição sem tutorial automático.
- Movimento: oito colunas do BruteForce e quatro linhas do HOST se moveram, aceitaram seleção por toque e descartaram seus elementos ao fechar.
- Registros: leitura, três layouts, retorno, controles, morte, shutdown e consulta independente em contextos cooperativos passaram.
- Campanha Phaser solo: Breach, BruteForce completo, cancelamento, computador sem sprite extra na coordenada exigida, cartão e portas, três arquivos, checkpoint ao reabrir, uma captura HOST e encerramento passaram, sem erros JavaScript capturados.
- Duas instâncias Phaser com MQTT local: Breach e BruteForce pelo cliente, operador exclusivo, réplica antiga rejeitada, documentos compartilhados, cartão e colisões das portas, SENTINEL, dois arquivos concluídos pelo cliente, retomada pelo host, HOST e final em ambas as telas passaram, sem erros JavaScript capturados.

No primeiro ensaio da campanha, a automação errou repetidamente o toque na letra do BruteForce por aguardar a estabilidade do botão depois da janela visual. O roteiro foi ajustado para observar a letra renderizada e tocar diretamente na coordenada do botão. A mecânica e a velocidade do BruteForce permaneceram intactas; a campanha passou na reexecução.


O teste de migração também revelou uma falha de integração anterior: a promoção do cliente descartava a réplica do SENTINEL e criava um encontro vivo, bloqueando o terminal apesar dos arquivos já recuperados. `CoopRuntime.changeAuthority` agora conserva a derrota já confirmada, encerra os recursos recém-preparados e não repete combate, recompensa ou evento de derrota. Os 51 casos direcionados de preparação do boss e regressão cooperativa passaram após a correção. Como no ciclo de migração existente, a réplica visual anterior é descartada; o encontro derrotado permanece como estado encerrado.

A reexecução com `NULLNET_COOP_DISCONNECT=1` passou após essa correção: host operador saiu com dois arquivos recuperados, o cliente assumiu a autoridade, reabriu no terceiro arquivo, concluiu uma busca HOST e chegou ao encerramento. A configuração da missão e os checkpoints foram preservados, sem erros JavaScript capturados. A suíte geral final repetiu o resultado de 135/139 arquivos, com as mesmas quatro falhas anteriores.


Ajuste de movimento do HOST: `HostConnection.js` centraliza o percurso circular de 32 células e o intervalo de 1000 ms, compartilhado por validação e interface. `HackConnectPanel.js` reutiliza 32 botões estáveis e move suas posições em passos. A seleção acompanha os mesmos quatro números entre linhas. Testes cobrem os limites de 999/1000 ms, subida, retorno à base, ciclo completo e ausência de sobreposição.
