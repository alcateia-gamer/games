/**
 * @file Botão do ataque especial, independente do
 * ataque normal e do dash (Sandevistan).
 *
 * Prepara a interface e o evento "player:especial".
 * As habilidades serão implementadas posteriormente.
 */

const CHAVE_ATLAS_ORIGINAL = "botoes-ulti";
const CHAVE_FRAMES = "botoes-ulti-quadros";

const CONFIG_BOTAO_ESPECIAL = Object.freeze({
  tamanho: 76,

  // Coordenadas lógicas do jogo: 850x405
  // Ataque: (720,350)
  // Dash: (630,370)
  telaX: 650,
  telaY: 290,

  profundidade: 220,
  opacidade: 0.93,
  escalaPressionado: 0.9,
});

// =====================================================
// CONFIGURAÇÃO DOS QUATRO PERSONAGENS
// =====================================================

const ESPECIAIS_PERSONAGENS = Object.freeze({
  "kai-mercer": {
    frame: 0,
    cor: 0x38bdf8,
    texto: "PAR",
  },

  "magnus-force": {
    frame: 1,
    cor: 0xfb923c,
    texto: "IMP",
  },

  "aria-kade": {
    frame: 2,
    cor: 0xf472b6,
    texto: "HOLO",
  },

  nyx: {
    frame: 3,
    cor: 0xa78bfa,
    texto: "CRT",
  },
});

// =====================================================
// PREPARAR IMAGENS DOS BOTÕES
// =====================================================

/**
 * A imagem botoes-ulti.png deve conter os quatro
 * botões em uma grade 2x2:
 *
 * Kai    | Magnus
 * Aria   | Nyx
 *
 * Os tamanhos dos frames são calculados automaticamente.
 */

function prepararQuadrosEspecial(scene) {
  if (scene.textures.exists(CHAVE_FRAMES)) {
    return true;
  }

  if (!scene.textures.exists(CHAVE_ATLAS_ORIGINAL)) {
    console.warn("Especial: botoes-ulti.png não carregado.");
    return false;
  }

  const imagem = scene.textures.get(CHAVE_ATLAS_ORIGINAL).getSourceImage();

  const largura = imagem?.width ?? 0;
  const altura = imagem?.height ?? 0;

  if (largura < 4 || altura < 4 || largura % 2 !== 0 || altura % 2 !== 0) {
    console.warn("Especial: PNG precisa ter grade 2x2.");
    return false;
  }

  scene.textures.addSpriteSheet(CHAVE_FRAMES, imagem, {
    frameWidth: largura / 2,
    frameHeight: altura / 2,
    endFrame: 3,
  });

  return scene.textures.exists(CHAVE_FRAMES);
}

// =====================================================
// CONSTRUIR BOTÃO
// =====================================================

function construirVisual(scene, perfil) {
  if (prepararQuadrosEspecial(scene)) {
    const botao = scene.add.image(0, 0, CHAVE_FRAMES, perfil.frame);

    botao.setDisplaySize(
      CONFIG_BOTAO_ESPECIAL.tamanho,
      CONFIG_BOTAO_ESPECIAL.tamanho,
    );

    const quadro = scene.textures.getFrame(CHAVE_FRAMES, perfil.frame);

    botao.setInteractive(
      new Phaser.Geom.Circle(
        quadro.width / 2,
        quadro.height / 2,
        quadro.width * 0.46,
      ),
      Phaser.Geom.Circle.Contains,
    );

    return {
      botao,
      texto: null,
      usaImagem: true,
    };
  }

  // Botão provisório se o PNG não carregar.

  const raio = CONFIG_BOTAO_ESPECIAL.tamanho / 2;

  const botao = scene.add
    .circle(0, 0, raio, 0xeeeeee, 1)
    .setStrokeStyle(4, perfil.cor, 1)
    .setInteractive(
      new Phaser.Geom.Circle(raio, raio, raio),
      Phaser.Geom.Circle.Contains,
    );

  const texto = scene.add
    .text(0, 0, perfil.texto, {
      fontSize: "16px",
      color: "#252936",
      fontFamily: "monospace",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(CONFIG_BOTAO_ESPECIAL.profundidade + 1);

  return {
    botao,
    texto,
    usaImagem: false,
  };
}

// =====================================================
// CRIAR CONTROLES DO ESPECIAL
// =====================================================

function criarControlesEspecial(scene) {
  scene.limparControlesEspecial?.();

  const personagem = scene.personagemSelecionada ?? "kai-mercer";

  const perfil =
    ESPECIAIS_PERSONAGENS[personagem] ?? ESPECIAIS_PERSONAGENS["kai-mercer"];

  const { botao, texto, usaImagem } = construirVisual(scene, perfil);

  const tamanho = CONFIG_BOTAO_ESPECIAL.tamanho;

  let ponteiroAtivo = null;
  let pressionado = false;

  scene.botaoEspecial = botao;
  scene.iconeEspecialFallback = texto;

  botao
    .setScrollFactor(0)
    .setDepth(CONFIG_BOTAO_ESPECIAL.profundidade)
    .setAlpha(CONFIG_BOTAO_ESPECIAL.opacidade);

  // ===================================================
  // MANTER BOTÃO FIXO DURANTE O ZOOM
  // ===================================================

  const reposicionar = () => {
    if (!botao.scene) return;

    const camera = scene.cameras.main;
    if (!camera) return;

    const zoomX = camera.zoomX || camera.zoom || 1;

    const zoomY = camera.zoomY || camera.zoom || 1;

    const origemX = camera.width * camera.originX;

    const origemY = camera.height * camera.originY;

    const x = origemX + (CONFIG_BOTAO_ESPECIAL.telaX - origemX) / zoomX;

    const y = origemY + (CONFIG_BOTAO_ESPECIAL.telaY - origemY) / zoomY;

    const escala = pressionado ? CONFIG_BOTAO_ESPECIAL.escalaPressionado : 1;

    botao.setPosition(x, y);

    if (usaImagem) {
      botao.setDisplaySize(
        (tamanho * escala) / zoomX,
        (tamanho * escala) / zoomY,
      );
    } else {
      botao.setScale(escala / zoomX, escala / zoomY);
    }

    texto?.setPosition(x, y).setScale(escala / zoomX, escala / zoomY);
  };

  // ===================================================
  // VERIFICAR SE O JOGADOR PODE USAR ESPECIAL
  // ===================================================

  const podeAcionar = () =>
    !!scene.player?.active &&
    !scene.movimentoBloqueado &&
    !scene.morteEmAndamento &&
    !scene.generatorMenuOpen;

  // ===================================================
  // EVENTO DO ATAQUE ESPECIAL
  // ===================================================

  const acionar = () => {
    if (!podeAcionar()) {
      return false;
    }

    // As habilidades serão conectadas a este evento.
    scene.events.emit("player:especial", {
      personagem: scene.personagemSelecionada ?? "kai-mercer",
      jogador: scene.player,
    });

    if (scene.developerMode) {
      console.log(`[Especial] Botão pressionado: ${personagem}`);
    }

    return true;
  };

  scene.ativarEspecial = acionar;

  // ===================================================
  // CONTROLE DE TOQUE / MOUSE
  // ===================================================

  const aoPressionar = (pointer) => {
    pointer?.event?.preventDefault?.();

    // Evita dois acionamentos ao mesmo tempo.
    if (ponteiroAtivo !== null) {
      return;
    }

    ponteiroAtivo = pointer?.id ?? -1;
    pressionado = true;

    reposicionar();
    acionar();
  };

  const aoSoltar = (pointer) => {
    if (ponteiroAtivo === null) {
      return;
    }

    if (pointer && (pointer.id ?? -1) !== ponteiroAtivo) {
      return;
    }

    ponteiroAtivo = null;
    pressionado = false;

    reposicionar();
  };

  botao.on("pointerdown", aoPressionar);
  botao.on("pointerup", aoSoltar);

  botao.on("pointerout", () => {
    aoSoltar();
  });

  // ===================================================
  // TECLADO - TECLA G
  // ===================================================

  // A tecla R já é usada para respawn.
  // A tecla G será exclusiva do ataque especial.

  const teclaEspecial = scene.input.keyboard?.addKey(
    Phaser.Input.Keyboard.KeyCodes.G,
  );

  const aoPressionarTecla = () => {
    if (scene.input.keyboard?.enabled === false) {
      return;
    }

    acionar();
  };

  teclaEspecial?.on("down", aoPressionarTecla);

  // ===================================================
  // ATUALIZAR POSIÇÃO
  // ===================================================

  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, reposicionar);

  // ===================================================
  // LIMPEZA AO MUDAR DE CENA
  // ===================================================

  const limpar = () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, reposicionar);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    teclaEspecial?.off("down", aoPressionarTecla);

    botao.removeAllListeners();

    if (botao.active) {
      botao.destroy();
    }

    texto?.destroy();

    scene.botaoEspecial = null;
    scene.iconeEspecialFallback = null;
    scene.ativarEspecial = null;

    if (scene.limparControlesEspecial === limpar) {
      scene.limparControlesEspecial = null;
    }
  };

  scene.limparControlesEspecial = limpar;

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limpar);

  reposicionar();
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export { CONFIG_BOTAO_ESPECIAL, ESPECIAIS_PERSONAGENS, criarControlesEspecial };
