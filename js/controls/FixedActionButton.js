/** Compensa o zoom da câmera sem alterar a posição ou o tamanho na tela. */
export function posicionarBotaoFixo(camera, object, x, y, scaleX = 1, scaleY = scaleX) {
  const zoomX = camera.zoomX || camera.zoom || 1;
  const zoomY = camera.zoomY || camera.zoom || 1;
  const ox = camera.width * camera.originX;
  const oy = camera.height * camera.originY;
  object.setPosition(ox + (x - ox) / zoomX, oy + (y - oy) / zoomY);
  object.setScale(scaleX / zoomX, scaleY / zoomY);
}

/** O conjunto de ações mantém a distância das bordas direita e inferior da base 800×450. */
export function posicaoAcaoNaTela(camera, x, y) {
  return { x: camera.width - (800 - x), y: camera.height - (450 - y) };
}

export function posicionarBotaoAcao(camera, object, x, y, scaleX = 1, scaleY = scaleX) {
  const ponto = posicaoAcaoNaTela(camera, x, y);
  posicionarBotaoFixo(camera, object, ponto.x, ponto.y, scaleX, scaleY);
}
