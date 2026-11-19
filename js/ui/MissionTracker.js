import { criarMissionManager } from "../systems/MissionManager.js";
import { dispositivoComToque } from "../core/MobileDisplay.js";

export function posicionarMissoesMobile(bounds, map, timer, status, allies) {
  const gap = 8;
  const minWidth = 164;
  const right = map ? map.left - gap : bounds.right - gap;
  let top = Math.max(bounds.top + gap, map?.top ?? bounds.top);
  const leftLimit = bounds.left + gap;
  const hud = [status, allies].filter(Boolean);
  const leftAt = y => Math.max(leftLimit, ...hud
    .filter(rect => rect.bottom + gap > y)
    .map(rect => rect.right + gap));

  let left = Math.max(leftAt(top), (timer?.right ?? leftLimit) + gap);
  if (right - left < minWidth) {
    top = Math.max(top, (timer?.bottom ?? bounds.top) + gap);
    left = leftAt(top);
    if (right - left < minWidth) {
      top = Math.max(top, ...hud.map(rect => rect.bottom + gap));
      left = leftLimit;
    }
  }
  return { right, top, width: Math.max(0, right - left) };
}

export function criarRastreadorMissoes(scene) {
  const canvas = scene.game.canvas;
  if (!canvas?.parentElement) return;
  const root = document.createElement("aside");
  root.className = "mission-tracker";
  const mobile = dispositivoComToque();
  root.classList.toggle("mission-mobile", mobile);
  root.setAttribute("aria-label", "Objetivos da campanha");
  const sector = document.createElement("p");
  sector.className = "mission-sector";
  const title = document.createElement("h2");
  const list = document.createElement("ul");
  root.append(sector, title, list);
  canvas.parentElement.append(root);
  const rows = new Map(), recentTasks = new Map();
  let last, animationTimer, statusHud, allyHud;

  function render(state, recent = []) {
    sector.textContent = `PROTOCOLO ZERO / ${state.sector}`;
    title.textContent = state.title;
    const visible = new Set();
    for (const task of [...recent, ...state.tasks].slice(0, 4)) {
      if (visible.has(task.id)) continue;
      visible.add(task.id);
      let row = rows.get(task.id);
      if (!row) {
        row = document.createElement("li");
        rows.set(task.id, row);
      }
      row.dataset.status = task.status;
      row.classList.toggle("mission-confirmed", recent.includes(task));
      row.textContent = `${task.status === "completed" ? "✓" : "◇"} ${task.title}`;
      if (task.optional) row.textContent += " (opcional)";
      if (list.children[visible.size - 1] !== row) list.insertBefore(row, list.children[visible.size - 1] ?? null);
    }
    for (const [id, row] of rows) if (!visible.has(id)) { row.remove(); rows.delete(id); }
  }

  criarMissionManager(scene, state => {
    const newMission = last?.id !== state.id;
    const recent = last?.tasks.filter(item => item.status !== "completed" && state.completed[item.id])
      .map(item => ({ ...item, status: "completed" })) ?? [];
    last = state;
    for (const item of recent) recentTasks.set(item.id, item);
    const remaining = state.tasks.filter(item => !recentTasks.has(item.id));
    render({ ...state, tasks: remaining }, [...recentTasks.values()]);
    if (recent.length) {
      clearTimeout(animationTimer);
      animationTimer = setTimeout(() => {
        recentTasks.clear();
        render(last);
      }, 1250);
    }
    if (newMission && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) title.animate?.([{ opacity: 0.5 }, { opacity: 1 }], { duration: 240 });
  });

  function layout() {
    const bounds = canvas.getBoundingClientRect();
    const parent = canvas.parentElement.getBoundingClientRect();
    root.style.setProperty("--mission-x", `${bounds.left - parent.left}px`);
    root.style.setProperty("--mission-y", `${bounds.top - parent.top}px`);
    const map = scene.minimap?.hudPosition;
    let mapRect;
    if (map) {
      const camera = scene.cameras.main;
      const size = scene.scale.gameSize;
      mapRect = {
        left: bounds.left + map.x * bounds.width / (size?.width || camera.width),
        top: bounds.top + map.y * bounds.height / (size?.height || camera.height),
      };
      root.style.setProperty("--mission-map-left", `${mapRect.left - parent.left - 9}px`);
      root.style.setProperty("--mission-map-top", `${mapRect.top - parent.top}px`);
    }
    root.classList.toggle("mission-next-to-map", !!map);
    const status = statusHud?.getBoundingClientRect();
    const allies = allyHud?.getBoundingClientRect();
    if (mobile) {
      const timer = scene.hudStatus?.cronometro?.getBoundingClientRect();
      const position = posicionarMissoesMobile(bounds, mapRect, timer, status, allies);
      root.style.setProperty("--mission-mobile-right", `${parent.right - position.right}px`);
      root.style.setProperty("--mission-mobile-top", `${position.top - parent.top}px`);
      root.style.setProperty("--mission-mobile-width", `${position.width}px`);
    }
    const occupiedBottom = Math.max(
      status?.bottom ?? bounds.top,
      allies?.bottom ?? bounds.top,
    );
    root.style.setProperty("--mission-hud-bottom", `${occupiedBottom - parent.top + 7}px`);
  }
  function modalVisibility() {
    const status = scene.hudStatus?.elemento, allies = scene.hudAliados?.elemento;
    if (status !== statusHud || allies !== allyHud) {
      if (statusHud) observer.unobserve(statusHud);
      if (allyHud) observer.unobserve(allyHud);
      statusHud = status;
      allyHud = allies;
      if (statusHud) observer.observe(statusHud);
      if (allyHud) observer.observe(allyHud);
      layout();
    }
    const oculto = !!(scene.generatorMenuOpen || scene.cardReaderMenuOpen || scene.upgradeMenuOpen || scene.upgradeDialogueOpen ||
      scene.cenaEntradaBossAtiva || scene.morteEmAndamento);
    if (root.hidden !== oculto) root.hidden = oculto;
  }
  const observer = new ResizeObserver(layout);
  observer.observe(canvas);
  observer.observe(canvas.parentElement);
  scene.scale.on("resize", layout);
  scene.events.on("prerender", modalVisibility);
  scene.events.on("minimap:layout", layout);
  layout();
  scene.events.once("shutdown", () => {
    clearTimeout(animationTimer);
    observer.disconnect();
    scene.scale.off("resize", layout);
    scene.events.off("prerender", modalVisibility);
    scene.events.off("minimap:layout", layout);
    root.remove();
  });
}
