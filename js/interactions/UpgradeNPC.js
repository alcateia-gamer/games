import { calcularDepthAtor } from '../map/ProfundidadeMapa.js';
import { UPGRADE_NPCS } from '../systems/UpgradeBalance.js';
import { canUseShop } from '../systems/ScrapSystem.js';
import { UpgradeShopUI } from '../ui/UpgradeShopUI.js';

export function createUpgradeNPC(scene) {
  const mapKey = scene.sys.settings.key;
  const config = UPGRADE_NPCS[mapKey];
  if (!config) return null;
  const { x, y, frame } = config;
  // Coordenadas de mundo do mapa infinito: não há offset nem conversão de tiles.
  const npc = scene.add.sprite(x, y, 'upgrade-npc', frame).setName('upgrade-merchant');
  const updateDepth = () => npc.setDepth(Number.isFinite(scene.profundidadePersonagemParte2)
    ? calcularDepthAtor(scene, y + 28, npc) : scene.calcularDepthMundo?.(y + 28) ?? 12);
  updateDepth();
  npc.coopLocalVisual = true; // NPC estático criado em cada cliente; nunca um inimigo.
  const shop = scene.upgradeShop = new UpgradeShopUI(scene);
  const open = () => canUseShop(scene, mapKey) && shop.open();
  const update = () => {
    updateDepth();
    npc.setVisible(!(mapKey === 'Level1Parte2' && scene.fabricaDescarregada));
    const near = canUseShop(scene, mapKey) && !scene.transicaoEmAndamento;
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
