/** Dano real com deformação visual e física Arcade, inclusive contra paredes finas. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/enemy-knockback-test", route => route.fulfill({ contentType: "text/html", body: `
    <script src="/js/libs/phaser.min.js"></script><script>
    new Phaser.Game({type:Phaser.CANVAS,width:800,height:600,audio:{noAudio:true},
      physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:{create(){
        const g=this.make.graphics({add:false});
        for(const [key,w,h] of [['padrao',311,421],['serra',278,270],['bola',127,127]]){
          g.clear().fillStyle(0xffffff).fillRect(0,0,w,h);g.generateTexture(key,w,h);
        }
        g.destroy();window.s=this;this.scene.pause();
      }}});</script>` }));
  await page.goto((process.env.BASE_URL ?? "http://127.0.0.1:8765") + "/enemy-knockback-test");
  await page.waitForFunction(() => window.s?.scene.isPaused());
  const report = await page.evaluate(async () => {
    const { protegerColisaoInimigo } = await import("/js/enemies/EnemyCollision.js");
    const { causarDanoInimigo } = await import("/js/enemies/EnemyHealth.js");
    const { retanguloLivreDoMapa, invalidarCacheNavegacao } = await import("/js/enemies/EnemyPathfinding.js");
    const s = window.s, failures = [];
    s.collisionGroup = s.physics.add.staticGroup();
    function step(ms) {
      s.time.now += ms;
      for (const tween of s.tweens.getTweens()) tween.update(ms);
      s.physics.world.bodies.forEach(b => { if (b.enable) b.preUpdate(false, ms / 1000); });
      s.physics.world.step(ms / 1000);
      s.physics.world.postUpdate();
    }
    let cases = 0;
    for (const [tipo, escala, largura, altura, offsetX, offsetY] of [
      ["padrao", 0.23, 180, 110, 65, 270], ["serra", 0.36, 190, 100, 44, 160],
      ["bola", 0.56, 60, 60, 33.5, 33.5],
    ]) for (const framesPorGolpe of [3, 12]) {
    for (const axis of ["x", "y"]) for (const sign of [-1, 1]) {
      for (const gap of [0.02, 1, 5]) for (const ms of [1000 / 60, 100]) {
        const horizontal = axis === "x";
        const wall = s.collisionGroup.create(300, 300, "padrao");
        wall.body.setSize(horizontal ? 2 : 500, horizontal ? 500 : 2);
        wall.body.updateCenter();
        const bWall = wall.body;
        s.physics.world.staticTree.remove(bWall);s.physics.world.staticTree.insert(bWall);
        invalidarCacheNavegacao(s);
        const r = s.physics.add.sprite(0, 0, tipo).setScale(escala);
        r.body.setSize(largura, altura).setOffset(offsetX, offsetY);
        r.body.updateFromGameObject();
        // Coloca os pés junto à parede, dos quatro lados.
        const targetX = horizontal ? (sign > 0 ? bWall.x - r.body.width - gap : bWall.right + gap) : 290;
        const targetY = horizontal ? 290 : (sign > 0 ? bWall.y - r.body.height - gap : bWall.bottom + gap);
        r.x += targetX - r.body.x;r.y += targetY - r.body.y;r.body.updateFromGameObject();
        r.vida = r.vidaMaxima = 10000;r.tipoRobo = tipo;
        s.inimigos = [r];
        s.player = { active: true, x: r.x - (horizontal ? sign * 100 : 0),
          y: r.y - (horizontal ? 0 : sign * 100) };
        protegerColisaoInimigo(s, r);
        const collider = s.physics.add.collider(r, s.collisionGroup);
        step(1000 / 60);
        const inicial = { width: r.body.width, height: r.body.height,
          offsetX: r.body.x - r.x, offsetY: r.body.y - r.y };
        let falhou = false;
        for (let hit = 0; hit < 8; hit++) {
          causarDanoInimigo(s, r, 1, { particles: 0 });
          for (let frame = 0; frame < framesPorGolpe; frame++) {
            step(ms);
            const farSide = horizontal
              ? (sign > 0 ? r.body.right > bWall.x + 0.001 : r.body.x < bWall.right - 0.001)
              : (sign > 0 ? r.body.bottom > bWall.y + 0.001 : r.body.y < bWall.bottom - 0.001);
            const mudouCorpo = Math.abs(r.body.width - inicial.width) > 1e-6 ||
              Math.abs(r.body.height - inicial.height) > 1e-6 ||
              Math.abs(r.body.x - r.x - inicial.offsetX) > 1e-6 ||
              Math.abs(r.body.y - r.y - inicial.offsetY) > 1e-6;
            if (farSide || mudouCorpo || !retanguloLivreDoMapa(s, r.body)) {
              failures.push({ tipo, framesPorGolpe, mudouCorpo, axis, sign, gap, ms, hit, frame, x: r.body.x, y: r.body.y,
                width: r.body.width, height: r.body.height, wall: { x: bWall.x, y: bWall.y },
                scaleX: r.scaleX, scaleY: r.scaleY });
              falhou = true;break;
            }
          }
          if (falhou) break;
        }
        cases++;collider.destroy();s.tweens.killTweensOf(r);r.destroy();wall.destroy();
      }
    }
    }
    // Em espaço livre o impacto continua animado e o impulso continua funcionando.
    invalidarCacheNavegacao(s);
    const livre = s.physics.add.sprite(1000, 1000, "padrao").setScale(0.23);
    livre.body.setSize(180, 110).setOffset(65, 270);livre.body.updateFromGameObject();
    livre.vida = livre.vidaMaxima = 100;
    s.inimigos = [livre];s.player = { active: true, x: 900, y: 1000 };
    protegerColisaoInimigo(s, livre);step(1000 / 60);
    const antes = livre.x;
    causarDanoInimigo(s, livre, 1, { particles: 0 });
    const animou = livre.scaleX < 0.23 && livre.scaleY > 0.23;
    for (let frame = 0; frame < 12; frame++) step(1000 / 60);
    return { cases, failures, animou, deslocamentoLivre: livre.x - antes,
      escalaRestaurada: Math.abs(livre.scaleX - 0.23) < 1e-9 && Math.abs(livre.scaleY - 0.23) < 1e-9,
      corpoRestaurado: Math.abs(livre.body.sourceWidth - 180) < 1e-9 &&
        Math.abs(livre.body.sourceHeight - 110) < 1e-9 &&
        Math.abs(livre.body.offset.x - 65) < 1e-9 && Math.abs(livre.body.offset.y - 270) < 1e-9 };
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(report.failures, [], JSON.stringify(report.failures.slice(0, 4)));
  assert.ok(report.animou && report.escalaRestaurada && report.corpoRestaurado,
    "a deformação visual continua e restaura a escala e a configuração física originais");
  assert.ok(report.deslocamentoLivre > 10, "o inimigo continua sofrendo empurrão em espaço livre");
  console.log(`PASS: ${report.cases} cenários de dano repetido, quatro direções, paredes finas e frames longos.`);
} finally { await browser.close(); }
