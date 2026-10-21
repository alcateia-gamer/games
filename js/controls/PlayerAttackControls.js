/**
 * @file Entrada do ataque por mouse e toque. Coordena o botão de espada e a carga e soltura do
 * arco da Aria.
 */

import { atacar, soltarAtaque } from "../player/Player.js";

import {
  iniciarSomTensaoAria,
  pararSomTensaoAria,
  tocarSomSoltarFlechaAria,
} from "../sounds/SOUNDS_PERSONAGENS.js/sounds_Aria.js";

/**
 * Cria os controles de ataque e seus listeners, removendo registros anteriores quando a
 * interface é recriada.
 */
function criarControlesAtaque(scene) {
  scene.limparControlesAtaqueFixos?.();

  // =====================================================
  // BOTÃO DE ATAQUE
  // =====================================================

  scene.botaoAtaque = scene.add.circle(720, 350, 46, 0xffffff, 1);
  scene.botaoAtaque.setAlpha(0.75);

  scene.botaoAtaque
    .setStrokeStyle(4, 0x333333, 1)
    .setScrollFactor(0)
    .setDepth(100)
    .setInteractive();

  // =====================================================
  // ESPADA DO BOTÃO
  // =====================================================

  scene.iconeAtaque = scene.add.graphics();

  scene.iconeAtaque
    .setPosition(720, 350)
    .setScrollFactor(0)
    .setDepth(101)
    .setAlpha(0.75);
  
  // =====================================================
  // LÂMINA
  // =====================================================

  scene.iconeAtaque.fillStyle(0xdddddd, 1);
  scene.iconeAtaque.lineStyle(2, 0x333333, 1);

  scene.iconeAtaque.beginPath();
  scene.iconeAtaque.moveTo(0, -31);
  scene.iconeAtaque.lineTo(5, -21);
  scene.iconeAtaque.lineTo(5, 9);
  scene.iconeAtaque.lineTo(-5, 9);
  scene.iconeAtaque.lineTo(-5, -21);
  scene.iconeAtaque.closePath();

  scene.iconeAtaque.fillPath();
  scene.iconeAtaque.strokePath();

  // =====================================================
  // DETALHE DA LÂMINA
  // =====================================================

  scene.iconeAtaque.lineStyle(1, 0xffffff, 0.8);

  scene.iconeAtaque.beginPath();
  scene.iconeAtaque.moveTo(0, -26);
  scene.iconeAtaque.lineTo(0, 5);
  scene.iconeAtaque.strokePath();

  // =====================================================
  // GUARDA, CABO E FINAL DO CABO
  // =====================================================

  scene.iconeAtaque.fillStyle(0x555555, 1);
  scene.iconeAtaque.fillRoundedRect(-13, 8, 26, 5, 2);

  scene.iconeAtaque.fillStyle(0x333333, 1);
  scene.iconeAtaque.fillRoundedRect(-4, 12, 8, 18, 2);

  scene.iconeAtaque.fillStyle(0x555555, 1);
  scene.iconeAtaque.fillCircle(0, 31, 5);

  // =====================================================
  // INCLINAÇÃO E ÁREA CLICÁVEL DA ESPADA
  // =====================================================

  scene.iconeAtaque.setAngle(18);

  scene.iconeAtaque.setInteractive(
    new Phaser.Geom.Rectangle(-25, -40, 50, 80),
    Phaser.Geom.Rectangle.Contains,
  );

  // =====================================================
  // IDENTIFICAR TOQUE
  // =====================================================

  /**
   * Identifica ponteiros de toque para distinguir o dedo do ataque dos demais toques na tela.
   */
  const ponteiroEhToque = (pointer) => {
    if (!pointer) {
      return false;
    }

    return (
      pointer.pointerType === "touch" ||
      pointer.event?.pointerType === "touch" ||
      pointer.isTouch
    );
  };

  let botaoPressionado = false;

  // =====================================================
  // ANIMAÇÃO VISUAL DO BOTÃO
  // =====================================================

  /**
   * Aplica a escala de botão pressionado ao círculo e ao ícone de espada.
   */
  const atualizarPosicaoAtaque = () => {
    const escala = botaoPressionado ? 0.92 : 1;

    scene.botaoAtaque.setScale(escala);
    scene.iconeAtaque.setScale(escala);
  };

  // =====================================================
  // INICIAR ATAQUE E SOM DE TENSÃO
  // =====================================================

  /**
   * Solicita o ataque e inicia o som de tensão apenas quando a Aria começa uma nova carga.
   */
  const iniciarAtaqueComSom = () => {
    const jaEstavaAtacando = scene.atacando;

    // Mantém a lógica de ataque original.
    atacar(scene);

    // Som de tensão somente para a Aria,
    // quando um novo carregamento começar.
    if (
      !jaEstavaAtacando &&
      scene.personagemSelecionada === "aria-kade" &&
      scene.ariaAtaqueCarregando
    ) {
      iniciarSomTensaoAria(scene);
    }
  };

  // =====================================================
  // APERTAR BOTÃO
  // =====================================================

  /**
   * Guarda o ponteiro responsável pelo ataque e aplica a resposta visual de pressionamento.
   */
  const apertarBotao = (pointer) => {
    scene.pointerAtaque = pointer?.id ?? null;

    botaoPressionado = true;

    atualizarPosicaoAtaque();

    iniciarAtaqueComSom();
  };

  // =====================================================
  // SOLTAR BOTÃO VISUAL
  // =====================================================

  /**
   * Restaura a aparência normal do botão ao encerrar o pressionamento.
   */
  const soltarBotao = () => {
    botaoPressionado = false;

    atualizarPosicaoAtaque();
  };

  // =====================================================
  // SOLTAR ATAQUE
  // =====================================================

  /**
   * Libera o ataque do ponteiro correto e coordena a parada da tensão e o som de soltura da
   * Aria.
   */
  const soltarAtaqueAtual = (pointer) => {
    // Não libera a flecha com o toque de outro dedo.
    if (
      ponteiroEhToque(pointer) &&
      scene.pointerAtaque !== (pointer?.id ?? null)
    ) {
      return;
    }

    // Verifica se a Aria realmente estava
    // preparando um disparo.
    const flechaVaiSerDisparada =
      scene.personagemSelecionada === "aria-kade" &&
      scene.atacando &&
      scene.ariaAtaqueCarregando;

    soltarBotao();

    // Cancela ou interrompe o som de tensão.
    pararSomTensaoAria(scene);

    // Executa o disparo original.
    soltarAtaque(scene);

    // Som de disparo sincronizado com
    // o instante em que a flecha é criada.
    if (flechaVaiSerDisparada) {
      tocarSomSoltarFlechaAria(scene);
    }

    scene.pointerAtaque = null;
  };

  // =====================================================
  // BOTÃO NA TELA E ESPADA
  // =====================================================

  scene.botaoAtaque.on("pointerdown", (pointer) => apertarBotao(pointer));

  scene.botaoAtaque.on("pointerup", soltarAtaqueAtual);

  scene.botaoAtaque.on("pointerout", soltarBotao);

  scene.iconeAtaque.on("pointerdown", (pointer) => apertarBotao(pointer));

  scene.iconeAtaque.on("pointerup", soltarAtaqueAtual);

  scene.iconeAtaque.on("pointerout", soltarBotao);

  // =====================================================
  // BOTÃO ESQUERDO DO MOUSE
  // =====================================================

  scene.input.on("pointerdown", (pointer, objetosClicados) => {
    if (!pointer.leftButtonDown()) {
      return;
    }

    // Não inicia outro ataque se clicou em
    // algum objeto interativo.
    if (objetosClicados && objetosClicados.length > 0) {
      return;
    }

    scene.pointerAtaque = pointer.id;

    iniciarAtaqueComSom();
  });

  // Quando solta o mouse ou o dedo.
  scene.input.on("pointerup", soltarAtaqueAtual);
}

export { criarControlesAtaque };
