/**
 * @file Hitboxes de Magnus. width e height medem o corpo de colisão em pixels; offsetX e
 * offsetY o posicionam dentro dos frames de caminhada e ataque.
 */

const CONFIGURACAO_HITBOX_WALK = Object.freeze({
  width: 30,
  height: 15,
  offsetX: 17,
  offsetY: 44,
});

const CONFIGURACAO_HITBOX_ATAQUE = Object.freeze({
  width: 30,
  height: 15,
  offsetX: 44,
  offsetY: 69,
});

export { CONFIGURACAO_HITBOX_WALK, CONFIGURACAO_HITBOX_ATAQUE };
