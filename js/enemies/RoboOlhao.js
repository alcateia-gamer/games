import { criarRoboBola } from "./RoboBola.js";
import { tocarSomTiroLaser } from "../sounds/inimigos.js";

// A sequência atravessa as linhas da folha de quatro colunas. O quadro 4 é
// exclusivamente o disparo frontal; os demais formam quatro loops de voo.
export const QUADROS_OLHAO = Object.freeze({
  down: [0, 1, 2, 3], up: [5, 6, 7, 8],
  left: [9, 10, 11, 12], right: [13, 14, 15, 16],
});
// A folha de morte tem uma linha por direção: frente, costas, direita, esquerda.
export const MORTE_OLHAO = Object.freeze({ down: 0, up: 4, right: 8, left: 12 });
const OLHOS = [
  [139, 112], [139, 115], [139, 111], [139, 106], [139, 111],
  [140, 110], [140, 110], [140, 110], [140, 110],
  // Centro da lente laranja medido em cada quadro dos dois perfis.
  [42.5, 114], [42.5, 122], [42.5, 118], [42, 113],
  [235.5, 115.5], [236, 124], [236, 119], [236, 114],
];

export function registrarAnimacoesRoboOlhao(scene) {
  for (const [direcao, quadros] of Object.entries(QUADROS_OLHAO)) {
    const key = `robo-olhao-${direcao}`;
    if (!scene.anims.exists(key)) scene.anims.create({
      key, frames: quadros.map(frame => ({ key: "robo-olhao", frame })),
      frameRate: 8, repeat: -1,
    });
  }
  for (const [direcao, inicio] of Object.entries(MORTE_OLHAO)) {
    const key = `robo-olhao-morte-${direcao}`;
    if (!scene.anims.exists(key)) scene.anims.create({
      key, frames: [0, 1, 2, 3].map(i => ({ key: "robo-olhao-morte", frame: inicio + i })),
      frameRate: 14, repeat: 0,
    });
  }
}

export function obterPoseMorteRoboOlhao(robo) {
  // O quadro visível prevalece caso a direção lógica tenha acabado de mudar.
  const quadro = Number(robo.frame?.name);
  const direcao = quadro === 4 ? "down" : Object.keys(QUADROS_OLHAO)
    .find(d => QUADROS_OLHAO[d].includes(quadro)) ||
    (Object.hasOwn(MORTE_OLHAO, robo.direcaoAtual) ? robo.direcaoAtual : "down");
  return { direcao, frame: MORTE_OLHAO[direcao] };
}

export function atualizarFrameRoboOlhao(robo, atirando = false) {
  robo.setFlipX(false);
  if (atirando && robo.direcaoAtual === "down") {
    robo.anims.stop();
    robo.setFrame(4);
  } else {
    robo.anims.play(`robo-olhao-${robo.direcaoAtual}`, true);
  }
}

export function obterOlhoRoboOlhao(robo) {
  const quadro = Number(robo.frame?.name);
  const [x, y] = OLHOS[quadro] ?? OLHOS[QUADROS_OLHAO[robo.direcaoAtual]?.[0] ?? 0];
  // Usa a mesma transformação que desenha o sprite, inclusive origem de voo,
  // deformações de impacto e eventual rotação, sem deslocar a saída do olho.
  const localX = x - (robo.displayOriginX ?? robo.originX * 280);
  const localY = y - (robo.displayOriginY ?? robo.originY * 280);
  let ponto;
  if (robo.getWorldTransformMatrix) {
    ponto = robo.getWorldTransformMatrix().transformPoint(localX, localY);
  } else {
    const sx = localX * robo.scaleX, sy = localY * robo.scaleY;
    const c = Math.cos(robo.rotation || 0), s = Math.sin(robo.rotation || 0);
    ponto = { x: robo.x + sx * c - sy * s, y: robo.y + sx * s + sy * c };
  }
  return {
    x: ponto.x,
    y: ponto.y,
    depth: robo.depth + (robo.direcaoAtual === "up" ? -0.001 : 0.001),
  };
}

export const FEIXE_OLHAO = Object.freeze({ comprimento: 112, largura: 14, larguraLateral: 6, velocidade: 400 });

export function prepararTexturaLaserOlhao(scene, lateral = false) {
  const { comprimento, largura, larguraLateral } = FEIXE_OLHAO;
  // Prepara ambas também nos clientes cooperativos, antes de receber disparos.
  for (const [chave, espessura, halo] of [
    ["feixe-laranja-olhao", largura, 24],
    ["feixe-laranja-olhao-lateral", larguraLateral, 10],
  ]) {
    if (scene.textures.exists(chave)) continue;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const faixa = (cor, alpha, altura) => g.fillStyle(cor, alpha)
      .fillRoundedRect(0, (halo - altura) / 2, comprimento, altura,
        Math.min(2, altura * 0.2));
    // Arredonda só os cantos, preservando as dimensões e o centro da saída.
    faixa(0xff7300, 0.18, halo);
    faixa(0xff8700, 0.55, espessura + (halo - espessura) * 0.4);
    faixa(0xffa323, 1, espessura);
    faixa(0xffdd80, 1, espessura * 0.4);
    g.generateTexture(chave, comprimento, halo);
    g.destroy();
  }
  return lateral ? "feixe-laranja-olhao-lateral" : "feixe-laranja-olhao";
}

export function criarLaserRoboOlhao(scene, robo, alvo) {
  const olho = obterOlhoRoboOlhao(robo);
  const angulo = Math.atan2(alvo.y - olho.y, alvo.x - olho.x);
  const lateral = robo.direcaoAtual === "left" || robo.direcaoAtual === "right";
  const { comprimento } = FEIXE_OLHAO;
  const largura = lateral ? FEIXE_OLHAO.larguraLateral : FEIXE_OLHAO.largura;
  const chave = prepararTexturaLaserOlhao(scene, lateral);
  const cos = Math.cos(angulo), sin = Math.sin(angulo);
  // A cauda coincide com o olho, já considerando quadro, escala e flutuação.
  const laser = scene.add.image(olho.x + cos * comprimento / 2,
    olho.y + sin * comprimento / 2, chave).setRotation(angulo).setDepth(olho.depth);
  Object.assign(laser, {
    especialLaserInimigo: true, especialAtirador: robo, danoEspecial: 0,
    danoLaser: robo.danoLaser, comprimentoFeixe: comprimento, larguraFeixe: largura,
  });
  scene.physics.add.existing(laser);
  laser.body.setAllowGravity(false);
  scene.lasersInimigo.add(laser);
  laser.body.setSize(Math.abs(cos) * comprimento + Math.abs(sin) * largura,
    Math.abs(sin) * comprimento + Math.abs(cos) * largura);
  laser.body.updateFromGameObject();
  // O disparo nasce durante scene.update, antes do postUpdate da física.
  // setSize muda o offset do corpo: sincroniza o histórico para o Phaser não
  // aplicar essa diferença como um deslocamento visual no primeiro frame.
  laser.body.prev.copy(laser.body.position);
  laser.body.prevFrame.copy(laser.body.position);
  laser.body.autoFrame.copy(laser.body.position);
  scene.physics.velocityFromRotation(angulo, robo.velocidadeLaser, laser.body.velocity);
  // Mantém a orientação do feixe se uma habilidade o refletir.
  const orientar = () => {
    const v = laser.body?.velocity;
    if (v && Math.hypot(v.x, v.y) > 0) laser.setRotation(Math.atan2(v.y, v.x));
  };
  scene.events.on("postupdate", orientar);
  const expiracao = scene.time.delayedCall(1600, () => laser.active && laser.destroy());
  const limpar = () => {
    expiracao?.remove(false);
    scene.events.off("postupdate", orientar);
    scene.events.off("shutdown", limpar);
  };
  laser.once("destroy", limpar);
  scene.events.once("shutdown", limpar);
  tocarSomTiroLaser(scene, robo);
  return laser;
}

const PERFIL = Object.freeze({
  tipo: "olhao", textura: "robo-olhao", tamanho: 280,
  escala: 0.3, hitbox: 112, alturaBarra: 31,
  config: {
    velocidade: 98, velocidadeOrbita: 22, velocidadeRecuo: 89.6,
    distanciaIdeal: 180, distanciaMinima: 125, distanciaMaxima: 225,
    intervaloTiro: 1600, tempoCarga: 320, alcanceTiro: 380,
    velocidadeProjetil: FEIXE_OLHAO.velocidade,
  },
  registrarAnimacoes: registrarAnimacoesRoboOlhao,
  atualizarFrame: atualizarFrameRoboOlhao,
  obterOlho: obterOlhoRoboOlhao,
  criarProjetil: criarLaserRoboOlhao,
});

export function criarRoboOlhao(scene, posicao = null) {
  return criarRoboBola(scene, posicao, PERFIL);
}
