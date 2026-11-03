/** Overlay opt-in: scene.debugEncaixeArmas = true. Não cria gráficos até ser ativado. */
export function atualizarDebugEncaixe(scene, estado) {
  if (!scene.debugEncaixeArmas || !estado.sprite.visible) {
    estado.debugEncaixe?.setVisible(false);
    return;
  }
  if (!estado.debugEncaixe) estado.debugEncaixe = scene.add.graphics().setDepth(300);
  const g = estado.debugEncaixe, p = estado.pose;
  g.clear().setVisible(true);
  g.lineStyle(0.5, 0x48ff8c, 1).strokeCircle(p.mao.x, p.mao.y, 1.5);
  g.lineStyle(0.4, 0xff57d5, 1).lineBetween(p.mao.x - 2.2, p.mao.y, p.mao.x + 2.2, p.mao.y)
    .lineBetween(p.mao.x, p.mao.y - 2.2, p.mao.x, p.mao.y + 2.2);
  g.lineStyle(0.4, 0xffdd69, 1).strokeCircle(p.cano.x, p.cano.y, 1.5);
  g.lineStyle(0.25, 0x6bdfff, 0.8).lineBetween(p.mao.x, p.mao.y,
    p.mao.x + Math.cos(p.angulo) * 65, p.mao.y + Math.sin(p.angulo) * 65);
}
