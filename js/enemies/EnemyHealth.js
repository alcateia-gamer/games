import { notificarGrupo } from "./EnemyAI.js";
import { tocarSomMorteRobo } from "../sounds/inimigos.js";
import { playHitEffects } from "../combat/CombatEffects.js";

function causarDanoInimigo(
  scene,
  alvoOuQuantidade,
  quantidadeOpcional,
  options = {},
) {
  const alvo =
    typeof alvoOuQuantidade === "object" && alvoOuQuantidade
      ? alvoOuQuantidade
      : scene.inimigoTeste;

  const quantidade =
    typeof alvoOuQuantidade === "number"
      ? alvoOuQuantidade
      : (quantidadeOpcional ?? 25);

  if (!alvo || !alvo.active || alvo.morto) {
    return;
  }

  if (scene.multiplayer && !scene.isMultiplayerHost && alvo.remoteOnly) {
    scene.multiplayerManager?.requestEnemyDamage(alvo.networkId, quantidade);
    return;
  }

  alvo.vida -= quantidade;
  alvo.vida = Phaser.Math.Clamp(alvo.vida, 0, alvo.vidaMaxima);
  alvo.foiFerido = true;
  alvo.alerta = true;
  alvo.estado = "alerta";

  if (scene.time) {
    alvo.setTint(0xff5555);
    alvo.setTintMode(Phaser.TintModes.FILL);
    scene.time.delayedCall(100, () => {
      if (alvo && alvo.active) {
        alvo.clearTint();
      }
    });
  }

  notificarGrupo(scene, alvo);
  playHitEffects(scene, scene.player, alvo, quantidade, options);

  if (alvo.vida <= 0) {
    destruirInimigoTeste(scene, alvo);
  }
}

// =====================================================
// DESTRÓI INIMIGO
// =====================================================

function destruirInimigoTeste(scene, inimigo = scene.inimigoTeste) {
  if (!inimigo || !scene || inimigo.morto) {
    return;
  }

  if (inimigo.tipoRobo === "serra") {
    inimigo.morto = true;
    inimigo.estado = "morto";
    inimigo.setVelocity(0, 0);
    inimigo.hitboxDano = null;
    if (inimigo.body) {
      inimigo.body.enable = false;
    }
    if (Array.isArray(scene.inimigos)) {
      scene.inimigos = scene.inimigos.filter((robo) => robo !== inimigo);
    }
    if (scene.inimigoTeste === inimigo) {
      scene.inimigoTeste = scene.inimigos?.[0] ?? null;
    }
    if (inimigo.anims) {
      inimigo.anims.stop();
    }
    scene.tweens.add({
      targets: [
        inimigo,
        inimigo.fundoVida,
        inimigo.barraVida,
        inimigo.bordaVida,
      ].filter(Boolean),
      alpha: 0,
      duration: 180,
      onComplete: () => finalizarDestruicaoInimigo(scene, inimigo),
    });
    return;
  }

  const larguraVisualAntesDaMorte = inimigo.displayWidth;
  const alturaVisualAntesDaMorte = inimigo.displayHeight;

  inimigo.morto = true;
  inimigo.direcaoMorte = inimigo.direcaoAtual;
  inimigo.estado = "morto";
  inimigo.alerta = false;
  inimigo.foiFerido = false;
  inimigo.rotaAtual = [];
  inimigo.indiceRota = 0;
  inimigo.ultimoTiro = Number.POSITIVE_INFINITY;
  inimigo.setVelocity(0, 0);

  if (inimigo.body) {
    inimigo.body.enable = false;
  }

  if (inimigo.debugHitboxDano) {
    inimigo.debugHitboxDano.destroy();
    inimigo.debugHitboxDano = null;
  }

  inimigo.hitboxDano = null;

  if (inimigo.fundoVida) {
    inimigo.fundoVida.destroy();
    inimigo.fundoVida = null;
  }

  if (inimigo.barraVida) {
    inimigo.barraVida.destroy();
    inimigo.barraVida = null;
  }

  if (inimigo.bordaVida) {
    inimigo.bordaVida.destroy();
    inimigo.bordaVida = null;
  }

  if (inimigo.somPassoRobo) {
    inimigo.somPassoRobo.stop();
    inimigo.somPassoRobo.destroy();
    inimigo.somPassoRobo = null;
  }

  if (Array.isArray(scene.inimigos)) {
    scene.inimigos = scene.inimigos.filter((robo) => robo !== inimigo);
  }

  if (scene.inimigoTeste === inimigo) {
    scene.inimigoTeste = scene.inimigos?.[0] ?? null;
  }

  const direcao = ["down", "left", "right", "up"].includes(inimigo.direcaoMorte)
    ? inimigo.direcaoMorte
    : "down";
  const escalaVisualMorte = {
    down: { x: 311 / 292, y: 421 / 367 },
    left: { x: 238 / 239, y: 421 / 387 },
    right: { x: 292 / 242, y: 421 / 393 },
    up: { x: 311 / 283, y: 409 / 364 },
  }[direcao];
  const baseVisualVivo = {
    down: 420,
    left: 420,
    right: 420,
    up: 408,
  }[direcao];
  const baseVisualMorte = {
    down: 397,
    left: 396,
    right: 406,
    up: 382,
  }[direcao];
  const origemYAntesDaMorte = inimigo.originY;
  const escalaVivaY = alturaVisualAntesDaMorte / 421;
  const escalaMorteY = escalaVivaY * escalaVisualMorte.y;
  const deslocamentoBaseMorte =
    ((baseVisualVivo - origemYAntesDaMorte * 421) * escalaVivaY -
      (baseVisualMorte - origemYAntesDaMorte * 421) * escalaMorteY) /
    (421 * escalaMorteY);

  inimigo.anims.stop();
  inimigo.clearTint();
  inimigo.setTexture("robo-morte", 0);
  inimigo.setScale(
    (larguraVisualAntesDaMorte / 311) * escalaVisualMorte.x,
    (alturaVisualAntesDaMorte / 421) * escalaVisualMorte.y,
  );
  inimigo.setOrigin(
    inimigo.originX,
    origemYAntesDaMorte - deslocamentoBaseMorte,
  );
  inimigo.setAlpha(1);
  if (inimigo.efeitoCores) {
    inimigo.efeitoCores.reset().saturate(1.3).contrast(0.38).brightness(1.9);
  }
  inimigo.anims.play(`robo-morte-${direcao}`);
  tocarSomMorteRobo(scene, inimigo);
  scene.time.delayedCall(70, () => {
    if (inimigo.active && inimigo.morto && inimigo.efeitoCores) {
      inimigo.efeitoCores.reset().saturate(1.8).contrast(0.55).brightness(2.5);
    }
  });
  scene.time.delayedCall(160, () => {
    if (inimigo.active && inimigo.morto && inimigo.efeitoCores) {
      inimigo.efeitoCores.reset().saturate(0.5).contrast(0.1).brightness(1.2);
    }
  });
  inimigo.once("animationcomplete", () =>
    finalizarDestruicaoInimigo(scene, inimigo),
  );
}

function finalizarDestruicaoInimigo(scene, inimigo) {
  if (!inimigo || !scene || !inimigo.active) {
    return;
  }

  if (inimigo.debugHitboxDano) {
    inimigo.debugHitboxDano.destroy();
    inimigo.debugHitboxDano = null;
  }

  if (inimigo.fundoVida) {
    inimigo.fundoVida.destroy();
    inimigo.fundoVida = null;
  }

  if (inimigo.barraVida) {
    inimigo.barraVida.destroy();
    inimigo.barraVida = null;
  }

  if (inimigo.bordaVida) {
    inimigo.bordaVida.destroy();
    inimigo.bordaVida = null;
  }

  if (inimigo.somPassoRobo) {
    inimigo.somPassoRobo.stop();
    inimigo.somPassoRobo.destroy();
    inimigo.somPassoRobo = null;
  }

  inimigo.active = false;
  inimigo.setVisible(false);
  inimigo.setActive(false);

  if (Array.isArray(scene.inimigos)) {
    scene.inimigos = scene.inimigos.filter((robo) => robo !== inimigo);
  }

  if (scene.inimigoTeste === inimigo) {
    scene.inimigoTeste = scene.inimigos?.[0] ?? null;
  }

  if (Array.isArray(scene.inimigos) && scene.inimigos.length === 0) {
    scene.grupoRobosAtivado = true;
    scene.registry?.set("robosEliminados", true);
  }

  if (inimigo.body) {
    inimigo.body.enable = false;
  }

  inimigo.destroy();
}

// =====================================================
// EXPORTA
// =====================================================

export { causarDanoInimigo, destruirInimigoTeste, finalizarDestruicaoInimigo };
