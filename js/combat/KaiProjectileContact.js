/** Contato entre o retângulo orientado do disparo e a silhueta do domo. */
export function contatoProjetilDomo(laser, x, y, rx, cima, baixo) {
  if (rx <= 0 || cima <= 0 || baixo <= 0) return null;
  const a = (laser.comprimentoFeixe ?? laser.displayWidth ?? laser.width ?? 0) / 2;
  const b = (laser.larguraFeixe ?? laser.displayHeight ?? laser.height ?? 0) / 2;
  if (Math.abs(laser.x - x) > rx + Math.hypot(a, b) ||
      Math.abs(laser.y - y) > Math.max(cima, baixo) + Math.hypot(a, b)) return null;
  const c = Math.cos(laser.rotation || 0), s = Math.sin(laser.rotation || 0);
  const retangulo = [[-a,-b],[a,-b],[a,b],[-a,b]].map(([u,v]) =>
    ({ x: laser.x + u*c - v*s, y: laser.y + u*s + v*c }));
  // A mesma calota superior e elipse inferior usadas para desenhar a proteção.
  const borda = Array.from({ length: 64 }, (_, i) => {
    const angulo = i * Math.PI / 32;
    return { x: x + Math.cos(angulo)*rx,
      y: y + Math.sin(angulo)*(i < 32 ? baixo : cima) };
  });
  const eixos = [{ x:c, y:s }, { x:-s, y:c }];
  for (let i=0; i<borda.length; i++) {
    const p = borda[i], q = borda[(i+1)%borda.length];
    eixos.push({ x:p.y-q.y, y:q.x-p.x });
  }
  for (const eixo of eixos) {
    const d = borda.map(p => p.x*eixo.x + p.y*eixo.y);
    const r = retangulo.map(p => p.x*eixo.x + p.y*eixo.y);
    if (Math.max(...d) < Math.min(...r) || Math.max(...r) < Math.min(...d)) return null;
  }
  // Ancorar áudio e brilho na superfície, mesmo quando a ponta de um feixe longo toca primeiro.
  let contato, distancia = Infinity;
  for (let i=0; i<borda.length; i++) {
    const p = borda[i], q = borda[(i+1)%borda.length];
    const dx=q.x-p.x, dy=q.y-p.y;
    const t=Math.max(0,Math.min(1,((laser.x-p.x)*dx+(laser.y-p.y)*dy)/(dx*dx+dy*dy)));
    const ponto={x:p.x+t*dx,y:p.y+t*dy};
    const d=Math.hypot(ponto.x-laser.x,ponto.y-laser.y);
    if(d<distancia) { distancia=d; contato=ponto; }
  }
  return contato;
}
