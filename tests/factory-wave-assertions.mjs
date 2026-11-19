import assert from "node:assert/strict";

export function exigirNascimentoDaArea({ id, invocados, robos, portas, pendencia }, minimo = 1) {
  const quantidade = robos.filter(robo => robo.area === id || robo.spawnAreaRoboBolaId === id).length;
  assert.ok(invocados >= minimo && quantidade >= minimo,
    `Área ${id} aguardava ${minimo}, com ${invocados} nascimentos e ${quantidade} corpos próprios. Portas ${JSON.stringify(portas)}. Pendência ${pendencia}.`);
}
