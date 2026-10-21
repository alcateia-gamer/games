/**
 * @file Vida, estamina e HUD do personagem. Prepara os recortes da imagem original em cache e
 * desenha a interface em canvas DOM na resolução da tela.
 */

import { playPlayerHitEffects } from "../combat/CombatEffects.js";

// =====================================================
// NULLBORNS — HUD NÍTIDA COM CARREGAMENTO ANTECIPADO
// =====================================================

const HUD_CONFIG = {
  caminho:
    "assets/PERSONAGENS/PERSONAGENS PRICIPAIS/BARRA DE VIDA/barra_vida_PERSONAGENS.png",

  chave: "hud-personagens-fonte-dom-hq-v1",

  frameWidth: 2169,
  frameHeight: 725,
  quantidadeFrames: 4,

  // POSIÇÃO — VALORES ORIGINAIS.
  x: 10,
  y: 10,

  // TAMANHO ATUAL — NÃO ALTERADO.
  largura: 350,

  // COR DAS BARRAS VAZIAS — NÃO ALTERADA.
  intensidadeBarraVazia: 0.12,
};

const HUD_FRAME_PERSONAGEM = {
  "kai-mercer": 0,
  "magnus-force": 1,
  "aria-kade": 2,
  nyx: 3,
};

// =====================================================
// NOVO — CACHE ANTECIPADO DAS HUDS
// =====================================================

// Cada personagem terá sua HUD preparada uma única vez.
// Ao iniciar ou trocar de cena, reutilizamos o resultado.

const HUD_CACHE = new Map();

// Começa a baixar a imagem assim que o módulo é
// importado, antes de a partida começar.

const HUD_IMAGEM_ANTECIPADA = typeof Image !== "undefined" ? new Image() : null;

// Verifica se a imagem antecipada já está disponível.
/**
 * Indica se o PNG antecipado da HUD terminou de carregar com dimensões válidas.
 */
function imagemHUDDisponivel() {
  return Boolean(
    HUD_IMAGEM_ANTECIPADA?.complete && HUD_IMAGEM_ANTECIPADA.naturalWidth > 0,
  );
}

// Prepara os quatro retratos antecipadamente.
/**
 * Prepara e armazena os quatro retratos quando a imagem original fica disponível.
 */
function prepararCacheAntecipado() {
  if (!imagemHUDDisponivel()) return;

  for (let i = 0; i < HUD_CONFIG.quantidadeFrames; i++) {
    if (HUD_CACHE.has(i)) continue;

    try {
      const dados = prepararHUDOriginal(null, i);

      HUD_CACHE.set(i, dados);
    } catch (erro) {
      console.warn(`[HUD] Falha ao antecipar o frame ${i}:`, erro);
    }
  }
}

if (HUD_IMAGEM_ANTECIPADA) {
  HUD_IMAGEM_ANTECIPADA.decoding = "async";

  // Prioriza o carregamento deste arquivo.
  HUD_IMAGEM_ANTECIPADA.fetchPriority = "high";

  HUD_IMAGEM_ANTECIPADA.addEventListener("load", prepararCacheAntecipado);

  // O navegador começa a carregar o PNG agora,
  // independentemente da cena do Phaser.
  HUD_IMAGEM_ANTECIPADA.src = HUD_CONFIG.caminho;

  if (imagemHUDDisponivel()) {
    prepararCacheAntecipado();
  }
}

// =====================================================
// SOM DE DANO
// =====================================================

const SOM_DANO_PLAYER = "dano-soft";
const VOLUME_SOM_DANO = 0.35;

/**
 * Toca o som de dano somente se o jogador e o áudio necessário estiverem disponíveis.
 */
function tocarSomDanoPlayer(scene) {
  if (!scene.player?.active) return;
  if (!scene.cache?.audio?.exists(SOM_DANO_PLAYER)) return;
  if (!scene.sound?.play) return;

  scene.sound.play(SOM_DANO_PLAYER, {
    volume: VOLUME_SOM_DANO,
  });
}

// =====================================================
// CRIAR CANVAS
// =====================================================

/**
 * Cria um canvas com dimensões inteiras e nunca menores que um pixel.
 */
function criarCanvasHUD(largura, altura) {
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(largura));

  canvas.height = Math.max(1, Math.round(altura));

  return canvas;
}

// =====================================================
// LOCALIZAR ÁREA VISÍVEL
// =====================================================

/**
 * Localiza o retângulo de pixels visíveis do frame e rejeita um frame totalmente vazio.
 */
function encontrarAreaVisivel(pixels, largura, altura) {
  let esquerda = largura;
  let direita = -1;
  let topo = altura;
  let baixo = -1;

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 4;

      if (pixels[i + 3] <= 8) continue;

      esquerda = Math.min(esquerda, x);
      direita = Math.max(direita, x);
      topo = Math.min(topo, y);
      baixo = Math.max(baixo, y);
    }
  }

  if (direita < esquerda || baixo < topo) {
    throw new Error("Frame da HUD vazio.");
  }

  return {
    x: esquerda,
    y: topo,
    width: direita - esquerda + 1,
    height: baixo - topo + 1,
  };
}

// =====================================================
// IDENTIFICAR CORES DAS BARRAS
// =====================================================

/**
 * Classifica um pixel pela cor e opacidade para separar vida vermelha de estamina ciano.
 */
function pixelEhBarra(pixels, i, tipo) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  const a = pixels[i + 3];

  if (a <= 128) return false;

  if (tipo === "vida") {
    return r > 150 && r > g * 2 && r > b * 2;
  }

  return g > 130 && b > 110 && r < g * 0.6;
}

// =====================================================
// LOCALIZAR VIDA E ESTAMINA
// =====================================================

/**
 * Encontra os limites da faixa de vida ou estamina dentro da área visível da HUD.
 */
function encontrarBarra(pixels, largura, area, tipo) {
  let esquerda = largura;
  let direita = -1;
  let topo = Infinity;
  let baixo = -1;

  const inicioX = Math.floor(area.x + area.width * 0.12);

  const fimX = area.x + area.width;
  const minimo = area.width * 0.55;

  for (let y = area.y; y < area.y + area.height; y++) {
    let primeiro = -1;
    let ultimo = -1;
    let quantidade = 0;

    for (let x = inicioX; x < fimX; x++) {
      const i = (y * largura + x) * 4;

      if (!pixelEhBarra(pixels, i, tipo)) {
        continue;
      }

      if (primeiro === -1) primeiro = x;

      ultimo = x;
      quantidade++;
    }

    if (quantidade < minimo) continue;

    esquerda = Math.min(esquerda, primeiro);
    direita = Math.max(direita, ultimo);
    topo = Math.min(topo, y);
    baixo = Math.max(baixo, y);
  }

  if (direita < esquerda || baixo < topo) {
    throw new Error(`Barra de ${tipo} não identificada.`);
  }

  return {
    x: esquerda - area.x,
    y: topo - area.y,
    width: direita - esquerda + 1,
    height: baixo - topo + 1,
  };
}

// =====================================================
// PREPARAR HUD ORIGINAL
// =====================================================

/**
 * Recorta a HUD do personagem e separa moldura e preenchimentos, reutilizando o resultado em
 * cache.
 */
function prepararHUDOriginal(scene, frameIndex) {
  // NOVO:
  // Se este personagem já está preparado,
  // não repete o processamento da imagem.

  if (HUD_CACHE.has(frameIndex)) {
    return HUD_CACHE.get(frameIndex);
  }

  // Usa a imagem carregada antecipadamente.
  // Se necessário, aceita a textura do Phaser.
  let imagem = null;

  if (imagemHUDDisponivel()) {
    imagem = HUD_IMAGEM_ANTECIPADA;
  } else if (scene?.textures?.exists(HUD_CONFIG.chave)) {
    imagem = scene.textures.get(HUD_CONFIG.chave).getSourceImage();
  }

  if (!imagem) {
    throw new Error("A imagem da HUD ainda não está disponível.");
  }

  const larguraImagem = imagem.naturalWidth || imagem.width;

  const alturaImagem = imagem.naturalHeight || imagem.height;

  const dimensoesExatas =
    larguraImagem === HUD_CONFIG.frameWidth &&
    alturaImagem === HUD_CONFIG.frameHeight * HUD_CONFIG.quantidadeFrames;

  const larguraFrame = dimensoesExatas ? HUD_CONFIG.frameWidth : larguraImagem;

  const inicioY = dimensoesExatas
    ? frameIndex * HUD_CONFIG.frameHeight
    : Math.round((frameIndex * alturaImagem) / HUD_CONFIG.quantidadeFrames);

  const fimY = dimensoesExatas
    ? inicioY + HUD_CONFIG.frameHeight
    : Math.round(
        ((frameIndex + 1) * alturaImagem) / HUD_CONFIG.quantidadeFrames,
      );

  // ===================================================
  // EXTRAIR FRAME
  // ===================================================

  const frame = criarCanvasHUD(larguraFrame, fimY - inicioY);

  const ctxFrame = frame.getContext("2d", {
    willReadFrequently: true,
  });

  ctxFrame.imageSmoothingEnabled = false;

  ctxFrame.drawImage(
    imagem,
    0,
    inicioY,
    larguraFrame,
    fimY - inicioY,
    0,
    0,
    larguraFrame,
    fimY - inicioY,
  );

  const pixels = ctxFrame.getImageData(0, 0, frame.width, frame.height).data;

  const area = encontrarAreaVisivel(pixels, frame.width, frame.height);

  const vida = encontrarBarra(pixels, frame.width, area, "vida");

  const estamina = encontrarBarra(pixels, frame.width, area, "estamina");

  // ===================================================
  // CAMADA PRINCIPAL
  // ===================================================

  const base = criarCanvasHUD(area.width, area.height);

  const ctxBase = base.getContext("2d", {
    willReadFrequently: true,
  });

  ctxBase.imageSmoothingEnabled = false;

  ctxBase.drawImage(
    frame,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  );

  const imgBase = ctxBase.getImageData(0, 0, area.width, area.height);

  const dadosBase = imgBase.data;

  // ===================================================
  // SEPARAR PREENCHIMENTO DAS BARRAS
  // ===================================================

  /**
   * Extrai os pixels coloridos da barra para uma camada e escurece a mesma região na base
   * vazia.
   */
  function extrairPreenchimento(barra, tipo) {
    const camada = criarCanvasHUD(area.width, area.height);

    const ctx = camada.getContext("2d");

    const imgCamada = ctx.createImageData(area.width, area.height);

    const saida = imgCamada.data;

    for (let y = barra.y; y < barra.y + barra.height; y++) {
      for (let x = barra.x; x < barra.x + barra.width; x++) {
        const i = (y * area.width + x) * 4;

        if (!pixelEhBarra(dadosBase, i, tipo)) {
          continue;
        }

        // Preserva exatamente o preenchimento original.
        for (let c = 0; c < 4; c++) {
          saida[i + c] = dadosBase[i + c];
        }

        // Escurece o interior da barra vazia.
        for (let c = 0; c < 3; c++) {
          dadosBase[i + c] = Math.round(
            dadosBase[i + c] * HUD_CONFIG.intensidadeBarraVazia,
          );
        }
      }
    }

    ctx.putImageData(imgCamada, 0, 0);

    return camada;
  }

  const preenchimentoVida = extrairPreenchimento(vida, "vida");

  const preenchimentoEstamina = extrairPreenchimento(estamina, "estamina");

  ctxBase.putImageData(imgBase, 0, 0);

  const dados = {
    largura: area.width,
    altura: area.height,

    base,
    preenchimentoVida,
    preenchimentoEstamina,

    vida,
    estamina,
  };

  // NOVO:
  // Guarda o resultado para não repetir este trabalho.
  HUD_CACHE.set(frameIndex, dados);

  return dados;
}

// =====================================================
// CONVERTER PARA A RESOLUÇÃO REAL DA TELA
// =====================================================

/**
 * Redimensiona uma camada original para a resolução física de exibição com suavização de alta
 * qualidade.
 */
function criarImagemDeTela(origem, larguraPx, alturaPx) {
  const saida = criarCanvasHUD(larguraPx, alturaPx);

  const ctx = saida.getContext("2d");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(origem, 0, 0, saida.width, saida.height);

  return saida;
}

// =====================================================
// POSICIONAR A HUD NA TELA
// =====================================================

/**
 * Alinha a HUD ao canvas do jogo usando tamanho CSS e densidade de pixels do dispositivo.
 */
function atualizarPosicaoHUD(scene) {
  const overlay = scene.hudStatus?.elemento;
  const dados = scene.hudStatusDados;
  const canvasJogo = scene.game?.canvas;

  if (!overlay || !dados || !canvasJogo) {
    return;
  }

  const caixaJogo = canvasJogo.getBoundingClientRect();

  const pai = overlay.parentElement;
  const caixaPai = pai.getBoundingClientRect();

  const larguraJogo = scene.scale?.gameSize?.width || 800;

  const alturaJogo = scene.scale?.gameSize?.height || 450;

  const escalaX = caixaJogo.width / larguraJogo;

  const escalaY = caixaJogo.height / alturaJogo;

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // Largura original preservada em 350.
  const larguraLogica = Math.min(
    HUD_CONFIG.largura,
    Math.max(1, larguraJogo - HUD_CONFIG.x - 10),
  );

  const larguraCss = larguraLogica * escalaX;

  const alturaCss = (larguraCss * dados.altura) / dados.largura;

  const posX = caixaJogo.left - caixaPai.left + HUD_CONFIG.x * escalaX;

  const posY = caixaJogo.top - caixaPai.top + HUD_CONFIG.y * escalaY;

  overlay.style.left = `${Math.round(posX * dpr) / dpr}px`;

  overlay.style.top = `${Math.round(posY * dpr) / dpr}px`;

  const larguraPx = Math.max(1, Math.round(larguraCss * dpr));

  const alturaPx = Math.max(1, Math.round(alturaCss * dpr));

  // Exibe cada pixel do canvas em um pixel físico, evitando uma segunda interpolação CSS.
  overlay.style.width = `${larguraPx / dpr}px`;

  overlay.style.height = `${alturaPx / dpr}px`;

  // Só recria texturas se a resolução mudar.
  if (overlay.width !== larguraPx || overlay.height !== alturaPx) {
    overlay.width = larguraPx;
    overlay.height = alturaPx;

    scene.hudStatus.texturasDeTela = null;
  }
}

// =====================================================
// ATUALIZAR BARRAS
// =====================================================

/**
 * Redesenha moldura, vida e estamina e só recria as versões de tela quando a resolução muda.
 */
function atualizarBarrasHUD(scene) {
  const hud = scene.hudStatus;
  const dados = scene.hudStatusDados;

  if (!hud?.active || !hud.elemento || !dados) {
    return;
  }

  const canvas = hud.elemento;

  const chaveDimensoes = `${canvas.width}x${canvas.height}`;

  // Reutiliza as imagens se a resolução não mudou.
  if (hud.texturasDeTela?.chave !== chaveDimensoes) {
    hud.texturasDeTela = {
      chave: chaveDimensoes,

      base: criarImagemDeTela(dados.base, canvas.width, canvas.height),

      vida: criarImagemDeTela(
        dados.preenchimentoVida,
        canvas.width,
        canvas.height,
      ),

      estamina: criarImagemDeTela(
        dados.preenchimentoEstamina,
        canvas.width,
        canvas.height,
      ),
    };
  }

  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Desenha retrato e moldura originais.
  ctx.drawImage(hud.texturasDeTela.base, 0, 0);

  // ===================================================
  // PREENCHIMENTO PROPORCIONAL
  // ===================================================

  /**
   * Limita o preenchimento ao percentual informado, preservando o desenho original da barra
   * por recorte.
   */
  function desenharPreenchimento(camada, barra, porcentagem) {
    const valor = Phaser.Math.Clamp(porcentagem, 0, 1);

    if (valor <= 0) return;

    const escalaX = canvas.width / dados.largura;

    const escalaY = canvas.height / dados.altura;

    ctx.save();

    ctx.beginPath();

    ctx.rect(
      barra.x * escalaX,
      barra.y * escalaY,
      barra.width * valor * escalaX,
      barra.height * escalaY,
    );

    ctx.clip();

    ctx.drawImage(camada, 0, 0);

    ctx.restore();
  }

  // VIDA — VERMELHO.
  desenharPreenchimento(
    hud.texturasDeTela.vida,
    dados.vida,
    scene.vidaMaxima > 0 ? scene.vida / scene.vidaMaxima : 0,
  );

  // ESTAMINA — CIANO.
  desenharPreenchimento(
    hud.texturasDeTela.estamina,
    dados.estamina,
    scene.estaminaMaxima > 0 ? scene.estamina / scene.estaminaMaxima : 0,
  );
}

// =====================================================
// MONTAR HUD DO PERSONAGEM
// =====================================================

/**
 * Monta o canvas da HUD do personagem como overlay DOM sem capturar cliques ou toques.
 */
function montarHUD(scene) {
  const frameIndex = HUD_FRAME_PERSONAGEM[scene.personagemSelecionada] ?? 0;

  // Usa o cache antecipado, quando disponível.
  const dados = prepararHUDOriginal(scene, frameIndex);

  scene.hudStatus?.elemento?.remove();

  const canvasJogo = scene.game.canvas;

  const pai = canvasJogo.parentElement || document.body;

  const overlay = document.createElement("canvas");

  overlay.setAttribute("aria-hidden", "true");

  // Configurações visuais preservadas.
  overlay.style.position = "absolute";
  overlay.style.display = "block";
  overlay.style.zIndex = "100";
  overlay.style.pointerEvents = "none";
  overlay.style.touchAction = "none";
  overlay.style.imageRendering = "auto";

  pai.appendChild(overlay);

  scene.hudStatus = {
    active: true,
    elemento: overlay,
    texturasDeTela: null,
  };

  scene.hudStatusDados = dados;
  scene.hudStatusFrame = frameIndex;

  atualizarPosicaoHUD(scene);
  atualizarBarrasHUD(scene);
}

// =====================================================
// CARREGAMENTO RÁPIDO DA HUD
// =====================================================

/**
 * Coordena imagem antecipada, carregamento alternativo, atualização por quadro e limpeza da
 * HUD.
 */
function iniciarHUD(scene) {
  scene.limparPainelStatusFixo?.();

  let encerrado = false;
  let falhou = false;
  let carregamentoPhaserIniciado = false;

  const evento = `filecomplete-image-${HUD_CONFIG.chave}`;

  // Verifica se existe uma imagem utilizável.
  /**
   * Verifica se há uma fonte utilizável no cache preparado, na imagem antecipada ou nas
   * texturas do Phaser.
   */
  function imagemDisponivel() {
    return (
      HUD_CACHE.size > 0 ||
      imagemHUDDisponivel() ||
      scene.textures.exists(HUD_CONFIG.chave)
    );
  }

  // Monta imediatamente quando houver imagem.
  /**
   * Tenta montar a HUD quando houver imagem e impede novas tentativas após erro ou
   * encerramento.
   */
  function montarComSeguranca() {
    if (encerrado || falhou) return;
    if (!imagemDisponivel()) return;

    try {
      montarHUD(scene);
    } catch (erro) {
      falhou = true;

      console.error("[HUD] Erro ao montar a HUD:", erro);
    }
  }

  /**
   * Registra falha somente quando o arquivo que apresentou erro é a imagem da HUD.
   */
  function aoFalhar(arquivo) {
    if (arquivo?.key !== HUD_CONFIG.chave) {
      return;
    }

    falhou = true;

    console.error("[HUD] Não foi possível carregar:", HUD_CONFIG.caminho);
  }

  // Carregamento pelo Phaser como alternativa.
  // Só é usado se a imagem antecipada falhar.
  /**
   * Inicia o carregamento alternativo pelo Phaser uma única vez quando a imagem antecipada não
   * está disponível.
   */
  function carregarPeloPhaser() {
    if (encerrado || falhou || carregamentoPhaserIniciado) {
      return;
    }

    if (scene.textures.exists(HUD_CONFIG.chave)) {
      montarComSeguranca();
      return;
    }

    carregamentoPhaserIniciado = true;

    scene.load.once(evento, montarComSeguranca);

    scene.load.on("loaderror", aoFalhar);

    scene.load.image(HUD_CONFIG.chave, HUD_CONFIG.caminho);

    if (!scene.load.isLoading()) {
      scene.load.start();
    }
  }

  // Quando a imagem antecipada terminar de carregar.
  /**
   * Monta a HUD quando o carregamento antecipado conclui e a cena ainda está ativa.
   */
  function aoCarregarAntecipadamente() {
    if (encerrado) return;

    montarComSeguranca();
  }

  // Se o navegador não conseguir carregar antecipadamente,
  // o Phaser faz a tentativa normal.
  /**
   * Aciona a tentativa de carregamento pelo Phaser após falha da imagem antecipada.
   */
  function aoErroAntecipado() {
    if (encerrado) return;

    carregarPeloPhaser();
  }

  // ===================================================
  // ATUALIZAÇÃO POR QUADRO
  // ===================================================

  /**
   * Garante a HUD do personagem atual e atualiza posição e preenchimento enquanto o sistema
   * está ativo.
   */
  function aCadaQuadro() {
    if (encerrado || falhou) return;
    if (!imagemDisponivel()) return;

    const desejado = HUD_FRAME_PERSONAGEM[scene.personagemSelecionada] ?? 0;

    if (!scene.hudStatus?.active || scene.hudStatusFrame !== desejado) {
      montarComSeguranca();
    }

    atualizarPosicaoHUD(scene);
    atualizarBarrasHUD(scene);
  }

  // ===================================================
  // LIMPEZA
  // ===================================================

  /**
   * Desconecta eventos de imagem, loader e cena e remove o overlay da HUD uma única vez.
   */
  function limpar() {
    if (encerrado) return;

    encerrado = true;

    HUD_IMAGEM_ANTECIPADA?.removeEventListener(
      "load",
      aoCarregarAntecipadamente,
    );

    HUD_IMAGEM_ANTECIPADA?.removeEventListener("error", aoErroAntecipado);

    scene.load.off(evento, montarComSeguranca);

    scene.load.off("loaderror", aoFalhar);

    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, aCadaQuadro);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    scene.hudStatus?.elemento?.remove();

    scene.hudStatus = null;
    scene.hudStatusDados = null;
    scene.hudStatusFrame = null;

    if (scene.limparPainelStatusFixo === limpar) {
      scene.limparPainelStatusFixo = null;
    }
  }

  scene.limparPainelStatusFixo = limpar;

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, aCadaQuadro);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limpar);

  // ===================================================
  // PRIORIDADE 1 — CACHE JÁ PREPARADO
  // ===================================================

  if (HUD_CACHE.size > 0) {
    montarComSeguranca();
    return;
  }

  // ===================================================
  // PRIORIDADE 2 — IMAGEM ANTECIPADA
  // ===================================================

  if (imagemHUDDisponivel()) {
    montarComSeguranca();
    return;
  }

  // ===================================================
  // PRIORIDADE 3 — TEXTURA DO PHASER
  // ===================================================

  if (scene.textures.exists(HUD_CONFIG.chave)) {
    montarComSeguranca();
    return;
  }

  // ===================================================
  // PRIORIDADE 4 — AGUARDAR DOWNLOAD ANTECIPADO
  // ===================================================

  if (HUD_IMAGEM_ANTECIPADA) {
    HUD_IMAGEM_ANTECIPADA.addEventListener("load", aoCarregarAntecipadamente);

    HUD_IMAGEM_ANTECIPADA.addEventListener("error", aoErroAntecipado);

    // Se o download já falhou antes de iniciar a cena,
    // usa o carregamento normal do Phaser.
    if (
      HUD_IMAGEM_ANTECIPADA.complete &&
      HUD_IMAGEM_ANTECIPADA.naturalWidth === 0
    ) {
      carregarPeloPhaser();
    }

    return;
  }

  carregarPeloPhaser();
}

// =====================================================
// CRIAÇÃO DOS STATUS
// =====================================================

/**
 * Inicializa vida, estamina, custos e taxas de regeneração e prepara a HUD.
 */
function criarStatusPlayer(scene) {
  // VIDA — VALORES ORIGINAIS.
  scene.vidaMaxima = 100;
  scene.vida = 100;

  scene.regeneracaoVida = 4;
  scene.tempoSemDanoParaRegen = 4;
  scene.tempoSemDano = 0;

  // ESTAMINA — VALORES ORIGINAIS.
  scene.estaminaMaxima = 100;
  scene.estamina = 100;

  scene.custoAtaque = 20;
  scene.regeneracaoEstamina = 18;

  iniciarHUD(scene);
}

// =====================================================
// ATUALIZAR VIDA E ESTAMINA
// =====================================================

/**
 * Regenera estamina fora do ataque e vida após o intervalo sem dano, convertendo delta de
 * milissegundos para segundos.
 */
function atualizarStatusPlayer(scene, delta) {
  // REGENERAÇÃO DA ESTAMINA.
  if (!scene.atacando && scene.estamina < scene.estaminaMaxima) {
    scene.estamina += scene.regeneracaoEstamina * (delta / 1000);

    scene.estamina = Math.min(scene.estamina, scene.estaminaMaxima);
  }

  // REGENERAÇÃO DA VIDA.
  scene.tempoSemDano += delta;

  if (scene.tempoSemDano >= scene.tempoSemDanoParaRegen * 1000) {
    scene.vida += scene.regeneracaoVida * (delta / 1000);

    scene.vida = Math.min(scene.vida, scene.vidaMaxima);
  }

  atualizarBarrasHUD(scene);
}

// =====================================================
// GASTAR ESTAMINA
// =====================================================

/**
 * Consome estamina se houver saldo suficiente e atualiza a HUD; informa se o gasto foi
 * possível.
 */
function gastarEstamina(scene, quantidade) {
  if (scene.estamina < quantidade) {
    return false;
  }

  scene.estamina = Math.max(0, scene.estamina - quantidade);

  atualizarBarrasHUD(scene);

  return true;
}

// =====================================================
// RECEBER DANO
// =====================================================

/**
 * Reinicia o tempo sem dano e reduz a vida fora do modo desenvolvedor, com som, impacto
 * orientado pelo atacante e atualização da HUD.
 */
function tomarDano(scene, quantidade, atacante = null) {
  const vidaAntes = scene.vida;

  scene.tempoSemDano = 0;

  // DEV ON: mantém o HP.
  // DEV OFF: perde HP normalmente.
  if (!scene.developerMode) {
    scene.vida = Phaser.Math.Clamp(
      scene.vida - quantidade,
      0,
      scene.vidaMaxima,
    );
  }

  if ((scene.developerMode && quantidade > 0) || scene.vida < vidaAntes) {
    tocarSomDanoPlayer(scene);
    playPlayerHitEffects(scene, atacante, quantidade);
  }

  atualizarBarrasHUD(scene);
}

// =====================================================
// RECUPERAR VIDA
// =====================================================

/**
 * Recupera vida sem ultrapassar os limites e redesenha o preenchimento da HUD.
 */
function recuperarVida(scene, quantidade) {
  scene.vida = Phaser.Math.Clamp(scene.vida + quantidade, 0, scene.vidaMaxima);

  atualizarBarrasHUD(scene);
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export {
  criarStatusPlayer,
  atualizarStatusPlayer,
  atualizarPosicaoHUD,
  gastarEstamina,
  tomarDano,
  recuperarVida,
};
