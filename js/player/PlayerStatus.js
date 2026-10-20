// =====================================================
// NULLBORNS — HUD NÍTIDA FORA DO CANVAS DO PHASER
// =====================================================

const HUD_CONFIG = {
  caminho:
    "assets/PERSONAGENS/PERSONAGENS PRICIPAIS/BARRA DE VIDA/barra_vida_PERSONAGENS.png",

  chave: "hud-personagens-fonte-dom-hq-v1",

  frameWidth: 2169,
  frameHeight: 725,
  quantidadeFrames: 4,

  // POSIÇÃO EM UNIDADES DO JOGO.
  x: 10,
  y: 10,

  // LARGURA MANTIDA EM 340.
  largura: 350,

  // Intensidade das barras vazias.
  intensidadeBarraVazia: 0.12,
};

// Ordem dos retratos no PNG.
const HUD_FRAME_PERSONAGEM = {
  "kai-mercer": 0,
  "magnus-force": 1,
  "aria-kade": 2,
  nyx: 3,
};

// =====================================================
// SOM DE DANO
// =====================================================

const SOM_DANO_PLAYER = "dano-soft";
const VOLUME_SOM_DANO = 0.35;

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

function criarCanvasHUD(largura, altura) {
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(largura));

  canvas.height = Math.max(1, Math.round(altura));

  return canvas;
}

// =====================================================
// LOCALIZAR A ÁREA VISÍVEL
// =====================================================

// Identifica a arte sem contar as margens
// transparentes existentes no PNG original.

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
// IDENTIFICAR AS CORES DAS BARRAS
// =====================================================

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
// LOCALIZAR AS BARRAS
// =====================================================

function encontrarBarra(pixels, largura, area, tipo) {
  let esquerda = largura;
  let direita = -1;
  let topo = Infinity;
  let baixo = -1;

  // Ignora a região do rosto.
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
// PREPARAR A HUD NA RESOLUÇÃO ORIGINAL
// =====================================================

// Aqui NÃO reduzimos a imagem para 340 pixels.
// Mantemos sua resolução original até descobrir
// quantos pixels ela ocupará na tela do navegador.

function prepararHUDOriginal(scene, frameIndex) {
  const imagem = scene.textures.get(HUD_CONFIG.chave).getSourceImage();

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

  // Extrai a HUD do personagem selecionado.
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
  // SEPARAR O PREENCHIMENTO DAS BARRAS
  // ===================================================

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

        // Preserva a cor original do preenchimento.
        for (let c = 0; c < 4; c++) {
          saida[i + c] = dadosBase[i + c];
        }

        // Escurece apenas o interior da barra.
        // Não substitui a moldura nem o retrato.
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

  return {
    largura: area.width,
    altura: area.height,

    base,
    preenchimentoVida,
    preenchimentoEstamina,

    vida,
    estamina,
  };
}

// =====================================================
// CONVERTER PARA A RESOLUÇÃO REAL DA TELA
// =====================================================

// Exemplo:
//
// O jogo tem 800 unidades de largura.
// O navegador pode exibir esse jogo em 1500 pixels.
//
// Uma HUD de 340 unidades ocupa aproximadamente
// 638 pixels na tela.
//
// Em vez de gerar uma textura de 340 pixels
// e ampliá-la, criamos a HUD diretamente
// com os pixels necessários para sua exibição.

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

  // A HUD continua com 340 unidades do jogo.
  const larguraLogica = Math.min(
    HUD_CONFIG.largura,
    Math.max(1, larguraJogo - HUD_CONFIG.x - 10),
  );

  const larguraCss = larguraLogica * escalaX;

  const alturaCss = (larguraCss * dados.altura) / dados.largura;

  // Posição em relação ao canvas do Phaser.
  const posX = caixaJogo.left - caixaPai.left + HUD_CONFIG.x * escalaX;

  const posY = caixaJogo.top - caixaPai.top + HUD_CONFIG.y * escalaY;

  overlay.style.left = `${Math.round(posX * dpr) / dpr}px`;

  overlay.style.top = `${Math.round(posY * dpr) / dpr}px`;

  overlay.style.width = `${larguraCss}px`;
  overlay.style.height = `${alturaCss}px`;

  // RESOLUÇÃO REAL DO CANVAS DA HUD.
  // Considera também telas de alta densidade.
  const larguraPx = Math.max(1, Math.round(larguraCss * dpr));

  const alturaPx = Math.max(1, Math.round(alturaCss * dpr));

  // Só recria as texturas quando o tamanho mudar.
  if (overlay.width !== larguraPx || overlay.height !== alturaPx) {
    overlay.width = larguraPx;
    overlay.height = alturaPx;

    scene.hudStatus.texturasDeTela = null;
  }
}

// =====================================================
// ATUALIZAR AS BARRAS DA HUD
// =====================================================

function atualizarBarrasHUD(scene) {
  const hud = scene.hudStatus;
  const dados = scene.hudStatusDados;

  if (!hud?.active || !hud.elemento || !dados) {
    return;
  }

  const canvas = hud.elemento;

  const chaveDimensoes = `${canvas.width}x${canvas.height}`;

  // Prepara as imagens uma única vez por tamanho.
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

  // Como as imagens já possuem a resolução final,
  // não precisam de mais suavização.
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Desenha retrato, moldura e barras escuras.
  ctx.drawImage(hud.texturasDeTela.base, 0, 0);

  // ===================================================
  // RECORTAR SOMENTE O PREENCHIMENTO
  // ===================================================

  function desenharPreenchimento(camada, barra, porcentagem) {
    const valor = Phaser.Math.Clamp(porcentagem, 0, 1);

    if (valor <= 0) return;

    const escalaX = canvas.width / dados.largura;

    const escalaY = canvas.height / dados.altura;

    ctx.save();

    ctx.beginPath();

    // Diminui da direita para a esquerda,
    // mantendo o começo da barra fixo.
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

function montarHUD(scene) {
  const frameIndex = HUD_FRAME_PERSONAGEM[scene.personagemSelecionada] ?? 0;

  const dados = prepararHUDOriginal(scene, frameIndex);

  // Remove a HUD DOM anterior, se existir.
  scene.hudStatus?.elemento?.remove();

  const canvasJogo = scene.game.canvas;

  // O game-container já possui position: fixed
  // no CSS do Nullborns.
  const pai = canvasJogo.parentElement || document.body;

  const overlay = document.createElement("canvas");

  overlay.setAttribute("aria-hidden", "true");

  // Esta HUD fica acima da imagem do jogo,
  // mas não interfere em cliques ou toques.
  overlay.style.position = "absolute";
  overlay.style.display = "block";
  overlay.style.zIndex = "100";
  overlay.style.pointerEvents = "none";
  overlay.style.touchAction = "none";

  // Não queremos que o navegador amplie
  // uma textura pequena: o canvas da HUD
  // será desenhado na resolução da tela.
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
// CARREGAMENTO AUTOMÁTICO
// =====================================================

function iniciarHUD(scene) {
  // Limpa a HUD de uma inicialização anterior.
  scene.limparPainelStatusFixo?.();

  let encerrado = false;
  let falhou = false;

  const evento = `filecomplete-image-${HUD_CONFIG.chave}`;

  function montarComSeguranca() {
    if (encerrado || falhou || !scene.textures.exists(HUD_CONFIG.chave)) {
      return;
    }

    try {
      montarHUD(scene);
    } catch (erro) {
      falhou = true;

      console.error("[HUD HD] Não foi possível criar a HUD:", erro);
    }
  }

  function aoFalhar(arquivo) {
    if (arquivo?.key !== HUD_CONFIG.chave) {
      return;
    }

    falhou = true;

    console.error("[HUD HD] Não foi possível carregar:", HUD_CONFIG.caminho);
  }

  // ===================================================
  // ATUALIZAÇÃO POR QUADRO
  // ===================================================

  function aCadaQuadro() {
    if (encerrado || falhou || !scene.textures.exists(HUD_CONFIG.chave)) {
      return;
    }

    const desejado = HUD_FRAME_PERSONAGEM[scene.personagemSelecionada] ?? 0;

    // Troca automaticamente o retrato.
    if (!scene.hudStatus?.active || scene.hudStatusFrame !== desejado) {
      montarComSeguranca();
    }

    // A HUD acompanha o tamanho da tela,
    // mas não acompanha o zoom da câmera.
    atualizarPosicaoHUD(scene);
    atualizarBarrasHUD(scene);
  }

  // ===================================================
  // LIMPEZA AO ENCERRAR A CENA
  // ===================================================

  function limpar() {
    if (encerrado) return;

    encerrado = true;

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

  // Se a imagem já estiver carregada.
  if (scene.textures.exists(HUD_CONFIG.chave)) {
    montarComSeguranca();
    return;
  }

  // Carregamento automático, sem mexer no preloader.
  scene.load.once(evento, montarComSeguranca);

  scene.load.on("loaderror", aoFalhar);

  scene.load.image(HUD_CONFIG.chave, HUD_CONFIG.caminho);

  if (!scene.load.isLoading()) {
    scene.load.start();
  }
}

// =====================================================
// CRIAÇÃO DO STATUS
// =====================================================

function criarStatusPlayer(scene) {
  // VIDA — valores mantidos.
  scene.vidaMaxima = 100;
  scene.vida = 100;

  scene.regeneracaoVida = 4;
  scene.tempoSemDanoParaRegen = 4;
  scene.tempoSemDano = 0;

  // ESTAMINA — valores mantidos.
  scene.estaminaMaxima = 100;
  scene.estamina = 100;

  scene.custoAtaque = 20;
  scene.regeneracaoEstamina = 18;

  iniciarHUD(scene);
}

// =====================================================
// ATUALIZAR VIDA E ESTAMINA
// =====================================================

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

function tomarDano(scene, quantidade) {
  const vidaAntes = scene.vida;

  scene.tempoSemDano = 0;

  // DEV ON:
  // O personagem recebe o efeito e o som de dano,
  // mas não perde HP.
  //
  // DEV OFF:
  // Perde HP normalmente.
  if (!scene.developerMode) {
    scene.vida = Phaser.Math.Clamp(
      scene.vida - quantidade,
      0,
      scene.vidaMaxima,
    );
  }

  if ((scene.developerMode && quantidade > 0) || scene.vida < vidaAntes) {
    tocarSomDanoPlayer(scene);
  }

  atualizarBarrasHUD(scene);
}

// =====================================================
// RECUPERAR VIDA
// =====================================================

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
  gastarEstamina,
  tomarDano,
  recuperarVida,
};
