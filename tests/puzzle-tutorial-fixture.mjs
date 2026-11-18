import { HackingSession } from '../js/puzzles/HackingSession.js';
import { gerarMissao } from '../js/puzzles/MissionIntelligence.js';
import { criarPainelHacking } from '../js/ui/HackingPanel.js';
import { criarPainelBruteforce } from '../js/ui/BruteforcePanel.js';
import { criarPainelInvasao } from '../js/ui/CoreInvasionPanel.js';

/** UI e sessão reais; somente o relógio de atualização independe do Phaser. */
export function criarFixtureTutorial(tipo) {
  const config = gerarMissao(41), checkpoint = { memoryModules: ({ host: 3, 'memory-integridade': 1, 'memory-autorizacao': 2 })[tipo] ?? 0 };
  const engine = new HackingSession(() => {}, () => ({ config, checkpoint })); let seq = 0, panel;
  engine.abrir((tipo.startsWith('memory') || tipo === 'host') ? 'matrix' : tipo, 'toque');
  const render = () => { const state = engine.snapshot(); if (state) panel.atualizar(state.model); };
  const enviar = cmd => { const ok = engine.comando('toque', { id: engine.atual?.id, seq: ++seq, ...cmd }); render(); return ok; };
  panel = tipo === 'fabrica' ? criarPainelHacking(enviar) : tipo === 'bruteforce' ? criarPainelBruteforce(enviar)
    : criarPainelInvasao(enviar, config, () => ({ fabrica: true, bruteforce: true }));
  render();
  let anterior = performance.now();
  const timer = setInterval(() => { const agora = performance.now(); engine.atualizar(agora - anterior); anterior = agora; render(); }, 50);
  return { estado: () => engine.snapshot(), enviar, destruir() { clearInterval(timer); panel.destruir(); engine.cancelar('toque'); } };
}
