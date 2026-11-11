/** Centro da barriga nas coordenadas originais de cada folha, independente dos braços. */
const ORIGENS_BARRIGA = {
  walk: { tamanho: 128, x: 64, y: 74 },
  "personagem2-walk": { tamanho: 64, x: 32, y: 40 },
  "personagem3-walk": { tamanho: 128, x: 64, y: 77 },
  "personagem4-walk": { tamanho: 64, x: 32, y: 38 },
};

const ANGULOS = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/** Reutiliza a pose e conserva a mira diagonal quando a caminhada para. */
export function atualizarPoseLanterna(scene, pose) {
  const player = scene.player;
  const direcao = scene.direcaoAtual ?? "down";
  const velocidade = player.body?.velocity;
  if (velocidade && Math.hypot(velocidade.x, velocidade.y) > 1) {
    pose.angulo = Math.atan2(velocidade.y, velocidade.x);
  } else if (pose.angulo == null || pose.direcao !== direcao) {
    pose.angulo = ANGULOS[direcao] ?? ANGULOS.down;
  }
  pose.direcao = direcao;

  const barriga = ORIGENS_BARRIGA[player.texture?.key];
  const escalaX = player.scaleX ?? 1;
  const escalaY = player.scaleY ?? 1;
  let x, y;
  if (barriga) {
    // Phaser espelha dentro da célula antes de aplicar origem, escala e rotação.
    x = ((player.flipX ? barriga.tamanho - barriga.x : barriga.x) -
      (player.displayOriginX ?? barriga.tamanho / 2)) * escalaX;
    y = ((player.flipY ? barriga.tamanho - barriga.y : barriga.y) -
      (player.displayOriginY ?? barriga.tamanho / 2)) * escalaY;
  } else {
    // Ataques conservam o centro do tronco, sem depender das margens da folha.
    x = 0;
    y = 10 * escalaY;
  }
  const rotacao = player.rotation ?? 0;
  const cos = Math.cos(rotacao), sin = Math.sin(rotacao);
  pose.x = player.x + x * cos - y * sin;
  pose.y = player.y + x * sin + y * cos;
  return pose;
}

/** Usa a mira enviada pelo dono e a posição interpolada vista nesta tela. */
export function atualizarLanternasAliadas(scene, lanternas, energia = false) {
  const presentes = new Set();
  let alteradas = false;
  for (const player of scene.remotePlayers?.values() || []) {
    if (energia || !player.active || player.morto || player.visible === false ||
        !Number.isFinite(player.coopFlashlightAngle)) continue;
    presentes.add(player);
    let entrada = lanternas.get(player);
    if (!entrada) { entrada = { player, pose: {} }; lanternas.set(player, entrada); alteradas = true; }
    const { pose } = entrada, x = pose.x, y = pose.y, angulo = pose.angulo;
    atualizarPoseLanterna({ player, direcaoAtual: player.direcaoAtual }, pose);
    pose.angulo = player.coopFlashlightAngle;
    if (x !== pose.x || y !== pose.y || angulo !== pose.angulo || entrada.frame !== player.frame) alteradas = true;
    for (const key of ["scaleX", "scaleY", "flipX", "flipY", "rotation", "originX", "originY", "alpha"]) {
      if (entrada[key] !== player[key]) alteradas = true;
      entrada[key] = player[key];
    }
    entrada.frame = player.frame;
  }
  for (const player of lanternas.keys()) if (!presentes.has(player)) { lanternas.delete(player); alteradas = true; }
  return alteradas;
}
