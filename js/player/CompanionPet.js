const COMPANION_CONFIG = {
  minDistance: 32,
  preferredDistance: 58,
  maxDistance: 118,
  followSpeed: 155,
  orbitSpeed: 70,
  returnSpeed: 235,
  targetUpdateInterval: 1400,
  steeringSmoothing: 0.1,
  idleLookDelay: 10000,
  idleLookDuration: 500,
  enemyAvoidRadius: 82,
  stuckTimeout: 1800,
  recoveryTimeout: 5200,
  candidateCount: 14,
};

function criarAnimacoesCompanionPet(scene) {
  const animacoes = {
    down: [0, 12],
    left: [13, 25],
    right: [26, 38],
    up: [39, 51],
  };

  Object.entries(animacoes).forEach(([direcao, frames]) => {
    const chave = `companion-pet-walk-${direcao}`;
    if (scene.anims.exists(chave)) {
      scene.anims.remove(chave);
    }
    scene.anims.create({
      key: chave,
      frames: scene.anims.generateFrameNumbers("robo-pet", {
        start: frames[0],
        end: frames[1],
      }),
      frameRate: 12,
      repeat: -1,
    });
  });
}

function obterRetangulosObstaculos(scene) {
  return scene.collisionGroup?.getChildren
    ? scene.collisionGroup
        .getChildren()
        .filter((object) => object?.active && object.body)
        .map(
          (object) =>
            new Phaser.Geom.Rectangle(
              object.body.x,
              object.body.y,
              object.body.width,
              object.body.height,
            ),
        )
    : [];
}

function retanguloCorpo(object, x = object.x, y = object.y) {
  const largura = object.body?.width ?? 24;
  const altura = object.body?.height ?? 16;
  return new Phaser.Geom.Rectangle(
    x - largura / 2,
    y - altura / 2,
    largura,
    altura,
  );
}

function posicaoLivre(scene, pet, x, y, incluirInimigos = true) {
  const bounds = retanguloCorpo(pet, x, y);
  if (
    Phaser.Geom.Intersects.RectangleToRectangle(
      bounds,
      retanguloCorpo(scene.player),
    )
  ) {
    return false;
  }

  if (
    obterRetangulosObstaculos(scene).some((obstaculo) =>
      Phaser.Geom.Intersects.RectangleToRectangle(bounds, obstaculo),
    )
  ) {
    return false;
  }

  if (incluirInimigos) {
    return !(scene.inimigos || []).some((inimigo) => {
      if (!inimigo?.active || inimigo === pet) {
        return false;
      }
      const distancia = Phaser.Math.Distance.Between(
        x,
        y,
        inimigo.x,
        inimigo.y,
      );
      return (
        distancia < pet.config.enemyAvoidRadius &&
        Phaser.Geom.Intersects.RectangleToRectangle(
          bounds,
          retanguloCorpo(inimigo),
        )
      );
    });
  }

  return true;
}

function distanciaAoInimigoMaisProximo(scene, x, y) {
  return Math.min(
    ...(scene.inimigos || [])
      .filter((inimigo) => inimigo?.active)
      .map((inimigo) =>
        Phaser.Math.Distance.Between(x, y, inimigo.x, inimigo.y),
      ),
    1000,
  );
}

function escolherAlvo(scene, pet, distancia) {
  const player = scene.player;
  const velocidade = player.body?.velocity;
  const movimentoX = velocidade?.x ?? 0;
  const movimentoY = velocidade?.y ?? 0;
  const movimento = Math.hypot(movimentoX, movimentoY);
  const urgencia = distancia > pet.config.maxDistance ? 1 : 0;
  const raio = Phaser.Math.Clamp(
    pet.config.preferredDistance + Phaser.Math.Between(-12, 12),
    pet.config.minDistance + 8,
    pet.config.maxDistance - 10,
  );
  const centroX =
    player.x + (movimentoX / Math.max(movimento, 1)) * (urgencia ? 0 : 18);
  const centroY =
    player.y + (movimentoY / Math.max(movimento, 1)) * (urgencia ? 0 : 18);
  const anguloBase =
    pet.orbitAngle +
    (movimento > 5 ? Math.atan2(movimentoY, movimentoX) * 0.25 : 0);
  let melhor = null;
  let melhorPontuacao = Infinity;

  for (let index = 0; index < pet.config.candidateCount; index += 1) {
    const angulo =
      anguloBase + (Math.PI * 2 * index) / pet.config.candidateCount;
    const distanciaCandidata = raio + Phaser.Math.Between(-10, 10);
    const x = centroX + Math.cos(angulo) * distanciaCandidata;
    const y = centroY + Math.sin(angulo) * distanciaCandidata;
    const livre = posicaoLivre(scene, pet, x, y, true);
    const livreSemInimigo = posicaoLivre(scene, pet, x, y, false);
    if (!livre && !livreSemInimigo) {
      continue;
    }

    const distanciaDoAlvo = Phaser.Math.Distance.Between(pet.x, pet.y, x, y);
    const distanciaDoJogador = Phaser.Math.Distance.Between(
      player.x,
      player.y,
      x,
      y,
    );
    const distanciaInimigo = distanciaAoInimigoMaisProximo(scene, x, y);
    const pontuacao =
      distanciaDoAlvo * 0.35 +
      Math.abs(distanciaDoJogador - pet.config.preferredDistance) * 1.4 +
      (livre ? 0 : 220) +
      Math.max(0, pet.config.enemyAvoidRadius - distanciaInimigo) * 2 +
      Math.abs(Phaser.Math.Angle.Wrap(angulo - pet.orbitAngle)) * 8;

    if (pontuacao < melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhor = { x, y };
    }
  }

  return melhor || { x: player.x, y: player.y };
}

function escolherDirecao(scene, pet, alvo, velocidade) {
  const dx = alvo.x - pet.x;
  const dy = alvo.y - pet.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia < 4) {
    return { x: 0, y: 0 };
  }

  const angulo = Math.atan2(dy, dx);
  const opcoes = [0, -0.28, 0.28, -0.58, 0.58, Math.PI].map(
    (desvio) => angulo + desvio,
  );
  let melhor = { x: 0, y: 0 };
  let melhorPontuacao = -Infinity;

  for (const direcao of opcoes) {
    const x = pet.x + Math.cos(direcao) * Math.min(18, distancia);
    const y = pet.y + Math.sin(direcao) * Math.min(18, distancia);
    if (!posicaoLivre(scene, pet, x, y, true)) {
      continue;
    }
    const alinhamento = Math.cos(direcao - angulo);
    if (alinhamento > melhorPontuacao) {
      melhorPontuacao = alinhamento;
      melhor = {
        x: Math.cos(direcao) * velocidade,
        y: Math.sin(direcao) * velocidade,
      };
    }
  }

  return melhor;
}

function criarCompanionPet(scene) {
  criarAnimacoesCompanionPet(scene);
  const pet = scene.physics.add.sprite(
    scene.player.x - 45,
    scene.player.y + 35,
    "robo-pet",
  );
  pet.setScale(0.25);
  pet.setDepth(13);
  pet.setData("isCompanionPet", true);
  pet.config = { ...COMPANION_CONFIG };
  pet.body.setAllowGravity(false);
  pet.body.setImmovable(true);
  pet.body.setSize(220, 80);
  pet.body.setOffset(67, 160);
  pet.orbitAngle = Math.random() * Math.PI * 2;
  pet.target = { x: pet.x, y: pet.y };
  pet.lastTargetAt = 0;
  pet.stuckTime = 0;
  pet.recoveryTime = 0;
  pet.lastX = pet.x;
  pet.lastY = pet.y;
  pet.state = "IDLE";
  pet.direcaoAtual = "down";
  pet.direcaoRepouso = "down";
  pet.tempoParado = 0;
  pet.olharAtivo = false;
  pet.olharEtapa = 0;
  pet.tempoOlhar = 0;
  pet.setFrame(0);
  scene.companionPet = pet;

  if (scene.collisionGroup) {
    scene.physics.add.collider(pet, scene.collisionGroup);
  }
  scene.physics.add.collider(pet, scene.player);
  return pet;
}

function atualizarCompanionPet(scene, _time, delta) {
  const pet = scene.companionPet;
  const player = scene.player;
  if (!pet?.active || !player?.active) {
    return;
  }

  const distancia = Phaser.Math.Distance.Between(
    pet.x,
    pet.y,
    player.x,
    player.y,
  );
  const agora = scene.time.now;
  pet.orbitAngle +=
    pet.config.orbitSpeed * 0.001 * (Math.min(delta, 100) / 1000);
  const velocidadePlayer = player.body?.velocity;
  const jogadorParado =
    Math.hypot(velocidadePlayer?.x ?? 0, velocidadePlayer?.y ?? 0) < 5;

  if (
    jogadorParado &&
    distancia >= pet.config.minDistance &&
    distancia <= pet.config.preferredDistance + 18
  ) {
    if (pet.state !== "IDLE") {
      pet.direcaoRepouso = pet.direcaoAtual;
      pet.tempoParado = 0;
      pet.olharAtivo = false;
      pet.tempoOlhar = 0;
    }
    pet.state = "IDLE";
    pet.target = { x: pet.x, y: pet.y };
    pet.tempoParado += delta;
    aplicarVelocidadeSuave(pet, 0, 0, delta);
    atualizarOlharOcioso(pet, delta);
    pet.lastX = pet.x;
    pet.lastY = pet.y;
    return;
  }

  pet.tempoParado = 0;
  pet.olharAtivo = false;
  pet.tempoOlhar = 0;

  if (distancia > pet.config.maxDistance) {
    pet.state = "RETURN_TO_PLAYER";
  } else if (distancia > pet.config.preferredDistance + 15) {
    pet.state = "FOLLOW";
  } else if (distancia < pet.config.minDistance) {
    pet.state = "AVOID_PLAYER";
  } else if (pet.state === "RETURN_TO_PLAYER") {
    pet.state = "ORBIT";
  }

  if (
    agora - pet.lastTargetAt >= pet.config.targetUpdateInterval ||
    pet.state === "RETURN_TO_PLAYER"
  ) {
    pet.target = escolherAlvo(scene, pet, distancia);
    pet.lastTargetAt = agora + Phaser.Math.Between(-120, 180);
  }

  if (pet.state === "AVOID_PLAYER") {
    const afastamento = Phaser.Math.Angle.Between(
      player.x,
      player.y,
      pet.x,
      pet.y,
    );
    pet.target = {
      x: player.x + Math.cos(afastamento) * pet.config.preferredDistance,
      y: player.y + Math.sin(afastamento) * pet.config.preferredDistance,
    };
  }

  const velocidade =
    pet.state === "RETURN_TO_PLAYER"
      ? pet.config.returnSpeed
      : pet.state === "ORBIT"
        ? pet.config.orbitSpeed
        : pet.config.followSpeed;
  const direcao = escolherDirecao(scene, pet, pet.target, velocidade);
  const velocidadeSuave = aplicarVelocidadeSuave(
    pet,
    direcao.x,
    direcao.y,
    delta,
  );
  atualizarAnimacaoCompanionPet(pet, velocidadeSuave.x, velocidadeSuave.y);

  const deslocamento = Phaser.Math.Distance.Between(
    pet.x,
    pet.y,
    pet.lastX,
    pet.lastY,
  );
  if (
    deslocamento < 0.5 &&
    Phaser.Math.Distance.Between(pet.x, pet.y, pet.target.x, pet.target.y) > 12
  ) {
    pet.stuckTime += delta;
  } else {
    pet.stuckTime = Math.max(0, pet.stuckTime - delta * 0.5);
  }
  pet.lastX = pet.x;
  pet.lastY = pet.y;

  if (pet.stuckTime > pet.config.stuckTimeout) {
    pet.state = "AVOID_OBSTACLE";
    pet.lastTargetAt = 0;
    pet.stuckTime = 0;
  }

  if (distancia > pet.config.maxDistance + 80) {
    pet.recoveryTime += delta;
  } else {
    pet.recoveryTime = 0;
  }

  if (pet.recoveryTime > pet.config.recoveryTimeout) {
    const recuperacao = escolherAlvo(scene, pet, distancia);
    if (posicaoLivre(scene, pet, recuperacao.x, recuperacao.y, false)) {
      pet.setPosition(recuperacao.x, recuperacao.y);
    }
    pet.recoveryTime = 0;
  }
}

function aplicarVelocidadeSuave(pet, alvoX, alvoY, delta) {
  const fator =
    1 -
    Math.pow(1 - pet.config.steeringSmoothing, Math.min(delta, 100) / 16.67);
  const velocidadeX = Phaser.Math.Linear(pet.body.velocity.x, alvoX, fator);
  const velocidadeY = Phaser.Math.Linear(pet.body.velocity.y, alvoY, fator);
  pet.setVelocity(velocidadeX, velocidadeY);
  return { x: velocidadeX, y: velocidadeY };
}

function atualizarOlharOcioso(pet, delta) {
  if (!pet.olharAtivo && pet.tempoParado < pet.config.idleLookDelay) {
    pet.anims.play(`companion-pet-walk-${pet.direcaoRepouso}`, true);
    return;
  }

  pet.tempoOlhar -= delta;
  if (!pet.olharAtivo) {
    pet.olharAtivo = true;
    pet.olharEtapa = 0;
    pet.tempoOlhar = pet.config.idleLookDuration;
  } else if (pet.tempoOlhar <= 0) {
    pet.olharEtapa += 1;
    pet.tempoOlhar = pet.config.idleLookDuration;
    if (pet.olharEtapa > 2) {
      pet.olharAtivo = false;
      pet.tempoParado = 0;
      pet.tempoOlhar = 0;
      pet.anims.play(`companion-pet-walk-${pet.direcaoRepouso}`, true);
      return;
    }
  }

  const direcoes = ["right", "left", pet.direcaoRepouso];
  const direcao = direcoes[pet.olharEtapa];
  pet.anims.stop();
  pet.setFrame({ down: 0, left: 13, right: 26, up: 39 }[direcao]);
}

function atualizarAnimacaoCompanionPet(pet, velocidadeX, velocidadeY) {
  const movimento = Math.hypot(velocidadeX, velocidadeY);
  if (movimento > 5) {
    if (Math.abs(velocidadeX) > Math.abs(velocidadeY)) {
      pet.direcaoAtual = velocidadeX < 0 ? "left" : "right";
    } else {
      pet.direcaoAtual = velocidadeY < 0 ? "up" : "down";
    }
    pet.anims.play(`companion-pet-walk-${pet.direcaoAtual}`, true);
    return;
  }

  pet.anims.stop();
  const framesParados = { down: 0, left: 13, right: 26, up: 39 };
  pet.setFrame(framesParados[pet.direcaoAtual]);
}

function atualizarDepthCompanionPet(scene) {
  const pet = scene.companionPet;
  if (!pet?.active) {
    return;
  }
  const footY = pet.body?.bottom ?? pet.getBounds().bottom;
  const depth = scene.calcularDepthMundo
    ? scene.calcularDepthMundo(footY)
    : 12.5 + footY * 0.0003;
  pet.setDepth(depth);
}

export { criarCompanionPet, atualizarCompanionPet, atualizarDepthCompanionPet };
