/**
 * Teste no jogo real via Chromium/CDP; requer servidor HTTP e playwright-core.
 * Veja docs/aria-attack-joystick.md para execução. Não simula um celular físico.
 */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core");
const browser = process.env.CHROME_CDP
  ? await chromium.connectOverCDP(process.env.CHROME_CDP)
  : await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 800, height: 450 }, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
// Expõe a instância só nesta sessão de teste, sem alterar o ponto de entrada do produto.
await page.route("**/js/core/game.js*", async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace(
    "const game = new Game(jogoRapido);", "const game = window.__game = new Game(jogoRapido);",
  ) });
});
const cdp = await context.newCDPSession(page);
const touches = new Map();
let canvasRect;
const frames = () => page.waitForTimeout(100);
const state = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1"), p = s.player;
  return {
    char: s.personagemSelecionada, charging: s.ariaAtaqueCarregando, start: s.ariaCargaInicio,
    pointer: s.pointerAtaque, aim: s.ariaMira, dash: s.estadoDash?.ativo,
    holo: !!s.estadoEspecial?.holograma?.active, x: p.x, y: p.y,
    velocity: { x: p.body.velocity.x, y: p.body.velocity.y },
    geometry: [p.body.x - p.x, p.body.y - p.y, p.body.width, p.body.height],
    shots: s.networkProjectileId,
    arrows: s.__arrows ?? [],
  };
});
async function touch(type, id, x, y) {
  const removed = touches.get(id);
  if (type === "touchEnd") touches.delete(id);
  else touches.set(id, { id, x, y });
  const rect = canvasRect ??= await page.evaluate(() => {
    const r = window.__game.canvas.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const points = type === "touchEnd" ? [removed] : [...touches.values()];
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(t => ({
    id: t.id, x: rect.x + t.x * rect.width / 800, y: rect.y + t.y * rect.height / 450,
    radiusX: 2, radiusY: 2, force: 1,
  })) });
}
async function restart(personagem = "aria-kade") {
  touches.clear();
  canvasRect = null;
  await page.evaluate(personagem => { window.__game.scene.getScene("Level1").scene.restart({ personagem }); }, personagem);
  await page.waitForFunction(personagem => {
    const s = window.__game.scene.getScene("Level1");
    return s.personagemSelecionada === personagem && s.player?.active &&
      (personagem !== "aria-kade" || !!s.ariaAttackJoystick?.scene);
  }, personagem, { polling: 100 });
  await frames();
  // Isola os controles da IA e de paredes locais, mantendo todos os sistemas reais carregados.
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1");
    s.estamina = s.estaminaMaxima;
    s.developerMode = true;
    s.colliderPlayerMapa.active = false;
    // Guarda os atributos na criação: uma parede pode consumir a flecha antes da asserção.
    s.__arrows = [];
    const group = s.projeteisPlayer;
    const add = group.add;
    group.add = function (arrow, ...args) {
      s.__arrows.push({ damage: arrow.dano, speed: arrow.velocidade, direction: { ...arrow.direcaoDisparo } });
      return add.call(this, arrow, ...args);
    };
  });
}
function near(a, b, tolerance = 1e-7) { assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`); }

try {
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/");
  await page.keyboard.press("k");
  await page.waitForFunction(() => !!window.__game?.scene.getScene("Level1")?.player?.active,
    null, { timeout: 60000, polling: 100 });
  await restart();
  const pointers = await page.evaluate(() => window.__game.input.pointers.length);
  assert.ok(pointers >= 5); // Mouse mais quatro dedos.

  // A/C: eventos nativos de toque, diagonal e soltura única.
  await touch("touchStart", 12, 750, 320);
  await touch("touchEnd", 12);
  await frames();
  let s = await state();
  assert.equal(s.shots, 1);
  assert.ok(s.arrows[0].damage >= 25 && s.arrows[0].damage <= 45);
  near(s.arrows[0].direction.x, Math.SQRT1_2);
  near(s.arrows[0].direction.y, -Math.SQRT1_2);
  console.log("PASS A/C: toque rápido e flecha diagonal");

  // B/D/E/F: quatro dedos reais pelo CDP, movimento oposto, holograma e dash.
  await restart();
  const initial = await state();
  await touch("touchStart", 11, 65, 350);
  await touch("touchStart", 12, 755, 350);
  await frames();
  s = await state();
  const chargeStart = s.start, attackPointer = s.pointer;
  assert.ok(s.velocity.x < 0);
  near(s.aim.x, 1);
  assert.deepEqual(s.geometry, initial.geometry);
  await touch("touchStart", 14, 650, 290);
  await frames();
  s = await state();
  assert.equal(s.holo, true);
  assert.equal(s.shots, 0);
  assert.equal(s.start, chargeStart);
  await touch("touchStart", 13, 630, 370);
  await frames();
  s = await state();
  assert.equal(s.dash, true);
  near(s.velocity.x, -650);
  assert.equal(s.pointer, attackPointer);
  await touch("touchEnd", 13);
  await touch("touchEnd", 14);
  await touch("touchEnd", 11);
  await frames();
  s = await state();
  assert.equal(s.charging, true);
  assert.equal(s.shots, 0);
  await page.waitForTimeout(1250);
  // Arrastar sobre o especial não ativa outro holograma nem troca a captura.
  await touch("touchMove", 12, 650, 290);
  await frames();
  assert.equal((await state()).pointer, attackPointer);
  await page.screenshot({ path: process.env.ARIA_SCREENSHOT ?? "/tmp/aria-charge.png" });
  await touch("touchEnd", 12);
  await frames();
  s = await state();
  assert.equal(s.shots, 1);
  assert.equal(s.arrows[0].damage, 45);
  assert.equal(s.arrows[0].speed, 600);
  assert.equal(s.charging, false);
  console.log("PASS B/D/E/F: quatro dedos, carga máxima, movimento, dash e holograma");

  // F: troca com o holograma durante uma nova carga.
  await page.waitForTimeout(300);
  await touch("touchStart", 12, 755, 350);
  const beforeSwap = await state();
  await touch("touchStart", 14, 650, 290);
  await frames();
  s = await state();
  assert.equal(s.holo, false);
  assert.equal(s.charging, true);
  assert.equal(s.start, beforeSwap.start);
  assert.equal(s.shots, beforeSwap.shots);
  await touch("touchEnd", 14);
  await touch("touchEnd", 12);
  console.log("PASS F: troca de posição preserva carga e ponteiro");

  // H: blur, pause e cancelamento nativo nunca soltam flechas.
  for (const interruption of ["blur", "pause", "touchcancel", "respawn", "menu", "death"]) {
    await restart();
    await touch("touchStart", 12, 755, 350);
    if (interruption === "touchcancel") {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      touches.clear();
    }
    await page.evaluate(async interruption => {
      const s = window.__game.scene.getScene("Level1");
      if (interruption === "blur") s.game.events.emit("blur");
      if (interruption === "pause") { s.scene.pause(); s.scene.resume(); }
      if (interruption === "respawn") (await import("/js/player/Player.js")).respawnPlayer(s);
      if (interruption === "menu") s.generatorMenuOpen = true;
      if (interruption === "death") s.morteEmAndamento = true;
    }, interruption);
    if (interruption !== "touchcancel") await touch("touchEnd", 12);
    await frames();
    assert.equal((await state()).shots, 0, interruption);
    assert.equal((await state()).charging, false, interruption);
  }
  console.log("PASS H: interrupções cancelam sem disparo");

  // G: corpos Arcade reais e colisão contínua, inclusive dano ao robô e boss.
  await restart();
  const collisions = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1");
    const { dispararProjetil, atualizarProjeteis } = await import("/js/player/PlayerProjectiles.js");
    s.player.setPosition(10000, 10000);
    s.direcaoAtaque = "right";
    const p = dispararProjetil(s, { direction: { x: 1, y: 0 }, damage: 45 });
    const wall = s.collisionGroup.create(p.x + 50, p.y);
    wall.body.setSize(1, 100);
    atualizarProjeteis(s, 500);
    const wallHit = !p.active;
    wall.destroy();
    const q = dispararProjetil(s, { direction: { x: 1, y: 0 }, damage: 45 });
    const enemy = s.physics.add.sprite(q.x + 80, q.y, "walk");
    enemy.vida = enemy.vidaMaxima = 100;
    enemy.hitboxDano = new Phaser.Geom.Rectangle(q.x + 70, q.y - 10, 20, 20);
    s.inimigos = [enemy];
    // O multiplayer desliga apenas efeitos de impacto, que têm suíte própria.
    s.multiplayer = true;
    atualizarProjeteis(s, 500);
    const enemyLife = enemy.vida;
    atualizarProjeteis(s, 500);
    const enemyLifeAfter = enemy.vida;
    enemy.destroy(); s.inimigos = [];
    const r = dispararProjetil(s, { direction: { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, damage: 45 });
    const bossSprite = s.add.sprite(r.x + 80, r.y - 80, "walk");
    s.bossFinal = { active: true, vida: 100, vidaMaxima: 100, sprite: bossSprite,
      hitboxDano: new Phaser.Geom.Rectangle(r.x + 70, r.y - 90, 20, 20) };
    atualizarProjeteis(s, 500);
    const bossLife = s.bossFinal.vida;
    bossSprite.destroy(); s.bossFinal = null; s.multiplayer = false;
    return { wallHit, enemyLife, enemyLifeAfter, bossLife };
  });
  assert.deepEqual(collisions, { wallHit: true, enemyLife: 55, enemyLifeAfter: 55, bossLife: 55 });
  console.log("PASS G: parede fina, robô e boss com corpos e dano reais");

  // J: hit testing do Phaser após zoom, além do redimensionamento físico da janela.
  await restart();
  await page.evaluate(() => { window.__game.scene.getScene("Level1").cameras.main.setZoom(1.7); });
  await frames();
  await touch("touchStart", 12, 750, 320);
  assert.equal((await state()).charging, true);
  near((await state()).aim.x, Math.SQRT1_2);
  await page.setViewportSize({ width: 1040, height: 600 });
  canvasRect = null;
  await frames();
  assert.equal((await state()).charging, false);
  await touch("touchEnd", 12);
  assert.equal((await state()).shots, 0);
  await touch("touchStart", 12, 750, 320);
  await touch("touchEnd", 12);
  await frames();
  assert.equal((await state()).shots, 1);
  console.log("PASS J: zoom e resize mantêm a área interativa alinhada");

  // I e desktop: os demais personagens mantêm botão e mouse originais.
  for (const char of ["kai-mercer", "magnus-force", "nyx"]) {
    await restart(char);
    assert.equal(await page.evaluate(() => !!window.__game.scene.getScene("Level1").ariaAttackJoystick), false);
    await touch("touchStart", 12, 720, 350);
    await frames();
    assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1").networkAttackId), 1);
    await touch("touchEnd", 12);
  }
  await restart();
  await page.mouse.move(400, 300);
  await page.mouse.down();
  assert.equal((await state()).charging, true);
  await page.mouse.up();
  await frames();
  assert.equal((await state()).shots, 1);
  console.log("PASS I/desktop: personagens originais e ataque por mouse");
  assert.deepEqual(errors, []);
  console.log("PASS: sem exceções JavaScript no jogo real");
} finally {
  await context.close();
  await browser.close();
}
