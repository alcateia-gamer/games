/** Diagnóstico opt-in: não é carregado na execução normal do jogo. */
const installed = new WeakMap();
export function installPerformanceProbe(game, { capacity = 1800, clock = () => performance.now(),
  observeLongTasks = true } = {}) {
  if (installed.has(game)) return installed.get(game);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 18000) throw new RangeError("capacity");
  const metrics = new Map(), undo = new Set(), watched = new WeakSet();
  const counters = { lightingRefreshes: 0, lightingSubmittedPixels: 0 };
  let stopped = false, previousFrame, lightingRefreshMs = 0;
  let rendererCounters, rendererCountersPromise;
  function record(name, ms) {
    let metric = metrics.get(name);
    if (!metric) {
      metric = { values: new Float64Array(capacity), count: 0, total: 0, max: 0, overBudget: 0 };
      metrics.set(name, metric);
    }
    metric.values[metric.count % capacity] = ms;
    metric.count++; metric.total += ms; metric.max = Math.max(metric.max, ms);
    if (ms > 1000 / 30) metric.overBudget++;
  }
  function wrap(target, key, name, before, after) {
    if (!target || typeof target[key] !== "function") return;
    const original = target[key], own = Object.getOwnPropertyDescriptor(target, key);
    function measured(...args) {
      const start = clock();
      before?.(start);
      try { return original.apply(this, args); }
      finally {
        const duration = clock() - start;
        record(name, duration); after?.(duration);
      }
    }
    target[key] = measured;
    const restore = () => {
      undo.delete(restore);
      if (target[key] !== measured) return;
      if (own) Object.defineProperty(target, key, own);
      else delete target[key];
    };
    undo.add(restore);
    return restore;
  }
  function watchScene(scene) {
    if (watched.has(scene)) return;
    watched.add(scene);
    const name = scene.sys.settings.key;
    const scope = [];
    const watch = (...args) => { const restore = wrap(...args); if (restore) scope.push(restore); };
    watch(scene.sys, "step", `${name}.step`);
    watch(scene.sys, "sceneUpdate", `${name}.update`);
    watch(scene.physics?.world, "step", `${name}.physics`);
    watch(scene.minimap, "update", `${name}.minimap`);
    for (const [key, label] of [["iluminacaoFabrica", "factory"], ["iluminacaoEmergencia", "emergency"],
      ["iluminacaoBoss", "walls"], ["iluminacaoEnergiaBoss", "bossEnergy"], ["zonasLuzApagada", "zones"]]) {
      watch(scene[key], "atualizar", `${name}.lighting.logic.${label}`);
    }
    for (const key of ["update", "receiveFrame", "worldObjects"]) {
      watch(scene.coopRuntime, key, `${name}.coop.${key}`);
    }
    watch(scene.coopRuntime?.receiver, "receive", `${name}.visuals.receive`);
    watch(scene.coopRuntime?.receiver, "update", `${name}.visuals.update`);
    if (name === "Level1Parte2") {
      const texture = scene.textures?.list?.["level1-parte2-escuridao"];
      watch(texture, "refresh", `${name}.lighting.refreshCPU`, () => {
        counters.lightingRefreshes++;
        counters.lightingSubmittedPixels += texture.width * texture.height;
      }, duration => { lightingRefreshMs += duration; });
    }
    const cleanupScene = () => {
      scene.events?.off("shutdown", cleanupScene);
      for (const restore of scope.reverse()) restore();
      watched.delete(scene);
      undo.delete(cleanupScene);
    };
    scene.events?.once("shutdown", cleanupScene);
    undo.add(cleanupScene);
  }
  wrap(game.loop, "callback", "frame.cpu", start => {
    if (previousFrame !== undefined) record("frame.interval", start - previousFrame);
    previousFrame = start;
    for (const scene of game.scene.getScenes(true)) watchScene(scene);
  });
  wrap(game.scene, "update", "scenes.update");
  wrap(game.scene, "render", "scenes.render");
  // Mede o callback de iluminação registrado em renderer.RENDER sem trocar a ordem dos listeners.
  const renderer = game.renderer;
  if (renderer) {
    const original = renderer.emit;
    function emit(event, ...args) {
      if (event !== "render") return original.call(this, event, ...args);
      const start = clock();
      const previousRefresh = lightingRefreshMs;
      try { return original.call(this, event, ...args); }
      finally {
        const duration = clock() - start;
        record("renderer.renderListeners", duration);
        record("renderer.renderListeners.excludingLightingRefresh", Math.max(0, duration - lightingRefreshMs + previousRefresh));
      }
    }
    const own = Object.getOwnPropertyDescriptor(renderer, "emit");
    renderer.emit = emit;
    undo.add(() => {
      if (renderer.emit !== emit) return;
      if (own) Object.defineProperty(renderer, "emit", own); else delete renderer.emit;
    });
    for (const key of ["texImage2D", "texSubImage2D"]) wrap(renderer.gl, key, `gl.${key}.cpu`);
  }
  let observer;
  if (observeLongTasks && typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) record("browser.longtask", entry.duration);
    });
    observer.observe({ type: "longtask" });
  }
  const probe = {
    async enableRendererCounters() {
      if (stopped) return null;
      rendererCountersPromise ??= import("./RendererCounters.js").then(({installRendererCounters}) => {
        if (!stopped) rendererCounters = installRendererCounters(game);
        return rendererCounters;
      });
      return rendererCountersPromise;
    },
    // Roteiros com game.step manual podem observar uma cena pausada explicitamente.
    watchScene,
    reset() {
      metrics.clear(); previousFrame = undefined; lightingRefreshMs = 0;
      counters.lightingRefreshes = counters.lightingSubmittedPixels = 0;
      rendererCounters?.reset();
    },
    snapshot() {
      const results = {};
      for (const [name, metric] of metrics) {
        const values = Array.from(metric.values.subarray(0, Math.min(metric.count, capacity))).sort((a, b) => a - b);
        const percentile = p => values[Math.max(0, Math.ceil(values.length * p) - 1)];
        results[name] = { calls: metric.count, mean: metric.total / metric.count, max: metric.max,
          samples: values.length, median: percentile(.5), p95: percentile(.95), p99: percentile(.99), overBudget: metric.overBudget };
      }
      const imageIds = new WeakMap();
      let nextImage = 0;
      const textures = Object.values(game.textures?.list ?? {}).map(texture => ({ key: texture.key,
        sources: (texture.source ?? []).map(source => {
          const image = source.image;
          const identifiable = image && (typeof image === "object" || typeof image === "function");
          if (identifiable && !imageIds.has(image)) imageIds.set(image, ++nextImage);
          return { width: source.width, height: source.height, imageId: identifiable ? imageIds.get(image) : null };
        }) }));
      return { metrics: results, counters: { ...counters },
        ...(rendererCounters ? { rendererCounters: rendererCounters.snapshot() } : {}),
        canvas: { width: game.canvas?.width, height: game.canvas?.height },
        scenes: game.scene.getScenes(true).map(s => ({ key: s.sys.settings.key, objects: s.children?.list?.length,
          enemies: s.inimigos?.length, host: s.coopRuntime?.host })), textures };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      rendererCounters?.stop();
      observer?.disconnect();
      for (const restore of [...undo].reverse()) restore();
      undo.clear();
      game.events?.off("destroy", cleanup);
      installed.delete(game);
    },
  };
  function cleanup() { probe.stop(); }
  installed.set(game, probe);
  game.events?.once("destroy", cleanup);
  return probe;
}
