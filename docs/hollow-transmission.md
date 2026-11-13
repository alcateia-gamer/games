# Transmissão The Hollow — Protocolo Zero

A seleção continua passando `personagem` e `multiplayer` para `BootPartida`. A mesma instância de `CutsceneLoading` passa ao `preloader`, que carrega os recursos em paralelo. O evento `ended` do MP4 agora abre a conversa dentro de `.cutscene-television-screen`. A arte da TV, o vídeo e o dimensionamento de `CutsceneTelevision`/`fitCutscene` são preservados.

## Componentes

- `js/narrative/HollowDialogue.js`: roteiro comum, seis respostas oficiais por agente e composição determinística. Usa os IDs reais `kai-mercer`, `magnus-force`, `aria-kade`, `nyx`. O nome narrativo de Magnus é Forge; seu ID histórico não muda. Todos confirmam presença; os outros pontos distribuem respostas em rotação. N.O.V.A aparece somente no solo.
- `js/narrative/HollowTransmission.js`: relógio, avanço, suporte de áudio e coordenação com a sala existente. Sem eventos de rede por mensagem ou caractere.
- `js/ui/HollowMessenger.js` e regras `.hollow-*` em `style.css`: renderização HTML recortada na tela da TV. A interface usa largura lógica de 572 pixels e altura proporcional à tela, acompanhando o redimensionamento por `ResizeObserver`. As mensagens usam `textContent`.
- `js/multiplayer/HollowSession.js`: validação e atualização idempotente do pequeno estado `room.hollow`. O `MultiplayerManager` continua sendo o único responsável por rede, presença e autoridade.

## Fluxo e controles

O vídeo termina, ocorre uma interferência breve, a tela fica preta e começa a busca de frequência. O briefing explica EDEN, o núcleo da AXIOM, bateria, combustível e o Vírus Zero, incluindo a preservação do suporte à vida. UNKNOWN assume momentaneamente o nome AXIOM; suas mensagens desaparecem quando o canal é recuperado. A autorização e o encerramento levam diretamente à primeira fase, sem atraso adicional de desligamento ou fade.

O roteiro completo dura aproximadamente 114 segundos no solo, além do vídeo original. Espaço, Enter ou o botão discreto completam o texto; a próxima ativação avança no solo. No cooperativo, revelam o texto sem deslocar o relógio compartilhado. Segurar ESC por 1,1 segundo ou clicar/tocar no controle de pular solicita o salto. Soltar ESC ou perder o foco cancela a contagem.

## Sincronização

Ao iniciar a partida, o host fixa uma sessão narrativa no estado retido da sala. Duplicatas de `start_game` não criam outra sessão. Cada jogador sinaliza `hollow_ready` após terminar o vídeo e carregar os recursos. Quando todos estão prontos, o host publica `startAt` com uma pequena antecedência. O elenco é confirmado novamente nesse instante; saídas anteriores ao início não acrescentam agentes ausentes. Após o início, o roteiro é fixo para manter a mesma ordem em todos os clientes.

Cada cliente usa o tempo de referência `serverTime` já publicado pela sala para iniciar sua reprodução local. A precisão depende da latência de entrega do estado, como nas referências temporais existentes do jogo; não há garantia de sincronia por quadro em conexões de alta latência.

`hollow_skip` exige unanimidade entre participantes atuais. Mesmo com todos os votos, a fase aguarda os recursos de todos. No fim normal, `hollow_done` exige confirmação de todos. O host publica `releaseAt` e os clientes executam a transição existente. Os comandos carregam o ID da sessão e são idempotentes; confirmações ainda ausentes são reenviadas de forma limitada, inclusive após migração do host.

Saídas reavaliam as barreiras usando os participantes restantes. A detecção de ausência e o prazo de tolerância continuam sendo os do `MultiplayerManager` (até 60 segundos de tolerância inicial). Durante a transmissão, a eleição exclui o host ausente e converte a referência temporal para o relógio do novo host. Sessão encerrada ou estado narrativo inválido retornam ao menu. Não há entrada autônoma de um cliente em outra partida.

## Falhas e limpeza

Vídeo indisponível continua automaticamente para o briefing; o botão Continuar também está disponível. Espera de mídia sem progresso por 15 segundos aciona a mesma recuperação. Falhas de assets mantêm a tentativa existente de recarregamento e bloqueiam a fase. Falha no áudio ou na apresentação não interrompe o relógio narrativo. O áudio usa bipes arcade curtos de onda quadrada no contexto Web Audio existente, um por palavra revelada nas falas. Não há notificação por mensagem; completar texto, recuperar uma aba suspensa e a interceptação não geram rajadas de som. O mute e o volume do jogo são respeitados.

Timers, observadores, áudio e listeners de teclado, cena, jogo e sala são removidos no encerramento ou na interrupção. `ended`, votos e confirmações duplicados não repetem a transmissão ou a transição.

## Verificação

```sh
node --test js/sounds/HollowDialogueAudio.test.mjs js/narrative/HollowDialogue.test.mjs js/multiplayer/HollowSession.test.mjs js/ui/CutsceneLayout.test.mjs js/multiplayer/Coop*.test.mjs
```

A suíte de navegador usa Playwright, `aedes@0.51.3`, `ws` e `mqtt`, instalados em um diretório de ferramentas separado. Sirva a raiz do projeto em localhost, porta 8765:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
HOLLOW_TEST_TOOLS=/tmp/nullborns-test-tools node tests/hollow-transmission.browser.mjs
```

`GAME_URL`, `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH` e `ARTIFACT_DIR` podem ajustar o ambiente. A suíte verifica os quatro solos, 2/3/4 clientes MQTT reais, mensagens duplicadas, composição idêntica, votação, desconexão, redimensionamento, falha de vídeo, limpeza e uma entrada completa em `Level1`. Nos encerramentos automatizados, o relógio narrativo é acelerado; o vídeo é verificado em reprodução antes de disparar seu evento de término. A maior parte da matriz visual usa uma montagem leve dos componentes reais; o cenário final usa BootPartida, preloader, assets e Level1 reais. O broker de produção e condições de rede remota precisam de teste manual.

### Resultado da validação local

- 17 casos de composição narrativa: quatro solos, todas as 11 combinações cooperativas e duas verificações de roteiro/entrada inválida.
- 8 casos de protocolo e integração do gerenciador, incluindo mensagens inválidas, duplicatas e migração de relógio.
- 9 arquivos de testes passaram, contando as regressões existentes de layout, protocolo, áudio, música, mundo cooperativo, reanimação e entrada do chefe.
- 57 verificações passaram no navegador, sem erros JavaScript: Chromium e Firefox, quatro solos, MQTT local com 2/3/4 clientes, saída do host, skip, recuperação de vídeo, quatro resoluções e entrada em Level1 em solo e em duas instâncias cooperativas pelo lobby real.
- As capturas e o relatório desta execução estão em `/tmp/hollow-validation`. Os mapas que estavam sendo editados no workspace não foram alterados por esta implementação.

O ajuste de áudio inclui dois testes de síntese, espaçamento dos bipes, mute, bloqueio do navegador e limpeza. O encerramento solo é verificado de forma síncrona, sem timers adicionais entre o fim do roteiro e a entrada na fase.

A TV usa `assets/efeitos/Televisor CRT Verde Neon em Ambiente Industrial.png` (1671 × 941), preservando todo o cenário industrial. A tela foi medida pela região verde: x=470, y=241, largura=587, altura=414. O contorno em `CutsceneLayout` inclui a curvatura das bordas e os cantos arredondados, com margem de três pixels para cobrir a transição verde suavizada. O recorte é compartilhado pelo vídeo e pelo diálogo. A imagem é estática e não recebe o recorte inferior do antigo GIF.

### Luz emitida e vidro CRT

`CrtLighting` adiciona reflexo curvo, escurecimento nas bordas, linhas de varredura e brilho no vidro. A iluminação externa aparece na moldura, controles laterais e mesa. Durante o vídeo, um canvas de 16 × 10 amostra as cores médias e a luminância a cada 160 ms; quadros pausados reutilizam a última amostra. Durante a conversa, a luz acompanha o texto revelado e a interferência muda a emissão de verde para vermelho. Transições suavizadas evitam flashes bruscos. O efeito não envia eventos de rede e não acrescenta espera ao fim da narrativa.

A amostragem para com a aba oculta e todos os elementos, canvas e timer são removidos ao encerrar a introdução. Se o navegador impedir a leitura do vídeo, o efeito usa luz neutra discreta e a reprodução continua.

O conteúdo usa uma abertura (`.crt-display`) sem margem interna, ocupando todo o vidro. O vídeo usa `object-fit: fill`: a imagem é esticada nos dois eixos, sem preservar a proporção e sem criar faixas pretas de ajuste. O contorno curvo continua limitando o conteúdo à tela. A emissão da luz usa o mesmo contorno do vidro, sem o retângulo arredondado independente que criava uma segunda borda sobre a moldura.

### Modo leve para celular

Dispositivos com toque e máquinas com até quatro núcleos lógicos ou até 4 GB de memória informada usam `.crt-low-power`. Nesse modo não é criado canvas para ler o vídeo: a iluminação fica neutra durante a reprodução e acompanha apenas os estados verde/vermelho do diálogo. O timer consulta esses estados a cada 600 ms e só altera o CSS quando o valor muda.

O perfil leve elimina o desfoque, as misturas de camadas e a máscara duplicada do conteúdo, mantendo o recorte externo curvo, o vídeo esticado e reflexos estáticos simples. As animações decorativas, o brilho dos caracteres e a rolagem suave também ficam desativados. A narrativa, o áudio por palavra, a sincronização e os controles permanecem os mesmos.

Verificação móvel: `node tests/hollow-mobile.browser.mjs` com Playwright e o servidor local usados na suíte principal. Inclui CPU emulada 4× mais lenta, zero leituras de vídeo, ausência de filtros pesados, CSS estável sem atualizações repetidas, luz vermelha da AXIOM, rotação, limpeza e entrada real na fase 1. O comparativo local de seis segundos passou de 39 leituras de pixels para zero; o tempo de tarefas da página foi de aproximadamente 0,83 s para 0,04 s. Esses números são de emulação, não uma medição em aparelho físico.
