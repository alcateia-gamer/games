/**
 * Habilidades especiais de Kai, Magnus, Aria e Nyx.
 * Integração atual: somente modo solo.
 * Não modifica dash, ataques normais ou hitboxes originais.
 */

import { causarDanoInimigo } from "../enemies/EnemyHealth.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";

import {
  caminhoDiretoBloqueado,
  retanguloLivreDoMapa,
} from "../enemies/EnemyPathfinding.js";

// =====================================================
// CONFIGURAÇÃO DOS PERSONAGENS
// =====================================================

const ESPECIAIS = Object.freeze({
  "kai-mercer": {
    cooldown: 7000,
    cor: 0x38bdf8,
  },

  "magnus-force": {
    cooldown: 8000,
    cor: 0xfb923c,
  },

  "aria-kade": {
    cooldown: 12000,
    cor: 0xf472b6,
  },

  nyx: {
    cooldown: 5000,
    cor: 0xa78bfa,
  },
});

const CONFIG = Object.freeze({
  kaiDuracao: 1800,
  kaiRaio: 57,

  ariaDuracao: 4500,
  ariaVelocidade: 145,
  ariaDistanciaInicial: 34,

  nyxVelocidade: 490,
  nyxAlcance: 540,
  nyxRaio: 19,
});

const DIRECOES = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// =====================================================
// FUNÇÕES COMPARTILHADAS
// =====================================================

function direcaoJogador(scene) {
  return DIRECOES[scene.direcaoAtual] || DIRECOES.down;
}

function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pontoMaisProximo(rect, x, y) {
  return {
    x: Phaser.Math.Clamp(x, rect.left, rect.right),
    y: Phaser.Math.Clamp(y, rect.top, rect.bottom),
  };
}

function inimigosVivos(scene) {
  return (scene.inimigos || []).filter(
    (robo) => robo?.active && !robo.morto && robo.hitboxDano,
  );
}

function alvosEspeciais(scene) {
  const alvos = inimigosVivos(scene);

  if (
    scene.bossFinal?.active &&
    !scene.bossFinal.morto &&
    scene.bossFinal.hitboxDano
  ) {
    alvos.push(scene.bossFinal);
  }

  return alvos;
}

function danoEspecial(scene, alvo, quantidade, area = null) {
  if (alvo === scene.bossFinal) {
    // O chefe continua recebendo dano
    // somente nas regiões verdes.
    return causarDanoBoss(scene, quantidade, area);
  }

  causarDanoInimigo(scene, alvo, quantidade, {
    playSound: true,
  });

  return true;
}

// =====================================================
// EFEITOS VISUAIS COMPARTILHADOS
// =====================================================

function pulsoVisual(scene, x, y, raio, cor, tempo = 230) {
  const anel = scene.add
    .circle(x, y, raio, cor, 0.08)
    .setStrokeStyle(3, cor, 0.9)
    .setDepth((scene.player?.depth ?? 50) + 0.1);

  scene.tweens.add({
    targets: anel,
    alpha: 0,
    scale: 1.4,
    duration: tempo,

    onComplete: () => {
      anel.destroy();
    },
  });
}

// =====================================================
// VERIFICAR POSIÇÃO LIVRE PARA TELEPORTE
// =====================================================

function posicaoLivrePlayer(scene, x, y) {
  const player = scene.player;
  const body = player?.body;

  if (!body || !Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  // Usa a hitbox física real do personagem.
  // Não altera o corpo durante o teste.
  const area = new Phaser.Geom.Rectangle(
    x + (body.x - player.x),
    y + (body.y - player.y),
    body.width,
    body.height,
  );

  const mundo = scene.physics?.world?.bounds;

  if (
    body.collideWorldBounds &&
    mundo &&
    (area.left < mundo.left ||
      area.right > mundo.right ||
      area.top < mundo.top ||
      area.bottom > mundo.bottom)
  ) {
    return false;
  }

  return retanguloLivreDoMapa(scene, area);
}

// =====================================================
// KAI — BARREIRA DE PARRY
// =====================================================

function iniciarParry(scene, estado, agora) {
  estado.parryAte = agora + CONFIG.kaiDuracao;

  estado.parryGrafico?.destroy();

  estado.parryGrafico = scene.add
    .graphics()
    .setDepth((scene.player.depth ?? 50) + 0.15);

  pulsoVisual(scene, scene.player.x, scene.player.y, 29, 0x38bdf8, 230);
}

// =====================================================
// ATUALIZAR A ESFERA DO KAI
// =====================================================

function atualizarParry(scene, estado, agora) {
  const g = estado.parryGrafico;

  if (!g) {
    return;
  }

  if (agora >= estado.parryAte || !scene.player?.active) {
    g.destroy();
    estado.parryGrafico = null;
    return;
  }

  const player = scene.player;

  const fase = Math.sin(agora * 0.015) * 0.08;

  const r = CONFIG.kaiRaio;

  // A esfera acompanha a posição atual
  // do jogador durante toda sua duração.
  g.clear()
    .fillStyle(0x38bdf8, 0.055 + fase * 0.2)
    .fillCircle(player.x, player.y - 4, r)
    .lineStyle(5, 0x006baa, 0.32)
    .strokeCircle(player.x, player.y - 4, r + 3)
    .lineStyle(2.5, 0x8de7ff, 0.8 + fase)
    .strokeCircle(player.x, player.y - 4, r);
}

// =====================================================
// VERIFICAR SE O PARRY ESTÁ ATIVO
// =====================================================

function parryAtivo(scene, estado) {
  return (
    scene.personagemSelecionada === "kai-mercer" &&
    scene.player?.active &&
    scene.time.now < estado.parryAte
  );
}

// =====================================================
// BLOQUEAR GOLPES FÍSICOS
// =====================================================

function bloquearAtaqueKai(scene, estado, atacante) {
  if (!parryAtivo(scene, estado)) {
    return false;
  }

  // Enquanto a barreira existe,
  // os golpes que causariam dano são bloqueados.
  pulsoVisual(scene, scene.player.x, scene.player.y - 4, 19, 0x38bdf8, 150);

  if (atacante?.tipoRobo && atacante.active && !atacante.morto) {
    atacante.especialAtordoadoAte = Math.max(
      atacante.especialAtordoadoAte || 0,
      scene.time.now + 340,
    );
  }

  return true;
}

// =====================================================
// REFLETIR LASERS COM A BARREIRA
// =====================================================

function refletirLaser(scene, estado, laser) {
  if (
    !parryAtivo(scene, estado) ||
    !laser?.active ||
    laser.especialRefletido ||
    distancia(scene.player, laser) > CONFIG.kaiRaio + 5
  ) {
    return false;
  }

  const origem = laser.especialAtirador;

  const alvo =
    origem?.active && !origem.morto
      ? origem
      : inimigosVivos(scene).sort(
          (a, b) => distancia(a, laser) - distancia(b, laser),
        )[0];

  const frente = direcaoJogador(scene);

  const vx = alvo ? alvo.x - laser.x : frente.x;

  const vy = alvo ? alvo.y - laser.y : frente.y;

  const tamanho = Math.max(0.001, Math.hypot(vx, vy));

  // O laser muda de equipe.
  laser.especialRefletido = true;
  laser.danoEspecial = 30;

  laser.setFillStyle(0x38bdf8, 1);
  laser.setStrokeStyle(2, 0xb9f0ff, 1);

  // Direcionar o projétil de volta ao inimigo.
  laser.body?.setVelocity((vx / tamanho) * 530, (vy / tamanho) * 530);

  pulsoVisual(scene, laser.x, laser.y, 11, 0x38bdf8, 150);

  return true;
}

// =====================================================
// LASERS REFLETIDOS CAUSANDO DANO
// =====================================================

function atualizarLasersRefletidos(scene) {
  const lasers = scene.lasersInimigo?.getChildren?.() || [];

  for (const laser of lasers) {
    if (!laser?.active || !laser.especialRefletido) {
      continue;
    }

    for (const robo of inimigosVivos(scene)) {
      const ponto = pontoMaisProximo(robo.hitboxDano, laser.x, laser.y);

      if (distancia(ponto, laser) <= 8) {
        danoEspecial(scene, robo, laser.danoEspecial || 30);

        laser.destroy();
        break;
      }
    }
  }
}

// =====================================================
// MAGNUS — ONDA DE CHOQUE ORIGINAL
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

    grafico: scene.add.graphics().setDepth((scene.player.depth ?? 50) - 0.02),
  };
}

function atualizarOnda(scene, estado, agora) {
  const onda = estado.onda;

  if (!onda) {
    return;
  }

  const progresso = Phaser.Math.Clamp(
    (agora - onda.inicio) / onda.duracao,
    0,
    1,
  );

  onda.raioAtual = onda.raio * progresso;

  onda.grafico
    .clear()
    .lineStyle(5, 0xfb923c, 0.95 * (1 - progresso))
    .strokeCircle(onda.x, onda.y, onda.raioAtual)
    .lineStyle(2, 0xffe0a6, 0.8 * (1 - progresso))
    .strokeCircle(onda.x, onda.y, Math.max(0, onda.raioAtual - 9));

  for (const alvo of alvosEspeciais(scene)) {
    if (onda.atingidos.has(alvo)) {
      continue;
    }

    const ponto = pontoMaisProximo(alvo.hitboxDano, onda.x, onda.y);

    if (
      distancia(ponto, onda) > onda.raioAtual ||
      caminhoDiretoBloqueado(scene, onda, ponto)
    ) {
      continue;
    }

    onda.atingidos.add(alvo);

    // Boss não sofre empurrão.
    if (alvo === scene.bossFinal) {
      danoEspecial(
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

    danoEspecial(scene, alvo, 18);

    if (!alvo.active || alvo.morto) {
      continue;
    }

    const dx = alvo.x - onda.x;
    const dy = alvo.y - onda.y;

    const mag = Math.max(1, Math.hypot(dx, dy));

    alvo.setVelocity((dx / mag) * 240, (dy / mag) * 240);

    alvo.especialEmpurraoAte = agora + 200;
    alvo.especialAtordoadoAte = agora + 650;
  }

  // Destruir lasers que a onda alcançar.
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
// ARIA — DESTRUIR HOLOGRAMA
// =====================================================

function destruirHolograma(scene, estado, emitirPulso = true) {
  const holo = estado.holograma;

  if (!holo) {
    return;
  }

  estado.holograma = null;

  scene.tweens.killTweensOf(holo);

  if (!holo.active) {
    return;
  }

  const { x, y } = holo;

  holo.destroy();

  if (!emitirPulso) {
    return;
  }

  pulsoVisual(scene, x, y, 30, 0xf472b6, 350);

  for (const robo of inimigosVivos(scene)) {
    if (distancia(robo, { x, y }) < 76) {
      robo.especialAtordoadoAte = Math.max(
        robo.especialAtordoadoAte || 0,
        scene.time.now + 350,
      );
    }
  }
}

// =====================================================
// ARIA — INVOCAR HOLOGRAMA
// =====================================================

function invocarHolograma(scene, estado, agora) {
  const player = scene.player;

  // A direção é guardada no momento da invocação.
  const vetor = {
    ...direcaoJogador(scene),
  };

  let inicio = {
    x: player.x,
    y: player.y,
  };

  // Procurar um ponto válido para o spawn.
  for (const distanciaInicial of [CONFIG.ariaDistanciaInicial, 18, 0]) {
    const candidato = {
      x: player.x + vetor.x * distanciaInicial,
      y: player.y + vetor.y * distanciaInicial,
    };

    if (
      posicaoLivrePlayer(scene, candidato.x, candidato.y) &&
      !caminhoDiretoBloqueado(scene, player, candidato)
    ) {
      inicio = candidato;
      break;
    }
  }

  // Cópia visual da Aria.
  const holo = scene.add
    .sprite(inicio.x, inicio.y, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY)
    .setDisplaySize(player.displayWidth, player.displayHeight)
    .setFlip(player.flipX, player.flipY)
    .setTint(0xff9bd5)
    .setAlpha(0.65)
    .setDepth((player.depth ?? 50) - 0.01);

  // Usar animação de caminhada que já existe.
  const animacao = `walk-${scene.direcaoAtual}`;

  if (scene.anims.exists(animacao)) {
    holo.play(animacao);
  }

  holo.especialHolograma = true;
  holo.integridade = 2;
  holo.expiraEm = agora + CONFIG.ariaDuracao;

  // Direção permanente da cópia.
  holo.direcaoEspecial = vetor;

  holo.parado = false;

  estado.holograma = holo;

  // Oscilação visual holográfica.
  scene.tweens.add({
    targets: holo,
    alpha: 0.36,
    duration: 410,
    yoyo: true,
    repeat: -1,
  });

  pulsoVisual(scene, inicio.x, inicio.y, 24, 0xf472b6, 350);
}

// =====================================================
// ARIA — MOVIMENTAÇÃO DO HOLOGRAMA
// =====================================================

function atualizarHolograma(scene, estado, delta, agora) {
  const holo = estado.holograma;

  if (!holo?.active) {
    return;
  }

  // A cópia desaparece após sua duração.
  if (agora >= holo.expiraEm) {
    destruirHolograma(scene, estado, true);

    return;
  }

  // Se encontrou uma parede, permanece parada.
  if (holo.parado) {
    return;
  }

  const passo =
    CONFIG.ariaVelocidade * Math.min(0.05, Math.max(0, delta) / 1000);

  const destino = {
    x: holo.x + holo.direcaoEspecial.x * passo,
    y: holo.y + holo.direcaoEspecial.y * passo,
  };

  // Não atravessar paredes ou obstáculos do mapa.
  if (
    !posicaoLivrePlayer(scene, destino.x, destino.y) ||
    caminhoDiretoBloqueado(scene, holo, destino)
  ) {
    holo.parado = true;
    holo.anims.stop();
    return;
  }

  // Caminhada em linha reta, na direção inicial.
  holo.setPosition(destino.x, destino.y);

  holo.setDepth((scene.player?.depth ?? 50) - 0.01);
}

// =====================================================
// ARIA — TROCA DE POSIÇÃO
// =====================================================

function trocarComHolograma(scene, estado) {
  const holo = estado.holograma;

  if (!holo?.active || holo.expiraEm <= scene.time.now) {
    return false;
  }

  const destino = {
    x: holo.x,
    y: holo.y,
  };

  // Não existe mais limite de 170 pixels.
  // A distância pode ser grande, desde
  // que o holograma esteja vivo.
  //
  // O destino precisa estar livre.
  if (!posicaoLivrePlayer(scene, destino.x, destino.y)) {
    return false;
  }

  const player = scene.player;

  const origem = {
    x: player.x,
    y: player.y,
  };

  // Teleportar instantaneamente.
  player.setPosition(destino.x, destino.y);

  player.setVelocity(0, 0);

  player.body?.updateFromGameObject();

  // Alinhar imediatamente a hitbox de dano.
  if (scene.hitboxDanoPlayer?.setTo) {
    scene.hitboxDanoPlayer.setTo(destino.x - 15, destino.y - 20, 30, 46);
  }

  pulsoVisual(scene, origem.x, origem.y, 24, 0xf472b6, 280);

  pulsoVisual(scene, destino.x, destino.y, 24, 0xf472b6, 280);

  // A cópia é consumida pela troca.
  destruirHolograma(scene, estado, false);

  return true;
}

// =====================================================
// ARIA — HOLOGRAMA RECEBENDO ATAQUES
// =====================================================

function acertarHolograma(scene, estado, atacante) {
  const holo = estado.holograma;

  if (!holo?.active || !atacante?.active) {
    return false;
  }

  const eLaser = atacante.especialLaserInimigo === true;

  // Lasers refletidos não acertam hologramas.
  if (eLaser && atacante.especialRefletido) {
    return false;
  }

  const alcanceAcerto = eLaser ? 29 : 70;

  if (distancia(atacante, holo) > alcanceAcerto) {
    return false;
  }

  holo.integridade -= 1;

  if (eLaser) {
    atacante.destroy();
  }

  if (holo.integridade <= 0) {
    destruirHolograma(scene, estado, true);
  } else {
    pulsoVisual(scene, holo.x, holo.y, 16, 0xf472b6, 150);
  }

  return true;
}

// =====================================================
// NYX — DESTRUIR PROJÉTIL DE CORTE
// =====================================================

function destruirCorte(estado, corte) {
  if (!corte) {
    return;
  }

  corte.grafico?.destroy();
  estado.cortes.delete(corte);
}

// =====================================================
// NYX — DISPARAR CORTE ENERGÉTICO
// =====================================================

function dispararCorteNyx(scene, estado) {
  const player = scene.player;

  // Direção definida ao disparar.
  const vetor = {
    ...direcaoJogador(scene),
  };

  const x = player.x + vetor.x * 30;

  const y = player.y + vetor.y * 30;

  // Gráfico independente do jogador.
  const grafico = scene.add
    .graphics()
    .setPosition(x, y)
    .setRotation(Math.atan2(vetor.y, vetor.x))
    .setDepth((player.depth ?? 50) + 0.1);

  // Corte em formato de meia-lua.
  grafico.lineStyle(11, 0x7e22ce, 0.27);

  grafico.beginPath();
  grafico.arc(0, 0, 27, -1.12, 1.12, false);
  grafico.strokePath();

  grafico.lineStyle(5, 0xb36aff, 0.95);

  grafico.beginPath();
  grafico.arc(0, 0, 27, -1.12, 1.12, false);
  grafico.strokePath();

  grafico.lineStyle(2, 0xf5e8ff, 1);

  grafico.beginPath();
  grafico.arc(0, 0, 25, -1.0, 1.0, false);
  grafico.strokePath();

  // Registrar o projétil em movimento.
  estado.cortes.add({
    x,
    y,

    inicioX: x,
    inicioY: y,

    direcao: vetor,
    grafico,
  });

  pulsoVisual(scene, x, y, 12, 0xa78bfa, 120);
}

// =====================================================
// NYX — ATUALIZAR MOVIMENTO DO CORTE
// =====================================================

function atualizarCortesNyx(scene, estado, delta) {
  if (!estado.cortes.size) {
    return;
  }

  const lasers = scene.lasersInimigo?.getChildren?.() || [];

  const passoTotal =
    CONFIG.nyxVelocidade * Math.min(0.05, Math.max(0, delta) / 1000);

  for (const corte of [...estado.cortes]) {
    let terminou = false;

    // Pequenos passos para evitar atravessar
    // paredes ou inimigos entre frames.
    const partes = Math.max(1, Math.ceil(passoTotal / 8));

    const passo = passoTotal / partes;

    for (let i = 0; i < partes && !terminou; i++) {
      const proximo = {
        x: corte.x + corte.direcao.x * passo,

        y: corte.y + corte.direcao.y * passo,
      };

      const areaCurta = new Phaser.Geom.Rectangle(
        proximo.x - 8,
        proximo.y - 8,
        16,
        16,
      );

      // Colisão com obstáculos do cenário.
      if (
        caminhoDiretoBloqueado(scene, corte, proximo) ||
        !retanguloLivreDoMapa(scene, areaCurta)
      ) {
        terminou = true;
        break;
      }

      // Mover o corte no mundo.
      corte.x = proximo.x;
      corte.y = proximo.y;

      corte.grafico.setPosition(corte.x, corte.y);

      // Destruir se atingir o alcance máximo.
      if (
        distancia(corte, {
          x: corte.inicioX,
          y: corte.inicioY,
        }) >= CONFIG.nyxAlcance
      ) {
        terminou = true;
        break;
      }

      // =========================================
      // DESTRUIÇÃO DE LASERS
      // =========================================

      for (const laser of lasers) {
        if (!laser?.active || laser.especialRefletido) {
          continue;
        }

        if (distancia(corte, laser) <= CONFIG.nyxRaio + 7) {
          pulsoVisual(scene, laser.x, laser.y, 9, 0xa78bfa, 160);

          laser.destroy();

          // Recuperar um pouco de estamina.
          if (
            Number.isFinite(scene.estamina) &&
            Number.isFinite(scene.estaminaMaxima)
          ) {
            scene.estamina = Math.min(scene.estaminaMaxima, scene.estamina + 3);
          }
        }
      }

      // =========================================
      // COLISÃO COM INIMIGOS
      // =========================================

      const areaCorte = new Phaser.Geom.Rectangle(
        corte.x - 23,
        corte.y - 23,
        46,
        46,
      );

      for (const alvo of alvosEspeciais(scene)) {
        if (alvo === scene.bossFinal) {
          // Verificar as áreas verdes do boss.
          const zonas = alvo.hitboxesReceberDano || [];

          const acertouZona = zonas.some((r) =>
            Phaser.Geom.Intersects.RectangleToRectangle(r, areaCorte),
          );

          if (acertouZona && danoEspecial(scene, alvo, 12, areaCorte)) {
            terminou = true;
            break;
          }
        } else {
          // Robôs comuns e robôs-serra.
          const acertou = Phaser.Geom.Intersects.RectangleToRectangle(
            alvo.hitboxDano,
            areaCorte,
          );

          if (acertou) {
            danoEspecial(scene, alvo, 22);

            terminou = true;
            break;
          }
        }
      }
    }

    // O corte termina após acertar um inimigo,
    // parede ou alcançar a distância máxima.
    if (terminou) {
      destruirCorte(estado, corte);
    }
  }
}

// =====================================================
// CRIAR SISTEMA DAS HABILIDADES
// =====================================================

function criarSistemaEspeciais(scene) {
  scene.limparSistemaEspeciais?.();

  const estado = {
    proximoUso: 0,

    parryAte: 0,
    parryGrafico: null,

    onda: null,

    holograma: null,

    cortes: new Set(),
  };

  scene.estadoEspecial = estado;

  // ===================================================
  // ATIVAR BOTÃO ESPECIAL
  // ===================================================

  const ativar = () => {
    if (
      scene.multiplayer ||
      !scene.player?.active ||
      scene.morteEmAndamento ||
      scene.generatorMenuOpen ||
      scene.movimentoBloqueado
    ) {
      return false;
    }

    const personagem = scene.personagemSelecionada || "kai-mercer";

    const perfil = ESPECIAIS[personagem];

    if (!perfil) {
      return false;
    }

    // ===============================================
    // ARIA — TROCA PRIORITÁRIA
    // ===============================================
    //
    // Pode usar o segundo toque em qualquer instante
    // enquanto o holograma estiver vivo.
    //
    // Não depende do cooldown da invocação.
    // Não depende de estar atacando.
    // Não depende de estar usando dash.
    // ===============================================

    if (personagem === "aria-kade" && estado.holograma?.active) {
      return trocarComHolograma(scene, estado);
    }

    // Impedir apenas novas ativações durante
    // ataque ou dash.
    if (scene.atacando || scene.estadoDash?.ativo) {
      return false;
    }

    const agora = scene.time.now;

    if (agora < estado.proximoUso) {
      return false;
    }

    estado.proximoUso = agora + perfil.cooldown;

    if (personagem === "kai-mercer") {
      iniciarParry(scene, estado, agora);
    }

    if (personagem === "magnus-force") {
      iniciarOnda(scene, estado, agora);
    }

    if (personagem === "aria-kade") {
      invocarHolograma(scene, estado, agora);
    }

    if (personagem === "nyx") {
      dispararCorteNyx(scene, estado);
    }

    return true;
  };

  // Evento já emitido pelo botão especial.
  scene.events.on("player:especial", ativar);

  // ===================================================
  // INTEGRAR COM LASERS E IA
  // ===================================================

  scene.tentarInterceptarLaserEspecial = (laser) =>
    refletirLaser(scene, estado, laser);

  scene.tentarParryFisicoEspecial = (robo) =>
    bloquearAtaqueKai(scene, estado, robo);

  scene.tentarBloquearDanoEspecial = (atacante) =>
    bloquearAtaqueKai(scene, estado, atacante);

  scene.acertarHologramaEspecial = (atacante) =>
    acertarHolograma(scene, estado, atacante);

  // Permite que a IA veja o holograma atual.
  Object.defineProperty(scene, "especialHolograma", {
    configurable: true,

    get: () => estado.holograma,
  });

  // ===================================================
  // LIMPEZA AO TROCAR DE MAPA
  // ===================================================

  const limpar = () => {
    scene.events.off("player:especial", ativar);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    estado.parryGrafico?.destroy();
    estado.onda?.grafico?.destroy();

    destruirHolograma(scene, estado, false);

    for (const corte of [...estado.cortes]) {
      destruirCorte(estado, corte);
    }

    delete scene.especialHolograma;

    scene.tentarInterceptarLaserEspecial = null;
    scene.tentarParryFisicoEspecial = null;
    scene.tentarBloquearDanoEspecial = null;
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
// ATUALIZAR AS HABILIDADES
// =====================================================

function atualizarSistemaEspeciais(scene, delta = 16.67) {
  const estado = scene.estadoEspecial;

  if (!estado || scene.multiplayer || !scene.player?.active) {
    return;
  }

  const agora = scene.time.now;

  // KAI
  atualizarParry(scene, estado, agora);

  // MAGNUS
  atualizarOnda(scene, estado, agora);

  // ARIA
  atualizarHolograma(scene, estado, delta, agora);

  // NYX
  atualizarCortesNyx(scene, estado, delta);

  // Atualizar interceptação de lasers do Kai.
  for (const laser of scene.lasersInimigo?.getChildren?.() || []) {
    if (laser?.active && !laser.especialRefletido) {
      refletirLaser(scene, estado, laser);
    }
  }

  atualizarLasersRefletidos(scene);

  // ===================================================
  // OPACIDADE DO BOTÃO DURANTE A RECARGA
  // ===================================================

  if (scene.botaoEspecial?.active) {
    const nome = scene.personagemSelecionada;

    const recarga = ESPECIAIS[nome]?.cooldown || 1;

    const esperando = agora < estado.proximoUso;

    // A Aria pode utilizar a troca mesmo
    // que a habilidade esteja em recarga.
    const trocaDisponivel = nome === "aria-kade" && estado.holograma?.active;

    scene.botaoEspecial.setAlpha(esperando && !trocaDisponivel ? 0.35 : 0.75);
  }
}

export { criarSistemaEspeciais, atualizarSistemaEspeciais };
