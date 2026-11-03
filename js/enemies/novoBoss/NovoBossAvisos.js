/** Marcações no piso acima da sombra ambiente, abaixo das interfaces. */
export function criarAvisoNovoBoss(scene, x, y, raio) {
  const grafico = scene.add.graphics().setDepth(51);
  grafico.setName?.("novo-boss-aviso");
  let encerrado = false;
  const aviso = {
    grafico, x, y, raio,
    atualizar(progresso = 0) {
      if (encerrado) return;
      const p = Math.max(0, Math.min(1, progresso));
      const pulso = p > 0.75 ? 0.15 * Math.sin(p * 65) : 0;
      grafico.clear().fillStyle(0xe2263c, 0.13 + p * 0.17 + pulso)
        .fillCircle(x, y, raio).lineStyle(2, 0xff4058, 0.95)
        .strokeCircle(x, y, raio).lineStyle(2, 0xffb2b9, 0.9)
        .strokeCircle(x, y, Math.max(1, raio * p));
    },
    destruir() {
      if (encerrado) return;
      encerrado = true;
      grafico.destroy();
    },
  };
  aviso.atualizar(0);
  return aviso;
}
