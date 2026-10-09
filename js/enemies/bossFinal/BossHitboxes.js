import {
  bossBaseX,
  bossBaseY,
  bossDepth,
  colisaoBase,
  mostrarHitboxes,
  posesMaos,
  zonasVulneraveis,
  areaAtaqueChao,
  framesImpactoChao,
  obterNumeroFrameAnimacao,
} from "./BossConfig.js";

// Os valores fixos da base e da área azul foram
// definidos para o sprite com escala 1.25.
const ESCALA_ORIGINAL = 1.25;
const TAMANHO_FRAME = 256;

// =====================================================
// CRIAR HITBOX FÍSICA
// =====================================================

export function criarHitboxColisao(
  scene,
  nome,
  largura,
  altura,
  cor = 0xff3333,
) {
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
  hitbox.setVisible(mostrarHitboxes);

  scene.physics.add.existing(hitbox, true);
  hitbox.body.debugShowBody = false;

  return hitbox;
}

// =====================================================
// ATUALIZAR RETÂNGULO E CORPO FÍSICO
// =====================================================

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
// PIXELS DO SPRITE PARA COORDENADAS DO MAPA
// =====================================================

function converterPixelParaMundo(boss, x, y) {
  const sprite = boss.sprite;

  const origemX = Number(sprite.originX ?? 0.5) * TAMANHO_FRAME;
  const origemY = Number(sprite.originY ?? 1) * TAMANHO_FRAME;

  return {
    x: boss.x + sprite.x + (x - origemX) * sprite.scaleX,
    y: boss.y + sprite.y + (y - origemY) * sprite.scaleY,
  };
}

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
// REGIÕES DEFINIDAS NA ESCALA ANTIGA
// =====================================================

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
// DESENHO DE DEPURAÇÃO
// =====================================================

function desenharHitboxesBoss(boss) {
  const desenho = boss.debugDano;
  if (!desenho) return;

  desenho.clear();

  if (!mostrarHitboxes || boss.morto) return;

  desenho.lineStyle(2, 0x22dd55, 1);
  desenho.fillStyle(0x22dd55, 0.14);

  for (const area of boss.hitboxesReceberDano) {
    desenho.fillRectShape(area);
    desenho.strokeRectShape(area);
  }

  if (boss.areaDanoChao) {
    const ativo = socoComDanoAtivo(boss);

    desenho.lineStyle(ativo ? 3 : 2, 0x2288ff, 1);
    desenho.fillStyle(0x2288ff, ativo ? 0.19 : 0.025);

    desenho.fillRectShape(boss.areaDanoChao);
    desenho.strokeRectShape(boss.areaDanoChao);
  }
}

// =====================================================
// ATUALIZAÇÃO DAS HITBOXES
// =====================================================

export function atualizarHitboxesBoss(boss) {
  if (!boss?.active || boss.morto) return;

  const maoEsquerda = obterMaoNoFrame(boss, "esquerda");
  const maoDireita = obterMaoNoFrame(boss, "direita");

  // Base vermelha: acompanha o aumento do sprite.
  const base = converterRegiaoOriginal(boss, colisaoBase);

  posicionarColisao(
    boss.hitboxColisao,
    base.centroX,
    base.centroY,
    base.largura,
    base.altura,
  );

  // Mãos: posição e tamanho específicos de cada frame.
  posicionarColisao(
    boss.hitboxMaoEsquerda,
    maoEsquerda.x,
    maoEsquerda.y,
    maoEsquerda.largura,
    maoEsquerda.altura,
  );

  posicionarColisao(
    boss.hitboxMaoDireita,
    maoDireita.x,
    maoDireita.y,
    maoDireita.largura,
    maoDireita.altura,
  );

  // Cabeça e corpo: convertidos dos pixels do sprite.
  const cabeca = converterRetanguloSprite(boss, zonasVulneraveis.cabeca);

  boss.hitboxCabeca.setTo(cabeca.x, cabeca.y, cabeca.width, cabeca.height);

  const corpo = converterRetanguloSprite(boss, zonasVulneraveis.corpo);

  boss.hitboxCorpo.setTo(corpo.x, corpo.y, corpo.width, corpo.height);

  // Área azul: acompanha o deslocamento e a nova escala.
  const area = converterRegiaoOriginal(boss, areaAtaqueChao);

  boss.areaDanoChao.setTo(area.x, area.y, area.largura, area.altura);

  desenharHitboxesBoss(boss);
}

// =====================================================
// RECEBIMENTO DE DANO
// =====================================================

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
}

// =====================================================
// CRIAR TODAS AS HITBOXES
// =====================================================

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

  // Posiciona e dimensiona antes de vincular as colisões.
  atualizarHitboxesBoss(boss);

  boss.collidersColisao = scene.player?.body
    ? boss.hitboxesColisao.map((hitbox) =>
        scene.physics.add.collider(scene.player, hitbox),
      )
    : [];

  boss.colliderColisao = boss.collidersColisao[0] || null;
}
