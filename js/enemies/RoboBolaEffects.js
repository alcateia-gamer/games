import { atorRelevante } from "../core/ActorActivity.js";
/** Renderização local do Robo Bola: suavização, carga no olho e plasma com rastro. */
function suavizarTexturasRoboBola(scene) {
  for (const key of ["robo-bola", "robo-bola-morte"]) {
    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}

/** Cada efeito acompanha a física e é removido com seu dono ou ao sair da cena. */
function acompanhar(scene, dono, desenhar) {
  const grafico = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  let removido = false;
  let desenhado = false;
  const atualizar = () => {
    if (!dono.active || dono.morto) {
      remover();
      return;
    }
    if (!atorRelevante(scene, dono)) {
      if (desenhado) grafico.clear();
      desenhado = false;
      return;
    }
    grafico.clear();
    desenhar(grafico);
    desenhado = true;
  };
  const remover = () => {
    if (removido) return;
    removido = true;
    scene.events.off("postupdate", atualizar);
    scene.events.off("shutdown", remover);
    dono.off("destroy", remover);
    grafico.destroy();
  };
  scene.events.on("postupdate", atualizar);
  scene.events.once("shutdown", remover);
  dono.once("destroy", remover);
  atualizar();
  return remover;
}

function criarBrilhoOlho(scene, robo, obterOlho) {
  robo.removerBrilhoOlho = acompanhar(scene, robo, (g) => {
    const carga = robo.cargaTiro || 0;
    const flash = Math.max(0, Math.min(1, ((robo.flashDisparoAte || 0) - scene.time.now) / 120));
    if (carga === 0 && flash === 0) return;
    const olho = obterOlho(robo);
    // De costas, a carcaça oculta a carga; a luz aparece na borda de saída.
    g.setDepth(robo.depth + (robo.direcaoAtual === "up" ? -0.001 : 0.001));
    const intensidade = Math.max(carga * 0.75, flash);
    g.fillStyle(0x168eff, 0.12 * intensidade).fillCircle(olho.x, olho.y, 7 + intensidade * 3);
    g.fillStyle(0x3edbff, 0.55 * intensidade).fillCircle(olho.x, olho.y, 2 + intensidade * 2);
    g.fillStyle(0xe4fcff, intensidade).fillCircle(olho.x, olho.y, 1 + flash);
    if (carga > 0) {
      g.lineStyle(0.8, 0x82edff, carga * 0.6);
      g.strokeCircle(olho.x, olho.y, 8 - carga * 5);
    }
    if (flash > 0 && scene.player?.active) {
      const angulo = Math.atan2(scene.player.y - olho.y, scene.player.x - olho.x);
      g.lineStyle(2 * flash, 0xb7f7ff, flash);
      g.lineBetween(olho.x, olho.y, olho.x + Math.cos(angulo) * 12, olho.y + Math.sin(angulo) * 12);
    }
  });
}

function criarRastroPlasma(scene, projetil) {
  const origem = { x: projetil.x, y: projetil.y };
  acompanhar(scene, projetil, (g) => {
    const v = projetil.body?.velocity;
    const angulo = v && Math.hypot(v.x, v.y) > 0 ? Math.atan2(v.y, v.x) : projetil.rotation;
    projetil.setRotation(angulo); // O rastro acompanha também projéteis refletidos pelo Kai.
    const cos = Math.cos(angulo);
    const sin = Math.sin(angulo);
    const rastro = Math.min(26, Math.hypot(projetil.x - origem.x, projetil.y - origem.y));
    g.setDepth(projetil.depth - 0.001);
    const linha = (largura, cor, alpha, inicio, fim) => {
      g.lineStyle(largura, cor, alpha);
      g.lineBetween(projetil.x + cos * inicio, projetil.y + sin * inicio,
        projetil.x + cos * fim, projetil.y + sin * fim);
    };
    linha(9, 0x177eff, 0.13, -8, 8);
    linha(5, 0x25caff, 0.5, -8, 8);
    for (let i = 0; i < 4; i++) {
      linha(3 - i * 0.6, 0x47dbff, 0.5 - i * 0.11,
        -8 - rastro * i / 4, -8 - rastro * (i + 1) / 4);
    }
    g.fillStyle(0xe7fcff, 0.9).fillCircle(projetil.x + cos * 7, projetil.y + sin * 7, 1.5);
  });
}

export { suavizarTexturasRoboBola, criarBrilhoOlho, criarRastroPlasma };
