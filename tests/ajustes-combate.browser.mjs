/** Phaser real: comando do cliente, marreta imóvel, impacto e novas ondas de inimigos.
 * Servidor HTTP na raiz; PLAYWRIGHT_MODULE e CHROMIUM_PATH configuráveis.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
const base = process.env.BASE_URL ?? 'http://127.0.0.1:8765';
const dir = process.env.ARTIFACT_DIR ?? '/tmp/ajustes-kai-magnus-clones';
mkdirSync(dir, { recursive: true });
const errors = []; page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
try {
  // Carrega apenas o Phaser e os recursos desta verificação, sem iniciar o preloader completo.
  await page.route(`${base}/__ajustes-combate`, route => route.fulfill({ contentType: 'text/html',
    body: '<body style="margin:0"><script src="/js/libs/phaser.min.js"></script></body>' }));
  await page.goto(`${base}/__ajustes-combate`);
  await page.evaluate(async () => {
    const { criarSistemaEspeciais, atualizarSistemaEspeciais } = await import('/js/combat/PlayerSpecialAbilities.js');
    const { atualizarMovimento } = await import('/js/controls/PlayerMovement.js');
    const { iniciarDash } = await import('/js/controls/PlayerDashControls.js');
    const { CoopPlayers } = await import('/js/multiplayer/CoopPlayers.js');
    const { CoopRuntime } = await import('/js/multiplayer/CoopRuntime.js');
    const { soloContext } = await import('/js/multiplayer/CoopContext.js');
    const { describeVisual } = await import('/js/multiplayer/CoopVisuals.js');
    let ready;
    const loaded = new Promise(resolve => { ready = resolve; });
    window.__testGame = new Phaser.Game({ type: Phaser.CANVAS, width: 900, height: 620,
      backgroundColor: '#202831', pixelArt: true, banner: false, audio: { noAudio: true },
      physics: { default: 'arcade', arcade: { gravity: { y: 0 } } }, scene: {
        key: 'Level1Parte2',
        preload() {
          this.load.setPath('/assets/');
          this.load.spritesheet('personagem2-walk', 'PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_walk_LARANJA.png', { frameWidth: 64, frameHeight: 64 });
          this.load.image('magnus-especial-marreta', 'PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_martelo.png');
          this.load.spritesheet('especial-magnus', 'efeitos/especiais/magnus (1).png', { frameWidth: 496, frameHeight: 506 });
          this.load.json('especial-magnus-meta', 'efeitos/especiais/magnus.json');
          this.load.spritesheet('robot', 'PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/robo_teste_3.png', { frameWidth: 311, frameHeight: 421 });
          this.load.spritesheet('robo-bola-morte', 'PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_BOLA/ROBO_MORTE_127x127.png', { frameWidth: 127, frameHeight: 127 });
        },
        create() { window.__s = this; ready(); },
      } });
    await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(Error('Phaser não iniciou em 15s')), 15000))]);
    const s = window.__s;
    const check = (ok, message) => { if (!ok) throw Error(message); };
    s.multiplayer = true; s.isMultiplayerHost = true; s.vida = 100;
    s.personagemSelecionada = 'kai-mercer'; s.direcaoAtual = 'right';
    s.player = s.physics.add.sprite(70, 460, 'personagem2-walk', 0);
    s.hitboxDanoPlayer = new Phaser.Geom.Rectangle(55, 440, 30, 46);
    s.collisionGroup = s.physics.add.staticGroup(); s.inimigos = []; s.remotePlayers = new Map();
    const enviados = [];
    let client;
    const manager = s.multiplayerManager = Object.assign(new Phaser.Events.EventEmitter(), { playerId: 'host', room: { players: [] },
      sendCoopAction(kind, payload, options = {}) {
        enviados.push({ kind, payload, ...options });
        if (kind === 'specialPose') client.receiveAction({ kind, payload, ...options });
        return true;
      } });
    const runtime = s.coopRuntime = Object.assign(Object.create(CoopRuntime.prototype), {
      scene: s, host: true, manager, mapKey: 'Level1Parte2', localContext: soloContext(s), broadcastHit() {},
    });
    runtime.players = new CoopPlayers(runtime);
    const clientSprite = s.physics.add.sprite(400, 340, 'personagem2-walk', 0).setVisible(false);
    const clientScene = soloContext(s, { player: clientSprite, multiplayer: true, isMultiplayerHost: false,
      personagemSelecionada: 'magnus-force', events: new Phaser.Events.EventEmitter(),
      estadoEspecial: null, limparSistemaEspeciais: null, executarHabilidadeEspecial: null,
      vida: 115, movimentoBloqueado: false, atacando: false, direcaoAtual: 'right',
      teclasWASD: { direita: { isDown: true } },
      hitboxDanoPlayer: new Phaser.Geom.Rectangle(385, 320, 30, 46),
    }, true);
    client = clientScene.coopRuntime = Object.assign(Object.create(CoopRuntime.prototype), {
      scene: clientScene, host: false, manager: { sendCoopAction(kind, payload) {
        runtime.receiveAction({ kind, payload, playerId: 'client' }); return true;
      } },
    });
    criarSistemaEspeciais(clientScene);
    const data = { id: 'client', character: 'magnus-force', direction: 'right', health: 115,
      maxHealth: 115, stamina: 100, maxStamina: 100, x: 400, y: 340, mapKey: 'Level1Parte2',
      coop: { visual: { ...describeVisual(clientSprite), v: true } } };
    runtime.players.receive([data]);
    const remote = runtime.players.remotes.get('client'), ctx = remote.context;
    s.anims.create({ key: 'robo-bola-morte-down', frames: s.anims.generateFrameNumbers('robo-bola-morte', { start: 0, end: 2 }), frameRate: 10 });
    const criarRobo = vida => {
      const r = s.physics.add.sprite(465, 340, 'robot', 0).setScale(.23);
      Object.assign(r, { vida, vidaMaxima: vida, tipoRobo: 'bola', direcaoAtual: 'down',
        hitboxDano: new Phaser.Geom.Rectangle(445, 320, 40, 40) });
      s.inimigos.push(r); return r;
    };
    s.scene.pause();
    window.__relatorioCombate = { ondas: [] };
    for (const [indice, vida] of [200, 80, 80].entries()) {
      const inicio = 1000 + indice * 8000; s.time.now = inicio;
      ctx.atacando = false; clientScene.atacando = false;
      const robo = criarRobo(vida);
      check(clientScene.executarHabilidadeEspecial(), 'cliente deve enviar a habilidade');
      check(ctx.estadoEspecial.onda && ctx.atacando, 'host inicia marreta e onda');
      check(clientSprite.anims.currentAnim.key.startsWith('attack-marreta-'), 'cliente executa a marreta confirmada');
      atualizarMovimento(clientScene);
      check(clientSprite.body.velocity.lengthSq() === 0, 'WASD não move durante a marreta');
      check(iniciarDash(clientScene) === false, 'dash não interrompe a marreta');
      runtime.players.receive([{ ...data, x: 610 }]);
      check(remote.actor.x === 400, 'pacote de movimento não desloca o golpe no host');
      s.time.now = inicio + 199; runtime.players.update(s.time.now, 16);
      check(robo.vida === vida, 'não aplica dano antes do impacto');
      s.time.now = inicio + 390; runtime.players.update(s.time.now, 16);
      check(robo.vida === Math.max(0, vida - 90), 'onda acerta cada novo robô');
      s.time.now = inicio + 450; remote.actor.emit('animationcomplete');
      runtime.players.receive([{ ...data, x: 610 }]);
      check(remote.actor.x === 400, 'fim da pose não libera movimento antes do fim da onda');
      if (indice === 0) {
        check(robo.especialAtordoadoAte > s.time.now && robo.body.velocity.lengthSq() > 0, 'empurra e atordoa');
        window.__relatorioCombate.stun = robo.especialAtordoadoAte - s.time.now;
        robo.destroy(); s.inimigos = [];
      } else check(!s.inimigos.includes(robo), 'morte atualiza a cena compartilhada');
      window.__relatorioCombate.ondas.push({ vidaAntes: vida, vidaDepois: robo.vida, morto: !!robo.morto });
      check(ctx.inimigos === s.inimigos, 'habilidade enxerga a lista atual');
      s.time.now = inicio + 460; runtime.players.update(s.time.now, 16);
      check(runtime.specialSnapshot(ctx).immobile === 0, 'libera movimento no fim do golpe');
      runtime.players.receive([data]);
    }
    // Preserva um quadro de impacto da animação real para a avaliação visual.
    s.time.now = 25000; ctx.atacando = false; clientScene.atacando = false;
    criarRobo(200); clientScene.executarHabilidadeEspecial();
    s.time.now += 280; runtime.players.update(s.time.now, 16);
      remote.actor.anims.update(s.time.now, 280);
    s.children.depthSort();
    window.__relatorioCombate.confirmacoes = enviados.filter(e => e.kind === 'specialPose').length;
  });
  await page.screenshot({ path: `${dir}/magnus-impacto-coop.png` });
  const report = await page.evaluate(() => window.__relatorioCombate);
  assert.equal(report.ondas.length, 3);
  assert.equal(report.confirmacoes, 4);
  assert.deepEqual(errors, []);
  writeFileSync(`${dir}/phaser-combate.json`, JSON.stringify(report, null, 2));
  console.log('PASS: marreta no cliente, movimento bloqueado, dano/stun/repulsão no host e novas ondas atingidas.');
} finally {
  await page.evaluate(() => window.__testGame?.destroy(true)).catch(() => {});
  await browser.close();
}
