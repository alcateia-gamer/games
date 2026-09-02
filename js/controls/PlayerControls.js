import { atacar } from "../player/Player.js";

function criarControles(scene) {
  // =====================================================
  // TECLAS WASD
  // =====================================================

  scene.teclasWASD = scene.input.keyboard.addKeys({
    cima: Phaser.Input.Keyboard.KeyCodes.W,

    baixo: Phaser.Input.Keyboard.KeyCodes.S,

    esquerda: Phaser.Input.Keyboard.KeyCodes.A,

    direita: Phaser.Input.Keyboard.KeyCodes.D,
  });

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

  // =====================================================
  // INCLINAÇÃO
  // =====================================================

  scene.iconeAtaque.setAngle(18);

  // =====================================================
  // ÁREA CLICÁVEL DA ESPADA
  // =====================================================

  scene.iconeAtaque.setInteractive(
    new Phaser.Geom.Rectangle(-25, -40, 50, 80),

    Phaser.Geom.Rectangle.Contains,
  );

  // =====================================================
  // APERTA BOTÃO
  // =====================================================

  const apertarBotao = () => {
    scene.botaoAtaque.setScale(0.92);

    scene.iconeAtaque.setScale(0.92);

    atacar(scene);
  };

  // =====================================================
  // SOLTA BOTÃO
  // =====================================================

  const soltarBotao = () => {
    scene.botaoAtaque.setScale(1);

    scene.iconeAtaque.setScale(1);
  };

  // =====================================================
  // BOTÃO NA TELA
  // =====================================================

  scene.botaoAtaque.on("pointerdown", apertarBotao);

  scene.botaoAtaque.on("pointerup", soltarBotao);

  scene.botaoAtaque.on("pointerout", soltarBotao);

  // =====================================================
  // ESPADA
  // =====================================================

  scene.iconeAtaque.on("pointerdown", apertarBotao);

  scene.iconeAtaque.on("pointerup", soltarBotao);

  scene.iconeAtaque.on("pointerout", soltarBotao);

  // =====================================================
  // BOTÃO ESQUERDO DO MOUSE
  // =====================================================

  scene.input.on("pointerdown", (pointer, objetosClicados) => {
    // =================================================
    // SOMENTE BOTÃO ESQUERDO
    // =================================================

    if (!pointer.leftButtonDown()) {
      return;
    }

    // =================================================
    // NÃO ATACA DE NOVO AO CLICAR NO BOTÃO DA TELA
    // =================================================

    if (objetosClicados && objetosClicados.length > 0) {
      return;
    }

    atacar(scene);
  });
}

// =====================================================
// ATUALIZA CONTROLES
// =====================================================

function atualizarControles(scene) {
  let movimentoX = 0;

  let movimentoY = 0;

  let usandoTeclado = false;

  // =====================================================
  // WASD
  // =====================================================

  if (scene.teclasWASD.esquerda.isDown) {
    movimentoX -= 1;

    usandoTeclado = true;
  }

  if (scene.teclasWASD.direita.isDown) {
    movimentoX += 1;

    usandoTeclado = true;
  }

  if (scene.teclasWASD.cima.isDown) {
    movimentoY -= 1;

    usandoTeclado = true;
  }

  if (scene.teclasWASD.baixo.isDown) {
    movimentoY += 1;

    usandoTeclado = true;
  }

  // =====================================================
  // JOYSTICK
  // =====================================================

  if (!usandoTeclado && scene.joystick.force > scene.threshold) {
    const angle = Phaser.Math.DegToRad(scene.joystick.angle);

    movimentoX = Math.cos(angle);

    movimentoY = Math.sin(angle);
  }

  // =====================================================
  // ESTÁ SE MOVENDO
  // =====================================================

  if (movimentoX !== 0 || movimentoY !== 0) {
    const direcao = new Phaser.Math.Vector2(movimentoX, movimentoY).normalize();

    // ===================================================
    // VELOCIDADE
    // ===================================================

    scene.player.setVelocity(
      direcao.x * scene.speed,

      direcao.y * scene.speed,
    );

    // ===================================================
    // HORIZONTAL
    // ===================================================

    if (Math.abs(direcao.x) > Math.abs(direcao.y)) {
      // =================================================
      // DIREITA
      // =================================================

      if (direcao.x > 0) {
        scene.direcaoAtual = "right";

        if (!scene.atacando) {
          scene.player.anims.play("walk-right", true);
        }
      }

      // =================================================
      // ESQUERDA
      // =================================================
      else {
        scene.direcaoAtual = "left";

        if (!scene.atacando) {
          scene.player.anims.play("walk-left", true);
        }
      }
    }

    // ===================================================
    // VERTICAL
    // ===================================================
    else {
      // =================================================
      // BAIXO
      // =================================================

      if (direcao.y > 0) {
        scene.direcaoAtual = "down";

        if (!scene.atacando) {
          scene.player.anims.play("walk-down", true);
        }
      }

      // =================================================
      // CIMA
      // =================================================
      else {
        scene.direcaoAtual = "up";

        if (!scene.atacando) {
          scene.player.anims.play("walk-up", true);
        }
      }
    }
  }

  // =====================================================
  // PARADO
  // =====================================================
  else {
    scene.player.setVelocity(0, 0);

    // ===================================================
    // NÃO INTERROMPE ATAQUE
    // ===================================================

    if (!scene.atacando) {
      scene.player.anims.stop();
    }
  }
}

export { criarControles, atualizarControles };
