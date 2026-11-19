import { criarCompanionPet, atualizarDepthCompanionPet } from '../player/CompanionPet.js';
import { atualizarAnimacaoParado } from '../controls/PlayerAnimations.js';

/** Reserva o operador e conduz N.O.V.A. ao computador, conservando colisões e controles. */
export function prepararPetNoTerminal(scene, context, terminal, { criarPet = true } = {}) {
  const player = context.player, inicio = { x: player.x, y: player.y }, b = player.body;
  const temporario = criarPet && !context.companionPet?.active;
  const pet = criarPet ? temporario ? criarCompanionPet(context) : context.companionPet : null;
  const petInicio = pet ? { x: pet.x, y: pet.y } : null;
  const petDestino = { x: terminal.x, y: terminal.y + 24 };
  const anterior = { movimento: !!context.movimentoBloqueado, menu: !!context.generatorMenuOpen,
    hacking: context.hackingAtivo, moves: b.moves, petMoves: pet?.body.moves };
  context.movimentoBloqueado = true; context.generatorMenuOpen = true; context.hackingAtivo = true;
  player.setVelocity(0, 0); b.moves = false; context.somCorrida?.stop();
  atualizarAnimacaoParado(context);
  context.joystick?.reset?.(); context.ariaAttackJoystick?.cancelar?.();
  if (context.estadoDash) context.estadoDash.ativo = false;
  if (pet) { pet.emHack = true; pet.body.moves = false; pet.setVelocity(0, 0); }
  let tempo = 0, encerrado = false;
  const direcao = (x, y) => Math.abs(x) > Math.abs(y) ? x < 0 ? 'left' : 'right' : y < 0 ? 'up' : 'down';
  return {
    get pronto() { return tempo >= 650; },
    snapshot() { return { player: { ...inicio }, pet: petDestino }; },
    atualizar(delta) {
      if (encerrado) return;
      tempo += Math.max(0, Math.min(100, Number.isFinite(delta) ? delta : 0));
      const t = Math.min(1, tempo / 650), suave = t * t * (3 - 2 * t);
      player.body.reset(inicio.x, inicio.y);
      player.body.updateFromGameObject();
      atualizarAnimacaoParado(context);
      if (pet?.active) {
        pet.body.reset(petInicio.x + (petDestino.x - petInicio.x) * suave, petInicio.y + (petDestino.y - petInicio.y) * suave);
        pet.body.updateFromGameObject();
        pet.anims.play(`companion-pet-walk-${t < 1 ? direcao(petDestino.x - petInicio.x, petDestino.y - petInicio.y) : 'up'}`, true);
        atualizarDepthCompanionPet(context);
      }
    },
    destruir() {
      if (encerrado) return; encerrado = true;
      context.movimentoBloqueado = anterior.movimento; context.generatorMenuOpen = anterior.menu;
      context.hackingAtivo = anterior.hacking;
      if (player.active && player.body) { player.body.moves = anterior.moves; player.setVelocity(0, 0); }
      if (pet?.active) {
        pet.emHack = false; pet.body.moves = anterior.petMoves; pet.lastTargetAt = 0;
        pet.state = 'FOLLOW'; pet.stuckTime = pet.recoveryTime = 0;
        if (temporario) { pet.destroy(); context.companionPet = null; }
      }
      context.joystick?.reset?.();
    },
  };
}
