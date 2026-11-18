/** Phaser real: grade fina durante dash, resíduos da torre e canvas de sucatas na morte. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const base = process.env.BASE_URL ?? 'http://127.0.0.1:8765', dir = process.env.ARTIFACT_DIR ?? '/tmp/camadas-dash';
mkdirSync(dir, { recursive: true });
const errors = []; page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
try {
  await page.route(`${base}/__camadas-dash`, route => route.fulfill({ contentType: 'text/html',
    body: '<body style="margin:0;background:#252832"><div id="camadas-root"></div><script src="/js/libs/phaser.min.js"></script></body>' }));
  await page.goto(`${base}/__camadas-dash`);
  const report = await page.evaluate(async () => {
    const { criarPlayer } = await import('/js/player/Player.js');
    const { iniciarDash } = await import('/js/controls/PlayerDashControls.js');
    const { protegerDashNoMapa } = await import('/js/player/PlayerMapCollision.js');
    const { criarTorreNovoBoss } = await import('/js/enemies/novoBoss/NovoBossTorres.js');
    const { assetsNovoBoss } = await import('/js/enemies/novoBoss/NovoBossAssets.js');
    const { novoBossConfig } = await import('/js/enemies/novoBoss/NovoBossConfig.js');
    const { atualizarDepthAtores } = await import('/js/map/ProfundidadeMapa.js');
    const { ScrapSystem } = await import('/js/systems/ScrapSystem.js');
    const { economyFor } = await import('/js/systems/UpgradeSystem.js');
    let ready;
    const loaded = new Promise(resolve => { ready = resolve; });
    window.__camadasGame = new Phaser.Game({ type: Phaser.CANVAS, parent: 'camadas-root', width: 800, height: 450,
      backgroundColor: '#252832', pixelArt: true, banner: false, audio: { noAudio: true },
      dom: { createContainer: true }, physics: { default: 'arcade', arcade: { gravity: { y: 0 } } }, scene: {
        key: 'Level1Parte2', preload() {
          this.load.setPath('/assets/');
          this.load.spritesheet('personagem2-walk', 'PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_walk_LARANJA.png', { frameWidth: 64, frameHeight: 64 });
          this.load.image('scrap-components', 'COLETAVEIS/sucatas.png');
          for (const nome of ['torreSummon', 'torreIdle', 'torreAttacked', 'torreDeath']) {
            const a = assetsNovoBoss[nome];
            this.load.spritesheet(a.chave, a.arquivo, { frameWidth: a.larguraFrame, frameHeight: a.alturaFrame });
          }
        }, create() { window.__camadasScene = this; ready(); },
      } });
    await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(Error('Phaser não iniciou')), 15000))]);
    const s = window.__camadasScene;
    const check = (ok, text) => { if (!ok) throw Error(text); };
    s.respawnX = 270; s.respawnY = 230; s.personagemSelecionada = 'magnus-force';
    s.vida = s.vidaMaxima = s.estamina = s.estaminaMaxima = 100;
    s.collisionGroup = s.physics.add.staticGroup(); criarPlayer(s);
    s.colliderPlayerMapa = s.physics.add.collider(s.player, s.collisionGroup);
    const grade = s.collisionGroup.create(300, 230).setDisplaySize(2, 300).refreshBody();
    s.scene.pause();
    const dash = () => {
      s.time.now += 1000; s.estamina = 100;
      s.player.body.reset(270, 230); s.player.body.updateFromGameObject();
      s.ultimaDirecaoDash = new Phaser.Math.Vector2(1, 0);
      s.estadoDash = { ativo: false, proximoDash: 0, direcao: new Phaser.Math.Vector2(), rastros: new Set(), efeitos: new Set() };
      check(iniciarDash(s), 'dash inicia pelo controle real');
    };
    // Reproduz o atravessamento numa queda de FPS sem a proteção adicional.
    s.removerProtecaoDashMapa(); s.physics.world.fixedStep = false;
    dash(); s.physics.world.update(s.time.now, 100); s.physics.world.postUpdate();
    const antes = s.player.body.x;
    check(antes > grade.body.x + grade.body.width, 'caso reproduz a grade ultrapassada');
    protegerDashNoMapa(s);
    const depois = [];
    for (const fixedStep of [false, true]) {
      s.physics.world.fixedStep = fixedStep;
      dash(); s.physics.world.update(s.time.now, 100); s.physics.world.postUpdate();
      check(s.player.body.right <= grade.body.x + .001, 'dash para antes da grade fina');
      check(!s.estadoDash.ativo, 'dash é interrompido ao colidir');
      depois.push({ fixedStep, x: s.player.body.x, right: s.player.body.right });
    }
    grade.destroy(); s.estadoDash.ativo = false;
    s.player.body.reset(380, 280); s.player.body.updateFromGameObject();
    s.player.setVelocity(0, 0); s.profundidadePersonagemParte2 = 16.5;
    const robot = s.physics.add.sprite(410, 290, 'personagem2-walk', 0);
    robot.tipoRobo = 'padrao'; s.inimigos = [robot];
    const encontro = { config: novoBossConfig, active: true };
    const torre = criarTorreNovoBoss(s, encontro, { id: 1, x: 400, y: 300, width: 96, height: 96 }, () => {});
    torre.invocar(); torre.atualizar(1600, true); check(torre.receberDano(120), 'torre recebe dano fatal');
    torre.atualizar(100, true); atualizarDepthAtores(s);
    check(torre.visual.depth < s.player.depth && torre.visual.depth < robot.depth, 'torre destruída sob os atores');
    s.scrapSystem = new ScrapSystem(s);
    const economy = economyFor(s); economy.drops.teste = { id: 'teste', x: 475, y: 300, mapKey: 'Level1Parte2', quantity: 4 }; economy.revision++;
    s.scrapSystem.update(); const scrap = s.scrapSystem.visuals.get('teste');
    check(scrap.depth < s.player.depth && scrap.depth < robot.depth, 'sucata sob atores');
    check(s.scrapSystem.counterIconView?.object.visible, 'canvas nativo visível durante o jogo');
    s.children.depthSort();
    return { antes, depois, depth: { torre: torre.visual.depth, sucata: scrap.depth, player: s.player.depth, robo: robot.depth } };
  });
  await page.screenshot({ path: `${dir}/01-piso.png` });
  // HUD real com quatro participantes: texto Phaser e ícone HTML devem ficar
  // abaixo da última barra, inclusive com zoom e alteração do número de aliados.
  await page.evaluate(async () => {
    const s = window.__camadasScene;
    const { criarStatusPlayer } = await import('/js/player/PlayerStatus.js');
    const manager = Object.assign(new Phaser.Events.EventEmitter(), { playerId: 'local', room: {
      players: ['magnus-force', 'kai-mercer', 'aria-kade', 'nyx'].map((character, i) =>
        ({ id: i ? `aliado-${i}` : 'local', character, health: 100, maxHealth: 100 })),
    } });
    s.multiplayer = true; s.multiplayerManager = manager;
    s.coopRuntime = { host: true, manager, players: { remotes: new Map() } };
    criarStatusPlayer(s); s.scene.resume();
  });
  await page.waitForFunction(() => window.__camadasScene.hudAliados?.elemento?.height > 0);
  const hud = [];
  for (const [zoom, membros] of [[1, 1], [1, 4], [1.7, 4], [1, 2], [1, 1], [1, 4]]) {
    await page.evaluate(({ zoom, membros }) => {
      const s = window.__camadasScene;
      s.cameras.main.setZoom(zoom);
      const players = s.multiplayerManager.room.players;
      if (!window.__aliadosCamadas) window.__aliadosCamadas = [...players];
      s.multiplayerManager.room.players = window.__aliadosCamadas.slice(0, membros);
      s.multiplayer = membros > 1;
    }, { zoom, membros });
    await page.waitForTimeout(80);
    const layout = await page.evaluate(() => {
      const s = window.__camadasScene, camera = s.cameras.main;
      const rect = s.game.canvas.getBoundingClientRect();
      const ancora = (s.multiplayer && s.hudAliados.elemento) || s.hudStatus.elemento;
      const limites = ancora.getBoundingClientRect();
      const icon = s.scrapSystem.counterIconView.object.node.getBoundingClientRect();
      const oy = camera.height * camera.originY;
      const textTop = rect.top + (camera.y + oy + (s.scrapSystem.counter.y - oy) * camera.zoomY) * rect.height / s.scale.gameSize.height;
      return { ancoraBottom: limites.bottom, iconeTop: icon.top, textTop, iconWidth: icon.width,
        grupoWidth: 32 + s.scrapSystem.counter.width, barraWidth: limites.width };
    });
    assert.ok(Math.abs(layout.iconeTop - layout.ancoraBottom - 8) < 1, JSON.stringify(layout));
    assert.ok(layout.textTop >= layout.ancoraBottom + 3, JSON.stringify(layout));
    assert.ok(Math.abs(layout.iconWidth - 24) < 1, 'ícone menor, inclusive durante o zoom');
    assert.ok(layout.grupoWidth < layout.barraWidth, 'conjunto menor que a HUD das vidas');
    hud.push({ zoom, membros, ...layout });
    if (membros === 1) await page.screenshot({ path: `${dir}/04-hud-solo.png` });
  }
  await page.screenshot({ path: `${dir}/03-hud-quatro-jogadores.png` });
  const death = await page.evaluate(async () => {
    const s = window.__camadasScene;
    const { default: mostrarTelaMorte } = await import('/js/scenes/DeathScreen.js');
    s.scene.resume(); mostrarTelaMorte(s, { equipeDerrotada: true });
    return { morte: s.telaMorteMostrada, texto: s.scrapSystem.counter.visible,
      icone: s.scrapSystem.counterIcon.visible, canvas: s.scrapSystem.counterIconView.object.visible };
  });
  assert.deepEqual(death, { morte: true, texto: false, icone: false, canvas: false });
  await page.screenshot({ path: `${dir}/02-morte.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${dir}/phaser.json`, JSON.stringify({ ...report, hud, death }, null, 2));
  console.log('PASS: dash e camadas preservados; sucatas abaixo da HUD com quatro jogadores e zoom; ícone oculto na morte.');
} finally {
  await page.evaluate(() => window.__camadasGame?.destroy(true)).catch(() => {});
  await browser.close();
}
