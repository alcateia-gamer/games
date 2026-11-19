/** Entrada de fuga exclusiva pelos controles reais de ataque. */
import { registrarApertoLibertacaoNovoBoss } from '../../player/PlayerControlEffects.js';
import { atualizarHudNovoBoss } from './NovoBossHud.js';

/** Compartilhado pelos controles comuns e pelo botão/joystick de ataque da Aria. */
export function criarEntradaLibertacaoAtaque(scene) {
  let pressionado = null, ultimaEntrada = null;
  const limpar = () => { pressionado = null; };
  const soltar = p => {
    if (p?.id === ultimaEntrada?.id) ultimaEntrada = null;
    if (p?.id === pressionado) limpar();
  };
  const ouvir = (emissor, evento, fn) => { emissor?.on?.(evento, fn); registros.push([emissor, evento, fn]); };
  const registros = [];
  const cancelar = () => { limpar(); ultimaEntrada = null; };
  for (const evento of ['pointerup', 'pointerupoutside', 'pointercancel']) ouvir(scene.input, evento, soltar);
  for (const evento of ['pause', 'sleep']) ouvir(scene.events, evento, cancelar);
  ouvir(scene.events, 'boss:released', limpar);
  for (const evento of ['blur', 'hidden']) ouvir(scene.game?.events, evento, cancelar);
  const canvas = scene.game?.canvas;
  canvas?.addEventListener('touchcancel', cancelar, true);
  canvas?.addEventListener('pointercancel', cancelar, true);
  return {
    pressionar(pointer) {
      if (ultimaEntrada?.id === pointer?.id && ultimaEntrada?.downTime === pointer?.downTime) return true;
      if (!scene.restricaoControleNovoBoss) return false;
      // Consome toda entrada do botão durante a contenção, sem atacar normalmente.
      if (!pointer || pressionado !== null || scene.morteEmAndamento || scene.vida <= 0 ||
          scene.generatorMenuOpen || scene.upgradeMenuOpen || scene.devItemMenuOpen ||
          scene.movimentoBloqueado || pointer.id === scene.joystickPointerId ||
          pointer.leftButtonDown?.() === false && !pointer.wasTouch && !pointer.isTouch &&
          pointer.pointerType !== 'touch' && pointer.event?.pointerType !== 'touch') return true;
      pressionado = pointer.id;
      ultimaEntrada = { id: pointer.id, downTime: pointer.downTime };
      if (scene.coopRuntime) scene.coopRuntime.escape();
      else scene.events.emit('boss:attack-escape');
      return true;
    },
    destruir() {
      for (const [emissor, evento, fn] of registros) emissor?.off?.(evento, fn);
      canvas?.removeEventListener('touchcancel', cancelar, true);
      canvas?.removeEventListener('pointercancel', cancelar, true);
      limpar(); ultimaEntrada = null;
    },
  };
}

export function prepararLibertacaoNovoBoss(scene, encontro) {
  const pressionar = () => {
    if (scene.multiplayer || encontro.encerrado || encontro.morto || encontro.suspenso || !encontro.jogadorNaArena) return;
    if (registrarApertoLibertacaoNovoBoss(scene)) atualizarHudNovoBoss(scene, encontro);
  };
  scene.events.on('boss:attack-escape', pressionar);
  return { destruir() { scene.events.off('boss:attack-escape', pressionar); } };
}
