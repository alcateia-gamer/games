import { atacar, soltarAtaque } from "../player/Player.js";

function criarControlesAtaque(scene) {
	// BOTÃO DE ATAQUE
	scene.botaoAtaque = scene.add.circle(720, 350, 46, 0xffffff, 0.9);
	scene.botaoAtaque.setStrokeStyle(4, 0x333333, 1);
	scene.botaoAtaque.setScrollFactor(0).setDepth(100).setInteractive();

	// ESPADA DO BOTÃO
	scene.iconeAtaque = scene.add.graphics();
	scene.iconeAtaque.setPosition(720, 350).setScrollFactor(0).setDepth(101);

	// LÂMINA
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

	// DETALHE DA LÂMINA
	scene.iconeAtaque.lineStyle(1, 0xffffff, 0.8);
	scene.iconeAtaque.beginPath();
	scene.iconeAtaque.moveTo(0, -26);
	scene.iconeAtaque.lineTo(0, 5);
	scene.iconeAtaque.strokePath();

	// GUARDA, CABO E FINAL DO CABO
	scene.iconeAtaque.fillStyle(0x555555, 1);
	scene.iconeAtaque.fillRoundedRect(-13, 8, 26, 5, 2);
	scene.iconeAtaque.fillStyle(0x333333, 1);
	scene.iconeAtaque.fillRoundedRect(-4, 12, 8, 18, 2);
	scene.iconeAtaque.fillStyle(0x555555, 1);
	scene.iconeAtaque.fillCircle(0, 31, 5);

	// INCLINAÇÃO E ÁREA CLICÁVEL DA ESPADA
	scene.iconeAtaque.setAngle(18);
	scene.iconeAtaque.setInteractive(
		new Phaser.Geom.Rectangle(-25, -40, 50, 80),
		Phaser.Geom.Rectangle.Contains,
	);

	const apertarBotao = () => {
		scene.botaoAtaque.setScale(0.92);
		scene.iconeAtaque.setScale(0.92);
		atacar(scene);
	};

	const soltarBotao = () => {
		scene.botaoAtaque.setScale(1);
		scene.iconeAtaque.setScale(1);
	};

	const soltarAtaqueAtual = () => {
		soltarBotao();
		soltarAtaque(scene);
	};

	// BOTÃO NA TELA E ESPADA
	scene.botaoAtaque.on("pointerdown", apertarBotao);
	scene.botaoAtaque.on("pointerup", soltarAtaqueAtual);
	scene.botaoAtaque.on("pointerout", soltarBotao);
	scene.iconeAtaque.on("pointerdown", apertarBotao);
	scene.iconeAtaque.on("pointerup", soltarAtaqueAtual);
	scene.iconeAtaque.on("pointerout", soltarBotao);

	// BOTÃO ESQUERDO DO MOUSE
	scene.input.on("pointerdown", (pointer, objetosClicados) => {
		if (!pointer.leftButtonDown()) {
			return;
		}

		if (objetosClicados && objetosClicados.length > 0) {
			return;
		}

		atacar(scene);
	});

	scene.input.on("pointerup", soltarAtaqueAtual);
}

export { criarControlesAtaque };
