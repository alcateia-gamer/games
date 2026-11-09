# Atualização cooperativa a partir da versão solo

O multiplayer existente usava sprites e combate anteriores aos sistemas atuais.
O host publicava a sala inteira a cada entrada de movimento e a cada atualização
de inimigos; o dano remoto de tiros era enviado depois de 220 ms, sem colisão.
Boss, pet, armas independentes e a maioria dos especiais estavam bloqueados.

## Etapas

- [ ] Protocolo: ações confiáveis deduplicadas, movimento a 20 Hz, mundo a 12 Hz,
  diferenças entre snapshots e recuperação por keyframes.
- [ ] Personagens: arte/armas atuais, quatro especiais, dano, cura, captura,
  libertação, pet e morte cooperativa.
- [ ] Mundo: coleta, combustível, energia, portas, zonas de spawn e mapas.
- [ ] Boss: introdução, prólogo, geradores, barreira, ataques, ilusões, clones,
  fase 2, tentáculos e derrota preservando sua implementação solo.
- [ ] Integração com duas instâncias e medições de tráfego/atualização.

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
Falhas existentes em `PlayerTestActionControls.test.mjs` (11),
`FactoryLighting.test.mjs` (4), `ColisoesMapa.test.mjs` (4) e
`PlayerCollisionConfig.test.mjs` (2). Resultado completo em
`/tmp/multiplayer-baseline.json`.
