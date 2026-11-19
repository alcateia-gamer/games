# Tutorial e indicadores de sucatas

O BootPartida cria um token local no registry a cada nova partida. Level1 consome esse token no final de create, depois de o preloader aguardar a introdução e destruir CutsceneLoading. Retornos de menus, reinícios internos e outros mapas não reabrem o guia. Não há localStorage nem mensagens de rede para o tutorial.

O modal DOM usa os frames originais de robô, sucata e comerciante; três cartões, informação exclusiva de equipe e botão ENTENDI. O CSS respeita safe areas e compacta telas baixas. A trava existente de modal impede movimento, ataques e interações; input, teclado e movimento voltam ao estado anterior. A loja ignora a trava enquanto pertence ao tutorial. Shutdown remove DOM e listeners sem pausar a física do host.

Cada drop tem duas imagens adicionais: seta e etiqueta. As duas texturas são rasterizadas uma vez e compartilhadas. Uma senoide por atualização controla a flutuação e o brilho de todos os drops; não há tweens por drop, partículas ou shaders adicionais. Com o limite econômico existente de 48 drops, são no máximo 96 imagens adicionais (144 incluindo os itens), duas texturas e zero tweens contínuos. Etiquetas sobrepostas são ocultadas. A proximidade usa 180 pixels de tela convertidos pelo zoom (com limite mínimo de zoom de 0,5); não muda a coleta de 46 unidades nem a validação autoritativa de 62.

A profundidade deriva do piso calculado pelo projeto, com pequeno deslocamento acima do item, e acompanha a faixa da fábrica. Indicadores fora da câmera ficam invisíveis. A remoção segue a economia confirmada, inclusive no cliente que aguarda o host; shutdown libera imagens e referências. Os preços, cotas, probabilidades, quantidades, NPC e protocolo de rede permanecem os existentes.

## Validação

- `js/systems/Upgrades.test.mjs`: economia, geração, coleta, compras, equipe, ciclo de vida dos indicadores, culling, sobreposição, animação compartilhada, cache e confirmação autoritativa.
- `js/multiplayer/*.test.mjs`: regressões de protocolo e sistemas cooperativos.
- `tests/scrap-tutorial.browser.mjs`: DOM real, modos solo/equipe, controles, independência, nova partida, reinício e limpeza. Layouts: 1920×1080, 1366×768, 1280×720, 960×540, 844×390, 740×360, 667×375 e 390×844.
- `tests/scrap-game.browser.mjs`: fluxo real da introdução ao tutorial, assets, bloqueio, seta animada, etiqueta e coleta no Phaser.
- `tests/upgrade-dialogue.browser.mjs`: roteiro existente adaptado para fechar o guia antes de visitar o NPC.

Os testes browser aceitam PLAYWRIGHT_MODULE, CHROMIUM_PATH (CHROME_PATH no roteiro da loja) e BASE_URL (GAME_URL na loja). É necessário servir a raiz por HTTP. O roteiro da loja também usa ROBOT_TEST_TOOLS para MQTT/Aedes/WS.

Não foram medidos FPS, heap ou consumo em aparelhos físicos. Os limites de objetos e tweens acima são estruturais, não benchmarks. Os layouts móveis foram verificados em navegador desktop com viewport móvel.

Resultado nesta implementação: 214 testes unitários passaram (43 de melhorias/sucatas e 171 de multiplayer). Os três roteiros browser acima passaram, incluindo dois clientes reais via MQTT local, tutoriais independentes, replicação/remoção dos indicadores e compras individuais. A conferência visual do tutorial foi feita em 844×390. Nenhuma medição de FPS ou heap foi realizada.
