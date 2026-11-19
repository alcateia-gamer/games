
const DURACAO_REVELACAO = 150;
const PORTAS_SOMBRA_COMPARTILHADA = new Set(["porta01", "porta04"]);
// Retângulos desenhados no Tiled podem deixar pequenas frestas por arredondamento.
const TOLERANCIA_CONEXAO_ZONAS = 1;
const limitar = valor => Math.max(0, Math.min(1, valor));

function zonasConectadas(a, b) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return (x > 0 && y >= -TOLERANCIA_CONEXAO_ZONAS) ||
    (y > 0 && x >= -TOLERANCIA_CONEXAO_ZONAS);
}

export function lerZonasLuzApagada(map) {
  const layer = map.getObjectLayer("LuzApagada");
  // Esta camada marca gatilhos de jogo: ocultá-la no Tiled não desativa as zonas.
  return (layer?.objects ?? []).flatMap(objeto => {
    if (objeto.visible === false || objeto.point || objeto.ellipse || objeto.polygon || objeto.polyline ||
        objeto.gid || objeto.text || !Number.isFinite(objeto.x) || !Number.isFinite(objeto.y) ||
        !Number.isFinite(objeto.width) || !Number.isFinite(objeto.height) ||
        !(objeto.width > 0 && objeto.height > 0)) return [];
    const angulo = (objeto.rotation ?? 0) * Math.PI / 180;
    const cos = Math.cos(angulo), sin = Math.sin(angulo);
    const cantos = [[0, 0], [objeto.width, 0], [0, objeto.height], [objeto.width, objeto.height]]
      .map(([x, y]) => ({ x: objeto.x + cos * x - sin * y, y: objeto.y + sin * x + cos * y }));
    return [{ id: objeto.id, x: objeto.x, y: objeto.y, largura: objeto.width, altura: objeto.height,
      cos, sin, bounds: { left: Math.min(...cantos.map(p => p.x)), right: Math.max(...cantos.map(p => p.x)),
        top: Math.min(...cantos.map(p => p.y)), bottom: Math.max(...cantos.map(p => p.y)) } }];
  });
}

/** A porta controla diretamente a opacidade da região; a energia é independente. */
export default class DoorLightingZones {
  constructor(map) {
    this.zonas = lerZonasLuzApagada(map).map(zona => ({ ...zona, porta: null,
      liberada: false, restaurada: false, inicioRevelacao: null,
      opacidade: 1 }));
    this.distanciaMaximaPorta = (map.tileWidth ?? 48) * 2;
    this.revisao = 0;
    this.portasPareadasInicializadas = false;
  }

  associarPorta(zona, portas) {
    let candidata = null, melhor = Infinity, centroMaisProximo = Infinity;
    const b = zona.bounds;
    for (const porta of portas) {
      const a = porta.area;
      if (!a || !(a.width > 0 && a.height > 0)) continue;
      const dx = Math.max(0, a.x - b.right, b.left - a.x - a.width);
      const dy = Math.max(0, a.y - b.bottom, b.top - a.y - a.height);
      const distancia = Math.hypot(dx, dy);
      const centro = Math.hypot(a.x + a.width / 2 - (b.left + b.right) / 2,
        a.y + a.height / 2 - (b.top + b.bottom) / 2);
      if (distancia > this.distanciaMaximaPorta) continue;
      if (distancia < melhor || (distancia === melhor && centro < centroMaisProximo)) {
        candidata = porta;
        melhor = distancia;
        centroMaisProximo = centro;
      }
    }
    if (!candidata) return;
    this.vincularPorta(zona, candidata);
  }

  vincularPorta(zona, candidata) {
    zona.porta = candidata;
    // Uma porta já aberta ao entrar no mapa restaura a sala sem repetir a animação.
    zona.restaurada = candidata.estado === "aberta";
    zona.liberada = zona.restaurada;
    this.revisao++;
  }

  atualizar(agora, portas, energia) {
    for (const zona of this.zonas) {
      if (!zona.porta) this.associarPorta(zona, portas);
    }
    // Uma sala pode ser desenhada em vários retângulos; só o da entrada precisa
    // estar perto da porta. Associa primeiro as portas diretas para preservar salas vizinhas.
    let vinculada;
    do {
      vinculada = false;
      for (const zona of this.zonas) {
        if (zona.porta) continue;
        const vizinha = this.zonas.find(outra => outra.porta && zonasConectadas(zona.bounds, outra.bounds));
        if (!vizinha) continue;
        this.vincularPorta(zona, vizinha.porta);
        vinculada = true;
      }
    } while (vinculada);
    if (!this.portasPareadasInicializadas &&
        portas.some(porta => PORTAS_SOMBRA_COMPARTILHADA.has(porta.nome))) {
      if (portas.some(porta => PORTAS_SOMBRA_COMPARTILHADA.has(porta.nome) &&
          porta.estado === "aberta")) {
        for (const zona of this.zonas) {
          if (!PORTAS_SOMBRA_COMPARTILHADA.has(zona.porta?.nome)) continue;
          zona.liberada = zona.restaurada = true;
          zona.opacidade = 0;
        }
      }
      this.portasPareadasInicializadas = true;
    }
    for (const zona of this.zonas) {
      const portaPareadaAberta = PORTAS_SOMBRA_COMPARTILHADA.has(zona.porta?.nome) &&
        portas.some(porta => PORTAS_SOMBRA_COMPARTILHADA.has(porta.nome) && porta.estado === "aberta");
      if (!zona.liberada && (zona.porta?.estado === "aberta" || portaPareadaAberta)) {
        zona.liberada = true;
        zona.inicioRevelacao = agora;
        this.revisao++;
      }
      const p = zona.restaurada ? 1 : zona.liberada
        ? limitar((agora - zona.inicioRevelacao) / DURACAO_REVELACAO) : 0;
      const opacidade = Math.round((1 - p * p * (3 - 2 * p)) * 255) / 255;
      if (zona.opacidade !== opacidade) { zona.opacidade = opacidade; this.revisao++; }
    }
  }

  revelarPortas(portas, agora = 0) {
    this.atualizar(agora, portas, false);
    for (const zona of this.zonas) {
      if (!portas.includes(zona.porta)) continue;
      zona.liberada = zona.restaurada = true;
      zona.opacidade = 0;
      this.revisao++;
    }
  }

  snapshotRede(agora) {
    return this.zonas.filter(z => z.liberada).map(z => ({ id: z.id, restaurada: z.restaurada,
      revelacao: z.inicioRevelacao === null ? null : agora - z.inicioRevelacao }));
  }

  aplicarEstadoRede(dados, agora, portas, energia) {
    if (!Array.isArray(dados)) return;
    // Associa as portas antes de restaurar a liberação, inclusive no primeiro frame.
    this.atualizar(agora, portas, energia);
    for (const d of dados) {
      const z = this.zonas.find(zona => zona.id === d.id);
      if (!z) continue;
      let mudou = !z.liberada || z.restaurada !== d.restaurada;
      z.liberada = true; z.restaurada = d.restaurada;
      for (const [campo, idade] of [["inicioRevelacao", d.revelacao]]) {
        if (z[campo] === null && Number.isFinite(idade)) { z[campo] = agora - idade; mudou = true; }
      }
      if (z.restaurada && z.opacidade !== 0) { z.opacidade = 0; mudou = true; }
      if (mudou) this.revisao++;
    }
  }

  desenharEscuridao(context) {
    context.fillStyle = "#000000";
    context.globalCompositeOperation = "source-over";
    for (const zona of this.zonas) {
      if (!zona.opacidade) continue;
      context.save();
      context.globalAlpha = zona.opacidade;
      context.transform(zona.cos, zona.sin, -zona.sin, zona.cos, zona.x, zona.y);
      context.fillRect(0, 0, zona.largura, zona.altura);
      context.restore();
    }
  }

  destroy() {
    this.zonas.length = 0;
  }
}

export { DURACAO_REVELACAO };
