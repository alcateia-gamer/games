/** Duas instâncias completas e MQTT/WebSocket local: sessão única e operador cliente. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { iniciarJogoHacking, entrarFabricaHacking, resolverBreach, tocarInteracaoHacking } from './hacking-browser-helpers.mjs';
import { lerArquivosNullnet, sceneState, dispensarTutorial, resolverBruteforce, resolverMemoria, capturarHost, lerRelogio, observarConfirmacaoFinal, simularCredito, verificarConclusao } from './nullnet-browser-helpers.mjs';
const tools = process.env.HACKING_TEST_TOOLS ?? '/tmp/hacking-browser-tools', require = createRequire(import.meta.url);
const brokerPort = Number(process.env.NULLNET_BROKER_PORT ?? 18884);
const broker = require(`${tools}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${tools}/node_modules/ws`);
const ws = new WebSocketServer({ host: '127.0.0.1', port: brokerPort });
ws.on('connection', socket => broker.handle(createWebSocketStream(socket)));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? `${tools}/node_modules/playwright-core/index.mjs`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
const pages = [], errors = [], report = {}, pasta = process.env.ARTIFACT_DIR ?? '/tmp/hacking-coop'; mkdirSync(pasta, { recursive: true });
const creditos = new Map();
async function boot() {
  const page = await context.newPage(); pages.push(page); page.setDefaultTimeout(25000);
  creditos.set(page, await simularCredito(page, `conta-coop-${pages.length}`));
  page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
  await iniciarJogoHacking(page); await page.addScriptTag({ path: `${tools}/node_modules/mqtt/dist/mqtt.min.js` });
  await page.evaluate(async port => {
    const { default: Client } = await import('/js/mqttClient.js');
    const { default: Manager } = await import('/js/multiplayer/multiplayerManager.js');
    const mqtt = new Client({ brokerUrl: `ws://127.0.0.1:${port}`, topicPrefix: 'hacking-test' });
    window.__manager = new Manager(mqtt); window.__game.registry.set('multiplayer', window.__manager);
  }, brokerPort);
  await page.waitForFunction(() => window.__manager.mqtt.connected); console.log(`BOOT: instância ${pages.length} pronta.`); return page;
}
async function verificarNova(page, mapa, host) {
  await page.waitForFunction(({ mapa, host }) => {
    const s = window.__game.scene.getScene(mapa);
    const pet = host ? s.coopRuntime?.nova?.pet : s.coopRuntime?.nova?.visual;
    const robos = s.children.list.filter(o => o.active && o.texture?.key === 'robo-pet');
    return pet?.active && robos.length === 1 && robos[0] === pet &&
      (host ? s.companionPet === pet && pet.body?.checkCollision.none : !pet.body);
  }, { mapa, host });
}

async function posicionar(page, x, y) {
  await page.evaluate(({ x, y }) => {
    const s = window.__game.scene.getScene('Level1Parte2'); s.player.body.reset(x, y); s.player.body.updateFromGameObject();
    s.player.invulneravel = true; s.player.setVelocity(0, 0);
  }, { x, y }); await page.waitForTimeout(250);
}
try {
  const host = await boot(), client = await boot();
  const code = await host.evaluate(() => window.__manager.createRoom());
  await client.evaluate(code => window.__manager.joinRoom(code), code);
  await host.waitForFunction(() => window.__manager.room.players.length === 2);
  const hostCharacter = process.env.NULLNET_HOST_CHARACTER ?? 'kai-mercer';
  const testarVisual = process.env.NULLNET_TEST_OPERATOR_VISUAL === '1';
  const clientCharacter = process.env.NULLNET_CLIENT_CHARACTER ?? (testarVisual ? 'magnus-force' : 'nyx');
  await host.evaluate(character => window.__manager.selectCharacter(character), hostCharacter);
  await client.evaluate(character => window.__manager.selectCharacter(character), clientCharacter);
  for (const p of pages) { await p.waitForFunction(() => window.__manager.room.players.every(p => p.character)); await p.evaluate(() => window.__manager.setReady(true)); }
  await host.waitForFunction(() => window.__manager.canStart()); await host.evaluate(() => window.__manager.startGame());
  await client.waitForFunction(() => window.__manager.room.status === 'PLAYING');
  await Promise.all(pages.map(async p => {
    await p.evaluate(() => {
      const personagem = window.__manager.room.players.find(p => p.id === window.__manager.playerId).character;
      window.__game.scene.getScene('Level1').scene.restart({ multiplayer: true, personagem });
    });
    await p.waitForFunction(() => window.__game.scene.getScene('Level1').coopRuntime &&
      (window.__manager.room.coopProgress?.relogio?.decorridoMs ?? 0) >= 1000);
  }));
  await verificarNova(host, 'Level1', true);
  await verificarNova(client, 'Level1', false);
  const cidade = await lerRelogio(client);
  await Promise.all(pages.map(p => entrarFabricaHacking(p, true)));
  await verificarNova(host, 'Level1Parte2', true);
  await verificarNova(client, 'Level1Parte2', false);
  assert.ok((await lerRelogio(host)).ms > cidade.ms);
  assert.ok((await lerRelogio(client)).ms >= cidade.ms);
  await host.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').coopRuntime.players.remotes.size === 1);
  if (process.env.NULLNET_TEST_TOWER_DEPTH === '1') {
    for (const p of pages) await posicionar(p, 1000, -1896);
    await host.evaluate(async () => {
      const s = window.__game.scene.getScene('Level1Parte2');
      const { novoBossConfig } = await import('/js/enemies/novoBoss/NovoBossConfig.js');
      s.novoBoss.config = { ...s.novoBoss.config, geradores: { ...novoBossConfig.geradores } };
      s.developerMode = true;
    });
    await host.keyboard.press('h');
    await posicionar(host, -1093, -5520);
    await host.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').novoBoss?.geradores?.some(t => t.torre),
      null, { timeout: 90000 });
    const tower = await host.evaluate(async () => {
      const s = window.__game.scene.getScene('Level1Parte2'), t = s.novoBoss.geradores.find(t => t.torre);
      const { pontosTorresNovoBoss } = await import('/js/enemies/novoBoss/NovoBossTorres.js');
      t.invocar(); t.atualizar(2000, true, true);
      s.coopRuntime.forceKeyframe = true;
      const p = pontosTorresNovoBoss(s).find(p => p.id === t.id);
      return { id: t.id, footY: p.referenciaDepthY, depth: t.visual.depth };
    });
    await client.waitForFunction(({ id, depth }) => {
      const t = window.__game.scene.getScene('Level1Parte2').novoBoss?.geradores?.find(t => t.id === id);
      return t?.visual?.visible && t.visual.depth === depth;
    }, tower, { timeout: 90000 });
    for (const p of pages) {
      const results = await p.evaluate(async tower => {
        const { atualizarDepthAtores } = await import('/js/map/ProfundidadeMapa.js');
        const s = window.__game.scene.getScene('Level1Parte2'), t = s.novoBoss.geradores.find(t => t.id === tower.id);
        const actor = s.player;
        // Uma amostra síncrona conserva a rede ativa e impede a física de
        // interferir nas três posições de teste, sem provocar eleição de host.
        return [-10, 0, 10].map(offset => {
          actor.body.reset(t.x + 30, tower.footY); actor.body.updateFromGameObject();
          actor.body.reset(actor.x, actor.y + tower.footY + offset - actor.body.bottom);
          actor.body.updateFromGameObject(); atualizarDepthAtores(s); s.children.depthSort();
          return { offset, front: actor.depth > t.visual.depth, player: actor.depth, tower: t.visual.depth,
            order: s.children.list.indexOf(actor) > s.children.list.indexOf(t.visual) };
        });
      }, tower);
      for (const result of results) {
        assert.equal(result.front, result.offset >= 0, JSON.stringify(result));
        assert.equal(result.order, result.offset >= 0, JSON.stringify(result));
      }
    }
    report.towerDepth = true;
    console.log('PASS: host e cliente intercalam o jogador com a torre pelos pés, inclusive no empate.');
  } else if (process.env.NULLNET_TEST_DEV_H === '1') {
    const operador = process.env.NULLNET_DEV_H_HOST === '1' ? host : client;
    await operador.evaluate(() => { window.__game.scene.getScene('Level1Parte2').developerMode = true; });
    await host.waitForFunction(() => {
      const s = window.__game.scene.getScene('Level1Parte2');
      return s.developerMode || [...s.coopRuntime.players.remotes.values()].some(e => e.data.coop?.developer);
    });
    if (process.env.NULLNET_DEV_H_WAITING === '1') {
      await operador.evaluate(() => {
        const s = window.__game.scene.getScene('Level1Parte2');
        s.preparacaoBoss.aguardar(() => {}, { podeContinuar: () => s.registry.get('bossAccessCardAuthenticated') === true });
      });
      assert.equal(await operador.evaluate(() => window.__game.scene.getScene('Level1Parte2').generatorMenuOpen), true);
    }
    await operador.keyboard.press('h');
    for (const p of pages) await p.waitForFunction(() => {
      const s = window.__game.scene.getScene('Level1Parte2');
      return s.luzFabricaAcesa && s.registry.get('factoryHackingComplete') === true &&
        s.registry.get('factoryBruteforceComplete') === true && s.registry.get('bossAccessCardAuthenticated') === true &&
        s.portasFabrica.filter(d => ['porta02', 'porta03'].includes(d.nome)).every(d => d.estado === 'aberta' && !d.colisao);
    });
    report.devH = operador === host ? 'host' : 'client';
    console.log(`PASS: H no ${report.devH} validou a fábrica e sincronizou luz, hacks e portas.`);
  } else if (testarVisual) {
    // Prepara só os pré-requisitos. Rede, terminal, animações e puzzles são os do jogo.
    await host.evaluate(async () => {
      const s = window.__game.scene.getScene('Level1Parte2');
      const { HACKING_KEYS } = await import('/js/puzzles/HackingConfig.js');
      for (const key of ['fabrica', 'bruteforce', 'cartao']) s.registry.set(HACKING_KEYS[key], true);
      s.novoBoss = { morto: true, encerrado: true, config: { arena: { zonas: [] } } };
      const entry = s.coopRuntime.players.remotes.values().next().value;
      window.__operatorTextures = new Set();
      entry.actor.on('animationstart', (_anim, frame) => {
        if (entry.context.hackingAtivo) window.__operatorTextures.add(frame.textureKey);
      });
    });
    const texturas = { 'kai-mercer': 'walk', 'magnus-force': 'personagem2-walk',
      'aria-kade': 'personagem3-walk', nyx: 'personagem4-walk' };
    async function verificarVisual() {
      const resultado = await host.evaluate(() => {
        const s = window.__game.scene.getScene('Level1Parte2');
        const { actor } = s.coopRuntime.players.remotes.values().next().value;
        return { host: s.player.texture.key, operador: actor.texture.key, caminho: [...window.__operatorTextures] };
      });
      assert.equal(resultado.host, texturas[hostCharacter]);
      assert.equal(resultado.operador, texturas[clientCharacter]);
      assert.deepEqual(resultado.caminho, [texturas[clientCharacter]]);
    }
    async function abrirTerminal() {
      await posicionar(client, -300, -5835);
      await client.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals
        .enviar({ op: 'abrir', tipo: 'matrix' }));
      await client.locator('.memory-decryption').waitFor();
    }
    await abrirTerminal();
    await verificarVisual();
    const config = await host.evaluate(() => window.__game.registry.get('nullnetMission').config);
    await resolverMemoria(client, config, 2);
    await verificarVisual();
    const atrasado = await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot());
    await client.keyboard.press('Escape');
    await host.waitForFunction(() => !window.__game.scene.getScene('Level1Parte2').hackingTerminals.temSessao());
    await client.locator('.memory-decryption').waitFor({ state: 'detached' });
    await client.evaluate(state => window.__game.scene.getScene('Level1Parte2').hackingTerminals.receberSnapshot(state), atrasado);
    assert.equal(await client.locator('.memory-decryption').count(), 0);
    await verificarVisual();
    await abrirTerminal();
    await resolverMemoria(client, config);
    // Usa o relógio autoritativo para enviar a seleção em uma janela válida.
    const selecao = await (await host.waitForFunction(async () => {
      const { sequenciaLinha, sequenciaVisivel } = await import('/js/puzzles/HostConnection.js');
      const { model } = window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot().session;
      if (model.tempo % 1000 > 400) return false;
      for (let linha = 0; linha < model.linhas.length; linha++) {
        for (let inicio = 0; inicio < model.linhas[linha].numeros.length; inicio++) {
          const valores = sequenciaLinha(model.linhas, linha, inicio);
          if (valores.every((n, i) => n === model.alvo[i]) &&
              sequenciaVisivel(model.linhas, linha, inicio, model.tempo)) return { linha, inicio, tempo: model.tempo };
        }
      }
      return false;
    }, null, { timeout: 40000 })).jsonValue();
    await client.evaluate(valor => window.__game.scene.getScene('Level1Parte2').hackingTerminals
      .enviar({ op: 'selecionarSequencia', valor }), selecao);
    for (const p of pages) await p.locator('.hacking-victory').waitFor();
    await verificarVisual();
    assert.deepEqual(errors, []);
    console.log(`PASS: ${clientCharacter} manteve a textura na tela de ${hostCharacter} até concluir o terminal.`);
  } else {

  await host.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2');
    const { findGeneratorInteraction } = await import('/js/interactions/FactoryGenerator.js');
    const a = findGeneratorInteraction(s.map).object;
    s.player.invulneravel = true; s.player.body.reset(a.x + a.width / 2, a.y + a.height / 2 - 15);
    s.player.body.updateFromGameObject(); s.inventory.addItem('bateria', 1); s.inventory.addItem('gasolina', 1, { fuel: 1 });
    s.coopRuntime.world.generator.requestInstall('bateria');
  });
  await host.waitForFunction(() => !!window.__manager.room.coopProgress.generator?.slots.bateria);
  await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').coopRuntime.world.generator.requestInstall('gasolina'));
  await host.waitForFunction(() => !!window.__manager.room.coopProgress.generator?.slots.gasolina);
  await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').coopRuntime.world.generator.requestStart());
  await client.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').luzFabricaAcesa);
  for (const p of pages) await posicionar(p, 1000, -1896);
  await tocarInteracaoHacking(client); await client.locator('.hacking-overlay').waitFor(); await dispensarTutorial(client);
  assert.equal(await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.enviar({ op: 'abrir', tipo: 'fabrica' })), false);
  await verificarNova(host, 'Level1Parte2', true);
  await verificarNova(client, 'Level1Parte2', false);
  const oldState = await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot());
  await client.keyboard.press('Escape'); await host.waitForFunction(() => !window.__game.scene.getScene('Level1Parte2').hackingTerminals.temSessao());
  await client.locator('.hacking-overlay').waitFor({ state: 'detached' });
  await client.evaluate(state => window.__game.scene.getScene('Level1Parte2').hackingTerminals.receberSnapshot(state), oldState);
  assert.equal(await client.locator('.hacking-overlay').count(), 0);
  await posicionar(client, 1000, -1896); await tocarInteracaoHacking(client); await client.locator('.hacking-overlay').waitFor(); await dispensarTutorial(client);
  const path = resolverBreach((await sceneState(client)).model);
  for (const cell of path) {
    await client.locator(`[data-cell="${cell}"]`).click();
    await client.waitForFunction(cell => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.selecoes.includes(cell), cell);
  }
  for (const p of pages) await p.waitForFunction(() => window.__game.registry.get('factoryHackingComplete') === true);
  await client.locator('.hacking-overlay').waitFor({ state: 'detached' });
  await client.waitForFunction(() => {
    const nova = window.__game.scene.getScene('Level1Parte2').coopRuntime.nova;
    const fala = nova.falas.get('hacking-speech')?.bubble.texto;
    return fala?.visible && fala.x === nova.visual.x + 8;
  });
  const config = await host.evaluate(() => window.__game.registry.get('nullnetMission').config);
  await client.waitForFunction(seed => window.__game.registry.get('nullnetMission')?.config.seed === seed, config.seed);
  console.log('PASS: Breach pelo cliente, operador único, cancelamento, réplica antiga e semente compartilhada.');
  {
    await posicionar(client, -378, -2938); await tocarInteracaoHacking(client);
    await client.getByRole('dialog', { name: 'AXIOM // BRUTEFORCE', exact: true }).waitFor();
    await host.getByRole('button', { name: 'NULLNET · ARQUIVOS', exact: true }).click();
    await host.getByRole('dialog', { name: 'NULLNET // INTELLIGENCE DATABASE', exact: true }).waitFor();
    const firstFiles = await lerArquivosNullnet(host);
    assert.ok(firstFiles.includes('EV041_EDEN_NETWORK_ARCHIVE.LOG'));
    assert.ok(firstFiles.includes('ACESSO BLOQUEADO · TERMINAL 02'));
    assert.ok(!firstFiles.includes('EV041_ESCAPE_PROTOCOL.DAT'));
    assert.equal(await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').physics.world.isPaused), false);
    const menuAberto = await lerRelogio(host);
    await host.waitForTimeout(1100);
    assert.ok((await lerRelogio(host)).ms > menuAberto.ms);
    assert.ok((await lerRelogio(client)).ms > menuAberto.ms);
    await host.keyboard.press('Escape'); await resolverBruteforce(client);
    for (const p of pages) {
      await p.waitForFunction(() => window.__game.registry.get('factoryBruteforceComplete') === true);
      assert.equal(await p.evaluate(() => window.__game.registry.get('bossAccessCardAuthenticated') === true), false);
      assert.ok(await p.evaluate(() => window.__game.scene.getScene('Level1Parte2').portasFabrica.filter(p => ['porta02', 'porta03'].includes(p.nome)).every(p => p.estado === 'fechada' && p.colisao)));
    }
    for (const p of pages) {
      await p.getByRole('button', { name: 'NULLNET · ARQUIVOS', exact: true }).click();
      await p.getByRole('button', { name: 'REGISTROS', exact: true }).click();
      const files = await lerArquivosNullnet(p);
      assert.ok(files.includes('EV041_EDEN_NETWORK_ARCHIVE.LOG') && files.includes('EV041_ESCAPE_PROTOCOL.DAT'));
      await p.keyboard.press('Escape');
    }
    await host.evaluate(() => {
      const s = window.__game.scene.getScene('Level1Parte2'), a = s.leitorCartaoFabrica.area;
      s.inventory.addItem('card', 1); s.player.body.reset(a.x + a.width / 2, a.y + a.height + 25); s.player.body.updateFromGameObject();
    }); await host.waitForTimeout(350); await tocarInteracaoHacking(host);
    for (const p of pages) await p.waitForFunction(() => window.__game.registry.get('bossAccessCardAuthenticated') === true, null, { timeout: 30000 });
    for (const p of pages) await p.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').portasFabrica.filter(p => ['porta02', 'porta03'].includes(p.nome)).every(p => p.estado === 'aberta' && !p.colisao));
    console.log('PASS: autorização compartilhada e duas portas sincronizadas com colisões removidas.');
    const antesDoBoss = await lerRelogio(host);
    await posicionar(host, -1093, -5520);
    await host.waitForFunction(() => {
      const s = window.__game.scene.getScene('Level1Parte2');
      return s.preparacaoBoss?.pronto && s.novoBoss?.sprite?.active && s.coopRuntime.world.bossLoading.canStart();
    }, null, { timeout: 90000 });
    assert.ok((await lerRelogio(host)).ms > antesDoBoss.ms);
    await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').novoBoss.receberDano(100000));
    for (const p of pages) await p.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').novoBoss?.morto === true);
    await posicionar(client, -300, -5835); await tocarInteracaoHacking(client); await client.locator('.memory-decryption').waitFor();
    await resolverMemoria(client, config, 2);
    await host.waitForFunction(() => window.__game.registry.get('nullnetMission').checkpoint.memoryModules === 2);
    await client.keyboard.press('Escape'); await host.waitForFunction(() => !window.__game.scene.getScene('Level1Parte2').hackingTerminals.temSessao());
    await posicionar(host, -300, -5835); await tocarInteracaoHacking(host); await host.locator('.memory-decryption').waitFor();
    assert.equal((await sceneState(host)).model.recuperados, 2);
    let operador = host, participantes = pages;
    if (process.env.NULLNET_COOP_DISCONNECT === '1') {
      await host.evaluate(() => window.__manager.leaveRoom());
      await client.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').coopRuntime.host && !window.__game.scene.getScene('Level1Parte2').hackingTerminals.temSessao());
      await verificarNova(client, 'Level1Parte2', true);
      await posicionar(client, -300, -5835); await tocarInteracaoHacking(client); await client.locator('.memory-decryption').waitFor();
      assert.equal((await sceneState(client)).model.recuperados, 2);
      assert.equal(await client.evaluate(() => window.__game.registry.get('nullnetMission').config.seed), config.seed);
      operador = client; participantes = [client]; report.migration = true;
      console.log('PASS: host operador desconectou; novo host recuperou dois arquivos e liberou o terminal.');
    }
    await observarConfirmacaoFinal(operador);
    await resolverMemoria(operador, config);
    await capturarHost(operador, config);
    for (const p of participantes) await p.locator('.hacking-victory').waitFor({ timeout: 20000 });
    const resultado = await verificarConclusao(operador, false, 'Você recebeu 350 tijolinhos');
    assert.deepEqual(await operador.evaluate(() => window.__confirmacoes), [{ resultado, ms: resultado.tempoMs }]);
    if (operador !== client) {
      await client.evaluate(state => {
        const s = window.__game.scene.getScene('Level1Parte2');
        window.__telaOriginal = document.querySelector('.hacking-victory');
        s.hackingTerminals.receberSnapshot(state);
        s.hackingTerminals.receberSnapshot(state);
      }, await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot()));
      assert.equal(await client.evaluate(() => window.__telaOriginal === document.querySelector('.hacking-victory')), true);
      assert.deepEqual(await verificarConclusao(client, false, 'Você recebeu 350 tijolinhos'), resultado);
    }
    for (const [p, { chamadas, autorizacao }] of creditos) {
      assert.deepEqual(chamadas, participantes.includes(p) ? [{ corpo: { product: 85, value: 350 }, autorizacao }] : []);
    }
    for (const p of participantes) assert.equal(await p.evaluate(() => window.__game.registry.get('matrixZeroComplete')), true);
    report.sharedEnding = true;
    console.log(report.migration ? 'PASS: migração, checkpoint, HOST e encerramento no novo host.' : 'PASS: memória e HOST autoritativos, transferência de operador com checkpoint e encerramento em ambas as telas.');
  }
  }
  assert.deepEqual(errors, []); writeFileSync(`${pasta}/nullnet-report.json`, JSON.stringify({ ...report, errors }, null, 2));
} catch (error) {
  for (const p of pages) console.error('DIAGNÓSTICO', await p.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return { snapshot: s.hackingTerminals.snapshot(), view: s.hackingTerminals.estadoLocal(),
      vida: s.vida, input: s.input.enabled, menu: s.generatorMenuOpen, fps: window.__game.loop.actualFps,
      host: s.coopRuntime?.host, room: window.__manager.room?.hostId };
  }).catch(() => null));
  throw error;
} finally { await browser.close(); await new Promise(resolve => ws.close(resolve)); await new Promise(resolve => broker.close(resolve)); }
