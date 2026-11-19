# Robôs do mapa 1 — spawn e colisões — 19/11/2026

Implementação sobre `ea75f1b`. O JSON `assets/map/InicioFase1 (1).json` já estava modificado no workspace e não foi editado nesta correção.

## Causas identificadas

1. `EnemySpawnManager.findPosition()` tentava a região original e, depois, uma versão ampliada. `autorizarCriacao()` também aceitava essa versão ampliada. A mesma área era atribuída à patrulha.
2. A proteção contra paredes dependia de `body.prev` estar livre. Se o início já estivesse inválido no primeiro passo, não havia uma posição segura registrada e a proteção não corrigia o movimento. Uma origem livre já do outro lado da parede também podia ser aceita.
3. A deformação visual do impacto chamava `updateFromGameObject()` antes de `World.postUpdate()`. Nessa fase, o sprite ainda não representa a posição física final; a chamada podia apagar deslocamentos e separações já aplicados ao corpo.
4. A separação discreta entre robôs podia permitir troca de lados em frames longos. Isso foi reproduzido com dois corpos Arcade reais sob pressão contra uma parede.
5. A IA preservava `combatKnockbackUntil` somente no solo, podendo substituir o impulso no host multiplayer.

## Correções implementadas

- O nascimento automático usa exclusivamente os retângulos originais de `SpawnRobo` ou `SpawnRobos`: IDs 637–643. Busca e autorização final exigem toda a hitbox dos pés dentro do retângulo. A amostragem considera os quatro cantos, inclusive com rotação.
- Não existe expansão, spawn de emergência nem nascimento ao redor do jogador. Sem espaço para o par obrigatório, o spawn é adiado. Foram preservados ativação, retentativa, quantidades e autoridade do host.
- A validação da imagem inteira e das margens contra obstáculos, jogadores, outros robôs e limites do mapa permanece ativa. O retângulo de nascimento não limita a patrulha depois da criação.
- Os perfis físicos existentes foram mantidos: atirador com pés de **41,4 × 25,3 px** e serra com **68,4 × 36 px**, já considerando suas escalas. Hitbox de dano, alcance, animações, força de knockback e profundidade não foram redimensionados.
- `protegerColisaoInimigo()` registra a posição segura no nascimento e usa uma única atualização compartilhada por mundo físico. Primeiro aplica a varredura existente de paredes/contorno a todos os corpos; depois varre o movimento relativo dos pares pertencentes ao grupo que já possui collider.
- As reduções de movimento entre pares são propagadas com limite finito pelo número de robôs, antes de escrever nos corpos, sem repetir consultas ao mapa. Quem se afasta de um contato pode continuar. Isso cobre impactos simultâneos, aproximação frontal e filas junto a paredes.
- A velocidade é corrigida nas componentes bloqueadas. O `postUpdate()` original do Arcade sincroniza o sprite; o cálculo de profundidade existente continua no `POST_UPDATE` da cena. Não foi adicionado outro collider ou uma atualização de profundidade.
- A deformação visual preserva posição e dimensões físicas mesmo durante callbacks da física. A IA mantém o impulso pelo período configurado no solo e no host.
- Clientes continuam usando representações remotas, sem uma segunda simulação. Não foram adicionadas mensagens por frame ou objetos físicos ao jogo.

## Arquivos modificados

| Arquivo | Alteração |
| --- | --- |
| `js/enemies/EnemySpawnManager.js` | Região original na busca e autorização; contenção pelos pés; retirada da restrição regional da patrulha. |
| `js/enemies/EnemyCollision.js` | Posição segura inicial, etapa compartilhada e varredura relativa entre pares do collider existente. |
| `js/combat/CombatEffects.js` | Preservação da posição física durante a deformação visual de impacto. |
| `js/enemies/EnemyAI.js` | Preservação da duração do knockback também no host. |
| `js/enemies/EnemySpawnManager.test.mjs` | Regressões sem expansão, sete IDs reais, pés na borda, regiões pequenas e parcialmente bloqueadas. |
| `js/enemies/EnemySpawnValidation.test.mjs` | Validação dos pés nas regiões originais com parser e corpos estáticos reais. |
| `js/enemies/EnemyCollision.test.mjs` | Origem inválida no primeiro passo, impacto durante a física, pares, filas, ordem de registro, cantos e limpeza. |
| `js/enemies/EnemyAI.test.mjs` | Duração do knockback no solo e host. |
| `tests/city-robots.browser.mjs` | Dano antes do postUpdate, sincronização corpo/sprite, cantos, frames longos e contato entre corpos reais. |
| `tests/city-robots-multiplayer.browser.mjs` | Paredes após dano dos jogadores, posições físicas/visuais replicadas e navegador configurável. |
| `tests/spawns-seguros.browser.mjs` | Cidade validada pelo retângulo original e diagnóstico da assertiva da fábrica. |
| `docs/spawns-robos-seguros.md` | Atualização da regra de spawn da cidade. |
| `docs/correcao-robos-mapa1-2026-11-19.md` | Este relatório. |

## Testes executados e resultados

Node **24.11.1**, arquivos executados separadamente para isolar mocks globais do Phaser:

- As seis suítes obrigatórias passaram: `EnemySpawnManager`, `EnemySpawnValidation`, `EnemyCollision`, `EnemyPathfinding`, `EnemyAI` e `ProfundidadeMapa`: **85 casos, zero falhas**.
- Verificação ampliada: todos os testes de `js/enemies/`, `js/combat/`, `ColisoesMapa`, `ProfundidadeMapa` e `CoopRegression`: **24 arquivos, 301 casos aprovados, zero falhas**.
- Duas regressões novas foram executadas contra os módulos anteriores: ambas falharam antes da correção (origem inválida no primeiro passo e posição alterada pelo squash) e passaram no código corrigido.
- `tests/city-robots.browser.mjs`: **638 verificações aprovadas** no Phaser real. Conferiu as sete regiões, ambos os tipos, corpo real contido, rejeição de região bloqueada/pequena, impactos consecutivos, corpo/sprite, cantos, bordas, dois robôs sob pressão e frames de até **1.000 ms**. Também conferiu depth pelos pés, descarte, reposição e autoridade.
- `tests/city-robots-multiplayer.browser.mjs`: **aprovado com 2, 3 e 4 jogadores**, usando broker MQTT local. Conferiu spawn pelo host, dano de cada jogador, contenção por paredes após a física, posição física e visual no cliente, ausência de corpo físico nas réplicas, remoção e respawn sem duplicação.
- `tests/spawns-seguros.browser.mjs`: cidade aprovada; o teste completo **falha na fábrica**, na assertiva de que todas as 18 regiões invocaram ao menos uma unidade. As regiões 1616, 1623, 1624 e 1631 ficaram com zero invocações nesse cenário. A mesma falha e os mesmos contadores foram reproduzidos servindo as versões anteriores de `EnemySpawnManager`, `EnemyCollision` e `CombatEffects`, com o teste anterior e os mapas atuais. Não é resultado aprovado para a fábrica.
- `git diff --check`: sem erros.

Evidências locais: `/tmp/robots-unit-final/summary.json`, `/tmp/robots-unit-final/*.log`, `/tmp/city-robots/solo.json`, `/tmp/city-robots/multiplayer.json`, `/tmp/robots-city.log`, `/tmp/robots-multiplayer.log`, `/tmp/robots-safe-spawns.log` e `/tmp/robots-baseline-spawns.log`.

## Limitações restantes

- A falha preexistente do cenário de cotas da fábrica permanece; seu sistema de ondas não foi alterado para fazê-lo passar.
- Não foi realizado benchmark de FPS em aparelho celular físico. A proteção reutiliza o índice espacial e os colliders existentes, compartilha o listener físico e limita os cálculos entre pares ao grupo já limitado pelo gerenciador.
- Os testes cobrem os cenários descritos; não constituem uma medição exaustiva de todas as combinações de física, latência ou hardware.
