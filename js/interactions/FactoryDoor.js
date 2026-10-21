/**
 * @file Porta da fábrica aberta por interação. Substitui os tiles por um visual animado e
 * remove a colisão ao concluir a abertura.
 */

import { distanceToInteractionArea, findFactoryInteraction } from "./FactoryGenerator.js";

const FACTORY_DOOR_STATE_KEY = "factoryDoorOpen";
const INTERACTION_RANGE = 64;
const OPEN_DURATION = 850;

/**
 * Localiza porta01, prepara o recorte visual e a colisão, e restaura o estado persistido de
 * porta aberta.
 */
function criarInteracaoPortaFabrica(scene) {
  const result = findFactoryInteraction(scene.map, "porta01");
  if (result.status !== "ok") return;
  const area = result.object;
  const layer = scene.map.getLayer("Portas")?.tilemapLayer;
  if (!area || !layer) return;

  const tiles = layer.getTilesWithinWorldXY(
    area.x, area.y, area.width, area.height,
  );
  const firstTile = layer.getTileAtWorldXY(area.x, area.y);
  if (!firstTile?.tileset) return;

  // Os seis tiles da persiana ocupam um retângulo contínuo no atlas original.
  const texture = firstTile.tileset.image;
  const source = firstTile.tileset.getTileTextureCoordinates(firstTile.index);
  const frameName = "factory-door-porta01";
  if (!texture.has(frameName)) {
    texture.add(frameName, 0, source.x, source.y, area.width, area.height);
  }

  const originalAlphas = tiles.map((tile) => tile.alpha);
  tiles.forEach((tile) => { tile.alpha = 0; });
  const visual = scene.add.image(area.x, area.y, texture.key, frameName)
    .setOrigin(0, 0).setDepth(layer.depth);
  // A moldura superior permanece no lugar enquanto a folha sobe por trás dela.
  const header = scene.add.image(area.x, area.y, texture.key, frameName)
    .setOrigin(0, 0).setCrop(0, 0, area.width, 8).setDepth(layer.depth);
  const prompt = scene.add.text(
    area.x + area.width / 2, area.y - 12, "E - ABRIR PORTA", {
      fontSize: "14px",
      backgroundColor: "#000000",
      padding: { x: 6, y: 4 },
    },
  ).setOrigin(0.5, 1).setDepth(200).setVisible(false);

  const alreadyOpen = scene.game.registry.get(FACTORY_DOOR_STATE_KEY) === true;
  const colisao = alreadyOpen ? null : scene.collisionGroup.create(
    area.x + area.width / 2, area.y + area.height / 2,
  ).setDisplaySize(area.width, area.height).setVisible(false).refreshBody();
  const porta = {
    estado: alreadyOpen ? "aberta" : "fechada",
    visual,
    colisao,
    progresso: alreadyOpen ? 1 : 0,
  };
  scene.portaFabrica = porta;
  let tween;

  /**
   * Move e recorta a folha conforme o progresso da abertura, mantendo a moldura no lugar.
   */
  const atualizarVisual = () => {
    const offset = Math.round(area.height * porta.progresso);
    visual.setY(area.y - offset);
    visual.setCrop(0, offset, area.width, area.height - offset);
    visual.setVisible(offset < area.height);
  };
  /**
   * Verifica alcance, estado da porta e bloqueios de morte ou menu antes de permitir a
   * interação.
   */
  const podeInteragir = () =>
    porta.estado === "fechada" && scene.player?.active &&
    !scene.morteEmAndamento && !scene.generatorMenuOpen &&
    distanceToInteractionArea(scene.player.x, scene.player.y, area) <=
      INTERACTION_RANGE;

  /**
   * Inicia a animação; ao concluir, remove a colisão e registra que a porta está aberta.
   */
  const abrir = () => {
    if (!podeInteragir()) return false;
    porta.estado = "abrindo";
    scene.interacaoMundoProxima = null;
    prompt.setVisible(false);
    tween = scene.tweens.add({
      targets: porta,
      progresso: 1,
      duration: OPEN_DURATION,
      ease: "Sine.easeInOut",
      onUpdate: atualizarVisual,
      onComplete: () => {
        porta.estado = "aberta";
        // Remover o corpo do grupo também atualiza o índice de navegação dos robôs.
        colisao.destroy();
        porta.colisao = null;
        scene.game.registry.set(FACTORY_DOOR_STATE_KEY, true);
      },
    });
    return true;
  };

  /**
   * Ajusta a profundidade e o aviso de proximidade e publica a interação para o botão
   * compartilhado.
   */
  const atualizar = () => {
    // O personagem fica por cima enquanto a porta está fechada ou abrindo.
    // Após a abertura, a moldura fica acima dele durante a passagem.
    const playerDepth = scene.player?.depth ??
      scene.profundidadePersonagemParte2 ?? layer.depth;
    const doorDepth = porta.estado === "aberta"
      ? Math.max(layer.depth, playerDepth + 0.01)
      : Math.min(layer.depth, playerDepth - 0.01);
    visual.setDepth(doorDepth);
    header.setDepth(doorDepth);
    const nearby = podeInteragir();
    prompt.setVisible(nearby);
    scene.interacaoMundoProxima = nearby ? {
      distance: distanceToInteractionArea(scene.player.x, scene.player.y, area),
      interact: abrir,
    } : null;
  };

  scene.atualizarInteracaoPortaFabrica = atualizar;
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    tween?.stop();
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizar);
    porta.colisao?.destroy();
    visual.destroy();
    header.destroy();
    prompt.destroy();
    tiles.forEach((tile, index) => { tile.alpha = originalAlphas[index]; });
    scene.portaFabrica = null;
    scene.interacaoMundoProxima = null;
    scene.atualizarInteracaoPortaFabrica = null;
  });
  atualizarVisual();
  atualizar();
}

export { FACTORY_DOOR_STATE_KEY, criarInteracaoPortaFabrica };
