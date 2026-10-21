/**
 * @file Áreas físicas e geométricas do boss. A base e as mãos bloqueiam movimento; zonas
 * verdes recebem dano e zonas ofensivas dependem dos frames.
 */

import {
  bossBaseX,
  bossBaseY,
  bossDepth,
  colisaoBase,
  posesMaos,
  zonasVulneraveis,
  areaAtaqueChao,
  framesImpactoChao,
  obterNumeroFrameAnimacao,
} from "./BossConfig.js";

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const ESCALA_ORIGINAL = 1.25;
const TAMANHO_FRAME = 256;

// =====================================================
// CONSULTAR DEBUG DO PHASER
// =====================================================

// Usa a mesma configuração das hitboxes do jogador:
//
// physics: {
//   default: "arcade",
//   arcade: {
//     debug: true ou false
//   }
// }
//
// Não depende mais de mostrarHitboxes = true
// no BossConfig.js.

/**
 * Consulta se a depuração de colisões está habilitada na configuração do jogo.
 */
function debugHitboxesAtivado(scene) {
  return Boolean(scene?.game?.config?.physics?.arcade?.debug);
}

// =====================================================
// CRIAR HITBOX FÍSICA
// =====================================================

/**
 * Cria uma área física imóvel do boss e configura sua visualização de depuração.
 */
export function criarHitboxColisao(
  scene,
  nome,
  largura,
  altura,
  cor = 0xff3333,
) {
  const debugAtivo = debugHitboxesAtivado(scene);

  const hitbox = scene.add.rectangle(
    bossBaseX,
    bossBaseY,
    largura,
    altura,
    cor,
    0.13,
  );

  hitbox.setName(nome);
  hitbox.setOrigin(0.5, 0.5);
  hitbox.setStrokeStyle(2, cor, 1);
  hitbox.setDepth(bossDepth + 1);

  // Somente a aparência segue o debug.
  hitbox.setVisible(debugAtivo);

  // O corpo físico existe independentemente
  // da visualização das hitboxes.
  scene.physics.add.existing(hitbox, true);

  // Evita que o Arcade Physics desenhe outra
  // caixa sobre a hitbox personalizada.
  hitbox.body.debugShowBody = false;

  return hitbox;
}

// =====================================================
// ATUALIZAR RETÂNGULO E CORPO FÍSICO
// =====================================================

/**
 * Atualiza posição e tamanho de uma colisão e sincroniza o corpo físico com o objeto visual.
 */
function posicionarColisao(hitbox, x, y, largura, altura) {
  if (!hitbox?.body?.enable) return;

  hitbox.setSize(largura, altura);

  if (hitbox.geom) {
    hitbox.geom.setTo(0, 0, largura, altura);
  }

  hitbox.setPosition(x, y);

  hitbox.body.setSize(largura, altura);

  hitbox.body.updateFromGameObject();
}

// =====================================================
// CONVERTER PIXEL PARA COORDENADAS DO MAPA
// =====================================================

/**
 * Converte um pixel do frame original em posição do mundo considerando origem, escala e
 * posição do sprite.
 */
function converterPixelParaMundo(boss, x, y) {
  const sprite = boss.sprite;

  const origemX = Number(sprite.originX ?? 0.5) * TAMANHO_FRAME;

  const origemY = Number(sprite.originY ?? 1) * TAMANHO_FRAME;

  return {
    x: boss.x + sprite.x + (x - origemX) * sprite.scaleX,

    y: boss.y + sprite.y + (y - origemY) * sprite.scaleY,
  };
}

// =====================================================
// CONVERTER REGIÃO DO SPRITE
// =====================================================

/**
 * Transforma uma região retangular do frame em um retângulo de mundo usado pelos testes
 * geométricos.
 */
function converterRetanguloSprite(boss, regiao) {
  const centro = converterPixelParaMundo(
    boss,
    regiao.x + regiao.largura / 2,
    regiao.y + regiao.altura / 2,
  );

  const largura = Math.abs(boss.sprite.scaleX) * regiao.largura;

  const altura = Math.abs(boss.sprite.scaleY) * regiao.altura;

  return new Phaser.Geom.Rectangle(
    centro.x - largura / 2,
    centro.y - altura / 2,
    largura,
    altura,
  );
}

// =====================================================
// REGIÕES DEFINIDAS NA ESCALA ORIGINAL
// =====================================================

/**
 * Converte uma região calibrada na escala original do boss para suas dimensões e posição
 * atuais.
 */
function converterRegiaoOriginal(boss, regiao) {
  const sprite = boss.sprite;

  const fatorX = sprite.scaleX / ESCALA_ORIGINAL;

  const fatorY = sprite.scaleY / ESCALA_ORIGINAL;

  const largura = regiao.largura * Math.abs(fatorX);

  const altura = regiao.altura * Math.abs(fatorY);

  const centroX = boss.x + sprite.x + regiao.x * fatorX;

  const centroY = boss.y + sprite.y + regiao.y * fatorY;

  return {
    centroX,
    centroY,
    largura,
    altura,
    x: centroX - largura / 2,
    y: centroY - altura / 2,
  };
}

// =====================================================
// POSIÇÃO DAS MÃOS NO FRAME ATUAL
// =====================================================

/**
 * Calcula a posição da mão esquerda ou direita na pose do frame atual.
 */
function obterMaoNoFrame(boss, lado) {
  const estado =
    boss.bossEstadoAtual === "idle" ? "ataqueChao" : boss.bossEstadoAtual;

  const lista = posesMaos[estado] || posesMaos.ataqueChao;

  const frameAtual = obterNumeroFrameAnimacao(boss.sprite.frame);

  const numero = Phaser.Math.Clamp(frameAtual, 0, lista.length - 1);

  const [px, py, largura, altura] = lista[numero];

  const posX = lado === "esquerda" ? px : TAMANHO_FRAME - px;

  const centro = converterPixelParaMundo(boss, posX, py);

  return {
    x: centro.x,
    y: centro.y,
    largura: largura * Math.abs(boss.sprite.scaleX),
    altura: altura * Math.abs(boss.sprite.scaleY),
  };
}

// =====================================================
// FRAME ATIVO DO SOCO
// =====================================================

/**
 * Indica se o ataque de soco está em um dos frames capazes de aplicar dano.
 */
export function socoComDanoAtivo(boss) {
  if (
    !boss?.active ||
    boss.morto ||
    boss.recuperandoEstamina ||
    !boss.iaCombate
  ) {
    return false;
  }

  const ia = boss.iaCombate;

  return (
    ia.ataqueAtual === "ataqueChao" && framesImpactoChao.includes(ia.frame)
  );
}

// =====================================================
// DESENHAR DEBUG DO BOSS
// =====================================================

/**
 * Desenha áreas físicas, vulneráveis e ofensivas apenas quando o debug do jogo permite.
 */
function desenharHitboxesBoss(boss) {
  const desenho = boss.debugDano;

  if (!desenho?.scene) return;

  const debugAtivo = debugHitboxesAtivado(boss.scene);

  desenho.setVisible(debugAtivo);
  desenho.clear();

  // Mostra as hitboxes físicas somente
  // quando o debug do Phaser estiver ligado.
  for (const hitbox of boss.hitboxesColisao || []) {
    if (!hitbox?.active) continue;

    hitbox.setVisible(debugAtivo && !boss.morto);
  }

  // Não desenha hitboxes gráficas no modo normal.
  if (!debugAtivo || boss.morto) {
    return;
  }

  // ================================================
  // HITBOXES VERDES - RECEBIMENTO DE DANO
  // ================================================

  desenho.lineStyle(2, 0x22dd55, 1);

  desenho.fillStyle(0x22dd55, 0.14);

  for (const area of boss.hitboxesReceberDano) {
    desenho.fillRectShape(area);
    desenho.strokeRectShape(area);
  }

  // ================================================
  // HITBOX AZUL - ATAQUE DE SOCO NO CHÃO
  // ================================================

  if (boss.areaDanoChao) {
    const ativo = socoComDanoAtivo(boss);

    desenho.lineStyle(ativo ? 3 : 2, 0x2288ff, 1);

    desenho.fillStyle(0x2288ff, ativo ? 0.19 : 0.025);

    desenho.fillRectShape(boss.areaDanoChao);

    desenho.strokeRectShape(boss.areaDanoChao);
  }
}

// =====================================================
// ATUALIZAR TODAS AS HITBOXES
// =====================================================

/**
 * Atualiza base, mãos, regiões vulneráveis e área de impacto para a pose atual do boss.
 */
export function atualizarHitboxesBoss(boss) {
  if (!boss?.active || boss.morto) return;

  const maoEsquerda = obterMaoNoFrame(boss, "esquerda");

  const maoDireita = obterMaoNoFrame(boss, "direita");

  // ================================================
  // BASE VERMELHA
  // ================================================

  const base = converterRegiaoOriginal(boss, colisaoBase);

  posicionarColisao(
    boss.hitboxColisao,
    base.centroX,
    base.centroY,
    base.largura,
    base.altura,
  );

  // ================================================
  // MÃO ESQUERDA - LARANJA
  // ================================================

  posicionarColisao(
    boss.hitboxMaoEsquerda,
    maoEsquerda.x,
    maoEsquerda.y,
    maoEsquerda.largura,
    maoEsquerda.altura,
  );

  // ================================================
  // MÃO DIREITA - LARANJA
  // ================================================

  posicionarColisao(
    boss.hitboxMaoDireita,
    maoDireita.x,
    maoDireita.y,
    maoDireita.largura,
    maoDireita.altura,
  );

  // ================================================
  // CABEÇA E CORPO - VERDE
  // ================================================

  const cabeca = converterRetanguloSprite(boss, zonasVulneraveis.cabeca);

  boss.hitboxCabeca.setTo(cabeca.x, cabeca.y, cabeca.width, cabeca.height);

  const corpo = converterRetanguloSprite(boss, zonasVulneraveis.corpo);

  boss.hitboxCorpo.setTo(corpo.x, corpo.y, corpo.width, corpo.height);

  // ================================================
  // ATAQUE DO SOCO - AZUL
  // ================================================

  const area = converterRegiaoOriginal(boss, areaAtaqueChao);

  boss.areaDanoChao.setTo(area.x, area.y, area.largura, area.altura);

  // ================================================
  // ATUALIZAR VISIBILIDADE DO DEBUG
  // ================================================

  desenharHitboxesBoss(boss);
}

// =====================================================
// VERIFICAR RECEBIMENTO DE DANO
// =====================================================

/**
 * Verifica se um retângulo de ataque cruza alguma região em que o boss pode receber dano.
 */
export function ataqueAcertaZonaVerde(boss, retanguloAtaque) {
  if (!boss?.active || boss.morto || !retanguloAtaque) {
    return false;
  }

  return boss.hitboxesReceberDano.some((regiao) =>
    Phaser.Geom.Intersects.RectangleToRectangle(regiao, retanguloAtaque),
  );
}

// =====================================================
// REMOVER COLISÕES
// =====================================================

/**
 * Remove colliders e desabilita as áreas físicas do boss após derrota ou limpeza.
 */
export function removerColisaoBoss(boss) {
  for (const collider of boss.collidersColisao || []) {
    collider?.destroy();
  }

  boss.collidersColisao = [];
  boss.colliderColisao = null;

  for (const hitbox of boss.hitboxesColisao || []) {
    if (hitbox.body) {
      hitbox.body.enable = false;
    }

    hitbox.setVisible(false);
  }

  boss.debugDano?.clear();
  boss.debugDano?.setVisible(false);
}

// =====================================================
// CRIAR TODAS AS HITBOXES
// =====================================================

/**
 * Cria colisões da base e das mãos, áreas de dano e os vínculos de colisão necessários com a
 * cena.
 */
export function criarHitboxesBoss(scene, boss) {
  boss.hitboxColisao = criarHitboxColisao(
    scene,
    "boss-base-vermelha",
    colisaoBase.largura,
    colisaoBase.altura,
    0xff3333,
  );

  boss.hitboxMaoEsquerda = criarHitboxColisao(
    scene,
    "boss-mao-esquerda-laranja",
    40,
    40,
    0xffa500,
  );

  boss.hitboxMaoDireita = criarHitboxColisao(
    scene,
    "boss-mao-direita-laranja",
    40,
    40,
    0xffa500,
  );

  boss.hitboxesColisao = [
    boss.hitboxColisao,
    boss.hitboxMaoEsquerda,
    boss.hitboxMaoDireita,
  ];

  boss.hitboxCabeca = new Phaser.Geom.Rectangle();

  boss.hitboxCorpo = new Phaser.Geom.Rectangle();

  boss.hitboxesReceberDano = [boss.hitboxCabeca, boss.hitboxCorpo];

  boss.hitboxDano = boss.hitboxCorpo;

  boss.areaDanoChao = new Phaser.Geom.Rectangle();

  // Coloca as hitboxes nas coordenadas corretas.
  atualizarHitboxesBoss(boss);

  // Colisões físicas permanecem ativas
  // mesmo com debug: false.
  boss.collidersColisao = scene.player?.body
    ? boss.hitboxesColisao.map((hitbox) =>
        scene.physics.add.collider(scene.player, hitbox),
      )
    : [];

  boss.colliderColisao = boss.collidersColisao[0] || null;
}
