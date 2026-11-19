# BruteForce: legibilidade e alinhamento responsivo

A correção do jogo está restrita a `js/ui/BruteforcePanel.js`. Os modelos de puzzle, relógio, validação e transporte multiplayer não foram alterados.

A versão horizontal compacta agora usa proporção 1,7:1 para colunas/painel de senha, letras de 32 px e altura de rolos baseada na altura dinâmica do viewport, descontando safe areas. Cabeçalhos, espaçamentos e textos secundários são compactados primeiro. No retrato, as letras passam de 23 para 30 px. A organização desktop permanece a existente. Como jogar e fechar ficam juntos à direita.

O passo visual é definido por `--brute-step`. A transformação usa porcentagem da altura da própria letra, eliminando a duplicação de 54/27 px no JavaScript. A altura total da faixa é `passo × 2 × BRUTEFORCE_WINDOW`, incluindo as bordas. Assim, o centro da letra cruza a borda no limite de acerto já existente. Não há leitura de layout por frame ou novo elemento durante a animação.

`ResponsivePanel.js` já recompõe a largura antes de calcular uma escala absoluta, sem multiplicar escalas anteriores. A correção compacta o conteúdo local antes desse cálculo, dispensando mudanças no componente compartilhado ou em outros puzzles.

## Validação

- 41 testes unitários nos cinco arquivos `js/puzzles/*.test.mjs` passaram.
- `tests/bruteforce-responsive.browser.mjs`: treze viewports, mensagens inicial/erro/sucesso, painel sem overflow, botões acessíveis, fonte visual mínima de 28 px, faixa central, limites lógicos de ±0,34 e rejeição em 0,35. Também verifica passo visual alterado para 72 px, comandos de toque e limpeza.
- Resoluções: 1920×1080, 1600×900, 1366×768, 1280×720, 960×540, 932×430, 844×390, 740×360, 667×375, 1024×768, 800×600, 390×844 e 568×320.
- `tests/hacking-motion.browser.mjs`: passou; oito colunas animadas, erro recuperável, oito congelamentos corretos por toque, teclado e regressão do Host Connection.
- `tests/responsive-panel.browser.mjs`: passou nas 11 resoluções do roteiro compartilhado.
- O helper `tests/nullnet-browser-helpers.mjs` passa a medir a posição relativa letra/faixa, em vez de depender da antiga transformação em pixels.
- Capturas em `/tmp/bruteforce-responsive/`, incluindo `844x390.png` e `1920x1080.png`.

Os testes foram executados em navegador Chromium/Brave desktop com viewports móveis. Não houve teste em aparelho físico nem benchmark de FPS. Safe areas usam `env()`; não foi simulado um recorte físico de tela.

A regressão `tests/hacking-coop.browser.mjs` também passou integralmente com duas instâncias e MQTT local: oito colunas congeladas pelo cliente, conclusão compartilhada, portas, memória, transferência de operador e encerramento em ambas as telas. O primeiro ensaio expôs a dependência do helper ao formato antigo em pixels; o helper foi corrigido para medir geometria relativa e a execução completa foi repetida com sucesso.
