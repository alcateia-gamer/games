import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { dispositivoComToque, solicitarTelaCheiaMobile, registrarAtualizacaoDeViewport } from "./MobileDisplay.js";

function ambiente(t, elemento, touch = true) {
  for (const [key, value] of Object.entries({
    window: { matchMedia: () => ({ matches: touch }) },
    navigator: { maxTouchPoints: touch ? 5 : 0 },
    document: { documentElement: elemento, fullscreenElement: null },
  })) {
    const anterior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (anterior) Object.defineProperty(globalThis, key, anterior);
      else delete globalThis[key];
    });
  }
}

test("solicita fullscreen no próprio gesto, antes de aguardar qualquer operação", async t => {
  let chamada;
  ambiente(t, { requestFullscreen(opcoes) { chamada = opcoes; return Promise.resolve(); } });
  const pedido = solicitarTelaCheiaMobile();
  assert.deepEqual(chamada, { navigationUI: "hide" });
  await pedido;
});

test("desktop não entra automaticamente e uma sessão já em fullscreen não repete o pedido", async t => {
  let chamadas = 0;
  ambiente(t, { requestFullscreen() { chamadas++; } }, false);
  assert.equal(dispositivoComToque(), false);
  await solicitarTelaCheiaMobile();
  assert.equal(chamadas, 0);
  window.matchMedia = () => ({ matches: true });
  document.fullscreenElement = document.documentElement;
  await solicitarTelaCheiaMobile();
  assert.equal(chamadas, 0);
});

test("suporta a API WebKit e não interrompe o jogo quando fullscreen não está disponível", async t => {
  let chamadas = 0;
  ambiente(t, { webkitRequestFullscreen() { chamadas++; } });
  await solicitarTelaCheiaMobile();
  assert.equal(chamadas, 1);
  document.documentElement = {};
  await assert.doesNotReject(solicitarTelaCheiaMobile());
  document.documentElement.requestFullscreen = () => Promise.reject(new Error("NotAllowedError"));
  await assert.doesNotReject(solicitarTelaCheiaMobile());
});

test("viewport combina orientação e ResizeObserver com limpeza ao destruir o jogo", t => {
  ambiente(t, {});
  const target = () => {
    const events = new EventEmitter();
    events.addEventListener = events.on.bind(events);
    events.removeEventListener = events.off.bind(events);
    return events;
  };
  const win = target(), doc = target(), viewport = target();
  const frames = new Map();let nextFrame = 0, observer;
  Object.assign(window, {
    addEventListener: win.addEventListener, removeEventListener: win.removeEventListener,
    visualViewport: viewport,
    requestAnimationFrame(callback) { const id = ++nextFrame;frames.set(id, callback);return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const rect = { width: 932, height: 430 };
  const container = { getBoundingClientRect: () => rect };
  Object.assign(document, { addEventListener: doc.addEventListener,
    removeEventListener: doc.removeEventListener, getElementById: () => container });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: class {
    constructor(callback) { observer = this;this.callback = callback; }
    observe(node) { assert.equal(node, container); }
    disconnect() { this.disconnected = true; }
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "ResizeObserver", previous);
    else delete globalThis.ResizeObserver;
  });
  const sizes = [];
  const game = { isBooted: true, events: new EventEmitter(),
    scale: { setParentSize: (...size) => sizes.push(size) } };
  const flush = () => { const pending = [...frames.values()];frames.clear();pending.forEach(callback => callback()); };
  const cleanup = registrarAtualizacaoDeViewport(game);
  flush();assert.deepEqual(sizes, [[932, 430]]);
  rect.width = 430;rect.height = 932;
  win.emit("orientationchange");viewport.emit("resize");observer.callback();
  assert.equal(frames.size, 1, "eventos simultâneos compartilham o mesmo quadro");
  flush();assert.deepEqual(sizes.at(-1), [430, 932]);
  doc.emit("fullscreenchange");assert.equal(frames.size, 1);
  cleanup();cleanup();game.events.emit("destroy");
  assert.equal(frames.size, 0, "a limpeza cancela o quadro pendente");
  assert.ok(observer.disconnected);
  for (const events of [win, doc, viewport, game.events]) {
    assert.deepEqual(events.eventNames(), [], "não sobram eventos após destruir o jogo");
  }
  observer.callback();assert.equal(frames.size, 0);
});
