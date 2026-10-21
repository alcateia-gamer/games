/**
 * @file Hitboxes de Kai. width e height medem o corpo de colisão em pixels; offsetX e offsetY
 * o posicionam dentro dos frames de caminhada e ataque.
 */

const CONFIGURACAO_HITBOX_WALK = Object.freeze({
  width: 30,
  height: 15,
  offsetX: 49,
  offsetY: 82,
});

const CONFIGURACAO_HITBOX_ATAQUE = Object.freeze({
  width: 30,
  height: 15,
  offsetX: 49,
  offsetY: 73,
});

export { CONFIGURACAO_HITBOX_WALK, CONFIGURACAO_HITBOX_ATAQUE };
