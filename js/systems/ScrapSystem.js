import { criarCanvasHUDNitido } from '../ui/HudCanvas.js';
import { SCRAP_BALANCE, rollScrap, UPGRADE_NPC } from './UpgradeBalance.js';
import { economyFor, localPlayerId, playerAccount, purchase, applyUpgrades, accountFor } from './UpgradeSystem.js';

// Recortes das 12 variações de sucatas.png, sem as margens transparentes.
const SCRAP_FRAMES = [[112, 74, 32, 48], [367, 71, 34, 54], [623, 75, 34, 45], [110, 267, 36, 54], [368, 271, 32, 45], [621, 268, 37, 52], [106, 471, 43, 38], [371, 471, 25, 38], [619, 471, 41, 38], [104, 664, 48, 43], [354, 661, 59, 50], [627, 669, 26, 34]];
const COUNTER_FRAME = 10; // Meio da última linha.
function scrapVariant(id) {
  let hash = 0;
  for (const character of String(id)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % SCRAP_FRAMES.length; // Mesmo componente tem a mesma aparência em todos os clientes.
}

export function claimScrap(economy, id, playerId, character, mapKey, position) {
  const drop = economy.drops[id];
  if (!drop || drop.mapKey !== mapKey || !position || Math.hypot(position.x - drop.x, position.y - drop.y) > 62) return 0;
  // Retira antes de creditar: duas solicitações não podem receber o mesmo componente.
  delete economy.drops[id];
  playerAccount(economy, playerId, character).scrap += drop.quantity;
  economy.revision++;
  return drop.quantity;
}
export function canUseShop(context, mapKey) {
  return mapKey === 'Level1' && context?.player?.active && context.vida > 0 && !context.morteEmAndamento &&
    Math.hypot(context.player.x - UPGRADE_NPC.x, context.player.y - UPGRADE_NPC.y) <= UPGRADE_NPC.range;
}

/** Um componente representa várias unidades. Não cria corpos ou colisores extras. */
export class ScrapSystem {
  constructor(scene) {
    this.scene = scene; this.visuals = new Map(); this.pending = new Map();
    const texture = scene.textures.get('scrap-components');
    SCRAP_FRAMES.forEach((rect, index) => {
      const name = `scrap-${index}`;
      if (!texture.has(name)) texture.add(name, 0, ...rect);
    });
    const [, , iconWidth, iconHeight] = SCRAP_FRAMES[COUNTER_FRAME];
    this.counterIcon = scene.add.image(28, 142, 'scrap-components', `scrap-${COUNTER_FRAME}`)
      .setDisplaySize(32, 32 * iconHeight / iconWidth).setScrollFactor(0).setDepth(222).setName('scrap-balance-icon');
    // Desenha da imagem original na densidade da tela, evitando ampliar o ícone
    // já reduzido no canvas de 800×450 do mundo.
    this.counterIconView = criarCanvasHUDNitido(scene, 32, 28, 222);
    if (this.counterIconView) {
      this.counterIcon.setVisible(false);
      const view = this.counterIconView, frame = texture.get(`scrap-${COUNTER_FRAME}`);
      view.object.setPosition(12, 128).setName('scrap-balance-icon-native');
      this.refreshCounterIcon = () => {
        if (!view.atualizarResolucao()) return;
        view.limpar();
        view.context.imageSmoothingEnabled = true;
        view.context.imageSmoothingQuality = 'high';
        view.context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
          0, (28 - 32 * iconHeight / iconWidth) / 2, 32, 32 * iconHeight / iconWidth);
      };
      this.refreshCounterIcon();
      scene.scale.on('resize', this.refreshCounterIcon);
    }
    this.counter = scene.add.text(52, 130, `SUCATAS: ${accountFor(scene).scrap}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#55ffad', backgroundColor: '#020b08', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(221).setName('scrap-balance');
    this.seen = new WeakSet(); this.lastRevision = -1; this.lastBalance = accountFor(scene).scrap;
    this.update = this.update.bind(this); this.destroy = this.destroy.bind(this);
    scene.events.on('update', this.update); scene.events.once('shutdown', this.destroy);
  }
  get mapKey() { return this.scene.sys.settings.key; }
  get authority() { return !this.scene.multiplayer || this.scene.coopRuntime?.host; }
  changed() {
    const s = this.scene;
    this.lastRevision = -1;
    if (s.coopRuntime?.host) {
      s.coopRuntime.manager.sendCoopAction('upgradeState', { economy: economyFor(s) }, { authority: true });
      s.coopRuntime.forceKeyframe = true;
    }
    s.events.emit('upgradesChanged');
  }
  onRobotDeath(enemy) {
    if (!this.authority || this.seen.has(enemy) || enemy.remoteOnly) return;
    this.seen.add(enemy);
    // Apenas spawns da campanha pagam. Atalhos de desenvolvimento não geram moeda.
    const zoneId = enemy.upgradeZoneId ?? enemy.spawnAreaRoboBolaId;
    if (zoneId == null) return;
    const e = economyFor(this.scene), zone = `${this.mapKey}:${zoneId}`;
    const quota = this.mapKey === 'Level1' ? SCRAP_BALANCE.maxPerZone : 7;
    if ((e.zones[zone] || 0) >= quota || e.rewarded >= SCRAP_BALANCE.maxCampaign) return;
    e.zones[zone] = (e.zones[zone] || 0) + 1; e.rewarded++; e.revision++;
    const quantity = rollScrap(enemy.tipoRobo);
    if (quantity) {
      const id = `scrap:${++e.sequence}`;
      const ids = Object.keys(e.drops);
      if (ids.length >= SCRAP_BALANCE.maxDrops) delete e.drops[ids[0]];
      e.drops[id] = { id, mapKey: this.mapKey, x: enemy.x, y: enemy.y, quantity };
    }
    this.changed();
  }
  requestPurchase(id, level) {
    const s = this.scene;
    if (!canUseShop(s, this.mapKey)) return false;
    if (s.multiplayer && !s.coopRuntime) return false;
    if (!this.authority) return s.coopRuntime.manager.sendCoopAction('upgradeBuy', { id, level });
    return this.buy(localPlayerId(s), s, id, level);
  }
  buy(playerId, context, id, level) {
    if (!canUseShop(context, this.mapKey)) return false;
    const result = purchase(economyFor(this.scene), playerId, context.personagemSelecionada, id, level);
    if (result.ok) {
      if (!context.coopRemotePlayerId) applyUpgrades(context);
      this.changed();
    }
    if (playerId === localPlayerId(this.scene)) this.scene.events.emit('upgradeResult', result);
    else this.scene.coopRuntime.manager.sendCoopAction('upgradeResult', result, { authority: true, targetId: playerId });
    return result.ok;
  }
  receive(action) {
    if (!['scrapClaim','upgradeBuy','upgradeState','upgradeResult'].includes(action.kind)) return false;
    const s = this.scene, r = s.coopRuntime, p = action.payload || {};
    if (action.authority) {
      if (action.kind === 'upgradeState') this.restore(p.economy);
      if (action.kind === 'upgradeResult') s.events.emit('upgradeResult', p);
    } else if (this.authority) {
      const context = action.playerId === localPlayerId(s) ? s : r.players.remotes.get(action.playerId)?.context;
      if (!context || context.vida <= 0 || context.morteEmAndamento) return true;
      if (action.kind === 'upgradeBuy') this.buy(action.playerId, context, p.id, p.level);
      if (action.kind === 'scrapClaim' && claimScrap(economyFor(s), p.id, action.playerId,
        context.personagemSelecionada, this.mapKey, context.player)) this.changed();
    }
    return true;
  }
  restore(incoming) {
    if (!incoming || !Number.isSafeInteger(incoming.revision) || incoming.revision <= economyFor(this.scene).revision) return;
    this.scene.multiplayerManager.room.upgradeEconomy = incoming;
    applyUpgrades(this.scene); this.lastRevision = -1;
    this.scene.events.emit('upgradesChanged');
  }
  syncVisuals() {
    const s = this.scene, e = economyFor(s);
    if (this.lastRevision === e.revision) return;
    this.lastRevision = e.revision;
    applyUpgrades(s);
    this.counter?.setText(`SUCATAS: ${accountFor(s).scrap}`);
    for (const [id, image] of this.visuals) if (!e.drops[id] || e.drops[id].mapKey !== this.mapKey) {
      s.tweens.killTweensOf(image); image.destroy(); this.visuals.delete(id); this.pending.delete(id);
    }
    for (const drop of Object.values(e.drops)) if (drop.mapKey === this.mapKey && !this.visuals.has(drop.id)) {
      const variant = scrapVariant(drop.id);
      const [, , width, height] = SCRAP_FRAMES[variant];
      const scale = 28 / Math.max(width, height);
      const image = s.add.image(drop.x, drop.y, 'scrap-components', `scrap-${variant}`)
        .setDisplaySize(width * scale, height * scale).setDepth(s.calcularDepthMundo?.(drop.y) ?? 100);
      image.coopLocalVisual = true;
      s.tweens.add({ targets: image, alpha: .5, duration: 850, yoyo: true, repeat: -1 });
      this.visuals.set(drop.id, image);
    }
    const balance = accountFor(s).scrap;
    if (balance > this.lastBalance && s.player?.active) {
      const text = s.add.text(s.player.x, s.player.y - 44, `+${balance - this.lastBalance} SUCATAS`,
        { fontFamily: 'monospace', fontSize: '12px', color: '#55ffad', stroke: '#020b08', strokeThickness: 3 }).setDepth(300).setOrigin(.5);
      text.coopLocalVisual = true;
      s.tweens.add({ targets: text, y: text.y - 24, alpha: 0, duration: 900, onComplete: () => text.destroy() });
    }
    this.lastBalance = balance;
    s.events.emit('upgradesChanged');
  }
  update() {
    this.syncVisuals();
    const s = this.scene;
    if (!s.player?.active || s.vida <= 0 || s.morteEmAndamento || s.upgradeMenuOpen) return;
    for (const [id] of this.visuals) {
      const drop = economyFor(s).drops[id];
      if (!drop || Math.hypot(s.player.x - drop.x, s.player.y - drop.y) > 46) continue;
      if (this.authority) {
        if (claimScrap(economyFor(s), id, localPlayerId(s), s.personagemSelecionada, this.mapKey, s.player)) this.changed();
      } else if (s.coopRuntime && (this.pending.get(id) ?? -Infinity) <= s.time.now) {
        this.pending.set(id, s.time.now + 1000);
        s.coopRuntime.manager.sendCoopAction('scrapClaim', { id });
      }
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const s = this.scene;
    s.events.off('shutdown', this.destroy);
    s.events.off('update', this.update);
    for (const image of this.visuals.values()) { s.tweens.killTweensOf(image); image.destroy(); }
    this.visuals.clear(); this.pending.clear(); this.counter?.destroy(); this.counterIcon?.destroy();
    if (this.refreshCounterIcon) s.scale.off('resize', this.refreshCounterIcon);
    this.counterIconView?.destroy();
    if (s.scrapSystem === this) s.scrapSystem = null;
  }
}
