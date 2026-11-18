/** Movimento e observação compartilhados entre renderização e validação autoritativa. */
export const modulo = (value, length) => ((value % length) + length) % length;
export function randomHacking(seed) {
  let n = seed >>> 0;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0);
}
export function tempoObservado(atual, informado) {
  if (informado === undefined) return atual;
  // A seleção usa o instante que foi exibido, limitado ao atraso de uma ação recente.
  return Number.isFinite(informado) && informado >= 0 && informado >= atual - 450 && informado <= atual + 120 ? informado : null;
}
export function deltaHacking(delta) { return Number.isFinite(delta) && delta > 0 ? delta : 0; }
