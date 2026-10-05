import { configurarSomPassoRobo } from "../sounds/inimigos.js";
import {
  criarAnimacoesInimigo,
  atualizarEstadoVisualRobo,
} from "./EnemyAnimations.js";
import { atualizarIAInimigo } from "./EnemyAI.js";
import {
  verificarLasersNoMapa,
  verificarLasersNoPlayer,
} from "./EnemyLaser.js";

function criarInimigoTeste(scene, config = {}) {
  criarAnimacoesInimigo(scene);

  const x = Number(config.x ?? scene.respawnX + 180);
  const y = Number(config.y ?? scene.respawnY);

  const tipoRobo = config.tipoRobo === "serra" ? "serra" : "padrao";
  const textura = tipoRobo === "serra" ? "robo-serra" : "robo-teste-normal";

  const inimigo = scene.physics.add.sprite(x, y, textura, 0);

  inimigo.networkId = config.networkId || null;
  inimigo.remoteOnly = Boolean(config.remoteOnly);

  inimigo.setDepth(12);
  inimigo.setScale(tipoRobo === "serra" ? 0.36 : 0.23);
  inimigo.setAlpha(1);
  if (tipoRobo === "padrao" && inimigo.postFX) {
    inimigo.efeitoCores = inimigo.postFX.addColorMatrix();
    inimigo.efeitoCores.saturate(1.05).contrast(0.28).brightness(1.65);
  }
  inimigo.body.setAllowGravity(false);

  inimigo.tipoRobo = tipoRobo;
  inimigo.visualAtual = "normal";
  atualizarEstadoVisualRobo(inimigo);

  // Mantém a mesma área física do robô antigo e reposiciona a hitbox para o
  // novo sprite maior sem alterar a lógica do inimigo.
  configurarHitboxPeInimigo(inimigo);

  inimigo.formacaoIndex = Number(config.formacaoIndex ?? 0);
  inimigo.patrolCenter = {
    x: Number(config.x ?? x),
    y: Number(config.y ?? y),
  };
  inimigo.tempoPatrulha = Number(config.tempoPatrulha ?? 1500);
  inimigo.ultimoMovimentoPatrulha = 0;

  inimigo.hitboxDano = new Phaser.Geom.Rectangle(x - 32, y - 44, 64, 96);

  inimigo.debugHitboxDano = scene.add.graphics();
  inimigo.debugHitboxDano.setDepth(200);
  inimigo.debugHitboxDano.setVisible(
    Boolean(scene.game?.config?.physics?.arcade?.debug),
  );

  inimigo.velocidade = Number(config.velocidade ?? 50);
  inimigo.orbitaAngulo = Math.random() * Math.PI * 2;
  inimigo.distanciaDeteccao = Number(config.distanciaDeteccao ?? 550);
  inimigo.distanciaAtaque = Number(
    config.distanciaAtaque ?? (tipoRobo === "serra" ? 68 : 180),
  );
  inimigo.distanciaGrupo = Number(config.distanciaGrupo ?? 180);
  inimigo.danoBase = Number(config.danoLaser ?? 5);
  const direcoes = ["down", "left", "right", "up"];
  const direcaoAleatoria =
    direcoes[Math.floor(Math.random() * direcoes.length)];

  inimigo.direcaoAtual = config.direcaoAtual ?? direcaoAleatoria;

  if (!inimigo.remoteOnly) {
    configurarSomPassoRobo(scene, inimigo);
  }

  inimigo.tempoEntreTiros = Number(config.tempoEntreTiros ?? 720);
  inimigo.ultimoTiro = 0;
  inimigo.velocidadeLaser = Number(config.velocidadeLaser ?? 250);
  inimigo.danoLaser = inimigo.danoBase * 1.3 * 0.8;
  inimigo.ultimoLadoTiro = Math.random() > 0.5 ? "right" : "left";

  inimigo.vidaMaxima = Number(config.vidaMaxima ?? 100);
  inimigo.vida = inimigo.vidaMaxima;
  inimigo.tempoEntreAtaques = Number(config.tempoEntreAtaques ?? 1000);
  inimigo.ultimoAtaque = Number.NEGATIVE_INFINITY;
  inimigo.danoContato = Number(config.danoContato ?? 12);

  inimigo.alerta = false;
  inimigo.foiFerido = false;
  inimigo.estado = "idle";
  inimigo.desvioAtivo = false;
  inimigo.desvioDirecao = null;
  inimigo.rotaAtual = [];
  inimigo.indiceRota = 0;
  inimigo.ultimoCalculoRota = 0;
  inimigo.ultimaPosicaoRota = null;
  inimigo.tempoPreso = 0;

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

function criarRoboSerra(scene) {
  if (!scene?.player?.active) {
    return null;
  }

  const roboExistente = scene.inimigos?.find(
    (inimigo) =>
      inimigo?.tipoRobo === "serra" && inimigo.active && !inimigo.morto,
  );
  if (roboExistente) {
    return roboExistente;
  }

  const angulo = Math.random() * Math.PI * 2;
  const robo = criarInimigoTeste(scene, {
    tipoRobo: "serra",
    x: scene.player.x + Math.cos(angulo) * 140,
    y: scene.player.y + Math.sin(angulo) * 140,
    velocidade: 62,
    distanciaDeteccao: 600,
    distanciaAtaque: 68,
    distanciaGrupo: 180,
    vidaMaxima: 120,
    danoContato: 12,
    tempoEntreAtaques: 1000,
  });
  robo.alerta = true;
  robo.estado = "alerta";

  if (scene.collisionGroup) {
    scene.physics.add.collider(robo, scene.collisionGroup);
  }

  return robo;
}

function limparGrupoRobos(scene) {
  if (!scene) {
    return;
  }

  if (scene.lasersInimigo) {
    if (scene.lasersInimigo.clear) {
      scene.lasersInimigo.clear(true, true);
    }
    if (scene.lasersInimigo.destroy) {
      scene.lasersInimigo.destroy(true);
    }
    scene.lasersInimigo = null;
  }

  if (!Array.isArray(scene.inimigos)) {
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

    if (robo.somPassoRobo) {
      robo.somPassoRobo.stop();
      robo.somPassoRobo.destroy();
      robo.somPassoRobo = null;
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

function criarRobos(
  scene,
  quantidade = 1,
  centroX = scene.player?.x ?? scene.respawnX,
  centroY = scene.player?.y ?? scene.respawnY,
) {
  if (!scene) {
    return [];
  }

  if (!Array.isArray(scene.inimigos)) {
    scene.inimigos = [];
  }

  const quantidadeSolicitada = Phaser.Math.Clamp(
    Math.floor(Number(quantidade) || 1),
    1,
    3,
  );
  const robosExistentes = scene.inimigos.length;
  const robosCriados = [];
  scene.networkEnemyId = (scene.networkEnemyId || 0) + 1;

  for (let index = 0; index < quantidadeSolicitada; index += 1) {
    const angulo = (Math.PI * 2 * index) / quantidadeSolicitada;
    const raio = 120 + index * 25;
    const x = centroX + Math.cos(angulo) * raio + (Math.random() - 0.5) * 18;
    const y = centroY + Math.sin(angulo) * raio + (Math.random() - 0.5) * 18;

    const robo = criarInimigoTeste(scene, {
      x,
      y,
      networkId: `${scene.multiplayerManager?.playerId || "local"}-enemy-${scene.networkEnemyId}-${robosExistentes + index}`,
      formacaoIndex: robosExistentes + index,
      velocidade: 50,
      distanciaDeteccao: 550,
      distanciaAtaque: 180,
      distanciaGrupo: 220,
      tempoEntreTiros: 680 - index * 40,
      tempoPatrulha: 1200 + index * 120,
      direcaoAtual: ["down", "left", "right", "up"][
        Math.floor(Math.random() * 4)
      ],
    });
    robosCriados.push(robo);
  }

  if (scene.physics && robosCriados.length > 0) {
    const aliadosExistentes = scene.inimigos.slice(0, robosExistentes);

    for (let index = 0; index < robosCriados.length; index += 1) {
      const robo = robosCriados[index];

      for (const aliado of aliadosExistentes) {
        scene.physics.add.collider(robo, aliado);
      }

      for (let aliadoIndex = 0; aliadoIndex < index; aliadoIndex += 1) {
        scene.physics.add.collider(robo, robosCriados[aliadoIndex]);
      }
    }

    if (scene.collisionGroup) {
      for (const robo of robosCriados) {
        scene.physics.add.collider(robo, scene.collisionGroup);
      }
    }
  }

  return scene.inimigos;
}

function configurarHitboxPeInimigo(inimigo) {
  if (!inimigo || !inimigo.body) {
    return;
  }

  // Physics body pequeno na base do robô: o corpo visual continua grande, mas a
  // colisão com cenário acontece somente na região dos pés.
  if (inimigo.tipoRobo === "serra") {
    inimigo.body.setSize(190, 100);
    inimigo.body.setOffset(44, 160);
    return;
  }

  inimigo.body.setSize(180, 110);
  inimigo.body.setOffset(65, 270);
}

function atualizarHitboxDanoInimigo(inimigo) {
  if (!inimigo || !inimigo.body) {
    return;
  }

  const largura = 80;
  const altura = 120;
  const offsetX = inimigo.x - largura / 2 + 12 - 8;
  const offsetY = inimigo.y - altura / 2 + 6;

  if (
    !inimigo.hitboxDano ||
    !(inimigo.hitboxDano instanceof Phaser.Geom.Rectangle)
  ) {
    inimigo.hitboxDano = new Phaser.Geom.Rectangle(
      offsetX,
      offsetY,
      largura,
      altura,
    );
    return;
  }

  inimigo.hitboxDano.setTo(offsetX, offsetY, largura, altura);

  if (inimigo.debugHitboxDano) {
    inimigo.debugHitboxDano.clear();
    inimigo.debugHitboxDano.lineStyle(2, 0x00ff00, 1);
    inimigo.debugHitboxDano.fillStyle(0x00ff00, 0.18);
    inimigo.debugHitboxDano.fillRectShape(inimigo.hitboxDano);
    inimigo.debugHitboxDano.strokeRectShape(inimigo.hitboxDano);
    inimigo.debugHitboxDano.setVisible(
      Boolean(inimigo.scene?.game?.config?.physics?.arcade?.debug),
    );
  }
}

function atualizarDepthInimigo(inimigo, scene) {
  if (!inimigo || !scene || !scene.player || !scene.player.active) {
    return;
  }

  const inimigoFootY = inimigo.body?.bottom ?? inimigo.getBounds().bottom;
  const calcularDepth =
    scene.calcularDepthMundo || ((worldY) => 12.5 + worldY * 0.0003);

  // O player é ordenado pela cena; este sistema só atualiza o inimigo.
  inimigo.setDepth(calcularDepth(inimigoFootY));
}

function atualizarInimigoTeste(scene, time) {
  if (!Array.isArray(scene.inimigos) || scene.inimigos.length === 0) {
    return;
  }

  for (const inimigo of scene.inimigos) {
    if (!inimigo || !inimigo.active) {
      continue;
    }

    if (!inimigo.remoteOnly) {
      atualizarIAInimigo(scene, time, inimigo);
    }
    atualizarHitboxDanoInimigo(inimigo);
    atualizarDepthInimigo(inimigo, scene);

    const x = inimigo.x;
    const y = inimigo.y - 65;

    if (inimigo.fundoVida?.active) {
      inimigo.fundoVida.setPosition(x, y);
    }
    if (inimigo.barraVida?.active) {
      inimigo.barraVida.setPosition(x - 30, y);
    }
    if (inimigo.bordaVida?.active) {
      inimigo.bordaVida.setPosition(x, y);
    }

    if (inimigo.debugHitboxDano) {
      inimigo.debugHitboxDano.setVisible(
        Boolean(inimigo.scene?.game?.config?.physics?.arcade?.debug),
      );
    }

    if (inimigo.barraVida?.active) {
      const porcentagemVida = inimigo.vida / inimigo.vidaMaxima;
      inimigo.barraVida.width = inimigo.larguraBarra * porcentagemVida;
    }
  }

  verificarLasersNoMapa(scene);
  verificarLasersNoPlayer(scene);
}

// =====================================================
// IA DO INIMIGO
// =====================================================

export {
  criarInimigoTeste,
  criarRobos,
  criarRoboSerra,
  atualizarInimigoTeste,
  limparGrupoRobos,
};
export { causarDanoInimigo } from "./EnemyHealth.js";
