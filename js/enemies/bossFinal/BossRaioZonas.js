import { bossDepth, danoAtaqueChao, duracaoFrame } from "./BossConfig.js";

import { causarDanoJogador } from "./BossCombate.js";

// =====================================================
// 1. AJUSTES MANUAIS DO RAIO DA BASE
// =====================================================
//
// ESTES SÃO OS VALORES QUE VOCÊ JÁ AJUSTOU.
// FORAM PRESERVADOS EXATAMENTE.
//
// X: maior = direita; menor = esquerda.
// Y: maior = desce; menor = sobe.
// LARGURA: aumenta ou diminui a largura.
// ALTURA: aumenta ou diminui a altura.
//
// X é o centro horizontal.
// Y é o topo da imagem.
//
// ESTES VALORES NÃO MUDAM A HITBOX.
// =====================================================

const BASE_IMAGEM_X = -1080;
const BASE_IMAGEM_Y = -6245;

const BASE_IMAGEM_LARGURA = 500;
const BASE_IMAGEM_ALTURA = 520;

// =====================================================
// 2. MÁSCARA VISUAL DA BASE
// =====================================================
//
// Limita a imagem ao retângulo roxo.
// Os quatro recuos abaixo não afetam o dano.
//
// Valores zero usam toda a área da hitbox.
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

// O efeito começa no frame 7 do Boss.
const FRAME_BOSS_INICIO_RAIO = 7;

// Preparação sem dano.
const PERCENTUAL_PREPARACAO = 0.3;
const MINIMO_FRAMES_PREPARACAO = 4;

// Os dois últimos frames não dão dano.
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

// Hitbox original do raio principal.
const LARGURA_RAIO_HITBOX = LARGURA_ZONA * 0.98;

// Tamanho visual original das três zonas.
const LARGURA_RAIO_VISUAL = LARGURA_ZONA * 1.24;
const ALTURA_RAIO = ZONA_FIM_Y - ZONA_INICIO_Y;

// =====================================================
// 5.1 AJUSTES MANUAIS DOS RAIOS DAS ZONAS 1 E 3
// =====================================================
//
// EDITE ESTES VALORES PARA MUDAR AS IMAGENS
// DAS ZONAS 1 (ESQUERDA) E 3 (DIREITA).
//
// OS MESMOS VALORES SERVEM PARA AS DUAS ZONAS.
//
// NÃO ALTERAM A HITBOX DE DANO.
// NÃO ALTERAM A ZONA 2.
// NÃO ALTERAM A ANIMAÇÃO NEM SUA DURAÇÃO.
//
// AJUSTE_X:
//   Maior = desloca para a direita.
//   Menor/negativo = desloca para a esquerda.
//   Zero = posição horizontal original.
//
// AJUSTE_Y:
//   Maior = desloca para baixo.
//   Menor/negativo = desloca para cima.
//   Zero = posição vertical original.
//
// LARGURA:
//   Maior = mais largo.
//   Menor = mais estreito.
//
// ALTURA:
//   Maior = mais alto.
//   Menor = mais baixo.
//
// Os valores iniciais preservam exatamente
// o tamanho e a posição anteriores.
// =====================================================

// POSIÇÃO - deslocamento em unidades do mapa.
const ZONAS_1_E_3_AJUSTE_X = 0;
const ZONAS_1_E_3_AJUSTE_Y = 0;

// TAMANHO - largura e altura da imagem.
const ZONAS_1_E_3_IMAGEM_LARGURA = 500;
const ZONAS_1_E_3_IMAGEM_ALTURA = 735;

// =====================================================
// 6. HITBOX ROXA DA BASE
// =====================================================
//
// Estas coordenadas controlam a HITBOX,
// não a imagem.
//
// Mantidas como estavam no arquivo enviado.
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

// Segue physics.arcade.debug do Phaser.
function debugHitboxesAtivado(scene) {
  return Boolean(scene?.game?.config?.physics?.arcade?.debug);
}

// =====================================================
// 8. CALCULAR HITBOX DAS ZONAS
// =====================================================

// A hitbox permanece independente da imagem.
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
//
// ESTA FUNÇÃO USA OS NOVOS AJUSTES DA SEÇÃO 5.1.
//
// Índice 0 = zona 1.
// Índice 1 = zona 2.
// Índice 2 = zona 3.
//
// Apenas os índices 0 e 2 recebem
// os controles manuais compartilhados.
//
// A hitbox NÃO é alterada.
// =====================================================

function obterAreaVisualZona(indice) {
  const area = obterAreaZona(indice);

  // ZONAS 1 E 3:
  // Utilizam os quatro valores manuais.
  if (indice === 0 || indice === 2) {
    return new Phaser.Geom.Rectangle(
      area.centerX + ZONAS_1_E_3_AJUSTE_X - ZONAS_1_E_3_IMAGEM_LARGURA / 2,

      ZONA_INICIO_Y + ZONAS_1_E_3_AJUSTE_Y,

      ZONAS_1_E_3_IMAGEM_LARGURA,
      ZONAS_1_E_3_IMAGEM_ALTURA,
    );
  }

  // ZONA 2:
  // Continua utilizando o tamanho original.
  return new Phaser.Geom.Rectangle(
    area.centerX - LARGURA_RAIO_VISUAL / 2,
    ZONA_INICIO_Y,
    LARGURA_RAIO_VISUAL,
    ALTURA_RAIO,
  );
}

// Hitbox adicional da base do Boss.
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
//
// Usa a imagem original carregada no preloader.
//
// Se necessário, registra outra textura em
// memória com os frames de 311x623.
//
// Não modifica o PNG original.
// =====================================================

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
// 11. PROFUNDIDADE DOS RAIOS
// =====================================================
//
// Os raios permanecem atrás do personagem.
//
// Controla o raio principal e o raio da base.
// =====================================================

function atualizarProfundidadeRaio(boss) {
  const jogador = boss.scene?.player;

  let profundidade = bossDepth - 0.5;

  if (jogador?.active && Number.isFinite(jogador.depth)) {
    profundidade = Math.min(profundidade, jogador.depth - 0.1);
  }

  const sprites = [boss.raioZonaSprite, boss.raioBaseSprite];

  for (const sprite of sprites) {
    if (!sprite?.active) continue;

    if (sprite.depth !== profundidade) {
      sprite.setDepth(profundidade);
    }
  }
}

// =====================================================
// 12. DESENHAR DEBUG DAS HITBOXES
// =====================================================
//
// Três zonas principais em azul.
// Hitbox adicional da base em roxo.
//
// debug: false esconde apenas os desenhos.
// O dano e as colisões continuam funcionando.
// =====================================================

function desenharDebugZonas(boss) {
  const graphics = boss.raioZonaDebugGraphics;

  if (!graphics?.scene) return;

  const mostrar = debugHitboxesAtivado(boss.scene) && !boss.morto;

  graphics.setVisible(mostrar);
  graphics.clear();

  if (!mostrar) return;

  const ia = boss.iaCombate;

  // Desenha as três zonas principais.
  for (let i = 0; i < TOTAL_ZONAS; i++) {
    const area = obterAreaZona(i);

    const ativa = ia?.raioZonaIndice === i;

    const cor = ativa ? COR_ZONA_ATIVA : COR_ZONA_INATIVA;

    graphics.fillStyle(cor, ativa ? 0.12 : 0.06);

    graphics.fillRect(area.x, area.y, area.width, area.height);

    graphics.lineStyle(ativa ? 4 : 3, cor, ativa ? 1 : 0.7);

    graphics.strokeRect(area.x, area.y, area.width, area.height);
  }

  // Desenha a hitbox roxa adicional.
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

export function inicializarDebugZonasRaio(boss) {
  if (!boss?.scene || !boss.active) return;

  const scene = boss.scene;

  if (!boss.raioZonaDebugGraphics?.scene) {
    boss.raioZonaDebugGraphics = scene.add.graphics();

    boss.raioZonaDebugGraphics.setDepth(bossDepth + 5);
  }

  desenharDebugZonas(boss);

  if (!boss.raioZonaDebugUpdate) {
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

function obterFrameAtualBoss(boss) {
  const atual = boss.sprite?.anims?.currentFrame;

  if (Number.isFinite(atual?.index)) {
    return Math.max(0, atual.index - 1);
  }

  return boss.iaCombate?.frame ?? 0;
}

function obterTotalFramesBoss(boss) {
  return Math.max(1, boss.sprite?.anims?.currentAnim?.frames?.length ?? 1);
}

// =====================================================
// 17. DURAÇÃO ORIGINAL DO ATAQUE
// =====================================================
//
// Mantém o tempo restante da animação do Boss.
// Não acrescenta duração artificial.
// =====================================================

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
//
// Dano começa após a preparação.
//
// Os dois últimos frames não causam dano.
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
// A máscara limita a imagem da base ao
// retângulo roxo.
//
// Não altera a hitbox.
//
// Também não afeta as imagens das zonas 1 e 3.
// =====================================================

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

  return {
    graphics,
    mask: graphics.createGeometryMask(),
  };
}

// =====================================================
// 20. CRIAR O RAIO DA BASE
// =====================================================
//
// Usa os quatro valores da seção 1.
//
// Zona 2 não recebe o PNG adicional.
// Zonas 1 e 3 recebem o PNG da base.
//
// A hitbox roxa permanece inalterada.
// =====================================================

function criarRaioBase(boss, indiceZona) {
  // Índice 1 é a zona 2.
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

  // Hitbox original da base.
  const area = obterAreaBase();

  ia.areaRaioBase = area;
  ia.raioFramesBase = frames;
  ia.raioFrameBaseVisual = -1;

  // ================================================
  // IMAGEM DA BASE - VALORES DO USUÁRIO
  // ================================================

  const sprite = scene.add.sprite(
    BASE_IMAGEM_X,
    BASE_IMAGEM_Y,
    dadosBase.chave,
    frames[0],
  );

  // Centro horizontal e topo vertical.
  sprite.setOrigin(0.5, 0);

  // X = -1080
  // Y = -6270
  // Largura = 500
  // Altura = 520
  //
  // Estes valores foram preservados.
  sprite.setDisplaySize(BASE_IMAGEM_LARGURA, BASE_IMAGEM_ALTURA);

  sprite.setDepth(bossDepth - 0.5);

  // Aguarda a animação do Boss.
  sprite.setVisible(false);

  // ================================================
  // MÁSCARA ROXA
  // ================================================

  const { graphics, mask } = criarMascaraBase(scene, area);

  sprite.setMask(mask);

  boss.raioBaseSprite = sprite;
  boss.raioBaseMascara = mask;
  boss.raioBaseMascaraGraphics = graphics;
}

// =====================================================
// 21. ENCERRAR O EFEITO DOS RAIOS
// =====================================================

function encerrarEfeitoRaio(boss) {
  const ia = boss?.iaCombate;

  if (!ia) return;

  ia.raioVisualAtivo = false;
  ia.raioAguardandoInicio = false;

  // Desativa ambas as áreas de dano.
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

export function limparRaioZona(boss) {
  if (!boss) return;

  const scene = boss.scene;

  // Desliga a atualização.
  if (boss.raioZonaUpdate && scene?.events) {
    scene.events.off(Phaser.Scenes.Events.UPDATE, boss.raioZonaUpdate);
  }

  boss.raioZonaUpdate = null;

  // Remove o listener de derrota.
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
  // DESTRUIR RAIO DA BASE
  // ================================================

  if (boss.raioBaseSprite?.scene) {
    boss.raioBaseSprite.destroy();
  }

  boss.raioBaseSprite = null;

  if (boss.raioBaseMascara) {
    boss.raioBaseMascara.destroy();
  }

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

export function iniciarRaioZona(boss) {
  if (!boss?.active || boss.morto) return;

  inicializarDebugZonasRaio(boss);

  // Remove qualquer efeito anterior.
  limparRaioZona(boss);

  const scene = boss.scene;
  const ia = boss.iaCombate;

  // Escolhe uma das três zonas.
  const indiceZona = escolherZona(boss);

  // Área de dano (não foi alterada).
  const areaPrincipal = obterAreaZona(indiceZona);

  // Área visual (usa ajustes manuais nas zonas 1 e 3).
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

  // Aguarda o frame 7 do Boss.
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

  // Centro horizontal, topo vertical.
  sprite.setOrigin(0.5, 0);

  // Aplica largura e altura visuais.
  //
  // Zona 1 e 3: valores da seção 5.1.
  // Zona 2: valores originais.
  sprite.setDisplaySize(visualPrincipal.width, visualPrincipal.height);

  sprite.setDepth(bossDepth - 0.5);
  sprite.setVisible(false);

  boss.raioZonaSprite = sprite;

  // ================================================
  // RAIO EXTRA NA BASE
  // ================================================

  criarRaioBase(boss, indiceZona);

  atualizarProfundidadeRaio(boss);
  desenharDebugZonas(boss);

  // ================================================
  // ATUALIZAÇÃO DOS RAIOS
  // ================================================

  boss.raioZonaUpdate = () => {
    atualizarRaioZona(boss);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, boss.raioZonaUpdate);

  // ================================================
  // LIMPEZA QUANDO O BOSS É DERROTADO
  // ================================================

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

  // Tempo desde o início do raio visual.
  const decorrido = Math.max(0, boss.scene.time.now - ia.raioInicioMs);

  // Dano desativado após o fim.
  if (ia.raioDuracaoMs <= 0 || decorrido >= ia.raioDuracaoMs) {
    return false;
  }

  return frameDentroDaJanelaDano(ia.raioFrameVisual, ia.raioFrames.length);
}

// =====================================================
// 25. VERIFICAR DANO DO RAIO DA BASE
// =====================================================

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

export function atualizarRaioZona(boss) {
  // Limpa os efeitos se o Boss foi destruído.
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

  // ================================================
  // AGUARDAR O FRAME 7 DO BOSS
  // ================================================

  if (ia.raioAguardandoInicio) {
    const inicio = Math.min(
      FRAME_BOSS_INICIO_RAIO,
      obterTotalFramesBoss(boss) - 1,
    );

    // Durante a preparação, ambos ficam invisíveis.
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

    // Tempo original restante da animação do Boss.
    ia.raioDuracaoMs = obterDuracaoRestanteBoss(boss, inicio);

    ia.raioFrameVisual = 0;

    sprite.setFrame(ia.raioFrames[0]);

    sprite.setVisible(true);

    // Inicia o raio adicional simultaneamente.
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

  // Encerra ambos os efeitos juntos.
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

  // Um único acerto por ataque.
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
