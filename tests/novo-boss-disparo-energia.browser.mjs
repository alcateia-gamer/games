/** GIF transparente nos disparos reais/ilusórios e compatibilidade com o parry. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;

async function iniciar() {
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("lasers")));
}

try {
  const alfa = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const registros = [];
    for (const [key, frame] of [["novo-boss-disparo-energia", 0], ["novo-boss-disparo-energia", 30], ["novo-boss-disparo-energia-final", 13]]) {
      const texture = scene.textures.get(key), cell = texture.get(frame);
      const canvas = document.createElement("canvas"); canvas.width = 660; canvas.height = 499;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(texture.getSourceImage(), cell.cutX, cell.cutY, 660, 499, 0, 0, 660, 499);
      const pixels = ctx.getImageData(0, 0, 660, 499).data;
      let transparentes = 0, pretosOpacos = 0, escurosColoridos = 0;
      for (let p = 0; p < pixels.length; p += 4) {
        if (!pixels[p + 3]) transparentes++;
        else if (pixels[p] === 0 && pixels[p + 1] === 0 && pixels[p + 2] === 0) pretosOpacos++;
        else if (Math.max(pixels[p], pixels[p + 1], pixels[p + 2]) < 150) escurosColoridos++;
      }
      registros.push({ transparentes, pretosOpacos, escurosColoridos });
    }
    return registros;
  });
  assert.ok(alfa.every(a => a.transparentes > 300000 && a.pretosOpacos === 0 && a.escurosColoridos > 0));
  console.log("PASS: texturas reais sem preto opaco externo/interno; azuis escuros preservados.");

  await posicionar(-590, -5520); await iniciar(); await avancar(700);
  await page.evaluate(() => { window.__disparoEnergiaBrowser = window.__game.scene.getScene("Level1Parte2").novoBoss.projeteisBoss[0]; });
  for (let i = 0; i < 62; i++) {
    const s = await page.evaluate(() => {
      const laser = window.__disparoEnergiaBrowser;
      return { active: laser.active, tipo: laser.type, quadro: laser.novoBossQuadroEnergia,
        chave: laser.texture.key, frame: laser.frame.name, x: laser.x, y: laser.y,
        centroX: laser.body.center.x, centroY: laser.body.center.y,
        largura: laser.body.width, altura: laser.body.height, circulo: laser.body.isCircle };
    });
    assert.ok(s.active && s.tipo === "Sprite");
    assert.equal(s.quadro, i % 61);
    assert.equal(s.chave, i % 61 < 32 ? "novo-boss-disparo-energia" : "novo-boss-disparo-energia-final");
    assert.equal(s.frame, i % 61 < 32 ? i % 61 : i % 61 - 32);
    assert.ok(s.circulo && Math.abs(s.largura - 12) < 0.001 && Math.abs(s.altura - 12) < 0.001);
    assert.ok(Math.hypot(s.x - s.centroX, s.y - s.centroY) < 0.001);
    if (i < 61) await avancar(20);
  }
  console.log("PASS: projétil real percorre os 61 quadros em 1220 ms, troca as páginas sem saltar e mantém círculo de dano com raio 6.");
  await avancar(2580);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.cameras.main.stopFollow().setZoom(0.8).centerOn(-1080, -5810);
  });
  await page.screenshot({ path: "/tmp/novo-boss-disparo/espiral-energia.png" });
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque(); });
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.projeteisBoss.length), 0);

  await sessao.reiniciar(); await posicionar(-590, -5520);
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.iniciarClones()));
  await iniciar(); await avancar(900);
  const clones = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const todos = scene.children.list.filter(o => o.active && o.novoBossDisparoEnergia);
    const falsos = todos.filter(o => o.novoBossAtaqueIlusorio);
    return { reais: b.projeteisBoss.length, falsos: falsos.length,
      quadrosReais: b.projeteisBoss.map(o => o.novoBossQuadroEnergia),
      porClone: b.alvosIlusorios.map(a => falsos.filter(o => o.novoBossDonoIlusao === a.id).map(o => o.novoBossQuadroEnergia)),
      seguros: falsos.every(o => !o.body && !o.especialLaserInimigo && !b.projeteisBoss.includes(o) && o.alpha === 0.32) };
  });
  assert.equal(clones.reais, 3); assert.equal(clones.falsos, 27); assert.ok(clones.seguros);
  assert.ok(clones.porClone.every(quadros => JSON.stringify(quadros) === JSON.stringify(clones.quadrosReais)));
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque(); });
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").children.list
    .filter(o => o.active && o.novoBossDisparoEnergia).length), 0);
  console.log("PASS: nove clones reproduzem os mesmos quadros, sem corpos, dano ou parry; cancelar limpa todos os sprites.");

  await sessao.reiniciar(); await posicionar(-910, -5810); await iniciar();
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    window.__reflexoesEnergiaBrowser = [];
    const original = scene.tentarInterceptarLaserEspecial.bind(scene);
    scene.tentarInterceptarLaserEspecial = laser => {
      const refletiu = original(laser);
      if (refletiu && laser.novoBossDisparoEnergia) window.__reflexoesEnergiaBrowser.push(laser);
      return refletiu;
    };
    scene.events.emit("player:especial");
  });
  await avancar(2400);
  const parry = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return { vida: scene.vida, reflexoes: window.__reflexoesEnergiaBrowser.length,
      equipe: window.__reflexoesEnergiaBrowser.every(l => l.especialRefletido && l.danoEspecial === 30) };
  });
  assert.equal(parry.vida, 100); assert.ok(parry.reflexoes > 0 && parry.equipe);
  console.log("PASS: parry real do Kai reflete os sprites de energia e mantém o jogador sem dano.");

  await sessao.reiniciar(); await posicionar(-590, -5520); await iniciar(); await avancar(900);
  await posicionar(-1093, -5350); await avancar(0);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").children.list
    .filter(o => o.active && o.novoBossDisparoEnergia).length), 0);
  console.log("PASS: sair da arena remove a animação e os projéteis sem efeitos residuais.");
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []); assert.deepEqual(sessao.consoleErrors, []);
} finally { await sessao.fechar(); }
