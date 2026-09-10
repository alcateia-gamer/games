// =====================================================
// CRIA INIMIGO
// =====================================================

function criarInimigoTeste(scene, config = {}) {
  criarAnimacoesInimigo(scene);

  const x = Number(config.x ?? scene.respawnX + 180);
  const y = Number(config.y ?? scene.respawnY);

  const inimigo = scene.physics.add.sprite(x, y, "robo-teste", 0);

  inimigo.setDepth(50);
  inimigo.setScale(0.75);
  inimigo.body.setAllowGravity(false);

  configurarHitboxPeInimigo(inimigo);

  inimigo.formacaoIndex = Number(config.formacaoIndex ?? 0);
  inimigo.patrolCenter = {
    x: Number(config.x ?? x),
    y: Number(config.y ?? y),
  };
  inimigo.tempoPatrulha = Number(config.tempoPatrulha ?? 1500);
  inimigo.ultimoMovimentoPatrulha = 0;

  inimigo.hitboxDano = new Phaser.Geom.Rectangle(
    x - 32,
    y - 44,
    64,
    96,
  );

  inimigo.debugHitboxDano = scene.add.graphics();
  inimigo.debugHitboxDano.setDepth(200);
  inimigo.debugHitboxDano.setVisible(Boolean(scene.game?.config?.physics?.arcade?.debug));

  inimigo.velocidade = Number(config.velocidade ?? 50);
  inimigo.orbitaAngulo = Math.random() * Math.PI * 2;
  inimigo.distanciaDeteccao = Number(config.distanciaDeteccao ?? 220);
  inimigo.distanciaAtaque = Number(config.distanciaAtaque ?? 180);
  inimigo.distanciaGrupo = Number(config.distanciaGrupo ?? 180);
  inimigo.danoBase = Number(config.danoLaser ?? 5);
  const direcoes = ["down", "left", "right", "up"];
  const direcaoAleatoria = direcoes[Math.floor(Math.random() * direcoes.length)];

  inimigo.direcaoAtual = config.direcaoAtual ?? direcaoAleatoria;

  inimigo.tempoEntreTiros = Number(config.tempoEntreTiros ?? 720);
  inimigo.ultimoTiro = 0;
  inimigo.velocidadeLaser = Number(config.velocidadeLaser ?? 250);
  inimigo.danoLaser = inimigo.danoBase * 1.3 * 0.8;
  inimigo.ultimoLadoTiro = Math.random() > 0.5 ? "right" : "left";

  inimigo.vidaMaxima = Number(config.vidaMaxima ?? 100);
  inimigo.vida = inimigo.vidaMaxima;

  inimigo.alerta = false;
  inimigo.foiFerido = false;
  inimigo.estado = "idle";

  scene.lasersInimigo = scene.lasersInimigo || scene.physics.add.group();

  if (scene.player && scene.player.active) {
    scene.player.invulneravel = false;
  }

  inimigo.larguraBarra = 60;
  inimigo.fundoVida = scene.add.rectangle(x, y - 65, 60, 6, 0x111111, 0.9);
  inimigo.fundoVida.setDepth(60);

  inimigo.barraVida = scene.add.rectangle(x - 30, y - 65, 60, 6, 0xe52b2b, 1);
  inimigo.barraVida.setOrigin(0, 0.5).setDepth(61);

  inimigo.bordaVida = scene.add.rectangle(x, y - 65, 60, 6);
  inimigo.bordaVida.setStrokeStyle(1, 0xffffff, 0.7).setDepth(62);

  if (!Array.isArray(scene.inimigos)) {
    scene.inimigos = [];
  }

  scene.inimigos.push(inimigo);
  scene.inimigoTeste = inimigo;

  return inimigo;
}

function limparGrupoRobos(scene) {
  if (!scene || !Array.isArray(scene.inimigos)) {
    return;
  }

  scene.inimigos.forEach((robo) => {
    if (!robo) {
      return;
    }

    if (robo.debugHitboxDano) {
      robo.debugHitboxDano.destroy();
      robo.debugHitboxDano = null;
    }

    if (robo.fundoVida) {
      robo.fundoVida.destroy();
      robo.fundoVida = null;
    }

    if (robo.barraVida) {
      robo.barraVida.destroy();
      robo.barraVida = null;
    }

    if (robo.bordaVida) {
      robo.bordaVida.destroy();
      robo.bordaVida = null;
    }

    if (robo.body) {
      robo.body.enable = false;
    }

    if (robo.active) {
      robo.setVisible(false);
      robo.setActive(false);
    }

    if (robo.destroy) {
      robo.destroy();
    }
  });

  scene.inimigos = [];
  scene.inimigoTeste = null;
  scene.grupoRobosAtivado = false;
}

function criarGrupoRobos(scene, centroX = -295, centroY = 1284) {
  if (!scene) {
    return [];
  }

  const robosEliminados = !!scene.registry?.get("robosEliminados");

  if (robosEliminados) {
    return scene.inimigos ?? [];
  }

  if (!Array.isArray(scene.inimigos)) {
    scene.inimigos = [];
  }

  if (scene.grupoRobosAtivado) {
    return scene.inimigos;
  }

  if (Array.isArray(scene.inimigos) && scene.inimigos.length > 0) {
    limparGrupoRobos(scene);
  }

  scene.grupoRobosAtivado = true;

  const offsets = [
    { angulo: 0.2, raio: 62 },
    { angulo: 1.7, raio: 84 },
    { angulo: 3.1, raio: 72 },
    { angulo: 4.5, raio: 96 },
    { angulo: 5.7, raio: 78 },
  ];

  offsets.forEach(({ angulo, raio }, index) => {
    const x = centroX + Math.cos(angulo) * raio + (Math.random() - 0.5) * 18;
    const y = centroY + Math.sin(angulo) * raio + (Math.random() - 0.5) * 18;

    criarInimigoTeste(scene, {
      x,
      y,
      formacaoIndex: index,
      velocidade: 50,
      distanciaDeteccao: 260,
      distanciaAtaque: 180,
      distanciaGrupo: 220,
      tempoEntreTiros: 680 - index * 40,
      tempoPatrulha: 1200 + index * 120,
      direcaoAtual: ["down", "left", "right", "up"][Math.floor(Math.random() * 4)],
    });
  });

  if (scene.physics && scene.inimigos && scene.inimigos.length > 0) {
    scene.physics.add.collider(scene.inimigos, scene.inimigos);
    if (scene.collisionGroup) {
      scene.physics.add.collider(scene.inimigos, scene.collisionGroup);
    }
  }

  return scene.inimigos;
}

function configurarHitboxPeInimigo(inimigo) {
  if (!inimigo || !inimigo.body) {
    return;
  }

  inimigo.body.setSize(74, 26);
  inimigo.body.setOffset(12, 100);
}

function atualizarHitboxDanoInimigo(inimigo) {
  if (!inimigo || !inimigo.body) {
    return;
  }

  const largura = 80;
  const altura = 120;
  const offsetX = inimigo.x - largura / 2 + 12 - 8;
  const offsetY = inimigo.y - altura / 2 + 6;

  if (!inimigo.hitboxDano || !(inimigo.hitboxDano instanceof Phaser.Geom.Rectangle)) {
    inimigo.hitboxDano = new Phaser.Geom.Rectangle(offsetX, offsetY, largura, altura);
    return;
  }

  inimigo.hitboxDano.setTo(offsetX, offsetY, largura, altura);

  if (inimigo.debugHitboxDano) {
    inimigo.debugHitboxDano.clear();
    inimigo.debugHitboxDano.lineStyle(2, 0x00ff00, 1);
    inimigo.debugHitboxDano.fillStyle(0x00ff00, 0.18);
    inimigo.debugHitboxDano.fillRectShape(inimigo.hitboxDano);
    inimigo.debugHitboxDano.strokeRectShape(inimigo.hitboxDano);
    inimigo.debugHitboxDano.setVisible(Boolean(inimigo.scene?.game?.config?.physics?.arcade?.debug));
  }
}

function atualizarDepthInimigo(inimigo, scene) {
  if (!inimigo || !scene?.player || !scene.player.active) {
    return;
  }

  const playerCenterY = scene.player.getCenter().y;
  const enemyCenterY = inimigo.getCenter().y;

  const baseDepth = 12;
  const diferenca = (enemyCenterY - playerCenterY) * 0.03;
  const novaDepth = Phaser.Math.Clamp(baseDepth + diferenca, 10, 18);

  inimigo.setDepth(novaDepth);

  if (scene.player && scene.player.active) {
    scene.player.setDepth(baseDepth);
  }
}

function aplicarSeparacaoGrupo(inimigo, scene) {
  if (!Array.isArray(scene.inimigos)) {
    return;
  }

  const minDist = 90;
  const fator = 0.24;

  for (const aliado of scene.inimigos) {
    if (!aliado || !aliado.active || aliado === inimigo) {
      continue;
    }

    const distancia = Phaser.Math.Distance.Between(
      inimigo.x,
      inimigo.y,
      aliado.x,
      aliado.y,
    );

    if (distancia >= minDist) {
      continue;
    }

    const angulo = Phaser.Math.Angle.Between(
      aliado.x,
      aliado.y,
      inimigo.x,
      inimigo.y,
    );

    const empurrar = (minDist - distancia) * fator;
    const deslocamentoX = Math.cos(angulo) * empurrar;
    const deslocamentoY = Math.sin(angulo) * empurrar;

    inimigo.x += deslocamentoX;
    inimigo.y += deslocamentoY;
  }
}

// =====================================================
// CRIA ANIMAÇÕES
// =====================================================

function criarAnimacoesInimigo(scene) {
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

function temVisaoDoPlayer(scene, inimigo) {
  if (!scene.player || !scene.player.active || !inimigo || !inimigo.active) {
    return false;
  }

  const dx = scene.player.x - inimigo.x;
  const dy = scene.player.y - inimigo.y;
  const distancia = Math.hypot(dx, dy);

  if (distancia > inimigo.distanciaDeteccao) {
    return false;
  }

  const frenteX = inimigo.x + Math.cos(anguloDirecao(inimigo.direcaoAtual)) * 120;
  const frenteY = inimigo.y + Math.sin(anguloDirecao(inimigo.direcaoAtual)) * 120;
  const linha = new Phaser.Geom.Line(inimigo.x, inimigo.y, frenteX, frenteY);

  const dot = (dx * Math.cos(anguloDirecao(inimigo.direcaoAtual)) + dy * Math.sin(anguloDirecao(inimigo.direcaoAtual))) / distancia;
  if (dot < 0.2) {
    return false;
  }

  const centroPlayer = {
    x: scene.player.x,
    y: scene.player.y,
  };

  const playerDentroCono =
    Phaser.Math.Distance.Between(inimigo.x, inimigo.y, centroPlayer.x, centroPlayer.y) <= inimigo.distanciaDeteccao;

  if (!playerDentroCono) {
    return false;
  }

  const linhaParaPlayer = new Phaser.Geom.Line(
    inimigo.x,
    inimigo.y,
    scene.player.x,
    scene.player.y,
  );

  if (!scene.collisionGroup || !scene.collisionGroup.getChildren) {
    return true;
  }

  const blocos = scene.collisionGroup.getChildren();

  for (const bloco of blocos) {
    if (!bloco || !bloco.body) {
      continue;
    }

    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    if (Phaser.Geom.Intersects.LineToRectangle(linhaParaPlayer, rect)) {
      return false;
    }
  }

  return true;
}

function anguloDirecao(direcao) {
  if (direcao === "left") return Math.PI;
  if (direcao === "right") return 0;
  if (direcao === "up") return -Math.PI / 2;
  return Math.PI / 2;
}

function notificarGrupo(scene, inimigoAlvo, origem = "dano") {
  if (!Array.isArray(scene.inimigos)) {
    return;
  }

  for (const aliado of scene.inimigos) {
    if (!aliado || !aliado.active || aliado === inimigoAlvo) {
      continue;
    }

    const distanciaAliado = Phaser.Math.Distance.Between(
      aliado.x,
      aliado.y,
      inimigoAlvo.x,
      inimigoAlvo.y,
    );

    const podeAlerta =
      distanciaAliado <= inimigoAlvo.distanciaGrupo * 1.5 ||
      origem === "visao";

    if (podeAlerta) {
      aliado.alerta = true;
      aliado.estado = "alerta";

      if (origem === "dano") {
        aliado.foiFerido = true;
      }
    }
  }
}

// =====================================================
// ATUALIZA INIMIGO
// =====================================================

function atualizarInimigoTeste(scene, time) {
  if (!Array.isArray(scene.inimigos) || scene.inimigos.length === 0) {
    return;
  }

  for (const inimigo of scene.inimigos) {
    if (!inimigo || !inimigo.active) {
      continue;
    }

    atualizarIAInimigo(scene, time, inimigo);
    atualizarHitboxDanoInimigo(inimigo);
    atualizarDepthInimigo(inimigo, scene);

    const x = inimigo.x;
    const y = inimigo.y - 65;

    inimigo.fundoVida.setPosition(x, y);
    inimigo.barraVida.setPosition(x - 30, y);
    inimigo.bordaVida.setPosition(x, y);

    if (inimigo.debugHitboxDano) {
      inimigo.debugHitboxDano.setVisible(Boolean(inimigo.scene?.game?.config?.physics?.arcade?.debug));
    }

    const porcentagemVida = inimigo.vida / inimigo.vidaMaxima;
    inimigo.barraVida.width = inimigo.larguraBarra * porcentagemVida;
  }

  verificarLasersNoMapa(scene);
  verificarLasersNoPlayer(scene);
}

// =====================================================
// IA DO INIMIGO
// =====================================================

function atualizarIAInimigo(scene, time, inimigo = scene.inimigoTeste) {
  if (!scene.player || !scene.player.active || !inimigo || !inimigo.active) {
    return;
  }

  const distancia = Phaser.Math.Distance.Between(
    inimigo.x,
    inimigo.y,
    scene.player.x,
    scene.player.y,
  );

  const viuPlayer = temVisaoDoPlayer(scene, inimigo);
  const foiFerido = inimigo.foiFerido && inimigo.vida < inimigo.vidaMaxima;

  if (viuPlayer) {
    notificarGrupo(scene, inimigo, "visao");
  }

  if (foiFerido || inimigo.alerta || viuPlayer) {
    inimigo.alerta = true;
    inimigo.estado = "alerta";
  }

  if (inimigo.alerta || viuPlayer || foiFerido) {
    const raioOrbit = 120 + inimigo.formacaoIndex * 30 + (inimigo.distanciaGrupo || 180) * 0.2;
    const anguloOrbit = (time * 0.0015) + inimigo.orbitaAngulo + inimigo.formacaoIndex * (Math.PI / 2.1);
    const alvoOrbitX = scene.player.x + Math.cos(anguloOrbit) * raioOrbit;
    const alvoOrbitY = scene.player.y + Math.sin(anguloOrbit) * raioOrbit;

    scene.physics.moveTo(inimigo, alvoOrbitX, alvoOrbitY, inimigo.velocidade * 1.75);
    atualizarDirecaoInimigo(scene, inimigo);
    aplicarSeparacaoGrupo(inimigo, scene);
    tocarAnimacaoInimigo(inimigo);

    if (distancia <= inimigo.distanciaAtaque) {
      inimigo.setVelocity(0, 0);
      pararAnimacaoInimigo(inimigo);
      tentarDispararLaser(scene, time, inimigo);
    }

    return;
  }

  if (!inimigo.alerta && !viuPlayer && !foiFerido) {
    const distPatrulha = Phaser.Math.Distance.Between(
      inimigo.x,
      inimigo.y,
      inimigo.patrolCenter.x,
      inimigo.patrolCenter.y,
    );

    const deslocamento =
      (time * 0.0009) + inimigo.formacaoIndex * (Math.PI / 2.2);

    const patrolX =
      inimigo.patrolCenter.x +
      Math.cos(deslocamento) * (inimigo.distanciaGrupo * 0.7);
    const patrolY =
      inimigo.patrolCenter.y +
      Math.sin(deslocamento) * (inimigo.distanciaGrupo * 0.55);

    if (distPatrulha > 10) {
      scene.physics.moveTo(inimigo, patrolX, patrolY, inimigo.velocidade * 0.7);
      aplicarSeparacaoGrupo(inimigo, scene);
      tocarAnimacaoInimigo(inimigo);
    } else {
      inimigo.setVelocity(0, 0);
      pararAnimacaoInimigo(inimigo);
    }

    return;
  }

  atualizarDirecaoInimigo(scene, inimigo);

  if (distancia <= inimigo.distanciaAtaque) {
    inimigo.setVelocity(0, 0);
    pararAnimacaoInimigo(inimigo);
    tentarDispararLaser(scene, time, inimigo);
    return;
  }

  aplicarSeparacaoGrupo(inimigo, scene);
  scene.physics.moveToObject(inimigo, scene.player, inimigo.velocidade);
  tocarAnimacaoInimigo(inimigo);
}

// =====================================================
// DIREÇÃO DO INIMIGO
// =====================================================

function atualizarDirecaoInimigo(scene, inimigo = scene.inimigoTeste) {
  const velocidadeX = inimigo.body ? inimigo.body.velocity.x : 0;
  const velocidadeY = inimigo.body ? inimigo.body.velocity.y : 0;
  const velocidadeTotal = Math.hypot(velocidadeX, velocidadeY);

  if (velocidadeTotal > 8) {
    if (Math.abs(velocidadeX) > Math.abs(velocidadeY)) {
      inimigo.direcaoAtual = velocidadeX < 0 ? "left" : "right";
    } else {
      inimigo.direcaoAtual = velocidadeY < 0 ? "up" : "down";
    }
    return;
  }

  const diferencaX = scene.player.x - inimigo.x;
  const diferencaY = scene.player.y - inimigo.y;

  if (Math.abs(diferencaX) > Math.abs(diferencaY)) {
    inimigo.direcaoAtual = diferencaX < 0 ? "left" : "right";
  } else {
    inimigo.direcaoAtual = diferencaY < 0 ? "up" : "down";
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
  if (inimigo.anims && inimigo.anims.isPlaying) {
    inimigo.anims.stop();
  }

  if (inimigo.direcaoAtual === "down") {
    inimigo.setFrame(0);
  } else if (inimigo.direcaoAtual === "left") {
    inimigo.setFrame(3);
  } else if (inimigo.direcaoAtual === "right") {
    inimigo.setFrame(6);
  } else if (inimigo.direcaoAtual === "up") {
    inimigo.setFrame(9);
  }
}

// =====================================================
// TENTA DISPARAR LASER
// =====================================================

function tentarDispararLaser(scene, time, inimigo = scene.inimigoTeste) {
  if (!inimigo || !inimigo.active) {
    return;
  }

  if (time < inimigo.ultimoTiro + inimigo.tempoEntreTiros) {
    return;
  }

  inimigo.ultimoTiro = time;
  dispararLaser(scene, inimigo);
}

// =====================================================
// DISPARA LASER
// =====================================================

function dispararLaser(scene, inimigo = scene.inimigoTeste) {
  if (!inimigo || !inimigo.active || !scene.player || !scene.player.active) {
    return;
  }

  const angulo = Phaser.Math.Angle.Between(
    inimigo.x,
    inimigo.y,
    scene.player.x,
    scene.player.y,
  );

  const lado = inimigo.ultimoLadoTiro === "right" ? "right" : "left";
  inimigo.ultimoLadoTiro = lado === "right" ? "left" : "right";

  const offsetX = (lado === "right" ? 26 : -26) - 10;
  const offsetY = 12;
  const distanciaSaida = 34;

  const laserX = inimigo.x + Math.cos(angulo) * distanciaSaida + offsetX * 0.5;
  const laserY = inimigo.y + Math.sin(angulo) * distanciaSaida + offsetY;

  const laser = scene.add.circle(laserX, laserY, 4, 0xff0000, 1);
  laser.setDepth(55);
  laser.setStrokeStyle(2, 0xff8888, 1);

  scene.physics.add.existing(laser);
  laser.body.setAllowGravity(false);
  scene.lasersInimigo.add(laser);

  scene.physics.velocityFromRotation(
    angulo,
    inimigo.velocidadeLaser + 30,
    laser.body.velocity,
  );

  scene.time.delayedCall(2000, () => {
    if (laser && laser.active) {
      laser.destroy();
    }
  });
}

// =====================================================
// VERIFICA LASERS NA HITBOX DE DANO
// =====================================================

function verificarLasersNoMapa(scene) {
  if (!scene.collisionGroup || !scene.lasersInimigo) {
    return;
  }

  const blocos = scene.collisionGroup.getChildren();
  const lasers = scene.lasersInimigo.getChildren();

  for (const laser of lasers) {
    if (!laser || !laser.active) {
      continue;
    }

    const boundsLaser = laser.getBounds();

    for (const bloco of blocos) {
      if (!bloco || !bloco.body) {
        continue;
      }

      const rectBloco = new Phaser.Geom.Rectangle(
        bloco.body.x,
        bloco.body.y,
        bloco.body.width,
        bloco.body.height,
      );

      if (Phaser.Geom.Intersects.RectangleToRectangle(rectBloco, boundsLaser)) {
        laser.destroy();
        break;
      }
    }
  }
}

function verificarLasersNoPlayer(scene) {
  if (!scene.hitboxDanoPlayer || !scene.lasersInimigo) {
    return;
  }

  const lasers = scene.lasersInimigo.getChildren();

  for (const laser of lasers) {
    if (!laser || !laser.active) {
      continue;
    }

    const boundsLaser = laser.getBounds();
    const acertou = Phaser.Geom.Intersects.RectangleToRectangle(
      scene.hitboxDanoPlayer,
      boundsLaser,
    );

    if (acertou) {
      acertarPlayerComLaser(scene, laser);
    }
  }
}

// =====================================================
// LASER ACERTA PLAYER
// =====================================================

function acertarPlayerComLaser(scene, laser) {
  if (!laser || !laser.active) {
    return;
  }

  laser.destroy();

  if (scene.player.invulneravel) {
    return;
  }

  scene.player.invulneravel = true;

  const danoLaser = Array.isArray(scene.inimigos) && scene.inimigos.length > 0
    ? scene.inimigos[0].danoLaser
    : scene.inimigoTeste?.danoLaser ?? 5;

  scene.vida -= danoLaser;
  scene.vida = Phaser.Math.Clamp(scene.vida, 0, scene.vidaMaxima);

  scene.player.setTint(0xff5555);

  scene.time.delayedCall(500, () => {
    if (scene.player && scene.player.active) {
      scene.player.invulneravel = false;
      scene.player.clearTint();
    }
  });

  if (scene.vida <= 0) {
    respawnPlayerPorLaser(scene);
  }
}

// =====================================================
// RESPAWN DO PLAYER
// =====================================================

function respawnPlayerPorLaser(scene) {
  scene.player.setVelocity(0, 0);
  scene.player.setPosition(scene.respawnX, scene.respawnY);

  if (scene.hitboxDanoPlayer) {
    const largura = 38;
    const altura = 46;
    const baseY = scene.respawnY + 26;

    scene.hitboxDanoPlayer.setTo(
      scene.respawnX - largura / 2,
      baseY - altura,
      largura,
      altura,
    );
  }

  scene.vida = scene.vidaMaxima;
  scene.estamina = scene.estaminaMaxima;
  scene.player.invulneravel = false;
}

// =====================================================
// DANO NO INIMIGO
// =====================================================

function causarDanoInimigo(scene, alvoOuQuantidade, quantidadeOpcional) {
  const alvo =
    typeof alvoOuQuantidade === "object" && alvoOuQuantidade
      ? alvoOuQuantidade
      : scene.inimigoTeste;

  const quantidade =
    typeof alvoOuQuantidade === "number"
      ? alvoOuQuantidade
      : quantidadeOpcional ?? 25;

  if (!alvo || !alvo.active) {
    return;
  }

  alvo.vida -= quantidade;
  alvo.vida = Phaser.Math.Clamp(alvo.vida, 0, alvo.vidaMaxima);
  alvo.foiFerido = true;
  alvo.alerta = true;
  alvo.estado = "alerta";

  if (scene.time) {
    alvo.setTint(0xff5555);
    scene.time.delayedCall(100, () => {
      if (alvo && alvo.active) {
        alvo.clearTint();
      }
    });
  }

  notificarGrupo(scene, alvo);

  if (alvo.vida <= 0) {
    destruirInimigoTeste(scene, alvo);
  }
}

// =====================================================
// DESTRÓI INIMIGO
// =====================================================

function destruirInimigoTeste(scene, inimigo = scene.inimigoTeste) {
  if (!inimigo || !scene) {
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

  inimigo.hitboxDano = null;
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

export {
  criarInimigoTeste,
  criarGrupoRobos,
  atualizarInimigoTeste,
  causarDanoInimigo,
};
