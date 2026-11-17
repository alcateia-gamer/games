export function criarInterfaceMatrix(enviar) {
  const root = document.createElement('section'); root.className = 'matrix-ui';
  root.setAttribute('aria-label', 'Arquitetura digital da MATRIX');
  const style = document.createElement('style'); style.textContent = `
    .matrix-ui{position:fixed;inset:0;z-index:10060;pointer-events:none;font:14px monospace;color:#d4fdfb;box-sizing:border-box}
    .matrix-ui [hidden]{display:none!important}.matrix-ui button,.matrix-ui input{pointer-events:auto;touch-action:none}.matrix-ui button{min-height:44px;min-width:44px;background:#102d3eee;color:#c9fff8;border:1px solid #4dbaa9;border-radius:4px;font:inherit;padding:7px;cursor:pointer}.matrix-ui button:focus-visible{outline:3px solid white}
    .matrix-top{background:#020c18ed;padding:8px 62px 8px 10px;min-height:50px;border-bottom:1px solid #4a696b}.matrix-title{font-weight:bold;color:#baf9f4}.matrix-status{margin-top:4px;font-size:13px;color:#98c8d3}.matrix-message{margin-top:5px;color:#e0e5c4;line-height:1.25;max-width:850px}.matrix-close{position:absolute;right:8px;top:8px}
    .matrix-pad{position:absolute;bottom:8px;left:8px;display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px);gap:3px}.matrix-pad [data-dir=up]{grid-column:2}.matrix-pad [data-dir=left]{grid-column:1;grid-row:2}.matrix-pad [data-dir=down]{grid-column:2;grid-row:2}.matrix-pad [data-dir=right]{grid-column:3;grid-row:2}
    .matrix-actionbox{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:min(260px,40vw);text-align:center}.matrix-action{width:100%}.matrix-hint{margin:4px 0;font-size:12px;background:#020c18d9;padding:3px}.matrix-memory{position:absolute;right:8px;bottom:62px;width:244px;padding:8px;border:1px solid #ac94d2;background:#090e22f5;box-sizing:border-box;pointer-events:auto}.matrix-memory canvas{width:226px;height:64px;image-rendering:pixelated;display:block}.matrix-memory p{margin:5px 0;font-size:12px;line-height:1.3}.matrix-memory input{width:100%;min-height:30px}.matrix-memory .layers{display:flex;gap:5px}.matrix-memory .layers button{flex:1}.matrix-memory button.selected{background:#6a3c81}.matrix-memory .examinar{width:100%;margin-top:4px}
    @media(max-height:380px){.matrix-top{padding-top:4px;padding-bottom:4px}.matrix-message{font-size:12px;max-width:80vw}.matrix-memory{bottom:8px;max-height:calc(100dvh - 88px);overflow-y:auto}.matrix-status{font-size:12px}}
  `;
  root.innerHTML = `<div class="matrix-top"><div class="matrix-title">N.O.V.A. / ARQUITETURA MATRIX</div><div class="matrix-status"></div><div class="matrix-message" aria-live="polite"></div></div><button class="matrix-close" aria-label="Sair da MATRIX">×</button>
    <div class="matrix-pad"><button data-dir="up" aria-label="Mover para cima">▲</button><button data-dir="left" aria-label="Mover para esquerda">◀</button><button data-dir="down" aria-label="Mover para baixo">▼</button><button data-dir="right" aria-label="Mover para direita">▶</button></div>
    <div class="matrix-actionbox"><p class="matrix-hint">WASD / setas · E interagir · toque nas direções</p><button class="matrix-action">Liberar Vírus Zero</button><button class="matrix-retry" hidden>Reabrir canal</button></div>
    <div class="matrix-memory" hidden><strong>REGISTRO / EVENTO 04</strong><canvas width="226" height="64"></canvas><p class="memory-log"></p><label>Instante <span class="memory-time"></span> · pulso em 04 s<input type="range" min="0" max="6" step="1" value="0" aria-label="Instante da memória"></label><div class="layers"><button data-layer="visual">VISUAL</button><button data-layer="rede">REDE</button></div><button class="examinar">Examinar fragmento</button></div>`;
  root.append(style); document.body.append(root);
  const q = s => root.querySelector(s), directions = new Map();
  const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const button of root.querySelectorAll('[data-dir]')) {
    button.onpointerdown = e => { e.preventDefault(); button.setPointerCapture(e.pointerId); directions.set(e.pointerId, map[button.dataset.dir]); };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = e => directions.delete(e.pointerId);
  }
  q('.matrix-close').onclick = () => enviar({ op: 'cancelar' });
  q('.matrix-action').onclick = () => enviar({ op: 'interagir' });
  q('.matrix-retry').onclick = () => enviar({ op: 'reiniciar' });
  q('input').oninput = e => enviar({ op: 'instante', valor: Number(e.target.value) });
  q('.examinar').onclick = () => enviar({ op: 'examinar' });
  for (const button of root.querySelectorAll('[data-layer]')) button.onclick = () => enviar({ op: 'camada', valor: button.dataset.layer });
  const ctx = q('canvas').getContext('2d');
  return {
    direcao() { return [...directions.values()].reduce((p, [x, y]) => ({ x: p.x + x, y: p.y + y }), { x: 0, y: 0 }); },
    atualizar(s) {
      if (!s) return;
      const closed = s.estado !== 'ativo';
      q('.matrix-status').textContent = `RASTRO ${Math.floor(s.rastro)}% · VIDA A ${s.vida.A ? 'ISOLADA' : 'CONECTADA'} / B ${s.vida.B ? 'ISOLADA' : 'CONECTADA'} · VÍRUS: ${s.virus.liberado ? s.virus.no.toUpperCase() : 'AGUARDANDO'}`;
      q('.matrix-message').textContent = s.mensagem;
      q('.matrix-pad').hidden = closed; q('.matrix-action').hidden = closed;
      q('.matrix-retry').hidden = s.estado !== 'falha';
      const actions = { entrada: s.virus.liberado ? 'Vírus em trânsito' : 'Liberar Vírus Zero', memoria: 'Use o registro ao lado',
        anomalia: 'Estabilizar passagem · 10 s', roteador: `Mudar rota · ${s.rota === 'vida' ? 'VIDA ⚠' : s.rota === 'direta' ? 'DIRETA' : 'DESVIO'}`,
        vidaA: s.vida.A ? 'Circuito A protegido' : 'Isolar suporte à vida A', vidaB: s.vida.B ? 'Circuito B protegido' : 'Isolar suporte à vida B',
        comunicacao: s.comunicacao ? 'Canal de despertar ativo' : 'Ativar despertar gradual', abrigo: 'Quebrar rastro / isolar ICE' };
      q('.matrix-action').textContent = actions[s.proximo] ?? 'Aproxime-se de uma plataforma';
      q('.matrix-action').disabled = !actions[s.proximo] || s.proximo === 'memoria';
      q('.matrix-memory').hidden = s.proximo !== 'memoria' || closed;
      if (s.proximo === 'memoria') {
        q('.memory-time').textContent = `${s.memoria.instante.toString().padStart(2, '0')} s`;
        if (document.activeElement !== q('input')) q('input').value = s.memoria.instante;
        for (const button of root.querySelectorAll('[data-layer]')) button.classList.toggle('selected', button.dataset.layer === s.memoria.camada);
        q('.memory-log').textContent = s.memoria.camada === 'visual'
          ? `Porta fechada. Operador ${s.memoria.instante >= 4 ? 'do outro lado' : 'se aproximando'}. ${s.memoria.visual ? '✓ Evidência visual' : ''}`
          : `04 s · ACESSO NEGADO · TOKEN EXPIRADO. ${s.memoria.rede ? '✓ Evidência de rede' : ''}`;
        ctx.fillStyle = '#080f22'; ctx.fillRect(0, 0, 226, 64);
        ctx.strokeStyle = '#b387ee'; ctx.strokeRect(112, 8, 18, 48);
        ctx.fillStyle = '#ff6681'; ctx.fillRect(117, 14, 8, 36);
        const x = 30 + s.memoria.instante * 25;
        ctx.fillStyle = s.memoria.camada === 'visual' ? '#b6efff' : '#87fdd1';
        ctx.fillRect(x, 16, 8, 8); ctx.fillRect(x - 2, 26, 12, 16); ctx.fillRect(x - 2, 42, 4, 10); ctx.fillRect(x + 6, 42, 4, 10);
        ctx.fillStyle = '#63e0ca'; ctx.fillRect(174, 57, 4, 5);
      }
    },
    destruir() { directions.clear(); root.remove(); },
  };
}
