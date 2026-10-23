/** Compensa o zoom da câmera sem alterar a posição ou o tamanho na tela. */
export function posicionarBotaoFixo(camera, object, x, y, scaleX = 1, scaleY = scaleX) {
  const zoomX = camera.zoomX || camera.zoom || 1;
  const zoomY = camera.zoomY || camera.zoom || 1;
  const ox = camera.width * camera.originX;
  const oy = camera.height * camera.originY;
  object.setPosition(ox + (x - ox) / zoomX, oy + (y - oy) / zoomY);
  object.setScale(scaleX / zoomX, scaleY / zoomY);
}
