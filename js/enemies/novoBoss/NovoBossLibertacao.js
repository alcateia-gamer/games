/** Reconhece o botão real de ataque e cliques de combate, sem contar toques de movimento. */
import { registrarApertoLibertacaoNovoBoss } from '../../player/PlayerControlEffects.js';
import { atualizarHudNovoBoss } from './NovoBossHud.js';

export function prepararLibertacaoNovoBoss(scene, encontro) {
  if (!scene.input?.on) return null;
  const pressionados = new Set();
  const pressionar = (pointer, objetos = []) => {
    if (!pointer || encontro.encerrado || encontro.morto || encontro.suspenso ||
        !encontro.jogadorNaArena || scene.multiplayer || scene.generatorMenuOpen || scene.movimentoBloqueado) return;
    const toque = pointer.wasTouch || pointer.isTouch || pointer.pointerType === 'touch' ||
      pointer.event?.pointerType === 'touch';
    const botao = objetos.some(o => o === scene.botaoAtaque || o === scene.iconeAtaque);
    const mouse = !toque && objetos.length === 0 && pointer.leftButtonDown?.();
    if ((!botao && !mouse) || pressionados.has(pointer.id)) return;
    pressionados.add(pointer.id);
    if (registrarApertoLibertacaoNovoBoss(scene)) atualizarHudNovoBoss(scene, encontro);
  };
  const soltar = pointer => pressionados.delete(pointer?.id);
  const cancelar = () => pressionados.clear();
  scene.input.on('pointerdown', pressionar);
  scene.input.on('pointerup', soltar);
  scene.input.on('pointerupoutside', soltar);
  scene.events.on('pause', cancelar);
  scene.game?.events?.on('blur', cancelar);
  return { destruir() {
    scene.input.off('pointerdown', pressionar);
    scene.input.off('pointerup', soltar);
    scene.input.off('pointerupoutside', soltar);
    scene.events.off('pause', cancelar);
    scene.game?.events?.off('blur', cancelar);
    pressionados.clear();
  } };
}
