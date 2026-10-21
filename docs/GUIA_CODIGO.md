# Guia do código de NULLBORNS

Os comentários nos arquivos estão em português. Cada módulo começa com uma descrição de sua responsabilidade e as funções e métodos nomeados têm uma explicação acima da definição. Os comentários anteriores que já explicavam detalhes foram preservados.

## Por onde começar

1. [index.html](../index.html) carrega as bibliotecas e o módulo [game.js](../js/core/game.js). O [config.js](../js/core/config.js) define resolução, física, entrada, escala e MQTT.
2. [start.js](../js/scenes/start.js) apresenta JOGAR, a chuva digital e o menu NULLBORNS. A música começa com o fade do menu. O solo abre a seleção de personagem; o multiplayer passa pelas telas de sala.
3. [preloader.js](../js/scenes/preloader.js) carrega os recursos e abre [Level1.js](../js/scenes/Level1.js), a cidade. A porta de passagem entra em [Level1Parte2.js](../js/scenes/Level1Parte2.js), a fábrica.
4. As cenas coordenam os módulos especializados: entrada e movimento, status, combate, inimigos, inventário, interações e minimapa.

## Como ler as funções

- `constructor` registra a instância e seus valores iniciais. Nas cenas Phaser, `init` recebe dados de entrada, `preload` enfileira recursos, `create` monta a cena e `update` executa a lógica por quadro. O preloader do jogo inicia sua fila explicitamente em `create`.
- `scene` é a cena que dá acesso ao jogador, mapa, física, áudio, câmera e eventos. Uma função que recebe `scene` pode modificar esses sistemas.
- `time` representa o relógio recebido na atualização e `delta` o tempo decorrido desde o quadro anterior. Nas rotinas do jogo, esses valores são medidos em milissegundos; o código divide por 1000 ao precisar de segundos.
- Callbacks, como as funções passadas a `on`, `once` e `onComplete`, executam quando o evento ocorre. As rotinas de limpeza removem listeners, sons, texturas e objetos quando a cena termina.
- Os nomes em inglês foram mantidos para preservar imports, referências e a API existente. A explicação em português aparece junto da função.

## Conceitos usados pelo jogo

| Termo | Papel no código |
| --- | --- |
| Cena | Coordena uma tela ou uma parte da fase. |
| Tilemap e tileset | O mapa combina pequenos recortes das imagens dos tilesets. Os nomes precisam coincidir com os exportados pelo Tiled. |
| Sprite e frame | O sprite é o objeto animado; frame é o recorte da imagem mostrado naquele instante. |
| Depth | Ordem de desenho. Um valor maior aparece por cima; isso não altera colisões. |
| Corpo físico | Área usada pela física para bloquear o movimento. Pode ser menor que o desenho do personagem. |
| Hitbox de dano | Área geométrica usada para detectar ataques, separada da colisão com o cenário. |
| Registry | Estado compartilhado entre cenas durante a sessão, como inventário e energia da fábrica. |
| Host | Participante que decide e publica o estado compartilhado dos inimigos e da sala no multiplayer. |
| Cache | Reutilização de texturas, imagens preparadas, geometria ou rotas para evitar trabalho repetido. |

## Arquivos por sistema

Os arquivos de teste aparecem junto do sistema que verificam. Os quatro arquivos de som sem implementação foram identificados como reservas.

### Inicialização e transição

| Arquivo | Responsabilidade |
| --- | --- |
| [js/core/config.js](../js/core/config.js) | Configuração do Phaser: resolução lógica, física Arcade, entrada, escala e conexão MQTT. |
| [js/core/game.js](../js/core/game.js) | Ponto de entrada do jogo. Registra as cenas e compartilha os serviços de rede pelo registry do Phaser. |
| [js/core/MapTransition.js](../js/core/MapTransition.js) | Porta de passagem entre a cidade e a fábrica. Coordena animação, aproximação, fade e troca de cena. |

### Cenas e menus

| Arquivo | Responsabilidade |
| --- | --- |
| [js/scenes/start.js](../js/scenes/start.js) | Cena de abertura e menus de NULLBORNS. Fluxo: botão JOGAR → chuva digital → menu → seleção de personagem ou multiplayer. |
| [js/scenes/DeathScreen.js](../js/scenes/DeathScreen.js) | Sequência visual de morte: bloqueia o jogo, mostra falhas de sistema e recarrega a página ao concluir. |
| [js/scenes/preloader.js](../js/scenes/preloader.js) | Cena que carrega mapas, personagens, sons, interface e tilesets. Mostra progresso e prepara a textura final do raio antes de entrar na fase. |
| [js/scenes/MultiplayerMenu.js](../js/scenes/MultiplayerMenu.js) | Tela de criação e entrada em salas. Usa teclado físico ou campo DOM mobile para receber o código. |
| [js/scenes/MultiplayerLobby.js](../js/scenes/MultiplayerLobby.js) | Lobby de até quatro jogadores. Exibe participantes, escolha de personagem e prontidão antes da partida. |
| [js/scenes/Level1.js](../js/scenes/Level1.js) | Cena da cidade. Coordena mapa, jogador, companheiro, inimigos, clima, inventário, minimapa e transição para a fábrica. |
| [js/scenes/Level1Parte2.js](../js/scenes/Level1Parte2.js) | Cena da fábrica. Integra iluminação, gerador, porta interativa, boss, inventário e mudança de sobreposição por região. |

### Controles

| Arquivo | Responsabilidade |
| --- | --- |
| [js/controls/PlayerControls.js](../js/controls/PlayerControls.js) | Integra os controles de entrada, movimento, ataque e dash usados pelas cenas de jogo. |
| [js/controls/PlayerAnimations.js](../js/controls/PlayerAnimations.js) | Escolhe as animações de movimento sem interromper ataques em andamento. |
| [js/controls/PlayerMovement.js](../js/controls/PlayerMovement.js) | Converte WASD ou joystick em movimento normalizado, respeitando bloqueios, dash e animações. |
| [js/controls/PlayerInput.js](../js/controls/PlayerInput.js) | Cria WASD, controles de desenvolvedor, joystick e tela cheia; mantém os elementos fixos durante o zoom. |
| [js/controls/PlayerAttackControls.js](../js/controls/PlayerAttackControls.js) | Entrada do ataque por mouse e toque. Coordena o botão de espada e a carga e soltura do arco da Aria. |
| [js/controls/PlayerDashControls.js](../js/controls/PlayerDashControls.js) | Impulso de dash com custo de estamina, recarga e rastro temporal. O movimento normal consulta este módulo antes de aplicar sua velocidade. |

### Jogador e companheiro

| Arquivo | Responsabilidade |
| --- | --- |
| [js/player/Player.js](../js/player/Player.js) | Sprite e combate do jogador. Mantém separadas as colisões com o chão, a área que recebe dano e a área ofensiva da katana. |
| [js/player/PlayerAnimations.js](../js/player/PlayerAnimations.js) | Registra animações de caminhada, repouso e ataque para o jogador local e para os personagens remotos. |
| [js/player/PlayerProjectiles.js](../js/player/PlayerProjectiles.js) | Flechas da Aria: criação, movimento por delta, alcance, colisão com o mapa e dano a inimigos ou boss. |
| [js/player/PlayerStatus.js](../js/player/PlayerStatus.js) | Vida, estamina e HUD do personagem. Prepara os recortes da imagem original em cache e desenha a interface em canvas DOM na resolução da tela. |
| [js/player/CompanionPet.js](../js/player/CompanionPet.js) | Companheiro robótico do modo solo. Segue o jogador com desvio de obstáculos, afastamento de inimigos e recuperação quando fica preso. |
| [js/player/colisoes/index.mjs](../js/player/colisoes/index.mjs) | Consulta central das hitboxes por personagem. Dimensões e offsets são definidos nos arquivos individuais e o padrão é Kai. |
| [js/player/colisoes/kai-mercer.mjs](../js/player/colisoes/kai-mercer.mjs) | Hitboxes de Kai. width e height medem o corpo de colisão em pixels; offsetX e offsetY o posicionam dentro dos frames de caminhada e ataque. |
| [js/player/colisoes/magnus-force.mjs](../js/player/colisoes/magnus-force.mjs) | Hitboxes de Magnus. width e height medem o corpo de colisão em pixels; offsetX e offsetY o posicionam dentro dos frames de caminhada e ataque. |
| [js/player/colisoes/aria-kade.mjs](../js/player/colisoes/aria-kade.mjs) | Hitboxes de Aria. width e height medem o corpo de colisão em pixels; offsetX e offsetY o posicionam dentro dos frames de caminhada e ataque. |
| [js/player/colisoes/nyx.mjs](../js/player/colisoes/nyx.mjs) | Hitboxes de Nyx. width e height medem o corpo de colisão em pixels; offsetX e offsetY o posicionam dentro dos frames de caminhada e ataque. |
| [js/player/colisoes/PlayerCollisionConfig.test.mjs](../js/player/colisoes/PlayerCollisionConfig.test.mjs) | Testes que conferem dimensões e deslocamentos das hitboxes de caminhada e ataque de cada personagem. |

### Inventário

| Arquivo | Responsabilidade |
| --- | --- |
| [js/inventory/InventoryItems.js](../js/inventory/InventoryItems.js) | Catálogo dos itens. Centraliza IDs, nomes, imagens, empilhamento e regras de exibição; o preloader usa este registro. |
| [js/inventory/Inventory.js](../js/inventory/Inventory.js) | Estado do inventário: slots, pilhas, consumo atômico e objetos já coletados. O registry mantém os dados por jogador entre as cenas. |
| [js/inventory/InventoryUI.js](../js/inventory/InventoryUI.js) | Interface dos slots do inventário. Prepara ícones sem margens transparentes e mantém posição e tamanho durante o zoom. |
| [js/inventory/ItemPickup.js](../js/inventory/ItemPickup.js) | Coleta de itens dos mapas Tiled e botão compartilhado de interação. A tecla E atende itens, porta e gerador, respeitando o menu aberto. |
| [js/inventory/Inventory.test.mjs](../js/inventory/Inventory.test.mjs) | Testes do modelo de inventário: pilhas, capacidade, consumo atômico, persistência de coleta, isolamento por jogador e definições de itens. |

### Interações da fábrica

| Arquivo | Responsabilidade |
| --- | --- |
| [js/interactions/FactoryGenerator.js](../js/interactions/FactoryGenerator.js) | Interação com o gerador da fábrica: localiza a área do mapa, mostra o menu, consome recursos e restaura a iluminação. |
| [js/interactions/FactoryDoor.js](../js/interactions/FactoryDoor.js) | Porta da fábrica aberta por interação. Substitui os tiles por um visual animado e remove a colisão ao concluir a abertura. |
| [js/interactions/FactoryGenerator.test.mjs](../js/interactions/FactoryGenerator.test.mjs) | Testes da busca de interações no mapa atual e em mapas simulados, alcance retangular, detecção de botões e requisitos do gerador. |
| [js/interactions/FactoryDoor.test.mjs](../js/interactions/FactoryDoor.test.mjs) | Testes integrados de porta, gerador e coleta usando o mapa real com substitutos leves do Phaser. Os métodos simulados abaixo não desenham nem executam física real. |

### Mapas e profundidade

| Arquivo | Responsabilidade |
| --- | --- |
| [js/map/Level1Map.js](../js/map/Level1Map.js) | Reexporta o construtor do mapa da cidade para manter compatibilidade com os imports das cenas. |
| [js/map/Level1Parte2Map.js](../js/map/Level1Parte2Map.js) | Reexporta o mapa da fábrica e auxiliares de profundidade usados pela segunda parte da fase. |
| [js/map/MapaCidade.js](../js/map/MapaCidade.js) | Monta o mapa da cidade a partir do JSON: tilesets, camadas, objetos, luzes e colisões. |
| [js/map/MapaFabrica.js](../js/map/MapaFabrica.js) | Monta o mapa da fábrica. Corrige metadados de tilesets irregulares antes de criar suas camadas, objetos e colisões. |
| [js/map/Tilesets.js](../js/map/Tilesets.js) | Relaciona os nomes de tilesets do Tiled às texturas carregadas e prepara recortes válidos de imagens irregulares. |
| [js/map/CamadasMapa.js](../js/map/CamadasMapa.js) | Criação das camadas de tiles e definição de sua ordem visual; depth maior aparece sobre depth menor. |
| [js/map/ObjetosMapa.js](../js/map/ObjetosMapa.js) | Transforma objetos de tile do Tiled em imagens ou sprites, preservando recortes, posição, rotação e profundidade. |
| [js/map/ColisoesMapa.js](../js/map/ColisoesMapa.js) | Converte as áreas de colisão do Tiled em corpos estáticos invisíveis da física Arcade. |
| [js/map/ProfundidadeMapa.js](../js/map/ProfundidadeMapa.js) | Regras de sobreposição visual da cidade e fábrica. Ajusta depth pelo Y ou pela posição relativa ao personagem. |
| [js/map/LuzesMapa.js](../js/map/LuzesMapa.js) | Iluminação dos postes da cidade. Os comentários locais detalham as texturas de brilho, feixe e mancha no chão. |
| [js/map/ProfundidadeMapa.test.mjs](../js/map/ProfundidadeMapa.test.mjs) | Testes da sobreposição dos computadores e da ordenação de personagens e robôs. |

Personagem e robôs comuns ou de serra usam `calcularDepthAtor` com a base da hitbox
dos pés. Na cidade, seguem a escala de Y do mundo. Na fábrica, os robôs ficam na
mesma faixa do personagem: quem está mais abaixo aparece à frente, com uma variação
menor que 0,0005 para respeitar pisos e camadas posicionadas em passos de 0,001.

### Inimigos e boss

| Arquivo | Responsabilidade |
| --- | --- |
| [js/enemies/EnemyAI.js](../js/enemies/EnemyAI.js) | Máquina de estados dos robôs: patrulha, combate, investigação e retorno. Usa visão frontal, memória do alvo e navegação compartilhada. |
| [js/enemies/EnemyPathfinding.js](../js/enemies/EnemyPathfinding.js) | Navegação dos robôs: índice espacial das colisões e A* com orçamento limitado. O cache é compartilhado por cena. |
| [js/enemies/EnemySpawnManager.js](../js/enemies/EnemySpawnManager.js) | Geração de inimigos por zonas de proximidade. Planeja posições livres, garante os tipos obrigatórios e controla limite e remoção por distância. |
| [js/enemies/EnemyTest.js](../js/enemies/EnemyTest.js) | Construção e atualização dos robôs comuns e de serra. Integra IA, vida, som, hitboxes, profundidade e lasers. |
| [js/enemies/EnemyAnimations.js](../js/enemies/EnemyAnimations.js) | Animações e aparência dos robôs. Distingue normal, alerta, ataque da serra e morte por direção. |
| [js/enemies/EnemyHealth.js](../js/enemies/EnemyHealth.js) | Dano e destruição de inimigos. Encaminha solicitações remotas ao host e coordena alerta, efeitos e animação de morte. |
| [js/enemies/EnemyLaser.js](../js/enemies/EnemyLaser.js) | Disparos dos robôs e dano ao jogador. Trata recarga, impactos contra cenário, invulnerabilidade temporária e tela de morte. |
| [js/enemies/BossFinal.js](../js/enemies/BossFinal.js) | Ponto público de importação do boss. Reexporta a integração para que as cenas não dependam da organização interna dos módulos. |
| [js/enemies/bossFinal/BossFinal.js](../js/enemies/bossFinal/BossFinal.js) | Integra o núcleo do boss ao efeito de rachaduras permanentes no chão e reexporta sua API de combate. |
| [js/enemies/bossFinal/BossConfig.js](../js/enemies/bossFinal/BossConfig.js) | Constantes e geometria do boss: posição base, vida, tempos, ataques, poses das mãos e áreas de colisão e vulnerabilidade. Distâncias usam pixels; tempos usam milissegundos. |
| [js/enemies/bossFinal/BossAnimacoes.js](../js/enemies/bossFinal/BossAnimacoes.js) | Sincronização de animações e combate do boss. Eventos de frame controlam mira, impacto, cura e efeitos; a conclusão devolve a IA ao repouso. |
| [js/enemies/bossFinal/BossHitboxes.js](../js/enemies/bossFinal/BossHitboxes.js) | Áreas físicas e geométricas do boss. A base e as mãos bloqueiam movimento; zonas verdes recebem dano e zonas ofensivas dependem dos frames. |
| [js/enemies/bossFinal/BossCombate.js](../js/enemies/bossFinal/BossCombate.js) | Resolução de dano entre jogador e boss. Controla invulnerabilidade, janelas de soco e katana, cura por frame e derrota. |
| [js/enemies/bossFinal/BossIA.js](../js/enemies/bossFinal/BossIA.js) | Escolha de ataques do boss por observação de distância, pressão e movimento do jogador. Usa previsão de mira e memória de esquiva. |
| [js/enemies/bossFinal/BossFinalCore.js](../js/enemies/bossFinal/BossFinalCore.js) | Núcleo do boss. Monta sprite, IA, vida, estamina, câmera de arena e HUD e coordena atualização e liberação dos sistemas. |
| [js/enemies/bossFinal/BossChaoQuebrado.js](../js/enemies/bossFinal/BossChaoQuebrado.js) | Rachaduras permanentes dentro da cena da arena. Escuta impactos do boss e avança a sequência visual do chão sem modificar as regras de combate. |
| [js/enemies/bossFinal/BossRaioZonas.js](../js/enemies/bossFinal/BossRaioZonas.js) | Ataque elétrico por zonas da arena. Mantém separados os retângulos de dano, a imagem principal, a base, as máscaras e as janelas de frames ofensivos. |

### Efeitos de combate

| Arquivo | Responsabilidade |
| --- | --- |
| [js/combat/CombatEffects.js](../js/combat/CombatEffects.js) | Efeitos de impacto do combate: partículas, flash, recuo, deformação, pausa breve e tremor. Os efeitos coordenados são aplicados no modo solo. |

### Iluminação e clima

| Arquivo | Responsabilidade |
| --- | --- |
| [js/effects/TerrorLighting.js](../js/effects/TerrorLighting.js) | Escuridão da fábrica e cone de lanterna. Desenha uma máscara em canvas e a acompanha com o jogador e o zoom. |
| [js/effects/WeatherShader.js](../js/effects/WeatherShader.js) | Adaptação do shader de chuva e neve para o jogo. Os parâmetros GLSL controlam densidade, profundidade aparente e velocidade; os créditos originais estão preservados. |

### Áudio

| Arquivo | Responsabilidade |
| --- | --- |
| [js/sounds/personagem.js](../js/sounds/personagem.js) | Carregamento dos sons do jogador e loop de passos. Inicia e interrompe o áudio conforme movimento e estado de morte. |
| [js/sounds/katana.js](../js/sounds/katana.js) | Sons de golpe com e sem acerto. As funções de reprodução respeitam o bloqueio de morte da cena. |
| [js/sounds/SOUNDS_PERSONAGENS.js/sounds_Aria.js](../js/sounds/SOUNDS_PERSONAGENS.js/sounds_Aria.js) | Áudio do arco da Aria. A tensão começa após o atraso configurado e é interrompida ao soltar; a flecha usa um som próprio. |
| [js/sounds/SOUNDS_PERSONAGENS.js/sounds_Kai.js](../js/sounds/SOUNDS_PERSONAGENS.js/sounds_Kai.js) | Arquivo reservado para sons de Kai. Ainda não contém funções nem configuração de áudio implementadas. |
| [js/sounds/SOUNDS_PERSONAGENS.js/sounds_Magnus.js](../js/sounds/SOUNDS_PERSONAGENS.js/sounds_Magnus.js) | Arquivo reservado para sons de Magnus. Ainda não contém funções nem configuração de áudio implementadas. |
| [js/sounds/SOUNDS_PERSONAGENS.js/sounds_Nyx,.js](../js/sounds/SOUNDS_PERSONAGENS.js/sounds_Nyx,.js) | Arquivo reservado para sons de Nyx. Ainda não contém funções nem configuração de áudio implementadas. |
| [js/sounds/SOUNDS_PERSONAGENS.js/sounds_Pet.js](../js/sounds/SOUNDS_PERSONAGENS.js/sounds_Pet.js) | Arquivo reservado para sons de companheiro robótico. Ainda não contém funções nem configuração de áudio implementadas. |
| [js/sounds/bossRaio.js](../js/sounds/bossRaio.js) | Som elétrico do boss sincronizado com o raio visível. O volume acompanha o progresso do efeito e a limpeza atende interrupção, derrota e saída da cena. |
| [js/sounds/inimigos.js](../js/sounds/inimigos.js) | Áudio dos robôs e dos impactos do boss. Centraliza carregamento, passos com volume por distância e limpeza dos sons temporários. |

### Salas multiplayer

| Arquivo | Responsabilidade |
| --- | --- |
| [js/multiplayer/multiplayerManager.js](../js/multiplayer/multiplayerManager.js) | Protocolo de salas sobre MQTT. O host publica o estado compartilhado; clientes enviam ações, presença e atualizações de movimento. |

### Minimapa

| Arquivo | Responsabilidade |
| --- | --- |
| [js/ui/MiniMapData.js](../js/ui/MiniMapData.js) | Geometria e exploração do minimapa, sem dependência do renderizador. Preserva coordenadas negativas, testa oclusão e compacta as células descobertas. |
| [js/ui/MiniMapManager.js](../js/ui/MiniMapManager.js) | Interface e persistência do minimapa. Reutiliza o atlas estático, revela o mapa por proximidade e salva a exploração por perfil. |
| [js/ui/MiniMap.test.mjs](../js/ui/MiniMap.test.mjs) | Testes de geometria dos mapas reais, exploração com oclusão, persistência compactada, limites de memória e posicionamento do minimapa durante zoom e orientação. |

### Conexão e página

| Arquivo | Responsabilidade |
| --- | --- |
| [js/mqttClient.js](../js/mqttClient.js) | Transporte MQTT, assinaturas, publicação e eventos de conexão. |
| [index.html](../index.html) | Dependências e ponto de entrada do jogo. |
| [style.css](../style.css) | Página sem rolagem, canvas e campo de sala no mobile. |

## Dados e bibliotecas

Os JSONs em `assets/map/` contêm os dados exportados pelo Tiled. JSON não aceita comentários; a leitura e a interpretação desses dados estão explicadas nos módulos de mapa e interação. Imagens e áudios são recursos binários, e `js/libs/` contém bibliotecas externas.

A licença e os créditos da adaptação do shader de clima continuam no arquivo correspondente.

## Verificações

Os arquivos `*.test.mjs` usam o executor de testes do Node. Na raiz do projeto:

```sh
node --test
```

Esses testes verificam regras de inventário, interações com o mapa, hitboxes, profundidade e minimapa. Renderização e áudio no dispositivo também dependem do navegador.
