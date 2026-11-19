import { atualizarCompanionPet, criarCompanionPet } from "../player/CompanionPet.js";
import { criarFalaFlutuante } from "../ui/PlayerSpeechBubble.js";

/** Mantém a instância do host e associa a fala à réplica do mesmo sprite. */
export class CoopNova {
  constructor(runtime) {
    this.runtime = runtime;
    this.scene = runtime.scene;
    this.falas = new Map();
    this.authority(runtime.host);
  }

  authority(host) {
    this.clearReplica();
    if (host && !this.pet?.active) {
      const pet = this.pet = criarCompanionPet(this.scene);
      pet.body.checkCollision.none = true;
      pet.coopNova = true;
    } else if (!host && this.pet) {
      this.removePet();
      for (const fala of this.scene.coopSpeechBubbles?.values() ?? []) {
        if (fala.snapshot()?.falante === "nova") fala.ocultar();
      }
    }
  }

  removePet() {
    if (this.scene.companionPet === this.pet) this.scene.companionPet = null;
    this.pet?.destroy();
    this.pet = null;
  }

  snapshot() {
    if (!this.pet?.active) return null;
    const speech = [];
    for (const fala of this.scene.coopSpeechBubbles?.values() ?? []) {
      const state = fala.snapshot();
      if (state?.falante === "nova") {
        const { ancora, ...line } = state;
        speech.push(line);
      }
    }
    return { visual: this.runtime.sender.id(this.pet), speech };
  }

  receive(state) {
    const visual = this.runtime.receiver.get(state?.visual);
    this.visual = visual?.texture?.key === "robo-pet" ? visual : null;
    this.visualId = this.visual ? state.visual : null;
    const visible = new Set();
    if (this.visual && Array.isArray(state.speech)) {
      for (const line of state.speech.slice(0, 8)) {
        if (!line || line.falante !== "nova" || typeof line.nome !== "string" ||
            !/^[a-z0-9-]{1,60}$/.test(line.nome) || typeof line.frase !== "string" ||
            line.frase.length > 600 || !Number.isSafeInteger(line.versao) || line.versao < 1) continue;
        let entry = this.falas.get(line.nome);
        if (!entry) {
          if (this.falas.size >= 8) continue;
          const bubble = criarFalaFlutuante(this.scene, `coop-nova-${line.nome}`, {
            replica: true, falante: "nova", ancoraPet: () => this.visual,
          });
          entry = { bubble, version: 0 };
          this.falas.set(line.nome, entry);
        }
        visible.add(line.nome);
        if (line.versao <= entry.version) continue;
        entry.version = line.versao;
        entry.bubble.aplicarEstadoRede(line);
      }
    }
    for (const [name, { bubble }] of this.falas) if (!visible.has(name)) bubble.ocultar();
  }

  update(time, delta) {
    if (this.runtime.host) {
      if (this.runtime.manager?.mqtt?.connected === false) this.pet?.setVelocity(0, 0);
      else atualizarCompanionPet(this.scene, time, delta);
    } else {
      for (const { bubble } of this.falas.values()) bubble.atualizar();
    }
  }

  clearReplica() {
    if (this.visualId) this.runtime.receiver.remove(this.visualId);
    this.visualId = null;
    this.visual = null;
    for (const { bubble } of this.falas.values()) bubble.destroy();
    this.falas.clear();
  }

  destroy() {
    this.clearReplica();
    this.removePet();
  }
}
