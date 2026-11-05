/** Configuração dos LEDs originais da fábrica, preservada ao substituir o JSON do Tiled.
 * Os IDs identificam os pontos mesmo se forem movidos; propriedades explícitas têm prioridade.
 */
const padroes = new Map();
const grupos = [
  { cor: "#FF101C", orientacao: "Vertical", intervalos: [[1406, 1414], [1430, 1438]] },
  { cor: "#FF101C", orientacao: "Horizontal", intervalos: [[1415, 1429], [1439, 1453]] },
  { cor: "#FFD35A", orientacao: "Vertical", intervalos: [[1454, 1487], [1528, 1530], [1536, 1551]] },
  { cor: "#FFD35A", orientacao: "Horizontal", intervalos: [[1488, 1527], [1552, 1592]] },
];
for (const { cor, orientacao, intervalos } of grupos) {
  const padrao = Object.freeze({ cor, orientacao });
  for (const [inicio, fim] of intervalos) {
    for (let id = inicio; id <= fim; id++) padroes.set(id, padrao);
  }
}

export function padraoNeonFabrica(id) { return padroes.get(id); }
