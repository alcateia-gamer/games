import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { criarCarregadorCacheavel, recursoDisponivel } from "./AssetLoading.js";
import { ASSETS_FABRICA, enfileirarAssetsFabrica, assetsFabricaProntos, verificarEntradaFabrica } from "./FactoryAssetPack.js";
import { criarTilesetsCidade } from "../map/Tilesets.js";
import { assetsNovoBoss } from "../enemies/novoBoss/NovoBossAssets.js";

function fixture(multiplayer = false) {
  const makeCache = () => {
    const data = new Map();
    return { exists: key => data.has(key), get: key => data.get(key), add: (key, value) => data.set(key, value), remove: key => data.delete(key) };
  };
  const calls = [], load = new EventEmitter();
  for (const tipo of ["image", "spritesheet", "audio", "atlas", "tilemapTiledJSON", "json", "plugin"])
    load[tipo] = (chave, ...args) => { calls.push({ tipo, chave, args }); return load; };
  load.setPath = path => { load.path = path; return load; };
  const scene = { multiplayer, load, calls, events: new EventEmitter(), textures: makeCache(),
    cache: { audio: makeCache(), json: makeCache(), tilemap: makeCache() }, falhasCarregamento: [] };
  scene.concluir = (faltantes = []) => {
    for (const arquivo of calls) {
      if (faltantes.includes(arquivo.chave)) continue;
      const cache = ["image", "atlas", "spritesheet"].includes(arquivo.tipo) ? scene.textures
        : scene.cache[{ audio: "audio", json: "json", tilemapTiledJSON: "tilemap" }[arquivo.tipo]];
      cache?.add(arquivo.chave, {});
    }
    load.emit("complete"); calls.length = 0;
  };
  return scene;
}

async function preloader() {
  globalThis.Phaser ??= {};
  globalThis.Phaser.Scene ??= class {};
  return (await import("../scenes/preloader.js")).default;
}

test("cidade solo preserva personagens/habilidades e adia somente o pacote exclusivo; coop mantém tudo antecipado", async () => {
  const Preloader = await preloader();
  const solo = fixture();
  Preloader.prototype.carregarAssets.call(solo);
  const iniciais = new Set(solo.calls.map(c => c.chave));
  for (const arquivo of ASSETS_FABRICA) assert.ok(!iniciais.has(arquivo.chave), arquivo.chave);
  for (const chave of ["mapa", "walk", "personagem2-walk", "personagem3-walk", "personagem4-walk", "especial-kai", "musica-cidade", "tiro-laser"])
    assert.ok(iniciais.has(chave), chave);
  criarTilesetsCidade({ addTilesetImage(nome, chave) {
    assert.ok(iniciais.has(chave), `tileset da cidade ausente: ${nome}/${chave}`);
    return { name: nome };
  } });
  const coop = fixture(true);
  Preloader.prototype.carregarAssets.call(coop);
  const prontos = new Set(coop.calls.map(c => c.chave));
  for (const arquivo of ASSETS_FABRICA) assert.ok(prontos.has(arquivo.chave), arquivo.chave);
  solo.concluir(); coop.concluir();
  assert.ok(assetsFabricaProntos(coop), "cliente lento só chega à cidade com boss/sons preparados pelo preloader original");
  assert.ok(!assetsFabricaProntos(solo));
  // A nova partida utiliza as mesmas chaves, sem novos downloads de recursos já presentes.
  Preloader.prototype.carregarAssets.call(coop);
  assert.equal(coop.calls.filter(c => c.tipo !== "plugin").length, 0);
  coop.events.emit("shutdown"); solo.events.emit("shutdown");
  assert.equal(coop.load.listenerCount("loaderror"), 0);
});

test("pacote não duplica solicitações concorrentes na mesma fila nem estados entre jogos", () => {
  const a = fixture(), b = fixture();
  assert.equal(criarCarregadorCacheavel(a), criarCarregadorCacheavel(a));
  enfileirarAssetsFabrica(a);
  const quantidade = a.calls.length;
  enfileirarAssetsFabrica(a);
  assert.equal(a.calls.length, quantidade);
  enfileirarAssetsFabrica(b);
  assert.equal(b.calls.length, quantidade);
  const sheetA = a.calls.find(c => c.tipo === "spritesheet");
  const sheetB = b.calls.find(c => c.chave === sheetA.chave);
  sheetA.args[1].frameWidth = 1;
  assert.notEqual(sheetA.args[1].frameWidth, sheetB.args[1].frameWidth, "configurações do Loader são independentes entre jogos");
  assert.notEqual(ASSETS_FABRICA.find(c => c.chave === sheetA.chave).args[1].frameWidth, 1);
  a.concluir();
  assert.ok(assetsFabricaProntos(a));
  assert.ok(!assetsFabricaProntos(b));
  assert.equal(a.load.listenerCount("complete"), 0);
  assert.equal(a.events.listenerCount("shutdown"), 0);
  b.events.emit("shutdown");
  assert.equal(b.load.listenerCount("complete"), 0);
});

test("falha parcial não libera a fábrica; retry mantém o spawn e baixa apenas o que faltou", () => {
  const s = fixture();
  enfileirarAssetsFabrica(s);
  s.concluir(["novo-boss-tentaculo", "musica-fabrica"]);
  assert.ok(!assetsFabricaProntos(s));
  const avisos = [], callbacks = [];
  s.cameras = { main: { width: 800, height: 450, setBackgroundColor() {}, fadeEffect: { reset() {} } } };
  s.add = { text(x, y, text) {
    avisos.push(text);
    const obj = { setOrigin() { return obj; }, setInteractive() { return obj; }, once(event, fn) { callbacks.push(fn); return obj; } };
    return obj;
  } };
  const data = { spawnX: -1085, spawnY: -5169, personagem: "kai-mercer", developerMode: true, multiplayer: false };
  s.scene = { settings: { data }, restart(dados) { s.reinicio = dados; } };
  assert.equal(verificarEntradaFabrica(s), false);
  assert.ok(s.aguardandoAssetsFabrica);
  assert.ok(avisos.includes("TENTAR NOVAMENTE"));
  callbacks[0]();
  assert.deepEqual(s.reinicio, data);
  enfileirarAssetsFabrica(s);
  assert.deepEqual(s.calls.map(c => c.chave).sort(), ["musica-fabrica", "novo-boss-tentaculo"]);
  s.concluir();
  assert.equal(verificarEntradaFabrica(s), true);
  assert.equal(s.aguardandoAssetsFabrica, false);
  // ProgressaoMapa remove o JSON após a progressão; reiniciar volta a prepará-lo.
  s.cache.tilemap.remove("mapaParte2");
  enfileirarAssetsFabrica(s);
  assert.deepEqual(s.calls.map(c => c.chave), ["mapaParte2"]);
});

test("todos os 18 recursos do boss mantêm os índices, dimensões, atlas e arquivos originais", () => {
  const boss = ASSETS_FABRICA.filter(a => a.chave.startsWith("novo-boss-"));
  assert.equal(boss.length, 18);
  for (const asset of Object.values(assetsNovoBoss)) {
    const arquivo = boss.find(a => a.chave === asset.chave);
    assert.equal(arquivo.args[0], asset.arquivo);
    if (asset.tipo === "atlas") assert.equal(arquivo.args[1], asset.dados);
    else assert.deepEqual(arquivo.args[1], { frameWidth: asset.larguraFrame, frameHeight: asset.alturaFrame,
      startFrame: 0, endFrame: asset.ultimoFrame });
  }
  for (const arquivo of ASSETS_FABRICA) for (const path of arquivo.tipo === "atlas" ? arquivo.args.slice(0, 2) : arquivo.args.slice(0, 1))
    assert.ok(readFileSync(new URL(`../../assets/${path.split("?")[0]}`, import.meta.url)).length > 0);
});

test("buffer Web Audio duplicado é compartilhado sem mudar chaves; HTML Audio mantém tags independentes", () => {
  const a = fixture(), b = fixture();
  const buffer = { getChannelData() {} };
  a.cache.audio.add("tiro-laser", buffer);
  const load = criarCarregadorCacheavel(a);
  load.audio("boss-disparo-laser", "sounds.mp3/tiro_laser.mp3");
  assert.equal(a.calls.length, 0);
  assert.equal(a.cache.audio.get("boss-disparo-laser"), buffer);
  assert.ok(!recursoDisponivel(b, "audio", "boss-disparo-laser"));
  b.cache.audio.add("tiro-laser", { tags: [] });
  criarCarregadorCacheavel(b).audio("boss-disparo-laser", "sounds.mp3/tiro_laser.mp3");
  assert.equal(b.calls.length, 1);
  assert.ok(!b.cache.audio.exists("boss-disparo-laser"));
  a.events.emit("shutdown"); b.events.emit("shutdown");
});

test("criação e update da fábrica aguardam os recursos inclusive em entrada direta DEV", async () => {
  await preloader();
  const Level = (await import("../scenes/Level1Parte2.js")).default;
  const s = fixture();
  s.cameras = { main: { width: 800, height: 450, setBackgroundColor() {}, fadeEffect: { reset() {} } } };
  s.add = { text() { const obj = { destroy() {}, setOrigin: () => obj, setInteractive: () => obj, once: () => obj }; return obj; } };
  Level.prototype.preload.call(s);
  assert.equal(s.load.maxParallelDownloads, 2);
  assert.doesNotThrow(() => Level.prototype.create.call(s), "não acessa física/mapa/boss antes dos assets");
  assert.doesNotThrow(() => Level.prototype.update.call(s, 0, 16));
  assert.ok(s.aguardandoAssetsFabrica);
  s.concluir();
  assert.ok(assetsFabricaProntos(s));
});

test("preload real da fábrica adia o boss só na entrada comum solo, preservando DEV e multiplayer", async () => {
  await preloader();
  const Level = (await import("../scenes/Level1Parte2.js")).default;
  for (const [multiplayer, developerMode, spawnX, spawnY, incluirBoss] of [
    [false, false, 98, -1040, false], [true, false, 98, -1040, true],
    [false, true, -1085, -5169, true], [false, false, -1093, -5905, true],
  ]) {
    const s = fixture(multiplayer);
    Object.assign(s, { developerMode, respawnX: spawnX, respawnY: spawnY });
    s.cameras = { main: { width: 800, height: 450, setBackgroundColor() {} } };
    s.add = { text() { const texto = { setOrigin: () => texto }; return texto; } };
    Level.prototype.preload.call(s);
    assert.equal(s.bossNaEntrada, incluirBoss);
    assert.equal(s.calls.some(a => a.chave === "novo-boss-tentaculo"), incluirBoss);
    assert.equal(s.calls.some(a => a.chave === "musica-novo-boss"), incluirBoss);
    assert.ok(s.calls.some(a => a.chave === "musica-fabrica"));
    s.concluir();
    assert.ok(assetsFabricaProntos(s, { incluirBoss }));
  }
});

test("áudio desativado pelo Phaser não prende a fábrica em retentativa; mute/lock continuam carregando", () => {
  const s = fixture();
  s.game = { config: { audio: { noAudio: true } }, device: { audio: { webAudio: true } } };
  enfileirarAssetsFabrica(s);
  assert.equal(s.calls.filter(c => c.tipo === "audio").length, 0);
  s.concluir();
  assert.ok(assetsFabricaProntos(s));
  const normal = fixture();
  normal.game = { config: { audio: {} }, device: { audio: { webAudio: true } } };
  normal.sound = { mute: true, locked: true };
  enfileirarAssetsFabrica(normal);
  assert.equal(normal.calls.filter(c => c.tipo === "audio").length, 16);
  normal.events.emit("shutdown");
});

test("encerrar o preloader remove conclusão pendente e uma falha síncrona permite nova tentativa", async () => {
  const Preloader = await preloader(), s = fixture();
  let concluiu = false;
  s.carregarAssets = () => {};
  s.load.start = () => s.load;
  s.prepararRenderizacaoPersonagens = () => { concluiu = true; };
  s.finalizarCarregamento = () => { concluiu = true; };
  Preloader.prototype.iniciarCarregamento.call(s);
  s.events.emit("shutdown");
  s.load.emit("complete");
  assert.equal(concluiu, false, "callback não roda após destruir/encerrar a cena");
  let tentativas = 0;
  s.load.image = () => { if (++tentativas === 1) throw Error("falha transitória"); };
  const load = criarCarregadorCacheavel(s);
  assert.throws(() => load.image("tentativa", "imagem.png"));
  assert.doesNotThrow(() => load.image("tentativa", "imagem.png"));
  assert.equal(tentativas, 2);
  s.events.emit("shutdown");
});

test("transição normal conserva fade/spawn e o atalho DEV usa a mesma barreira da fábrica", async t => {
  await preloader();
  const anterior = globalThis.Phaser.Input, cenas = globalThis.Phaser.Scenes;
  t.after(() => { globalThis.Phaser.Input = anterior; globalThis.Phaser.Scenes = cenas; });
  globalThis.Phaser.Scenes = { Events: { SHUTDOWN: "shutdown" } };
  globalThis.Phaser.Input = { Keyboard: { KeyCodes: { O: 79 } } };
  const { iniciarTransicao } = await import("./MapTransition.js");
  const { criarTeleporteDevBoss } = await import("../controls/DeveloperTeleport.js");
  const scene = () => {
    const s = fixture(), camera = new EventEmitter();
    s.personagemSelecionada = "aria-kade";
    s.physics = { pause() { s.pausada = true; } };
    s.cameras = { main: camera };
    s.inimigos = [];
    camera.fadeOut = duration => { s.fade = duration; };
    s.registry = new Map();
    s.scene = { start(key, data) { s.destino = { key, data }; } };
    return s;
  };
  const normal = scene();
  iniciarTransicao(normal);
  assert.ok(normal.pausada);
  assert.ok(normal.fade > 0);
  assert.equal(normal.destino, undefined, "aguarda a animação/fade original");
  normal.cameras.main.emit("camerafadeoutcomplete");
  assert.deepEqual(normal.destino, { key: "Level1Parte2", data: {
    spawnX: 98, spawnY: -1040, personagem: "aria-kade", multiplayer: false } });
  const dev = scene();
  dev.sys = { settings: { key: "Level1" } };
  dev.developerMode = true;
  dev.player = { active: true };
  dev.input = { keyboard: { addKey: () => new EventEmitter() } };
  criarTeleporteDevBoss(dev);
  dev.teleportarDevBoss();
  assert.deepEqual(dev.destino, { key: "Level1Parte2", data: {
    spawnX: -1085, spawnY: -5169, personagem: "aria-kade", multiplayer: false, developerMode: true } });
  assert.ok(!assetsFabricaProntos(normal) && !assetsFabricaProntos(dev), "ambas chegam ao preload, sem criar uma fábrica incompleta");
});

test("street e street2 mantêm chaves distintas e usam somente a imagem comprovadamente idêntica", async () => {
  const { createHash } = await import("node:crypto");
  const a = readFileSync(new URL("../../Tilesets/City/Tileset_SciFi_Street_Rasak.png", import.meta.url));
  const b = readFileSync(new URL("../../Tilesets/City/Tileset_SciFi_Street_Rasak_DUP.png", import.meta.url));
  const sha = data => createHash("sha256").update(data).digest("hex");
  assert.equal(sha(a), sha(b), "se a arte DUP mudar, ela precisa voltar a ter carregamento próprio");
  const Preloader = await preloader(), s = fixture();
  Preloader.prototype.carregarAssets.call(s);
  const street = s.calls.find(c => c.chave === "street"), copia = s.calls.find(c => c.chave === "street2");
  assert.equal(street.args[0], copia.args[0]);
  assert.notEqual(street.chave, copia.chave);
  s.events.emit("shutdown");
});
