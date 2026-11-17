# Otimização conservadora — captura visual cooperativa

Continuação: [Etapa 2 — diagnóstico do quadro completo](ETAPA2.md). Os resultados históricos abaixo foram preservados.
[Etapa 3 — iluminação e invalidações fora da tela](ETAPA3.md).
Etapa mais recente: [Etapa 4 — movimentação da câmera e reaproveitamento da máscara](ETAPA4.md).

Esta entrega é uma etapa limitada, com uma mudança de produção e testes de equivalência. A inspeção concentrou-se nos caminhos solicitados de multiplayer, minimapa, profundidade e carregamento, além de partes da iluminação. Não foi concluída uma leitura integral de todos os arquivos do repositório nem uma auditoria completa do jogo. Não representa validação integral dos modos solo e cooperativo.

## Problema comprovado e mudança

Em `js/multiplayer/CoopVisuals.js`, `VisualSender.capture` consultava `objects.includes(parentContainer)` para cada objeto com pai. Cada consulta podia percorrer todo o array recebido. Com muitos filhos, o trabalho de pertencimento podia crescer quadraticamente.

A captura agora cria um `Set` local, apenas na primeira consulta a um pai, e o reutiliza naquela chamada. O conjunto inclui **todo** o array, inclusive objetos além dos 900 nós capturados. A iteração continua pelo mesmo `slice`, preservando ordem, duplicatas, geração de IDs, limite, pais, conteúdo e serialização dos pacotes. Não há cache persistente nem compartilhamento entre remetentes, cenas ou salas. Chamadas sem pais não criam o conjunto. Existe uma alocação temporária proporcional ao array recebido quando há pais; não se afirma redução geral de memória.

Nenhum outro módulo de produção foi alterado. Permanecem intactos protocolo, mesclagem de quadros, compressão, deduplicação, host, colisões, física, combate, imagens, efeitos, minimapa e carregamento. Mantidos 30 FPS, entradas a 20 Hz, mundo a 12 Hz e keyframes a 2000 ms.

## Testes e referência

Comando antes e depois: `node --test`. O executor deste ambiente apresenta resultados agregados por arquivo.

| Execução | Arquivos aprovados | Arquivos com falha | Total |
| --- | ---: | ---: | ---: |
| Original | 119 | 5 | 124 |
| Após alteração | 120 | 5 | 125 |

As mesmas cinco falhas ocorreram antes e depois, em:

- `js/effects/FactoryLighting.test.mjs`
- `js/interactions/FactoryDoor.test.mjs`
- `js/map/ColisoesMapa.test.mjs`
- `js/player/colisoes/PlayerCollisionConfig.test.mjs`
- `js/sounds/interacoesSerra.test.mjs`

Os logs do executor informam `test failed`, sem diagnóstico interno detalhado; não foi atribuída uma causa não comprovada. Os registros estão em `node-before.log` e `node-after.log` nesta pasta. Nenhum teste existente foi alterado.

Teste direcionado aprovado:

```sh
node --test js/multiplayer/CoopVisualsPerformance.test.mjs js/multiplayer/CoopProtocol.test.mjs js/multiplayer/CoopRegression.test.mjs
```

O novo arquivo conserva a implementação original como referência e compara tanto objetos retornados quanto JSON transmitido e estado anterior dos remetentes. Cobre pais fora do limite, pais ausentes, duplicatas, objetos inativos e tipos ignorados, capturas completas, deltas, remoções, recriações, mudanças internas em arrays e valores ausentes. Também intercala remetentes independentes para duas salas e quantidades de 1–4 jogadores. Essa simulação verifica o isolamento da captura; não simula partidas completas nem transporte real.

`git diff --check` também passou.

## Medição limitada

Microbenchmark em Node v24.22.2: 900 containers ativos, 899 com o último objeto como pai, full frames; aquecimento de 100 capturas por versão e sete lotes alternados de 100 capturas por versão. Referência obtida restaurando a expressão original `objects.includes` na mesma implementação. Medianas por captura:

| Original | Otimizado |
| ---: | ---: |
| 1,189 ms | 0,480 ms |

É um cenário sintético favorável a consultas repetidas, em ambiente compartilhado, com variação entre lotes. A suíte final também estava em execução durante a medição. Não extrapolar o resultado para partidas típicas, FPS, carregamento, GC ou memória em celulares. Não houve medição em dispositivo real. A redução comprovável de trabalho é uma construção linear de conjunto e consultas por identidade, substituindo repetidas varreduras do array.

## Oportunidades preservadas e pendências

| Área | Decisão e motivo |
| --- | --- |
| Retângulos de `CoopRuntime.receiveFrame` | Não alterados. Foram localizados consumidores de `hitboxDano` e `coopBody`, incluindo profundidade; não foi concluída a análise de retenção de todas as referências nem a validação de colisões em navegador. Reutilizar objetos altera identidade e pode mudar referências retidas. |
| `sendPlayerState` | A serialização de `extra` pode ocorrer duas vezes quando os campos básicos coincidem e os extras mudam. A comparação também possui curto-circuito. Não alterada nesta etapa: preservar precisamente a avaliação requer testes próprios, inclusive valores ausentes, getters e `toJSON`. |
| Comparações profundas dos visuais | Preservadas integralmente. Nenhuma comparação superficial foi introduzida. |
| Minimapa mobile | `drawNativeView` já guarda o fundo e o reconstrói em redimensionamento ou invalidação; indicadores são redesenhados a cada atualização. Não foi demonstrada uma invalidação completa que permita ignorar outras atualizações. |
| Profundidade | Chamadas em `update` e `POST_UPDATE` preservadas. O posicionamento de física e interpolação entre fases impede assumir redundância apenas pela repetição dos nomes. |
| Texturas e boss | `BootPartida` prepara as cenas e o preloader carrega os recursos do boss; o carregador do boss já verifica chaves existentes. Não houve compartilhamento, descarregamento, renomeação ou carregamento tardio. Uma revisão completa de referências permanece necessária. |
| Iluminação | Os caches existentes foram preservados. `FixedLightCache` já usa revisões, regiões sujas e liberação de canvases. A falha anterior em `FactoryLighting` foi registrada separadamente; não foi feita correção de iluminação. |
| Outros sistemas e memória | Não houve revisão exaustiva de IA, combate, mapas, listeners e recursos de todo o jogo. Não foram introduzidas estruturas persistentes novas. |

## Limitações de integração

Foi tentado `node tests/multiplayer-atualizacao.browser.mjs`. O roteiro não iniciou por ausência de `/tmp/coop-test-tools/node_modules/aedes`; a resolução de `playwright` também indicou indisponibilidade. O erro está em `browser-attempt.log`. Não foram instaladas dependências nem adicionados serviços ao projeto.

Continuam **não validados em navegador/dispositivo real nesta entrega**: solo; partidas completas com 2, 3 e 4 jogadores; duas salas simultâneas com hosts distintos; entrada e saída; migração de host; perda de quadros e recuperação por keyframe; transições cidade/fábrica; combate simultâneo; ataques e habilidades; morte e recuperação; boss com projéteis, clones e efeitos; reconexão e encerramento. Testes Node aprovados não substituem essa validação.

O próximo passo de desempenho depende de testes reais nas mesmas condições de mapa, inimigos e jogadores. Não há alegação de que os travamentos do jogo inteiro tenham sido resolvidos.
