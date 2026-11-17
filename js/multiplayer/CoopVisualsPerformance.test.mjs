import test from "node:test";
import assert from "node:assert/strict";
import { COOP } from "./CoopProtocol.js";
import { VisualSender, describeVisual } from "./CoopVisuals.js";

// Referência anterior à otimização: mantém includes e a comparação profunda original.
class OriginalSender extends VisualSender {
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

const object = (type = "Container") => ({ active: true, type, x: 10, y: 20 });
function compare(original, optimized, objects, full = false) {
  const expected = original.capture(objects, full);
  const actual = optimized.capture(objects, full);
  assert.deepEqual(actual, expected);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
  assert.deepEqual(optimized.previous, original.previous);
  return actual;
}

test("captura preserva pais além do limite, ordem, duplicatas e pais ausentes", () => {
  const original = new OriginalSender(), optimized = new VisualSender();
  const outside = object(), absent = object();
  const objects = Array.from({ length: COOP.maxNodes + 2 }, () => object());
  objects[COOP.maxNodes + 1] = outside;
  objects[0].parentContainer = outside;
  objects[1].parentContainer = absent;
  objects[2] = objects[0];
  objects[3].active = false;
  objects[4].type = "Unsupported";
  const packet = compare(original, optimized, objects, true);
  assert.equal(packet.changed[0].s.parent, original.id(outside));
  assert.equal(packet.changed[1].s.parent, null);
  compare(original, optimized, objects);
  objects[0].parentContainer = objects[1];
  compare(original, optimized, objects);
  compare(original, optimized, [], false);
});

test("full frames, deltas, valores ausentes, arrays internos e recriações são equivalentes", () => {
  const original = new OriginalSender(), optimized = new VisualSender();
  const parent = object(), graphics = { ...object("Graphics"), parentContainer: parent,
    commandBuffer: [1, 2, { nested: [3, null] }] };
  const objects = [parent, graphics];
  compare(original, optimized, objects, true);
  assert.equal(compare(original, optimized, objects).changed.length, 0);
  graphics.commandBuffer[2].nested[0] = 4;
  graphics.commandBuffer.push(undefined);
  graphics.coopOwner = "player";
  compare(original, optimized, objects);
  graphics.parentContainer = null;
  graphics.coopOwner = undefined;
  compare(original, optimized, objects);
  graphics.active = false;
  compare(original, optimized, objects);
  objects[1] = { ...graphics, active: true, parentContainer: parent };
  compare(original, optimized, objects);
  compare(original, optimized, objects, true);
  compare(original, optimized, []);
  compare(original, optimized, [object()]);
});

test("capturas de salas e remetentes independentes não compartilham pais nem estado", () => {
  // Simula remetentes separados para host e efeitos de 1–4 jogadores em duas salas.
  const rooms = [1, 2].map(() => Array.from({ length: 5 }, () => ({
    original: new OriginalSender(), optimized: new VisualSender(), parent: object(), child: object(),
  })));
  for (let players = 1; players <= 4; players++) {
    for (const room of rooms) for (const entry of room.slice(0, players + 1)) {
      entry.child.parentContainer = entry.parent;
      compare(entry.original, entry.optimized, [entry.child, entry.parent], players === 1);
      entry.child.x += players;
      compare(entry.original, entry.optimized, [entry.child, entry.parent]);
    }
  }
  const a = rooms[0][0], b = rooms[1][0];
  a.child.parentContainer = b.parent;
  assert.equal(compare(a.original, a.optimized, [a.child, a.parent]).changed[0].s.parent, null);
  assert.equal(compare(b.original, b.optimized, [b.child, b.parent]).changed.length, 0);
  compare(a.original, a.optimized, []);
  assert.ok(b.optimized.previous.size > 0);
});
