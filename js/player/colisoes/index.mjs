import {
  CONFIGURACAO_HITBOX_ATAQUE as kaiMercerAttack,
  CONFIGURACAO_HITBOX_WALK as kaiMercerWalk,
} from "./kai-mercer.mjs";
import {
  CONFIGURACAO_HITBOX_ATAQUE as magnusForceAttack,
  CONFIGURACAO_HITBOX_WALK as magnusForceWalk,
} from "./magnus-force.mjs";
import {
  CONFIGURACAO_HITBOX_ATAQUE as ariaKadeAttack,
  CONFIGURACAO_HITBOX_WALK as ariaKadeWalk,
} from "./aria-kade.mjs";
import {
  CONFIGURACAO_HITBOX_ATAQUE as nyxAttack,
  CONFIGURACAO_HITBOX_WALK as nyxWalk,
} from "./nyx.mjs";

const CONFIGURACOES = Object.freeze({
  "kai-mercer": {
    walk: kaiMercerWalk,
    attack: kaiMercerAttack,
  },
  "magnus-force": {
    walk: magnusForceWalk,
    attack: magnusForceAttack,
  },
  "aria-kade": {
    walk: ariaKadeWalk,
    attack: ariaKadeAttack,
  },
  nyx: {
    walk: nyxWalk,
    attack: nyxAttack,
  },
});

function obterConfiguracaoHitboxWalk(personagem) {
  return CONFIGURACOES[personagem]?.walk ?? CONFIGURACOES["kai-mercer"].walk;
}

function obterConfiguracaoHitboxAtaque(personagem) {
  return (
    CONFIGURACOES[personagem]?.attack ?? CONFIGURACOES["kai-mercer"].attack
  );
}

export { obterConfiguracaoHitboxWalk, obterConfiguracaoHitboxAtaque };
