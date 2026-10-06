import { atualizarSomPassoRobo } from "../sounds/inimigos.js";
import {
  atualizarEstadoVisualRobo,
  tocarAnimacaoInimigo,
  tocarAnimacaoAtaqueInimigo,
  pararAnimacaoInimigo,
} from "./EnemyAnimations.js";
import {
  obterFilhosGrupoSeguro,
  caminhoDiretoBloqueado,
  atualizarRotaSeguindoInimigo,
  seguirRotaAtual,
  desenharDebugRotaInimigo,
} from "./EnemyPathfinding.js";
import { causarDanoPlayer, tentarDispararLaser } from "./EnemyLaser.js";

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

function obterAlvoInimigo(scene, inimigo) {
  const alvoRemoto = scene.multiplayerManager?.room?.players?.find(
    (player) => player.id === inimigo.alvoPlayerId,
  );
  if (alvoRemoto) {
    return { ...alvoRemoto, active: true };
  }
  return scene.player;
}

// =====================================================
// CRIA ANIMAÇÕES
// =====================================================

function temVisaoDoPlayer(scene, inimigo) {
  const alvo = obterAlvoInimigo(scene, inimigo);
  if (!alvo || alvo.active === false || !inimigo || !inimigo.active) {
    return false;
  }

  const dx = alvo.x - inimigo.x;
  const dy = alvo.y - inimigo.y;
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
    x: alvo.x,
    y: alvo.y,
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
    alvo.x,
    alvo.y,
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

function tentarAtaqueSerra(scene, time, inimigo, distancia) {
  if (
    inimigo.tipoRobo !== "serra" ||
    distancia > inimigo.distanciaAtaque ||
    caminhoDiretoBloqueado(scene, inimigo, scene.player)
  ) {
    return false;
  }

  inimigo.setVelocity(0, 0);
  atualizarDirecaoInimigo(scene, inimigo);
  atualizarSomPassoRobo(scene, inimigo, true, distancia, false);

  if (time >= inimigo.ultimoAtaque + inimigo.tempoEntreAtaques) {
    inimigo.ultimoAtaque = time;
    tocarAnimacaoAtaqueInimigo(inimigo);
    causarDanoPlayer(scene, inimigo.danoContato);
  } else if (inimigo.estado !== "atacando" || !inimigo.anims.isPlaying) {
    pararAnimacaoInimigo(inimigo);
  }

  return true;
}

function perseguirComSerra(scene, inimigo, time, distancia) {
  if (tentarAtaqueSerra(scene, time, inimigo, distancia)) {
    return;
  }

  const linhaBloqueada = caminhoDiretoBloqueado(scene, inimigo, scene.player);
  if (linhaBloqueada) {
    const rotaValida = atualizarRotaSeguindoInimigo(
      scene,
      inimigo,
      scene.player,
      time,
    );
    if (
      (rotaValida || inimigo.rotaAtual?.length > 0) &&
      seguirRotaAtual(
        scene,
        inimigo,
        scene.player,
        time,
        atualizarDirecaoInimigo,
      )
    ) {
      atualizarDirecaoInimigo(scene, inimigo);
      atualizarSomPassoRobo(scene, inimigo, true, distancia, true);
      tocarAnimacaoInimigo(inimigo);
      desenharDebugRotaInimigo(scene, inimigo);
      return;
    }
  }

  inimigo.rotaAtual = [];
  inimigo.indiceRota = 0;
  scene.physics.moveToObject(inimigo, scene.player, inimigo.velocidade);
  atualizarDirecaoInimigo(scene, inimigo);
  atualizarSomPassoRobo(scene, inimigo, true, distancia, true);
  tocarAnimacaoInimigo(inimigo);
}

function atualizarIAInimigo(scene, time, inimigo = scene.inimigoTeste) {
  const alvo = obterAlvoInimigo(scene, inimigo);
  if (!alvo || alvo.active === false || !inimigo || !inimigo.active) {
    return;
  }

  if (
    scene.multiplayer !== true &&
    inimigo.combatKnockbackUntil > time
  ) {
    return;
  }

  inimigo.alvoAtual = alvo;

  const distancia = Phaser.Math.Distance.Between(
    inimigo.x,
    inimigo.y,
    alvo.x,
    alvo.y,
  );

  const viuPlayer = temVisaoDoPlayer(scene, inimigo);
  const foiFerido = inimigo.foiFerido && inimigo.vida < inimigo.vidaMaxima;

  if (viuPlayer) {
    notificarGrupo(scene, inimigo, "visao");
  }

  if (foiFerido || inimigo.alerta || viuPlayer) {
    inimigo.alerta = true;
    if (inimigo.estado !== "atacando" || !inimigo.anims.isPlaying) {
      inimigo.estado = "alerta";
    }
  }

  atualizarEstadoVisualRobo(inimigo);

  if (inimigo.tipoRobo === "serra") {
    perseguirComSerra(scene, inimigo, time, distancia);
    return;
  }

  if (inimigo.alerta || viuPlayer || foiFerido) {
    const linhaBloqueada = caminhoDiretoBloqueado(scene, inimigo, alvo);
    const rotaAtiva =
      Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 0;

    if (linhaBloqueada || rotaAtiva) {
      const deveUsarRota = linhaBloqueada || rotaAtiva;

      if (deveUsarRota) {
        const rotaValida = atualizarRotaSeguindoInimigo(
          scene,
          inimigo,
          alvo,
          time,
        );
        if (rotaValida || rotaAtiva) {
          const seguiuRota = seguirRotaAtual(
            scene,
            inimigo,
            alvo,
            time,
            atualizarDirecaoInimigo,
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
    const alvoOrbitX = alvo.x + Math.cos(anguloOrbit) * raioOrbit;
    const alvoOrbitY = alvo.y + Math.sin(anguloOrbit) * raioOrbit;

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
  scene.physics.moveToObject(inimigo, alvo, inimigo.velocidade);
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

  const alvo = obterAlvoInimigo(scene, inimigo);
  const diferencaX = alvo.x - inimigo.x;
  const diferencaY = alvo.y - inimigo.y;

  if (Math.abs(diferencaX) > Math.abs(diferencaY)) {
    inimigo.direcaoAtual = diferencaX < 0 ? "left" : "right";
  } else {
    inimigo.direcaoAtual = diferencaY < 0 ? "up" : "down";
  }
}

// =====================================================
// TOCA ANIMAÇÃO
// =====================================================

export { atualizarIAInimigo, notificarGrupo };
