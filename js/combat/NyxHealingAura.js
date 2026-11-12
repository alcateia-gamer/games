import { recuperarVida } from '../player/PlayerStatus.js';
import { tocarSomAuraNyx } from '../sounds/SOUNDS_PERSONAGENS.js/sounds_Nyx,.js';
import { criarEfeitoEspecial, atualizarEfeitoEspecial, deslocamentoChao } from './SpecialAbilityEffects.js';
import { criarParticulasCuraNyx, atualizarParticulasCuraNyx, destruirParticulasCuraNyx } from './NyxHealingParticles.js';

// O anel completo do GIF tem 240×72px: a área segue essa elipse, sem círculo extra.
export const NYX_AURA = Object.freeze({ raio:120, raioY:36, animacao:1200,
  duracao:10000, cooldown:20000, intervalo:1000, fracao:.05 });
let sequencia = 0;
const mapa = scene => scene.sys?.settings?.key || scene.scene?.key;

function iniciarSomSincronizado(scene, id, fase, inicio) {
  const idadeMs = Math.max(0, scene.time.now - inicio);
  const duracaoMs = fase === 'cura' ? NYX_AURA.duracao : NYX_AURA.animacao;
  if (idadeMs >= duracaoMs) return;
  const parar = tocarSomAuraNyx(scene, { id, duracaoMs, idadeMs, fase });
  if (!scene.coopRuntime?.host) return parar;
  const enviar = stop => scene.coopRuntime.manager.sendCoopAction('nyxAuraSound',
    { mapKey: mapa(scene), id, fase, startedAt: Date.now() - idadeMs, stop }, { authority: true });
  enviar(false);
  return () => { parar?.(); enviar(true); };
}

function criarAura(scene, id, inicio, dono = null) {
  const pararSom = iniciarSomSincronizado(scene, id, 'invocacao', inicio);
  const efeito = criarEfeitoEspecial(scene,'nyx',NYX_AURA.raio);
  if (efeito) efeito.sprite.coopAnchor = scene.player;
  return { id, inicio, dono, efeito, pararSom, encerrada:false };
}

export function prepararAuraNyx(scene, estado) {
  estado.aurasRemotas = new Map();
  estado.curasNyx = new Map();
  const receber = room => {
    if (scene.coopRuntime) return;
    const proprio = room?.players?.find(p=>p.id===scene.multiplayerManager?.playerId);
    estado.redeRecargaAte = scene.time.now + Math.max(0,
      (proprio?.nyxAuraCooldownUntil || 0)-(room?.serverTime || Date.now()));
    const ids = new Set();
    for (const player of room?.players || []) {
      const aura = player.nyxAura;
      if (player.id === scene.multiplayerManager?.playerId || player.character !== 'nyx' ||
        !aura || aura.mapKey !== mapa(scene)) continue;
      ids.add(player.id);
      const anterior = estado.aurasRemotas.get(player.id);
      if (anterior?.id === aura.id) continue; // Heartbeats nunca reiniciam a cura.
      destruirAura(anterior);
      const idade = Math.max(0,(room.serverTime || Date.now())-aura.startedAt);
      if (idade >= NYX_AURA.animacao) {
        // Sem ter presenciado a seleção, um pacote antigo não pode conceder cura.
        estado.aurasRemotas.set(player.id,{id:aura.id,encerrada:true,efeito:null});
        continue;
      }
      const nova = criarAura(scene,aura.id,scene.time.now-idade,player.id);
      nova.posicao = {x:player.x,y:player.y};
      estado.aurasRemotas.set(player.id,nova);
    }
    for (const [id,aura] of estado.aurasRemotas) {
      if (!ids.has(id)) { destruirAura(aura); estado.aurasRemotas.delete(id); }
    }
  };
  estado.receberAuraNyx = receber;
  estado.verificarVidaAura = () => {
    if (estado.auraNyx && (!scene.player?.active || scene.morteEmAndamento || scene.vida <= 0)) {
      encerrarLocal(scene,estado);
    }
    if (!jogadorVivo(scene)) {
      for (const [id,cura] of estado.curasNyx) {
        cura.alvos.delete(scene.player);
        cura.visuais.get(scene.player)?.grafico.destroy();
        cura.visuais.delete(scene.player);
        if (!cura.alvos.size && !cura.visuais.size) encerrarCura(estado,id,cura);
      }
    }
  };
  scene.events.on('preupdate',estado.verificarVidaAura);
  estado.atualizarVisuaisCuraNyx = () => {
    atualizarVisuaisCura(scene,estado);
    if (estado.auraNyx && scene.player?.active)
      posicionarAura(scene,estado.auraNyx,scene.player,Math.max(0,scene.time.now-estado.auraNyx.inicio));
  };
  scene.events.on('postupdate',estado.atualizarVisuaisCuraNyx);
  if (scene.multiplayer) {
    scene.multiplayerManager?.on('roomUpdated',receber);
    receber(scene.multiplayerManager?.room);
  }
}

export function iniciarAuraNyx(scene, estado) {
  const id = `${scene.multiplayerManager?.playerId || 'solo'}:${Date.now()}:${++sequencia}`;
  estado.auraNyx = criarAura(scene,id,scene.time.now);
  if (scene.multiplayer && !scene.coopRuntime) scene.multiplayerManager?.publishAction({type:'nyx_aura',
    playerId:scene.multiplayerManager.playerId, id, mapKey:mapa(scene)});
}

function destruirAura(aura) {
  aura?.pararSom?.();
  if (aura) aura.pararSom = null;
  aura?.efeito?.sprite.destroy();
  if (aura) { aura.efeito = null; aura.encerrada = true; }
}

function encerrarLocal(scene,estado,avisar = true) {
  const aura = estado.auraNyx;
  if (!aura) return;
  if (scene.multiplayer && !scene.coopRuntime && avisar) scene.multiplayerManager?.publishAction({type:'nyx_aura',stop:true,
    playerId:scene.multiplayerManager.playerId,id:aura.id});
  destruirAura(aura);
  estado.auraNyx = null;
}

function dentroDaAura(alvo,centro) {
  return ((alvo.x-centro.x)/NYX_AURA.raio)**2 +
    ((alvo.y-centro.y)/NYX_AURA.raioY)**2 <= 1;
}

function jogadorVivo(scene) {
  return scene.player?.active && !scene.morteEmAndamento && scene.vida > 0 &&
    Number.isFinite(scene.vidaMaxima);
}

function concederCura(scene,estado,aura,centro) {
  const alvos = new Set();
  if (jogadorVivo(scene) && dentroDaAura(scene.player,centro)) alvos.add(scene.player);
  if ((!scene.multiplayer || scene.coopRuntime) && !aura.dono) {
    const aliados = scene.aliados?.getChildren?.() || scene.aliados || [];
    for (const aliado of aliados instanceof Map ? aliados.values() : aliados) {
      if (aliado?.active && !aliado.morto && aliado.vida > 0 && Number.isFinite(aliado.vidaMaxima) &&
        dentroDaAura(aliado,centro)) alvos.add(aliado);
    }
  }
  const visuais = new Map();
  const beneficiariosVisuais = new Set(alvos);
  // A vida remota continua pertencendo ao outro cliente. Aqui só há feedback visual.
  if (scene.multiplayer) for (const remoto of scene.remotePlayers?.values() || []) {
    if (remoto.active && dentroDaAura(remoto,centro)) beneficiariosVisuais.add(remoto);
  }
  for (const alvo of beneficiariosVisuais) {
    const efeito = criarParticulasCuraNyx(scene,alvo);
    if (efeito) visuais.set(alvo,efeito);
  }
  if (alvos.size || visuais.size) {
    const inicio = aura.inicio + NYX_AURA.animacao;
    const pararSom = iniciarSomSincronizado(scene, `${aura.id}:cura`, 'cura', inicio);
    estado.curasNyx.set(aura.id,{alvos,visuais,inicio,ultimoPulso:0,pararSom});
  }
}

function encerrarCura(estado,id,cura) {
  cura.pararSom?.();
  destruirParticulasCuraNyx(cura);
  estado.curasNyx.delete(id);
}

function atualizarVisuaisCura(scene,estado) {
  for (const [id,cura] of estado.curasNyx) {
    const elapsed = Math.max(0,scene.time.now-cura.inicio);
    for (const [alvo,efeito] of cura.visuais) {
      if (!atualizarParticulasCuraNyx(scene,efeito,elapsed)) cura.visuais.delete(alvo);
    }
    if (!cura.alvos.size && !cura.visuais.size) encerrarCura(estado,id,cura);
  }
}

function atualizarCuras(scene,estado) {
  for (const [id,cura] of estado.curasNyx) {
    const elapsed = Math.max(0,scene.time.now-cura.inicio);
    const pulso = Math.min(10,Math.floor(elapsed/NYX_AURA.intervalo));
    for (const alvo of cura.alvos) {
      const local = alvo === scene.player;
      if (local ? !jogadorVivo(scene) : !alvo.active || alvo.morto || !(alvo.vida > 0)) {
        cura.alvos.delete(alvo);
        cura.visuais.get(alvo)?.grafico.destroy();
        cura.visuais.delete(alvo);
        continue;
      }
      if (pulso <= cura.ultimoPulso) continue;
      // Após receber o efeito, afastar-se da Nyx não interrompe os pulsos.
      if (local) recuperarVida(scene,scene.vidaMaxima*NYX_AURA.fracao);
      else alvo.vida = Math.min(alvo.vidaMaxima,alvo.vida+alvo.vidaMaxima*NYX_AURA.fracao);
    }
    cura.ultimoPulso = pulso;
    if (elapsed >= NYX_AURA.duracao || (!cura.alvos.size && !cura.visuais.size)) {
      encerrarCura(estado,id,cura);
    }
  }
}

function posicionarAura(scene, aura, centro, elapsed) {
  const depth = (centro.depth ?? scene.player.depth ?? 10)-.06;
  const yChao = centro.y+deslocamentoChao(scene);
  atualizarEfeitoEspecial(aura.efeito,centro.x,yChao,elapsed,depth+.01);
}

function atualizarAura(scene, estado, aura, centro) {
  const elapsed = Math.max(0,scene.time.now-aura.inicio);
  if (elapsed >= NYX_AURA.animacao) {
    concederCura(scene,estado,aura,centro);
    destruirAura(aura);
    return false;
  }
  posicionarAura(scene,aura,centro,elapsed);
  return true;
}

export function atualizarAuraNyx(scene,estado) {
  if (estado.auraNyx) {
    if (!scene.player?.active || scene.morteEmAndamento || scene.vida <= 0) encerrarLocal(scene,estado);
    // O fim do GIF concede um efeito independente, com dez segundos de cura.
    else if (!atualizarAura(scene,estado,estado.auraNyx,scene.player)) encerrarLocal(scene,estado,false);
  }
  for (const [id,aura] of estado.aurasRemotas) {
    if (aura.encerrada) continue;
    const player = scene.multiplayerManager?.room?.players.find(p=>p.id===id);
    const remoto = scene.remotePlayers?.get(id);
    const centro = remoto?.active ? remoto : player;
    if (centro) atualizarAura(scene,estado,aura,centro);
  }
  atualizarCuras(scene,estado);
  atualizarVisuaisCura(scene,estado);
}

export function limparAuraNyx(scene,estado) {
  scene.events.off('preupdate',estado.verificarVidaAura);
  scene.events.off('postupdate',estado.atualizarVisuaisCuraNyx);
  scene.multiplayerManager?.off('roomUpdated',estado.receberAuraNyx);
  encerrarLocal(scene,estado);
  for (const aura of estado.aurasRemotas.values()) destruirAura(aura);
  estado.aurasRemotas.clear();
  for (const [id,cura] of estado.curasNyx) encerrarCura(estado,id,cura);
  estado.curasNyx.clear();
}
