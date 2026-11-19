# Validação de iluminação e hacking — 18/11/2026

As correções de produção de iluminação e aparência do operador remoto já estavam
no HEAD ao retomar o trabalho. Esta revisão altera os roteiros de validação.

## Falhas de navegador resolvidas

- `nullnet-coop.browser.mjs`: a janela de 960 × 600 ativa a paginação dos
  registros. O roteiro lia somente a primeira página, onde o arquivo de Elias
  podia não aparecer. `lerArquivosNullnet` percorre a categoria pela ação Próxima.
  A campanha completa passou com duas instâncias, MQTT local, operador cliente,
  cancelamento, snapshot antigo, BruteForce, cartão, portas, transferência de
  operador, checkpoint e encerramento nas duas telas. Relatório:
  `/tmp/hacking-coop/nullnet-report.json`.
- `novo-boss-disparo-energia.browser.mjs`: isola o combate da introdução e do
  prólogo, aguarda a centralização antes de contar o aviso dos lasers, abre o
  domo pelo atualizador real na cena pausada e verifica absorção conforme a regra
  atual. A saída usa um ponto fora da ZonaBoss do Tiled. Passaram transparência,
  61 quadros, hitbox, nove clones, cancelamento, absorção e limpeza ao sair.

## Testes focados

62 testes unitários aprovados: CoreInvasion, HackingPuzzles, NovoBossDisparoEnergia,
LasersEspiral, PlayerAnimations, FixedLightCache e TerrorLighting. Executados com
Node 24.11.1 e `--test --test-isolation=none`. Os dois roteiros de navegador
acima passaram no Chromium/Brave local. A bateria ampla anterior não foi repetida.

## Desempenho

Novo diagnóstico reproduzível: `tests/boss-combat-performance.browser.mjs`.
Usa o jogo ativo com ataques automáticos, geradores e iluminação; pula introdução
e prólogo e mantém o jogador parado e invulnerável. Aceita `PLAYWRIGHT_MODULE`,
`CHROMIUM_PATH` e `BASE_URL` pelos utilitários existentes.

Amostra final sem os outros testes de navegador em execução: 20,05 s,
338 quadros, **16,86 FPS**, percentil 95 do intervalo entre quadros **71,10 ms**,
pico de **57 projéteis**, ataques chuva e lasers, viewport 1280 × 720,
HeadlessChrome 158 / WebGL. Resultado bruto em `/tmp/boss-combat-performance.json`.

Essa taxa é baixa neste ambiente de navegador headless. A medição não identifica
a causa nem permite atribuí-la à correção de iluminação: não há comparação do
combate antes/depois. O diagnóstico anterior do compositor isolado mede outro
escopo e não representa FPS do jogo completo. Desempenho em celular físico e
com movimento/controle humano continua sem medição.
