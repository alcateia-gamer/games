import {
  curaRecVidaPorFrame,
  danoAtaqueChao,
  emitirEventoBoss,
  atualizarBarraVidaBoss,
} from "./BossConfig.js";

import {
  removerColisaoBoss,
  socoComDanoAtivo,
  ataqueAcertaZonaVerde,
} from "./BossHitboxes.js";

import { tomarDano } from "../../player/PlayerStatus.js";

import mostrarTelaMorte from "../../scenes/DeathScreen.js";

// =====================================================
// CONFIGURAÇÃO DO EFEITO VISUAL DE DANO
// =====================================================

// Vermelho forte, preservando a textura original.
const COR_DANO = 0xff4040;

// =====================================================
// OBTER RETANGULO DE UM OBJETO
// =====================================================

function obterRetanguloCorpo(objeto) {
  if (!objeto) {
    return null;
  }

  if (objeto.body?.enable) {
    return new Phaser.Geom.Rectangle(
      objeto.body.x,
      objeto.body.y,
      objeto.body.width,
      objeto.body.height,
    );
  }

  return objeto.getBounds?.() || null;
}

// =====================================================
// CAUSAR DANO AO JOGADOR
// =====================================================

export function causarDanoJogador(boss, quantidade) {
  const scene = boss.scene;
  const player = scene?.player;

  if (!player?.active || player.invulneravel || scene.morteEmAndamento) {
    return false;
  }

  player.invulneravel = true;

  tomarDano(scene, quantidade);

  // Vermelho mais intenso, sem esconder os detalhes.
  player.setTint(COR_DANO);
  player.setTintMode(Phaser.TintModes.MULTIPLY);

  scene.time.delayedCall(500, () => {
    if (!player.active) {
      return;
    }

    player.invulneravel = false;
    player.clearTint();
  });

  emitirEventoBoss(boss, "boss:acertou-jogador", {
    dano: quantidade,
    vidaJogador: scene.vida,
  });

  if (scene.vida <= 0) {
    mostrarTelaMorte(scene);
  }

  return true;
}

// =====================================================
// APLICAR DANO DO ATAQUE NO CHAO
// =====================================================
//
// REGRAS:
//
// 1. O Boss precisa estar atacando o chao.
//
// 2. O frame atual precisa ser um frame
//    de impacto.
//
// 3. A hitbox de recebimento de dano do
//    jogador precisa intersectar o
//    retangulo AZUL.
//
// 4. Estar fora da area AZUL nao causa dano.
//
// 5. Cada execucao do golpe causa
//    no maximo um acerto.
// =====================================================

export function aplicarDanoDoAtaque(boss) {
  if (!boss?.active || boss.morto) {
    return;
  }

  const scene = boss.scene;
  const ia = boss.iaCombate;
  const player = scene.player;

  if (!socoComDanoAtivo(boss)) {
    return;
  }

  if (ia.jogadorAtingidoNesteAtaque) {
    return;
  }

  if (!player?.active) {
    return;
  }

  // Hitbox real de recebimento de dano do jogador.
  const hitboxJogador = scene.hitboxDanoPlayer;

  if (!hitboxJogador) {
    return;
  }

  // Hitbox azul do ataque.
  const hitboxAzul = boss.areaDanoChao;

  if (!hitboxAzul) {
    return;
  }

  const jogadorDentroDaArea = Phaser.Geom.Intersects.RectangleToRectangle(
    hitboxJogador,
    hitboxAzul,
  );

  if (!jogadorDentroDaArea) {
    return;
  }

  const danoAplicado = causarDanoJogador(boss, danoAtaqueChao);

  if (danoAplicado) {
    ia.jogadorAtingidoNesteAtaque = true;
  }
}

// =====================================================
// RECUPERACAO DE VIDA DO BOSS
// =====================================================

export function aplicarCuraDoFrame(boss) {
  const ia = boss.iaCombate;
  const frame = ia.frame;

  if (
    ia.ataqueAtual !== "recVida" ||
    frame < 10 ||
    frame > 19 ||
    ia.framesCuraAplicados.has(frame)
  ) {
    return;
  }

  ia.framesCuraAplicados.add(frame);

  const vidaAnterior = boss.vida;

  boss.vida = Phaser.Math.Clamp(
    boss.vida + curaRecVidaPorFrame,
    0,
    boss.vidaMaxima,
  );

  atualizarBarraVidaBoss(boss);

  if (boss.vida !== vidaAnterior) {
    emitirEventoBoss(boss, "boss:vida-alterada", {
      vida: boss.vida,
      vidaMaxima: boss.vidaMaxima,
    });
  }
}

// =====================================================
// CAUSAR DANO AO BOSS
// =====================================================
//
// Quando regiaoAtaque for fornecida,
// o ataque deve intersectar a cabeca
// ou o corpo VERDE.
//
// Sem regiaoAtaque, permite dano direto
// de scripts ou eventos do jogo.
// =====================================================

export function causarDanoBoss(scene, quantidade, regiaoAtaque = null) {
  const boss = scene?.bossFinal;

  if (
    !boss?.active ||
    boss.morto ||
    !Number.isFinite(quantidade) ||
    quantidade <= 0
  ) {
    return false;
  }

  if (regiaoAtaque && !ataqueAcertaZonaVerde(boss, regiaoAtaque)) {
    return false;
  }

  // Aplicar dano.
  boss.vida = Phaser.Math.Clamp(boss.vida - quantidade, 0, boss.vidaMaxima);

  atualizarBarraVidaBoss(boss);

  // Vermelho mais forte, mantendo os detalhes do boss.
  boss.sprite.setTint(COR_DANO);
  boss.sprite.setTintMode(Phaser.TintModes.MULTIPLY);

  scene.time.delayedCall(100, () => {
    if (boss.active && !boss.morto) {
      boss.sprite.clearTint();
    }
  });

  emitirEventoBoss(boss, "boss:vida-alterada", {
    vida: boss.vida,
    vidaMaxima: boss.vidaMaxima,
  });

  // ===============================================
  // MORTE DO BOSS
  // ===============================================

  if (boss.vida === 0) {
    boss.morto = true;

    boss.iaCombate.ataqueAtual = null;

    boss.sprite.anims.stop();

    removerColisaoBoss(boss);

    boss.setVisible(false);

    emitirEventoBoss(boss, "boss:derrotado");
  }

  return true;
}

// =====================================================
// OBTER HITBOX DA KATANA
// =====================================================

function obterRetanguloKatana(scene) {
  const player = scene.player;

  if (!player?.active) {
    return null;
  }

  let x = player.x;
  let y = player.y;

  let largura = 54;
  let altura = 54;

  const direcao = scene.direcaoAtaque ?? scene.direcaoAtual;

  switch (direcao) {
    case "up":
      y -= 26;
      largura = 90;
      altura = 44;
      break;

    case "down":
      y += 26;
      largura = 90;
      altura = 44;
      break;

    case "left":
      x -= 30;
      largura = 44;
      altura = 90;
      break;

    case "right":
      x += 30;
      largura = 44;
      altura = 90;
      break;
  }

  return new Phaser.Geom.Rectangle(
    x - largura / 2,
    y - altura / 2,
    largura,
    altura,
  );
}

// =====================================================
// PROCESSAR ATAQUES DO JOGADOR CONTRA O BOSS
// =====================================================

export function processarAtaquesJogadorContraBoss(scene, delta = 16.67) {
  const boss = scene.bossFinal;

  if (!boss?.active || boss.morto) {
    return;
  }

  const ia = boss.iaCombate;

  const tempoDecorrido = Number.isFinite(delta) ? Math.max(0, delta) : 16.67;

  // ===============================================
  // ATAQUE DE ESPADA
  // ===============================================

  const atacando = Boolean(scene.atacando || scene.player?.atacando);

  if (atacando && !ia.ataqueJogadorAnterior) {
    ia.janelaKatanaRestante = 140;
    ia.katanaAtingiuBoss = false;
  }

  ia.ataqueJogadorAnterior = atacando;

  if (atacando && ia.janelaKatanaRestante > 0 && !ia.katanaAtingiuBoss) {
    const regiaoAtaque = obterRetanguloKatana(scene);

    if (regiaoAtaque && causarDanoBoss(scene, 25, regiaoAtaque)) {
      ia.katanaAtingiuBoss = true;
    }
  }

  ia.janelaKatanaRestante = Math.max(
    0,
    ia.janelaKatanaRestante - tempoDecorrido,
  );

  if (boss.morto) {
    return;
  }

  // ===============================================
  // PROJETEIS DO JOGADOR
  // ===============================================

  const grupo = scene.projeteisPlayer;

  if (!grupo?.active || typeof grupo.getChildren !== "function") {
    return;
  }

  for (const projetil of [...grupo.getChildren()]) {
    if (!projetil?.active || projetil.acertou || !projetil.body?.enable) {
      continue;
    }

    const areaProjetil = obterRetanguloCorpo(projetil);

    if (!areaProjetil) {
      continue;
    }

    const acertou = causarDanoBoss(scene, projetil.dano || 25, areaProjetil);

    if (!acertou) {
      continue;
    }

    projetil.acertou = true;
    projetil.destroy();

    if (boss.morto) {
      break;
    }
  }
}
