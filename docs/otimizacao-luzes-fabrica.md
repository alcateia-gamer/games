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
