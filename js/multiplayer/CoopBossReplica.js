import { criarHudNovoBoss, atualizarHudNovoBoss, destruirHudNovoBoss } from "../enemies/novoBoss/NovoBossHud.js";
import { prepararCameraNovoBoss } from "../enemies/novoBoss/NovoBossCamera.js";
import { criarColisaoBarreiraNovoBoss } from "../enemies/novoBoss/NovoBossBarreiraColisao.js";
import { jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { invalidarCacheNavegacao } from "../enemies/EnemyPathfinding.js";
import BossIntroLighting from "../effects/BossIntroLighting.js";

const box = rect => rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
export function describeCombatTarget(target, id, sender) {
  const object = target.sprite || target.visual || target;
  return { id, visual: sender.id(object), vida: target.vida, vidaMaxima: target.vidaMaxima,
    hitbox: box(target.hitboxDano), body: box(target.body), active: target.active,
    morto: !!target.morto, torre: !!target.torre, tipoRobo: target.tipoRobo,
    direcaoAtual: target.direcaoAtual, estado: target.estado,
    spawnAreaRoboBolaId: target.spawnAreaRoboBolaId, prologoPortal: target.prologoPortal };
}

export function describeBoss(scene, sender) {
  const e = scene.novoBoss;
  if (!e?.sprite) return null;
  const shield = e.sistemaGeradores?.corpoBarreira;
  return { ...describeCombatTarget(e, "boss", sender), config: e.config,
    fase: e.fase, estado: e.estado, suspenso: e.suspenso, morto: e.morto,
    relogioCombate: e.relogioCombate, barreiraAtiva: e.barreiraAtiva,
    prologo: e.prologo?.snapshot(), intro: e.introducao?.snapshot(),
    introLighting: e.introducao?.iluminacao && Object.fromEntries(
      ["ativa", "progresso", "aura", "ambiente", "topo", "base", "revisao"].map(k => [k, e.introducao.iluminacao[k]])),
    shieldCharge: e.sistemaGeradores?.cargaEscudo,
    introAtiva: !!scene.cenaEntradaBossAtiva,
    shield: shield && { x: shield.x, y: shield.y, radius: shield.body?.radius,
      enabled: shield.body?.enable === true },
    alvos: (e.alvosIlusorios || []).map((a, i) => describeCombatTarget(a, `copia:${sender.id(a.sprite) || i}`, sender)),
    geradores: (e.geradores || []).map(g => ({ ...describeCombatTarget(g, `torre:${g.id}`, sender),
      idTiled: g.id, ligado: g.ligado, estadoGerador: g.estadoGerador,
      luzChoqueIdle: g.luzChoqueIdle,
      colisoes: (g.colisaoMapa?.corpos || []).map(b => ({ id: b.gameObject?.tiledCollisionId, enable: b.enable })) })),
    ilusoesAtivas: !!e.sistemaIlusoes?.ativo, clonesAtivos: !!e.sistemaClones?.ativo };
}

export class BossReplica {
  constructor(runtime) { this.runtime = runtime; this.scene = runtime.scene; this.encounter = null; }
  target(data) {
    const sprite = this.runtime.receiver.get(data.visual);
    const target = { ...data, sprite, x: sprite?.x, y: sprite?.y,
      visible: sprite?.visible !== false,
      hitboxDano: data.hitbox ? new Phaser.Geom.Rectangle(...Object.values(data.hitbox)) : null,
      body: data.body ? Object.assign(new Phaser.Geom.Rectangle(...Object.values(data.body)), { enable: data.active }) : null,
      receberDano: (amount, area, attack) => this.runtime.requestDamage(data.id, amount, area, attack) };
    if (sprite) {
      Object.defineProperties(target, { x: { get: () => sprite.x }, y: { get: () => sprite.y } });
    }
    return target;
  }
  receive(data) {
    if (!data) return;
    const s = this.scene;
    const target = this.target(data);
    if (!this.encounter) {
      this.encounter = { ...target, encerrado: false, jogadorNaArena: false, geradores: [], alvosIlusorios: [] };
      s.novoBoss = this.encounter;
      criarHudNovoBoss(this.runtime.localContext, this.encounter);
      this.camera = prepararCameraNovoBoss(this.runtime.localContext, this.encounter);
      this.lighting = new BossIntroLighting(data.config.arena);
    }
    const e = this.encounter;
    for (const [key, value] of Object.entries(target)) {
      if (key !== "x" && key !== "y") e[key] = value;
    }
    Object.assign(e, { config: data.config, fase: data.fase, estado: data.estado,
      barreiraAtiva: data.barreiraAtiva, suspenso: data.suspenso,
      relogioCombate: data.relogioCombate,
      geradores: data.geradores.map(g => ({ ...this.target(g), id: g.idTiled,
        visual: this.runtime.receiver.get(g.visual), luzChoqueIdle: g.luzChoqueIdle,
        ligado: g.ligado, estadoGerador: g.estadoGerador })),
      alvosIlusorios: data.alvos.map(a => this.target(a)),
      sistemaIlusoes: { ativo: data.ilusoesAtivas },
      sistemaClones: { ativo: data.clonesAtivos, alvos: data.alvos },
      prologo: data.prologo ? { bloqueiaCombatePrincipal: data.prologo.estado !== "COMBATE_PRINCIPAL",
        estado: data.prologo.estado, snapshot: () => data.prologo } : null });
    if (data.introLighting) Object.assign(this.lighting, data.introLighting);
    else this.lighting.restaurar();
    e.introducao = { iluminacao: this.lighting, snapshot: () => data.intro };
    e.sistemaGeradores = { cargaEscudo: data.shieldCharge,
      corpoBarreira: { enable: data.shield?.enabled } };
    e.x = e.sprite?.x; e.y = e.sprite?.y;
    let changed = false;
    const collisions = new Map(s.collisionGroup?.getChildren().map(o => [o.tiledCollisionId, o.body]));
    for (const g of data.geradores) for (const state of g.colisoes || []) {
      const body = collisions.get(state.id);
      if (body && body.enable !== state.enable) { body.enable = state.enable; changed = true; }
    }
    if (changed) invalidarCacheNavegacao(s);
    if (data.shield) {
      if (!this.shield) {
        this.shield = s.add.circle(data.shield.x, data.shield.y, data.shield.radius || 95, 0, 0).setVisible(false);
        s.physics.add.existing(this.shield, true);
        this.shield.body.setCircle(data.shield.radius || 95);
        this.shieldCollision = criarColisaoBarreiraNovoBoss(this.runtime.localContext, this.shield);
      }
      this.shield.setPosition(data.shield.x, data.shield.y);
      this.shield.body.updateFromGameObject();
      this.shield.body.enable = data.shield.enabled;
    }
  }
  update(delta) {
    const e = this.encounter;
    if (!e) return;
    e.x = e.sprite?.x; e.y = e.sprite?.y;
    e.jogadorNaArena = jogadorNaArenaNovoBoss(this.scene.player, e.config.arena);
    if (!this.scene.cenaEntradaBossAtiva && !this.runtime.world.introCamera) this.camera?.atualizar(delta);
    atualizarHudNovoBoss(this.runtime.localContext, e);
  }
  destroy() {
    this.shieldCollision?.destruir(); this.shield?.destroy(); this.camera?.destruir();
    if (this.encounter) {
      this.encounter.encerrado = true;
      destruirHudNovoBoss(this.encounter);
      if (this.scene.novoBoss === this.encounter) this.scene.novoBoss = null;
    }
    this.shieldCollision = this.shield = this.camera = this.lighting = null;
    this.encounter = null;
  }
}
