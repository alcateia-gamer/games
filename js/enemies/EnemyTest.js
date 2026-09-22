// =====================================================
// CRIA INIMIGO
// =====================================================

import mostrarTelaMorte from "../scenes/DeathScreen.js";
import { tomarDano } from "../player/PlayerStatus.js";
import {
  configurarSomPassoRobo,
  atualizarSomPassoRobo,
  tocarSomTiroLaser,
  tocarSomMorteRobo,
} from "../sounds/inimigos.js";

function criarInimigoTeste(scene, config = {}) {
  criarAnimacoesInimigo(scene);

  const x = Number(config.x ?? scene.respawnX + 180);
  const y = Number(config.y ?? scene.respawnY);

  const inimigo = scene.physics.add.sprite(x, y, "robo-teste-normal", 0);

  inimigo.setDepth(12);
  inimigo.setScale(0.23);
  inimigo.setAlpha(1);
  if (inimigo.postFX) {
    inimigo.efeitoCores = inimigo.postFX.addColorMatrix();
    inimigo.efeitoCores.saturate(1.05).contrast(0.28).brightness(1.65);
  }
  inimigo.body.setAllowGravity(false);

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
  inimigo.distanciaAtaque = Number(config.distanciaAtaque ?? 180);
  inimigo.distanciaGrupo = Number(config.distanciaGrupo ?? 180);
  inimigo.danoBase = Number(config.danoLaser ?? 5);
  const direcoes = ["down", "left", "right", "up"];
  const direcaoAleatoria =
    direcoes[Math.floor(Math.random() * direcoes.length)];

  inimigo.direcaoAtual = config.direcaoAtual ?? direcaoAleatoria;

  configurarSomPassoRobo(scene, inimigo);

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

  for (let index = 0; index < quantidadeSolicitada; index += 1) {
    const angulo = (Math.PI * 2 * index) / quantidadeSolicitada;
    const raio = 120 + index * 25;
    const x = centroX + Math.cos(angulo) * raio + (Math.random() - 0.5) * 18;
    const y = centroY + Math.sin(angulo) * raio + (Math.random() - 0.5) * 18;

    const robo = criarInimigoTeste(scene, {
      x,
      y,
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
  const estados = [
    { key: "normal", texture: "robo-teste-normal" },
    { key: "alerta", texture: "robo-teste" },
  ];

  for (const estado of estados) {
    const prefixo = estado.key === "alerta" ? "robo-alerta" : "robo";

    if (!scene.anims.exists(`${prefixo}-down`)) {
      scene.anims.create({
        key: `${prefixo}-down`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          start: 0,
          end: 2,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(`${prefixo}-left`)) {
      scene.anims.create({
        key: `${prefixo}-left`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          start: 3,
          end: 5,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(`${prefixo}-right`)) {
      scene.anims.create({
        key: `${prefixo}-right`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          start: 6,
          end: 8,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(`${prefixo}-up`)) {
      scene.anims.create({
        key: `${prefixo}-up`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          start: 9,
          end: 11,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  const direcoes = [
    { key: "down", start: 0, end: 2 },
    { key: "left", start: 3, end: 5 },
    { key: "right", start: 6, end: 8 },
    { key: "up", start: 9, end: 11 },
  ];

  for (const direcao of direcoes) {
    const chave = `robo-morte-${direcao.key}`;

    if (!scene.anims.exists(chave)) {
      scene.anims.create({
        key: chave,
        frames: [
          { key: "robo-morte", frame: direcao.start, duration: 70 },
          { key: "robo-morte", frame: direcao.start + 1, duration: 90 },
          { key: "robo-morte", frame: direcao.end, duration: 230 },
        ],
        frameRate: 10,
        repeat: 0,
      });
    }
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

  const frenteX =
    inimigo.x + Math.cos(anguloDirecao(inimigo.direcaoAtual)) * 120;
  const frenteY =
    inimigo.y + Math.sin(anguloDirecao(inimigo.direcaoAtual)) * 120;
  const linha = new Phaser.Geom.Line(inimigo.x, inimigo.y, frenteX, frenteY);

  const dot =
    (dx * Math.cos(anguloDirecao(inimigo.direcaoAtual)) +
      dy * Math.sin(anguloDirecao(inimigo.direcaoAtual))) /
    distancia;
  if (dot < 0.2) {
    return false;
  }

  const centroPlayer = {
    x: scene.player.x,
    y: scene.player.y,
  };

  const playerDentroCono =
    Phaser.Math.Distance.Between(
      inimigo.x,
      inimigo.y,
      centroPlayer.x,
      centroPlayer.y,
    ) <= inimigo.distanciaDeteccao;

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

  const blocos = obterFilhosGrupoSeguro(scene.collisionGroup);

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
      distanciaAliado <= inimigoAlvo.distanciaGrupo * 1.5 || origem === "visao";

    if (podeAlerta) {
      aliado.alerta = true;
      aliado.estado = "alerta";

      if (origem === "dano") {
        aliado.foiFerido = true;
      }
    }
  }
}

function obterObstaculosMapa(scene) {
  if (!scene?.collisionGroup?.getChildren) {
    return [];
  }

  const blocos = obterFilhosGrupoSeguro(scene.collisionGroup);
  return blocos.filter((bloco) => bloco && bloco.body);
}

function calcularBoundsInimigoParaPosicao(inimigo, x, y) {
  if (!inimigo || !inimigo.body) {
    return new Phaser.Geom.Rectangle(x - 8, y - 8, 16, 16);
  }

  const largura = inimigo.body.width || 32;
  const altura = inimigo.body.height || 32;
  return new Phaser.Geom.Rectangle(
    x - largura / 2,
    y - altura / 2,
    largura,
    altura,
  );
}

function caminhoDiretoBloqueado(scene, inimigo, alvo) {
  if (!scene || !inimigo || !alvo) {
    return false;
  }

  const blocos = obterObstaculosMapa(scene);
  if (blocos.length === 0) {
    return false;
  }

  const linha = new Phaser.Geom.Line(inimigo.x, inimigo.y, alvo.x, alvo.y);

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    if (Phaser.Geom.Intersects.LineToRectangle(linha, rect)) {
      return true;
    }
  }

  return false;
}

function posicaoLivreParaDesvio(scene, inimigo, x, y) {
  const bounds = calcularBoundsInimigoParaPosicao(inimigo, x, y);
  const blocos = obterObstaculosMapa(scene);

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, rect)) {
      return false;
    }
  }

  return true;
}

function escolherDirecaoDesvio(scene, inimigo, alvo) {
  const deslocamentos = [
    { x: -55, y: 0 },
    { x: 55, y: 0 },
    { x: 0, y: -55 },
    { x: 0, y: 55 },
    { x: -80, y: -30 },
    { x: -80, y: 30 },
    { x: 80, y: -30 },
    { x: 80, y: 30 },
  ];

  let melhor = null;
  let melhorScore = Number.POSITIVE_INFINITY;

  for (const deslocamento of deslocamentos) {
    const xDestino = inimigo.x + deslocamento.x;
    const yDestino = inimigo.y + deslocamento.y;

    if (!posicaoLivreParaDesvio(scene, inimigo, xDestino, yDestino)) {
      continue;
    }

    const distancia = Phaser.Math.Distance.Between(
      xDestino,
      yDestino,
      alvo.x,
      alvo.y,
    );
    const score =
      distancia +
      Math.abs(deslocamento.x) * 0.05 +
      Math.abs(deslocamento.y) * 0.05;

    if (score < melhorScore) {
      melhorScore = score;
      melhor = { x: xDestino, y: yDestino };
    }
  }

  return melhor;
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

  atualizarEstadoVisualRobo(inimigo);

  if (inimigo.alerta || viuPlayer || foiFerido) {
    const linhaBloqueada = caminhoDiretoBloqueado(scene, inimigo, scene.player);
    const rotaAtiva =
      Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 0;

    if (linhaBloqueada || rotaAtiva) {
      const deveUsarRota = linhaBloqueada || rotaAtiva;

      if (deveUsarRota) {
        const rotaValida = atualizarRotaSeguindoInimigo(
          scene,
          inimigo,
          scene.player,
          time,
        );
        if (rotaValida || rotaAtiva) {
          const seguiuRota = seguirRotaAtual(
            scene,
            inimigo,
            scene.player,
            time,
          );
          if (seguiuRota) {
            atualizarDirecaoInimigo(scene, inimigo);
            aplicarSeparacaoGrupo(inimigo, scene);
            atualizarSomPassoRobo(scene, inimigo, viuPlayer, distancia, true);
            tocarAnimacaoInimigo(inimigo);
            desenharDebugRotaInimigo(scene, inimigo);
            if (distancia <= inimigo.distanciaAtaque) {
              inimigo.setVelocity(0, 0);
              pararAnimacaoInimigo(inimigo);
              atualizarSomPassoRobo(
                scene,
                inimigo,
                viuPlayer,
                distancia,
                false,
              );
              tentarDispararLaser(scene, time, inimigo);
            }
            return;
          }
        }
      }
    }

    const raioOrbit =
      120 + inimigo.formacaoIndex * 30 + (inimigo.distanciaGrupo || 180) * 0.2;
    const anguloOrbit =
      time * 0.0015 +
      inimigo.orbitaAngulo +
      inimigo.formacaoIndex * (Math.PI / 2.1);
    const alvoOrbitX = scene.player.x + Math.cos(anguloOrbit) * raioOrbit;
    const alvoOrbitY = scene.player.y + Math.sin(anguloOrbit) * raioOrbit;

    scene.physics.moveTo(
      inimigo,
      alvoOrbitX,
      alvoOrbitY,
      inimigo.velocidade * 1.75,
    );
    atualizarDirecaoInimigo(scene, inimigo);
    aplicarSeparacaoGrupo(inimigo, scene);

    if (distancia <= inimigo.distanciaAtaque) {
      inimigo.setVelocity(0, 0);
      pararAnimacaoInimigo(inimigo);
      atualizarSomPassoRobo(scene, inimigo, viuPlayer, distancia, false);
      tentarDispararLaser(scene, time, inimigo);
    } else {
      atualizarSomPassoRobo(scene, inimigo, viuPlayer, distancia, true);
      tocarAnimacaoInimigo(inimigo);
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
      time * 0.0009 + inimigo.formacaoIndex * (Math.PI / 2.2);

    const patrolX =
      inimigo.patrolCenter.x +
      Math.cos(deslocamento) * (inimigo.distanciaGrupo * 0.7);
    const patrolY =
      inimigo.patrolCenter.y +
      Math.sin(deslocamento) * (inimigo.distanciaGrupo * 0.55);

    if (distPatrulha > 10) {
      scene.physics.moveTo(inimigo, patrolX, patrolY, inimigo.velocidade * 0.7);
      aplicarSeparacaoGrupo(inimigo, scene);
      atualizarSomPassoRobo(scene, inimigo, viuPlayer, distancia, true);
      tocarAnimacaoInimigo(inimigo);
    } else {
      inimigo.setVelocity(0, 0);
      pararAnimacaoInimigo(inimigo);
      atualizarSomPassoRobo(scene, inimigo, viuPlayer, distancia, false);
    }

    return;
  }

  atualizarDirecaoInimigo(scene, inimigo);

  if (distancia <= inimigo.distanciaAtaque) {
    inimigo.setVelocity(0, 0);
    pararAnimacaoInimigo(inimigo);
    atualizarSomPassoRobo(scene, inimigo, viuPlayer, distancia, false);
    tentarDispararLaser(scene, time, inimigo);
    return;
  }

  aplicarSeparacaoGrupo(inimigo, scene);
  scene.physics.moveToObject(inimigo, scene.player, inimigo.velocidade);
  atualizarSomPassoRobo(scene, inimigo, viuPlayer, distancia, true);
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

function atualizarEstadoVisualRobo(inimigo) {
  if (!inimigo) {
    return;
  }

  const emAlerta = Boolean(inimigo.alerta || inimigo.estado === "alerta");
  const novoEstado = emAlerta ? "alerta" : "normal";
  const texturaAlvo = emAlerta ? "robo-teste" : "robo-teste-normal";

  if (
    inimigo.visualAtual === novoEstado &&
    inimigo.texture?.key === texturaAlvo
  ) {
    return;
  }

  inimigo.visualAtual = novoEstado;
  const frameAtual =
    inimigo.anims?.currentFrame?.index ?? inimigo.frame?.name ?? 0;
  inimigo.setTexture(texturaAlvo, frameAtual);
}

function tocarAnimacaoInimigo(inimigo) {
  const animacaoBase =
    inimigo.visualAtual === "alerta" ? "robo-alerta" : "robo";

  if (inimigo.direcaoAtual === "down") {
    inimigo.anims.play(`${animacaoBase}-down`, true);
  } else if (inimigo.direcaoAtual === "left") {
    inimigo.anims.play(`${animacaoBase}-left`, true);
  } else if (inimigo.direcaoAtual === "right") {
    inimigo.anims.play(`${animacaoBase}-right`, true);
  } else if (inimigo.direcaoAtual === "up") {
    inimigo.anims.play(`${animacaoBase}-up`, true);
  }
}

// =====================================================
// PARA ANIMAÇÃO
// =====================================================

function pararAnimacaoInimigo(inimigo) {
  if (inimigo.anims && inimigo.anims.isPlaying) {
    inimigo.anims.stop();
  }

  const frameBase = inimigo.visualAtual === "alerta" ? 0 : 0;

  if (inimigo.direcaoAtual === "down") {
    inimigo.setFrame(frameBase);
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
  if (!scene.lasersInimigo?.add) {
    laser.destroy();
    return;
  }
  scene.lasersInimigo.add(laser);

  tocarSomTiroLaser(scene);

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
  if (
    !scene?.collisionGroup?.getChildren ||
    !scene?.lasersInimigo?.getChildren
  ) {
    return;
  }

  const blocos = obterFilhosGrupoSeguro(scene.collisionGroup);
  const lasers = obterFilhosGrupoSeguro(scene.lasersInimigo);

  if (blocos.length === 0 || lasers.length === 0) {
    return;
  }

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

function obterFilhosGrupoSeguro(grupo) {
  if (!grupo?.getChildren) {
    return [];
  }

  try {
    const filhos = grupo.getChildren();
    return Array.isArray(filhos) ? filhos : [];
  } catch {
    return [];
  }
}

function construirGridNavegacao(scene, inimigo, cellSize = 24) {
  const blocos = obterObstaculosMapa(scene);

  if (!blocos.length) {
    return null;
  }

  const margem = Math.ceil(
    Math.max(inimigo?.body?.width || 30, inimigo?.body?.height || 15) * 0.5 +
      12,
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    minX = Math.min(minX, rect.x - margem);
    maxX = Math.max(maxX, rect.right + margem);
    minY = Math.min(minY, rect.y - margem);
    maxY = Math.max(maxY, rect.bottom + margem);
  }

  const cols = Math.ceil((maxX - minX) / cellSize) + 2;
  const rows = Math.ceil((maxY - minY) / cellSize) + 2;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    const startCol = Math.floor((rect.x - margem - minX) / cellSize);
    const endCol = Math.floor((rect.right + margem - minX) / cellSize);
    const startRow = Math.floor((rect.y - margem - minY) / cellSize);
    const endRow = Math.floor((rect.bottom + margem - minY) / cellSize);

    for (
      let row = Math.max(0, startRow);
      row <= Math.min(rows - 1, endRow);
      row += 1
    ) {
      for (
        let col = Math.max(0, startCol);
        col <= Math.min(cols - 1, endCol);
        col += 1
      ) {
        grid[row][col] = 1;
      }
    }
  }

  return {
    grid,
    cols,
    rows,
    cellSize,
    minX,
    minY,
    margem,
  };
}

function cellParaCoordenada(gridInfo, col, row) {
  return {
    x: gridInfo.minX + col * gridInfo.cellSize + gridInfo.cellSize / 2,
    y: gridInfo.minY + row * gridInfo.cellSize + gridInfo.cellSize / 2,
  };
}

function mundoParaCell(gridInfo, x, y) {
  const col = Math.floor((x - gridInfo.minX) / gridInfo.cellSize);
  const row = Math.floor((y - gridInfo.minY) / gridInfo.cellSize);
  return { col, row };
}

function celulaCaminhavel(gridInfo, col, row) {
  if (!gridInfo) {
    return false;
  }

  if (col < 0 || row < 0 || col >= gridInfo.cols || row >= gridInfo.rows) {
    return false;
  }

  return gridInfo.grid[row]?.[col] !== 1;
}

function heuristica(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function calcularRotaAStar(scene, inimigo, alvo, cellSize = 24) {
  const gridInfo = construirGridNavegacao(scene, inimigo, cellSize);

  if (!gridInfo) {
    return [];
  }

  const startCell = mundoParaCell(gridInfo, inimigo.x, inimigo.y);
  const goalCell = mundoParaCell(gridInfo, alvo.x, alvo.y);

  if (!celulaCaminhavel(gridInfo, startCell.col, startCell.row)) {
    return [];
  }

  if (!celulaCaminhavel(gridInfo, goalCell.col, goalCell.row)) {
    let melhor = null;
    let melhorDistancia = Infinity;

    for (
      let y = Math.max(0, goalCell.row - 2);
      y <= Math.min(gridInfo.rows - 1, goalCell.row + 2);
      y += 1
    ) {
      for (
        let x = Math.max(0, goalCell.col - 2);
        x <= Math.min(gridInfo.cols - 1, goalCell.col + 2);
        x += 1
      ) {
        if (!celulaCaminhavel(gridInfo, x, y)) {
          continue;
        }

        const dist = Math.abs(x - goalCell.col) + Math.abs(y - goalCell.row);
        if (dist < melhorDistancia) {
          melhorDistancia = dist;
          melhor = { col: x, row: y };
        }
      }
    }

    if (!melhor) {
      return [];
    }

    goalCell.col = melhor.col;
    goalCell.row = melhor.row;
  }

  const openSet = [
    {
      x: startCell.col,
      y: startCell.row,
      g: 0,
      f: heuristica(startCell, goalCell),
    },
  ];
  const cameFrom = new Map();
  const gScore = new Map();

  gScore.set(`${startCell.col},${startCell.row}`, 0);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f || a.g - b.g);
    const atual = openSet.shift();
    const atualKey = `${atual.x},${atual.y}`;

    if (atual.x === goalCell.col && atual.y === goalCell.row) {
      const caminho = [];
      let cursor = atualKey;

      while (cursor) {
        const [cx, cy] = cursor.split(",").map(Number);
        caminho.push(cellParaCoordenada(gridInfo, cx, cy));

        if (cameFrom.has(cursor)) {
          cursor = cameFrom.get(cursor);
        } else {
          break;
        }
      }

      caminho.reverse();
      return caminho;
    }

    const vizinhos = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: -1, y: 1 },
    ];

    for (const vizinho of vizinhos) {
      const nx = atual.x + vizinho.x;
      const ny = atual.y + vizinho.y;

      if (!celulaCaminhavel(gridInfo, nx, ny)) {
        continue;
      }

      const vizinhoKey = `${nx},${ny}`;
      const custo = Math.abs(vizinho.x) + Math.abs(vizinho.y) === 2 ? 1.4 : 1;
      const tentativeG = (gScore.get(atualKey) ?? Infinity) + custo;

      if ((gScore.get(vizinhoKey) ?? Infinity) <= tentativeG) {
        continue;
      }

      cameFrom.set(vizinhoKey, atualKey);
      gScore.set(vizinhoKey, tentativeG);
      openSet.push({
        x: nx,
        y: ny,
        g: tentativeG,
        f: tentativeG + heuristica({ x: nx, y: ny }, goalCell),
      });
    }
  }

  return [];
}

function gerarRotaParaJogador(scene, inimigo, alvo) {
  const rota = calcularRotaAStar(scene, inimigo, alvo);

  if (!Array.isArray(rota) || rota.length < 2) {
    return [];
  }

  const rotaSuavizada = [rota[0]];
  for (let index = 1; index < rota.length - 1; index += 1) {
    const pontoAtual = rota[index];
    const pontoAnterior = rotaSuavizada[rotaSuavizada.length - 1];
    const pontoProximo = rota[index + 1];

    const distanciaAnterior = Phaser.Math.Distance.Between(
      pontoAnterior.x,
      pontoAnterior.y,
      pontoAtual.x,
      pontoAtual.y,
    );
    const distanciaProxima = Phaser.Math.Distance.Between(
      pontoAtual.x,
      pontoAtual.y,
      pontoProximo.x,
      pontoProximo.y,
    );

    if (distanciaAnterior < 18 && distanciaProxima < 18) {
      continue;
    }

    rotaSuavizada.push(pontoAtual);
  }

  if (
    rotaSuavizada[rotaSuavizada.length - 1] !== rota[rota.length - 1] &&
    rota.length > 0
  ) {
    rotaSuavizada.push(rota[rota.length - 1]);
  }

  return rotaSuavizada;
}

function atualizarRotaSeguindoInimigo(scene, inimigo, alvo, time) {
  if (!scene || !inimigo || !alvo) {
    return false;
  }

  const caminhoDiretoObstruido = caminhoDiretoBloqueado(scene, inimigo, alvo);
  if (
    !caminhoDiretoObstruido &&
    Array.isArray(inimigo.rotaAtual) &&
    inimigo.rotaAtual.length > 0
  ) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    return false;
  }

  const precisaRecalcular =
    !Array.isArray(inimigo.rotaAtual) ||
    inimigo.rotaAtual.length === 0 ||
    time > (inimigo.ultimoCalculoRota || 0) + 1200 ||
    (inimigo.ultimaPosicaoRota &&
      Phaser.Math.Distance.Between(
        inimigo.ultimaPosicaoRota.x,
        inimigo.ultimaPosicaoRota.y,
        inimigo.x,
        inimigo.y,
      ) < 8 &&
      time > (inimigo.tempoPreso || 0) + 1600);

  if (
    !caminhoDiretoObstruido &&
    !(Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 0)
  ) {
    return false;
  }

  if (
    !precisaRecalcular &&
    Array.isArray(inimigo.rotaAtual) &&
    inimigo.rotaAtual.length > 0
  ) {
    return true;
  }

  const rota = gerarRotaParaJogador(scene, inimigo, alvo);
  if (!Array.isArray(rota) || rota.length < 2) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    inimigo.ultimoCalculoRota = time;
    return false;
  }

  inimigo.rotaAtual = rota;
  inimigo.indiceRota = 0;
  inimigo.ultimoCalculoRota = time;
  inimigo.ultimaPosicaoRota = { x: inimigo.x, y: inimigo.y };
  inimigo.tempoPreso = time;
  return true;
}

function seguirRotaAtual(scene, inimigo, alvo, time) {
  if (!Array.isArray(inimigo.rotaAtual) || inimigo.rotaAtual.length === 0) {
    return false;
  }

  const alvoRota =
    inimigo.rotaAtual[inimigo.indiceRota] ||
    inimigo.rotaAtual[inimigo.rotaAtual.length - 1];

  if (!alvoRota) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    return false;
  }

  const dist = Phaser.Math.Distance.Between(
    inimigo.x,
    inimigo.y,
    alvoRota.x,
    alvoRota.y,
  );

  if (dist <= 16) {
    inimigo.indiceRota += 1;
    inimigo.ultimaPosicaoRota = { x: inimigo.x, y: inimigo.y };
    inimigo.tempoPreso = time;

    if (inimigo.indiceRota >= inimigo.rotaAtual.length) {
      inimigo.rotaAtual = [];
      inimigo.indiceRota = 0;
      return false;
    }

    return true;
  }

  scene.physics.moveTo(
    inimigo,
    alvoRota.x,
    alvoRota.y,
    inimigo.velocidade * 1.75,
  );
  atualizarDirecaoInimigo(scene, inimigo);
  return true;
}

function desenharDebugRotaInimigo(scene, inimigo) {
  if (!scene || !inimigo || !scene.debugRotaRobos) {
    return;
  }

  if (!scene.debugRotaGraphics) {
    scene.debugRotaGraphics = scene.add.graphics();
    scene.debugRotaGraphics.setDepth(200);
  }

  scene.debugRotaGraphics.clear();
  scene.debugRotaGraphics.lineStyle(2, 0xffcc00, 1);

  if (Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 1) {
    for (let index = 0; index < inimigo.rotaAtual.length - 1; index += 1) {
      const pontoAtual = inimigo.rotaAtual[index];
      const proximo = inimigo.rotaAtual[index + 1];
      scene.debugRotaGraphics.lineBetween(
        pontoAtual.x,
        pontoAtual.y,
        proximo.x,
        proximo.y,
      );
    }
  }

  if (Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 0) {
    const waypointAtual =
      inimigo.rotaAtual[
        Math.min(inimigo.indiceRota, inimigo.rotaAtual.length - 1)
      ];
    scene.debugRotaGraphics.fillStyle(0x00ff00, 1);
    scene.debugRotaGraphics.fillCircle(waypointAtual.x, waypointAtual.y, 4);
  }

  scene.debugRotaGraphics.fillStyle(0xff0000, 1);
  scene.debugRotaGraphics.fillCircle(inimigo.x, inimigo.y, 3);
}

function verificarLasersNoPlayer(scene) {
  if (!scene.hitboxDanoPlayer || !scene.lasersInimigo) {
    return;
  }

  const lasers = obterFilhosGrupoSeguro(scene.lasersInimigo);

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

  if (scene.morteEmAndamento) {
    laser.destroy();
    return;
  }

  laser.destroy();

  if (scene.player.invulneravel) {
    return;
  }

  scene.player.invulneravel = true;

  const danoLaser =
    Array.isArray(scene.inimigos) && scene.inimigos.length > 0
      ? scene.inimigos[0].danoLaser
      : (scene.inimigoTeste?.danoLaser ?? 5);

  tomarDano(scene, danoLaser);

  scene.player.setTint(0xff5555);

  scene.time.delayedCall(500, () => {
    if (scene.player && scene.player.active) {
      scene.player.invulneravel = false;
      scene.player.clearTint();
    }
  });

  if (scene.vida <= 0) {
    mostrarTelaMorte(scene);
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
      : (quantidadeOpcional ?? 25);

  if (!alvo || !alvo.active || alvo.morto) {
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
  if (!inimigo || !scene || inimigo.morto) {
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

export {
  criarInimigoTeste,
  criarRobos,
  atualizarInimigoTeste,
  causarDanoInimigo,
  limparGrupoRobos,
};
