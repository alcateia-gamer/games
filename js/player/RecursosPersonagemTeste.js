/** Regras de recursos exclusivas dos personagens de teste. */
import { personagemTesteAtivo } from "./PersonagemTeste.js";

export const ITENS_RECUPERACAO_TESTE = Object.freeze([
  Object.freeze({ id: "toxina-de-cura", nome: "Toxina de cura", atributo: "vida",
    maximo: "vidaMaxima", fracao: 0.2, cor: 0xbf76ff }),
  Object.freeze({ id: "comprimidos-de-desempenho", nome: "Comprimidos de desempenho",
    atributo: "estamina", maximo: "estaminaMaxima", fracao: 0.3, cor: 0x70e84b }),
]);

export function prepararRecursosTeste(scene) {
  if (!personagemTesteAtivo(scene)) return;
  const chave = `${scene.personagemSelecionada}-recursos`;
  const anterior = scene.game?.registry?.get(chave);
  // Entrar em outro mapa não cura nem recarrega; uma vida nova começa cheia.
  if (anterior?.vida > 0) {
    scene.vida = Math.min(scene.vidaMaxima, anterior.vida);
    scene.estamina = Math.min(scene.estaminaMaxima, anterior.estamina);
  }
  scene.regeneracaoVida = 0;
  scene.regeneracaoEstamina = 0;
  scene.events?.once("shutdown", () => {
    scene.game?.registry?.set(chave, { vida: scene.vida, estamina: scene.estamina });
  });
}

export function darItensIniciaisTeste(scene) {
  if (!personagemTesteAtivo(scene) || !scene.inventory) return;
  const chave = "recuperacao-teste-itens-iniciais";
  const recebidos = scene.game?.registry?.get(chave) ?? [];
  for (const item of ITENS_RECUPERACAO_TESTE) {
    if (!recebidos.includes(item.id) && scene.inventory.addItem(item.id, 1)) recebidos.push(item.id);
  }
  scene.game?.registry?.set(chave, recebidos);
}

export function usarItemRecuperacaoTeste(scene, id) {
  const item = ITENS_RECUPERACAO_TESTE.find(i => i.id === id);
  if (!item || !personagemTesteAtivo(scene) || !scene.player?.active || scene.player.morto ||
      scene.morteEmAndamento || (scene.vida ?? 0) <= 0 || scene.generatorMenuOpen || scene.devItemMenuOpen ||
      scene.inventory?.getQuantity(id) < 1 || !scene.inventory ||
      !Number.isFinite(scene[item.atributo]) || !Number.isFinite(scene[item.maximo]) ||
      scene[item.atributo] >= scene[item.maximo]) return false;
  if (scene.inventory.removeItem(id, 1) !== 1) return false;
  scene[item.atributo] = Math.min(scene[item.maximo], scene[item.atributo] + scene[item.maximo] * item.fracao);
  scene.events?.emit("personagem-teste:recuperacao", { item: id, valor: scene[item.atributo] });
  return true;
}
