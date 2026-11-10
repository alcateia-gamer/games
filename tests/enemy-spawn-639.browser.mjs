/** Regressão no Phaser real: nascimento, patrulha e empurrão contra objetos da cidade. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.route("**/spawn-639-test", route => route.fulfill({ contentType: "text/html", body: `
    <script src="/js/libs/phaser.min.js"></script><script>
    new Phaser.Game({type:Phaser.CANVAS,width:800,height:600,audio:{noAudio:true},
      physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:{
      preload(){
        this.load.tilemapTiledJSON('mapa','/assets/map/InicioFase1 (1).json');
        for(const [key,file] of [['robo-teste','robo_teste_2'],
          ['robo-teste-normal','robo_teste_3'],['robo-morte','robo_morte']])
          this.load.spritesheet(key,'/assets/PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/'+file+'.png',
            {frameWidth:311,frameHeight:421});
        this.load.spritesheet('robo-serra',
          '/assets/PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_SERRA/robo_novo.png',
          {frameWidth:278,frameHeight:270});
      },create(){window.s=this;this.scene.pause();}
    }});</script>` }));
  await page.goto((process.env.BASE_URL ?? "http://127.0.0.1:8765") + "/spawn-639-test");
  await page.waitForFunction(() => window.s?.scene.isPaused());
  const report = await page.evaluate(async () => {
    const { criarColisoesCidade } = await import("/js/map/ColisoesMapa.js");
    const { default: Manager } = await import("/js/enemies/EnemySpawnManager.js");
    const { atualizarIAInimigo } = await import("/js/enemies/EnemyAI.js");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    let seed = 34751;
    Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
    const s = window.s;
    s.map = s.make.tilemap({ key: "mapa" });
    criarColisoesCidade(s, s.map);
    s.player = { active: true, x: 800, y: -345 };
    s.inimigos = [];
    const manager = new Manager(s, s.map, { minEnemies: 2, maxEnemies: 2 });
    const region = manager.regions.find(r => r.id === 639);
    const inside = r => {
      const rect = r.getBounds(), area = region.area;
      return rect.left >= area.x && rect.right <= area.x + area.width &&
        rect.top >= area.y && rect.bottom <= area.y + area.height;
    };
    const failures = [];
    let spawned = 0;
    for (let round = 0; round < 50; round++) {
      spawned += manager.spawnRegion(region);
      for (const r of region.enemies) {
        const rect = r.getBounds();
        if (!inside(r) || !retanguloLivreDoMapa(s, rect)) {
          failures.push({ round, tipo: r.tipoRobo, x: r.x, y: r.y });
        }
      }
      for (const r of region.enemies) manager.removerInimigoDistante(r);
      region.enemies = [];
    }
    manager.spawnRegion(region);
    // O jogador continua próximo o bastante para manter a IA acordada, atrás das paredes.
    s.player.x = -300;
    const origins = region.enemies.map(r => ({ x: r.x, y: r.y }));
    let outside = 0, contacts = 0, movement = 0;
    function step(dt) {
      s.physics.world.bodies.forEach(b => { if (b.enable) b.preUpdate(false, dt); });
      s.physics.world.step(dt);
      s.physics.world.postUpdate();
    }
    for (let frame = 0; frame < 3600; frame++) {
      for (const r of region.enemies) atualizarIAInimigo(s, frame * 1000 / 60, r);
      step(1 / 60);
      region.enemies.forEach((r, i) => {
        if (!inside(r)) outside++;
        if (!retanguloLivreDoMapa(s, r.body)) contacts++;
        movement = Math.max(movement, Math.hypot(r.x - origins[i].x, r.y - origins[i].y));
      });
    }
    // Um impulso atravessaria completamente o objeto 565 entre dois passos da física.
    const impacts = [];
    const obstacle = s.collisionGroup.getChildren().find(o =>
      Math.abs(o.body.width - 213.5) < 0.001 && Math.abs(o.x - 1079.75) < 0.001).body;
    for (const r of region.enemies) {
      const others = region.enemies.filter(other => other !== r);
      others.forEach(other => { other.body.enable = false; });
      r.body.enable = true;
      r.body.reset(1100, -350);
      r.body.updateFromGameObject();
      r.setVelocity(0, 1000);
      step(0.5);
      impacts.push({ tipo: r.tipoRobo, bottom: r.body.bottom, obstacleTop: obstacle.y,
        free: retanguloLivreDoMapa(s, r.body) });
    }
    manager.destroy();
    return { spawned, failures, outside, contacts, movement, impacts };
  });
  assert.equal(report.spawned, 100, "50 grupos com os dois tipos obrigatórios");
  assert.deepEqual(report.failures, [], "imagem e pés nascem dentro do 639 e fora dos objetos");
  assert.ok(report.movement > 20, "a patrulha realmente se movimentou");
  assert.equal(report.outside, 0, "a patrulha permanece no retângulo de origem");
  assert.equal(report.contacts, 0, "a patrulha não invade obstáculos");
  for (const impact of report.impacts) {
    assert.ok(impact.bottom <= impact.obstacleTop, `${impact.tipo}: impulso para antes do objeto`);
    assert.equal(impact.free, true, `${impact.tipo}: corpo permanece livre após o impulso`);
  }
  assert.deepEqual(errors, []);
  console.log("PASS: 100 nascimentos no 639, 60 s de patrulha e impulsos contra objetos para ambos os robôs.");
} finally {
  await browser.close();
}
