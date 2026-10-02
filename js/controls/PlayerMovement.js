import {
  configurarSomCorrida,
  atualizarSomCorrida,
} from "../sounds/personagem.js";
import {
  atualizarVelocidadeAnimacao,
  atualizarAnimacaoCaminhada,
  atualizarAnimacaoParado,
} from "./PlayerAnimations.js";

function criarMovimento(scene) {
  configurarSomCorrida(scene);
}

function atualizarMovimento(scene) {
  let movimentoX = 0;
  let movimentoY = 0;
  let usandoTeclado = false;

  // WASD
  if (scene.teclasWASD.esquerda.isDown) {
    movimentoX -= 1;
    usandoTeclado = true;
  }

  if (scene.teclasWASD.direita.isDown) {
    movimentoX += 1;
    usandoTeclado = true;
  }

  if (scene.teclasWASD.cima.isDown) {
    movimentoY -= 1;
    usandoTeclado = true;
  }

  if (scene.teclasWASD.baixo.isDown) {
    movimentoY += 1;
    usandoTeclado = true;
  }

  // JOYSTICK
  if (!usandoTeclado && scene.joystick.force > scene.threshold) {
    const angle = Phaser.Math.DegToRad(scene.joystick.angle);
    movimentoX = Math.cos(angle);
    movimentoY = Math.sin(angle);
  }

  const velocidadeBase = scene.speed ?? 200;
  const velocidadeTurbo = scene.speedTurbo ?? 400;
  const usandoTurbo =
    !!scene.developerMode && !!scene.teclaShift && scene.teclaShift.isDown;
  const velocidadeAtual = usandoTurbo ? velocidadeTurbo : velocidadeBase;

  // MOVIMENTO E CAMINHADA
  if (movimentoX !== 0 || movimentoY !== 0) {
    const direcao = new Phaser.Math.Vector2(movimentoX, movimentoY).normalize();

    scene.player.setVelocity(
      direcao.x * velocidadeAtual,
      direcao.y * velocidadeAtual,
    );

    atualizarSomCorrida(scene, true);
    atualizarVelocidadeAnimacao(scene);

    if (Math.abs(direcao.x) > Math.abs(direcao.y)) {
      atualizarAnimacaoCaminhada(scene, direcao.x > 0 ? "right" : "left");
    } else {
      atualizarAnimacaoCaminhada(scene, direcao.y > 0 ? "down" : "up");
    }
  } else {
    atualizarSomCorrida(scene, false);
    scene.player.setVelocity(0, 0);
    scene.player.anims.timeScale = 1;
    atualizarAnimacaoParado(scene);
  }
}

export { criarMovimento, atualizarMovimento };
