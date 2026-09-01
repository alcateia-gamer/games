// =====================================================
// CRIA INIMIGO
// =====================================================

function criarInimigoTeste(scene) {
  // =====================================================
  // ANIMAÇÕES
  // =====================================================

  criarAnimacoesInimigo(scene);

  // =====================================================
  // POSIÇÃO
  // =====================================================

  const x = scene.respawnX + 180;

  const y = scene.respawnY;

  // =====================================================
  // INIMIGO
  // =====================================================

  scene.inimigoTeste = scene.physics.add.sprite(x, y, "robo-teste", 0);

  scene.inimigoTeste.setDepth(50);

  // =====================================================
  // TAMANHO
  // =====================================================

  scene.inimigoTeste.setScale(0.75);

  // =====================================================
  // FÍSICA
  // =====================================================

  scene.inimigoTeste.body.setAllowGravity(false);

  // =====================================================
  // CONFIGURAÇÕES DA IA
  // =====================================================

  scene.inimigoTeste.velocidade = 80;

  scene.inimigoTeste.distanciaDeteccao = 350;

  scene.inimigoTeste.distanciaAtaque = 150;

  scene.inimigoTeste.direcaoAtual = "down";

  // =====================================================
  // CONFIGURAÇÕES DO ATAQUE
  // =====================================================

  scene.inimigoTeste.tempoEntreTiros = 2000;

  scene.inimigoTeste.ultimoTiro = 0;

  scene.inimigoTeste.velocidadeLaser = 250;

  scene.inimigoTeste.danoLaser = 5;

  // =====================================================
  // VIDA
  // =====================================================

  scene.inimigoTeste.vidaMaxima = 100;

  scene.inimigoTeste.vida = 100;

  // =====================================================
  // GRUPO DE LASERS
  // =====================================================

  scene.lasersInimigo = scene.physics.add.group();

  // =====================================================
  // INVULNERABILIDADE DO PLAYER
  // =====================================================

  scene.player.invulneravel = false;

  // =====================================================
  // COLISÃO LASER X PLAYER
  // =====================================================

  scene.physics.add.overlap(
    scene.lasersInimigo,
    scene.player,
    (player, laser) => {
      acertarPlayerComLaser(scene, laser);
    },
  );

  // =====================================================
  // BARRA DE VIDA
  // =====================================================

  scene.inimigoTeste.larguraBarra = 60;

  scene.inimigoTeste.fundoVida = scene.add.rectangle(
    x,
    y - 65,
    60,
    6,
    0x111111,
    0.9,
  );

  scene.inimigoTeste.fundoVida.setDepth(60);

  scene.inimigoTeste.barraVida = scene.add.rectangle(
    x - 30,
    y - 65,
    60,
    6,
    0xe52b2b,
    1,
  );

  scene.inimigoTeste.barraVida.setOrigin(0, 0.5).setDepth(61);

  scene.inimigoTeste.bordaVida = scene.add.rectangle(x, y - 65, 60, 6);

  scene.inimigoTeste.bordaVida.setStrokeStyle(1, 0xffffff, 0.7).setDepth(62);
}

// =====================================================
// CRIA ANIMAÇÕES
// =====================================================

function criarAnimacoesInimigo(scene) {
  // =====================================================
  // FRENTE / BAIXO
  // FRAMES 0 - 2
  // =====================================================

  if (!scene.anims.exists("robo-down")) {
    scene.anims.create({
      key: "robo-down",

      frames: scene.anims.generateFrameNumbers("robo-teste", {
        start: 0,
        end: 2,
      }),

      frameRate: 6,

      repeat: -1,
    });
  }

  // =====================================================
  // ESQUERDA
  // FRAMES 3 - 5
  // =====================================================

  if (!scene.anims.exists("robo-left")) {
    scene.anims.create({
      key: "robo-left",

      frames: scene.anims.generateFrameNumbers("robo-teste", {
        start: 3,
        end: 5,
      }),

      frameRate: 6,

      repeat: -1,
    });
  }

  // =====================================================
  // DIREITA
  // FRAMES 6 - 8
  // =====================================================

  if (!scene.anims.exists("robo-right")) {
    scene.anims.create({
      key: "robo-right",

      frames: scene.anims.generateFrameNumbers("robo-teste", {
        start: 6,
        end: 8,
      }),

      frameRate: 6,

      repeat: -1,
    });
  }

  // =====================================================
  // COSTAS / CIMA
  // FRAMES 9 - 11
  // =====================================================

  if (!scene.anims.exists("robo-up")) {
    scene.anims.create({
      key: "robo-up",

      frames: scene.anims.generateFrameNumbers("robo-teste", {
        start: 9,
        end: 11,
      }),

      frameRate: 6,

      repeat: -1,
    });
  }
}

// =====================================================
// ATUALIZA INIMIGO
// =====================================================

function atualizarInimigoTeste(scene, time) {
  if (!scene.inimigoTeste || !scene.inimigoTeste.active) {
    return;
  }

  // =====================================================
  // IA
  // =====================================================

  atualizarIAInimigo(scene, time);

  // =====================================================
  // POSIÇÃO DA BARRA DE VIDA
  // =====================================================

  const x = scene.inimigoTeste.x;

  const y = scene.inimigoTeste.y - 65;

  scene.inimigoTeste.fundoVida.setPosition(x, y);

  scene.inimigoTeste.barraVida.setPosition(x - 30, y);

  scene.inimigoTeste.bordaVida.setPosition(x, y);

  // =====================================================
  // TAMANHO DA BARRA
  // =====================================================

  const porcentagemVida =
    scene.inimigoTeste.vida / scene.inimigoTeste.vidaMaxima;

  scene.inimigoTeste.barraVida.width =
    scene.inimigoTeste.larguraBarra * porcentagemVida;
}

// =====================================================
// IA DO INIMIGO
// =====================================================

function atualizarIAInimigo(scene, time) {
  if (!scene.player || !scene.player.active) {
    return;
  }

  const inimigo = scene.inimigoTeste;

  // =====================================================
  // DISTÂNCIA ATÉ O PLAYER
  // =====================================================

  const distancia = Phaser.Math.Distance.Between(
    inimigo.x,
    inimigo.y,
    scene.player.x,
    scene.player.y,
  );

  // =====================================================
  // PLAYER FORA DA DETECÇÃO
  // =====================================================

  if (distancia > inimigo.distanciaDeteccao) {
    inimigo.setVelocity(0, 0);

    pararAnimacaoInimigo(inimigo);

    return;
  }

  // =====================================================
  // ATUALIZA DIREÇÃO
  // =====================================================

  atualizarDirecaoInimigo(scene);

  // =====================================================
  // PLAYER NA DISTÂNCIA DE ATAQUE
  // =====================================================

  if (distancia <= inimigo.distanciaAtaque) {
    // ===================================================
    // PARA
    // ===================================================

    inimigo.setVelocity(0, 0);

    // ===================================================
    // OLHA PARA O PLAYER
    // ===================================================

    pararAnimacaoInimigo(inimigo);

    // ===================================================
    // ATIRA
    // ===================================================

    tentarDispararLaser(scene, time);

    return;
  }

  // =====================================================
  // PERSEGUE PLAYER
  // =====================================================

  scene.physics.moveToObject(inimigo, scene.player, inimigo.velocidade);

  // =====================================================
  // ANIMAÇÃO
  // =====================================================

  tocarAnimacaoInimigo(inimigo);
}

// =====================================================
// DIREÇÃO DO INIMIGO
// =====================================================

function atualizarDirecaoInimigo(scene) {
  const inimigo = scene.inimigoTeste;

  const diferencaX = scene.player.x - inimigo.x;

  const diferencaY = scene.player.y - inimigo.y;

  // =====================================================
  // HORIZONTAL
  // =====================================================

  if (Math.abs(diferencaX) > Math.abs(diferencaY)) {
    if (diferencaX < 0) {
      inimigo.direcaoAtual = "left";
    } else {
      inimigo.direcaoAtual = "right";
    }
  }

  // =====================================================
  // VERTICAL
  // =====================================================
  else {
    if (diferencaY < 0) {
      inimigo.direcaoAtual = "up";
    } else {
      inimigo.direcaoAtual = "down";
    }
  }
}

// =====================================================
// TOCA ANIMAÇÃO
// =====================================================

function tocarAnimacaoInimigo(inimigo) {
  if (inimigo.direcaoAtual === "down") {
    inimigo.anims.play("robo-down", true);
  } else if (inimigo.direcaoAtual === "left") {
    inimigo.anims.play("robo-left", true);
  } else if (inimigo.direcaoAtual === "right") {
    inimigo.anims.play("robo-right", true);
  } else if (inimigo.direcaoAtual === "up") {
    inimigo.anims.play("robo-up", true);
  }
}

// =====================================================
// PARA ANIMAÇÃO
// =====================================================

function pararAnimacaoInimigo(inimigo) {
  inimigo.anims.stop();

  // =====================================================
  // FRENTE
  // =====================================================

  if (inimigo.direcaoAtual === "down") {
    inimigo.setFrame(0);
  }

  // =====================================================
  // ESQUERDA
  // =====================================================
  else if (inimigo.direcaoAtual === "left") {
    inimigo.setFrame(3);
  }

  // =====================================================
  // DIREITA
  // =====================================================
  else if (inimigo.direcaoAtual === "right") {
    inimigo.setFrame(6);
  }

  // =====================================================
  // COSTAS
  // =====================================================
  else if (inimigo.direcaoAtual === "up") {
    inimigo.setFrame(9);
  }
}

// =====================================================
// TENTA DISPARAR LASER
// =====================================================

function tentarDispararLaser(scene, time) {
  const inimigo = scene.inimigoTeste;

  // =====================================================
  // COOLDOWN
  // =====================================================

  if (time < inimigo.ultimoTiro + inimigo.tempoEntreTiros) {
    return;
  }

  // =====================================================
  // REGISTRA TIRO
  // =====================================================

  inimigo.ultimoTiro = time;

  // =====================================================
  // DISPARA
  // =====================================================

  dispararLaser(scene);
}

// =====================================================
// DISPARA LASER
// =====================================================

function dispararLaser(scene) {
  const inimigo = scene.inimigoTeste;

  if (!inimigo || !inimigo.active || !scene.player || !scene.player.active) {
    return;
  }

  // =====================================================
  // ÂNGULO ATÉ O PLAYER
  // =====================================================

  const angulo = Phaser.Math.Angle.Between(
    inimigo.x,
    inimigo.y,
    scene.player.x,
    scene.player.y,
  );

  // =====================================================
  // POSIÇÃO DE SAÍDA
  // =====================================================

  const distanciaSaida = 55;

  const laserX = inimigo.x + Math.cos(angulo) * distanciaSaida;

  const laserY = inimigo.y + Math.sin(angulo) * distanciaSaida;

  // =====================================================
  // CRIA PROJÉTIL
  // =====================================================

  const laser = scene.add.circle(laserX, laserY, 4, 0xff0000, 1);

  laser.setDepth(55);

  // =====================================================
  // BRILHO
  // =====================================================

  laser.setStrokeStyle(2, 0xff8888, 1);

  // =====================================================
  // FÍSICA
  // =====================================================

  scene.physics.add.existing(laser);

  laser.body.setAllowGravity(false);

  // =====================================================
  // ADICIONA AO GRUPO
  // =====================================================

  scene.lasersInimigo.add(laser);

  // =====================================================
  // VELOCIDADE
  // =====================================================

  scene.physics.velocityFromRotation(
    angulo,
    inimigo.velocidadeLaser,
    laser.body.velocity,
  );

  // =====================================================
  // DESTRÓI APÓS 2 SEGUNDOS
  // =====================================================

  scene.time.delayedCall(2000, () => {
    if (laser && laser.active) {
      laser.destroy();
    }
  });
}

// =====================================================
// LASER ACERTA PLAYER
// =====================================================

function acertarPlayerComLaser(scene, laser) {
  // =====================================================
  // LASER NÃO EXISTE MAIS
  // =====================================================

  if (!laser || !laser.active) {
    return;
  }

  // =====================================================
  // DESTRÓI LASER IMEDIATAMENTE
  // =====================================================

  laser.destroy();

  // =====================================================
  // PLAYER ESTÁ INVULNERÁVEL
  // =====================================================

  if (scene.player.invulneravel) {
    return;
  }

  // =====================================================
  // ATIVA INVULNERABILIDADE
  // =====================================================

  scene.player.invulneravel = true;

  // =====================================================
  // DANO
  // =====================================================

  scene.vida -= scene.inimigoTeste.danoLaser;

  scene.vida = Phaser.Math.Clamp(scene.vida, 0, scene.vidaMaxima);

  // =====================================================
  // DEBUG
  // =====================================================

  console.log("LASER ACERTOU - VIDA:", scene.vida);

  // =====================================================
  // EFEITO DE DANO
  // =====================================================

  scene.player.setTint(0xff5555);

  // =====================================================
  // REMOVE INVULNERABILIDADE
  // =====================================================

  scene.time.delayedCall(500, () => {
    if (scene.player && scene.player.active) {
      scene.player.invulneravel = false;

      scene.player.clearTint();
    }
  });

  // =====================================================
  // MORTE
  // =====================================================

  if (scene.vida <= 0) {
    respawnPlayerPorLaser(scene);
  }
}

// =====================================================
// RESPAWN DO PLAYER
// =====================================================

function respawnPlayerPorLaser(scene) {
  // =====================================================
  // PARA PLAYER
  // =====================================================

  scene.player.setVelocity(0, 0);

  // =====================================================
  // VOLTA PARA RESPAWN
  // =====================================================

  scene.player.setPosition(scene.respawnX, scene.respawnY);

  // =====================================================
  // RECUPERA VIDA
  // =====================================================

  scene.vida = scene.vidaMaxima;

  // =====================================================
  // RECUPERA ESTAMINA
  // =====================================================

  scene.estamina = scene.estaminaMaxima;

  // =====================================================
  // REMOVE INVULNERABILIDADE
  // =====================================================

  scene.player.invulneravel = false;
}

// =====================================================
// DANO NO INIMIGO
// =====================================================

function causarDanoInimigo(scene, quantidade) {
  if (!scene.inimigoTeste || !scene.inimigoTeste.active) {
    return;
  }

  // =====================================================
  // REMOVE VIDA
  // =====================================================

  scene.inimigoTeste.vida -= quantidade;

  scene.inimigoTeste.vida = Phaser.Math.Clamp(
    scene.inimigoTeste.vida,
    0,
    scene.inimigoTeste.vidaMaxima,
  );

  // =====================================================
  // EFEITO DE DANO
  // =====================================================

  scene.inimigoTeste.setTint(0xff5555);

  scene.time.delayedCall(100, () => {
    if (scene.inimigoTeste && scene.inimigoTeste.active) {
      scene.inimigoTeste.clearTint();
    }
  });

  // =====================================================
  // MORTE
  // =====================================================

  if (scene.inimigoTeste.vida <= 0) {
    destruirInimigoTeste(scene);
  }
}

// =====================================================
// DESTRÓI INIMIGO
// =====================================================

function destruirInimigoTeste(scene) {
  if (!scene.inimigoTeste) {
    return;
  }

  // =====================================================
  // BARRA DE VIDA
  // =====================================================

  scene.inimigoTeste.fundoVida.destroy();

  scene.inimigoTeste.barraVida.destroy();

  scene.inimigoTeste.bordaVida.destroy();

  // =====================================================
  // ROBÔ
  // =====================================================

  scene.inimigoTeste.destroy();
}

// =====================================================
// EXPORTA
// =====================================================

export { criarInimigoTeste, atualizarInimigoTeste, causarDanoInimigo };
