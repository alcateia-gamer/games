/** Queda e socorro exclusivos do solo. Não reinicia a cena nem o encontro. */
import { animarQuedaCoop } from "../multiplayer/CoopRevival.js";
import { respawnPlayer } from "./Player.js";
import { pararSomTensaoAria } from "../sounds/SOUNDS_PERSONAGENS.js/sounds_Aria.js";
import { consumirResgateSolo, resgatesSoloUsados, SOLO_PET_REVIVALS_MAX } from "./SoloRunState.js";

export const SOLO_PET_REVIVAL = Object.freeze({ quedaMs: 750, aproximacaoMs: 650,
  reanimacaoMs: 2200, protecaoMs: 2000 });

export function prepararReanimacaoSolo(scene) {
  if (scene.multiplayer || scene.coopRuntime) return null;
  if (scene.reanimacaoSolo && !scene.reanimacaoSolo.destruido) return scene.reanimacaoSolo;
  let fase = "pronto", tempo = 0, destruido = false;
  let anterior = null, posicao = null, destinoPet = null, origemPet = null;
  let finalizarMorte = null, podeResgatar = false, label = null, protecao = null;
  const restante = () => SOLO_PET_REVIVALS_MAX - resgatesSoloUsados(scene.registry ?? scene.game?.registry);
  const ativo = () => ["caindo", "aproximando", "reanimando"].includes(fase);

  function limparVisual() {
    label?.destroy(); label = null;
  }

  function restaurarEntrada() {
    if (!anterior) return;
    scene.movimentoBloqueado = anterior.movimento;
    if (scene.input) scene.input.enabled = anterior.input;
    if (scene.input?.keyboard) {
      scene.input.keyboard.resetKeys?.();
      scene.input.keyboard.enabled = anterior.teclado;
    }
    scene.joystick?.reset?.();
  }

  function derrota() {
    if (fase === "derrotado" || destruido) return;
    fase = "derrotado";
    limparVisual();
    // O overlay de derrota mantém o bloqueio e a física pausada.
    restaurarEntrada();
    const concluir = finalizarMorte;
    finalizarMorte = null;
    concluir?.();
  }

  function reanimar() {
    if (!scene.companionPet?.active || !consumirResgateSolo(scene.registry ?? scene.game?.registry)) {
      derrota(); return;
    }
    const player = scene.player;
    scene.morteEmAndamento = false;
    player.morto = false;
    player.setScale(anterior.escalaX, anterior.escalaY).setRotation(0).setAlpha(1).clearTint();
    player.body.enable = true;
    respawnPlayer(scene, posicao);
    player.body.updateFromGameObject();
    scene.estamina = Math.min(scene.estaminaMaxima,
      Number.isFinite(anterior.estamina) ? anterior.estamina : scene.estaminaMaxima);
    scene.tempoSemDano = 0;
    scene.combatHitStopRemaining = 0;
    player.invulneravel = true;
    player.novoBossRecapturaAte = scene.time.now + SOLO_PET_REVIVAL.protecaoMs;
    protecao = scene.time.delayedCall(SOLO_PET_REVIVAL.protecaoMs, () => {
      protecao = null;
      if (!destruido && scene.player === player && player.active && !player.morto) player.invulneravel = false;
    });
    const pet = scene.companionPet;
    pet.state = "IDLE"; pet.target = { x: pet.x, y: pet.y };
    pet.lastTargetAt = 0; pet.stuckTime = pet.recoveryTime = 0;
    pet.lastX = pet.x; pet.lastY = pet.y;
    pet.tempoParado = pet.tempoOlhar = 0; pet.olharAtivo = false;
    pet.setVelocity(0, 0);
    fase = "pronto";
    finalizarMorte = null;
    limparVisual();
    restaurarEntrada();
    if (!anterior.fisicaPausada) scene.physics.resume();
    scene.events?.emit("solo-pet:reanimado", { usados: SOLO_PET_REVIVALS_MAX - restante(), restantes: restante() });
  }

  function mostrarSocorro() {
    if (!podeResgatar || !scene.companionPet?.active) { derrota(); return; }
    fase = "aproximando"; tempo = 0;
    const pet = scene.companionPet;
    origemPet = { x: pet.x, y: pet.y };
    const lado = pet.x < posicao.x ? -1 : 1;
    destinoPet = { x: posicao.x + lado * 32, y: posicao.y + 8 };
    label?.setText(`ROBÔ EM RESGATE · ${restante()} RESTANTE${restante() > 1 ? "S" : ""}`);
    pet.anims?.play?.(`companion-pet-walk-${lado < 0 ? "right" : "left"}`, true);
  }

  const sistema = {
    get ativo() { return ativo(); },
    get destruido() { return destruido; },
    get restantes() { return restante(); },
    iniciar(aoDerrotar) {
      if (destruido || scene.multiplayer || scene.coopRuntime || scene.telaMorteMostrada ||
          scene.morteEmAndamento || !scene.player?.active) return false;
      const player = scene.player;
      anterior = { movimento: !!scene.movimentoBloqueado,
        input: scene.input?.enabled ?? true, teclado: scene.input?.keyboard?.enabled ?? true,
        escalaX: player.baseScaleX ?? player.scaleX, escalaY: player.baseScaleY ?? player.scaleY,
        estamina: scene.estamina, fisicaPausada: !!scene.physics.world?.isPaused };
      posicao = { x: player.x, y: player.y };
      podeResgatar = restante() > 0 && !!scene.companionPet?.active;
      finalizarMorte = aoDerrotar;
      protecao?.remove(false); protecao = null;
      scene.morteEmAndamento = true; scene.movimentoBloqueado = true; scene.vida = 0;
      player.morto = true; player.invulneravel = true;
      player.setVelocity(0, 0); player.body.enable = false;
      scene.restricaoControleNovoBoss = null;
      scene.atacando = false; scene.attackBufferedUntil = 0; scene.attackPhase = "normal";
      scene.ariaAttackJoystick?.cancelar(); scene.joystick?.reset?.();
      pararSomTensaoAria(scene);
      scene.ariaAtaqueCarregando = false; scene.ariaCargaInicio = null; scene.direcaoAtaque = null;
      if (scene.estadoDash) scene.estadoDash.ativo = false;
      player.combatKnockbackUntil = 0;
      scene.somCorrida?.stop(); scene.companionPet?.setVelocity(0, 0);
      scene.tweens?.killTweensOf(player);
      player.setScale(anterior.escalaX, anterior.escalaY);
      player.anims.timeScale = 1;
      if (scene.input) scene.input.enabled = false;
      if (scene.input?.keyboard) {
        scene.input.keyboard.resetKeys?.(); scene.input.keyboard.enabled = false;
      }
      scene.physics.pause();
      animarQuedaCoop(scene);
      fase = "caindo"; tempo = 0;
      label = scene.add.text(posicao.x, posicao.y - 42, podeResgatar ? "OPERADOR CAÍDO" : "SEM RESGATES", {
        fontFamily: "monospace", fontSize: "12px", color: "#b7f5ff", align: "center",
        backgroundColor: "#101827dd", padding: { x: 6, y: 4 },
      }).setOrigin(0.5, 1).setDepth(90).setName("solo-pet-revive-label");
      scene.events?.emit("solo-pet:caido", { restantes: restante(), resgatavel: podeResgatar });
      return true;
    },
    atualizar(delta) {
      if (!ativo() || destruido) return false;
      if (!scene.player?.active) { sistema.destruir(); return true; }
      if (!Number.isFinite(delta) || delta < 0) return true;
      tempo += Math.min(delta, 100);
      if (fase === "caindo") {
        if (tempo >= SOLO_PET_REVIVAL.quedaMs) mostrarSocorro();
      } else if (fase === "aproximando") {
        if (!scene.companionPet?.active) { derrota(); return true; }
        const p = Math.min(1, tempo / SOLO_PET_REVIVAL.aproximacaoMs), suave = p * p * (3 - 2 * p);
        const pet = scene.companionPet;
        pet.body.reset(origemPet.x + (destinoPet.x - origemPet.x) * suave,
          origemPet.y + (destinoPet.y - origemPet.y) * suave);
        pet.body.updateFromGameObject();
        if (p >= 1) { fase = "reanimando"; tempo = 0; pet.setVelocity(0, 0); }
      } else if (fase === "reanimando") {
        if (!scene.companionPet?.active) { derrota(); return true; }
        const p = Math.min(1, tempo / SOLO_PET_REVIVAL.reanimacaoMs);
        label.setText(`REANIMANDO · ${Math.round(p * 100)}% · ${SOLO_PET_REVIVALS_MAX - restante() + 1}/2`);
        if (p >= 1) reanimar();
      }
      return true;
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      if (protecao && scene.player?.active && !scene.player.morto) scene.player.invulneravel = false;
      protecao?.remove(false); protecao = null;
      limparVisual();
      if (ativo()) restaurarEntrada();
      finalizarMorte = null; fase = "encerrado";
      scene.events?.off("shutdown", sistema.destruir);
      if (scene.reanimacaoSolo === sistema) scene.reanimacaoSolo = null;
    },
    snapshot() { return { fase, tempo, restantes: restante(), ativo: ativo(), destruido }; },
  };
  scene.reanimacaoSolo = sistema;
  scene.events?.once("shutdown", sistema.destruir);
  return sistema;
}

export function atualizarReanimacaoSolo(scene, delta) {
  return !scene.multiplayer && !scene.coopRuntime && !!scene.reanimacaoSolo?.atualizar(delta);
}
