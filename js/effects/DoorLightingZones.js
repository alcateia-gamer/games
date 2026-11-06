import { intensidadeLuzPartida } from "./FactoryLighting.js";

const DURACAO_REVELACAO = 150;
const DURACAO_PARTIDA_ZONA = 700;
const ATRASO_ENTRE_LAMPADAS = 40;
// Retângulos desenhados no Tiled podem deixar pequenas frestas por arredondamento.
const TOLERANCIA_CONEXAO_ZONAS = 1;
const limitar = valor => Math.max(0, Math.min(1, valor));

function centroLuz(luz) {
  if (!luz.area) return { x: luz.x, y: luz.y };
  const cos = Math.cos(luz.rotacao), sin = Math.sin(luz.rotacao);
  return { x: luz.x + cos * luz.largura / 2 - sin * luz.altura / 2,
    y: luz.y + sin * luz.largura / 2 + cos * luz.altura / 2 };
}

function contem(zona, ponto) {
  const dx = ponto.x - zona.x, dy = ponto.y - zona.y;
  const x = dx * zona.cos + dy * zona.sin, y = -dx * zona.sin + dy * zona.cos;
  return x >= 0 && x < zona.largura && y >= 0 && y < zona.altura;
}

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

/** A porta controla a revelação; o gerador continua controlando a energia das lâmpadas. */
export default class DoorLightingZones {
  constructor(map, lampadas = [], emergencias = []) {
    this.zonas = lerZonasLuzApagada(map).map(zona => ({ ...zona, porta: null,
      liberada: false, restaurada: false, inicioRevelacao: null, inicioLampadas: null,
      opacidade: 1, indices: new Map() }));
    this.normais = new Set(lampadas);
    this.porLuz = new WeakMap();
    for (const luz of [...lampadas, ...emergencias]) {
      const ponto = centroLuz(luz);
      const zonas = this.zonas.filter(zona => contem(zona, ponto));
      this.porLuz.set(luz, zonas);
      for (const zona of zonas) zona.indices.set(luz, zona.indices.size);
    }
    this.distanciaMaximaPorta = (map.tileWidth ?? 48) * 2;
    this.revisao = 0;
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
    const a = candidata.area;
    const distancia = luz => {
      const p = centroLuz(luz);
      return Math.hypot(p.x - a.x - a.width / 2, p.y - a.y - a.height / 2);
    };
    [...zona.indices.keys()].sort((a, b) => distancia(a) - distancia(b))
      .forEach((luz, indice) => zona.indices.set(luz, indice));
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
    for (const zona of this.zonas) {
      if (!zona.liberada && zona.porta?.estado === "aberta") {
        zona.liberada = true;
        zona.inicioRevelacao = agora;
        this.revisao++;
      }
      if (zona.liberada && energia && zona.inicioLampadas === null && !zona.restaurada) {
        zona.inicioLampadas = agora;
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

  fatorLuz(luz, agora) {
    let fator = 1;
    for (const zona of this.porLuz.get(luz) ?? []) {
      if (!zona.liberada) return 0;
      if (zona.restaurada) continue;
      const inicio = this.normais.has(luz) ? zona.inicioLampadas : zona.inicioRevelacao;
      if (inicio === null) return 0;
      const tempo = agora - inicio - zona.indices.get(luz) * ATRASO_ENTRE_LAMPADAS;
      fator = Math.min(fator, intensidadeLuzPartida(tempo / DURACAO_PARTIDA_ZONA));
    }
    return fator;
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
    for (const zona of this.zonas) zona.indices.clear();
    this.zonas.length = 0;
    this.normais.clear();
    this.porLuz = new WeakMap();
  }
}

export { DURACAO_REVELACAO, DURACAO_PARTIDA_ZONA, ATRASO_ENTRE_LAMPADAS };
