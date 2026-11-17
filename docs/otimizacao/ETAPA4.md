# Etapa 4 — movimentação da câmera

## Resultado

**Nenhuma nova otimização de iluminação foi integrada à produção.** Foram investigadas duas abordagens, sequencialmente: deslocar a máscara e recompor as faixas expostas; usar um cache espacial limitado para luzes fixas. A primeira melhorou um caso ideal, mas apresentou diferenças de pixels, dependia de condições restritas e teve picos maiores em retrato. A segunda encontrou o cache em coordenadas do mundo já existente e não chegou a executar um caminho novo no cenário medido.

As melhorias das etapas anteriores foram preservadas. Permanecem iguais resolução, EXPAND, campo de visão, controles, 30 FPS, iluminação, aparência, gameplay e rede. Os travamentos com câmera em movimento **não foram resolvidos nem considerados validados em Android físico**.

Ficaram somente melhorias do diagnóstico opcional, seu teste e um roteiro de perfil de movimento. Os protótipos foram retirados dos arquivos ativos e guardados em um arquivo separado para revisão/reprodução.

## Referência e ambiente

Foram revistos os três relatórios, os JSONs de medições e os nove perfis de CPU das etapas 2/3. Os perfis anteriores continuam apontando custos de `drawImage` e `texImage2D`, maiores em retrato; isso não identifica sozinho quanto é rasterização, espera do driver ou execução de GPU.

A suíte inicial confirmou **127 arquivos, 122 aprovados e cinco com falha**. Os testes Node depois dos ensaios e após a retirada dos protótipos mantiveram os mesmos números.

As ferramentas foram preparadas em `/tmp`, incluindo Chromium, Playwright e bibliotecas Ubuntu extraídas, sem instalar dependências no jogo ou alterar pacotes do sistema. HTTP limitado a 127.0.0.1. Ambiente: Chromium headless 159, Phaser local **4.2.1**, Linux, ANGLE/Vulkan **SwiftShader**, toque e user-agent Android, DPR 1 e limitação de CPU em 4×. **Não é Android físico.** Não foi repetido o experimento anterior de `texSubImage2D`, nem o de trocar `willReadFrequently`, nem o descarte de tiles rejeitado na etapa 2.

Os testes novos não conectaram ao broker de produção. Não foi alterado nenhum módulo de protocolo/sincronização nesta etapa.

## Medição em execução normal

Foi usado o diagnóstico existente com `?perf=1`, sem protótipos de iluminação ativados. Cena real da fábrica com lógica em execução, região próxima de (-1100, -4800), quatro segundos pedidos por caso. A câmera foi controlada por um listener exclusivo do roteiro: parada; translação contínua; inversões; deslocamentos rápidos com rotação/zoom oscilantes. O último caso simula tremor para o perfil; não valida todos os efeitos de shake do jogo. Não houve redução de objetos ou mudanças na implementação de produção.

Os cenários não equivalem ao combate com boss e quatro jogadores. Também não são diretamente comparáveis às médias das etapas anteriores, que usaram outras posições, estados e durações. Não se pode apresentar seus valores menores em paisagem como uma melhoria do código: o jogo de produção foi preservado.

Tempos síncronos do callback completo do loop, em ms:

| Orientação / movimento | Quadros | Média | Mediana | p95 | p99/máximo | Acima de 33,33 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Paisagem / parada | 37 | 22,44 | 21,40 | 39,50 | 40,20 | 3 |
| Paisagem / contínuo | 39 | 23,20 | 22,60 | 41,30 | 46,00 | 3 |
| Paisagem / inversões | 38 | 20,83 | 20,80 | 30,30 | 33,30 | 0 |
| Paisagem / rápido, rotação e zoom | 39 | 23,27 | 22,10 | 34,80 | 38,40 | 3 |
| Retrato / parada | 14 | 61,93 | 58,00 | 93,10 | 93,10 | 14 |
| Retrato / contínuo | 14 | 56,74 | 55,90 | 67,70 | 67,70 | 14 |
| Retrato / inversões | 14 | 56,36 | 54,80 | 74,50 | 74,50 | 14 |
| Retrato / rápido, rotação e zoom | 14 | 57,61 | 55,50 | 67,60 | 67,60 | 14 |

São janelas curtas, especialmente em retrato: p99 pode coincidir com o máximo. Não são estatísticas de uma partida prolongada nem de apresentação efetiva de frames na tela. `frame.interval`, também salvo nos dados, inclui espera/agendamento entre callbacks; não é a mesma medida de `frame.cpu` e não identifica sozinho o custo da GPU.

Separação parcial de custos, médias em ms por callback:

| Orientação / movimento | Refresh da máscara | Listeners de render sem esse refresh | Soma da lógica instrumentada |
| --- | ---: | ---: | ---: |
| Paisagem / parada | 4,85 | 4,52 | 0,41 |
| Paisagem / contínuo | 4,32 | 6,40 | 0,35 |
| Paisagem / inversões | 4,29 | 6,01 | 0,11 |
| Paisagem / rápido | 4,78 | 6,51 | 0,20 |
| Retrato / parada | 31,23 | 13,62 | 0,45 |
| Retrato / contínuo | 31,71 | 8,94 | 0,38 |
| Retrato / inversões | 31,41 | 8,83 | 0,11 |
| Retrato / rápido | 34,05 | 10,20 | 0,11 |

A última coluna inclui atualizações instrumentadas de luminárias, neons, arandelas, energia do boss e zonas, quando presentes. Não cobre toda a preparação/oclusão. Ela está contida no trabalho de render e **não deve ser somada** como custo independente. O restante dos listeners inclui composição e outras operações; não é uma medição pura do rasterizador Canvas 2D.

O `refresh` pode executar/aguardar trabalho pendente do Canvas e conversões, além da submissão da textura. Não equivale à duração pura de transferência. O renderizador disponível **não ofereceu `EXT_disjoint_timer_query_webgl2`**. Não há tempo efetivo de GPU medido, e não se usou `gl.finish` na execução normal. As amostras de perfil ajudam a localizar chamadas caras, mas não atribuem causalidade exclusiva a uma chamada presente durante um pico.

O heap JS informado foi aproximadamente 103 MB nas oito fotografias. Esse valor arredondado não mede RAM total, VRAM ou ausência de vazamentos. Não foi feito ensaio prolongado de memória.

Dados: [perfil de movimento](etapa4/motion-profile.json), [perfis CDP](etapa4/cpu-profiles.tar.gz). Nenhum erro JavaScript foi registrado nesse roteiro.

## Por que a câmera ainda exige trabalho

`posicionarOverlay` compensa a matriz da câmera, inclusive deslocamentos, zoom e rotação. `transformarMascara` usa as proporções efetivas de cada eixo entre canvas lógico e máscara. Quando a matriz muda, fontes e recortes são projetados em outros pixels. Ignorar essa mudança deixaria a luz deslocada.

A imagem final depende também de poses de personagens, lanternas locais/remotas, portas, revisões de oclusão, intensidade/falhas/energia, introdução, boss e projéteis. Essas invalidações continuam necessárias. O teste conservador de silhuetas fora da tela da etapa 3 permanece intacto.

Há ainda uma dependência importante para um cache final independente da câmera: a cor das luminárias usa `0.025 / max(1, fontes.length)`, e `fontes` é a lista filtrada pela câmera. Uma mudança na seleção pode alterar a mistura mesmo com posições de luzes fixas. Não basta guardar uma imagem final por região sem incorporar essa condição e as demais revisões.

O caminho atual permanece `CanvasTexture.refresh → TextureSource.update → updateCanvasTexture/canvasToTexture → WebGLTextureWrapper._processTexture → texImage2D`, com a imagem inteira. Não recebe um retângulo sujo. `CanvasTexture.update`, que lê pixels, não é a chamada normal de cada refresh. Não se conclui que não exista outro mecanismo no Phaser; conclui-se que o caminho utilizado não oferece upload parcial.

## Experimento 1 — máscara deslocada e faixas expostas

Protótipo aplicado apenas à resposta HTTP do teste. Reutilizava o resultado anterior somente quando todas as revisões/poses da guarda original permaneciam válidas, a parte linear da matriz era idêntica e o deslocamento nos pixels físicos da máscara era exatamente inteiro. Não arredondava deslocamentos fracionários. Nos demais casos, executava a composição original.

Usava um canvas temporário por cena, limitado ao tamanho da máscara, copiava o resultado anterior e recompunha a união das faixas recém-expostas com o mesmo pipeline. Não trocava operações de mistura nem implementava chamadas WebGL próprias. O scratch era redimensionado quando necessário e liberado no cleanup do protótipo. Acréscimo nominal de um bitmap: 360.000 bytes em paisagem ou 1.385.600 bytes em retrato, sem contar alocações internas do navegador.

O A/B foi feito na cena real **pausada**, com `game.step` para renderizar o quadro, relógio fixo, energia ligada e silhuetas ocultas somente no fixture, isolando o melhor caso de translação estática. Não é um ensaio de gameplay/combate nem uma alteração aplicada ao jogo. Quatro lotes alternados por orientação, 40 quadros medidos após aquecimento, sem leitura de pixels entre os quadros cronometrados:

| Orientação / lote | Caminho | Média | p95 | p99/máximo | Acima de 33,33 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Paisagem / 1 | Original | 58,41 | 100,80 | 128,10 | 37/40 |
| Paisagem / 2 | Deslocamento | 23,18 | 45,70 | 50,60 | 6/40 |
| Paisagem / 3 | Original | 59,75 | 92,70 | 146,50 | 40/40 |
| Paisagem / 4 | Deslocamento | 24,36 | 37,90 | 41,30 | 6/40 |
| Retrato / 1 | Original | 167,74 | 249,50 | 290,20 | 40/40 |
| Retrato / 2 | Deslocamento | 91,59 | 105,30 | 1139,60 | 39/40 |
| Retrato / 3 | Original | 264,60 | 303,30 | 1816,70 | 40/40 |
| Retrato / 4 | Deslocamento | 236,36 | 165,10 | 3680,40 | 38/40 |

Houve economia no caso ideal em paisagem. Em retrato, os p95 caíram, mas ocorreram máximos maiores e a variação entre lotes foi grande. Não se atribuiu a causa exata desses picos ao protótipo ou a GC; não há evidência suficiente para aprovar estabilidade.

**Os uploads permaneceram integrais:** 40 refreshes por lote, solicitando nominalmente 3,6 milhões / 13,856 milhões de pixels, nas duas versões. O deslocamento reduzia parte da recomposição, não a transferência da máscara inteira. O heap JS observado durante o ensaio foi cerca de 199 MB, incluindo o fixture e buffers de comparação; não representa o consumo adicional do protótipo isoladamente.

Comparação byte a byte, separada da cronometragem, 20 quadros por sequência:

| Movimento | Canais RGBA diferentes em paisagem | Em retrato | Maior diferença |
| --- | ---: | ---: | ---: |
| Inteiro em X | 10 | 70 | 1 |
| Inteiro em Y | 84 | 144 | 1 |
| Inversões | 10 | 70 | 1 |
| Fracionário | 0 | 0 | 0 |
| Tremor/zoom/rotação | 0 | 0 | 0 |
| Jogador e lanterna dinâmicos | 0 | 0 | 0 |

Os zeros dos três últimos casos correspondem ao **fallback para a composição original**: não são prova de reaproveitamento bem-sucedido nesses movimentos. No ensaio dinâmico e no de tremor/zoom não houve reutilizações; no fracionário todos os candidatos estáveis foram recusados por deslocamento não inteiro.

As pequenas diferenças dos casos inteiros mostram que copiar uma imagem já rasterizada e recompor sob outro recorte não foi byte a byte equivalente a rasterizar novamente. São compatíveis com precisão/composição/cobertura das operações Canvas; a origem exata de cada arredondamento não foi isolada. Não foi comprovado que não possam ocorrer erros acumulados em sequências longas. Não aumentei tolerância nem declarei equivalência/perceptibilidade com base apenas em diferença máxima de 1.

**Decisão:** retirado do código ativo. Falhou na igualdade de pixels, não melhorou consistentemente os piores quadros em retrato e não economizou uploads. O benefício do caso estático inteiro não demonstra solução para o personagem e a câmera em movimento normal.

Dados: [scroll-experiment.json](etapa4/scroll-experiment.json).

## Experimento 2 — região estática em coordenadas do mundo

Foi preparado um cache limitado a uma região de 512×512, dois canvases por instância de `FixedLightCache`, no máximo 2 MiB nominais adicionais por instância. A proposta só atuava no fallback individual existente, reutilizando a região enquanto sua revisão e posição fossem válidas; fora da região ou com rotação, voltava ao caminho original. O fechamento do protótipo liberava seus canvases e restaurava os métodos.

O ensaio encontrou `individual=false`: **o sistema já tinha um atlas mundial utilizável**, de 1454×1112, com origem (-1807, -6326). A dupla máscara/cor corresponde a aproximadamente 12,3 MiB nominais RGBA8, sem alegar VRAM medida. Esse atlas é o trabalho de `FixedLightCache` que precisava ser preservado.

Nos 16 quadros por versão, o protótipo teve zero builds, zero hits, 32 fallbacks e zero bytes novos de cache. As imagens coincidiram porque foi usado o sistema existente. **Não é validação visual ou de desempenho do cache novo.** Não forcei o fallback individual para criar artificialmente uma oportunidade.

**Decisão:** proposta redundante para o trecho medido, retirada. Trocar um atlas existente por blocos exige comparar reconstruções, limites, bordas, resampling e revisões; não foi demonstrado que reduza os uploads finais da máscara ou o custo em movimento. Não se adicionou outro cache à produção nem se pré-compôs um resultado que mudasse a ordem de `destination-out`, `source-in`, `source-atop` e `destination-over`.

Dados: [world-patch-experiment.json](etapa4/world-patch-experiment.json). Não foi iniciada uma terceira abordagem para repetir alternativas sem evidência de ganho.

## Retrato, transferências e memória

Foram preservados canvas **800×450 / 800×1731** e máscaras **400×225 / 400×866**. O aumento de área é aproximadamente 3,85×. No perfil atual, o refresh passou de médias próximas de 4–5 ms para 31–34 ms. Isso confirma uma associação de custo com a área expandida neste ambiente, mas não decompõe a contribuição de rasterização, conversões e driver/GPU.

Não houve culling novo de entidades, mudança de lógica fora da câmera, redução de resolução, troca de EXPAND por FIT, alteração de zoom em produção ou deslocamento de controles/HUD. Os zooms do roteiro são somente condições de teste.

Não foi repetida a atualização com `texSubImage2D` já rejeitada na etapa 3. Não se introduziu leitura completa de pixels na partida para descobrir regiões sujas: ela acrescentaria readback ao caminho que se tenta reduzir. As leituras de pixels desta etapa pertencem somente às comparações visuais dos ensaios, após as medições de tempo.

Uma alternativa futura de resolução interna menor não foi implementada. Teria implicações visuais e dependeria de autorização/avaliação separada, conforme a restrição desta etapa. Uma substituição por shader ou outro backend também exige prova visual, compatibilidade e custo real em hardware; não foi apresentada como solução pronta.

## Testes, arquivos mantidos e limitações

- `node --test` antes: 122/127 arquivos aprovados; cinco falhas.
- Depois dos ensaios e depois da retirada dos protótipos: os mesmos 122 aprovados e os mesmos cinco arquivos com falha.
- Teste direto do probe: quatro casos aprovados, incluindo contagem de quadros acima do orçamento quando o buffer circular já girou.
- Navegador: diagnóstico desligado por padrão, ativação com `?perf=1`, reset e stop verificados; sem importação do probe quando desligado.
- Oito perfis de execução normal concluídos sem erros JavaScript. Ensaios de scroll nas duas orientações também sem erros JavaScript, com diferenças visuais documentadas. O ensaio do cache regional concluiu no fallback, sem validar o caminho novo.
- `git diff --check` passou.

As falhas anteriores continuam em `FactoryLighting.test.mjs`, `FactoryDoor.test.mjs`, `ColisoesMapa.test.mjs`, `PlayerCollisionConfig.test.mjs` e `interacoesSerra.test.mjs`. Não foram modificadas suas expectativas nem corrigidas essas questões. A etapa 3 detalha as falhas internas e o áudio ausente. Logs: [antes](etapa4/node-before.log), [após ensaios](etapa4/node-experiments.log), [final](etapa4/node-after.log).

Arquivos mantidos nesta etapa:

- `debug/PerformanceProbe.js`: contador `overBudget` para durações acima de 1000/30 ms, acumulado desde reset, e tempos parciais das atualizações lógicas das luzes/zonas. Continua opcional; não é importado em partidas normais sem `?perf=1`.
- `debug/PerformanceProbe.test.mjs`: verificação dos contadores e preservação dos testes anteriores.
- `tests/lighting-motion-profile.browser.mjs`: roteiro das oito condições de movimento/orientação, snapshots e perfis CDP.
- `docs/otimizacao/ETAPA4.md`, índice e artefatos desta etapa.

Os dois protótipos, os roteiros correspondentes e o helper usado pelos ensaios foram arquivados em [experiments.tar.gz](etapa4/experiments.tar.gz) para revisão/reprodução em uma cópia isolada do projeto. Seus arquivos ativos e o hook experimental no helper foram removidos. O helper manteve as alterações válidas das etapas anteriores. Nenhum módulo de produção de iluminação, câmera ou rede foi alterado nesta etapa.

Não foram executados nesta etapa combate completo com boss/múltiplos efeitos, portas em todas as animações, oito cenas em duas salas, reconexões, migração em combate ou partidas prolongadas. Os testes de isolamento MQTT anteriores permanecem uma validação de protocolo, não de combate cooperativo. A falha anterior do roteiro cooperativo ao esperar um projétil remoto e a falha de reinício após o descarregamento da arena continuam pendentes. Não há comprovação em Android físico, medição de GPU real nem validação de vazamentos ao longo de horas.

## Reprodução do perfil mantido

Com as ferramentas isoladas e o servidor local preparados como em [ETAPA2](ETAPA2.md):

```sh
BASE_URL='http://127.0.0.1:8765/?perf=1' BROWSER_SKIP_INTRO=1 PERF_MS=4000 \
PLAYWRIGHT_MODULE=/tmp/nullborns-perf-tools/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/nullborns-browsers \
node tests/lighting-motion-profile.browser.mjs
```

Neste ambiente também foi necessário `LD_LIBRARY_PATH=/tmp/nullborns-browser-libs/root/usr/lib/x86_64-linux-gnu`. O roteiro salva JSON e perfis em `/tmp`, sem telemetria externa ou logs por quadro. Para medições mais longas, aumentar `PERF_MS`; os percentis do probe usam até as últimas 1.800 amostras, enquanto média, máximo e `overBudget` cobrem a coleta desde reset.
