import { framesImpactoChao } from "./BossConfig.js";

// =====================================================
// SISTEMA DE RACHADURAS PERMANENTES DO BOSS FINAL
// =====================================================
//
// 1ª batida -> frame 0
// 2ª batida -> frame 1
// 3ª batida -> frame 2
// 4ª batida -> frame 3
// 5ª batida -> frame 4
// 6ª batida -> frame 5
//
// Após a sexta batida, permanece no frame 5.
//
// O sprite não é filho do Boss.
// Portanto, continua no chão após a derrota.
//
// Melhorias visuais:
// - mais transparência
// - blend mode MULTIPLY
// - tamanho um pouco menor
//
// CORREÇÃO ATUAL:
// - depth reduzida para ficar abaixo do personagem
// =====================================================

// =====================================================
// 1. CONFIGURAÇÕES DA IMAGEM
// =====================================================

const TEXTURA_CHAO_QUEBRADO = "boss-chao-quebrado";

const CAMINHO_CHAO_QUEBRADO =
  "./assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/chao_quebrado.png";

const LARGURA_FRAME = 627;
const ALTURA_FRAME = 627;
const TOTAL_FRAMES = 6;

// =====================================================
// 2. AJUSTES MANUAIS DA IMAGEM NO CHÃO
// =====================================================
//
// DESLOCAMENTO_X:
// positivo = direita
// negativo = esquerda
//
// DESLOCAMENTO_Y:
// positivo = baixo
// negativo = cima
//
// LARGURA_CHAO e ALTURA_CHAO controlam só a imagem.
//
// ALPHA_CHAO:
// 1 = totalmente opaco
// 0 = invisível
//
// MULTIPLY costuma encaixar melhor no piso,
// deixando as rachaduras mais naturais.
//
// PROFUNDIDADE_CHAO:
// menor = mais para trás
// maior = mais para frente
//
// Agora está baixa o suficiente para ficar
// abaixo do personagem.
// =====================================================

const DESLOCAMENTO_X = 0;
const DESLOCAMENTO_Y = 0;

const LARGURA_CHAO = 340;
const ALTURA_CHAO = 270;

const ALPHA_CHAO = 0.42;
const USAR_BLEND_MULTIPLY = true;

// =====================================================
// CORREÇÃO DA DEPTH
// =====================================================
//
// Antes estava alta demais.
//
// No mapa da fábrica, as camadas do chão ficam
// entre depth 1 e 5.
//
// O personagem fica acima disso.
//
// Então deixamos o chão quebrado em 5.5:
// - acima do piso
// - abaixo do personagem
// - sem cobrir o player
// =====================================================

const PROFUNDIDADE_CHAO = 5.5;

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
  // 4. DESENHAR O ESTADO ATUAL DAS RACHADURAS
  // ===================================================

  function atualizarVisualChao() {
    if (!estado.ativo) {
      return;
    }

    if (estado.impactos === 0) {
      return;
    }

    if (!scene.textures.exists(TEXTURA_CHAO_QUEBRADO)) {
      return;
    }

    const frameAtual = Math.min(estado.impactos - 1, TOTAL_FRAMES - 1);

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

      estado.sprite.setOrigin(0.5, 0.5);

      estado.sprite.setDisplaySize(LARGURA_CHAO, ALTURA_CHAO);

      estado.sprite.setDepth(PROFUNDIDADE_CHAO);
      estado.sprite.setScrollFactor(1);

      estado.sprite.setAlpha(ALPHA_CHAO);

      if (USAR_BLEND_MULTIPLY) {
        estado.sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
      }

      estado.sprite.setName("boss-chao-quebrado-permanente");

      return;
    }

    estado.sprite.setFrame(frameAtual);
    estado.sprite.setDepth(PROFUNDIDADE_CHAO);
    estado.sprite.setAlpha(ALPHA_CHAO);

    if (USAR_BLEND_MULTIPLY) {
      estado.sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
  }

  // ===================================================
  // 5. INÍCIO DE NOVO ATAQUE DE SOCO
  // ===================================================

  function aoIniciarAtaque(evento) {
    if (evento?.boss !== boss || evento.estado !== "ataqueChao") {
      return;
    }

    estado.ultimoFrameImpacto = null;
  }

  // ===================================================
  // 6. PROCESSAR IMPACTO REAL
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

    if (!framesImpactoChao.includes(frameBoss)) {
      return;
    }

    if (estado.ultimoFrameImpacto === frameBoss) {
      return;
    }

    estado.ultimoFrameImpacto = frameBoss;

    if (estado.impactos >= TOTAL_FRAMES) {
      return;
    }

    estado.impactos += 1;
    atualizarVisualChao();
  }

  scene.events.on("boss:ataque-iniciado", aoIniciarAtaque);

  scene.events.on("boss:ataque-frame", aoFrameAtaque);

  // ===================================================
  // 7. CARREGAR SPRITESHEET
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
      "Boss: não foi possível carregar chao_quebrado.png.",
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
  // 8. LIMPEZA APENAS AO ENCERRAR A CENA
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
