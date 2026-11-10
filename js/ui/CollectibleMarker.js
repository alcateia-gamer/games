/**
 * @file Exclamação compartilhada pelos coletáveis no mundo e no minimapa.
 */

export const COLLECTIBLE_MARKER_COLOR = 0xffd447;

/**
 * Desenha a exclamação com contorno escuro para destacar o amarelo sobre qualquer piso.
 */
export function drawCollectibleMarker(graphics, x, y, size = 16) {
  const scale = size / 16;
  graphics.fillStyle(0x30250a, 1);
  graphics.fillRect(x - 3 * scale, y - 7 * scale, 6 * scale, 10 * scale);
  graphics.fillRect(x - 3 * scale, y + 4 * scale, 6 * scale, 5 * scale);
  graphics.fillStyle(COLLECTIBLE_MARKER_COLOR, 1);
  graphics.fillRect(x - 2 * scale, y - 6 * scale, 4 * scale, 8 * scale);
  graphics.fillRect(x - 2 * scale, y + 5 * scale, 4 * scale, 3 * scale);
}

/**
 * Mantém o aviso acima do item, flutuando suavemente até a imagem ser removida.
 */
export function createCollectibleMarker(scene, image) {
  const marker = scene.add.graphics()
    .setPosition(image.x, image.y - image.displayHeight / 2 - 18)
    .setDepth(100);
  drawCollectibleMarker(marker, 0, 0, 18);
  scene.tweens.add({
    targets: marker,
    y: marker.y - 5,
    duration: 700,
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1,
  });
  image.once("destroy", () => {
    scene.tweens.killTweensOf(marker);
    marker.destroy();
  });
  return marker;
}

/** Aviso de primeira interação, persistente entre visitas ao mapa na mesma partida. */
export function createInteractionMarker(scene, { x, y, name, stateKey }) {
  if (scene.registry?.get(stateKey)) return null;
  const marker = scene.add.graphics().setPosition(x, y).setDepth(100).setName(name);
  drawCollectibleMarker(marker, 0, 0, 24);
  scene.tweens.add({ targets: marker, y: y - 6, duration: 700,
    ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
  let removido = false;
  const limpar = () => {
    if (removido) return;
    removido = true;
    scene.tweens.killTweensOf(marker);
    scene.registry?.events?.off("changedata", aoMudar);
    scene.events.off("shutdown", remover);
  };
  const remover = () => { limpar(); marker.destroy(); };
  const aoMudar = (_parent, key, value) => {
    if (key === stateKey && value === true) remover();
  };
  scene.registry?.events?.on("changedata", aoMudar);
  scene.events.once("shutdown", remover);
  marker.once("destroy", limpar);
  return marker;
}
