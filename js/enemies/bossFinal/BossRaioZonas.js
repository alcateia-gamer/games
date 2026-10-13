import { bossDepth, danoAtaqueChao, duracaoFrame } from "./BossConfig.js";

import { causarDanoJogador } from "./BossCombate.js";

// =====================================================
// CONFIGURAÇÃO DO RAIO
// =====================================================

const TEXTURA_RAIO = "boss-raio-zona";

// Mantém o início sincronizado com o Boss.
const FRAME_BOSS_INICIO_RAIO = 7;

// Preparação original do raio.
const PERCENTUAL_PREPARACAO = 0.3;
const MINIMO_FRAMES_PREPARACAO = 4;

// NOVO:
// Os dois últimos frames são considerados
// o desaparecimento do raio e não causam dano.
const FRAMES_FINAIS_SEM_DANO = 2;

// =====================================================
// CONFIGURAÇÃO DAS TRÊS ZONAS
// =====================================================

const ARENA_X_MIN = -1606;
const ARENA_X_MAX = -550;

const ZONA_INICIO_Y = -6161;
const ZONA_FIM_Y = -5426;

const TOTAL_ZONAS = 3;
const CHANCE_PRIORIZAR_JOGADOR = 0.75;

const LARGURA_ZONA = (ARENA_X_MAX - ARENA_X_MIN) / TOTAL_ZONAS;

const FATOR_LARGURA_HITBOX = 0.98;
const FATOR_LARGURA_VISUAL = 1.24;

const LARGURA_RAIO_HITBOX = LARGURA_ZONA * FATOR_LARGURA_HITBOX;

const LARGURA_RAIO_VISUAL = LARGURA_ZONA * FATOR_LARGURA_VISUAL;

const ALTURA_RAIO = ZONA_FIM_Y - ZONA_INICIO_Y;

// =====================================================
// CONFIGURAÇÃO VISUAL DO DEBUG
// =====================================================

const COR_ZONA_INATIVA = 0x2f7dff;
const COR_ZONA_ATIVA = 0x00d8ff;

const ALFA_CONTORNO_INATIVA = 0.7;
const ALFA_CONTORNO_ATIVA = 1;

const ESPESSURA_CONTORNO_INATIVA = 3;
const ESPESSURA_CONTORNO_ATIVA = 4;

const ALFA_PREENCHIMENTO_INATIVA = 0.06;
const ALFA_PREENCHIMENTO_ATIVA = 0.12;

// =====================================================
// CONSULTAR DEBUG DO PHASER
// =====================================================

function debugHitboxesAtivado(scene) {
  return Boolean(scene?.game?.config?.physics?.arcade?.debug);
}

// =====================================================
// ÁREA REAL DE DANO
// =====================================================

function obterAreaZona(indice) {
  const x = ARENA_X_MIN + indice * LARGURA_ZONA;

  return new Phaser.Geom.Rectangle(
    x + (LARGURA_ZONA - LARGURA_RAIO_HITBOX) / 2,
    ZONA_INICIO_Y,
    LARGURA_RAIO_HITBOX,
    ALTURA_RAIO,
  );
}

// =====================================================
// ÁREA VISUAL DO RAIO
// =====================================================

function obterAreaVisualZona(indice) {
  const areaDano = obterAreaZona(indice);

  return new Phaser.Geom.Rectangle(
    areaDano.centerX - LARGURA_RAIO_VISUAL / 2,
    ZONA_INICIO_Y,
    LARGURA_RAIO_VISUAL,
    ALTURA_RAIO,
  );
}

// =====================================================
// MANTER RAIO ATRÁS DO PERSONAGEM
// =====================================================

function atualizarProfundidadeRaio(boss) {
  const sprite = boss.raioZonaSprite;

  if (!sprite?.active) return;

  const jogador = boss.scene?.player;

  let profundidade = bossDepth - 0.5;

  if (jogador?.active && Number.isFinite(jogador.depth)) {
    profundidade = Math.min(profundidade, jogador.depth - 0.1);
  }

  if (sprite.depth !== profundidade) {
    sprite.setDepth(profundidade);
  }
}

// =====================================================
// DESENHAR DEBUG DAS TRÊS ZONAS
// =====================================================

function desenharDebugZonas(boss) {
  const graphics = boss.raioZonaDebugGraphics;

  if (!graphics?.scene) return;

  const debugAtivo = debugHitboxesAtivado(boss.scene);

  graphics.setVisible(debugAtivo);
  graphics.clear();

  if (!debugAtivo || boss.morto) {
    return;
  }

  const ia = boss.iaCombate;

  for (let i = 0; i < TOTAL_ZONAS; i++) {
    const area = obterAreaZona(i);

    const ativa = ia?.raioZonaIndice === i;

    const cor = ativa ? COR_ZONA_ATIVA : COR_ZONA_INATIVA;

    const alphaLinha = ativa ? ALFA_CONTORNO_ATIVA : ALFA_CONTORNO_INATIVA;

    const espessura = ativa
      ? ESPESSURA_CONTORNO_ATIVA
      : ESPESSURA_CONTORNO_INATIVA;

    const alphaFill = ativa
      ? ALFA_PREENCHIMENTO_ATIVA
      : ALFA_PREENCHIMENTO_INATIVA;

    graphics.fillStyle(cor, alphaFill);

    graphics.fillRect(area.x, area.y, area.width, area.height);

    graphics.lineStyle(espessura, cor, alphaLinha);

    graphics.strokeRect(area.x, area.y, area.width, area.height);
  }
}

// =====================================================
// INICIALIZAR DEBUG PERMANENTE
// =====================================================

export function inicializarDebugZonasRaio(boss) {
  if (!boss?.scene || !boss.active) return;

  const scene = boss.scene;

  if (!boss.raioZonaDebugGraphics?.scene) {
    boss.raioZonaDebugGraphics = scene.add.graphics();

    boss.raioZonaDebugGraphics.setDepth(bossDepth + 5);
  }

  boss.raioZonaDebugGraphics.setVisible(debugHitboxesAtivado(scene));

  desenharDebugZonas(boss);

  if (!boss.raioZonaDebugUpdate) {
    const atualizarDebug = () => {
      if (!boss?.active || !boss.scene) {
        return;
      }

      desenharDebugZonas(boss);
    };

    boss.raioZonaDebugUpdate = atualizarDebug;

    scene.events.on(Phaser.Scenes.Events.UPDATE, atualizarDebug);
  }
}

// =====================================================
// DESTRUIR DEBUG DAS ZONAS
// =====================================================

export function destruirDebugZonasRaio(boss) {
  if (!boss) return;

  const scene = boss.scene;

  if (boss.raioZonaDebugUpdate && scene?.events) {
    scene.events.off(Phaser.Scenes.Events.UPDATE, boss.raioZonaDebugUpdate);
  }

  boss.raioZonaDebugUpdate = null;

  if (boss.raioZonaDebugGraphics?.scene) {
    boss.raioZonaDebugGraphics.destroy();
  }

  boss.raioZonaDebugGraphics = null;
}

// =====================================================
// ESCOLHER ZONA DO ATAQUE
// =====================================================

function escolherZona(boss) {
  const jogador = boss.scene.player;

  if (jogador?.active && Math.random() < CHANCE_PRIORIZAR_JOGADOR) {
    const indice = Math.floor((jogador.x - ARENA_X_MIN) / LARGURA_ZONA);

    if (indice >= 0 && indice < TOTAL_ZONAS) {
      return indice;
    }
  }

  return Phaser.Math.Between(0, TOTAL_ZONAS - 1);
}

// =====================================================
// OBTER TODOS OS FRAMES DO RAIO
// =====================================================

function obterFramesRaio(scene) {
  if (!scene.textures.exists(TEXTURA_RAIO)) {
    return [];
  }

  const textura = scene.textures.get(TEXTURA_RAIO);

  return textura
    .getFrameNames()
    .filter((nome) => /^\d+$/.test(String(nome)))
    .sort((a, b) => Number(a) - Number(b));
}

// =====================================================
// FRAME ATUAL DO BOSS
// =====================================================

function obterFrameAtualBoss(boss) {
  const animacao = boss.sprite?.anims;

  if (!animacao) {
    return boss.iaCombate?.frame ?? 0;
  }

  const frameAtual = animacao.currentFrame;

  if (frameAtual && Number.isFinite(frameAtual.index)) {
    return Math.max(0, frameAtual.index - 1);
  }

  return boss.iaCombate?.frame ?? 0;
}

// =====================================================
// TOTAL DE FRAMES DO BOSS
// =====================================================

function obterTotalFramesBoss(boss) {
  const animacao = boss.sprite?.anims?.currentAnim;

  if (!animacao) return 1;

  return Math.max(1, animacao.frames.length);
}

// =====================================================
// DURAÇÃO RESTANTE DA ANIMAÇÃO DO BOSS
// =====================================================

function obterDuracaoRestanteBoss(boss, frameInicio) {
  const animacao = boss.sprite?.anims?.currentAnim;

  const totalFrames = obterTotalFramesBoss(boss);

  const framesRestantes = Math.max(1, totalFrames - frameInicio);

  const fps = Number(animacao?.frameRate);

  if (Number.isFinite(fps) && fps > 0) {
    return framesRestantes * (1000 / fps);
  }

  return framesRestantes * duracaoFrame;
}

// =====================================================
// FRAMES DE PREPARAÇÃO DO RAIO
// =====================================================

function obterFramesPreparacao(totalFrames) {
  return Math.min(
    totalFrames,
    Math.max(
      MINIMO_FRAMES_PREPARACAO,
      Math.ceil(totalFrames * PERCENTUAL_PREPARACAO),
    ),
  );
}

// =====================================================
// DESATIVAR DANO E VISUAL AO FINAL DO RAIO
// =====================================================

function encerrarEfeitoRaio(boss) {
  const ia = boss?.iaCombate;

  if (!ia) return;

  // Desativa imediatamente o dano.
  ia.raioVisualAtivo = false;
  ia.raioAguardandoInicio = false;

  // Remove a área ativa, impedindo colisões
  // de dano após o fim da animação.
  ia.areaRaio = null;

  // Oculta o raio terminado.
  if (boss.raioZonaSprite?.active) {
    boss.raioZonaSprite.setVisible(false);
  }
}

// =====================================================
// LIMPAR O RAIO
// =====================================================

export function limparRaioZona(boss) {
  if (!boss) return;

  const scene = boss.scene;

  if (boss.raioZonaUpdate && scene?.events) {
    scene.events.off(Phaser.Scenes.Events.UPDATE, boss.raioZonaUpdate);
  }

  boss.raioZonaUpdate = null;

  if (boss.raioZonaAoDerrotar && scene?.events) {
    scene.events.off("boss:derrotado", boss.raioZonaAoDerrotar);
  }

  boss.raioZonaAoDerrotar = null;

  if (boss.raioZonaSprite?.scene) {
    boss.raioZonaSprite.destroy();
  }

  boss.raioZonaSprite = null;

  if (!boss.iaCombate) return;

  const ia = boss.iaCombate;

  ia.zonasRaio = [];
  ia.areaRaio = null;
  ia.raioZonaIndice = null;

  ia.raioFrames = [];
  ia.raioFrameVisual = -1;
  ia.raioFramesPreparacao = 0;
  ia.raioAtingiuJogador = false;

  ia.raioInicioMs = null;
  ia.raioDuracaoMs = 0;

  ia.raioVisualAtivo = false;
  ia.raioAguardandoInicio = false;

  desenharDebugZonas(boss);
}

// =====================================================
// INICIAR ATAQUE DE RAIO
// =====================================================

export function iniciarRaioZona(boss) {
  if (!boss?.active || boss.morto) return;

  inicializarDebugZonasRaio(boss);

  limparRaioZona(boss);

  const scene = boss.scene;
  const ia = boss.iaCombate;

  const indice = escolherZona(boss);

  const areaDano = obterAreaZona(indice);

  const areaVisual = obterAreaVisualZona(indice);

  ia.zonasRaio = [indice + 1];
  ia.areaRaio = areaDano;
  ia.raioZonaIndice = indice;
  ia.raioAtingiuJogador = false;

  if (!scene.textures.exists(TEXTURA_RAIO)) {
    console.error("Boss: textura boss-raio-zona não carregada.");
    return;
  }

  const frames = obterFramesRaio(scene);

  if (frames.length === 0) {
    console.error("Boss: nenhum frame encontrado no raio.");
    return;
  }

  ia.raioFrames = frames;

  ia.raioFramesPreparacao = obterFramesPreparacao(frames.length);

  ia.raioFrameVisual = -1;

  ia.raioInicioMs = null;
  ia.raioDuracaoMs = 0;

  ia.raioVisualAtivo = false;
  ia.raioAguardandoInicio = true;

  // ===================================================
  // CRIAR SPRITE INVISÍVEL
  // ===================================================

  const sprite = scene.add.sprite(
    areaVisual.centerX,
    areaVisual.y,
    TEXTURA_RAIO,
    frames[0],
  );

  sprite.setOrigin(0.5, 0);

  sprite.setDisplaySize(areaVisual.width, areaVisual.height);

  sprite.setDepth(bossDepth - 0.5);

  sprite.setVisible(false);

  boss.raioZonaSprite = sprite;

  atualizarProfundidadeRaio(boss);
  desenharDebugZonas(boss);

  // ===================================================
  // ATUALIZAÇÃO DO RAIO
  // ===================================================

  const aoAtualizar = () => {
    atualizarRaioZona(boss);
  };

  boss.raioZonaUpdate = aoAtualizar;

  scene.events.on(Phaser.Scenes.Events.UPDATE, aoAtualizar);

  // ===================================================
  // REMOVER AO DERROTAR O BOSS
  // ===================================================

  const aoDerrotar = (evento) => {
    if (evento?.boss === boss) {
      limparRaioZona(boss);
    }
  };

  boss.raioZonaAoDerrotar = aoDerrotar;

  scene.events.on("boss:derrotado", aoDerrotar);
}

// =====================================================
// VERIFICAR QUANDO O RAIO PODE DAR DANO
// =====================================================

export function raioPodeDarDano(boss) {
  const ia = boss?.iaCombate;
  const sprite = boss?.raioZonaSprite;

  if (
    !boss?.active ||
    boss.morto ||
    !ia ||
    ia.ataqueAtual !== "raioChao" ||
    !ia.areaRaio ||
    !ia.raioVisualAtivo ||
    ia.raioAguardandoInicio ||
    !sprite?.active ||
    !sprite.visible ||
    ia.raioInicioMs === null
  ) {
    return false;
  }

  // ===================================================
  // BLOQUEAR DANO APÓS O FIM DA ANIMAÇÃO
  // ===================================================

  const tempoDecorrido = Math.max(0, boss.scene.time.now - ia.raioInicioMs);

  if (ia.raioDuracaoMs <= 0 || tempoDecorrido >= ia.raioDuracaoMs) {
    return false;
  }

  // ===================================================
  // BLOQUEAR DANO NOS FRAMES FINAIS
  // ===================================================

  const totalFrames = ia.raioFrames.length;

  const primeiroFrameFinal = Math.max(0, totalFrames - FRAMES_FINAIS_SEM_DANO);

  // Só causa dano depois da preparação
  // e antes dos frames de desaparecimento.
  return (
    ia.raioFrameVisual >= ia.raioFramesPreparacao &&
    ia.raioFrameVisual < primeiroFrameFinal
  );
}

// =====================================================
// ATUALIZAR ANIMAÇÃO E DANO DO RAIO
// =====================================================

export function atualizarRaioZona(boss) {
  if (!boss?.active || boss.morto) {
    limparRaioZona(boss);
    return;
  }

  const scene = boss.scene;
  const ia = boss.iaCombate;

  if (ia.ataqueAtual !== "raioChao" || !ia.areaRaio) {
    return;
  }

  const sprite = boss.raioZonaSprite;

  if (!sprite?.active) return;

  atualizarProfundidadeRaio(boss);

  // ===================================================
  // AGUARDAR O ROBÔ COMEÇAR A SOLTAR RAIOS
  // ===================================================

  if (ia.raioAguardandoInicio) {
    const frameBoss = obterFrameAtualBoss(boss);

    const totalFramesBoss = obterTotalFramesBoss(boss);

    const frameInicio = Math.min(FRAME_BOSS_INICIO_RAIO, totalFramesBoss - 1);

    if (frameBoss < frameInicio) {
      sprite.setVisible(false);
      return;
    }

    ia.raioAguardandoInicio = false;
    ia.raioVisualAtivo = true;

    ia.raioInicioMs = scene.time.now;

    // Mantém a duração original.
    ia.raioDuracaoMs = obterDuracaoRestanteBoss(boss, frameInicio);

    ia.raioFrameVisual = 0;

    sprite.setFrame(ia.raioFrames[0]);

    sprite.setVisible(true);
  }

  // ===================================================
  // ANIMAR O RAIO
  // ===================================================

  if (!ia.raioVisualAtivo) return;

  const totalFrames = ia.raioFrames.length;

  if (totalFrames === 0) {
    encerrarEfeitoRaio(boss);
    return;
  }

  const tempoDecorrido = Math.max(0, scene.time.now - ia.raioInicioMs);

  // ===================================================
  // DESATIVAR IMEDIATAMENTE QUANDO O RAIO TERMINA
  // ===================================================

  if (ia.raioDuracaoMs <= 0 || tempoDecorrido >= ia.raioDuracaoMs) {
    encerrarEfeitoRaio(boss);
    return;
  }

  // ===================================================
  // SINCRONIZAR O FRAME VISUAL
  // ===================================================

  const progresso = Phaser.Math.Clamp(tempoDecorrido / ia.raioDuracaoMs, 0, 1);

  const indice = Phaser.Math.Clamp(
    Math.floor(progresso * totalFrames),
    0,
    totalFrames - 1,
  );

  if (indice !== ia.raioFrameVisual) {
    ia.raioFrameVisual = indice;

    sprite.setFrame(ia.raioFrames[indice]);
  }

  sprite.setVisible(true);

  desenharDebugZonas(boss);

  // ===================================================
  // APLICAR DANO SOMENTE COM RAIO ATIVO
  // ===================================================

  if (!raioPodeDarDano(boss)) return;

  if (ia.raioAtingiuJogador) return;

  const jogador = scene.player;

  const hitboxJogador = scene.hitboxDanoPlayer;

  if (!jogador?.active || !hitboxJogador) {
    return;
  }

  const atingiu = Phaser.Geom.Intersects.RectangleToRectangle(
    hitboxJogador,
    ia.areaRaio,
  );

  if (!atingiu) return;

  const danoAplicado = causarDanoJogador(boss, danoAtaqueChao);

  if (danoAplicado) {
    ia.raioAtingiuJogador = true;
  }
}
