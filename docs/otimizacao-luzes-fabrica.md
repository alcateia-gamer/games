# Iluminação da fábrica em celulares

> Relatório histórico de medições anteriores. As luzes giratórias e seu cache foram
> removidos do código e do mapa. Atualmente, os 182 pontos de emergência são neons fixos.

A composição da luz de emergência era o trecho mais caro da iluminação. O mapa medido
tinha 192 pontos nessa camada: 182 neons fixos e 10 giroflex. Os neons já possuíam cache;
o custo aumentava principalmente quando os feixes giratórios exigiam novas composições
e envios da máscara inteira para a GPU.

## Alterações

- Em dispositivos identificados pelo Phaser como móveis, a máscara de escuridão e o
  buffer de brilho passam de 800 × 450 para 400 × 225. São 75% menos pixels nesses
  buffers. O filtro linear amplia os gradientes; tiles, personagens e HUD continuam na
  resolução do jogo. Computadores, inclusive os com tela de toque, mantêm a máscara
  em resolução integral.
- Todas as transformações da máscara consideram a proporção efetiva de cada eixo,
  inclusive câmera girada, zoom e dimensões ímpares após redimensionar.
- O giroflex usa um único carimbo vermelho tanto para apagar a escuridão pelo alpha
  quanto para colorir o cenário. São dois canvases por fonte, em vez de três, e uma
  composição de cor a menos por atualização. Os recortes de portas e estátuas continuam
  compartilhados entre as duas passagens.
- O canvas da máscara é preparado com `willReadFrequently: false` antes de ser entregue
  ao Phaser: a partida compõe imagens, sem precisar ler os pixels da máscara a cada quadro.
- Permanecem a atualização do giro em 30 Hz no celular e a invalidação imediata por
  movimento da câmera, portas e mudanças de estado. A otimização não reduz o limite
  de quadros do jogo.

## Medição

Chromium com renderizador de software, contexto Android/toque, viewport 960 × 540 e
CPU limitada em 4×. Em cada trecho, foram descartadas 20 atualizações de aquecimento
e medidas as 80 seguintes, com o relógio da iluminação avançando em passos de 1/30 s.

| Trecho | Média antes | Média depois | Redução |
| --- | ---: | ---: | ---: |
| Vários giroflex visíveis, câmera parada | 60,36 ms | 25,42 ms | 58% |
| Movimento do jogador e da câmera entre giroflex | 72,60 ms | 33,08 ms | 54% |

Os valores medem o callback de composição da iluminação, não o quadro inteiro do jogo.
A emulação e o renderizador de software não substituem uma medição no aparelho físico.
A região de neons parados continua reutilizando sua composição, sem desenhos novos
durante as 80 atualizações medidas.

Para repetir, com o jogo servido em `http://127.0.0.1:8765` e Playwright disponível:

```sh
node tests/factory-lighting-performance.browser.mjs current
node tests/factory-lighting-mobile.browser.mjs
```

O primeiro roteiro salva métricas JSON, perfis de CPU e imagens das máscaras em `/tmp`.
`BASE_URL`, `PLAYWRIGHT_MODULE` e `CHROMIUM_PATH` podem configurar o ambiente dos roteiros.

## Validação

- Passaram os 11 arquivos Node de cache, iluminação de emergência, lanterna, oclusão,
  portas e luzes do boss, incluindo o novo teste da criação do canvas.
- Passaram os casos de giroflex, neons e máscara móvel de `FactoryLighting.test.mjs`,
  incluindo zoom, rotação, resize ímpar, sombras e atualização das portas.
- Passou a verificação no Phaser/WebGL em modo Android: máscara 400 × 225, jogo
  800 × 450, sombras atrás das paredes, rotação dos feixes e orientações da tela.
- A execução integral de `FactoryLighting.test.mjs` mantém três casos anteriores com
  falha: halo do escudo, foco branco no personagem e expectativa do perfil central da
  luminária. As mesmas falhas foram reproduzidas em cópias dos módulos originais de `HEAD`.
  As asserções desses casos não foram alteradas.

## Iluminação estável e falhas discretas

O ritmo ambiental foi reduzido: as luminárias comuns ficam estáveis, e apenas as
marcadas com `Piscando=true` podem apresentar mau contato ocasional. Há no máximo
uma falha ativa, sem apagão ou repiques, com 8–14 segundos de descanso global e
45–90 segundos de descanso por fonte. Não são iniciadas falhas fora da câmera.
Gerador, neons fixos, alarmes e efeitos de combate mantêm seus próprios controles.

Comparação na fábrica real, câmera parada, 24 luminárias visíveis, máscara móvel
400 × 225 e CPU emulada 4× mais lenta. Foram executadas 600 chamadas do compositor,
avançando o relógio em passos de 100 ms para simular um minuto:

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Envios da máscara para a GPU | 536 | 19 |
| Falhas simultâneas em todo o mapa | 54 | 1 |
| Menor fração do brilho configurado entre as luzes visíveis | 0% | 73,7% |
| Tempo total das 600 chamadas | 10,31 s | 0,59 s |

São 96,5% menos envios da textura e 94,3% menos tempo nesse trecho isolado. A câmera
e os atores ficaram parados para medir o reaproveitamento do cache; os valores não
representam o FPS do jogo inteiro nem uma medição em aparelho físico.

A simulação adicional de três minutos com as 198 luminárias no campo de visão passou
de 5.358 para 148 mudanças de revisão em 5.400 atualizações, com no máximo uma falha.

Reprodução, com a raiz servida em localhost:

```sh
node tests/factory-lighting-natural.browser.mjs
```

Para comparar uma versão anterior, `FACTORY_LIGHT_BASELINE` pode apontar para uma
cópia do módulo `FactoryLighting.js`; o teste a serve na mesma URL sem alterar o
projeto. `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH` e `BASE_URL` configuram o
ambiente. Relatórios e capturas ficam em `/tmp/factory-natural-{before,after}.*`.

Validação desta alteração: passaram 10 arquivos de regressão de cache, neons,
portas, lanterna, gerador, áudio e rede. `FactoryLighting.test.mjs` passou em 75 de
80 casos, mantendo exatamente as mesmas cinco falhas reproduzidas antes da edição
(cache de recortes/escudo, iluminação do boss/personagem e perfil central da lâmpada).
As expectativas desses casos não foram modificadas. Os casos atualizados verificam
estabilidade, falhas não simultâneas, suavidade, pausas, suspensão e reutilização da
máscara. Os mapas não foram alterados por esta implementação.
