import { atacar } from "../player/Player.js";

function criarControles(scene) {
  // =====================================================
  // JOYSTICK
  // =====================================================

  scene.joystick = scene.plugins.get("rexvirtualjoystickplugin").add(scene, {
    x: 100,
    y: 350,

    radius: 50,

    base: scene.add.circle(0, 0, 50, 0xcccccc, 0.7),

    thumb: scene.add.circle(0, 0, 25, 0x666666, 0.9),
  });

  scene.joystick.base.setScrollFactor(0).setDepth(100);

  scene.joystick.thumb.setScrollFactor(0).setDepth(101);

  // =====================================================
  // MOVIMENTO
  // =====================================================

  scene.joystick.on("update", () => {
    if (scene.atacando) {
      scene.player.setVelocity(0, 0);

      return;
    }

    const angle = Phaser.Math.DegToRad(scene.joystick.angle);

    const force = scene.joystick.force;

    if (force > scene.threshold) {
      scene.direction = new Phaser.Math.Vector2(
        Math.cos(angle),
        Math.sin(angle),
      ).normalize();

      const velocidadeX = scene.direction.x * scene.speed;

      const velocidadeY = scene.direction.y * scene.speed;

      scene.player.setVelocity(velocidadeX, velocidadeY);

      // =================================================
      // HORIZONTAL
      // =================================================

      if (Math.abs(scene.direction.x) > Math.abs(scene.direction.y)) {
        if (scene.direction.x > 0) {
          scene.direcaoAtual = "right";

          scene.player.anims.play("walk-right", true);
        } else {
          scene.direcaoAtual = "left";

          scene.player.anims.play("walk-left", true);
        }
      }

      // =================================================
      // VERTICAL
      // =================================================
      else {
        if (scene.direction.y > 0) {
          scene.direcaoAtual = "down";

          scene.player.anims.play("walk-down", true);
        } else {
          scene.direcaoAtual = "up";

          scene.player.anims.play("walk-up", true);
        }
      }
    } else {
      scene.player.setVelocity(0, 0);

      scene.player.anims.stop();
    }
  });

  // =====================================================
  // BOTÃO DE ATAQUE
  // =====================================================

  scene.botaoAtaque = scene.add.circle(720, 350, 46, 0xffffff, 0.9);

  scene.botaoAtaque.setStrokeStyle(4, 0x333333, 1);

  scene.botaoAtaque.setScrollFactor(0).setDepth(100).setInteractive();

  // =====================================================
  // ESPADA DO BOTÃO
  // =====================================================

  scene.iconeAtaque = scene.add.graphics();

  scene.iconeAtaque.setPosition(720, 350).setScrollFactor(0).setDepth(101);

  // =====================================================
  // LÂMINA
  // =====================================================

  scene.iconeAtaque.fillStyle(0xdddddd, 1);

  scene.iconeAtaque.lineStyle(2, 0x333333, 1);

  scene.iconeAtaque.beginPath();

  scene.iconeAtaque.moveTo(0, -31);

  scene.iconeAtaque.lineTo(5, -21);

  scene.iconeAtaque.lineTo(5, 9);

  scene.iconeAtaque.lineTo(-5, 9);

  scene.iconeAtaque.lineTo(-5, -21);

  scene.iconeAtaque.closePath();

  scene.iconeAtaque.fillPath();
  scene.iconeAtaque.strokePath();

  // =====================================================
  // DETALHE DA LÂMINA
  // =====================================================

  scene.iconeAtaque.lineStyle(1, 0xffffff, 0.8);

  scene.iconeAtaque.beginPath();

  scene.iconeAtaque.moveTo(0, -26);

  scene.iconeAtaque.lineTo(0, 5);

  scene.iconeAtaque.strokePath();

  // =====================================================
  // GUARDA
  // =====================================================

  scene.iconeAtaque.fillStyle(0x555555, 1);

  scene.iconeAtaque.fillRoundedRect(-13, 8, 26, 5, 2);

  // =====================================================
  // CABO
  // =====================================================

  scene.iconeAtaque.fillStyle(0x333333, 1);

  scene.iconeAtaque.fillRoundedRect(-4, 12, 8, 18, 2);

  // =====================================================
  // FINAL DO CABO
  // =====================================================

  scene.iconeAtaque.fillStyle(0x555555, 1);

  scene.iconeAtaque.fillCircle(0, 31, 5);

  // Inclinação da espada
  scene.iconeAtaque.setAngle(18);

  // =====================================================
  // ÁREA CLICÁVEL DA ESPADA
  // =====================================================

  scene.iconeAtaque.setInteractive(
    new Phaser.Geom.Rectangle(-25, -40, 50, 80),
    Phaser.Geom.Rectangle.Contains,
  );

  // =====================================================
  // CLIQUE
  // =====================================================

  const apertarBotao = () => {
    scene.botaoAtaque.setScale(0.92);

    scene.iconeAtaque.setScale(0.92);

    atacar(scene);
  };

  const soltarBotao = () => {
    scene.botaoAtaque.setScale(1);

    scene.iconeAtaque.setScale(1);
  };

  // Círculo

  scene.botaoAtaque.on("pointerdown", apertarBotao);

  scene.botaoAtaque.on("pointerup", soltarBotao);

  scene.botaoAtaque.on("pointerout", soltarBotao);

  // Espada

  scene.iconeAtaque.on("pointerdown", apertarBotao);

  scene.iconeAtaque.on("pointerup", soltarBotao);

  scene.iconeAtaque.on("pointerout", soltarBotao);
}

export default criarControles;
