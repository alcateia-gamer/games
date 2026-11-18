const CHAVE_SOLO = "relogioPartidaSolo";
const CHAVE_COOP = "relogioPartidaCoop";

class RelogioPartida {
  constructor(agora, estado) {
    this.inicio = agora - (estado?.decorridoMs ?? 0);
    this.resultado = estado?.resultado ?? null;
    this.pausas = new Set();
    this.pausadoEm = null;
  }

  decorrido(agora) {
    return this.resultado?.tempoMs ?? Math.max(0, (this.pausadoEm ?? agora) - this.inicio);
  }

  definirPausa(agora, motivo, pausado) {
    if (pausado) {
      this.pausas.add(motivo);
      this.pausadoEm ??= agora;
    } else if (this.pausas.delete(motivo) && !this.pausas.size) {
      this.inicio += agora - this.pausadoEm;
      this.pausadoEm = null;
    }
  }

  concluir(agora) {
    if (this.resultado) return null;
    this.resultado = Object.freeze({ tempoMs: Math.floor(this.decorrido(agora)), tijolinhos: null });
    return this.resultado;
  }
}

const chave = scene => scene.multiplayer ? CHAVE_COOP : CHAVE_SOLO;
const relogioLocal = scene => scene.registry?.get(chave(scene));
const progressoCoop = scene => scene.multiplayerManager?.room?.coopProgress;
const replica = scene => scene.multiplayer && !scene.coopRuntime?.host;

function criarRelogio(scene, estado) {
  scene.registry.set(chave(scene), new RelogioPartida(scene.game.getTime(), estado));
}

export function reiniciarRelogioPartida(registry) {
  registry.remove(CHAVE_SOLO);
  registry.remove(CHAVE_COOP);
}

export function definirPausaRelogioSolo(scene, motivo, pausado) {
  if (!scene.multiplayer) relogioLocal(scene)?.definirPausa(scene.game.getTime(), motivo, pausado);
}

export function iniciarRelogioSolo(scene) {
  if (scene.multiplayer) return;
  if (!relogioLocal(scene)) criarRelogio(scene);

  const pausarCena = () => definirPausaRelogioSolo(scene, "cena", true);
  const retomarCena = () => definirPausaRelogioSolo(scene, "cena", false);
  const pausarJogo = () => definirPausaRelogioSolo(scene, "jogo", true);
  const retomarJogo = () => definirPausaRelogioSolo(scene, "jogo", false);
  const eventos = [
    [scene.events, "pause", pausarCena], [scene.events, "resume", retomarCena],
    [scene.events, "sleep", pausarCena], [scene.events, "wake", retomarCena],
    [scene.game.events, "pause", pausarJogo], [scene.game.events, "resume", retomarJogo],
  ];
  for (const [emissor, evento, callback] of eventos) emissor.on(evento, callback);
  scene.events.once("shutdown", () => {
    for (const [emissor, evento, callback] of eventos) emissor.off(evento, callback);
    retomarCena();
    retomarJogo();
  });
}

export function iniciarRelogioCoop(scene, migracao = false) {
  if (migracao || !relogioLocal(scene)) criarRelogio(scene, progressoCoop(scene)?.relogio);
}

export function atualizarRelogioCoop(scene) {
  const relogio = relogioLocal(scene);
  if (relogio) progressoCoop(scene).relogio = {
    decorridoMs: Math.floor(relogio.decorrido(scene.game.getTime())),
    ...(relogio.resultado && { resultado: relogio.resultado }),
  };
}

export function tempoPartida(scene) {
  if (replica(scene)) return progressoCoop(scene)?.relogio?.decorridoMs ?? 0;
  return relogioLocal(scene)?.decorrido(scene.game.getTime()) ?? 0;
}

export function resultadoPartida(scene) {
  return replica(scene) ? progressoCoop(scene)?.relogio?.resultado : relogioLocal(scene)?.resultado;
}

export function concluirPartida(scene) {
  if (replica(scene)) return null;
  const resultado = relogioLocal(scene)?.concluir(scene.game.getTime());
  if (resultado && scene.multiplayer) atualizarRelogioCoop(scene);
  return resultado;
}

export function formatarTempoPartida(ms) {
  const segundos = Math.floor(ms / 1000);
  const horas = Math.floor(segundos / 3600);
  const doisDigitos = n => String(n).padStart(2, "0");
  const minutos = doisDigitos(Math.floor(segundos / 60) % 60);
  const restante = doisDigitos(segundos % 60);
  return horas ? `${doisDigitos(horas)}:${minutos}:${restante}` : `${minutos}:${restante}`;
}
