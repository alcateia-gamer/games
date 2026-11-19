// Textura pequena compartilhada entre drops e reinícios de cena.
const ARROW = 'scrap-indicator-arrow';
export function prepareScrapIndicators(textures) {
  if (!textures.exists(ARROW)) {
    const texture = textures.createCanvas(ARROW, 24, 18), c = texture.context;
    c.shadowColor = '#39FF88'; c.shadowBlur = 4;
    c.beginPath(); c.moveTo(5, 4); c.lineTo(19, 4); c.lineTo(12, 13); c.closePath();
    c.fillStyle = '#39FF88'; c.fill();
    c.shadowBlur = 0; c.lineWidth = 2; c.strokeStyle = '#02140c'; c.stroke();
    texture.refresh();
  }

}

export function createScrapIndicator(scene, image) {
  const arrow = scene.add.image(image.x, image.y, ARROW).setName('scrap-drop-arrow');
  arrow.coopLocalVisual = true;
  arrow.setVisible(false);
  return { image, arrow };
}

/** Animação compartilhada; nenhum objeto/tween é criado na atualização. */
export function updateScrapIndicators(scene, indicators) {
  const view = scene.cameras?.main?.worldView;
  const bob = Math.sin((scene.time?.now ?? 0) * Math.PI / 1100) * 2;
  for (const { image, arrow } of indicators.values()) {
    const x = image.x, y = image.y;
    const visible = !view || (x + 28 >= view.x && x - 28 <= view.x + view.width &&
      y + 14 >= view.y && y - 64 <= view.y + view.height);
    arrow.setVisible(visible);
    if (!visible) continue;
    image.setAlpha(.75 + bob / 8);
    // Ordem local mínima: acima do item, abaixo dos atores e dos obstáculos do mapa.
    const depth = image.depth + 1e-10;
    if (arrow.depth !== depth) arrow.setDepth(depth);
    const halfHeight = (image.displayHeight || 28) / 2;
    arrow.setPosition(x, y - halfHeight - 29 + bob);
  }
}
