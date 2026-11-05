/** Adaptação temporária. Troque ativo para false para retirar o personagem do menu. */
export const PERSONAGEM_TESTE = {
  ativo: true,
  id: "personagem-teste",
  textura: "personagem-teste-idle",
  arquivo: "PERSONAGENS/personagens-teste/personagem-teste.png",
  frameSize: 240,
  tamanho: 64,
  totalFrames: 8, // Grade 3×3; a última célula está vazia.
  fps: 8,
  peY: 234,
  nome: "TESTE // 05",
  encaixeArmas: { espada: { maoX: 10, maoY: 15 } },
  arma: {
    id: "rifle-teste",
    textura: "personagem-teste-arma",
    arquivo: "PERSONAGENS/personagens-teste/arma-test-2.png",
    recorte: { x: 90, y: 423, largura: 1075, altura: 467 },
    empunhadura: { x: 285, y: 257 }, // Coordenadas dentro do recorte.
    cano: { x: 1074, y: 153 },
    largura: 34,
    maoX: 4,
    maoY: 18,
    alcanceMira: 300,
    disparoAutomatico: false, // Mira assistida; disparo somente pelo comando de ataque.
    intervaloDisparos: 240, // Milissegundos; manual e automático compartilham a cadência.
    velocidadeLaser: 720,
    alcanceLaser: 700,
    danoLaser: 25,
  },
  botaoAtaque: {
    textura: "personagem-teste-botao-ataque",
    arquivo: "PERSONAGENS/personagens-teste/Attack_Button.webp",
    largura: 454, tamanho: 92,
  },
  botaoAcao: {
    textura: "personagem-teste-botao-acao",
    arquivo: "PERSONAGENS/personagens-teste/Action_Button.webp",
    tamanho: 92,
  },
  botaoTroca: {
    textura: "personagem-teste-botao-troca",
    arquivo: "PERSONAGENS/personagens-teste/Weapon_Button.webp",
    recorte: { x: 0, y: 0, largura: 486, altura: 444 },
  },
};

const GOLPE_ESPADA_BASE = {
  msPorQuadro: 50,
  preparo: 90,
  recuperacao: 95,
  quadroAtivoInicio: 1,
  quadroAtivoFim: 5,
  anguloRepouso: -35,
  origemEfeito: { x: 64, y: 64 },
  raioEfeito: 44, // Raio em pixels da arte; a escala acompanha o comprimento da lâmina.
  rotacaoEfeito: 90,
};

export const GOLPES_ESPADA_TESTE = [
  {
    ...GOLPE_ESPADA_BASE,
    id: "slash-1", tecla: "B",
    prefixoTextura: "personagem-teste-espada-slash1-",
    pasta: "../Tilesets/attack/attack-64x64/attack-128x128/Slash 1/color2/Frames/",
    arquivo: "Slash_color2_frame",
    quadros: 9,
    quadroAtivoFim: 6,
    // Duas passagens da lâmina acompanhando o arco circular desta sequência.
    angulos: [123, -6, -123, -123, -117, -18, 25, 25, 25],
    raioEfeito: 48,
    rotacaoEfeito: 0,
  },
  {
    ...GOLPE_ESPADA_BASE,
    id: "slash-2", tecla: "N",
    prefixoTextura: "personagem-teste-espada-slash2-",
    pasta: "../Tilesets/attack/attack-64x64/attack-128x128/Slash 2/color2/Frames/",
    arquivo: "Slash2_color2_frame",
    quadros: 7,
    quadroAtivoFim: 3,
    angulos: [42, 13, -51, -88, -88, -88, -88],
    origemEfeito: { x: 32, y: 96 },
    raioEfeito: 74,
    rotacaoEfeito: 0,
  },
  {
    ...GOLPE_ESPADA_BASE,
    id: "slash-3", tecla: "M",
    prefixoTextura: "personagem-teste-espada-slash-",
    pasta: "../Tilesets/attack/attack-64x64/attack-128x128/Slash 3/color2/frames/",
    arquivo: "Slash3_color2_frame",
    quadros: 9,
    // Começa embaixo e termina acima da mira.
    angulos: [148, 129, 91, 2, -49, -72, -72, -72, -72],
  },
];

export const ESPADA_PERSONAGEM_TESTE = {
  id: "espada-teste",
  tipo: "espada",
  textura: "personagem-teste-assassin",
  arquivo: "PERSONAGENS/personagens-teste/Assassin_13_starter.webp",
  recorte: { x: 12, y: 90, largura: 216, altura: 60 },
  empunhadura: { x: 44, y: 33 },
  cano: { x: 215, y: 3 }, // Ponta da lâmina; coordenadas dentro do recorte.
  anguloArte: Math.atan2(3 - 33, 215 - 44),
  largura: 44, // Arma inteira próxima da altura visível da primeira personagem (43–45 px).
  maoX: 2,
  maoY: 15,
  alcanceMira: 100,
  disparoAutomatico: false,
  intervaloDisparos: 660,
  dano: 35,
  golpe: GOLPES_ESPADA_TESTE[2], // Botão de ataque e mouse mantêm o Slash 3.
  golpes: GOLPES_ESPADA_TESTE,
  sequencia: [GOLPES_ESPADA_TESTE[2], GOLPES_ESPADA_TESTE[1], GOLPES_ESPADA_TESTE[0]],
};

export const FLORETE_PERSONAGEM_TESTE = {
  id: "florete-teste",
  tipo: "florete",
  textura: "personagem-teste-florete",
  arquivo: "PERSONAGENS/personagens-teste/florete-test.png",
  recorte: { x: 6, y: 108, largura: 270, altura: 72 },
  empunhadura: { x: 239, y: 36 },
  cano: { x: 0, y: 33 },
  anguloArte: Math.atan2(33 - 36, 0 - 239),
  largura: 46, // Lâmina de 41 px; encaixe próximo à mão da segunda personagem.
  maoX: 2,
  maoY: 15,
  alcanceMira: 120,
  disparoAutomatico: false,
  intervaloDisparos: 350,
  dano: 28,
  estocada: { preparo: 70, avancar: 85, recuperar: 180,
    recuo: 4, extensao: 11, anguloRepouso: -12, velocidadeImpulso: 55,
    avancarDash: 140, velocidadeDash: 420, janelaCombo: 900 },
};

// Novo equipamento aprovado: estocada e balanceamento do florete, arte e pivô próprios.
const alcanceFlorete = Math.hypot(FLORETE_PERSONAGEM_TESTE.cano.x - FLORETE_PERSONAGEM_TESTE.empunhadura.x,
  FLORETE_PERSONAGEM_TESTE.cano.y - FLORETE_PERSONAGEM_TESTE.empunhadura.y) *
  FLORETE_PERSONAGEM_TESTE.largura / FLORETE_PERSONAGEM_TESTE.recorte.largura;
export const ARMA_DOURADA_TESTE = {
  ...FLORETE_PERSONAGEM_TESTE,
  id: "dourada-teste",
  textura: "personagem-teste-dourada",
  arquivo: "PERSONAGENS/personagens-teste/arma-test3.webp",
  recorte: { x: 24, y: 84, largura: 186, altura: 66 },
  empunhadura: { x: 24, y: 48 }, // Centro do cabo azul, antes da guarda dourada.
  cano: { x: 180, y: 18 },
  anguloArte: Math.atan2(-30, 156),
  largura: alcanceFlorete * 186 / Math.hypot(156, -30),
  estocada: { ...FLORETE_PERSONAGEM_TESTE.estocada },
  corRastro: 0xf5d97c,
};

export const ARMAS_PERSONAGEM_TESTE = [PERSONAGEM_TESTE.arma, ESPADA_PERSONAGEM_TESTE];

export const PERSONAGEM_TESTE_2 = {
  ativo: true,
  id: "personagem-teste-2",
  nome: "TESTE 2 // 06",
  textura: "personagem-teste-2-idle",
  arquivo: "PERSONAGENS/personagens-teste/personagem-teste-2(idle).png",
  frameSize: 240,
  tamanho: 64,
  totalFrames: 8,
  fps: 8,
  peY: 228,
  walk: {
    textura: "personagem-teste-2-walk",
    arquivo: "PERSONAGENS/personagens-teste/personagem-teste-2(walk).png",
    totalFrames: 16,
    fps: 12,
  },
  armas: [ESPADA_PERSONAGEM_TESTE, FLORETE_PERSONAGEM_TESTE, PERSONAGEM_TESTE.arma, ARMA_DOURADA_TESTE],
  combo: { janela: 900, buffer: 200 },
};

export const PERSONAGENS_TESTE = [PERSONAGEM_TESTE, PERSONAGEM_TESTE_2];

export function obterPersonagemTeste(scene) {
  return PERSONAGENS_TESTE.find(p => p.ativo && p.id === scene.personagemSelecionada);
}

export function obterArmasPersonagemTeste(scene) {
  return obterPersonagemTeste(scene)?.armas ?? ARMAS_PERSONAGEM_TESTE;
}

export function obterArmaPersonagemTeste(scene) {
  const armas = obterArmasPersonagemTeste(scene);
  const id = scene.game?.registry?.get(`${scene.personagemSelecionada}-arma-equipada`);
  const equipada = scene.armaPersonagemTeste?.config;
  return armas.includes(equipada) ? equipada : armas.find(arma => arma.id === id) ?? armas[0];
}

export function personagemTesteAtivo(scene) {
  return !!obterPersonagemTeste(scene);
}

export function carregarPersonagemTeste(scene, prefixo = "") {
  const personagens = PERSONAGENS_TESTE.filter(p => p.ativo);
  if (!personagens.length) return;
  for (const personagem of personagens) {
    for (const folha of [personagem, personagem.walk].filter(Boolean)) {
      if (!scene.textures.exists(folha.textura)) {
        scene.load.spritesheet(folha.textura, prefixo + folha.arquivo, {
          frameWidth: personagem.frameSize,
          frameHeight: personagem.frameSize,
          endFrame: folha.totalFrames - 1,
        });
      }
    }
  }
  const armas = [...new Set([...ARMAS_PERSONAGEM_TESTE, ...personagens.flatMap(p => p.armas ?? [])])];
  for (const arma of armas) {
    if (!scene.textures.exists(arma.textura)) {
      scene.load.image(arma.textura, prefixo + arma.arquivo);
    }
    for (const golpe of arma.golpes ?? (arma.golpe ? [arma.golpe] : [])) {
      for (let i = 0; i < golpe.quadros; i++) {
        const chave = golpe.prefixoTextura + i;
        if (!scene.textures.exists(chave)) {
          scene.load.image(chave,
            prefixo + golpe.pasta + golpe.arquivo + (i + 1) + ".png");
        }
      }
    }
  }
  for (const botao of [PERSONAGEM_TESTE.botaoAtaque, PERSONAGEM_TESTE.botaoAcao, PERSONAGEM_TESTE.botaoTroca]) {
    if (!scene.textures.exists(botao.textura)) scene.load.image(botao.textura, prefixo + botao.arquivo);
  }
}

export function criarAnimacoesPersonagemTeste(scene) {
  const personagem = obterPersonagemTeste(scene);
  for (const direcao of ["up", "left", "down", "right"]) {
    for (const estado of ["idle", "walk"]) {
      const folha = estado === "walk" ? personagem.walk ?? personagem : personagem;
      scene.anims.create({
        key: `${estado}-${direcao}`,
        frames: scene.anims.generateFrameNumbers(folha.textura, {
          start: 0, end: folha.totalFrames - 1,
        }),
        frameRate: folha.fps,
        repeat: -1,
      });
    }
  }
}

export function configurarVisualPersonagemTeste(scene) {
  const personagem = obterPersonagemTeste(scene);
  const escala = personagem.tamanho / personagem.frameSize;
  scene.player.setScale(escala);
  // Alinha os pés de cada folha ao mesmo chão: player.y + 26.
  scene.player.setDisplayOrigin(personagem.frameSize / 2, personagem.peY - 26 / escala);
  scene.player.setFlipX(scene.direcaoAtual === "left");
}

export function configurarHitboxPersonagemTeste(scene) {
  const personagem = obterPersonagemTeste(scene);
  const escala = personagem.tamanho / personagem.frameSize;
  // Corpo de 30×15 no mundo, centralizado nos pés como o dos demais personagens.
  scene.player.body.setSize(30 / escala, 15 / escala);
  scene.player.body.setOffset(personagem.frameSize / 2 - 15 / escala, personagem.peY - 15 / escala);
}
