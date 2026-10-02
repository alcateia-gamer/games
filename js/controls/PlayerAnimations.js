import { atualizarDirecaoAtaqueAria } from "../player/Player.js";

function tocarAnimacaoSeNecessario(scene, chave) {
	if (
		scene.atacando &&
		scene.ariaAtaqueCarregando &&
		chave.startsWith("walk-")
	) {
		atualizarDirecaoAtaqueAria(scene, chave.slice(5));
		return;
	}

	if (
		!scene.player?.anims ||
		(scene.atacando && !chave.startsWith("attack-")) ||
		(scene.player.anims.currentAnim?.key === chave &&
			scene.player.anims.isPlaying)
	) {
		return;
	}

	scene.player.anims.play(chave);
}

function atualizarVelocidadeAnimacao(scene) {
	if (!scene.player || !scene.player.anims) {
		return;
	}

	const velocidadeBase = scene.speed ?? 200;
	const velocidadeTurbo = scene.speedTurbo ?? 400;
	const velocidadeAtual =
		scene.developerMode && scene.teclaShift && scene.teclaShift.isDown
			? velocidadeTurbo
			: velocidadeBase;

	scene.player.anims.timeScale =
		velocidadeAtual > velocidadeBase ? velocidadeAtual / velocidadeBase : 1;
}

function atualizarAnimacaoCaminhada(scene, direcao) {
	scene.direcaoAtual = direcao;
	tocarAnimacaoSeNecessario(scene, `walk-${direcao}`);
}

function atualizarAnimacaoParado(scene) {
	if (scene.atacando) {
		return;
	}

	if (scene.personagemSelecionada === "personagem2") {
		const framesParados = { up: 0, left: 9, down: 18, right: 27 };
		scene.player.anims.stop();
		scene.player.setFrame(framesParados[scene.direcaoAtual] ?? 18);
	} else if (scene.personagemSelecionada === "personagem4") {
		tocarAnimacaoSeNecessario(scene, `idle-${scene.direcaoAtual}`);
	} else {
		scene.player.anims.stop();
	}
}

export {
	tocarAnimacaoSeNecessario,
	atualizarVelocidadeAnimacao,
	atualizarAnimacaoCaminhada,
	atualizarAnimacaoParado,
};
