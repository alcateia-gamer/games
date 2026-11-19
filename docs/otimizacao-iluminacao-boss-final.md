# Iluminação estática da arena final

> Documento histórico da implementação de 18/11. A arquitetura atual removeu as fontes fixas do Tiled; consulte [Iluminação da fábrica](ILUMINACAO_FABRICA.md).

Implementação e validação em 18/11/2026.

## Análise antes da edição

- `MapaFabrica.js` carrega os objetos do Tiled. `FactoryLighting.js` controla as
  luminárias comuns e o gerador; `EmergencyLighting.js` lê os neons de
  `Luzedeemergencia`; `BossWallLighting.js` lê `IluminaçãoBoss`.
- No mapa atual, os 182 neons e as 16 arandelas estão dentro de `ZonaBoss`.
- `TerrorLighting.js` compõe canvases 2D de escuridão e cor, usando perfis luminosos
  pré-calculados. O Phaser exibe uma CanvasTexture em um Image sobre a cena. Esse
  caminho não usa Graphics por luz, RenderTexture, Light2D, shader ou pipeline customizado.
- `FixedLightCache.js` já guarda máscara/cor em coordenadas do mundo e carimbos
  pequenos dos neons. Durante a introdução, recompõe somente a região alterada,
  preservando as sobreposições. Não havia motivo para substituir esse cache.
- `NovoBossIntroducao.js` controla a viagem de câmera, as torres e o escudo.
  `BossIntroLighting.js` calcula os limiares individuais por altura: fileiras de
  baixo para cima, seguidas do acendimento vermelho e da claridade ambiente.
  `CoopBossReplica.js` replica o estado desse controlador.
- O cache fixo ainda varria suas 198 fontes em todos os quadros. Movimentos e
  mudanças de frame dos atores invalidavam o buffer de cor, recortando os brilhos
  fixos pelas silhuetas e provocando novas composições/envios à GPU.
- A passagem dos atores também criava Set e arrays temporários por quadro.
  Ataques, aura, escudo e lanternas têm dependências dinâmicas próprias.

## Alterações

`TerrorLighting.js` só declara o cache estável depois da apresentação, quando as
transições das zonas associadas terminaram. A revisão das zonas e as revisões de
paredes, estátuas e oclusão das arandelas continuam invalidando o cache. Durante a
introdução, todos os fatores continuam avaliados como antes; o avanço das fileiras
não depende de uma nova política de revisão.

`FixedLightCache.js` usa essa declaração opcional para evitar a varredura e suas
alocações quando nada mudou. Fontes adicionadas/descartadas invalidam o atalho.
A condição só é habilitada quando todas as fontes fixas pertencem à arena; mapas
com fontes externas conservam o comportamento anterior. Futuras mudanças em
posição, raio, cor ou intensidade de uma fonte declarada estável deverão invalidar
essa declaração; atualmente não existem escritores desses campos durante a luta.

Após a abertura, a cor fixa é composta antes do buffer de efeitos dinâmicos, sem
recortes individuais dos personagens ou do boss. Os sprites mantêm seus objetos,
frames, transparências e profundidades. A aura, o clareamento próprio do boss,
projéteis, escudo, lanternas e seus recortes continuam no caminho dinâmico. Durante
a abertura, mantém-se a composição anterior. O Set de atores é reutilizado, e os
arrays intermediários de companheiros/inimigos/jogadores remotos foram eliminados.

Não foram alterados roteiro, tempos, ordem de acendimento, ataques, habilidades,
balanceamento, mapa ou protocolo de rede. A entrada tardia usa `ativa=false` do
snapshot existente. Recomeçar a apresentação desativa o atalho imediatamente.
Os recursos continuam pertencendo à cena e sendo liberados no shutdown; não foram
adicionados listeners, timers de produção ou texturas.

## Memória e escolha do cache

Foi mantido o cache Canvas 2D existente: adicionar uma RenderTexture duplicaria
recursos e exigiria reproduzir a combinação de máscara por alpha e cor. Os dois
atlas atuais mediram **1454 × 1112**, ou 12.934.784 bytes RGBA juntos. Incluindo os
carimbos individuais, o cache mediu **19.303.328 bytes (18,41 MiB)** antes e depois.
Essa conta é dimensional, não uma medição do heap ou da memória total da GPU.

Permanece o limite existente de 4 Mi pixels/4096 por eixo, com fallback individual
para mapas maiores. Nenhuma textura maior foi introduzida. A resolução móvel da
composição permanece a existente; o consumo do cache ainda deve ser acompanhado
em aparelhos com pouca memória.

## Medição real

Brave/Chromium headless com SwiftShader, viewport 1280 × 720, neste computador.
O diagnóstico descartou 30 chamadas de aquecimento e mediu as 120 seguintes,
com câmera parada. Aura, ataques, luminárias comuns e partida do gerador foram
isolados **somente no teste** para medir as fontes fixas. O movimento alterna a
posição do jogador; a câmera fica parada para não misturar seu custo.

| Medida isolada | Antes | Depois |
| --- | ---: | ---: |
| Compositor, jogador parado, média | 0,214 ms | 0,173 ms |
| Compositor, jogador movendo, média | 6,660 ms | 0,165 ms |
| Compositor, jogador movendo, p95 | 9,200 ms | 0,300 ms |
| Consultas de fatores pelo cache em 120 chamadas | 23.760 | 0 |
| Envios da máscara, jogador movendo, em 120 chamadas | 120 | 0 |
| Bytes RGBA do cache | 19.303.328 | 19.303.328 |

A redução de aproximadamente 97,5% se refere ao compositor nesse diagnóstico,
sem efeitos dinâmicos. Não representa redução de todo o quadro ou ganho de FPS
no combate com ataques ativos.

Também foram amostrados quadros reais da cena durante 3 segundos na abertura e
3 segundos depois de sua conclusão, com aura/torres normais e ataques automáticos
desativados. Na primeira comparação: abertura **18,55 → 16,95 FPS**; após a abertura
**22,55 → 19,12 FPS**. Essa amostra ficou pior após a alteração: não há evidência
nessa execução de ganho no FPS total. São janelas curtas, renderização em software
e uma carga distinta do diagnóstico isolado; não permitem atribuir a variação
exclusivamente à iluminação fixa. O custo dinâmico de aura, torres, oclusões e
renderização geral permanece. Uma repetição da versão alterada mediu **17,87 FPS**
na abertura e **20,19 FPS** após a abertura, ainda abaixo da amostra original.
Não foi confirmado ganho de FPS total; a diferença precisa de investigação em
hardware real e amostras mais longas.

## Validação

- Efeitos: **150/154** verificações passaram. As quatro falhas já foram reproduzidas
  antes da edição: subteste do escudo, seu teste agregador, foco branco no personagem
  e expectativa do perfil central da luminária. Nenhuma expectativa antiga foi relaxada.
- Boss: **254/254** verificações passaram.
- Multiplayer e controlador da introdução: **166/166** verificações passaram,
  incluindo restauração de entrada tardia após o fim da abertura.
- Novos testes verificam cache sem varreduras, invalidação por zonas/obstáculos,
  alterações estruturais, retomada da introdução, poses locais/remotas, manutenção
  de efeitos dinâmicos e liberação de buffers/listener no shutdown.
- O roteiro Phaser real `novo-boss-introducao-luzes.browser.mjs` passou antes e
  depois: arena inicialmente apagada, progressão das fileiras, vermelho, quatro
  torres, escudo, reinício e liberação de controles, sem erros de página/assets.
- O novo diagnóstico passou no navegador com zero consultas/envios no trecho fixo.
  Máscaras determinísticas em cinco estágios da abertura tiveram alpha idêntico
  e diferença máxima de 1/255 por canal RGB entre execuções. Capturas da cena
  inteira têm diferenças de frames/tempo entre sessões e não são comparação pixel a pixel.
- O helper de navegador foi ajustado para pular a transmissão inicial pelo teclado
  após o preloader iniciar; antes expirava aguardando a primeira fase.
- `git diff --check` passou.

Pendente: sessão multiplayer real com múltiplos clientes/entrada tardia, celulares
físicos, perfil completo de GPU/heap, combate prolongado com ataques ativos e
medição estatística de FPS. Não se afirma ganho de FPS nessas condições.

## Reprodução

Com a raiz servida em localhost, Node e Playwright disponíveis:

```sh
node --test js/effects/*.test.mjs
node --test js/enemies/novoBoss/*.test.mjs js/multiplayer/*.test.mjs
node tests/novo-boss-introducao-luzes.browser.mjs
LIGHTING_MEASURE_FPS=1 node tests/boss-static-lighting.browser.mjs after
```

`BASE_URL`, `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` ou `CHROME_CDP` configuram o
ambiente. `LIGHTING_MEASURE_FPS=1` habilita as amostras da cena real; sem essa
opção, o teste mede apenas o compositor isolado. JSON e máscaras são salvos em
`/tmp/boss-static-*`. Para comparar o código anterior, sirva-o em outra URL e use
`BASE_URL=... node tests/boss-static-lighting.browser.mjs before`.

Nesta máquina, Node não estava no PATH: foi usado o runtime do Electron com
`ELECTRON_RUN_AS_NODE=1 /snap/code/current/usr/share/code/code`, isolamento de testes
desativado, e Playwright temporário em `/tmp`. As duas versões foram servidas
localmente sem restaurar ou sobrescrever os arquivos do workspace.

## Arquivos alterados

- Produção: `js/effects/TerrorLighting.js`, `js/effects/FixedLightCache.js`.
- Testes: `js/effects/FactoryLighting.test.mjs`, `js/effects/FixedLightCache.test.mjs`,
  `js/effects/BossIntroLighting.test.mjs`, `tests/boss-static-lighting.browser.mjs`,
  `tests/novo-boss-browser-helpers.mjs`.
- Este relatório. A alteração preexistente em `assets/map/InicioFase1 (1).json`
  foi preservada.
