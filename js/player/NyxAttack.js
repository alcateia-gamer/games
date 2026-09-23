import { causarDanoInimigo } from "../enemies/EnemyTest.js";
import { gastarEstamina } from "./PlayerStatus.js";

const NYX_ATTACK_ORIGIN_Y = 0.4167;
const NYX_ATTACK_HIT_DELAY = 180;

function obterAlvos(scene) {
  if (Array.isArray(scene.inimigos)) {
    return scene.inimigos.filter((inimigo) => inimigo?.active);
  }

  return scene.inimigoTeste?.active ? [scene.inimigoTeste] : [];
}

function obterHitboxAtaque(scene) {
  const distancia = 28;
  const largura = 42;
  const altura = 42;
  const direcoes = {
    up: { x: scene.player.x - largura / 2, y: scene.player.y - distancia - altura },
    down: { x: scene.player.x - largura / 2, y: scene.player.y + distancia },
    left: { x: scene.player.x - distancia - largura, y: scene.player.y - altura / 2 },
    right: { x: scene.player.x + distancia, y: scene.player.y - altura / 2 },
  };
  const posicao = direcoes[scene.direcaoAtual] ?? direcoes.down;

  return new Phaser.Geom.Rectangle(posicao.x, posicao.y, largura, altura);
}

function aplicarDanoNyx(scene) {
  const hitbox = obterHitboxAtaque(scene);
  const atingidos = new Set();

  for (const inimigo of obterAlvos(scene)) {
    const alvo = inimigo.hitboxDano || inimigo.getBounds();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(hitbox, alvo)) {
      continue;
    }

    causarDanoInimigo(scene, inimigo, 25);
    atingidos.add(inimigo);
  }

  return atingidos;
}

function iniciarAtaqueNyx(scene) {
  if (
    scene.personagemSelecionada !== "personagem4" ||
    scene.atacando ||
    !gastarEstamina(scene, scene.custoAtaque)
  ) {
    return;
  }

  scene.atacando = true;
  scene.player.setVelocity(0, 0);
  scene.player.setOrigin(0.5, NYX_ATTACK_ORIGIN_Y);
  scene.player.anims.play(`attack-${scene.direcaoAtual}`);

  scene.time.delayedCall(NYX_ATTACK_HIT_DELAY, () => {
    if (scene.player?.active && scene.atacando) {
      aplicarDanoNyx(scene);
    }
  });
}

export { iniciarAtaqueNyx, NYX_ATTACK_ORIGIN_Y };