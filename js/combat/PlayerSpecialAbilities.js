/**
 * Sistema de habilidades especiais dos personagens.
 * Primeira implementação: modo solo.
 */

import { causarDanoInimigo } from "../enemies/EnemyHealth.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";
import {
  caminhoDiretoBloqueado,
  caminhoMovimentoBloqueado,
} from "../enemies/EnemyPathfinding.js";

const ESPECIAIS = Object.freeze({
  "kai-mercer": { cooldown: 2000, cor: 0x38bdf8 },
  "magnus-force": { cooldown: 8000, cor: 0xfb923c },
  "aria-kade": { cooldown: 12000, cor: 0xf472b6 },
  nyx: { cooldown: 5000, cor: 0xa78bfa },
});

const DIRECOES = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function direcaoJogador(scene) {
  return DIRECOES[scene.direcaoAtual] || DIRECOES.down;
}

function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dentroDoCone(scene, x, y, alcance, cosMin = 0.1) {
  const player = scene.player;
  const dx = x - player.x;
  const dy = y - player.y;
  const d = Math.hypot(dx, dy);

  if (d > alcance) return false;
  if (d < 0.001) return true;

  const frente = direcaoJogador(scene);

  return (dx * frente.x + dy * frente.y) / d >= cosMin;
}

function pontoMaisProximo(rect, x, y) {
  return {
    x: Phaser.Math.Clamp(x, rect.left, rect.right),
    y: Phaser.Math.Clamp(y, rect.top, rect.bottom),
  };
}

function alvosComuns(scene) {
  return (scene.inimigos || []).filter(
    (robo) => robo?.active && !robo.morto && robo.hitboxDano,
  );
}

function obterAlvos(scene) {
  const alvos = alvosComuns(scene);

  if (
    scene.bossFinal?.active &&
    !scene.bossFinal.morto &&
    scene.bossFinal.hitboxDano
  ) {
    alvos.push(scene.bossFinal);
  }

  return alvos;
}

function darDano(scene, alvo, quantidade, area = null) {
  if (alvo === scene.bossFinal) {
    // O boss continua usando suas zonas verdes de dano.
    return causarDanoBoss(scene, quantidade, area);
  }

  causarDanoInimigo(scene, alvo, quantidade, {
    playSound: true,
  });

  return true;
}

// =====================================================
// EFEITO VISUAL COMPARTILHADO
// =====================================================

function circular(scene, x, y, raio, cor, duracao = 260) {
  const anel = scene.add
    .circle(x, y, raio, cor, 0.07)
    .setStrokeStyle(3, cor, 0.95)
    .setDepth((scene.player?.depth || 50) + 0.05);

  scene.tweens.add({
    targets: anel,
    scale: 1.45,
    alpha: 0,
    duration: duracao,
    onComplete: () => anel.destroy(),
  });
}

// =====================================================
// KAI - PARRY
// =====================================================

function criarParry(scene, estado, agora) {
  // 150 ms de parry perfeito.
  // 270 ms de bloqueio total.

  estado.parryAte = agora + 270;
  estado.parryPerfeitoAte = agora + 150;

  circular(scene, scene.player.x, scene.player.y - 5, 29, 0x38bdf8, 250);
}

// =====================================================
// MAGNUS - ONDA DE CHOQUE
// =====================================================

function iniciarOnda(scene, estado, agora) {
  estado.onda = {
    x: scene.player.x,
    y: scene.player.y,
    inicio: agora,
    duracao: 390,
    raio: 110,
    raioAtual: 0,
    atingidos: new Set(),

    grafico: scene.add.graphics().setDepth((scene.player?.depth || 50) - 0.02),
  };
}

function atualizarOnda(scene, estado, agora) {
  const onda = estado.onda;
  if (!onda) return;

  const progresso = Phaser.Math.Clamp(
    (agora - onda.inicio) / onda.duracao,
    0,
    1,
  );

  onda.raioAtual = onda.raio * progresso;

  // Dois anéis laranja de energia.
  onda.grafico
    .clear()
    .lineStyle(5, 0xfb923c, 0.95 * (1 - progresso))
    .strokeCircle(onda.x, onda.y, onda.raioAtual)
    .lineStyle(2, 0xffe0a6, 0.8 * (1 - progresso))
    .strokeCircle(onda.x, onda.y, Math.max(0, onda.raioAtual - 9));

  for (const alvo of obterAlvos(scene)) {
    if (onda.atingidos.has(alvo)) continue;

    const ponto = pontoMaisProximo(alvo.hitboxDano, onda.x, onda.y);

    if (
      distancia(ponto, onda) > onda.raioAtual ||
      caminhoDiretoBloqueado(scene, onda, ponto)
    ) {
      continue;
    }

    onda.atingidos.add(alvo);

    // Boss não é empurrado.
    if (alvo === scene.bossFinal) {
      darDano(
        scene,
        alvo,
        8,
        new Phaser.Geom.Rectangle(
          onda.x - onda.raioAtual,
          onda.y - onda.raioAtual,
          onda.raioAtual * 2,
          onda.raioAtual * 2,
        ),
      );
      continue;
    }

    darDano(scene, alvo, 18);

    if (!alvo.active || alvo.morto) continue;

    const dx = alvo.x - onda.x;
    const dy = alvo.y - onda.y;
    const mag = Math.max(1, Math.hypot(dx, dy));

    // Empurrão utilizando a física existente.
    alvo.setVelocity((dx / mag) * 240, (dy / mag) * 240);

    alvo.especialEmpurraoAte = agora + 200;
    alvo.especialAtordoadoAte = agora + 650;
  }

  // Destruir lasers alcançados pela onda.
  for (const laser of scene.lasersInimigo?.getChildren?.() || []) {
    if (
      laser?.active &&
      !laser.especialRefletido &&
      distancia(laser, onda) < onda.raioAtual &&
      !caminhoDiretoBloqueado(scene, onda, laser)
    ) {
      laser.destroy();
    }
  }

  if (progresso >= 1) {
    onda.grafico.destroy();
    estado.onda = null;
  }
}

// =====================================================
// ARIA - HOLOGRAMA
// =====================================================

function destruirHolograma(scene, estado, emitirPulso = true) {
  const holograma = estado.holograma;
  if (!holograma) return;

  estado.holograma = null;

  if (!holograma.active) return;

  const { x, y } = holograma;

  scene.tweens.killTweensOf(holograma);
  holograma.destroy();

  if (!emitirPulso) return;

  // Pulso de desorientação ao desaparecer.
  circular(scene, x, y, 30, 0xf472b6, 350);

  const agora = scene.time.now;

  for (const robo of alvosComuns(scene)) {
    if (distancia(robo, { x, y }) < 76) {
      robo.especialAtordoadoAte = Math.max(
        robo.especialAtordoadoAte || 0,
        agora + 350,
      );
    }
  }
}

function invocarHolograma(scene, estado, agora) {
  const player = scene.player;
  const frente = direcaoJogador(scene);

  // Encontrar uma posição livre à frente.
  let destino = null;

  for (const d of [112, 84, 56, 28]) {
    const ponto = {
      x: player.x + frente.x * d,
      y: player.y + frente.y * d,
    };

    if (!caminhoMovimentoBloqueado(scene, player, ponto)) {
      destino = ponto;
      break;
    }
  }

  if (!destino) {
    destino = { x: player.x, y: player.y };
  }

  // Copiar o visual atual da Aria.
  const holograma = scene.add
    .image(destino.x, destino.y, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY)
    .setDisplaySize(player.displayWidth, player.displayHeight)
    .setFlip(player.flipX, player.flipY)
    .setTint(0xff9bd5)
    .setAlpha(0.63)
    .setDepth(player.depth - 0.01);

  holograma.especialHolograma = true;
  holograma.integridade = 2;
  holograma.expiraEm = agora + 4500;

  estado.holograma = holograma;

  // Efeito de oscilação holográfica.
  scene.tweens.add({
    targets: holograma,
    alpha: 0.33,
    duration: 360,
    yoyo: true,
    repeat: -1,
  });

  circular(scene, destino.x, destino.y, 24, 0xf472b6, 350);
}

function trocarComHolograma(scene, estado) {
  const holograma = estado.holograma;

  if (!holograma?.active || holograma.expiraEm <= scene.time.now) {
    return false;
  }

  const player = scene.player;

  const destino = {
    x: holograma.x,
    y: holograma.y,
  };

  // Não permitir teleporte para dentro de obstáculos.
  if (
    distancia(player, destino) > 170 ||
    caminhoMovimentoBloqueado(scene, player, destino)
  ) {
    return false;
  }

  const origem = {
    x: player.x,
    y: player.y,
  };

  player.setPosition(destino.x, destino.y);
  player.setVelocity(0, 0);
  player.body?.updateFromGameObject();

  // Sincronizar hitbox de recebimento de dano.
  if (scene.hitboxDanoPlayer?.setTo) {
    scene.hitboxDanoPlayer.setTo(destino.x - 19, destino.y - 20, 38, 46);
  }

  circular(scene, origem.x, origem.y, 24, 0xf472b6, 280);

  circular(scene, destino.x, destino.y, 24, 0xf472b6, 280);

  destruirHolograma(scene, estado, false);

  return true;
}

// =====================================================
// NYX - CORTE DE RUPTURA
// =====================================================

function iniciarCorteNyx(scene, estado, agora) {
  estado.corteAte = agora + 240;
  estado.corteAtingidos = new Set();

  const frente = direcaoJogador(scene);

  const anguloInicial = {
    right: -65,
    down: 25,
    left: 115,
    up: 205,
  };

  const anguloFinal = {
    right: 65,
    down: 155,
    left: 245,
    up: 335,
  };

  // Efeito gráfico do corte.
  const arco = scene.add
    .arc(
      scene.player.x + frente.x * 28,
      scene.player.y + frente.y * 28,
      58,
      anguloInicial[scene.direcaoAtual] ?? 25,
      anguloFinal[scene.direcaoAtual] ?? 155,
      false,
      0xa78bfa,
      0.21,
    )
    .setStrokeStyle(4, 0xd9bdff, 0.9)
    .setDepth((scene.player.depth || 50) + 0.1);

  scene.tweens.add({
    targets: arco,
    alpha: 0,
    duration: 230,
    onComplete: () => arco.destroy(),
  });

  // Dano nos inimigos atingidos pelo arco.
  for (const alvo of obterAlvos(scene)) {
    const ponto = pontoMaisProximo(
      alvo.hitboxDano,
      scene.player.x,
      scene.player.y,
    );

    if (
      !dentroDoCone(scene, ponto.x, ponto.y, 100, 0.13) ||
      caminhoDiretoBloqueado(scene, scene.player, ponto)
    ) {
      continue;
    }

    if (estado.corteAtingidos.has(alvo)) continue;

    const area = new Phaser.Geom.Rectangle(
      scene.player.x - 100,
      scene.player.y - 100,
      200,
      200,
    );

    const dano = alvo === scene.bossFinal ? 12 : 22;

    if (darDano(scene, alvo, dano, area)) {
      estado.corteAtingidos.add(alvo);
    }
  }
}

// =====================================================
// KAI E NYX - INTERCEPTAÇÃO DE LASERS
// =====================================================

function tentarInterceptarLaser(scene, estado, laser) {
  if (!laser?.active || laser.especialRefletido || !scene.player?.active) {
    return false;
  }

  const agora = scene.time.now;
  const personagem = scene.personagemSelecionada;
  const d = distancia(laser, scene.player);

  // KAI
  if (
    personagem === "kai-mercer" &&
    agora <= estado.parryAte &&
    d <= 57 &&
    dentroDoCone(scene, laser.x, laser.y, 57, -0.1)
  ) {
    const perfeito = agora <= estado.parryPerfeitoAte;

    if (!perfeito) {
      circular(scene, laser.x, laser.y, 8, 0x38bdf8, 130);

      laser.destroy();
      return true;
    }

    const atirador = laser.especialAtirador;
    const alvo = atirador?.active ? atirador : null;

    const vetor = alvo
      ? {
          x: alvo.x - laser.x,
          y: alvo.y - laser.y,
        }
      : direcaoJogador(scene);

    const mag = Math.max(1, Math.hypot(vetor.x, vetor.y));

    laser.especialRefletido = true;
    laser.danoEspecial = 30;

    laser.setFillStyle(0x38bdf8, 1);
    laser.setStrokeStyle(2, 0xe0f7ff, 1);

    laser.body?.setVelocity((vetor.x / mag) * 520, (vetor.y / mag) * 520);

    circular(scene, laser.x, laser.y, 10, 0x38bdf8, 180);

    return true;
  }

  // NYX
  if (
    personagem === "nyx" &&
    agora <= estado.corteAte &&
    dentroDoCone(scene, laser.x, laser.y, 105, -0.12)
  ) {
    circular(scene, laser.x, laser.y, 10, 0xa78bfa, 160);

    
laser.destroy();

// Recompensa por destruir um disparo.
if (
  typeof scene.estamina === "number" &&
  typeof scene.estaminaMaxima === "number"
) {
  scene.estamina = Math.min(scene.estaminaMaxima, scene.estamina + 3);
}

return true;
  }

  return false;
}

// =====================================================
// KAI - PARRY CONTRA ROBÔ-SERRA
// =====================================================

function tentarParryFisico(scene, estado, robo) {
  const agora = scene.time.now;

  if (
    scene.personagemSelecionada !== "kai-mercer" ||
    agora > estado.parryAte ||
    !robo?.active ||
    !dentroDoCone(scene, robo.x, robo.y, 100, -0.15)
  ) {
    return false;
  }

  if (agora <= estado.parryPerfeitoAte) {
    robo.especialAtordoadoAte = Math.max(
      robo.especialAtordoadoAte || 0,
      agora + 650,
    );

    causarDanoInimigo(scene, robo, 15);
  }

  circular(scene, scene.player.x, scene.player.y, 24, 0x38bdf8, 200);

  return true;
}

// =====================================================
// ARIA - HOLOGRAMA RECEBENDO ATAQUES
// =====================================================

function acertarHolograma(scene, estado, atacante) {
  const holograma = estado.holograma;

  if (!holograma?.active) return false;

  const eLaser = atacante.especialLaserInimigo === true;

  const dist = distancia(atacante, holograma);

  if (dist > (eLaser ? 26 : 70)) {
    return false;
  }

  holograma.integridade -= 1;

  if (eLaser) {
    atacante.destroy();
  }

  if (holograma.integridade <= 0) {
    destruirHolograma(scene, estado, true);
  } else {
    circular(scene, holograma.x, holograma.y, 16, 0xf472b6, 150);
  }

  return true;
}

// =====================================================
// LASERS REFLETIDOS ACERTANDO ROBÔS
// =====================================================

function atualizarRefletidos(scene) {
  const lasers = scene.lasersInimigo?.getChildren?.() || [];

  for (const laser of lasers) {
    if (!laser?.active || !laser.especialRefletido) {
      continue;
    }

    for (const alvo of alvosComuns(scene)) {
      const rect = alvo.hitboxDano;

      const ponto = pontoMaisProximo(rect, laser.x, laser.y);

      if (distancia(ponto, laser) > 7) {
        continue;
      }

      darDano(scene, alvo, laser.danoEspecial || 30);

      laser.destroy();
      break;
    }
  }
}

// =====================================================
// INICIALIZAR SISTEMA
// =====================================================

function criarSistemaEspeciais(scene) {
  scene.limparSistemaEspeciais?.();

  const estado = {
    proximoUso: 0,
    parryAte: 0,
    parryPerfeitoAte: 0,
    corteAte: 0,
    corteAtingidos: new Set(),
    onda: null,
    holograma: null,
  };

  scene.estadoEspecial = estado;

  const ativar = () => {
    if (
      scene.multiplayer ||
      !scene.player?.active ||
      scene.morteEmAndamento ||
      scene.movimentoBloqueado ||
      scene.generatorMenuOpen ||
      scene.atacando ||
      scene.estadoDash?.ativo
    ) {
      return false;
    }

    const agora = scene.time.now;
    const personagem = scene.personagemSelecionada || "kai-mercer";

    const perfil = ESPECIAIS[personagem];

    if (!perfil) return false;

    // A Aria pode usar o segundo toque para trocar
    // de posição durante a vida do holograma.
    if (personagem === "aria-kade" && estado.holograma?.active) {
      return trocarComHolograma(scene, estado);
    }

    if (agora < estado.proximoUso) {
      return false;
    }

    estado.proximoUso = agora + perfil.cooldown;

    if (personagem === "kai-mercer") {
      criarParry(scene, estado, agora);
    }

    if (personagem === "magnus-force") {
      iniciarOnda(scene, estado, agora);
    }

    if (personagem === "aria-kade") {
      invocarHolograma(scene, estado, agora);
    }

    if (personagem === "nyx") {
      iniciarCorteNyx(scene, estado, agora);
    }

    return true;
  };

  const aoEspecial = () => ativar();

  scene.events.on("player:especial", aoEspecial);

  scene.tentarInterceptarLaserEspecial = (laser) =>
    tentarInterceptarLaser(scene, estado, laser);

  scene.tentarParryFisicoEspecial = (robo) =>
    tentarParryFisico(scene, estado, robo);

  scene.acertarHologramaEspecial = (atacante) =>
    acertarHolograma(scene, estado, atacante);

  Object.defineProperty(scene, "especialHolograma", {
    configurable: true,
    get: () => estado.holograma,
  });

  // Limpeza automática ao trocar de mapa.
  const limpar = () => {
    scene.events.off("player:especial", aoEspecial);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    estado.onda?.grafico?.destroy();

    destruirHolograma(scene, estado, false);

    delete scene.especialHolograma;

    scene.tentarInterceptarLaserEspecial = null;
    scene.tentarParryFisicoEspecial = null;
    scene.acertarHologramaEspecial = null;
    scene.estadoEspecial = null;

    if (scene.limparSistemaEspeciais === limpar) {
      scene.limparSistemaEspeciais = null;
    }
  };

  scene.limparSistemaEspeciais = limpar;

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limpar);
}

// =====================================================
// ATUALIZAR ESPECIAIS A CADA FRAME
// =====================================================

function atualizarSistemaEspeciais(scene) {
  const estado = scene.estadoEspecial;

  if (!estado || scene.multiplayer || !scene.player?.active) {
    return;
  }

  const agora = scene.time.now;

  atualizarOnda(scene, estado, agora);

  // Expiração do holograma.
  if (estado.holograma?.active && agora >= estado.holograma.expiraEm) {
    destruirHolograma(scene, estado, true);
  }

  // Interceptação de lasers.
  for (const laser of scene.lasersInimigo?.getChildren?.() || []) {
    if (laser?.active && !laser.especialRefletido) {
      tentarInterceptarLaser(scene, estado, laser);
    }
  }

  atualizarRefletidos(scene);

  // Feedback visual da recarga no botão.
  if (scene.botaoEspecial?.active) {
    const cd = ESPECIAIS[scene.personagemSelecionada]?.cooldown || 1;

    const recarga = Phaser.Math.Clamp((estado.proximoUso - agora) / cd, 0, 1);

    const trocaDisponivel =
      scene.personagemSelecionada === "aria-kade" && estado.holograma?.active;

    scene.botaoEspecial.setAlpha(recarga > 0 && !trocaDisponivel ? 0.35 : 0.75);
  }
}

export { criarSistemaEspeciais, atualizarSistemaEspeciais };
