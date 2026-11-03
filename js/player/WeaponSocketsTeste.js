/** Pontos medidos na grade original de 240 px, sem recortar células animadas. */
export const SOCKETS_TESTE_2 = {
  idle: {
    padrao: { x: 93, y: 195 },
    quadros: Object.fromEntries([1, 2, 3, 4].map(i => [i, { x: 93, y: 189 }])),
  },
  walk: {
    // Centro da palma ou extremidade da luva nos quadros em que cobre a pele.
    quadros: [
      [99, 201], [99, 207], [105, 204], [105, 195],
      [105, 189], [99, 189], [105, 195], [105, 201],
      [96, 198], [90, 192], [81, 195], [75, 195],
      [75, 201], [81, 210], [87, 213], [93, 213],
    ].map(([x, y]) => ({ x, y })),
  },
};

export function obterSocketTeste(scene, esquerda, fallback) {
  const p = scene.player;
  const tabela = scene.personagemSelecionada === "personagem-teste-2" ? SOCKETS_TESTE_2 : null;
  const quadro = Number(p.frame?.name);
  // Mocks sem frame e a criatura dourada conservam o encaixe anterior.
  if (!tabela || !Number.isInteger(quadro) || !Number.isFinite(p.displayOriginX) ||
      !Number.isFinite(p.scaleX) || !Number.isFinite(p.scaleY)) {
    return { x: p.x + (esquerda ? -fallback.maoX : fallback.maoX),
      y: p.y + fallback.maoY, medido: false };
  }
  const animacao = p.anims?.currentAnim?.key?.startsWith("walk-") ||
    p.texture?.key === "personagem-teste-2-walk" ? "walk" : "idle";
  const dados = tabela[animacao];
  const local = dados.quadros?.[quadro] ?? dados.padrao ?? tabela.idle.padrao;
  const lx = ((esquerda ? 240 - local.x : local.x) - p.displayOriginX) * p.scaleX;
  const ly = (local.y - p.displayOriginY) * p.scaleY;
  const a = p.rotation ?? 0;
  return { x: p.x + lx * Math.cos(a) - ly * Math.sin(a),
    y: p.y + lx * Math.sin(a) + ly * Math.cos(a),
    medido: true, local, quadro, animacao };
}

/** Transformação exata usada pelo Phaser: espelha antes de girar pelo grip. */
export function transformarPontoArma(config, pose, ponto) {
  const x = (ponto.x - config.empunhadura.x) * pose.escala;
  const y = (ponto.y - config.empunhadura.y) * pose.escala * (pose.esquerda ? -1 : 1);
  const a = pose.rotacaoSprite;
  return { x: pose.mao.x + x * Math.cos(a) - y * Math.sin(a),
    y: pose.mao.y + x * Math.sin(a) + y * Math.cos(a) };
}

/** Histerese evita alternar frente/costas na fronteira horizontal da mira. */
export function camadaArmaTeste(estado, pose) {
  const seno = Math.sin(estado.golpeEspada ? pose.angulo : pose.anguloMira ?? pose.angulo);
  if (seno < -0.18) estado.armaAtras = true;
  else if (seno > -0.08) estado.armaAtras = false;
  return estado.armaAtras ? -0.0001 : 0.0001;
}
