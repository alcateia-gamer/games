/**
 * @file Ataque elétrico por zonas da arena. Mantém separados os retângulos de dano, a imagem
 * principal, a base, as máscaras e as janelas de frames ofensivos.
 */

import { bossDepth, danoAtaqueChao, duracaoFrame } from "./BossConfig.js";
import { causarDanoJogador } from "./BossCombate.js";

// =====================================================
// 1. AJUSTES MANUAIS DO RAIO DA BASE
// =====================================================
//
// Valores atuais preservados.
// X maior = direita; Y maior = baixo.
// Largura e altura não alteram a hitbox.
// =====================================================

const BASE_IMAGEM_X = -1080;
const BASE_IMAGEM_Y = -6320;

const BASE_IMAGEM_LARGURA = 510;
const BASE_IMAGEM_ALTURA = 650;

// =====================================================
// 2. MÁSCARA VISUAL DA BASE
// =====================================================

const MASCARA_RECUO_ESQUERDA = 0;
const MASCARA_RECUO_DIREITA = 0;

const MASCARA_RECUO_CIMA = 0;
const MASCARA_RECUO_BAIXO = 0;

// =====================================================
// 3. TEXTURAS
// =====================================================

const TEXTURA_RAIO = "boss-raio-zona";
const TEXTURA_RAIO_BASE = "boss-raio-base";

const TEXTURA_BASE_623 = "boss-raio-base-frame-623";

const LARGURA_FRAME_BASE = 311;
const ALTURA_FRAME_BASE = 623;

// =====================================================
// 4. SINCRONIZAÇÃO DO ATAQUE
// =====================================================

// O raio começa no frame 7 do Boss.
const FRAME_BOSS_INICIO_RAIO = 7;

const PERCENTUAL_PREPARACAO = 0.3;
const MINIMO_FRAMES_PREPARACAO = 4;

const FRAMES_FINAIS_SEM_DANO = 2;

// =====================================================
// 5. TRÊS ZONAS PRINCIPAIS
// =====================================================

const ARENA_X_MIN = -1606;
const ARENA_X_MAX = -550;

const ZONA_INICIO_Y = -6161;
const ZONA_FIM_Y = -5426;

const TOTAL_ZONAS = 3;
const CHANCE_PRIORIZAR_JOGADOR = 0.75;

const LARGURA_ZONA = (ARENA_X_MAX - ARENA_X_MIN) / TOTAL_ZONAS;

const LARGURA_RAIO_HITBOX = LARGURA_ZONA * 0.98;

const LARGURA_RAIO_VISUAL = LARGURA_ZONA * 1.24;
const ALTURA_RAIO = ZONA_FIM_Y - ZONA_INICIO_Y;

// =====================================================
// 5.1 AJUSTES MANUAIS DOS RAIOS DAS ZONAS 1 E 3
// =====================================================
//
// Mantém os ajustes manuais anteriores.
// Não modifica as hitboxes.
// =====================================================

const ZONAS_1_E_3_AJUSTE_X = 0;
const ZONAS_1_E_3_AJUSTE_Y = 0;

const ZONAS_1_E_3_IMAGEM_LARGURA = 510;
const ZONAS_1_E_3_IMAGEM_ALTURA = 735;

// =====================================================
// 6. HITBOX ROXA DA BASE
// =====================================================

const BASE_CENTRO_X = -1080;

const BASE_INICIO_Y = -6161;
const BASE_FIM_Y = -5875;

const LARGURA_HITBOX_BASE = LARGURA_ZONA * 1.04;

const ALTURA_BASE = BASE_FIM_Y - BASE_INICIO_Y;

// =====================================================
// 7. CORES DO DEBUG
// =====================================================

const COR_ZONA_INATIVA = 0x2f7dff;
const COR_ZONA_ATIVA = 0x00d8ff;

const COR_BASE = 0xb266ff;

/**
 * Verifica se as áreas de raio podem ser mostradas na depuração.
 */
function debugHitboxesAtivado(scene) {
  return Boolean(scene?.game?.config?.physics?.arcade?.debug);
}

// =====================================================
// 8. CALCULAR HITBOX DAS ZONAS
// =====================================================

/**
 * Calcula o retângulo de dano da zona selecionada a partir da largura e da origem da arena.
 */
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
// ÁREA VISUAL DO RAIO PRINCIPAL
// =====================================================

/**
 * Calcula a área de desenho do raio, aplicando ajustes visuais específicos sem alterar sua
 * hitbox.
 */
function obterAreaVisualZona(indice) {
  const area = obterAreaZona(indice);

  // Zonas 1 e 3 usam os ajustes manuais.
  if (indice === 0 || indice === 2) {
    return new Phaser.Geom.Rectangle(
      area.centerX + ZONAS_1_E_3_AJUSTE_X - ZONAS_1_E_3_IMAGEM_LARGURA / 2,

      ZONA_INICIO_Y + ZONAS_1_E_3_AJUSTE_Y,

      ZONAS_1_E_3_IMAGEM_LARGURA,
      ZONAS_1_E_3_IMAGEM_ALTURA,
    );
  }

  // Zona 2 mantém as dimensões originais.
  return new Phaser.Geom.Rectangle(
    area.centerX - LARGURA_RAIO_VISUAL / 2,
    ZONA_INICIO_Y,
    LARGURA_RAIO_VISUAL,
    ALTURA_RAIO,
  );
}

// =====================================================
// HITBOX ADICIONAL DA BASE DO BOSS
// =====================================================

/**
 * Retorna o retângulo configurado para o dano elétrico na base do boss.
 */
function obterAreaBase() {
  return new Phaser.Geom.Rectangle(
    BASE_CENTRO_X - LARGURA_HITBOX_BASE / 2,
    BASE_INICIO_Y,
    LARGURA_HITBOX_BASE,
    ALTURA_BASE,
  );
}

// =====================================================
// 9. IDENTIFICAR FRAMES DE UMA TEXTURA
// =====================================================

/**
 * Obtém e ordena numericamente os frames disponíveis na textura de um efeito.
 */
function obterFramesTextura(scene, chave) {
  if (!scene.textures.exists(chave)) {
    return [];
  }

  return scene.textures
    .get(chave)
    .getFrameNames()
    .filter((nome) => /^\d+$/.test(String(nome)))
    .sort((a, b) => Number(a) - Number(b));
}

// =====================================================
// 10. CARREGAR FRAMES DE 311x623 DA BASE
// =====================================================

/**
 * Cria ou recupera a textura de base com recortes de 311 × 623 pixels e sua sequência de
 * frames.
 */
function obterTexturaBaseCorreta(scene) {
  if (!scene.textures.exists(TEXTURA_RAIO_BASE)) {
    console.warn("Boss: textura boss-raio-base não carregada.");
    return null;
  }

  if (!scene.textures.exists(TEXTURA_BASE_623)) {
    const original = scene.textures.get(TEXTURA_RAIO_BASE);

    const imagem = original.getSourceImage();

    if (!imagem?.width || !imagem?.height) {
      return null;
    }

    const larguraValida = imagem.width % LARGURA_FRAME_BASE === 0;

    const alturaValida = imagem.height % ALTURA_FRAME_BASE === 0;

    if (!larguraValida || !alturaValida) {
      console.warn(
        "Boss: dimensões da imagem incompatíveis com 311x623.",
        imagem.width,
        imagem.height,
      );

      return null;
    }

    scene.textures.addSpriteSheet(TEXTURA_BASE_623, imagem, {
      frameWidth: LARGURA_FRAME_BASE,
      frameHeight: ALTURA_FRAME_BASE,
    });
  }

  const frames = obterFramesTextura(scene, TEXTURA_BASE_623);

  if (frames.length === 0) {
    return null;
  }

  return {
    chave: TEXTURA_BASE_623,
    frames,
  };
}

// =====================================================
// 11. PROFUNDIDADE DOS RAIOS - CORRIGIDA
// =====================================================
//
// CORREÇÃO:
//
// ANTES:
// Os raios acompanhavam a profundidade do player,
// ficando aproximadamente em depth 16.4.
//
// Isso fazia os raios aparecerem na frente de
// alguns painéis e estruturas industriais.
//
// AGORA:
// Profundidade fixa = 5.4.
//
// Chão quebrado = 5.5.
// Personagem = 16.5.
// Boss = 21.5.
//
// Os raios ficam atrás das estruturas e
// do personagem, sem alterar seus ataques.
//
// Você pode ajustar manualmente este valor.
// =====================================================

const PROFUNDIDADE_RAIOS = 5.4;

/**
 * Mantém os sprites principal e de base na profundidade visual configurada para os raios.
 */
function atualizarProfundidadeRaio(boss) {
  const sprites = [boss.raioZonaSprite, boss.raioBaseSprite];

  for (const sprite of sprites) {
    if (!sprite?.active) continue;

    if (sprite.depth !== PROFUNDIDADE_RAIOS) {
      sprite.setDepth(PROFUNDIDADE_RAIOS);
    }
  }
}

// =====================================================
// 12. DESENHAR DEBUG DAS HITBOXES
// =====================================================

/**
 * Desenha zonas, base e áreas de dano atuais somente durante a depuração.
 */
function desenharDebugZonas(boss) {
  const graphics = boss.raioZonaDebugGraphics;

  if (!graphics?.scene) return;

  const mostrar = debugHitboxesAtivado(boss.scene) && !boss.morto;

  graphics.setVisible(mostrar);
  graphics.clear();

  if (!mostrar) return;

  const ia = boss.iaCombate;

  // Desenhar as três zonas.
  for (let i = 0; i < TOTAL_ZONAS; i++) {
    const area = obterAreaZona(i);

    const ativa = ia?.raioZonaIndice === i;

    const cor = ativa ? COR_ZONA_ATIVA : COR_ZONA_INATIVA;

    graphics.fillStyle(cor, ativa ? 0.12 : 0.06);

    graphics.fillRect(area.x, area.y, area.width, area.height);

    graphics.lineStyle(ativa ? 4 : 3, cor, ativa ? 1 : 0.7);

    graphics.strokeRect(area.x, area.y, area.width, area.height);
  }

  // Desenhar a hitbox roxa da base.
  if (ia?.areaRaioBase) {
    const area = ia.areaRaioBase;

    graphics.fillStyle(COR_BASE, 0.09);

    graphics.fillRect(area.x, area.y, area.width, area.height);

    graphics.lineStyle(3, COR_BASE, 1);

    graphics.strokeRect(area.x, area.y, area.width, area.height);
  }
}

// =====================================================
// 13. INICIALIZAR DEBUG PERMANENTE
// =====================================================

/**
 * Cria os gráficos de diagnóstico e conecta sua atualização sem registrar listeners repetidos.
 */
export function inicializarDebugZonasRaio(boss) {
  if (!boss?.scene || !boss.active) return;

  const scene = boss.scene;

  if (!boss.raioZonaDebugGraphics?.scene) {
    boss.raioZonaDebugGraphics = scene.add.graphics();

    boss.raioZonaDebugGraphics.setDepth(bossDepth + 5);
  }

  desenharDebugZonas(boss);

  if (!boss.raioZonaDebugUpdate) {
    /**
     * Redesenha as zonas de diagnóstico durante a atualização da cena.
     */
    boss.raioZonaDebugUpdate = () => {
      if (boss?.active && boss.scene) {
        desenharDebugZonas(boss);
      }
    };

    scene.events.on(Phaser.Scenes.Events.UPDATE, boss.raioZonaDebugUpdate);
  }
}

// =====================================================
// 14. DESTRUIR DEBUG
// =====================================================

/**
 * Remove o listener e destrói os gráficos usados para diagnosticar as zonas elétricas.
 */
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
// 15. ESCOLHER UMA DAS TRÊS ZONAS
// =====================================================

/**
 * Escolhe uma zona, priorizando em parte dos sorteios a região em que o jogador está.
 */
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
// 16. FRAME ATUAL DO BOSS
// =====================================================

/**
 * Lê o frame atual da animação do boss com índice iniciado em zero.
 */
function obterFrameAtualBoss(boss) {
  const atual = boss.sprite?.anims?.currentFrame;

  if (Number.isFinite(atual?.index)) {
    return Math.max(0, atual.index - 1);
  }

  return boss.iaCombate?.frame ?? 0;
}

/**
 * Retorna a quantidade de frames da animação atual, com mínimo de um.
 */
function obterTotalFramesBoss(boss) {
  return Math.max(1, boss.sprite?.anims?.currentAnim?.frames?.length ?? 1);
}

// =====================================================
// 17. DURAÇÃO ORIGINAL DO ATAQUE
// =====================================================

/**
 * Estima em milissegundos o tempo que falta na animação a partir do frame indicado.
 */
function obterDuracaoRestanteBoss(boss, frameInicio) {
  const animacao = boss.sprite?.anims?.currentAnim;

  const restante = Math.max(1, obterTotalFramesBoss(boss) - frameInicio);

  const fps = Number(animacao?.frameRate);

  if (Number.isFinite(fps) && fps > 0) {
    return restante * (1000 / fps);
  }

  return restante * duracaoFrame;
}

// =====================================================
// 18. JANELA DE DANO
// =====================================================

/**
 * Calcula quantos frames da sequência serão reservados ao aviso de preparação antes do dano.
 */
function obterFramesPreparacao(totalFrames) {
  return Math.min(
    totalFrames,
    Math.max(
      MINIMO_FRAMES_PREPARACAO,
      Math.ceil(totalFrames * PERCENTUAL_PREPARACAO),
    ),
  );
}

/**
 * Verifica se um frame já passou da preparação e ainda não entrou no trecho final sem dano.
 */
function frameDentroDaJanelaDano(frame, totalFrames) {
  if (totalFrames <= 0) return false;

  const primeiro = obterFramesPreparacao(totalFrames);

  const ultimoExclusivo = Math.max(0, totalFrames - FRAMES_FINAIS_SEM_DANO);

  return frame >= primeiro && frame < ultimoExclusivo;
}

// =====================================================
// 19. MÁSCARA VISUAL DA BASE
// =====================================================
//
// Compatibilidade com Phaser 4 WebGL.
//
// Mantém a máscara e o recorte já existentes.
// Não altera o dano.
// =====================================================

/**
 * Desenha a forma retangular usada para limitar visualmente o raio da base.
 */
function criarMascaraBase(scene, area) {
  const graphics = scene.make.graphics({
    x: 0,
    y: 0,
    add: false,
  });

  graphics.fillStyle(0xffffff, 1);

  const x = area.x + MASCARA_RECUO_ESQUERDA;

  const y = area.y + MASCARA_RECUO_CIMA;

  const largura = Math.max(
    1,
    area.width - MASCARA_RECUO_ESQUERDA - MASCARA_RECUO_DIREITA,
  );

  const altura = Math.max(
    1,
    area.height - MASCARA_RECUO_CIMA - MASCARA_RECUO_BAIXO,
  );

  graphics.fillRect(x, y, largura, altura);

  return graphics;
}

// =====================================================
// APLICAR MÁSCARA COMPATÍVEL
// =====================================================

/**
 * Aplica uma máscara ao sprite da base usando a API disponível no renderizador atual.
 */
function aplicarMascaraBase(scene, sprite, area) {
  const graphics = criarMascaraBase(scene, area);

  let mask = null;

  const usaWebGL = scene.game.renderer.type === Phaser.WEBGL;

  if (usaWebGL) {
    sprite.enableFilters();

    mask = sprite.filters.external.addMask(graphics, false, scene.cameras.main);
  } else {
    mask = graphics.createGeometryMask();

    sprite.setMask(mask);
  }

  return {
    graphics,
    mask,
  };
}

// =====================================================
// 20. CRIAR O RAIO DA BASE
// =====================================================

/**
 * Cria o efeito de base nas zonas que o utilizam, com textura, tamanho e máscara próprios.
 */
function criarRaioBase(boss, indiceZona) {
  // Zona 2 não recebe o raio adicional.
  if (indiceZona === 1) return;

  const scene = boss.scene;
  const ia = boss.iaCombate;

  const dadosBase = obterTexturaBaseCorreta(scene);

  if (!dadosBase) {
    console.warn(
      "Boss: não foi possível carregar RAIO_BOSS_BASE.png com frames 311x623.",
    );

    return;
  }

  const frames = dadosBase.frames;

  const area = obterAreaBase();

  ia.areaRaioBase = area;
  ia.raioFramesBase = frames;
  ia.raioFrameBaseVisual = -1;

  // ================================================
  // CRIAR A IMAGEM DA BASE
  // ================================================

  const sprite = scene.add.sprite(
    BASE_IMAGEM_X,
    BASE_IMAGEM_Y,
    dadosBase.chave,
    frames[0],
  );

  sprite.setOrigin(0.5, 0);

  sprite.setDisplaySize(BASE_IMAGEM_LARGURA, BASE_IMAGEM_ALTURA);

  // ================================================
  // CORREÇÃO: RAIOS ABAIXO DAS ESTRUTURAS
  // ================================================

  sprite.setDepth(PROFUNDIDADE_RAIOS);

  sprite.setVisible(false);

  // ================================================
  // MÁSCARA ORIGINAL
  // ================================================

  const { graphics, mask } = aplicarMascaraBase(scene, sprite, area);

  boss.raioBaseSprite = sprite;
  boss.raioBaseMascara = mask;
  boss.raioBaseMascaraGraphics = graphics;
}

// =====================================================
// 21. ENCERRAR O EFEITO DOS RAIOS
// =====================================================

/**
 * Oculta os efeitos e desativa suas áreas de dano ao encerrar a parte visual do raio.
 */
function encerrarEfeitoRaio(boss) {
  const ia = boss?.iaCombate;

  if (!ia) return;

  ia.raioVisualAtivo = false;
  ia.raioAguardandoInicio = false;

  ia.areaRaio = null;
  ia.areaRaioBase = null;

  if (boss.raioZonaSprite?.active) {
    boss.raioZonaSprite.setVisible(false);
  }

  if (boss.raioBaseSprite?.active) {
    boss.raioBaseSprite.setVisible(false);
  }

  desenharDebugZonas(boss);
}

// =====================================================
// 22. LIMPAR O ATAQUE
// =====================================================

/**
 * Remove sprites, máscaras e listeners do raio e reinicializa seus controles temporários.
 */
export function limparRaioZona(boss) {
  if (!boss) return;

  const scene = boss.scene;

  // Desligar atualização.
  if (boss.raioZonaUpdate && scene?.events) {
    scene.events.off(Phaser.Scenes.Events.UPDATE, boss.raioZonaUpdate);
  }

  boss.raioZonaUpdate = null;

  // Remover listener de derrota.
  if (boss.raioZonaAoDerrotar && scene?.events) {
    scene.events.off("boss:derrotado", boss.raioZonaAoDerrotar);
  }

  boss.raioZonaAoDerrotar = null;

  // ================================================
  // DESTRUIR RAIO PRINCIPAL
  // ================================================

  if (boss.raioZonaSprite?.scene) {
    boss.raioZonaSprite.destroy();
  }

  boss.raioZonaSprite = null;

  // ================================================
  // LIMPEZA DA MÁSCARA
  // ================================================

  const usaWebGL = scene?.game?.renderer?.type === Phaser.WEBGL;

  if (boss.raioBaseSprite?.scene) {
    if (usaWebGL && boss.raioBaseMascara) {
      boss.raioBaseSprite.filters?.external?.remove(boss.raioBaseMascara);
    } else if (boss.raioBaseMascara) {
      boss.raioBaseSprite.clearMask();

      boss.raioBaseMascara.destroy();
    }

    boss.raioBaseSprite.destroy();
  }

  boss.raioBaseSprite = null;
  boss.raioBaseMascara = null;

  if (boss.raioBaseMascaraGraphics) {
    boss.raioBaseMascaraGraphics.destroy();
  }

  boss.raioBaseMascaraGraphics = null;

  if (!boss.iaCombate) return;

  const ia = boss.iaCombate;

  ia.zonasRaio = [];

  ia.areaRaio = null;
  ia.areaRaioBase = null;

  ia.raioZonaIndice = null;

  ia.raioFrames = [];
  ia.raioFramesBase = [];

  ia.raioFrameVisual = -1;
  ia.raioFrameBaseVisual = -1;

  ia.raioFramesPreparacao = 0;

  ia.raioAtingiuJogador = false;

  ia.raioInicioMs = null;
  ia.raioDuracaoMs = 0;

  ia.raioVisualAtivo = false;
  ia.raioAguardandoInicio = false;

  desenharDebugZonas(boss);
}

// =====================================================
// 23. INICIAR O ATAQUE
// =====================================================

/**
 * Escolhe a zona, prepara os efeitos e conecta a atualização e a limpeza ao evento de derrota.
 */
export function iniciarRaioZona(boss) {
  if (!boss?.active || boss.morto) return;

  inicializarDebugZonasRaio(boss);

  limparRaioZona(boss);

  const scene = boss.scene;
  const ia = boss.iaCombate;

  // Escolher zona.
  const indiceZona = escolherZona(boss);

  const areaPrincipal = obterAreaZona(indiceZona);

  const visualPrincipal = obterAreaVisualZona(indiceZona);

  ia.zonasRaio = [indiceZona + 1];

  ia.areaRaio = areaPrincipal;
  ia.raioZonaIndice = indiceZona;

  ia.raioAtingiuJogador = false;

  // Frames do raio principal.
  const frames = obterFramesTextura(scene, TEXTURA_RAIO);

  if (frames.length === 0) {
    console.error("Boss: textura boss-raio-zona não carregada.");

    ia.areaRaio = null;
    return;
  }

  ia.raioFrames = frames;

  ia.raioFramesPreparacao = obterFramesPreparacao(frames.length);

  ia.raioFrameVisual = -1;

  // Aguardar frame 7 do Boss.
  ia.raioInicioMs = null;
  ia.raioDuracaoMs = 0;

  ia.raioVisualAtivo = false;
  ia.raioAguardandoInicio = true;

  // ================================================
  // CRIAR RAIO PRINCIPAL
  // ================================================

  const sprite = scene.add.sprite(
    visualPrincipal.centerX,
    visualPrincipal.y,
    TEXTURA_RAIO,
    frames[0],
  );

  sprite.setOrigin(0.5, 0);

  sprite.setDisplaySize(visualPrincipal.width, visualPrincipal.height);

  // ================================================
  // CORREÇÃO: PROFUNDIDADE FIXA DOS RAIOS
  // ================================================

  sprite.setDepth(PROFUNDIDADE_RAIOS);
  sprite.setVisible(false);

  boss.raioZonaSprite = sprite;

  // ================================================
  // RAIO ADICIONAL DA BASE
  // ================================================

  criarRaioBase(boss, indiceZona);

  atualizarProfundidadeRaio(boss);
  desenharDebugZonas(boss);

  // ================================================
  // ATUALIZAÇÃO DOS RAIOS
  // ================================================

  /**
   * Encaminha cada atualização da cena ao controle de frames e dano da zona de raio.
   */
  boss.raioZonaUpdate = () => {
    atualizarRaioZona(boss);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, boss.raioZonaUpdate);

  // ================================================
  // LIMPEZA AO DERROTAR O BOSS
  // ================================================

  /**
   * Limpa o ataque elétrico quando o evento de derrota corresponde a este boss.
   */
  boss.raioZonaAoDerrotar = (evento) => {
    if (evento?.boss === boss) {
      limparRaioZona(boss);
    }
  };

  scene.events.on("boss:derrotado", boss.raioZonaAoDerrotar);
}

// =====================================================
// 24. VERIFICAR DANO DO RAIO PRINCIPAL
// =====================================================

/**
 * Indica se o raio principal está visível e dentro de uma janela ofensiva válida.
 */
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

  const decorrido = Math.max(0, boss.scene.time.now - ia.raioInicioMs);

  if (ia.raioDuracaoMs <= 0 || decorrido >= ia.raioDuracaoMs) {
    return false;
  }

  return frameDentroDaJanelaDano(ia.raioFrameVisual, ia.raioFrames.length);
}

// =====================================================
// 25. VERIFICAR DANO DO RAIO DA BASE
// =====================================================

/**
 * Exige uma janela válida do raio principal e da base para permitir o dano adicional da base.
 */
function raioBasePodeDarDano(boss) {
  const ia = boss?.iaCombate;
  const sprite = boss?.raioBaseSprite;

  return Boolean(
    raioPodeDarDano(boss) &&
    ia?.areaRaioBase &&
    sprite?.active &&
    sprite.visible &&
    frameDentroDaJanelaDano(ia.raioFrameBaseVisual, ia.raioFramesBase.length),
  );
}

// =====================================================
// 26. ATUALIZAR AS DUAS ANIMAÇÕES
// =====================================================

/**
 * Sincroniza os frames dos efeitos e aplica dano ao jogador apenas nas áreas e janelas ativas.
 */
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

  // ================================================
  // MANTER OS RAIOS NA CAMADA CORRETA
  // ================================================
  //
  // Mesmo durante a animação, a profundidade
  // permanece fixa em 5.4.
  //
  // Não acompanha a depth do personagem.
  // ================================================

  atualizarProfundidadeRaio(boss);

  // ================================================
  // AGUARDAR O FRAME 7 DO BOSS
  // ================================================

  if (ia.raioAguardandoInicio) {
    const inicio = Math.min(
      FRAME_BOSS_INICIO_RAIO,
      obterTotalFramesBoss(boss) - 1,
    );

    if (obterFrameAtualBoss(boss) < inicio) {
      sprite.setVisible(false);

      if (boss.raioBaseSprite?.active) {
        boss.raioBaseSprite.setVisible(false);
      }

      return;
    }

    ia.raioAguardandoInicio = false;
    ia.raioVisualAtivo = true;

    ia.raioInicioMs = scene.time.now;

    ia.raioDuracaoMs = obterDuracaoRestanteBoss(boss, inicio);

    ia.raioFrameVisual = 0;

    sprite.setFrame(ia.raioFrames[0]);

    sprite.setVisible(true);

    // Iniciar raio adicional da base.
    if (boss.raioBaseSprite?.active && ia.raioFramesBase.length > 0) {
      ia.raioFrameBaseVisual = 0;

      boss.raioBaseSprite.setFrame(ia.raioFramesBase[0]);

      boss.raioBaseSprite.setVisible(true);
    }
  }

  if (!ia.raioVisualAtivo) return;

  // ================================================
  // RELÓGIO COMPARTILHADO
  // ================================================

  const decorrido = Math.max(0, scene.time.now - ia.raioInicioMs);

  if (ia.raioDuracaoMs <= 0 || decorrido >= ia.raioDuracaoMs) {
    encerrarEfeitoRaio(boss);
    return;
  }

  const progresso = Phaser.Math.Clamp(decorrido / ia.raioDuracaoMs, 0, 1);

  // ================================================
  // ATUALIZAR RAIO PRINCIPAL
  // ================================================

  const totalFrames = ia.raioFrames.length;

  if (totalFrames === 0) {
    encerrarEfeitoRaio(boss);
    return;
  }

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

  // ================================================
  // ATUALIZAR RAIO DA BASE
  // ================================================

  const base = boss.raioBaseSprite;

  const totalBase = ia.raioFramesBase.length;

  if (base?.active && totalBase > 0) {
    const indiceBase = Phaser.Math.Clamp(
      Math.floor(progresso * totalBase),
      0,
      totalBase - 1,
    );

    if (indiceBase !== ia.raioFrameBaseVisual) {
      ia.raioFrameBaseVisual = indiceBase;

      base.setFrame(ia.raioFramesBase[indiceBase]);
    }

    base.setVisible(true);
  }

  desenharDebugZonas(boss);

  // ================================================
  // VERIFICAR DANO DAS DUAS HITBOXES
  // ================================================

  if (ia.raioAtingiuJogador) return;

  const jogador = scene.player;
  const hitboxJogador = scene.hitboxDanoPlayer;

  if (!jogador?.active || !hitboxJogador) {
    return;
  }

  // Dano da zona principal.
  const atingiuPrincipal =
    raioPodeDarDano(boss) &&
    Phaser.Geom.Intersects.RectangleToRectangle(hitboxJogador, ia.areaRaio);

  // Dano adicional da base.
  const atingiuBase =
    raioBasePodeDarDano(boss) &&
    Phaser.Geom.Intersects.RectangleToRectangle(hitboxJogador, ia.areaRaioBase);

  if (!atingiuPrincipal && !atingiuBase) {
    return;
  }

  const danoAplicado = causarDanoJogador(boss, danoAtaqueChao);

  if (danoAplicado) {
    ia.raioAtingiuJogador = true;
  }
}
