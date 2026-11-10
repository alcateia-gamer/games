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
