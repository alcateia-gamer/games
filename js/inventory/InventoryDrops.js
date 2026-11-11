import { criarItemColetavel } from "./ItemPickup.js";

/** Cada slot vira um coletável próprio; galões conservam o nível de combustível. */
export function criarDropsInventario(scene, drop, collected = {}) {
  const mapKey = scene.sys?.settings?.key ?? scene.scene?.key;
  if (drop.mapKey !== mapKey || !scene.inventory || !scene.itensColetaveis) return;
  drop.slots.forEach((slot, index) => {
    const uniqueId = `drop:${drop.id}:${index}`;
    if (collected[uniqueId] || scene.inventory.hasCollected(uniqueId) ||
        scene.itensColetaveis.some(item => item.uniqueId === uniqueId)) return;
    // Uma pequena grade mantém os itens perto do corpo sem sobrepor todos os ícones.
    const colunas = Math.min(5, drop.slots.length);
    const x = drop.x + (index % colunas - (colunas - 1) / 2) * 12;
    const y = drop.y + (Math.floor(index / colunas) - (Math.ceil(drop.slots.length / colunas) - 1) / 2) * 12;
    criarItemColetavel(scene, { ...slot, uniqueId, x, y, dropped: true });
  });
}

/** Esvazia apenas o inventário do jogador que morreu, uma vez por queda. */
export function droparInventarioAoMorrer(scene) {
  const slots = scene.inventory?.getSlots();
  if (!slots?.length) return;
  const drop = { id: scene.coopDownId ?? `solo:${Date.now()}`,
    mapKey: scene.sys?.settings?.key ?? scene.scene?.key,
    x: scene.player.x, y: scene.player.y, slots };
  if (scene.coopRuntime) {
    // O estado da queda também transporta os itens se uma ação chegar fora de ordem.
    scene.coopInventoryDrop = drop;
    scene.coopRuntime.world.dropInventory(drop);
  } else criarDropsInventario(scene, drop);
  scene.inventory.dropAll();
  scene.itemColetavelProximo = null;
  scene.botaoColetarItem?.setVisible(false);
  scene.botaoColetarItem?.disableInteractive();
  scene.botaoColetarItemVisivel = false;
}
