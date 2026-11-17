# Etapa 3 — iluminação, uploads e invalidações fora da tela

## Resultado e alcance

Foi mantida **uma otimização local**: sprites de aliados, pet e Robôs Bola completamente fora do canvas deixam de participar da invalidação da oclusão do brilho. Sua lógica e os seus objetos continuam existindo e atualizando normalmente. A máscara continua sendo recomposta quando câmera, luzes, lanternas ou silhuetas que podem atingir a imagem mudam.

A melhora foi consistente no A/B de renderização com câmera parada, energia ligada e três sprites remotos simulados fora da tela. Não foi demonstrada melhora geral durante a movimentação da câmera. Os testes em execução livre continuam apresentando picos. **Os travamentos do Android não estão considerados resolvidos.**

Foram preservadas as otimizações anteriores, os 30 FPS, EXPAND, resolução, qualidade, shaders, iluminação, física, combate e o protocolo cooperativo. Não foram alterados arquivos de configuração, mapas ou assets. Os relatórios anteriores permanecem disponíveis.

## Referência atual e ambiente

Antes de editar, `node --test` confirmou 126 arquivos: 121 aprovados e os mesmos 5 arquivos com falha. Foram lidos os relatórios anteriores, os JSONs de medições e os cinco perfis de CPU da etapa 2. Os perfis anteriores mostram custos de `drawImage` e `texImage2D`, com forte custo adicional em retrato.

As ferramentas foram recuperadas em `/tmp`: Playwright, Chromium, Aedes, MQTT e bibliotecas Ubuntu extraídas. O servidor HTTP foi limitado a 127.0.0.1, e os brokers MQTT/WebSocket dos testes às portas locais 18884 e 18885. Não foram adicionadas dependências ao jogo nem usados os tópicos do broker de produção.

Ambiente: Linux, Chromium headless 159, Phaser **4.2.1** do arquivo local, renderizador ANGLE/Vulkan **SwiftShader**, contexto com toque e user-agent Android, DPR 1, CPU emulada em 4×. Esses resultados não representam Android físico. O ambiente compartilhado apresentou variação entre lotes. Perfis e instrumentação possuem custo próprio.

## Caminho de composição e upload confirmado

No Phaser local:

1. `CanvasTexture.refresh()` chama `_source.update()`; não chama `CanvasTexture.update()` nem faz `getImageData` em cada refresh.
2. `TextureSource.update()` usa `renderer.updateCanvasTexture` para o canvas.
3. `canvasToTexture` atualiza o wrapper existente.
4. `WebGLTextureWrapper._processTexture` prepara binding, flipY, alpha premultiplicado e filtros e chama `texImage2D` com **a imagem inteira**. Esse caminho não recebe um retângulo sujo.

`CanvasTexture.update()` tem leitura de pixels, e o construtor também lê inicialmente, mas não são o caminho normal de cada refresh da iluminação. Isso evita atribuir os picos a uma leitura JavaScript de pixels que não ocorre ali.

Foi confirmado no navegador `device.os.android=true`, `desktop=false`, `touch=true`: máscara 400×225 para canvas 800×450 e máscara 400×866 para canvas 800×1731. A detecção desktop do Phaser parte do user-agent/plataforma, e `TerrorLighting` usa `os.desktop === false` para escolher 0,5. Isso confirma a execução na emulação; Android físico, modo “site para computador” e navegadores com outra identificação continuam pendentes.

Cada refresh solicita nominalmente 90.000 pixels em paisagem ou 346.400 em retrato: aproximadamente 0,34 / 1,32 MiB em RGBA8, sem afirmar que essa seja a transferência física efetiva. A 30 uploads/s, seriam cerca de 10,3 / 39,6 MiB/s nominais. A máscara em retrato tem aproximadamente 3,85× a área. Não foi reduzida essa resolução.

Os tempos de `refresh`/`texImage2D` são de **CPU até o retorno da chamada**. Podem incluir execução pendente do Canvas 2D, conversões e esperas do driver. Não são a duração pura da transferência nem um timer da GPU. Não foi usado `gl.finish` no jogo. Não há resultado de GPU timestamp query nesta etapa.

## Invalidações e composição

O caminho existente já reutiliza a máscara inteira quando matrizes, revisões e poses não mudam. Permaneceram suas condições de invalidação: tamanho, matriz da câmera, revisões das luzes e zonas, energia/partida/falhas, paredes e portas, oclusão de camadas/estátuas, pose da lanterna local e dos aliados, quadros/poses das silhuetas, introdução e efeitos do boss.

O rastreamento aplicado somente à resposta HTTP de teste confirmou alterações da matriz da câmera e da pose do pet no cenário solo sem inimigos. Os contadores de motivos são cumulativos desde o boot, não contagens exclusivas de cada janela. Não foi removida a comparação da câmera: pequenas mudanças do follow também podem mudar pixels. Não se mudou o lerp nem o agendador.

`FixedLightCache` já reutiliza suas composições e carimbos, com invalidação por posição, alcance, ângulo, intensidade, zonas e revisões de oclusão. Duplicá-lo ou ignorar revisões não se justificou. Separar a composição em várias texturas aumentaria memória, composição e draw calls e exigiria outra prova visual; não foi feito.

A oportunidade adicional foi específica: a lista de silhuetas de brilho incluía sprites fora do canvas, mesmo quando seu desenho não podia modificar qualquer pixel. Mudanças de posição/quadro desses objetos invalidavam e enviavam a máscara inteira. Em cooperativo com energia ligada, isso pode ser provocado por aliados em outras regiões; em solo, por pet/Robôs Bola fora da vista. Isso é diferente do descarte de tiles experimentado na etapa 2, que diminuía desenhos durante recomposições ainda obrigatórias e não eliminava o upload.

## Otimização mantida e equivalência

`SpriteLightingBounds.js` projeta exatamente o retângulo recortado usado por `SpriteLightOcclusion`: cutWidth/cutHeight, deslocamento do frame com trim, tamanho original, origem, flip, escala, rotação e matriz da câmera. Só retorna exclusão quando esse retângulo inteiro está separado do canvas, com margem conservadora de dois pixels lógicos. Campos incompletos/não finitos conservam o comportamento anterior.

Em `TerrorLighting`, essa consulta antecede a inclusão do ator no conjunto de silhuetas e a comparação de sua pose. Não modifica o ator nem evita simulação, captura de rede ou renderização normal. Entrar novamente na tela cria o registro e invalida a máscara; sair remove o registro e invalida uma vez para apagar a silhueta anterior. Remoção, invisibilidade e morte conservam a limpeza existente.

As luzes e halos do boss e dos projéteis são processados separadamente e continuam atualizando. As lanternas dos aliados também continuam calculadas: um aliado fora da tela ainda pode iluminar uma área visível. O novo teste limita somente a silhueta usada para retirar brilho de pixels do sprite.

Não há cache novo de partida, canvas adicional, textura adicional ou estado compartilhado entre salas. A função é pura e não aloca estruturas temporárias por chamada.

## A/B controlado do quadro renderizado

Foi usada a cena real da fábrica, pausada, com posições/frames/relógio controlados e `game.step` para renderizar o quadro inteiro. Inclui tiles, objetos, compositor e submissão WebGL; **a lógica de combate/física de uma cena ativa não é executada durante essa medição**. Os três aliados são sprites reais inseridos na lista de remotos, sem três conexões de combate. Esse ensaio mede o efeito das invalidações sobre o quadro renderizado, não FPS real ou uma partida completa com quatro jogadores.

Quatro lotes alternados na mesma sessão, 60 quadros por lote, descartando 10 de aquecimento; câmera parada, energia ligada, três sprites remotos animados fora da tela. Resultados finais integrados, em ms:

| Lote | Implementação | Média | Mediana | p95 | p99/máximo | Refreshes / 50 quadros |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Referência | 58,71 | 52,60 | 108,60 | 119,30 | 50 |
| 2 | Otimizada | 18,43 | 14,70 | 37,00 | 41,40 | 0 |
| 3 | Referência | 57,93 | 54,20 | 89,00 | 110,30 | 50 |
| 4 | Otimizada | 16,30 | 14,10 | 39,60 | 44,80 | 0 |

Eliminados 4,5 milhões de pixels nominalmente submetidos por lote nesse cenário. Um primeiro A/B separado também apresentou melhora em ambos os pares (médias 62,71/57,51 ms na referência e 16,16/12,78 ms com exclusão). Não extrapolar esses números ao aparelho físico ou a câmera em movimento.

Controle com os três sprites **dentro** da tela: médias da referência 58,38/60,25 ms; otimizada 59,19/57,78 ms. Ambas continuaram com 50 refreshes. Não houve ganho consistente, nem piora consistente entre pares. Os picos oscilaram: p95 da referência 78,8/103,5 ms e otimizada 91,3/95,6 ms. Não há promessa de eliminar picos quando a imagem precisa mudar.

Dados: [A/B fora da tela](etapa3/sprites-ab.json), [controle visível](etapa3/sprites-visible-control.json).

## Comparação visual e regressão móvel

- 320 casos rasterizados com câmera rotacionada/zoom, posições fracionárias, escala negativa, flip, transparência, origem e frames com trim. 298 descartes; nenhuma diferença de pixel.
- 40 comparações de uma sequência na cena real: entrada/saída da tela, rotação, flip, escala, alpha, ativo/inativo e visibilidade; câmera rotacionada e viewport ímpar 801×451. Máscaras PNG idênticas.
- O A/B final também comparou amostras das máscaras de cada lote, sem diferenças nem erros JavaScript.
- Passou o roteiro móvel existente: bloqueio da luz pelas paredes, sombras, lanterna, zoom, rotação, resize ímpar, movimento por teclado e mudança de orientação. Seus asserts visuais foram preservados. O teste usa contexto Android emulado, apesar do texto histórico “PASS: Android” no console.
- Passou o teste do diagnóstico: nenhuma importação sem `?perf=1`, ativação/reset/stop e restauração de métodos.

Artefatos: [pixels](etapa3/sprite-pixels.json), [sequência](etapa3/sprite-sequence.json), [mobile](etapa3/mobile-browser.log), [diagnóstico](etapa3/probe-browser.log). Esses testes não substituem combate com boss/lanternas remotas em Android físico.

## Execução livre antes e depois

Coletas curtas, cinco segundos pedidos por cenário, com simulação ativa. A coleta anterior também tinha rastreamento de motivos por resposta HTTP; a final tinha a instrumentação adicional de refresh. Não é um A/B determinístico, e os tempos absolutos variaram. Tempos de callback CPU em ms:

| Cenário | N | Média | Mediana | p95 | p99/máximo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Parado, antes | 42 | 60,41 | 30,80 | 203,10 | 434,30 |
| Parado, depois | 42 | 61,61 | 30,80 | 174,60 | 445,50 |
| Movimento, antes | 55 | 29,80 | 29,20 | 41,20 | 59,80 |
| Movimento, depois | 51 | 33,19 | 31,20 | 52,80 | 65,30 |

**Não demonstrou melhora geral**: o trecho de movimento teve valores maiores na coleta final, e não se deve ocultar isso. A variação e as janelas diferentes impedem atribuir causalidade a esses números; o controle A/B visível também não mostrou melhora consistente. A validação positiva da otimização está limitada ao trabalho redundante de silhuetas fora da tela. Não considero a estabilidade geral durante exploração/combatе demonstrada por esta etapa.

Na coleta final, houve 41 refreshes para 42 callbacks parados e 51 para 51 em movimento; o refresh mediano foi 8,3 / 10,0 ms. Mesmo parado, outras mudanças visuais/câmera continuaram invalidando. Portanto, esse caso solo não reproduz a grande economia do cenário controlado com aliados fora da tela.

Dados e perfis: [antes](etapa3/live-before.json), [depois](etapa3/live-after.json), [perfis CDP](etapa3/cpu-profiles.tar.gz). As métricas de CPU não medem o tempo assíncrono da GPU.

## Protótipos não integrados

**Reutilização do armazenamento GL com `texSubImage2D`:** protótipo por wrapper da máscara, separado em `debug/LightingUploadExperiment.js`. Conserva preparação de estado do Phaser 4.2.1 e fallback para recriação, dimensões/formato diferentes e perda de contexto. Ainda envia todos os pixels; não é atualização de regiões. Nas duas orientações, com energia ligada/desligada, quatro lotes alternados por condição, não houve ganho consistente do quadro ou do refresh. Exemplos de médias de quadro em paisagem sem energia: referência 24,43/30,23 ms; protótipo 33,07/31,66 ms. Em retrato com energia: referência 153,19/156,13 ms; protótipo 156,71/159,82 ms. As máscaras finais de Canvas eram iguais. Não foi promovido à produção nem considerado validado quanto a imagem GL/perda de contexto em todos os dispositivos; a rejeição por desempenho encerrou essa linha. O roteiro contém verificações GL adicionais para futuras execuções, que não integram a validação declarada aqui.

**Canvas com `willReadFrequently: true`:** aplicado só à resposta HTTP de teste. Quatro reconstruções alternadas fora da arena produziram máscaras iguais e mantiveram um listener de render. Médias do quadro: false 32,94/35,67 ms; true 40,18/35,97 ms. Sem ganho consistente, preservado `false` em produção. Na execução desse protótipo, os contadores de refresh do probe ainda não observavam explicitamente a cena pausada: seus zeros não significam ausência de upload. Essa limitação foi corrigida no roteiro com `watchScene`; os tempos completos de quadro e as chamadas GL dessa execução permanecem úteis.

**Uploads parciais:** não há API de retângulo sujo no caminho utilizado. Durante movimento da câmera e mudanças amplas das fontes, o benefício não está demonstrado. Descobrir diferenças por leitura completa de pixels acrescentaria readback e custo de CPU. Não foi introduzida essa leitura no jogo, nem uma alteração global do renderer.

**Mais texturas/camadas/shader substituto:** não implementados. Mudariam o caminho de mistura, memória, oclusão e compatibilidade e não possuem prova visual/ganho nesta etapa. Não foram reduzidos pixels nem reutilizados dados de uma sala em outra.

Dados: [upload](etapa3/upload-experiment.json), [Canvas](etapa3/canvas-experiment.json). Os protótipos e suas opções são exclusivos de testes e não são importados pelo jogo normal.

## Cooperativo e ciclo de vida

A asserção do pet estava desatualizada para o código atual. `CompanionPet.js` documenta o companheiro como solo; `Level1` e `Level1Parte2` só o criam quando `!multiplayer`, e o contexto remoto inicializa `companionPet:null`. A documentação cooperativa mais antiga ainda menciona pets, mas contradiz a implementação vigente. Nenhuma regra do pet foi alterada para satisfazer o teste.

O teste agora confirma a presença do pet em ambos os boots solo e, no cooperativo, confirma ausência de pets **e** identidades distintas de contextos, jogadores e eventos. Passaram depois disso: contextos, aura/cura da Nyx, habilidade do Kai e réplica do Robô Bola. O roteiro `world` parou posteriormente esperando munição remota visível na linha de teste do projétil. A asserção foi mantida; a causa desse timeout não foi determinada e não houve validação de ponta a ponta do roteiro. Ver [log cooperativo](etapa3/coop-world.log).

Um novo ensaio de protocolo com oito gerenciadores reais e broker MQTT local passou em duas salas simultâneas, com 2, 3 e 4 participantes em cada uma, saída/reentrada no lobby, entradas/frames distintos e migração de host na primeira sala sem trocar o host da segunda. **Não são oito cenas de combate renderizadas**; prova isolamento de gerenciadores/transporte nesses cenários, não toda a gameplay multiplayer. Ver [isolamento](etapa3/rooms-isolation.json).

O primeiro ensaio de reconstrução da cena, após a entrada da arena/descarregamento, reproduziu erros em grupos destruídos: leitura de `size` e `getChildren` com estrutura interna ausente, com stack em `ProgressaoMapa.descarregarFabricaParaBoss`. O mapa é descarregado nessa progressão; a causa exata de todas as referências retidas exige investigação própria. Não foi misturada uma correção de progressão/colisão à otimização. A reconstrução antes de entrar na arena funcionou nas quatro execuções do ensaio de Canvas. Ver [falha após arena](etapa3/restart-after-arena.log).

O probe agora restaura os wrappers da cena no shutdown e os instala novamente para a nova instância dos recursos; remove também suas referências de limpeza, evitando acumulação durante reconstruções de diagnóstico. Há teste específico de restauração, substituição da textura e reset dos contadores. Isso é uma correção da instrumentação, não do ciclo de vida do mapa em produção.

Continuam pendentes: Android físico; partidas longas; oito cenas reais em duas salas; combate com 3/4 jogadores; reconexão de partidas e migração de runtime em combate; sequência completa de boss/clones/projéteis; comparação visual de todos esses casos; retorno ao menu e nova campanha depois do descarregamento da arena. Não foi demonstrada ausência de vazamentos em partidas prolongadas.

## Testes Node e falhas anteriores

| Execução | Aprovados | Falhas | Arquivos |
| --- | ---: | ---: | ---: |
| Antes | 121 | 5 | 126 |
| Depois | 122 | 5 | 127 |

O arquivo novo é `SpriteLightingBounds.test.mjs`. Passaram também os testes direcionados de TerrorLighting, FixedLightCache e PerformanceProbe. `FactoryLighting` manteve os mesmos cinco casos internos com falha, 75/80 aprovados, antes e depois. `git diff --check` passou.

Falhas anteriores, mantidas e registradas sem correções ou alterações de expectativa:

- `FactoryLighting`: cache/recortes, escudo/energia, iluminação do personagem e expectativa do perfil central. Os nomes/as asserções detalhadas foram preservados nos logs; isso não determina sozinho se cada diferença está no teste ou na implementação.
- `FactoryDoor`: diferença na colisão esperada das portas próximas do atalho O.
- `ColisoesMapa`: limites retangulares, elipse, cápsula e polígono divergentes das expectativas dos testes.
- `PlayerCollisionConfig`: duas comparações de configurações de hitbox diferentes dos valores esperados.
- `interacoesSerra`: arquivo solicitado `sounds.mp3/SONS PARA BOTAR AINDA/serra_circular.mp3` ausente; o áudio `colocando.mp3` existe.

Ver [suíte antes](etapa3/node-before.log), [suíte depois](etapa3/node-after.log), [iluminação antes](etapa3/lighting-before-details.log), [iluminação depois](etapa3/lighting-after-details.log) e logs individuais nesta pasta.

## Arquivos desta etapa e reprodução

Produção: `js/effects/TerrorLighting.js` e novo `js/effects/SpriteLightingBounds.js`. A consulta não muda frequência de rede/FPS, interpolação ou simulação.

Diagnóstico: `debug/PerformanceProbe.js` e seu teste — tempos de refresh, restante dos listeners, contagem de solicitações/pixels nominais, limpeza por shutdown e observação explícita de cenas pausadas. A média/máximo cobrem a janela desde reset e os percentis usam até as últimas 1.800 amostras. `renderer.renderListeners.excludingLightingRefresh` é a diferença entre tempos síncronos aninhados; não é “Canvas puro” nem “GPU”. Sem `?perf=1`, o probe continua não sendo importado.

Testes: novo teste Node dos limites; novos roteiros de pixels, sequência/A-B de sprites, upload, backend Canvas e isolamento de salas; ajustes no helper para não exigir boss em ensaios de exploração e para esperar um jogador recriado no restart; captura de motivos/resolução em `game-performance`; correção justificada da expectativa do pet; saída de fullscreen antes de redimensionar no roteiro móvel. As asserções visuais móveis e as cinco falhas anteriores não foram flexibilizadas.

O servidor e as variáveis de ferramentas são os mesmos descritos em [ETAPA2](ETAPA2.md). Com as ferramentas isoladas preparadas, usar `BROWSER_SKIP_INTRO=1`, `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH` e, se necessário, `LD_LIBRARY_PATH` como naquela etapa:

```sh
node --test
node tests/lighting-sprite-bounds.browser.mjs
LIGHTING_SPRITE_EXPERIMENT=1 node tests/lighting-sprite-performance.browser.mjs
LIGHTING_SPRITE_EXPERIMENT=1 LIGHTING_SPRITE_ONSCREEN=1 node tests/lighting-sprite-performance.browser.mjs
node tests/factory-lighting-mobile.browser.mjs
node tests/coop-rooms-isolation.browser.mjs
PERF_MS=5000 PERF_SCENARIOS=factory-idle,factory-moving node tests/game-performance.browser.mjs referencia
```

O A/B troca somente a nova consulta pela referência anterior na resposta do servidor de teste. A produção não possui chave de descarte nem dependência desse servidor. Para estudar os protótipos rejeitados: `node tests/lighting-upload-performance.browser.mjs` e `LIGHTING_CANVAS_EXPERIMENT=1 node tests/lighting-canvas-performance.browser.mjs`. São experimentos isolados, sem autorização implícita para ativá-los no jogo.
