# Atualização cooperativa a partir da versão solo

O multiplayer existente usava sprites e combate anteriores aos sistemas atuais.
O host publicava a sala inteira a cada entrada de movimento e a cada atualização
de inimigos; o dano remoto de tiros era enviado depois de 220 ms, sem colisão.
Boss, pet, armas independentes e a maioria dos especiais estavam bloqueados.

## Estado atual

- [x] Protocolo: ações confiáveis deduplicadas, movimento a 20 Hz, mundo a 12 Hz,
  diferenças entre snapshots, sequência monotônica e recuperação por keyframes.
- [x] Personagens: contextos independentes por jogador, armas, especiais, dano,
  cura, pet e morte cooperativa.
- [x] Mundo: estado persistente, interações compartilhadas, coleta, energia,
  portas, zonas de spawn e os dois mapas.
- [x] Boss: autoridade no host, réplica visual nos clientes e preservação dos
  sistemas atuais do modo solo.
- [x] Integração com duas instâncias, broker MQTT/WebSocket local e métricas
  básicas de quadros, bytes, captura e entidades.

Itens que dependem de validação manual em navegadores reais, como perda de
conexão prolongada, jitter elevado e migração de host, não são considerados
automaticamente concluídos por esses testes.

## Revisão de sincronização

- Contextos remotos não herdam a limpeza das habilidades nem o dash do host.
  Seus sprites recebem a API de velocidade Arcade necessária para a troca da
  Aria, a marreta e as restrições do boss.
- A textura procedural da munição do robô é preparada em todas as instâncias.
  Réplicas antigas deixam de ser criadas antes do runtime e os grupos de tiros
  são reiniciados a cada visita ao mapa.
- Auras, partículas de cura e domo acompanham o personagem exibido localmente.
  O combate e a cura permanecem sob autoridade do host.
- A compressão agrupa deltas pendentes preservando criações e remoções. Após
  perda de sequência, o cliente pede um keyframe antes de aplicar novos deltas.
  Cada visita tem uma identidade própria para separar réplicas de mapas anteriores.
- Transições têm origem e revisão, são recuperadas pelo estado da sala e pelos
  snapshots e ignoram pedidos repetidos ou antigos. O início da partida e as
  visitas ao mapa concedem 60 segundos de tolerância à presença, para o
  carregamento não expulsar participantes nem provocar troca prematura de host.
- O gerador replica também a primeira gravação no registry, o início da partida
  e os perfis de piscadas. Cada cliente conserva a reprodução espacial dos sons.
  A união do progresso preserva confirmações já recebidas quando chega um
  snapshot anterior, evitando apagar energia, coletas ou o relógio do gerador.
- A cutscene tem um único controle de câmera no cliente, restaura zoom, follow,
  HUD e entrada e recebe a sequência de iluminação da arena e das torres. As
  zonas reveladas pelas portas também são replicadas: fechar as persianas do
  boss não deixa uma máscara preta sobre o personagem no cliente.

`js/multiplayer/CoopRegression.test.mjs` cobre recuperação de snapshots, efeitos
ancorados, agrupamento de deltas, primeira gravação do gerador, perfis de luz,
transições e restauração da cutscene. O roteiro
`tests/multiplayer-atualizacao.browser.mjs` exercita os personagens, projéteis,
mapas, gerador e boss com dois navegadores e um broker MQTT/WebSocket local.

Para executar o roteiro integrado, instale `playwright@1.51.1`, `aedes@0.51`, `ws` e
`mqtt` fora do projeto (por padrão em `/tmp/coop-test-tools`), inicie um servidor
HTTP na raiz na porta 8765 e forneça `PLAYWRIGHT_MODULE` e, se necessário,
`PLAYWRIGHT_BROWSERS_PATH`. `COOP_TEST_TOOLS` permite escolher outro diretório.
`COOP_TEST_PHASE=world`, `abilities`, `boss`, `parity` ou `music` executa os cenários em sessões
separadas, reduzindo o pico de memória da validação. Sem essa variável, o roteiro
executa todas as etapas na mesma sessão. `CHROMIUM_PATH` permite selecionar o
Chromium completo quando o headless shell apresenta instabilidade de WebGL.

### Validação da revisão

- 16 casos novos de regressão, distribuídos entre protocolo, réplica visual,
  aura da Nyx e zonas de iluminação, passaram.
- Os três cenários integrados (`world`, `abilities`, `boss`) passaram com duas
  instâncias reais, broker local e Chromium 134 (Playwright 1.51.1), sem erros
  JavaScript. As capturas confirmaram a remoção da máscara preta após a cutscene.
- O roteiro de efeitos solo e compatibilidade da aura legada também passou.
- O Chromium 158 disponível na versão mais recente da ferramenta apresentou
  crashes nativos e erros de shader neste ambiente. Os resultados visuais acima
  correspondem à versão 134; não equivalem a validar todos os navegadores/GPU.
- Na suíte geral, 92 de 96 arquivos passaram. Os arquivos `FactoryLighting.test.mjs`, `ColisoesMapa.test.mjs`,
  `PlayerCollisionConfig.test.mjs` e `interacoesSerra.test.mjs` já falhavam antes
  desta revisão. Os testes específicos adicionados para iluminação passaram.

## Falas, lanternas, impacto e controles DEV

- Falas das portas, cartão e combustível são transmitidas com frase, versão e
  tempo de digitação. Cada tela recria o balão com o tema do falante e acompanha
  seu personagem. Ocultar a fala e sair do mapa também limpam a réplica.
- Formas preservam os estados de preenchimento e contorno. A borda da vida do
  inimigo deixa de virar um retângulo branco sobre o preenchimento vermelho.
  Sprites também restauram o modo de tint após um flash branco.
- O runtime cooperativo usa os valores de recuo, tremor, partículas e deformação
  do solo. Impactos curtos têm evento confiável próprio, e a pausa de entrada
  afeta somente o operador envolvido. O recuo de um tiro segue sua trajetória.
- A mira da lanterna é enviada pelo dono. O aliado ilumina a partir da posição
  exibida nesta tela, com os mesmos recortes de paredes, salas e personagem.
  A luz é removida ao morrer, sair ou ligar a energia da fábrica.
- Os atalhos 1/2/3/5/6 solicitam spawn ao host junto de quem apertou a tecla.
  O teleporte O usa a viagem compartilhada na cidade e mantém o DEV individual.
  O botão de luz pode ser usado pelo cliente mesmo com DEV desligado no host,
  inclusive para apagar a luz após confirmar o gerador. I, Shift e Espaço
  continuam locais, como no solo.
- Frames válidos e estados da sala atualizam a presença do host usando o relógio
  de quem recebeu. Snapshots não fazem a presença regredir após um heartbeat.

O cenário `parity` verifica barras, impactos, spawns pelos dois teclados,
teleporte O pelo cliente, falas nos dois sentidos e lanternas/luz compartilhada.
Capturas e relatório ficam em `/tmp/multiplayer-atualizacao` por padrão.

Validação desta etapa: 11 casos adicionais de regressão passaram. Os cenários
`parity` e `world` passaram com duas instâncias reais e Chromium 134, sem erros
JavaScript; o segundo também desligou a luz DEV após o gerador confirmado e
reativou o gerador. As capturas mostram os dois diálogos e as barras vermelhas.
A suíte geral manteve 92/96 arquivos aprovados e as mesmas quatro falhas anteriores.

## Sincronização das músicas

- O host publica a faixa ativa, posição do áudio, trecho de loop, pausa, velocidade
  e volume da entrada. O cliente reproduz uma única trilha seguindo esse estado,
  incluindo a música da cutscene/luta do boss e a volta à exploração da fábrica.
- Uma troca de mensagens estima a diferença entre os relógios dos jogadores.
  A posição é compensada pelo tempo de transmissão e desvios acima de 80 ms são
  corrigidos. O trecho de introdução não é repetido nas voltas do loop.
- Após desbloquear autoplay ou retomar o áudio, o cliente busca a posição atual
  do host. Trocas de mapa e encerramento do runtime limpam a trilha anterior.
  Volume geral e efeitos espaciais continuam sob controle local.
- A entrada gradual usa o volume calculado pelo controlador, evitando publicar
  o ganho padrão de Web Audio antes de o primeiro bloco de áudio ser processado.
- Uma morte individual na fábrica cooperativa mantém a música compartilhada.
  O comportamento de morte e entrada gradual do solo continua coberto pelos testes.

`CoopMusic.test.mjs` cobre loops, entrada tardia, drift, autoplay, pausa, volume,
relógios diferentes, prioridade do boss e limpeza. O cenário integrado `music`
mede a diferença contra a reprodução real do host, força atraso e suspensão do
áudio e atravessa cidade, fábrica, música do boss e retorno à exploração.

Validação: os 10 casos adicionados (nove do sincronizador e um de morte
cooperativa) e os testes de música solo passaram. O cenário `music` passou com
duas instâncias reais, áudio Web Audio, broker local e Chromium 134, sem erros
JavaScript. As amostras ficaram dentro da tolerância de 250 ms do roteiro,
mantendo uma única faixa e os tetos de volume de 6%/10%. A suíte geral ficou em
93/97 arquivos aprovados, com as mesmas quatro falhas anteriores.

## Decisões

Uma simulação de inimigos/boss no host. Os demais clientes mantêm movimento local
e recebem representações interpoladas dos sprites e efeitos reais. Ações de
combate/interação não dependem dos pacotes descartáveis de movimento. O estado
do mundo não é publicado novamente para cada comando de cada jogador.

A adaptação dos sistemas solo usa contextos de cena, mantendo a implementação
original e separando estado de habilidades por jogador. O boss antigo permanece
desativado e seus arquivos preservados. Sistemas revertidos no solo não voltam
a ser ativados apenas no multiplayer.

## Linha de base dos testes

Antes das alterações: 911 casos em 86 arquivos; 890 passaram e 21 falharam.
Falhas históricas em controles exclusivos já removidos (11),
`FactoryLighting.test.mjs` (4), `ColisoesMapa.test.mjs` (4) e
`PlayerCollisionConfig.test.mjs` (2). O relatório JSON dessa execução foi um
artefato temporário fora do repositório; os números acima são mantidos apenas
como referência histórica e não substituem uma nova execução no ambiente de
validação.
