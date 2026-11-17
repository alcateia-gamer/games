# Etapa 2 — diagnóstico de desempenho

## Resultado da investigação

Foi recuperada a execução em navegador real e medida a execução completa do Phaser. Na fábrica testada, composição da iluminação e envio de sua textura dominaram o tempo de CPU; física e minimapa foram muito menores. Em retrato, `EXPAND` aumentou de fato a área do canvas. Também foi constatado um conjunto grande de imagens carregadas. Isso orienta a próxima investigação, mas **não comprova a causa dos travamentos no Android físico**.

Nenhuma nova otimização de renderização foi mantida. Um descarte conservador de tiles fora do canvas passou na equivalência visual e reduziu chamadas de desenho, mas foi revertido porque não melhorou consistentemente o tempo. Não há alegação de FPS maior ou de travamentos resolvidos. A otimização anterior em `CoopVisuals.js` permanece intacta.

A entrega mantida é um diagnóstico opt-in, testes e um roteiro reproduzível para medir quadros inteiros. Não foram alterados gameplay, física, controles, inimigos, efeitos, gráficos, escala, resolução, ordem visual, rede ou frequências.

## Ambiente e limites da medição

Chromium headless em servidor Linux, contexto com toque e user-agent Android, viewport inicial 960×540, DPR 1 e CPU limitada em 4× pelo CDP. O smoke test confirmou adaptador ANGLE/Vulkan SwiftShader (renderização por software). Não é um aparelho Android nem sua GPU. O perfil de CPU e a instrumentação também têm custo. O ambiente compartilha recursos e apresentou variação relevante entre execuções.

O roteiro utiliza as cenas reais e o boss configurado normalmente. Depois do boot, mede cerca de 10 segundos por cenário, com 2 segundos de espera antes de cada coleta. A fábrica começa próxima à arena. O cenário em movimento pressiona `d` durante a coleta. A cidade é medida após a transição de retorno. O teste em retrato usou 5 segundos e apenas 19 quadros; seus percentis são particularmente instáveis. Não é um ensaio de combate intenso com quatro jogadores.

`frame.cpu` mede a duração síncrona do callback do loop. `frame.interval` mede a cadência entre callbacks e inclui espera/agendamento; não confundir os dois. `scenes.render` inclui trabalho síncrono de renderização. `renderer.renderListeners` inclui os listeners de render, entre eles o compositor de iluminação. Tempos de `texImage2D` são de CPU/chamada ao driver, **não timestamps da GPU**. As medidas são aninhadas e não devem ser somadas.

## Quadros completos observados

Valores em ms, antes de qualquer otimização candidata:

| Cenário / callback CPU | Quadros | Média | Mediana | p95 | p99 | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fábrica parada | 90 | 42,99 | 28,40 | 96,00 | 434,90 | 434,90 |
| Fábrica em movimento | 86 | 38,05 | 34,60 | 56,90 | 239,60 | 239,60 |
| Cidade parada | 96 | 10,91 | 10,20 | 17,20 | 34,90 | 34,90 |

| Fábrica em movimento: componente | Média | Mediana | p95 |
| --- | ---: | ---: | ---: |
| Update da cena | 3,10 | 2,00 | 6,60 |
| Minimap.update | 0,33 | 0,10 | 1,00 |
| Physics.step, por chamada | 0,042 | 0,00 | 0,10 |
| Listeners de render / iluminação | 26,35 | 23,70 | 37,90 |
| texImage2D, por chamada | 10,49 | 10,20 | 19,50 |
| Render total | 32,96 | 29,90 | 44,50 |

Os intervalos medianos entre callbacks foram 97,6 / 107,7 / 98,1 ms, respectivamente. A cadência lenta mesmo na cidade é uma razão adicional para **não converter esses valores em promessa de FPS no celular**. Houve 11 long tasks na fábrica parada e 7 em movimento. O perfil amostrado apontou `drawImage` e `texImage2D` como custos importantes. Há amostras de GC, mas não foi identificado um vazamento nem demonstrado que GC explica os maiores travamentos; uma fotografia de heap não é um teste de memória prolongado.

Dados completos: [game-baseline.json](etapa2/game-baseline.json). Perfis importáveis no DevTools: [cpu-profiles.tar.gz](etapa2/cpu-profiles.tar.gz).

## Iluminação, escala e texturas

O roteiro histórico de iluminação foi executado sem erros de página. Com a cena pausada, câmera parada e estado estabilizado, reutilizou a imagem: zero `drawImage` nas 80 atualizações medidas de cada cenário estático, aproximadamente 0,72–0,81 ms de composição por chamada. Em movimento controlado, a média foi 11,79 ms, p95 13,80 ms e máximo 14,90 ms. **Esse roteiro não mede o quadro inteiro** e não inclui a evolução normal das animações e do boss como o roteiro acima. Não se deve interpretar a diferença como contradição ou ganho de uma versão.

Em retrato 390×844, foi medido canvas **800×1731**, contra 800×450 em paisagem: 3,85× mais pixels. A coleta curta em retrato observou mediana de callback de 80,20 ms e mediana de `texImage2D` de 31,70 ms. Não é comparação causal perfeitamente controlada: há variação do ambiente e evolução da cena entre execuções. O aumento geométrico da área é comprovado; sua contribuição exata no aparelho precisa ser medida. Não foram reduzidos resolução, zoom, frequência ou modo de escala.

O inventário do runtime em retrato tinha 175 chaves de textura e 174 objetos de imagem distintos. A soma nominal `largura × altura × 4` das imagens distintas foi **607,9 MiB**. Sem deduplicar objetos de imagem, cerca de 612,4 MiB. Isso **não é memória RAM/VRAM alocada medida**: o navegador pode compartilhar decodificações, o driver possui formatos/alocações próprios, e o heap JS não inclui todos esses recursos. A estimativa cobre somente um nível RGBA8 e não todos os buffers do jogo. O heap JS informado nessa fotografia foi aproximadamente 131 MB usados, sem concluir estabilidade ao longo do tempo.

Exemplos carregados: tentáculo ~40,9 MiB nominais; duas páginas de disparo ~40,2 MiB cada; especial de Magnus ~34,5 MiB. Os recursos do boss ainda estavam carregados na cidade. O inventário separado de 292 PNGs do disco inclui prévias e arquivos não utilizados: **não somar esse inventário como se tudo fosse carregado**. Em particular, o PNG antigo de tentáculos 8000×8400 aparece no disco, enquanto o runtime usa o atlas 4072×2632.

Dados: [lighting-baseline.json](etapa2/lighting-baseline.json), [game-portrait.json](etapa2/game-portrait.json), [png-inventory.json](etapa2/png-inventory.json).

## Experimento descartado

Em `FlashlightTileOcclusion`, foi experimentado descartar somente tiles com retângulo transformado totalmente fora do canvas local, com margem de 2 pixels e fallback para rotação de tile. Não removia objetos do mundo nem alterava a imagem visível.

- 36 casos rasterizados no navegador produziram pixels idênticos com escalas positivas/negativas, rotação, espelhamento, transparência, offsets e posições fracionárias; chamadas caíram de 36.864 para 4.096.
- As quatro máscaras do roteiro real da fábrica foram byte a byte idênticas antes e depois.
- No A/B alternado na mesma sessão, 100 composições medidas por lote e seis lotes, os desenhos caíram de 1.865 para 700. Médias sem descarte: 12,226 / 11,715 / 12,348 ms; com descarte: 12,391 / 12,192 / 11,767 ms. Não houve melhora consistente dos piores quadros.

O módulo foi restaurado integralmente e os roteiros específicos da candidata removidos. Os resultados ficaram em [rejected-culling-ab.json](etapa2/rejected-culling-ab.json) e [rejected-culling-pixels.json](etapa2/rejected-culling-pixels.json). Não contabilizar a redução de desenhos como melhoria entregue.

## Alterações mantidas e uso do diagnóstico

| Arquivo | Alteração |
| --- | --- |
| `js/core/game.js` | Importação dinâmica do diagnóstico somente com `?perf=1`, após o primeiro poststep. Sem o parâmetro, nenhuma importação, listener de diagnóstico ou coleta por quadro. |
| `debug/PerformanceProbe.js` | Métricas limitadas a 1.800 amostras por série, médias/máximos, percentis, long tasks quando disponíveis, inventário de cenas/texturas e tempos de cenas, física, minimapa, coop e chamadas GL. Sem logs por quadro. |
| `debug/PerformanceProbe.test.mjs` | Retornos, this, exceções, limites, reset, ordem dos listeners, desinstalação, reinstalação e proteção contra instalação duplicada. |
| `tests/game-performance.browser.mjs` | Captura de quadro completo e perfis CDP, com cenários selecionáveis. |
| `tests/performance-probe.browser.mjs` | Verifica ativação, reset, stop e ausência de importação quando desligado. |
| `tests/novo-boss-browser-helpers.mjs` e `tests/multiplayer-atualizacao.browser.mjs` | Opção de teste `BROWSER_SKIP_INTRO=1`, que usa o botão público para pular a transmissão; a conclusão do loader continua obrigatória. Nenhuma asserção existente foi alterada. |
| Documentação e arquivos em `docs/otimizacao/etapa2/` | Referências, medições e limitações. |

Abrir o jogo com `?perf=1`. No DevTools, depois de chegar ao cenário desejado:

```js
nullbornsPerformance.reset(); // começa uma janela de coleta limpa
// Jogar o cenário a medir; não consultar snapshot a cada quadro.
const resultado = nullbornsPerformance.snapshot();
copy(JSON.stringify(resultado, null, 2)); // helper do console do Chrome
nullbornsPerformance.stop(); // restaura métodos e desconecta o observer
```

Média e máximo cobrem a coleta desde o reset; percentis usam as últimas até 1.800 amostras. `snapshot()` ordena e inventaria somente quando solicitado. A instrumentação não muda os argumentos, retornos, exceções ou a ordem dos listeners; é removida ao destruir o jogo. Cada jogo tem sua própria instância, sem estado de sala compartilhado. Para uma transição/reinício de cena durante uma investigação prolongada, parar e recarregar com o parâmetro evita misturar janelas e instâncias. Não tirar conclusões de latência de rede a partir do custo de `receiveFrame`.

## Reproduzir o ambiente de navegador

As ferramentas foram instaladas somente em `/tmp`, sem dependências adicionadas ao jogo. Foi necessário baixar o Chromium e extrair bibliotecas Ubuntu em `/tmp` porque o ambiente não as tinha; iniciar processos de rede/navegador também exigiu execução fora da restrição do sandbox. Nada foi instalado nos pacotes do sistema.

```sh
npm install --prefix /tmp/nullborns-perf-tools playwright aedes@0.51.3 ws mqtt --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH=/tmp/nullborns-browsers /tmp/nullborns-perf-tools/node_modules/.bin/playwright install chromium
# Em sistema com as bibliotecas do Chromium já disponíveis:
python3 -m http.server 8765 --bind 127.0.0.1
```

Em outro terminal, configurar `PLAYWRIGHT_MODULE=/tmp/nullborns-perf-tools/node_modules/playwright/index.mjs`, `PLAYWRIGHT_BROWSERS_PATH=/tmp/nullborns-browsers` e `BROWSER_SKIP_INTRO=1`. Neste ambiente também foi usado `LD_LIBRARY_PATH=/tmp/nullborns-browser-libs/root/usr/lib/x86_64-linux-gnu` para as bibliotecas extraídas. Os roteiros aceitam `BASE_URL`.

```sh
node tests/game-performance.browser.mjs referencia
PERF_SCENARIOS=factory-portrait PERF_MS=5000 node tests/game-performance.browser.mjs retrato
node tests/factory-lighting-performance.browser.mjs referencia
node tests/performance-probe.browser.mjs
COOP_TEST_TOOLS=/tmp/nullborns-perf-tools COOP_TEST_PHASE=world node tests/multiplayer-atualizacao.browser.mjs
```

Os artefatos são salvos em `/tmp`; não há envio de telemetria. O roteiro cooperativo utiliza Aedes/WebSocket local na porta 18884 e prefixo `test-coop`, sem usar o broker de produção.

## Regressão e pendências

A suíte foi executada novamente antes das mudanças: **120 arquivos aprovados, 5 com falha, total 125**. Após a adição do arquivo de teste do diagnóstico: **121 aprovados, as mesmas 5 falhas, total 126**. O executor apresenta agregação por arquivo. Falhas: `FactoryLighting.test.mjs`, `FactoryDoor.test.mjs`, `ColisoesMapa.test.mjs`, `PlayerCollisionConfig.test.mjs` e `interacoesSerra.test.mjs`. Nenhuma expectativa foi modificada. Logs: [antes](etapa2/node-before.log), [depois](etapa2/node-after.log).

Passaram o teste Node do diagnóstico e o teste de navegador opt-in, além do roteiro histórico de desempenho da iluminação. Os testes direcionados de `FlashlightWalls` e `FlashlightTileOcclusion` passaram durante o experimento; `FactoryLighting` manteve sua falha anterior. `git diff --check` passou.

O roteiro cooperativo real conectou dois jogadores no mapa, mas parou na asserção **“host mantém pet e contexto independente do aliado”**: o host e o contexto remoto estavam sem pet. Não houve mudança de produção no multiplayer ou no pet nesta etapa; a falha observada não é causada pela candidata já revertida. Isso não prova qual regra/teste está incorreto. Não foi flexibilizada a asserção. Ver [coop-browser.log](etapa2/coop-browser.log).

Não foram validados integralmente: partidas com 3/4 jogadores, duas salas completas simultâneas, migração, reconexão, entrada/saída, perda de pacotes/keyframes, habilidades, morte/recuperação, portas, boss em combate intenso, partidas prolongadas e crescimento de memória. Transições entre as cenas solo ocorreram no roteiro de perfil, mas isso não substitui uma regressão completa das transições. Não houve medição em celular físico, tempo de GPU por timer query nem benchmark completo de carregamento/decodificação.

Próximas oportunidades, sem implementação automática: examinar o caminho de upload da máscara no Phaser com validação de resize/perda de contexto; avaliar uma composição equivalente que reutilize mais camadas durante animações; reduzir a memória nominal das grandes texturas por empacotamento que preserve frames e origens; planejar carregamento por etapas com barreiras de prontidão host/clientes. A reutilização de retângulos remotos e otimizações de serialização continuam propostas secundárias: não há evidência de que expliquem o gargalo dominante observado. Todas exigem validação própria antes de alterar a produção.
