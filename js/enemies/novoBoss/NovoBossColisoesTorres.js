/** Liga cada torre somente ao retângulo correspondente da camada collision. */
import { invalidarCacheNavegacao } from "../EnemyPathfinding.js";

function sobrepoe(a, b) {
  return a && b && a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

export function entidadesFisicasArena(scene) {
  return [scene.player, scene.companionPet, ...(scene.inimigos ?? []),
    ...(Array.isArray(scene.aliados) ? scene.aliados : [])];
}

export function criarControleColisaoTorre(scene, ponto) {
  const corpos = (scene.collisionGroup?.getChildren?.() ?? []).filter(obj =>
    ponto.colisaoId != null && obj.tiledCollisionId === ponto.colisaoId).map(obj => obj.body);
  const originais = corpos.map(body => body.enable !== false);
  let habilitada = corpos.some(body => body.enable !== false);
  function definir(valor) {
    if (habilitada === valor) return;
    corpos.forEach(body => { body.enable = valor; });
    habilitada = valor;
    invalidarCacheNavegacao(scene);
  }
  return {
    corpos,
    ocupado() {
      return entidadesFisicasArena(scene).some(entidade =>
        entidade?.active && !entidade.morto && entidade.body?.enable !== false &&
        corpos.some(body => sobrepoe(body, entidade.body)));
    },
    definir,
    restaurar() {
      corpos.forEach((body, indice) => { body.enable = originais[indice]; });
      invalidarCacheNavegacao(scene);
    },
  };
}
