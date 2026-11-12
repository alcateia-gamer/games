/** Alinhamento e oclusão da iluminação reduzida no Phaser/WebGL com dispositivo móvel. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
}, { spawnX: -1100, spawnY: -4800 }, { viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
  userAgent: "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" });
const { page } = session;
try {
  const result = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
    const draw = s.game.renderer.listeners(Phaser.Renderer.Events.RENDER)
      .find(fn => fn.name === "atualizarIluminacao");
    const texture = s.textures.get("level1-parte2-escuridao");
    const sample = (x, y) => {
      const m = c.matrix, canvas = texture.getSourceImage();
      const sx = Math.floor((m.a*x + m.c*y + m.e) * canvas.width / c.width);
      const sy = Math.floor((m.b*x + m.d*y + m.f) * canvas.height / c.height);
      return texture.getContext().getImageData(sx, sy, 1, 1).data[3] / 255;
    };
    const render = () => { c.preRender(); draw(s, c); };
    const lights = [...s.iluminacaoEmergencia.luzes, ...s.iluminacaoBoss.luzes];
    const enabled = lights.map(l => l.ligada);
    for (const l of lights) l.ligada = false;
    s.definirIluminacaoFabrica(false);
    s.player.setPosition(-840, -5120).setTexture("walk", 0).setDisplayOrigin(64, 64).setVelocity(0, -100);
    s.direcaoAtual = "up";
    c.stopFollow().setRotation(0).setZoom(1.8).centerOn(-840, -5220);
    render();
    const wall = [sample(-840, -5160), sample(-840, -5230), sample(-840, -5310)];
    c.setZoom(1.35).setRotation(0.12);
    render();
    const rotated = [sample(-840, -5160), sample(-840, -5310)];
    c.setViewport(0, 0, 801, 451);
    render();
    const odd = { size: [texture.getSourceImage().width, texture.getSourceImage().height],
      shadow: sample(-840, -5310) };
    c.setViewport(0, 0, 800, 450);
    for (let i = 0; i < lights.length; i++) lights[i].ligada = enabled[i];
    for (const z of s.zonasLuzApagada.zonas) { z.liberada = z.restaurada = true; z.opacidade = 0; }
    s.player.setPosition(-1100, -5200).setVelocity(0, 0);
    c.setZoom(1).setRotation(0).centerOn(-1100, -5200);
    s.time.now = 0; render();
    const angles = s.iluminacaoEmergencia.fontesVisiveis.filter(f => !f.luz.neon).map(f => f.angulo);
    s.time.now = 500; render();
    const later = s.iluminacaoEmergencia.fontesVisiveis.filter(f => !f.luz.neon).map(f => f.angulo);
    const canvas = texture.getSourceImage();
    return { wall, rotated, odd, angles, later, size: [canvas.width, canvas.height],
      gpuContext: texture.getContext().getContextAttributes().willReadFrequently,
      gameSize: [s.game.canvas.width, s.game.canvas.height] };
  });
  assert.deepEqual(result.size, [400, 225], "a máscara usa um quarto dos pixels");
  assert.deepEqual(result.gameSize, [800, 450], "o render do jogo conserva sua resolução");
  assert.equal(result.gpuContext, false, "o canvas não pede leitura frequente de pixels");
  assert.ok(result.wall[0] < 0.65 && result.wall[1] < 0.65, "chão e face da parede continuam iluminados");
  assert.ok(Math.abs(result.wall[2] - 0.75) < 2/255, "a lanterna não atravessa a parede");
  assert.ok(result.rotated[0] < 0.65 && Math.abs(result.rotated[1] - 0.75) < 2/255,
    "zoom e rotação preservam o bloqueio");
  assert.deepEqual(result.odd.size, [401, 226]);
  assert.ok(Math.abs(result.odd.shadow - 0.75) < 2/255, "resize ímpar não desloca sombras");
  assert.deepEqual(result.angles, [], "não existem fontes giratórias");
  assert.deepEqual(result.later, []);
  await session.posicionar(-1100, -4800);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.player.body.checkCollision.none = true;
    s.cameras.main.startFollow(s.player);
  });
  await session.retomar();
  await page.keyboard.down("d");
  try {
    await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").player.x > -1090);
  } finally { await page.keyboard.up("d"); }
  await session.pausar();
  await page.screenshot({ path: "/tmp/factory-lighting-mobile-landscape.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/factory-lighting-mobile-portrait.png" });
  assert.deepEqual(session.errors, []);
  console.log("PASS: Android, máscara 400×225, jogo 800×450, lanterna, paredes, zoom, rotação, resize e movimento real.");
} finally { await session.fechar(); }
