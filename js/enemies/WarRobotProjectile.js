/**
 * Pontas dos canos na folha original (311 × 421 por quadro).
 * Coordenadas medidas nos pixels de cada passo, não no centro da hitbox dos pés.
 * Ordem: arma à esquerda da tela na vista frontal, depois a outra arma.
 */
const BOCAS_POR_QUADRO = [
  [[23, 287], [286, 286]], // down 0
  [[24, 286], [288, 286]], // down 1
  [[25, 286], [288, 286]], // down 2
  [[63, 140], [63, 233]], // left 0: arma distante acima, próxima abaixo
  [[61, 140], [62, 233]], // left 1
  [[65, 140], [66, 233]], // left 2
  [[249, 237], [251, 143]], // right 0: a mesma arma fica abaixo ao virar
  [[246, 237], [250, 143]], // right 1
  [[247, 237], [250, 143]], // right 2
  // De costas os canos ficam ocultos pelos braços/ombros. Projeção das armas
  // à frente das mãos: o tiro também fica atrás do sprite até sair da silhueta.
  [[286, 147], [23, 147]], // up 0 (esquerda/direita do robô trocam de lado na tela)
  [[288, 147], [24, 147]], // up 1
  [[288, 147], [25, 147]], // up 2
];
const QUADRO_BASE = { down: 0, left: 3, right: 6, up: 9 };
const LARGURA_MUNICAO = 20;

export function obterBocaMetralhadora(robo) {
  const lado = robo.ultimoLadoTiro === "right" ? "right" : "left";
  robo.ultimoLadoTiro = lado === "right" ? "left" : "right";
  // frame.name é o quadro realmente desenhado; currentFrame.index é apenas
  // a posição 1..3 dentro da animação e direcaoAtual pode estar um passo à frente.
  const frame = Number(robo.frame?.name);
  const quadro = Number.isInteger(frame) && frame >= 0 && frame < 12
    ? frame : (QUADRO_BASE[robo.direcaoAtual] ?? 0);
  let [x, y] = BOCAS_POR_QUADRO[quadro][lado === "right" ? 1 : 0];
  const largura = robo.width || 311;
  const altura = robo.height || 421;
  x = x / 311 * largura;
  y = y / 421 * altura;
  if (robo.flipX) x = largura - x;
  if (robo.flipY) y = altura - y;
  x -= robo.displayOriginX ?? (robo.originX ?? 0.5) * largura;
  y -= robo.displayOriginY ?? (robo.originY ?? 0.5) * altura;
  let ponto;
  if (robo.getWorldTransformMatrix) {
    ponto = robo.getWorldTransformMatrix().transformPoint(x, y);
  } else {
    const sx = x * (robo.scaleX ?? 0.23), sy = y * (robo.scaleY ?? 0.23);
    const c = Math.cos(robo.rotation || 0), s = Math.sin(robo.rotation || 0);
    ponto = { x: robo.x + sx * c - sy * s, y: robo.y + sx * s + sy * c };
  }
  return {
    x: ponto.x,
    y: ponto.y,
    depth: quadro >= 9 ? (robo.depth ?? 55) - 0.00001 : 55,
  };
}

export function criarMunicaoRobo(scene, x, y, angulo, boca = {}) {
  const chave = "municao-vermelha-metralhadora-robo";
  if (!scene.textures.exists(chave)) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    // Pulso vermelho afilado, com halo carmim e núcleo vermelho claro.
    g.fillStyle(0xf50929, 0.2).fillRect(0, 0, 18, 8);
    g.fillStyle(0xb80722, 0.8).fillTriangle(0, 4, 9, 1, 9, 7);
    g.fillStyle(0xff1635, 1).fillRect(5, 2, 10, 4);
    g.fillStyle(0xff1635, 1).fillTriangle(15, 2, 20, 4, 15, 6);
    g.fillStyle(0xff6977, 1).fillRect(8, 3, 8, 2);
    g.generateTexture(chave, LARGURA_MUNICAO, 8);
    g.destroy();
  }
  // O centro avança meia munição: a traseira coincide com a boca e todo o
  // projétil aparece à frente dela, inclusive após girar. A física fica centrada.
  const centroX = x + Math.cos(angulo) * LARGURA_MUNICAO / 2;
  const centroY = y + Math.sin(angulo) * LARGURA_MUNICAO / 2;
  return scene.add.image(centroX, centroY, chave)
    .setOrigin(0.5).setRotation(angulo).setDepth(boca.depth ?? 55);
}
