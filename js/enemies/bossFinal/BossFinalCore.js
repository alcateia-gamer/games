import {
  bossBaseY,
  bossDepth,
  bossVidaMaxima,
  estadosAnimacao,
  localizarPecasBoss,
} from "./BossConfig.js";

import {
  criarAnimacoesBoss,
  registrarListenersBoss,
  exibirEstadoBoss,
} from "./BossAnimacoes.js";

import {
  criarHitboxesBoss,
  removerColisaoBoss,
  atualizarHitboxesBoss,
} from "./BossHitboxes.js";

import {
  preverPosicaoJogador,
  observarEsquivaLaser,
  atualizarIABoss,
  solicitarAtaqueBoss as solicitarAtaqueOriginal,
} from "./BossIA.js";

import {
  aplicarCuraDoFrame,
  aplicarDanoDoAtaque,
  causarDanoBoss,
  processarAtaquesJogadorContraBoss,
} from "./BossCombate.js";

// =====================================================
// POSIÇÃO E TAMANHO DO BOSS
// =====================================================

const POSICAO_BOSS_X = -1080;
const ESCALA_BOSS = 1.4;

// =====================================================
// ÁREA DE ZOOM DA ARENA
// =====================================================

// O zoom aberto permanece em toda esta largura.
const ARENA_X_MIN = -1606;
const ARENA_X_MAX = -600;

// Entrando nesta coordenada e seguindo para cima.
const ENTRADA_ARENA_Y = -5470;

// Pequena margem vertical para evitar alternância na entrada.
const MARGEM_SAIDA_Y = 80;

const FATOR_ZOOM_ARENA = 0.8;
const VELOCIDADE_ZOOM = 5;

// =====================================================
// VIDA E ESTAMINA
// =====================================================

const MULTIPLICADOR_VIDA = 2;
const ESTAMINA_MAXIMA = 100;

const CUSTO_ESTAMINA = {
  chao: 20,
  raio: 20,
  laser: 20,
  rec: 20,
};

// Recuperação total: 3,5 segundos.
const PAUSA_ESTAMINA_MS = 250;
const RECUPERACAO_ESTAMINA_MS = 3250;

// =====================================================
// APARÊNCIA DO HUD DO BOSS
// =====================================================

const POSICAO_VERTICAL_HUD = 0.9;
const POSICAO_ESTAMINA_Y = -18;

const ALTURA_VIDA = 18;
const ALTURA_ESTAMINA = 10;
const MARGEM_INTERNA = 2;

const OPACIDADE_FUNDO = 0.22;
const ESPESSURA_CONTORNO = 1;
const OPACIDADE_CONTORNO = 0.55;

// =====================================================
// CONTROLE DO ZOOM
// =====================================================

function configurarCameraArena(scene, boss) {
  let dentroArena = false;
  let controlandoZoom = false;
  let cameraControlada = null;
  let zoomNormal = 1;

  // A barra começa invisível fora da arena.
  boss.dentroArena = false;

  const atualizarCamera = (_tempo, delta = 16.67) => {
    const camera = scene.cameras.main;
    const player = scene.player;

    if (!camera) return;

    if (cameraControlada && cameraControlada !== camera) {
      if (controlandoZoom) {
        cameraControlada.setZoom(zoomNormal);
      }

      dentroArena = false;
      controlandoZoom = false;
      cameraControlada = null;
    }

    const podeEntrar = boss.active && !boss.morto && player?.active;

    if (podeEntrar) {
      const dentroDaLargura =
        player.x >= ARENA_X_MIN && player.x <= ARENA_X_MAX;

      if (!dentroArena) {
        const entrouNaArena = dentroDaLargura && player.y <= ENTRADA_ARENA_Y;

        if (entrouNaArena) {
          dentroArena = true;

          if (!controlandoZoom) {
            zoomNormal = camera.zoom;
            cameraControlada = camera;
            controlandoZoom = true;
          }
        }
      } else {
        const saiuPelosLados = !dentroDaLargura;

        const saiuPelaEntrada = player.y > ENTRADA_ARENA_Y + MARGEM_SAIDA_Y;

        if (saiuPelosLados || saiuPelaEntrada) {
          dentroArena = false;
        }
      }
    } else {
      dentroArena = false;
    }

    // O HUD acompanha exatamente o estado da arena.
    // Aparece ao iniciar o zoom afastado e desaparece
    // ao sair da região do confronto.
    boss.dentroArena = dentroArena;

    if (!controlandoZoom) return;

    const destino = dentroArena ? zoomNormal * FATOR_ZOOM_ARENA : zoomNormal;

    const deltaSeguro = Number.isFinite(delta) ? Math.max(0, delta) : 16.67;

    const suavidade = 1 - Math.exp((-VELOCIDADE_ZOOM * deltaSeguro) / 1000);

    const novoZoom = camera.zoom + (destino - camera.zoom) * suavidade;

    if (Math.abs(novoZoom - destino) < 0.001) {
      camera.setZoom(destino);

      if (!dentroArena) {
        controlandoZoom = false;
        cameraControlada = null;
      }
    } else {
      camera.setZoom(novoZoom);
    }
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, atualizarCamera);

  boss.limparCameraArena = () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, atualizarCamera);

    if (controlandoZoom && cameraControlada) {
      cameraControlada.setZoom(zoomNormal);
    }

    dentroArena = false;
    boss.dentroArena = false;
    boss.hudVida?.setVisible(false);

    controlandoZoom = false;
    cameraControlada = null;
  };
}

// =====================================================
// RECUPERAÇÃO DA ESTAMINA
// =====================================================

function iniciarRecuperacaoEstamina(boss) {
  if (boss.morto || boss.recuperandoEstamina) return;

  boss.estamina = 0;
  boss.recuperandoEstamina = true;
  boss.tempoRecuperacaoEstamina = 0;

  const ia = boss.iaCombate;

  ia.ataqueAtual = null;
  ia.ataqueSolicitado = null;
  ia.frameMiraTravada = null;
  ia.direcaoLaser = null;
  ia.posicaoNoDisparo = null;
  ia.zonasRaio = [];
  ia.areaRaio = null;
  ia.jogadorAtingidoNesteAtaque = false;
  ia.framesCuraAplicados.clear();
  ia.tempoAteDecidir = 0;

  exibirEstadoBoss(boss, "idle");
  boss.sprite.anims.stop();

  ia.estado = "RECUPERANDO_ESTAMINA";
}

function atualizarRecuperacaoEstamina(boss, delta) {
  if (!boss.recuperandoEstamina) return;

  const deltaSeguro = Number.isFinite(delta) ? Math.max(0, delta) : 16.67;

  boss.tempoRecuperacaoEstamina += deltaSeguro;

  const ia = boss.iaCombate;

  ia.ataqueSolicitado = null;
  ia.tempoAteDecidir = 0;
  ia.estado = "RECUPERANDO_ESTAMINA";

  ia.cooldownRecVidaRestante = Math.max(
    0,
    ia.cooldownRecVidaRestante - deltaSeguro,
  );

  const tempoEnchendo = Math.max(
    0,
    boss.tempoRecuperacaoEstamina - PAUSA_ESTAMINA_MS,
  );

  const progresso = Phaser.Math.Clamp(
    tempoEnchendo / RECUPERACAO_ESTAMINA_MS,
    0,
    1,
  );

  boss.estamina = boss.estaminaMaxima * progresso;

  if (progresso >= 1) {
    boss.estamina = boss.estaminaMaxima;
    boss.recuperandoEstamina = false;
    boss.tempoRecuperacaoEstamina = 0;

    ia.estado = "IDLE";
    ia.tempoAteDecidir = 0;
    ia.posicaoAnterior = null;
    ia.distanciaAnterior = null;
  }
}

// =====================================================
// DESENHO DAS BARRAS
// =====================================================

function desenharFundoArredondado(grafico, largura, altura, centroY) {
  grafico.clear();

  const x = -largura / 2;
  const y = centroY - altura / 2;
  const raio = Math.min(altura / 2, largura / 2);

  grafico.fillStyle(0x000000, OPACIDADE_FUNDO);
  grafico.fillRoundedRect(x, y, largura, altura, raio);

  grafico.lineStyle(ESPESSURA_CONTORNO, 0x000000, OPACIDADE_CONTORNO);

  grafico.strokeRoundedRect(x, y, largura, altura, raio);
}

function desenharPreenchimentoArredondado(
  grafico,
  larguraMaxima,
  altura,
  centroY,
  percentual,
  cor,
) {
  grafico.clear();

  const proporcao = Phaser.Math.Clamp(percentual, 0, 1);

  const larguraAtual = larguraMaxima * proporcao;

  if (larguraAtual <= 0) return;

  const direita = larguraMaxima / 2;
  const x = direita - larguraAtual;
  const y = centroY - altura / 2;
  const raio = Math.min(altura / 2, larguraAtual / 2);

  grafico.fillStyle(cor, 1);

  grafico.fillRoundedRect(x, y, larguraAtual, altura, raio);
}

// =====================================================
// HUD DO BOSS
// =====================================================

function criarHudBoss(scene, boss) {
  boss.hudVida = scene.add.container(0, 0).setScrollFactor(0).setDepth(100000);

  boss.fundoVida = scene.add.graphics();
  boss.barraVida = scene.add.graphics();
  boss.fundoEstamina = scene.add.graphics();
  boss.barraEstamina = scene.add.graphics();

  boss.hudVida.add([
    boss.fundoVida,
    boss.barraVida,
    boss.fundoEstamina,
    boss.barraEstamina,
  ]);

  // O HUD nunca deve aparecer antes do confronto.
  boss.hudVida.setVisible(false);

  const atualizarHud = () => {
    if (!boss.hudVida?.scene) return;

    const camera = scene.cameras.main;

    const zoomX = camera.zoomX || camera.zoom || 1;

    const zoomY = camera.zoomY || camera.zoom || 1;

    const largura = Math.min(320, camera.width * 0.38);

    const larguraInterna = Math.max(0, largura - MARGEM_INTERNA * 2);

    const centroX = camera.width * camera.originX;

    const centroY = camera.height * camera.originY;

    const telaX = camera.width * 0.5;
    const telaY = camera.height * POSICAO_VERTICAL_HUD;

    boss.hudVida.setPosition(
      centroX + (telaX - centroX) / zoomX,
      centroY + (telaY - centroY) / zoomY,
    );

    boss.hudVida.setScale(1 / zoomX, 1 / zoomY);

    boss.larguraBarraVida = larguraInterna;

    desenharFundoArredondado(boss.fundoVida, largura, ALTURA_VIDA, 0);

    desenharPreenchimentoArredondado(
      boss.barraVida,
      larguraInterna,
      ALTURA_VIDA - MARGEM_INTERNA * 2,
      0,
      boss.vida / boss.vidaMaxima,
      0xff354d,
    );

    desenharFundoArredondado(
      boss.fundoEstamina,
      largura,
      ALTURA_ESTAMINA,
      POSICAO_ESTAMINA_Y,
    );

    desenharPreenchimentoArredondado(
      boss.barraEstamina,
      larguraInterna,
      ALTURA_ESTAMINA - MARGEM_INTERNA * 2,
      POSICAO_ESTAMINA_Y,
      boss.estamina / boss.estaminaMaxima,
      boss.recuperandoEstamina ? 0xffc857 : 0x45dfff,
    );

    // Exibe vida e estamina somente na arena,
    // usando a mesma condição do zoom.
    boss.hudVida.setVisible(
      boss.active && boss.visible && !boss.morto && boss.dentroArena === true,
    );
  };

  atualizarHud();

  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizarHud);

  boss.limparHudVida = () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarHud);

    if (boss.hudVida?.scene) {
      boss.hudVida.destroy();
    }
  };
}

// =====================================================
// CRIAÇÃO DO BOSS
// =====================================================

function criarBoss(scene) {
  const pecas = localizarPecasBoss(scene);

  if (pecas.length === 0) {
    console.error(
      "IA do Boss: peças ausentes na camada ObjetosBoss perto da posição-base.",
    );
    return null;
  }

  criarAnimacoesBoss(scene);
  pecas.forEach((peca) => peca.destroy());

  const boss = scene.add
    .container(POSICAO_BOSS_X, bossBaseY)
    .setDepth(bossDepth)
    .setName("boss-final");

  boss.bossBaseX = POSICAO_BOSS_X;
  boss.bossBaseY = bossBaseY;
  boss.bossEstadoAtual = "idle";
  boss.morto = false;

  boss.vidaMaxima = bossVidaMaxima * MULTIPLICADOR_VIDA;

  boss.vida = boss.vidaMaxima;
  boss.larguraBarraVida = 206;

  boss.estaminaMaxima = ESTAMINA_MAXIMA;
  boss.estamina = ESTAMINA_MAXIMA;
  boss.recuperandoEstamina = false;
  boss.tempoRecuperacaoEstamina = 0;

  boss.sprite = scene.add
    .sprite(0, 0, estadosAnimacao.idle.textura, 0)
    .setOrigin(0.5, 1)
    .setScale(ESCALA_BOSS);

  boss.add(boss.sprite);
  boss.estadosAnimacao = estadosAnimacao;

  boss.debugDano = scene.add.graphics().setDepth(bossDepth + 2);

  boss.iaCombate = {
    estado: "IDLE",
    ataqueAtual: null,
    ataqueSolicitado: null,
    tempoAteDecidir: 1200,
    ataquesRecentes: [],
    posicaoAnterior: null,
    distanciaAnterior: null,
    velocidadeX: 0,
    velocidadeY: 0,
    direcao: { x: 0, y: 0 },
    aproximacaoRadial: 0,
    aproximando: false,
    afastando: false,
    correndo: false,
    parado: true,
    atacandoPerto: false,
    distancia: Infinity,
    pertoPor: 0,
    longePor: 0,
    pressaoPerto: 0,
    paradoPor: 0,
    regiaoAtual: null,
    tempoNaRegiao: 0,
    aprendizadoEsquiva: 0,
    tendenciaEsquiva: [],
    posicaoNoDisparo: null,
    frameMiraTravada: null,
    frame: 0,
    direcaoLaser: null,
    zonasRaio: [],
    areaRaio: null,
    jogadorAtingidoNesteAtaque: false,
    framesCuraAplicados: new Set(),
    cooldownRecVidaRestante: 0,
    jogadorAtual: scene.player || null,
    ataqueJogadorAnterior: false,
    janelaKatanaRestante: 0,
    katanaAtingiuBoss: false,
  };

  criarHitboxesBoss(scene, boss);
  criarHudBoss(scene, boss);
  configurarCameraArena(scene, boss);

  const aoFinalizarAtaque = (evento) => {
    if (evento?.boss !== boss || boss.morto || boss.recuperandoEstamina) {
      return;
    }

    const custo = CUSTO_ESTAMINA[evento.ataque];

    if (!Number.isFinite(custo)) return;

    boss.estamina = Phaser.Math.Clamp(
      boss.estamina - custo,
      0,
      boss.estaminaMaxima,
    );

    if (boss.estamina <= 0) {
      iniciarRecuperacaoEstamina(boss);
    }
  };

  scene.events.on("boss:ataque-finalizado", aoFinalizarAtaque);

  boss.limparEstamina = () => {
    scene.events.off("boss:ataque-finalizado", aoFinalizarAtaque);
  };

  boss.onAnimationUpdate = null;
  boss.onAnimationComplete = null;

  return boss;
}

// =====================================================
// VINCULAÇÃO E LIMPEZA
// =====================================================

export function vincularIABoss(scene) {
  if (scene.bossFinal?.active) {
    return scene.bossFinal;
  }

  const boss = criarBoss(scene);

  if (!boss) return null;

  registrarListenersBoss(boss, {
    preverPosicaoJogador,
    observarEsquivaLaser,
    aplicarCuraDoFrame,
    aplicarDanoDoAtaque,
  });

  scene.bossFinal = boss;
  atualizarHitboxesBoss(boss);

  let limpo = false;

  const aoEncerrarCena = () => {
    limparBoss();

    if (boss.scene) {
      boss.destroy();
    }
  };

  const limparBoss = () => {
    if (limpo) return;

    limpo = true;

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, aoEncerrarCena);

    if (boss.sprite?.scene) {
      boss.sprite.off("animationupdate", boss.onAnimationUpdate);

      boss.sprite.off("animationcomplete", boss.onAnimationComplete);
    }

    boss.limparCameraArena?.();
    boss.limparHudVida?.();
    boss.limparEstamina?.();

    removerColisaoBoss(boss);

    for (const hitbox of boss.hitboxesColisao || []) {
      if (hitbox.scene) {
        hitbox.destroy();
      }
    }

    if (boss.debugDano?.scene) {
      boss.debugDano.destroy();
    }

    if (scene.bossFinal === boss) {
      scene.bossFinal = null;
    }
  };

  boss.once("destroy", limparBoss);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, aoEncerrarCena);

  return boss;
}

// =====================================================
// PEDIDOS DE ATAQUE
// =====================================================

function solicitarAtaqueBoss(scene, ataque) {
  const boss = scene.bossFinal;

  if (!boss?.active || boss.morto || boss.recuperandoEstamina) {
    return false;
  }

  return solicitarAtaqueOriginal(scene, ataque);
}

// =====================================================
// ATUALIZAÇÃO
// =====================================================

function atualizarBoss(scene, delta = 16.67) {
  const boss = scene.bossFinal;

  if (!boss?.active || boss.morto) return;

  if (boss.recuperandoEstamina) {
    atualizarRecuperacaoEstamina(boss, delta);

    atualizarHitboxesBoss(boss);

    processarAtaquesJogadorContraBoss(scene, delta);

    return;
  }

  atualizarIABoss(scene, delta);
  atualizarHitboxesBoss(boss);

  processarAtaquesJogadorContraBoss(scene, delta);
}

export {
  atualizarBoss as atualizarIABoss,
  causarDanoBoss,
  solicitarAtaqueBoss,
};
