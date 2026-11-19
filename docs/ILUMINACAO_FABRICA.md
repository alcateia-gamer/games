# Iluminação da fábrica — revisão de 19/11/2026

A fase `Level1Parte2` não lê pontos de `LuzesFabrica`, `Luzedeemergencia` ou `IluminaçãoBoss`. O JSON do mapa foi mantido como estava no workspace, com as alterações do usuário.

## Estrutura atual

- `FactoryLighting`: somente estado de energia e relógio da partida do gerador. Não possui lâmpadas, estados individuais, candidatos, cores, falhas aleatórias ou listas vazias de luminárias.
- `TerrorLighting` / `FactoryAmbientLighting`: um compositor de escuridão, compartilhado pelo ambiente, cone antes da energia e efeitos dinâmicos essenciais da arena.
- `DoorLightingZones`: geometria de `LuzApagada`, associação às portas, opacidade, transição e restauração de rede. Cada zona é desenhada por um retângulo reutilizado; não depende de índices de luminárias.
- `BossRoomLighting`, `BossIntroLighting` e `BossEnergyLighting`: geometria da arena, ambiente/aura da introdução e fontes dinâmicas dos ataques, torres, escudo, boss e cópias. Nenhuma fonte fixa é inventada para substituir os antigos pontos.
- `FlashlightLifecycle`: progresso irreversível da lanterna dentro da partida.

## Antes do gerador

O ambiente conserva a escuridão de 0,75. O cone usa a posição da barriga, direção, escala e espelhamento originais. Paredes, portas e camadas de primeiro plano continuam recortando o feixe; a silhueta do jogador recorta a lanterna quando ele olha para cima. Aliados usam a pose replicada existente.

São criados apenas os recursos necessários à lanterna, ambiente e zonas. Recursos dinâmicos de composição do boss são inicializados quando suas fontes ficam visíveis. O cone e a máscara de oclusão são canvases locais; não são texturas Phaser exclusivas nem são enviados pela rede.

## Ativação e descarregamento definitivo

A primeira ativação grava `factoryFlashlightRetired` no registry da partida. Essa chave é independente de `luzFabricaAcesa` e não volta para falso durante a mesma partida.

A rotina é idempotente e:

1. Destrói o índice `FlashlightWalls` exclusivo da lanterna.
2. Zera e libera as referências do canvas do cone e do canvas de oclusão.
3. Esvazia e libera as lanternas aliadas e a referência `scene.recursosLanterna`.
4. Retira a atualização da pose do fluxo de estado local do cooperativo e passa a publicar `flashlight: null` no envelope já existente.
5. Ignora poses remotas e cálculos de cone/oclusão posteriores.

Não há novos envios por frame. A flag autoritativa já existente `coopProgress.flags.factoryGeneratorPowered` determina a aposentadoria em reconexão, entrada tardia ou migração de host. `CoopWorld.applyFlags()` aplica o descarregamento local mesmo quando a iluminação atual foi apagada por DEV.

Antes de criar recursos, o compositor consulta o registry e o progresso autorizado da sala. Uma visita com histórico de gerador ativado não cria os canvases nem o índice exclusivo da lanterna. O estado pode ser registrado antes de o runtime multiplayer terminar de inicializar.

`BootPartida` remove `factoryFlashlightRetired` ao começar uma nova partida. Uma nova partida solo ignora o histórico de uma sala multiplayer antiga que ainda esteja no registry. O gerador atual e sua progressão continuam com os contratos existentes.

## Ambiente e ferramentas DEV

Com energia, a fábrica usa iluminação uniforme, conservando as cores do mapa e a transição de partida sincronizada com o gerador e seus três estalos. O brilho estabilizado conserva a sombra ambiente básica de 0,4.

Depois da aposentadoria, apagar a luz por DEV pode escurecer a fábrica, mas não recria a lanterna. Fora da arena, o compositor reutiliza uma máscara preta uniforme e altera apenas o alpha do overlay. Câmera e portas não exigem atualizar a textura inteira: os retângulos das zonas continuam posicionados no mundo.

Resize e entrada/saída da arena invalidam o modo quando necessário. Os índices do boss, as máscaras de energia, a máscara ambiente e as zonas não são destruídos junto com a lanterna.

## Portas e boss

As zonas conservam os limites e rotações do mapa. Uma área continua escura enquanto a porta está fechada ou abrindo; a revelação original acontece após a abertura. O pareamento de porta01/porta04, as salas conectadas, a restauração e a replicação foram mantidos. Foram retirados apenas o escalonamento por lâmpada e os índices que não possuem mais fontes.

A arena conserva sua escuridão própria, independente do ambiente externo. A introdução usa os limites já existentes da arena para ambiente e aura. `NovoBossIntroducao` não busca neons para iniciar a sequência. A energia de projéteis, torres, escudo e aura mantém seus perfis e cores existentes; as silhuetas continuam ocultando o brilho e os sprites do boss conservam o clareamento próprio.

Os neons e as arandelas fixas removidos do mapa não são recriados manualmente. Seus parsers, controladores e caches não são instanciados. Os módulos `EmergencyLighting.js` e `BossWallLighting.js` conservam somente perfis matemáticos reutilizáveis, sem classes, leitura do Tiled ou fontes. O arquivo `FactoryNeonDefaults.js`, que continha os antigos IDs, foi removido após verificar que não tinha mais consumidores.

## Código obsoleto retirado

- Parsing de pontos, áreas luminosas e propriedades de cor, intensidade, raio, orientação e piscada.
- Estados, seleção por câmera e relógios de falhas de luminárias em `FactoryLighting`.
- Composição dos neons, arandelas e atlas fixo pelo compositor da fábrica.
- Índices de luminárias nas zonas e limiares individuais na introdução.
- Sons ocasionais de luminárias e seus timers; preservados os sons da partida do gerador.
- Snapshot periódico de falhas luminosas e flag de réplica desses estados.

A busca por nomes das três camadas, `lerLuzesFabrica`, `criarSomPiscadasAmbiente` e `padraoNeonFabrica` não encontrou referências no código de produção.

## Arquivos alterados nesta refatoração

Produção:

- `js/effects/FactoryLighting.js`, `FactoryAmbientLighting.js`, `TerrorLighting.js`.
- `js/effects/FlashlightLifecycle.js` (novo) e `FlashlightPose.js`.
- `js/effects/DoorLightingZones.js`, `BossIntroLighting.js`, `BossRoomLighting.js`.
- `js/effects/EmergencyLighting.js`, `BossWallLighting.js`; remoção de `FactoryNeonDefaults.js`.
- `js/sounds/luzFabrica.js` e `js/enemies/novoBoss/NovoBossIntroducao.js`.
- `js/multiplayer/CoopPlayers.js`, `CoopWorld.js`, `CoopRuntime.js`.
- `js/scenes/BootPartida.js` e comentário de inicialização em `Level1Parte2.js`.

Os testes desses módulos foram adaptados à remoção das fontes, incluindo `FactoryDoor.test.mjs`, `CoopRegression.test.mjs` e `NovoBossIntroducao.test.mjs`. Novos roteiros: `tests/factory-lighting-lifecycle.browser.mjs`, `tests/factory-lighting-lifecycle-coop.browser.mjs` e fixture unitária `tests/lighting-fixture.mjs`.

As alterações anteriores de fuga do tentáculo e o JSON do mapa não foram revertidos ou incluídos como correções de iluminação.

## Testes e evidências

As sete suítes obrigatórias passaram: **59 casos aprovados** em `FactoryAmbientLighting`, `TerrorLighting`, `FactoryLighting`, `DoorLightingZones`, `FlashlightPose`, `FactoryGenerator` e `CoopRegression`.

A suíte geral foi executada com cada arquivo em processo Node separado: **150 arquivos, 1.427 casos aprovados e sete falhas**. As sete falhas estão em `PlayerAnimations.test.mjs`, e foram reproduzidas extraindo e executando o mesmo arquivo no HEAD anterior, sem esta refatoração. Os outros 149 arquivos passaram. Também passaram os 19 casos da introdução e os 12 casos restantes dos sons do gerador.

Navegador real, Brave/Playwright:

- `factory-lighting-lifecycle.browser.mjs`: fábrica sem fontes, cone antes da energia, recursos liberados, iluminação ligada, DEV apagado, retorno sem recriar lanterna e nova partida com lanterna disponível.
- `factory-lighting-lifecycle-coop.browser.mjs`: dois jogos com MQTT local. Host instala bateria, cliente instala gasolina e solicita a ativação; ambos liberam canvases, índice e aliados. Pose de lanterna deixa de ser publicada; flags e retorno preservam a desativação.
- `tentaculo-coop.browser.mjs`: entrada e preparação do boss em dois jogos, boss e HUD presentes, efeitos em execução e fuga do host/cliente funcionando sem erros JavaScript.
- `factory-flashlight.browser.mjs` foi executado. Após a correção da invalidação por animação dos braços, chegou à etapa de caminhada, mas parou por timeout esperando velocidade do jogador. O roteiro completo não foi declarado aprovado; seu cenário antigo de entrada na arena não foi reescrito nesta tarefa.

Medição isolada do compositor fora da arena, após a energia: **300 chamadas consecutivas sem upload da textura**. O tempo observado está em `/tmp/factory-lighting-solo/report.json`; não é uma comparação de FPS do jogo nem uma medição em celular físico. Não foi calculada uma redução percentual de memória ou desempenho sem baseline equivalente.

Evidências: `/tmp/factory-lighting-all-unit/summary.json`, `/tmp/factory-lighting-baseline-animations.log`, `/tmp/factory-lighting-coop/report.json`, `/tmp/factory-lighting-solo/report.json`, screenshots `antes.png`/`depois.png` na mesma pasta e `/tmp/factory-lighting-boss.log`.

`git diff --check -- js docs tests` passou. O JSON modificado pelo usuário tem whitespace próprio, preservado.

## Limitações

Não houve teste em celular físico, comparação de FPS com a implementação anterior ou auditoria visual pixel a pixel dos antigos neons, que foram removidos junto com sua origem. Os roteiros antigos de diagnóstico exclusivos de luminárias individuais precisam usar a nova arquitetura antes de servirem como benchmarks comparáveis.
