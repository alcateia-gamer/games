/** Replica os sprites e comandos vetoriais reais, sem transmitir imagens por quadro. */
import { COOP, round } from "./CoopProtocol.js";

const TYPES = new Set(["Sprite", "Image", "Graphics", "Arc", "Rectangle", "Ellipse", "Line", "Polygon", "Triangle", "Container"]);
export function describeVisual(o) {
  if (!o?.active || !TYPES.has(o.type)) return null;
  const state = { t: o.type, x: round(o.x), y: round(o.y), d: round(o.depth, 1000),
    sx: round(o.scaleX, 10000), sy: round(o.scaleY, 10000), r: round(o.rotation, 10000),
    a: round(o.alpha, 100), v: o.visible !== false, ox: round(o.originX ?? 0.5, 10000),
    oy: round(o.originY ?? 0.5, 10000), fx: !!o.flipX, fy: !!o.flipY,
    blend: o.blendMode || 0, tint: o.tintTopLeft ?? 0xffffff, tf: !!o.tintFill };
  if (o.texture && o.frame) {
    state.k = o.texture.key; state.f = o.frame.name;
    // Alguns frames (armas recortadas e marreta) são cadastrados sob demanda.
    state.cut = [o.frame.cutX, o.frame.cutY, o.frame.cutWidth, o.frame.cutHeight, o.frame.sourceIndex || 0];
  }
  if (o.type === "Graphics") {
    if (o.commandBuffer.length > COOP.maxCommands) return null;
    state.g = o.commandBuffer.map(n => typeof n === "number" ? round(n, 100) : n);
  } else if (!o.texture && o.type !== "Container") {
    state.w = round(o.width); state.h = round(o.height);
    state.fill = o.fillColor; state.fa = round(o.fillAlpha, 100);
    state.stroke = o.strokeColor; state.sa = round(o.strokeAlpha, 100); state.lw = o.lineWidth || 0;
    if (o.type === "Arc") state.radius = round(o.radius);
    if (o.type === "Line") state.geom = [o.geom.x1, o.geom.y1, o.geom.x2, o.geom.y2];
    if (o.type === "Polygon") state.geom = o.geom.points.flatMap(p => [p.x, p.y]);
    if (o.type === "Triangle") state.geom = [o.geom.x1, o.geom.y1, o.geom.x2, o.geom.y2, o.geom.x3, o.geom.y3];
  }
  return state;
}

function prepareFrame(scene, s) {
  if (!scene.textures.exists(s.k)) return false;
  const texture = scene.textures.get(s.k);
  if (!texture.has(s.f) && Array.isArray(s.cut) && s.cut.length === 5) {
    const [x, y, w, h, index] = s.cut;
    if ([x, y, w, h, index].every(Number.isFinite) && w > 0 && h > 0) texture.add(s.f, index, x, y, w, h);
  }
  return texture.has(s.f);
}

export function applyVisual(scene, o, s, interpolate = true) {
  if (s.k && prepareFrame(scene, s)) o.setTexture?.(s.k, s.f);
  if (interpolate) { o.coopTargetX = s.x; o.coopTargetY = s.y; }
  else o.setPosition(s.x, s.y);
  o.setScale(s.sx, s.sy).setRotation(s.r).setDepth(s.d).setAlpha(s.a).setVisible(s.v);
  o.setOrigin?.(s.ox, s.oy); o.setFlip?.(s.fx, s.fy); o.setBlendMode?.(s.blend);
  if (o.setTint && o.tintTopLeft !== s.tint) o.setTint(s.tint);
  if (o.setTintFill && s.tf) o.setTintFill(s.tint);
  if (s.t === "Graphics" && Array.isArray(s.g) && s.g.length <= COOP.maxCommands) {
    o.commandBuffer = [...s.g]; o.dirty = true;
  } else if (!s.k && s.t !== "Container") {
    o.setFillStyle?.(s.fill, s.fa); o.setStrokeStyle?.(s.lw, s.stroke, s.sa);
    if (s.t === "Arc") o.setRadius(s.radius);
    else if (s.t === "Rectangle" || s.t === "Ellipse") o.setSize(s.w, s.h);
  }
  return o;
}

export function createVisual(scene, s) {
  if (!s || !TYPES.has(s.t)) return null;
  let o;
  if (s.k) {
    if (!prepareFrame(scene, s)) return null;
    o = scene.add.sprite(s.x, s.y, s.k, s.f);
  } else if (s.t === "Graphics") o = scene.add.graphics();
  else if (s.t === "Container") o = scene.add.container(s.x, s.y);
  else if (s.t === "Arc") o = scene.add.circle(s.x, s.y, s.radius);
  else if (s.t === "Rectangle") o = scene.add.rectangle(s.x, s.y, s.w, s.h);
  else if (s.t === "Ellipse") o = scene.add.ellipse(s.x, s.y, s.w, s.h);
  else if (s.t === "Line") o = scene.add.line(s.x, s.y, ...s.geom);
  else if (s.t === "Triangle") o = scene.add.triangle(s.x, s.y, ...s.geom);
  else if (s.t === "Polygon") o = scene.add.polygon(s.x, s.y, s.geom);
  if (!o) return null;
  o.coopReplica = true;
  return applyVisual(scene, o, s, false);
}

export class VisualSender {
  constructor() { this.ids = new WeakMap(); this.sequence = 0; this.previous = new Map(); }
  id(o) {
    if (!o) return null;
    if (!this.ids.has(o)) this.ids.set(o, `v${++this.sequence}`);
    return this.ids.get(o);
  }
  capture(objects, full = false) {
    const current = new Map(), changed = [];
    for (const o of objects.slice(0, COOP.maxNodes)) {
      const s = describeVisual(o);
      if (!s) continue;
      const id = this.id(o), parent = o.parentContainer && objects.includes(o.parentContainer)
        ? this.id(o.parentContainer) : null;
      const entry = { ...s, parent, owner: o.coopOwner || null };
      const before = this.previous.get(id);
      current.set(id, entry);
      const delta = full || !before ? entry : Object.fromEntries(Object.entries(entry)
        .filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v)));
      if (Object.keys(delta).length) changed.push({ id, s: delta });
    }
    const removed = [...this.previous.keys()].filter(id => !current.has(id));
    this.previous = current;
    return { full, changed, removed };
  }
}

export class VisualReceiver {
  constructor(scene) { this.scene = scene; this.entries = new Map(); }
  receive(packet) {
    if (!packet || !Array.isArray(packet.changed) || packet.changed.length > COOP.maxNodes) return;
    const keep = new Set(packet.changed.map(n => n.id));
    if (packet.full) for (const id of this.entries.keys()) if (!keep.has(id)) this.remove(id);
    for (const id of packet.removed || []) this.remove(id);
    for (const node of packet.changed) {
      if (typeof node.id !== "string" || !node.s || this.entries.size >= COOP.maxNodes && !this.entries.has(node.id)) continue;
      const before = this.entries.get(node.id);
      const s = { ...before?.state, ...node.s };
      if (Array.isArray(s.g) && s.g.length > COOP.maxCommands) continue;
      let object = before?.object;
      if (!object || object.type !== s.t && !(s.k && object.type === "Sprite")) {
        object?.destroy(); object = createVisual(this.scene, s);
      } else applyVisual(this.scene, object, s);
      if (object) this.entries.set(node.id, { object, state: s });
    }
    for (const { object, state } of this.entries.values()) {
      const parent = this.entries.get(state.parent)?.object;
      if (parent?.type === "Container" && object.parentContainer !== parent) parent.add(object);
    }
  }
  get(id) { return this.entries.get(id)?.object; }
  update(delta) {
    const alpha = 1 - Math.exp(-Math.min(100, Math.max(0, delta)) / 65);
    for (const { object: o } of this.entries.values()) {
      if (!o.active || !Number.isFinite(o.coopTargetX)) continue;
      const distance = Math.hypot(o.coopTargetX - o.x, o.coopTargetY - o.y);
      const factor = distance > 180 ? 1 : alpha;
      o.setPosition(o.x + (o.coopTargetX - o.x) * factor, o.y + (o.coopTargetY - o.y) * factor);
    }
  }
  remove(id) { this.entries.get(id)?.object.destroy(); this.entries.delete(id); }
  destroy() { for (const id of [...this.entries.keys()]) this.remove(id); }
}
