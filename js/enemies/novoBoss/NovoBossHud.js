/** Barra própria do encontro; não depende da HUD ou dos recursos do boss antigo. */
const LARGURA_BARRA = 256;
const ESTADOS = {
  posicionada: ["PREPARANDO", 0xf3bc55],
  preparando: ["PREPARANDO", 0xf3bc55],
  atacando: ["ATAQUE", 0xff536f],
  vulneravel: ["VULNERÁVEL", 0x52ebc0],
  teletransportando: ["REPOSICIONANDO", 0xb8a0ff],
  derrotada: ["DERROTADA", 0xc95868],
};

export function criarHudNovoBoss(scene, encontro) {
  if (!scene.add?.container || !scene.cameras?.main) return null;
  const container = scene.add.container(0, 0)
    .setScrollFactor(0).setDepth(100010);
  const fundo = scene.add.rectangle(0, 0, LARGURA_BARRA + 8, 18, 0x061017, 0.95)
    .setStrokeStyle(1, 0x9b5362);
  const preenchimento = scene.add.rectangle(-LARGURA_BARRA / 2, 0,
    LARGURA_BARRA, 10, 0x52ebc0).setOrigin(0, 0.5);
  const textoVida = scene.add.text(0, 0, "", {
    fontFamily: "monospace", fontSize: "10px", color: "#ffffff",
    stroke: "#061017", strokeThickness: 3,
  }).setOrigin(0.5);
  const textoEstado = scene.add.text(0, -19, "", {
    fontFamily: "monospace", fontSize: "11px", color: "#ffffff",
    stroke: "#061017", strokeThickness: 3,
  }).setOrigin(0.5);
  container.add([fundo, preenchimento, textoVida, textoEstado]);
  encontro.hud = { container, preenchimento, textoVida, textoEstado };
  atualizarHudNovoBoss(scene, encontro);
  return encontro.hud;
}

export function atualizarHudNovoBoss(scene, encontro) {
  const hud = encontro.hud;
  if (!hud) return;
  const camera = scene.cameras.main;
  const zoomX = camera.zoomX || camera.zoom || 1;
  const zoomY = camera.zoomY || camera.zoom || 1;
  const centroX = camera.width * camera.originX;
  const centroY = camera.height * camera.originY;
  hud.container.setPosition(
    centroX + (camera.width / 2 - centroX) / zoomX,
    centroY + (camera.height - 30 - centroY) / zoomY,
  ).setScale(1 / zoomX, 1 / zoomY);
  hud.container.setVisible(Boolean(encontro.sprite && !encontro.encerrado &&
    !encontro.suspenso && encontro.jogadorNaArena && !scene.multiplayer));
  const fracao = Math.max(0, Math.min(1, encontro.vida / encontro.vidaMaxima));
  const [rotulo, cor] = ESTADOS[encontro.estado] ?? ESTADOS.preparando;
  const protegida = encontro.relogioCombate < (encontro.invulneravelClonesAte ?? 0);
  hud.preenchimento.setSize(LARGURA_BARRA * fracao, 10).setFillStyle(protegida ? 0xb8a0ff : cor);
  hud.textoVida.setText(`${Math.ceil(encontro.vida)} / ${encontro.vidaMaxima}`);
  const ligados = encontro.geradores?.filter(gerador => gerador.ligado).length ?? 0;
  let detalhe = protegida ? "CLONAGEM · PROTEGIDA"
    : encontro.transicaoFase2Pendente && encontro.estado !== "vulneravel" ? "CLONES SE APROXIMAM" : rotulo;
  if (encontro.sistemaIlusoes?.ativo) detalhe += " · NÚCLEO PULSANTE";
  else if (encontro.sistemaClones?.ativo) {
    const clones = encontro.sistemaClones.alvos.filter(alvo => alvo.active).length;
    detalhe += ` · ${clones} CLONES`;
  }
  hud.textoEstado.setText(encontro.barreiraAtiva
    ? `BARREIRA · ${ligados}/${encontro.geradores.length} GERADORES ATIVOS`
    : `FASE ${encontro.fase ?? 1} · ${detalhe}`);
}

export function destruirHudNovoBoss(encontro) {
  encontro.hud?.container.destroy();
  encontro.hud = null;
}
