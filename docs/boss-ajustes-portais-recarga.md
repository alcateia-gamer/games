# Ajustes do boss — recarga, portais e camuflagem

## Comportamento atualizado

- Os geradores sobreviventes sobem e continuam recebendo dano sem morrer durante
  a recarga. Quando todos terminam de subir, os feixes azuis originais conectam
  seus emissores ao escudo por 1,2 segundo. Os feixes são destruídos ao completar
  a carga, inclusive se o jogador ainda precisar sair de dentro da barreira.
  Não permanecem durante a onda seguinte. Áudio e efeitos são interrompidos na
  suspensão, morte ou encerramento do encontro.
- Foram retiradas as retas de direção dos padrões do prólogo e os círculos de
  área na origem dos tiros. Quando o GIF de aviso está carregado, ele representa
  sozinho a área afetada; o desenho geométrico existe apenas como fallback se
  o recurso estiver ausente. Os avisos de dano e a preparação dos ataques continuam.
- Portal esquerdo: **(-1577, -5806)**. Portal direito: **(-567, -5806)**.
  A escala caiu de 0,65 para **0,42**. A abertura continua sendo o pivô real do
  sprite, inclusive no portal espelhado. A validação usa uma margem de 22 pixels,
  suficiente para o corpo do robô, e verifica paredes e o trajeto de saída.
  Se o ponto estiver ocupado, o spawn aguarda, sem deslocar o portal.
- Robôs nascem exatamente no centro da abertura e saem fisicamente em direção
  ao interior da arena, com o movimento e o fade existentes. Enquanto próximos
  ao portal, usam profundidade 51,1, acima dele (51). Ao se afastar, retornam à
  ordenação normal. A informação também é enviada às réplicas cooperativas.
- O cadáver usa colisão baixa na base da túnica, como a colisão de caminhada dos
  jogadores. A região nativa `(91, 177, 64, 28)` ocupa **35,2 × 15,4 pixels** na
  escala atual, sem bloquear pelo capuz, sombra ou fitas laterais. A ordenação
  visual usa essa mesma base. O espelhamento e a remoção do obstáculo foram mantidos.
- O novo padrão de **anéis de raios causa 20 de dano**, contra 40 da chuva que
  persegue o jogador, antes dos multiplicadores do jogo. Os ataques falsos
  continuam sem dano. A redução não altera o dano do ataque original.
- Entre ataques, aproximadamente a cada **9 segundos** de combate principal,
  o boss pode teleportar para a posição de um dos quatro geradores. Escolhe um
  destino livre, evita jogador/paredes e preserva os ataques de origem central.
  O retorno após os clones também pode visitar essas pontas quando o intervalo
  venceu. Durante a onda, a camuflagem entre cópias tem prioridade.
- Os nove clones agora formam **três grupos móveis**. Cada grupo percorre a
  arena e os seguidores acompanham seu líder. A verdadeira procura o aglomerado
  com mais cópias próximas e se junta a ele; teleportes normais durante a onda
  também preferem um aglomerado válido. Com cópias destruídas, os grupos e o
  destino são recalculados. Animações, pausas e ataques falsos permanecem sincronizados.

## Arquivos desta correção

Em `js/enemies/novoBoss/`:

- `NovoBossPrologo.js`, `NovoBossRaiosEscudo.js`: subida, feixes, tempo e limpeza da recarga.
- `NovoBossPortais.js`, `NovoBossAssets.js`, `NovoBossConfig.js`: pontos, escala e parâmetros.
- `NovoBossAvisos.js`, `NovoBossPadroesPrologo.js`, `ataques/LasersEspiral.js`: retirada das sobreposições geométricas.
- `ataques/ChuvaRaios.js`: dano próprio dos anéis, preservando o dano zero dos falsos.
- `NovoBossClones.js`, `NovoBossTeleporte.js`, `NovoBossEstados.js`: grupos, camuflagem e visitas às pontas.
- `NovoBossCorpoDerrotado.js`: colisão baixa.

Integrações restritas ao encontro:

- `js/enemies/BossPrincipal.js`: profundidade do cadáver pela base física.
- `js/map/ProfundidadeMapa.js`: robôs do portal acima dele quando próximos; demais atores preservados.
- `js/multiplayer/CoopBossReplica.js`, `CoopRuntime.js`: informação da origem do portal na réplica.

Os testes correspondentes foram atualizados e receberam regressões para feixes,
limpeza após a carga, coordenadas, profundidade, aglomeração, dano e teleportes.
Nenhuma imagem, GIF, áudio ou mapa foi alterado. Nenhum arquivo foi excluído,
renomeado ou substituído. As alterações anteriores do workspace foram preservadas.

## Validação

Passaram **496 testes em 39 arquivos pertinentes**, cobrindo boss, ataques,
profundidade, Robô Bola e as integrações cooperativas. O roteiro existente do
prólogo também passou nas 86 verificações dos quatro ciclos e do seu ciclo de vida.

O teste `tests/novo-boss-revisao-combate.browser.mjs` usa Phaser e Chromium reais.
Verificou os quatro ciclos, a subida atacável sem morte, feixes durante a carga
(e ausência após completá-la), saída física do centro dos portais, camadas dos
robôs, visita ao gerador, trajetória dos grupos, sincronização e colisão pelos
dois lados do cadáver. A verdadeira terminou a dispersão junto de três clones.
Não foram encontradas sobras de feixes, linhas de direção ou círculos geométricos
durante as ondas verificadas.
As capturas dos portais, recarga, grupos e cadáver foram inspecionadas.

Artefatos: `/tmp/boss-revisao-combate/`.
As falhas preexistentes da suíte geral em iluminação, colisões antigas e áudio
não fazem parte desta correção.
