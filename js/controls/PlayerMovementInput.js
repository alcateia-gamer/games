/** @file Direção compartilhada entre caminhada e dash, com prioridade para WASD. */

function obterDirecaoMovimento(scene) {
  // Reutiliza o vetor para não alocar objetos a cada quadro.
  const direcao = scene.entradaMovimento ??= { x: 0, y: 0 };
  const teclas = scene.teclasWASD;
  direcao.x = Number(!!teclas?.direita?.isDown) - Number(!!teclas?.esquerda?.isDown);
  direcao.y = Number(!!teclas?.baixo?.isDown) - Number(!!teclas?.cima?.isDown);
  const usandoTeclado = teclas?.direita?.isDown || teclas?.esquerda?.isDown ||
    teclas?.cima?.isDown || teclas?.baixo?.isDown;

  if (usandoTeclado) {
    const comprimento = Math.hypot(direcao.x, direcao.y);
    if (comprimento) {
      direcao.x /= comprimento;
      direcao.y /= comprimento;
    }
  } else {
    scene.joystick?.obterDirecao?.(direcao);
  }
  return direcao;
}

export { obterDirecaoMovimento };
