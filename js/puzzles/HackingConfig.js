import { MEMORY_PROGRESS_KEY } from './HackingProgress.js';
export const HACKING_KEYS = Object.freeze({ fabrica: 'factoryHackingComplete',
  robos: 'factoryHackingRobots', registro: 'factoryHackingIntel', bruteforce: 'factoryBruteforceComplete', cartao: 'bossAccessCardAuthenticated',
  memory: MEMORY_PROGRESS_KEY, host: 'hostConnectionComplete', final: 'matrixZeroComplete' });
export const TERMINAIS_HACKING = Object.freeze({
  fabrica: Object.freeze({ x: 1032, y: -1954, alcance: 88, nome: 'SEGURANÇA AXIOM', cor: 0x51e7cb }),
  bruteforce: Object.freeze({ x: -378, y: -2996, alcance: 100, nome: 'EV-041 · RECUPERAR ARQUIVO', cor: 0x51e7cb }),
  matrix: Object.freeze({ x: -242, y: -5882, alcance: 88, nome: 'NÚCLEO · AXIOM', cor: 0xbc95ff }),
});
export const MATRIX_NODES = Object.freeze({
  entrada: { x: 72, y: 350, label: 'I/O · VÍRUS ZERO', tipo: 'entrada' },
  memoria: { x: 72, y: 180, label: 'MEMÓRIA 04', tipo: 'memoria' },
  anomalia: { x: 240, y: 180, label: 'ANOMALIA', tipo: 'anomalia' },
  roteador: { x: 408, y: 180, label: 'ROTEADOR', tipo: 'controle' },
  vidaA: { x: 408, y: 54, label: 'VIDA · A', tipo: 'vida' },
  vidaB: { x: 570, y: 54, label: 'VIDA · B', tipo: 'vida' },
  comunicacao: { x: 570, y: 180, label: 'COMUNICAÇÃO', tipo: 'comunicacao' },
  nucleo: { x: 738, y: 180, label: 'AXIOM', tipo: 'nucleo' },
  abrigo: { x: 240, y: 350, label: 'RUPTURA DE RASTRO', tipo: 'abrigo' },
  desvio: { x: 408, y: 350, label: 'ROTA ALTERNATIVA', tipo: 'controle' },
});
export const MATRIX_LINKS = Object.freeze([
  ['entrada', 'memoria'], ['entrada', 'abrigo'], ['memoria', 'anomalia'], ['abrigo', 'anomalia'],
  ['anomalia', 'roteador', 'anomalia'], ['roteador', 'vidaA'], ['vidaA', 'vidaB'],
  ['vidaB', 'comunicacao'], ['roteador', 'comunicacao', 'ice'], ['roteador', 'desvio'],
  ['desvio', 'comunicacao'], ['comunicacao', 'nucleo', 'nucleo'], ['abrigo', 'desvio'],
]);
