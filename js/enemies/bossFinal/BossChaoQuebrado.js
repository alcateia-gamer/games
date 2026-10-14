import { framesImpactoChao } from "./BossConfig.js";

// =====================================================
// SISTEMA DE RACHADURAS PERMANENTES DO BOSS FINAL
// =====================================================
//
// NOVO PNG: chao_quebrando_1.png
//
// Cada batida avança um frame:
//
//  1ª batida -> frame 0
//  2ª batida -> frame 1
//  3ª batida -> frame 2
//  4ª batida -> frame 3
//  5ª batida -> frame 4
//  6ª batida -> frame 5
//  7ª batida -> frame 6
//  8ª batida -> frame 7
//  9ª batida -> frame 8
// 10ª batida -> frame 9
// 11ª batida -> frame 10
//
// Após a 11ª batida, permanece no frame 10.
//
// As rachaduras permanecem após a morte do Boss.
//
// Não altera sons, danos, hitboxes ou ataques.
// =====================================================

// =====================================================
// 1. CONFIGURAÇÕES DA IMAGEM
// =====================================================

const TEXTURA_CHAO_QUEBRADO = "boss-chao-quebrado";

const CAMINHO_CHAO_QUEBRADO =
  "./assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/chao_quebrando_1.png";

// =====================================================
// CORREÇÃO: TAMANHO EXATO DE CADA FRAME
// =====================================================
//
// X = 627 pixels.
// Y = 627 pixels.
//
// Não utilizar mais 512x512.
//
// =====================================================

const LARGURA_FRAME = 627;
const ALTURA_FRAME = 627;

// Quantidade de frames utilizados.
const TOTAL_FRAMES = 11;

// =====================================================
// 2. AJUSTES MANUAIS DA IMAGEM NO CHÃO
// =====================================================
//
// Valores anteriores preservados.
//
// DESLOCAMENTO_X:
// positivo = direita
// negativo = esquerda
//
// DESLOCAMENTO_Y:
// positivo = baixo
// negativo = cima
//
// LARGURA_CHAO e ALTURA_CHAO controlam
// somente o tamanho visual.
//
// ALPHA_CHAO:
// 1 = totalmente opaco
// 0 = invisível
// =====================================================

const DESLOCAMENTO_X = 0;
const DESLOCAMENTO_Y = 0;

const LARGURA_CHAO = 340;
const ALTURA_CHAO = 270;

const ALPHA_CHAO = 0.42;
const USAR_BLEND_MULTIPLY = true;

// Mantém a imagem abaixo do personagem.
const PROFUNDIDADE_CHAO = 5.3;

// =====================================================
// 3. CONFIGURAR SISTEMA DAS RACHADURAS
// =====================================================

export function configurarChaoQuebradoBoss(scene, boss) {
  if (!scene || !boss?.active || boss.chaoQuebradoConfigurado) {
    return;
  }

  boss.chaoQuebradoConfigurado = true;

  const estado = {
    ativo: true,

    impactos: 0,

    ultimoFrameImpacto: null,

    sprite: null,
  };

  // ===================================================
  // 4. ATUALIZAR IMAGEM DO CHÃO
  // ===================================================

  function atualizarVisualChao() {
    if (!estado.ativo) {
      return;
    }

    // Chão intacto antes da primeira batida.
    if (estado.impactos === 0) {
      return;
    }

    // Aguardar carregamento da textura.
    if (!scene.textures.exists(TEXTURA_CHAO_QUEBRADO)) {
      return;
    }

    // =================================================
    // IDENTIFICAR FRAME ATUAL
    // =================================================
    //
    // Primeiro impacto utiliza frame 0.
    //
    // Último frame utilizado = 10.
    //
    // Nunca ultrapassar o limite.
    // =================================================

    const frameAtual = Math.min(estado.impactos - 1, TOTAL_FRAMES - 1);

    // =================================================
    // CRIAR IMAGEM SOMENTE UMA VEZ
    // =================================================

    if (!estado.sprite?.active) {
      const area = boss.areaDanoChao;

      const centroX = Number.isFinite(area?.centerX) ? area.centerX : boss.x;

      const centroY = Number.isFinite(area?.centerY) ? area.centerY : boss.y;

      estado.sprite = scene.add.sprite(
        centroX + DESLOCAMENTO_X,
        centroY + DESLOCAMENTO_Y,
        TEXTURA_CHAO_QUEBRADO,
        frameAtual,
      );

      // Centralizar imagem.
      estado.sprite.setOrigin(0.5, 0.5);

      // =================================================
      // TAMANHO VISUAL ANTERIOR PRESERVADO
      // =================================================

      estado.sprite.setDisplaySize(LARGURA_CHAO, ALTURA_CHAO);

      // =================================================
      // PROFUNDIDADE ANTERIOR PRESERVADA
      // =================================================

      estado.sprite.setDepth(PROFUNDIDADE_CHAO);

      estado.sprite.setScrollFactor(1);

      // =================================================
      // TRANSPARÊNCIA ANTERIOR PRESERVADA
      // =================================================

      estado.sprite.setAlpha(ALPHA_CHAO);

      if (USAR_BLEND_MULTIPLY) {
        estado.sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
      }

      estado.sprite.setName("boss-chao-quebrado-permanente");

      return;
    }

    // =================================================
    // ATUALIZAR APENAS O FRAME
    // =================================================
    //
    // Não alterar posição.
    // Não alterar tamanho.
    // Não reiniciar a imagem.
    // =================================================

    estado.sprite.setFrame(frameAtual);

    estado.sprite.setDepth(PROFUNDIDADE_CHAO);
    estado.sprite.setAlpha(ALPHA_CHAO);

    if (USAR_BLEND_MULTIPLY) {
      estado.sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
  }

  // ===================================================
  // 5. INÍCIO DE NOVO ATAQUE
  // ===================================================

  function aoIniciarAtaque(evento) {
    if (evento?.boss !== boss || evento.estado !== "ataqueChao") {
      return;
    }

    // Reiniciar somente controle de duplicação.
    // Não reiniciar contador de rachaduras.
    estado.ultimoFrameImpacto = null;
  }

  // ===================================================
  // 6. PROCESSAR IMPACTOS DO BOSS
  // ===================================================
  //
  // A animação possui dois frames de impacto:
  //
  // Frame 6  = primeira batida.
  // Frame 12 = segunda batida.
  //
  // Cada impacto avança um frame do PNG.
  // ===================================================

  function aoFrameAtaque(evento) {
    if (!estado.ativo) {
      return;
    }

    if (
      evento?.boss !== boss ||
      evento.estado !== "ataqueChao" ||
      evento.ataque !== "chao"
    ) {
      return;
    }

    if (boss.morto || boss.dentroArena !== true) {
      return;
    }

    const frameBoss = evento.frame;

    // Aceitar somente os frames de impacto.
    if (!framesImpactoChao.includes(frameBoss)) {
      return;
    }

    // Impedir contagem duplicada.
    if (estado.ultimoFrameImpacto === frameBoss) {
      return;
    }

    estado.ultimoFrameImpacto = frameBoss;

    // =================================================
    // PARAR DE AVANÇAR NO ÚLTIMO FRAME
    // =================================================

    if (estado.impactos >= TOTAL_FRAMES) {
      return;
    }

    // Registrar batida.
    estado.impactos += 1;

    // Atualizar imagem imediatamente.
    atualizarVisualChao();
  }

  // ===================================================
  // 7. REGISTRAR EVENTOS
  // ===================================================

  scene.events.on("boss:ataque-iniciado", aoIniciarAtaque);

  scene.events.on("boss:ataque-frame", aoFrameAtaque);

  // ===================================================
  // 8. CARREGAR SPRITE SHEET CORRIGIDA
  // ===================================================
  //
  // NOVO PNG:
  // chao_quebrando_1.png
  //
  // CORREÇÃO:
  //
  // frameWidth = 627
  // frameHeight = 627
  //
  // Mantém os primeiros 11 frames.
  // ===================================================

  const EVENTO_ARQUIVO_CARREGADO = `filecomplete-spritesheet-${TEXTURA_CHAO_QUEBRADO}`;

  function aoCarregarTextura() {
    if (!estado.ativo) {
      return;
    }

    atualizarVisualChao();
  }

  function aoErroCarregamento(arquivo) {
    if (arquivo?.key !== TEXTURA_CHAO_QUEBRADO) {
      return;
    }

    console.error(
      "Boss: não foi possível carregar chao_quebrando_1.png.",
      arquivo.src,
    );
  }

  if (!scene.textures.exists(TEXTURA_CHAO_QUEBRADO)) {
    scene.load.once(EVENTO_ARQUIVO_CARREGADO, aoCarregarTextura);

    scene.load.on("loaderror", aoErroCarregamento);

    scene.load.spritesheet(TEXTURA_CHAO_QUEBRADO, CAMINHO_CHAO_QUEBRADO, {
      frameWidth: LARGURA_FRAME,
      frameHeight: ALTURA_FRAME,
      endFrame: TOTAL_FRAMES - 1,
    });

    scene.load.start();
  }

  // ===================================================
  // 9. LIMPEZA AO ENCERRAR A CENA
  // ===================================================
  //
  // As rachaduras permanecem após a morte do Boss.
  //
  // Somente o encerramento da cena
  // remove a imagem.
  // ===================================================

  function limparSistemaChao() {
    if (!estado.ativo) {
      return;
    }

    estado.ativo = false;

    scene.events.off("boss:ataque-iniciado", aoIniciarAtaque);

    scene.events.off("boss:ataque-frame", aoFrameAtaque);

    scene.load.off(EVENTO_ARQUIVO_CARREGADO, aoCarregarTextura);

    scene.load.off("loaderror", aoErroCarregamento);

    if (estado.sprite?.scene) {
      estado.sprite.destroy();
    }

    estado.sprite = null;

    boss.chaoQuebradoConfigurado = false;
  }

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limparSistemaChao);
}
