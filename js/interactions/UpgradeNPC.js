import { UPGRADE_NPC } from '../systems/UpgradeBalance.js';
import { canUseShop } from '../systems/ScrapSystem.js';
import { UpgradeShopUI } from '../ui/UpgradeShopUI.js';

export function createUpgradeNPC(scene) {
  const { x, y, frame } = UPGRADE_NPC;
  // Coordenadas de mundo do mapa infinito: não há offset nem conversão de tiles.
  const npc = scene.add.sprite(x, y, 'upgrade-npc', frame).setName('upgrade-merchant');
  npc.setDepth(scene.calcularDepthMundo?.(y + 28) ?? 12);
  npc.coopLocalVisual = true; // NPC estático criado em cada cliente; nunca um inimigo.
  const shop = scene.upgradeShop = new UpgradeShopUI(scene);
  const open = () => canUseShop(scene, 'Level1') && shop.open();
  const update = () => {
    const near = canUseShop(scene, 'Level1') && !scene.transicaoEmAndamento;
    scene.interacaoCiberneticasProxima = near && !scene.upgradeMenuOpen ? {
      distance: Math.hypot(scene.player.x - x, scene.player.y - y),
      interact: open,
    } : null;
    if (!near && scene.upgradeMenuOpen) shop.close();
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    scene.interacaoCiberneticasProxima = null;
    npc.destroy(); scene.upgradeShop = null;
  });
  return { npc, shop };
}
