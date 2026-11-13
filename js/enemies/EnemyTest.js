import { PERFIS_ROBOS } from "./RobotBody.js";
import { obterBalanceamentoInimigos } from "./EnemyBalance.js";
import { atorRelevante, atualizarDecisaoAtor, atualizarBarrasDistantes } from "../core/ActorActivity.js";
/**
 * @file Construção e atualização dos robôs comuns e de serra. Integra IA, vida, som, hitboxes,
 * profundidade e lasers.
 */

import { configurarSomPassoRobo } from "../sounds/inimigos.js";
import { calcularDepthAtor } from "../map/ProfundidadeMapa.js";
import {
  criarAnimacoesInimigo,
  atualizarEstadoVisualRobo,
} from "./EnemyAnimations.js";
import { atualizarIAInimigo } from "./EnemyAI.js";
import { protegerColisaoInimigo } from "./EnemyCollision.js";
import {
  verificarLasersNoMapa,
  verificarLasersNoPlayer,
} from "./EnemyLaser.js";

/**
 * Cria um robô do tipo solicitado com parâmetros de combate, identificação de rede, hitboxes e
 * barra de vida.
 */
function criarInimigoTeste(scene, config = {}) {
  if (scene.sys?.settings?.key === "Level1" && !config.remoteOnly &&
      !scene.enemySpawnManager?.autorizarCriacao(config)) return null;
  if (![config.x, config.y].every(Number.isFinite)) return null;
  criarAnimacoesInimigo(scene);

  const x = config.x;
  const y = config.y;

  const tipoRobo = config.tipoRobo === "serra" ? "serra" : "padrao";
  const balanceamento = obterBalanceamentoInimigos(scene)[tipoRobo];
  const textura = tipoRobo === "serra" ? "robo-serra" : "robo-teste-normal";

  const inimigo = scene.physics.add.sprite(x, y, textura, 0);

  inimigo.once?.("destroy", () => {
    inimigo.tempoFlashDano?.remove?.(false);
    inimigo.combatFlashTimer?.remove?.(false);
    inimigo.tempoFlashDano = inimigo.combatFlashTimer = null;
    for (const key of ["debugHitboxDano", "fundoVida", "barraVida", "bordaVida"]) {
      inimigo[key]?.destroy?.();
      inimigo[key] = null;
    }
  });
  inimigo.origemSpawn = { x, y };
  inimigo.networkId = config.networkId || null;
  inimigo.remoteOnly = Boolean(config.remoteOnly);

  inimigo.setScale(PERFIS_ROBOS[tipoRobo].scale);
  inimigo.baseScaleX = inimigo.scaleX;
  inimigo.baseScaleY = inimigo.scaleY;
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
  inimigo.body.updateFromGameObject();
  atualizarDepthInimigo(inimigo, scene);

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
  inimigo.distanciaDeteccao = Number(
    config.distanciaDeteccao ?? (tipoRobo === "serra" ? 820 : 760),
  );
  inimigo.distanciaAtaque = Number(
    config.distanciaAtaque ?? (tipoRobo === "serra" ? 68 : 330),
  );
  inimigo.distanciaGrupo = Number(config.distanciaGrupo ?? 180);
  inimigo.danoBase = balanceamento.dano;
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
  inimigo.danoLaser = balanceamento.dano;
  inimigo.ultimoLadoTiro = Math.random() > 0.5 ? "right" : "left";

  inimigo.vidaMaxima = inimigo.remoteOnly && Number.isFinite(config.vidaMaxima)
    ? config.vidaMaxima : balanceamento.vida;
  inimigo.vida = inimigo.vidaMaxima;
  inimigo.tempoEntreAtaques = Number(config.tempoEntreAtaques ?? 1000);
  inimigo.ultimoAtaque = Number.NEGATIVE_INFINITY;
  inimigo.danoContato = balanceamento.dano;

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
  if (!inimigo.remoteOnly) protegerColisaoInimigo(scene, inimigo);

  return inimigo;
}

/**
 * Solicita uma unidade ao gerenciador das zonas; não há nascimento ao redor do jogador.
 */
function criarRoboSerra(scene) {
  return scene?.enemySpawnManager?.solicitarSpawn("serra", 1)[0] ?? null;
}

/**
 * Destrói robôs, lasers, sons e elementos auxiliares antes de sair da cena ou limpar o grupo.
 */
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

/**
 * Encaminha os atalhos antigos ao único gerenciador autorizado de spawn.
 */
function criarRobos(scene, quantidade = 1) {
  return scene?.enemySpawnManager?.solicitarSpawn("padrao", quantidade) ?? [];
}

/**
 * Ajusta a colisão com o chão para a região dos pés conforme o tipo de robô.
 */
function configurarHitboxPeInimigo(inimigo) {
  if (!inimigo || !inimigo.body) {
    return;
  }

  const perfil = PERFIS_ROBOS[inimigo.tipoRobo] || PERFIS_ROBOS.padrao;
  inimigo.body.setSize(perfil.width, perfil.height);
  inimigo.body.setOffset(perfil.offsetX, perfil.offsetY);
}

/**
 * Atualiza a área que recebe dano e seus gráficos de depuração sem alterar a colisão com o
 * cenário.
 */
function atualizarHitboxDanoInimigo(inimigo) {
  // O Robo Bola mantém uma hitbox própria, ajustada à escala do sprite.
  if (!inimigo || !inimigo.body || ["bola", "olhao"].includes(inimigo.tipoRobo)) {
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
    if (!inimigo.scene?.game?.config?.physics?.arcade?.debug) {
      inimigo.debugHitboxDano.setVisible(false);
      return;
    }
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

/**
 * Ordena o inimigo pela posição de seus pés usando a regra de profundidade da cena.
 */
function atualizarDepthInimigo(inimigo, scene) {
  if (!inimigo?.active || !scene) {
    return;
  }

  const inimigoFootY = inimigo.body?.bottom ?? inimigo.getBounds().bottom;
  inimigo.setDepth(calcularDepthAtor(scene, inimigoFootY, inimigo));
}

/**
 * Atualiza IA local, hitboxes, profundidade, barras de vida e impactos dos lasers de todos os
 * robôs ativos.
 */
function atualizarInimigoTeste(scene, time) {
  if (!Array.isArray(scene.inimigos) || scene.inimigos.length === 0) {
    return;
  }

  for (const inimigo of scene.inimigos) {
    if (!inimigo || !inimigo.active) {
      continue;
    }

    if (!inimigo.remoteOnly) {
      if (!["bola", "olhao"].includes(inimigo.tipoRobo) && atualizarDecisaoAtor(scene, inimigo, time)) {
        atualizarIAInimigo(scene, time, inimigo);
      }
    }
    atualizarHitboxDanoInimigo(inimigo);
    const relevante = atorRelevante(scene, inimigo);
    atualizarBarrasDistantes(inimigo, relevante);
    if (!relevante) continue;
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
