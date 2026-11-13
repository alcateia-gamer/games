/**
 * Projéteis próprios do novo encontro: emissão giratória, velocidade constante
 * e colisão varrida. Não utiliza offsets nem entidades dos lasers dos robôs.
 */
import { criarVisualDisparoEnergia, atualizarVisualDisparoEnergia } from "../NovoBossDisparoEnergia.js";

const padrao = Object.freeze({
  velocidade: 115,
  quantidade: 28,
  intervaloMs: 120,
  avisoMs: 700,
  passoAngulo: 22.5,
  raio: 6,
  alcance: 900,
  dano: 10,
  vidaProjetilMs: 8000,
});

function numero(valor, fallback, minimo = 0) {
  return Number.isFinite(valor) ? Math.max(minimo, valor) : fallback;
}

export function criarLasersEspiral(scene, encontro, config = {}, servicos = {}) {
  const ajustes = { ...padrao, ...config };
  for (const chave of Object.keys(padrao)) {
    ajustes[chave] = numero(ajustes[chave], padrao[chave]);
  }
  ajustes.quantidade = Math.max(1, Math.floor(ajustes.quantidade));
  ajustes.velocidade = Math.max(1, ajustes.velocidade);
  ajustes.raio = Math.max(1, ajustes.raio);
  ajustes.intervaloMs = Math.max(1, ajustes.intervaloMs);
  const duracaoDisparosMs = numero(config.duracaoDisparosMs, 0);
  if (duracaoDisparosMs > 0) {
    ajustes.quantidade = Math.ceil(duracaoDisparosMs / ajustes.intervaloMs);
  }
  // Aceita o nome histórico recebido por configurações de desenvolvimento.
  if (Number.isFinite(config.vidaProjtilMs)) ajustes.vidaProjetilMs = Math.max(0, config.vidaProjtilMs);

  const origemInicial = { x: encontro.x ?? encontro.sprite?.x ?? 0, y: encontro.y ?? encontro.sprite?.y ?? 0 };
  const jogador = scene.player;
  const anguloInicial = Number.isFinite(config.anguloInicial)
    ? config.anguloInicial * Math.PI / 180
    : Math.atan2((jogador?.y ?? origemInicial.y + 1) - origemInicial.y,
      (jogador?.x ?? origemInicial.x) - origemInicial.x);
  const limiteVida = Math.min(ajustes.vidaProjetilMs, ajustes.alcance / ajustes.velocidade * 1000);
  let emissoes = config.emissoes;
  if (!emissoes && config.padroesAdicionais) {
    const janela = duracaoDisparosMs || ajustes.quantidade * ajustes.intervaloMs;
    emissoes = Array.from({ length: ajustes.quantidade }, (_, indiceBase) =>
      ({ em: indiceBase * ajustes.intervaloMs, indiceBase, padrao: "espiral" }));
    // Rajadas simultâneas à espiral; o limite temporal evita timers e acúmulo sem fim.
    for (let em = 900, rodada = 0; em < janela; em += 1200, rodada++) {
      const anel = rodada % 2 === 0;
      const angulos = anel ? Array.from({ length: 8 }, (_, i) => i * 45 + rodada * 11.25)
        : [0, 180, 45, 135, 225, 315];
      for (const angulo of angulos) emissoes.push({ em, angulo,
        padrao: anel ? "circulo" : angulo % 180 === 0 ? "horizontal" : "diagonal" });
    }
    emissoes.sort((a, b) => a.em - b.em);
    ajustes.quantidade = emissoes.length;
  }
  const fimEmissao = ajustes.avisoMs + (emissoes?.at(-1)?.em ??
    (ajustes.quantidade - 1) * ajustes.intervaloMs);
  const fimDisparos = duracaoDisparosMs > 0 ? ajustes.avisoMs + duracaoDisparosMs : fimEmissao;
  const duracao = Math.max(fimDisparos, fimEmissao + limiteVida);
  const arena = encontro.config?.arena;
  const grafico = scene.add?.graphics?.();
  grafico?.setDepth?.(53);
  let aviso = config.mostrarAvisoArea === false ? null : servicos.criarAviso?.(origemInicial.x, origemInicial.y,
    Math.max(32, ajustes.raio * 4), ajustes.avisoMs);
  let decorrido = 0;
  let emitidos = 0;
  let colisoes = 0;
  let terminado = false;
  let destruido = false;
  const projeteis = [];

  function anguloDisparo(indice) {
    const emissao = emissoes?.[indice];
    if (Number.isFinite(emissao?.angulo)) return emissao.angulo * Math.PI / 180;
    indice = emissao?.indiceBase ?? indice;
    const passo = ajustes.passoAngulo;
    let deslocamento = 0;
    if (config.intercalar && passo > 0) {
      const volta = Math.floor(indice / Math.ceil(360 / passo));
      // Alterna os vãos e preenche novos caminhos a cada par de voltas:
      // 0°, 11,25°, 3,75°, 15°, 7,5°, 18,75° para o passo de 22,5°.
      // O ciclo seguinte também deriva, em vez de voltar às mesmas linhas.
      deslocamento = ((volta % 2) / 2 + Math.floor((volta % 6) / 2) / 6 +
        Math.floor(volta / 6) / 12) * passo;
    }
    return anguloInicial + (indice * passo + deslocamento) * Math.PI / 180;
  }

  function removerAviso() {
    aviso?.destruir?.();
    aviso = null;
  }

  function foraDaArena(ponto) {
    return arena && (ponto.x < arena.xMin || ponto.x > arena.xMax ||
      ponto.y < arena.yMin || ponto.y > arena.yMax);
  }

  function removerProjetil(projetil) {
    if (projetil.removido) return;
    projetil.removido = true;
    projetil.ativo = false;
    if (projetil.visual) {
      servicos.desregistrarLaser?.(projetil.visual);
      if (projetil.visual.active !== false) projetil.visual.destroy?.();
    }
  }

  function criarVisual(projetil) {
    const visual = criarVisualDisparoEnergia(scene, projetil.x, projetil.y,
      ajustes.raio, projetil.dx, projetil.dy) ??
      scene.add?.circle?.(projetil.x, projetil.y, ajustes.raio, 0xffc0c7, 1);
    if (!visual) return;
    visual.setDepth?.(53);
    visual.especialAtirador = encontro;
    visual.especialLaserInimigo = true;
    projetil.visual = visual;
    servicos.registrarLaser?.(visual);
    if (visual.body) {
      visual.body.moves = false;
      visual.body.setVelocity?.(projetil.dx * ajustes.velocidade, projetil.dy * ajustes.velocidade);
    }
  }

  function avancar(projetil, delta) {
    if (!projetil.ativo || projetil.visual?.active === false) {
      removerProjetil(projetil);
      return;
    }
    const disponivel = Math.max(0, Math.min(delta, limiteVida - projetil.idade));
    let restante = disponivel;
    // Subdividir também ordena parede/impacto. Um frame longo não permite
    // atingir o jogador do outro lado de uma parede ou saltar seu corpo.
    while (restante > 0 && projetil.ativo) {
      const visual = projetil.visual;
      const refletido = Boolean(visual?.especialRefletido);
      let velocidade = ajustes.velocidade;
      if (refletido && visual.body?.velocity) {
        const { x: vx, y: vy } = visual.body.velocity;
        velocidade = Math.hypot(vx, vy);
        if (velocidade > 0) {
          projetil.dx = vx / velocidade;
          projetil.dy = vy / velocidade;
        }
      }
      if (velocidade <= 0) break;
      const distancia = Math.min(velocidade * restante / 1000,
        Math.max(2, ajustes.raio), ajustes.alcance - projetil.percorrido);
      if (distancia <= 0) break;
      const passoMs = distancia / velocidade * 1000;
      const inicio = { x: projetil.x, y: projetil.y };
      const fim = { x: inicio.x + projetil.dx * distancia,
        y: inicio.y + projetil.dy * distancia };
      const bloqueado = foraDaArena(fim) || servicos.segmentoBloqueado?.(inicio, fim, ajustes.raio);
      if (bloqueado) {
        projetil.ativo = false;
        break;
      }
      const origem = { x: inicio.x, y: inicio.y, tipo: "lasers", encontro };
      const atingiu = refletido
        ? servicos.atingirAlvoComLaserRefletido?.(inicio, fim, ajustes.raio,
          visual.danoEspecial || 30, visual)
        : ajustes.dano > 0 && servicos.atingirJogadorComLaser?.(
          inicio, fim, ajustes.raio, ajustes.dano, origem, visual ?? projetil,
        );
      if (atingiu && (refletido || !visual?.especialRefletido)) {
        colisoes++;
        projetil.ativo = false;
        break;
      }
      projetil.x = fim.x;
      projetil.y = fim.y;
      projetil.percorrido += distancia;
      restante = Math.max(0, restante - passoMs);
      visual?.setPosition?.(fim.x, fim.y);
      visual?.body?.updateFromGameObject?.();
    }
    projetil.idade += disponivel;
    atualizarVisualDisparoEnergia(projetil.visual, projetil.idade, projetil.dx, projetil.dy);
    if (projetil.idade >= limiteVida || projetil.percorrido >= ajustes.alcance - 0.000001) {
      projetil.ativo = false;
    }
  }

  function desenhar() {
    if (!grafico) return;
    grafico.clear();
    for (const projetil of projeteis) {
      // O GIF já contém sua própria cauda; não sobrepõe o risco rosa antigo.
      if (projetil.visual?.novoBossDisparoEnergia) continue;
      grafico.lineStyle(3, projetil.visual?.especialRefletido ? 0x38bdf8 : 0xff5275, 0.85);
      grafico.beginPath();
      grafico.moveTo(projetil.x - projetil.dx * 15, projetil.y - projetil.dy * 15);
      grafico.lineTo(projetil.x, projetil.y);
      grafico.strokePath();
      if (!projetil.visual) {
        grafico.fillStyle(0xffc0c7, 1);
        grafico.fillCircle(projetil.x, projetil.y, ajustes.raio);
      }
    }
  }

  function destruir() {
    if (destruido) return;
    destruido = true;
    terminado = true;
    removerAviso();
    for (const projetil of projeteis) removerProjetil(projetil);
    projeteis.length = 0;
    grafico?.destroy?.();
  }

  return {
    tipo: "lasers",
    duracao,
    get disparando() { return !terminado && decorrido >= ajustes.avisoMs && decorrido < fimDisparos; },
    atualizar(delta) {
      if (terminado) return true;
      const anterior = decorrido;
      decorrido += numero(delta, 0);
      if (aviso) {
        aviso.atualizar?.(ajustes.avisoMs === 0 ? 1 : Math.min(1, decorrido / ajustes.avisoMs));
        if (decorrido >= ajustes.avisoMs) removerAviso();
      }
      for (const projetil of projeteis) avancar(projetil, decorrido - anterior);
      while (emitidos < ajustes.quantidade &&
          ajustes.avisoMs + (emissoes?.[emitidos]?.em ?? emitidos * ajustes.intervaloMs) <= decorrido) {
        const nascimento = ajustes.avisoMs + (emissoes?.[emitidos]?.em ?? emitidos * ajustes.intervaloMs);
        const angulo = anguloDisparo(emitidos);
        const projetil = {
          x: encontro.x ?? encontro.sprite?.x ?? origemInicial.x,
          y: encontro.y ?? encontro.sprite?.y ?? origemInicial.y,
          dx: Math.cos(angulo), dy: Math.sin(angulo),
          idade: 0, percorrido: 0, ativo: true,
          padrao: emissoes?.[emitidos]?.padrao ?? "espiral",
        };
        emitidos++;
        servicos.somDisparoLaser?.({ x: projetil.x, y: projetil.y }, Math.max(0, decorrido - nascimento));
        criarVisual(projetil);
        avancar(projetil, Math.max(0, decorrido - nascimento));
        if (projetil.ativo) projeteis.push(projetil);
        else removerProjetil(projetil);
      }
      for (let i = projeteis.length - 1; i >= 0; i--) {
        if (!projeteis[i].ativo) {
          removerProjetil(projeteis[i]);
          projeteis.splice(i, 1);
        }
      }
      if (decorrido >= fimDisparos && emitidos === ajustes.quantidade && projeteis.length === 0) {
        destruir();
        return true;
      }
      desenhar();
      return false;
    },
    destruir,
    snapshot: () => ({
      tipo: "lasers", decorrido, emitidos, colisoes, terminado, raio: ajustes.raio,
      quantidade: ajustes.quantidade, duracaoDisparosMs,
      emitindo: !terminado && decorrido >= ajustes.avisoMs && decorrido < fimDisparos,
      avisando: !terminado && decorrido < ajustes.avisoMs,
      projeteis: projeteis.map(({ x, y, dx, dy, idade, visual, padrao }) => ({
        x, y, dx, dy, idade, padrao, raio: ajustes.raio, refletido: Boolean(visual?.especialRefletido),
      })),
    }),
  };
}
