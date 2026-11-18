/** Uma única animação por painel. Interpola snapshots sem transmitir ações por frame. */
export function criarAnimacaoHacking(desenhar) {
  let estado = null, recebidoEm = 0, encerrado = false, frame;
  const tempo = () => !estado ? 0 : estado.tempo + (estado.estado === 'ativo' && !estado.tutorial ? Math.max(0, performance.now() - recebidoEm) : 0);
  const loop = () => {
    if (encerrado) return;
    if (estado) desenhar(estado, tempo());
    if (!encerrado) frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return { tempo, atualizar(s) { estado = s; recebidoEm = performance.now(); },
    destruir() { encerrado = true; cancelAnimationFrame(frame); estado = null; } };
}
