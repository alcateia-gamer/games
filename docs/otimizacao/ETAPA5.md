# Etapa 5 — investigação do pipeline gráfico

## Resultado e alcance

Não foi integrada uma nova otimização ao renderer de produção. As medições não demonstraram uma alteração que preserve a imagem e melhore consistentemente a partida. As otimizações anteriores foram preservadas. Os travamentos em Android **continuam sem solução comprovada**.

Foram acrescentados contadores opcionais de WebGL, um coletor manual para o celular e um experimento independente do jogo. Não houve mudança nesta etapa em resolução, EXPAND, campo de visão, controles, iluminação, simulação, física, mapas, ordem de desenho, FPS ou rede. Nenhum efeito desativado no experimento é apresentado como otimização.

Foram revistos os quatro relatórios anteriores, os JSONs e os arquivos de perfis de CPU. [Inventário do histórico](etapa5/history-inventory.json) registra as fontes e principais amostras dos perfis. O ganho da etapa 3 permanece restrito ao cenário de silhuetas fora da câmera; o deslocamento da máscara e o cache espacial da etapa 4 não foram reintroduzidos.

## Ambiente e limites

Chromium headless, Linux, Phaser local 4.2.1, ANGLE/Vulkan **SwiftShader**, toque/user-agent Android, DPR 1 e CPU limitada em 4×. SwiftShader executa gráficos por software; o teste não representa a GPU de um telefone. Não há `adb`, barramento USB exposto ou endpoint CDP Android configurado neste ambiente. Não houve acesso a Android físico.

O renderizador não ofereceu `EXT_disjoint_timer_query_webgl2`. Foram medidos tempos síncronos de JavaScript/chamadas nativas e contagens de submissão; **não** o tempo de execução da GPU nem o instante de apresentação na tela. `texImage2D` pode incluir conversão, rasterização pendente e espera; não é uma medida pura de transferência. Não foi usado `gl.finish` para forçar uma conclusão artificial.

## Caminho do quadro e achados

- O diagnóstico existente distingue callback do loop, intervalo entre callbacks, atualização de cenas, física, render e composição/upload da máscara. Tempos aninhados não devem ser somados. Os perfis ativos da etapa 4 continuam sendo a referência de movimento com lógica em execução.
- O novo contador observa chamadas efetivas a `drawArrays`/`drawElements`, variantes instanciadas, trocas de programa, textura, framebuffer, blend, viewport, clear e upload. Triângulos submetidos não medem fragmentos nem overdraw. Contagens de estado não demonstram redundância sem analisar seus argumentos e a ordem visual.
- O Phaser já faz culling de tilemaps: `TilemapLayer.cull` usa o callback da camada e `skipCull` está desativado. Objetos também respeitam filtros de câmera. Adicionar outro descarte genérico duplicaria parte desse trabalho e poderia excluir luzes/sombras que atingem a tela.
- No ponto medido da fábrica foram observados cerca de 94 draw calls por quadro em paisagem e mais em retrato. Oito robôs adicionam aproximadamente duas chamadas, evidência de batching neste fixture. O efeito de matriz de cores condicional dos robôs não estava instalado (`robotColorFX=0`); não se atribuiu custo a um postFX ausente.
- A fábrica medida não contém `Shader` de cena. A cidade usa `WeatherShader` para chuva, um efeito de tela inteira separado. A chuva não explica o custo da fábrica. A inspeção da cidade não substitui um benchmark de combate naquele mapa.
- A máscara continua no caminho CanvasTexture.refresh → atualização da fonte → upload integral por `texImage2D`. Retirar apenas seu quad de composição mantém o processamento Canvas/upload. Congelar o listener retira muito mais trabalho e mantém uma imagem antiga: serve exclusivamente para localizar custos.

### Retrato, pixels e densidade

O canvas observado passou de 800×450 para 800×1731: 360.000 contra 1.384.800 pixels, **3,847×**. A máscara passou de 400×225 para 400×866: 90.000 contra 346.400 pixels, **3,849×**. Seu bitmap RGBA nominal passa de 360.000 para 1.385.600 bytes; uma atualização a 30 Hz representaria 10,8 contra 41,568 MB/s de conteúdo RGBA, sem medir transferências reais ou cópias internas.

Isso amplia trabalho de preenchimento/composição, upload e a região visível de tiles. Não comprova que resolução seja o principal limitador em Android. Transparência não implica custo zero: um quad com mistura pode processar toda sua área mesmo onde o alpha é zero. Não se mediu a quantidade real de fragmentos.

A configuração informa base 800×450 e EXPAND para toque, sem multiplicador `resolution` explícito. As dimensões CSS/display, o backing canvas e DPR são grandezas distintas. Aqui DPR era 1; não foi medido DPR 2/3 físico. No telefone devem ser registrados juntos pelo coletor. Não houve redução de resolução nem mudança de escala.

## Experimento controlado

Roteiro: [render-pipeline-profile.browser.mjs](../../tests/render-pipeline-profile.browser.mjs). Cena real da fábrica **pausada**, posição aproximada (-1100, -4800), câmera avançando dois pixels por passo, dez passos de aquecimento e 15 medidos por lote, ordem direta/inversa. Não é combate, simulação de IA, multiplayer ou medição de FPS apresentado.

O loop automático é suspenso somente no fixture. Entre passos manuais há cessão ao navegador e espera até o orçamento de 30 Hz, descontado o trabalho síncrono. Isso evita o replay inicial inteiramente síncrono que podia acumular trabalho gráfico. A espera fica fora do tempo cronometrado. Mesmo assim não há fence de GPU nem garantia de apresentação; os números permanecem limitados pelo renderizador por software. A suíte Node estava terminando durante a preparação/primeira orientação, outra fonte de variabilidade. Os primeiros ensaios sem cessão não são usados como confirmação de ganho.

Modos exclusivos do teste:

1. `full`: todos os elementos originais do fixture.
2. `freeze-lighting`: ignora o listener de iluminação; máscara antiga permanece visível.
3. `no-tilemaps`: filtra as camadas apenas para a câmera; mantém os dados de oclusão.
4. `no-overlay`: filtra o quad da máscara, mantendo composição/upload.
5. `full-with-robots`: oito robôs adicionais desenhados, sem combate.

Filtros, wrappers e objetos extras são restaurados ao terminar. Nenhum desses isolamentos é importado pelo jogo. Não se subtraem as médias para atribuir parcelas aditivas: filas, caches e composição interagem. Com 15 amostras p99 frequentemente coincide com o máximo.

| Canvas / lote | Modo | Média ms | Mediana | p95 | p99 / máximo | >33,33 ms | Draw calls/quadro |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 800×450 / 1 | full | 48.97 | 51.20 | 108.10 | 108.10 | 12/15 | 94.00 |
| 800×450 / 2 | freeze-lighting | 22.10 | 21.30 | 29.50 | 29.50 | 0/15 | 94.00 |
| 800×450 / 3 | no-tilemaps | 32.85 | 30.30 | 66.80 | 66.80 | 5/15 | 36.00 |
| 800×450 / 4 | no-overlay | 47.97 | 43.40 | 110.40 | 110.40 | 14/15 | 93.00 |
| 800×450 / 5 | no-overlay | 24.62 | 24.70 | 35.20 | 35.20 | 1/15 | 93.00 |
| 800×450 / 6 | no-tilemaps | 25.37 | 18.50 | 69.00 | 69.00 | 4/15 | 36.00 |
| 800×450 / 7 | freeze-lighting | 12.19 | 12.90 | 20.40 | 20.40 | 0/15 | 94.00 |
| 800×450 / 8 | full | 37.80 | 29.00 | 94.70 | 94.70 | 6/15 | 94.00 |
| 800×450 / 9 | full-with-robots | 24.59 | 24.40 | 38.10 | 38.10 | 1/15 | 96.00 |
| 800×450 / 10 | full-with-robots | 22.74 | 22.00 | 31.20 | 31.20 | 0/15 | 96.00 |
| 800×1731 / 1 | full | 63.19 | 59.70 | 83.50 | 83.50 | 15/15 | 130.67 |
| 800×1731 / 2 | freeze-lighting | 18.04 | 17.90 | 27.80 | 27.80 | 0/15 | 130.67 |
| 800×1731 / 3 | no-tilemaps | 55.79 | 53.30 | 87.70 | 87.70 | 15/15 | 36.00 |
| 800×1731 / 4 | no-overlay | 63.91 | 62.10 | 87.90 | 87.90 | 15/15 | 129.67 |
| 800×1731 / 5 | no-overlay | 60.71 | 58.40 | 75.60 | 75.60 | 15/15 | 129.67 |
| 800×1731 / 6 | no-tilemaps | 56.98 | 50.40 | 99.20 | 99.20 | 15/15 | 36.00 |
| 800×1731 / 7 | freeze-lighting | 16.20 | 16.30 | 23.60 | 23.60 | 0/15 | 130.67 |
| 800×1731 / 8 | full | 60.75 | 58.70 | 79.70 | 79.70 | 15/15 | 130.67 |
| 800×1731 / 9 | full-with-robots | 60.19 | 59.70 | 72.10 | 72.10 | 15/15 | 132.67 |
| 800×1731 / 10 | full-with-robots | 61.36 | 60.70 | 83.70 | 83.70 | 15/15 | 132.67 |

[Dados completos](etapa5/pipeline.json), [execução](etapa5/pipeline-browser.log), [perfis CDP](etapa5/cpu-profiles.tar.gz).

Os lotes exibem variação importante; retirar tiles reduz draw calls sem provar uma otimização equivalente. Congelar a iluminação reduz o trabalho observado, mas produz conteúdo desatualizado e é incompatível com os requisitos. Retirar somente o quad não fornece um ganho consistente. Os robôs adicionais não constituem comparação de antes/depois: aquecimento e ordem influenciam esses lotes.

Chamadas médias no primeiro lote completo: 800×450: useProgram 19.0, bindTexture 92.0, texImage2D 1.0, culling instrumentado 1.32 ms/quadro; 800×1731: useProgram 19.0, bindTexture 128.7, texImage2D 1.0, culling instrumentado 1.80 ms/quadro. O culling instrumentado pode incluir consultas usadas pela iluminação, não apenas o desenho do mapa.

Para reproduzir após servir o repositório por HTTP na porta 8765, com Playwright/Chromium disponíveis: `BROWSER_SKIP_INTRO=1 PIPELINE_SAMPLES=15 node tests/render-pipeline-profile.browser.mjs`. Se as ferramentas estiverem fora do projeto, definir `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH` e as bibliotecas do navegador conforme o ambiente. O roteiro grava dados e perfis em `/tmp/nullborns-stage5-*`.

## Memória, GC e ciclo de vida

Os perfis CDP e fotografias de heap foram salvos. O [resumo das amostras](etapa5/cpu-summary.json) registra `texImage2D`/`drawImage` entre as chamadas nativas mais frequentes e 56/210 amostras de GC em paisagem/retrato. Os perfis abrangem todos os modos, aquecimento e esperas; a categoria `(program)` e a contagem de amostras não são tempo exclusivo de renderização nem porcentagem de uma partida. Heap JS não mede VRAM, bitmaps nativos ou pico total. Amostras de GC não demonstram que coleta seja a causa dos travamentos; tampouco ausência de amostras comprova ausência de pausas. Não há evidência suficiente para introduzir pools/caches de renderização.

Os contadores usam número fixo de categorias e restauram os métodos nativos ao parar; o coletor usa WeakSet, impede coletas simultâneas e remove seu listener em `finally`. O diagnóstico existente mantém amostras limitadas. Testes verificam restauração das duas camadas de wrappers, reset e encerramento. Não existe cache de sala ou alteração de estado multiplayer.

Não foi aprovada uma prova prolongada de ausência de vazamentos. A falha histórica ao reiniciar a fábrica após descarregar seu cache de arena (grupo destruído) permanece pendente. Não se declara criação/destruição repetida de cenas aprovada.

## Três oportunidades priorizadas

1. **Composição e upload dependentes da área:** confirmar no Android a participação do Canvas, conversão e upload. Uma alternativa futura de composição equivalente na GPU precisa reproduzir operações, sombras, recortes e alpha pixel a pixel. Esta etapa não encontrou uma implementação comprovada; não retomou deslocamento nem cache duplicado.
2. **Preenchimento e ordem de renderização:** capturar um quadro de hardware para localizar lotes rompidos e superfícies transparentes custosas. Só agrupar operações com ordem/composição equivalentes. A queda de chamadas ao esconder camadas não autoriza reordenar o mapa. O fixture de robôs já mostra batching.
3. **Recursos e pausas durante partidas longas/transições:** medir alocação, GC e residência de texturas com rotas repetidas e quatro jogadores. Os aproximadamente 607 MiB nominais de imagens inventariados anteriormente não são VRAM medida. Descarregar/compartilhar recursos sem validar usuários de cada cena pode quebrar o jogo; nenhum cache ou pool novo foi integrado.

Nenhuma dessas oportunidades atingiu os critérios de aprovação de uma otimização de produção nesta etapa.

## Arquivos e validação

Adicionados `debug/RendererCounters.js`, `debug/CapturePerformance.js`, seu teste e `tests/render-pipeline-profile.browser.mjs`. Atualizados `debug/PerformanceProbe.js`, seu teste e `tests/performance-probe.browser.mjs`. Estes arquivos são diagnóstico/fixture; os módulos de produção alterados nas etapas anteriores foram preservados.

Antes: **127 arquivos, 122 aprovados, cinco falhas**. Depois: **128 arquivos, 123 aprovados, as mesmas cinco falhas**, incluindo o novo arquivo de teste do coletor. Os testes diretos de probe e coletor passaram. [Log inicial](etapa5/node-before.log), [log final](etapa5/node-after.log), [teste Chromium](etapa5/probe-browser.log). O teste de navegador confirmou ausência de importação do probe quando desligado, contadores ativos quando pedidos, reset e stop. Nenhum erro JS no roteiro gráfico concluído.

Falhas anteriores, sem nova regressão detectada:

- `js/effects/FactoryLighting.test.mjs`: cinco asserções internas já conhecidas.
- `js/interactions/FactoryDoor.test.mjs`.
- `js/map/ColisoesMapa.test.mjs`.
- `js/player/colisoes/PlayerCollisionConfig.test.mjs`.
- `js/sounds/interacoesSerra.test.mjs`: recurso `serra_circular.mp3` ausente.

Não houve alteração do renderer de produção nesta etapa para exigir um novo A/B de equivalência visual. Os modos sem efeitos são deliberadamente diferentes e não passaram a ser soluções. Não existe comparação de produção antes/depois com ganho a apresentar.

O isolamento MQTT entre duas salas de 2, 3 e 4 managers, entradas/saídas e migração de host permanece validado pelos artefatos anteriores; não foi confundido com oito cenas jogáveis. O cooperativo completo continua pendente no ponto de visibilidade da munição remota já documentado. Não foi reexecutado nem considerado aprovado. Também permanecem pendentes combate com boss/lanternas, partida prolongada e validação física.

## Procedimento reproduzível para Android físico

1. No telefone, habilitar opções de desenvolvedor e depuração USB. Conectar ao computador, autorizar a chave e usar Chrome desktop em `chrome://inspect/#devices`, com descoberta USB habilitada. Abrir o jogo no Chrome Android e inspecionar sua aba. Seguir a [documentação oficial de depuração remota](https://developer.chrome.com/docs/devtools/remote-debugging).
2. Usar uma URL que o telefone consiga alcançar. Se o servidor estiver no mesmo computador USB, configurar encaminhamento de porta conforme a [documentação oficial](https://developer.chrome.com/docs/devtools/remote-debugging/local-server). O localhost deste workspace remoto não é o localhost do telefone; uma URL encaminhada do ambiente ou túnel até o computador USB é necessária quando aplicável.
3. Usar baseline e candidato identificados por revisão, mesma compilação/configuração e estado de partida. Registrar modelo, versão Android/Chrome, orientação, DPR, temperatura/condição térmica, bateria/carregamento e cenário. Desligar screencast do DevTools e não aplicar CPU throttle no aparelho. Esperar carregamento e aquecimento terminarem.
4. Abrir `?perf=1`. Repetir três pares alternados baseline/candidato, pelo menos 60 s cada, fábrica em retrato, mesma rota de câmera e estado de energia. Repetir paisagem, inversões/tremor, combate com inimigos, boss, lanternas, quatro jogadores, troca de mapas e percurso prolongado. Não mudar orientação ou alternar de aba durante uma janela.
5. No console remoto, iniciar a coleta e executar o percurso no telefone:

```js
const { capturePerformance } = await import('/debug/CapturePerformance.js');
const report = await capturePerformance({
  label: 'fabrica-retrato-movimento-par-1-baseline',
  revision: 'IDENTIFICADOR_DA_REVISAO', seconds: 60,
  rendererCounters: false
});
copy(JSON.stringify(report, null, 2));
```

6. Salvar o JSON. Descartar janelas com `visibilityChanges > 0`, visibilidade diferente de `visible` ou viewport alterado. Os metadados antes/depois ajudam a detectar isso. O coletor não move a câmera nem muda o jogo. Recarregar entre revisões; ao concluir, chamar `window.nullbornsPerformance.stop()`.
7. Fazer uma segunda coleta separada com `rendererCounters: true` para contagens de draw/state/upload. Esses wrappers acrescentam custo: comparar também coletas sem eles e uma gravação sem `?perf=1`. Não atribuir overhead de instrumentação ao candidato.
8. Gravar também uma execução no painel Performance do DevTools para investigar quadros longos, sequência de falhas de orçamento, GC, atualização, rasterização e GPU quando disponível. O JSON agregado fornece média, mediana, p95, p99, máximo e contagem acima de 33,33 ms, mas não preserva a ordem dos quadros nem comprova apresentação. Para sequências de travamentos, usar a linha do tempo exportada. O buffer de percentis do probe é limitado; se passar de 1800 amostras, reduzir a janela ou interpretar percentis como a amostra retida, não todo o percurso.
9. Exigir ganho consistente entre pares, sem piorar caudas, memória ou outros cenários, e equivalência visual determinística antes de integrar candidato. Resultado em desktop, efeito desligado ou isolamento MQTT não substitui essa aprovação.
