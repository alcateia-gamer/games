/**
 * @file Pontos de luz da fábrica, partida sincronizada com o gerador e falhas elétricas.
 * Não cria sprites nem altera coordenadas do Tiled: fornece luzes à máscara compartilhada.
 */

import { GENERATOR_LOOP_START_SECONDS } from "../sounds/gerador.js";

const ESCURIDAO_AMBIENTE_FABRICA = 0.75;
const MULTIPLICADOR_ALCANCE_FABRICA = 1.5;
const PADROES_LUZ_FABRICA = Object.freeze({
  raio: 170, intensidade: 1, cor: "#FFD27A", piscando: false, pulsando: false, ligada: true,
  orientacao: "horizontal",
});
const PARTIDA_GERADOR = [
  [0, 0], [0.06, 0.025], [0.13, 0.09], [0.18, 0.03],
  [0.28, 0.22], [0.34, 0.08], [0.46, 0.4], [0.5, 0.14],
  [0.62, 0.56], [0.66, 0.28], [0.78, 0.78], [0.83, 0.69],
  [0.92, 0.94], [1, 1],
];
// Quedas da partida usadas pelo som; as falhas aleatórias não participam desta sequência.
const QUEDAS_LUZ_FABRICA = PARTIDA_GERADOR.flatMap(([inicio, luz], indice) => {
  const proximo = PARTIDA_GERADOR[indice + 1];
  return proximo && luz > proximo[1]
    ? [{
      inicio,
      inicioOscilacao: PARTIDA_GERADOR[indice - 1]?.[0] ?? inicio,
      fim: proximo[0],
      intensidade: luz - proximo[1],
    }]
    : [];
});
const limitar = valor => Math.max(0, Math.min(1, valor));
const PERIODO_PULSO_MS = 1600;

/** Ciclo suave e sincronizado de emergência, entre 10% e 100% da luz configurada. */
function intensidadePulso(agora) {
  return 0.1 + 0.9 * (0.5 + 0.5 * Math.cos(agora * 2 * Math.PI / PERIODO_PULSO_MS));
}

function suavizar(valor) {
  const p = limitar(valor);
  return p * p * (3 - 2 * p);
}

function intensidadeLuzPartida(progresso) {
  const p = limitar(progresso);
  for (let i = 1; i < PARTIDA_GERADOR.length; i += 1) {
    const [fim, luzFim] = PARTIDA_GERADOR[i];
    if (p > fim) continue;
    const [inicio, luzInicio] = PARTIDA_GERADOR[i - 1];
    return luzInicio + (luzFim - luzInicio) * suavizar((p - inicio) / (fim - inicio));
  }
  return 1;
}

/** Tiled exporta cores com alpha como #AARRGGBB, não #RRGGBBAA. */
function lerCorTiled(valor) {
  if (typeof valor !== "string") valor = PADROES_LUZ_FABRICA.cor;
  let hex = valor.replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map(c => c + c).join("");
  if (!/^(?:[\da-f]{6}|[\da-f]{8})$/i.test(hex)) hex = "FFD27A";
  const alpha = hex.length === 8 ? parseInt(hex.slice(0, 2), 16) / 255 : 1;
  const rgb = hex.slice(-6).toUpperCase();
  return { css: `#${rgb}`, phaser: parseInt(rgb, 16), alpha };
}

function lerPropriedade(objeto, nome) {
  const propriedades = objeto.properties;
  return Array.isArray(propriedades)
    ? propriedades.find(propriedade => propriedade.name === nome)?.value
    : propriedades?.[nome];
}

/** Só valores dos tipos esperados substituem os padrões; false e zero são válidos. */
function lerLuzesFabrica(map, avisar = console.warn) {
  const camada = map.getObjectLayer("LuzesFabrica");
  if (!camada) {
    avisar('[Iluminação da fábrica] Camada de objetos "LuzesFabrica" ausente. Nenhuma lâmpada foi criada.');
    return [];
  }
  return (camada.objects ?? []).flatMap(objeto => {
    const area = objeto.point !== true && !objeto.ellipse && !objeto.polygon && !objeto.polyline && !objeto.gid &&
      Number.isFinite(objeto.width) && objeto.width > 0 && Number.isFinite(objeto.height) && objeto.height > 0;
    if ((!area && objeto.point !== true) || !Number.isFinite(objeto.x) || !Number.isFinite(objeto.y)) {
      avisar(`[Iluminação da fábrica] Objeto ${objeto.id} ignorado: use Point ou retângulo com X/Y válidos em LuzesFabrica.`);
      return [];
    }
    const raio = lerPropriedade(objeto, "Raio");
    const intensidade = lerPropriedade(objeto, "Intensidade");
    const piscando = lerPropriedade(objeto, "Piscando");
    const pulsando = lerPropriedade(objeto, "Pulsando");
    const ligada = lerPropriedade(objeto, "Ligada");
    const orientacaoConfigurada = lerPropriedade(objeto, "Orientacao");
    const orientacao = typeof orientacaoConfigurada === "string"
      ? orientacaoConfigurada.trim().toLowerCase()
      : null;
    const cor = lerCorTiled(lerPropriedade(objeto, "Cor"));
    if (pulsando === true) {
      cor.css = "#FF0000";
      cor.phaser = 0xFF0000;
    }
    return [{
      id: objeto.id, x: objeto.x, y: objeto.y,
      ...(area ? { area: true, largura: objeto.width, altura: objeto.height,
        rotacao: Number.isFinite(objeto.rotation) ? objeto.rotation * Math.PI / 180 : 0 } : {}),
      raio: Number.isInteger(raio) && raio > 0 ? raio : PADROES_LUZ_FABRICA.raio,
      intensidade: typeof intensidade === "number" && Number.isFinite(intensidade) && intensidade >= 0
        ? intensidade : PADROES_LUZ_FABRICA.intensidade,
      cor,
      piscando: typeof piscando === "boolean" ? piscando : PADROES_LUZ_FABRICA.piscando,
      pulsando: typeof pulsando === "boolean" ? pulsando : PADROES_LUZ_FABRICA.pulsando,
      ligada: (typeof ligada === "boolean" ? ligada : PADROES_LUZ_FABRICA.ligada) &&
        camada.visible !== false && objeto.visible !== false,
      // Exportações antigas do mapa usam "Vetical" para as luminárias verticais.
      orientacao: orientacao === "vetical" ? "vertical"
        : ["horizontal", "vertical"].includes(orientacao)
          ? orientacao : PADROES_LUZ_FABRICA.orientacao,
    }];
  });
}

/** Usa a matriz já atualizada da câmera, inclusive scroll negativo, zoom e viewport. */
function luzAfetaCamera(luz, camera) {
  const matriz = camera.matrix;
  if (luz.area) {
    const cos = Math.cos(luz.rotacao), sin = Math.sin(luz.rotacao);
    const cx = luz.x + cos * luz.largura / 2 - sin * luz.altura / 2;
    const cy = luz.y + sin * luz.largura / 2 + cos * luz.altura / 2;
    const x = matriz.a * cx + matriz.c * cy + matriz.e;
    const y = matriz.b * cx + matriz.d * cy + matriz.f;
    const rx = (Math.abs(matriz.a * cos + matriz.c * sin) * luz.largura +
      Math.abs(-matriz.a * sin + matriz.c * cos) * luz.altura) / 2;
    const ry = (Math.abs(matriz.b * cos + matriz.d * sin) * luz.largura +
      Math.abs(-matriz.b * sin + matriz.d * cos) * luz.altura) / 2;
    return x + rx > 0 && x - rx < camera.width && y + ry > 0 && y - ry < camera.height;
  }
  const x = matriz.a * luz.x + matriz.c * luz.y + matriz.e;
  const y = matriz.b * luz.x + matriz.d * luz.y + matriz.f;
  const alcance = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
  const raioX = alcance * Math.hypot(matriz.a, matriz.c);
  const raioY = alcance * Math.hypot(matriz.b, matriz.d);
  return x + raioX > 0 && x - raioX < camera.width &&
    y + raioY > 0 && y - raioY < camera.height;
}

// Exige a luminária dentro da tela, mesmo quando seu halo alcança a câmera de fora.
export function luzDentroCampoVisao(luz, camera) {
  const m = camera?.matrix;
  if (!m) return false;
  const x = m.a * luz.x + m.c * luz.y + m.e;
  const y = m.b * luz.x + m.d * luz.y + m.f;
  return x >= 0 && x < camera.width && y >= 0 && y < camera.height;
}

class FactoryLighting {
  constructor(map, { aleatorio = Math.random, avisar = console.warn } = {}) {
    this.lampadas = lerLuzesFabrica(map, avisar);
    this.aleatorio = aleatorio;
    this.energia = false;
    this.partida = null;
    this.progressoPartida = null;
    this.fontesVisiveis = [];
    this.revisao = 0;
    this.falhasIniciadas = [];
    // Estados separados dos dados do mapa: nada é escrito nos objetos do Tiled.
    this.estados = this.lampadas.map((luz, indice) => ({
      luz, indice, intensidade: 0, falha: null, proximaFalha: null, perfilContinuo: null,
    }));
  }

  definirEnergia(ligada, obterProgresso = null, agora = 0) {
    this.energia = ligada === true;
    this.progressoPartida = null;
    this.partida = this.energia && typeof obterProgresso === "function"
      ? { obterProgresso, inicio: agora } : null;
    this.falhasIniciadas.length = 0;
    for (const estado of this.estados) {
      estado.falha = null;
      estado.proximaFalha = null;
    }
  }

  /** Sorteia uma sequência de mau contato uma vez; nunca sorteia brilho por quadro. */
  criarFalha(agora, continua = false) {
    const piscadas = continua
      ? 2 + Math.min(1, Math.floor(this.aleatorio() * 2))
      : 1 + Math.min(1, Math.floor(this.aleatorio() * 2));
    const pontos = [[0, 1]];
    const estalos = [];
    let tempo = 0;
    const adicionar = (ms, intensidade) => { tempo += ms; pontos.push([tempo, intensidade]); };
    for (let i = 0; i < piscadas; i++) {
      // Espaça as falhas; cada estalo acompanha um corte seco com repique de contato.
      adicionar(850 + this.aleatorio() * 1250, 1);
      const minimo = this.aleatorio() * 0.06;
      const queda = 16 + this.aleatorio() * 16;
      // Um estalo para toda a falhada, incluindo a tentativa frustrada de reacender.
      estalos.push({ tempo: tempo + queda * 0.6, inicio: 0, luz: null, duracaoQueda: queda / 1000 });
      adicionar(queda, minimo);
      adicionar(100 + this.aleatorio() * 80, minimo);
      adicionar(32 + this.aleatorio() * 20, 0.65 + this.aleatorio() * 0.25);
      adicionar(45 + this.aleatorio() * 45, pontos.at(-1)[1]);
      adicionar(12 + this.aleatorio() * 12, minimo * 0.5);
      adicionar(90 + this.aleatorio() * 80, minimo * 0.5);
      adicionar(40 + this.aleatorio() * 35, 1);
    }
    return { inicio: agora, duracao: tempo, pontos, estalos, proximoEstalo: 0 };
  }

  registrarEstalos(estado, agora, camera) {
    const perfil = estado.falha;
    while (perfil.proximoEstalo < perfil.estalos.length) {
      const estalo = perfil.estalos[perfil.proximoEstalo];
      const inicioEstalo = perfil.inicio + estalo.tempo;
      if (agora < inicioEstalo) break;
      perfil.proximoEstalo++;
      // Eventos fora da tela ou vencidos não formam uma fila ao retornar.
      if (agora - inicioEstalo > 100 || !luzDentroCampoVisao(estado.luz, camera)) continue;
      estalo.luz = estado.luz;
      estalo.inicio = inicioEstalo;
      this.falhasIniciadas.push(estalo);
    }
  }

  /** Cada fonte tem seu relógio, permitindo falhas simultâneas em qualquer região. */
  atualizarFalha(estado, agora, camera) {
    if (estado.luz.piscando) {
      // Um único perfil por luminária, repetido sem pausas nem novas alocações.
      if (!estado.perfilContinuo) estado.perfilContinuo = this.criarFalha(agora, true);
      const perfil = estado.perfilContinuo;
      const iniciou = !estado.falha;
      if (iniciou) {
        perfil.inicio = agora;
        perfil.proximoEstalo = 0;
      }
      const decorrido = agora - perfil.inicio;
      if (decorrido >= perfil.duracao) {
        perfil.inicio += Math.floor(decorrido / perfil.duracao) * perfil.duracao;
        perfil.proximoEstalo = 0;
      }
      estado.falha = perfil;
      this.registrarEstalos(estado, agora, camera);
      return;
    }
    if (estado.falha) {
      if (agora < estado.falha.inicio + estado.falha.duracao) {
        this.registrarEstalos(estado, agora, camera);
        return;
      }
      estado.falha = null;
      estado.proximaFalha = agora + 30000 + this.aleatorio() * 60000;
      return;
    }
    if (estado.proximaFalha === null) {
      // Espalha também a primeira falha depois da estabilização do gerador.
      estado.proximaFalha = agora + 20000 + this.aleatorio() * 40000;
    }
    if (agora < estado.proximaFalha) return;
    if (agora - estado.proximaFalha > 1000) {
      // Uma aba suspensa não acumula falhas para disparar todas ao retornar.
      estado.proximaFalha = agora + 30000 + this.aleatorio() * 60000;
      return;
    }
    estado.falha = this.criarFalha(agora);
    estado.proximaFalha = null;
  }

  /** Cortes bruscos e repiques curtos, com respiros irregulares entre falhadas. */
  calcularFalha(estado, agora) {
    if (!estado.falha) return 1;
    const tempo = agora - estado.falha.inicio;
    const pontos = estado.falha.pontos;
    for (let i = 1; i < pontos.length; i++) {
      const [fim, intensidade] = pontos[i];
      if (tempo > fim) continue;
      const [inicio, anterior] = pontos[i - 1];
      return anterior + (intensidade - anterior) * suavizar((tempo - inicio) / (fim - inicio));
    }
    return 1;
  }

  atualizar(agora, camera, zonas = null) {
    this.falhasIniciadas.length = 0;
    let progresso = 1;
    this.progressoPartida = null;
    if (this.partida) {
      const medido = this.partida.obterProgresso();
      progresso = typeof medido === "number" && Number.isFinite(medido)
        ? limitar(medido)
        : limitar((agora - this.partida.inicio) / (GENERATOR_LOOP_START_SECONDS * 1000));
      this.progressoPartida = progresso;
      if (progresso >= 1) this.partida = null;
    }
    const energia = this.energia ? intensidadeLuzPartida(progresso) : 0;
    let quantidade = 0;
    let alteradas = false;
    for (const estado of this.estados) {
      const luz = estado.luz;
      const fatorZona = zonas?.fatorLuz(luz, agora) ?? 1;
      if (!energia || !luz.ligada || !luz.intensidade || !luz.cor.alpha || !fatorZona) {
        continue;
      }
      // Atualiza os relógios fora da tela também, sem gerar estalos fora do campo de visão.
      if (!this.partida && fatorZona === 1) this.atualizarFalha(estado, agora, camera);
      if (!luzAfetaCamera(luz, camera)) continue;
      const oscilacao = this.partida
        ? 1 - (1 - progresso) * 0.12 * Math.sin(progresso * 15 + estado.indice) ** 2
        : fatorZona < 1 ? 1 : this.calcularFalha(estado, agora);
      // Limita e quantiza em passos de alpha: evita saturação e uploads sem mudança visível.
      const pulso = luz.pulsando ? intensidadePulso(agora) : 1;
      const intensidade = Math.round(limitar(luz.intensidade * luz.cor.alpha) * energia * oscilacao * pulso * fatorZona * 255) / 255;
      if (this.fontesVisiveis[quantidade] !== estado || estado.intensidade !== intensidade) alteradas = true;
      estado.intensidade = intensidade;
      this.fontesVisiveis[quantidade++] = estado;
    }
    if (quantidade !== this.fontesVisiveis.length) alteradas = true;
    this.fontesVisiveis.length = quantidade;
    if (alteradas) this.revisao++;
    return this.fontesVisiveis;
  }

  destroy() {
    this.partida = null;
    this.progressoPartida = null;
    this.energia = false;
    this.fontesVisiveis.length = 0;
    this.estados.length = 0;
    this.falhasIniciadas.length = 0;
    this.lampadas.length = 0;
  }
}

export {
  ESCURIDAO_AMBIENTE_FABRICA, MULTIPLICADOR_ALCANCE_FABRICA, PADROES_LUZ_FABRICA, lerCorTiled,
  lerLuzesFabrica, luzAfetaCamera, intensidadeLuzPartida, QUEDAS_LUZ_FABRICA,
};
export default FactoryLighting;
