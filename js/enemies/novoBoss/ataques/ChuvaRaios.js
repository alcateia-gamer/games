/** Bombardeio anunciado; cada alvo permanece fixo desde o início do aviso. */
import { assetsNovoBoss } from "../NovoBossAssets.js";

export const chuvaRaiosPadrao = Object.freeze({
  raio: 48,
  avisoMs: 1000,
  intervaloMs: 260,
  quantidade: 5,
  dano: 16,
  perigoMs: 150,
  frameMs: 100,
  frameImpacto: 4,
  ultimoFrame: 12,
  escala: 0.6,
  origemX: 0.5,
  origemY: 0.75,
  textura: "novo-boss-heavens-fury",
});

function configurar(config) {
  const entrada = config?.ataques?.chuvaRaios ?? config ?? {};
  const opcoes = { ...chuvaRaiosPadrao, ...entrada };
  for (const chave of ["raio", "avisoMs", "intervaloMs", "perigoMs", "frameMs", "escala"]) {
    if (!Number.isFinite(opcoes[chave]) || opcoes[chave] <= 0) opcoes[chave] = chuvaRaiosPadrao[chave];
  }
  for (const chave of ["quantidade", "frameImpacto", "ultimoFrame"]) {
    if (!Number.isFinite(opcoes[chave])) opcoes[chave] = chuvaRaiosPadrao[chave];
    opcoes[chave] = Math.max(chave === "quantidade" ? 1 : 0, Math.floor(opcoes[chave]));
  }
  opcoes.frameImpacto = Math.min(opcoes.frameImpacto, opcoes.ultimoFrame);
  if (opcoes.ajustarEscalaAoRaio) {
    const recurso = assetsNovoBoss.heavensFury;
    opcoes.escala = opcoes.raio * 2 / recurso.diametroImpacto;
    opcoes.origemX = recurso.origemX;
    opcoes.origemY = recurso.origemY;
  }
  return opcoes;
}

/** Sem dependência de timers, física própria ou eventos globais da cena. */
export function criarChuvaRaios(scene, encontro, config = {}, servicos = {}) {
  const opcoes = configurar(config);
  const emAneis = opcoes.padrao === "aneis";
  if (emAneis) {
    opcoes.mirarJogador = false;
    if (Number.isFinite(opcoes.danoAneis)) opcoes.dano = Math.min(opcoes.dano, Math.max(0, opcoes.danoAneis));
  }
  const arena = encontro.config?.arena ?? {
    xMin: encontro.x - 450, xMax: encontro.x + 450,
    yMin: encontro.y - 300, yMax: encontro.y + 300,
  };
  const rng = servicos.rng ?? Math.random;
  const raio = opcoes.raio;
  const margem = raio + 8;
  const ateImpacto = opcoes.avisoMs + opcoes.frameImpacto * opcoes.frameMs;
  const intervaloSeguro = ateImpacto + opcoes.perigoMs;
  const limites = {
    xMin: arena.xMin + margem, xMax: arena.xMax - margem,
    yMin: arena.yMin + margem,
    yMax: Math.min(arena.yMax, arena.entradaY ?? arena.yMax) - margem,
  };
  const pontos = [];
  const clamp = (valor, min, max) => Math.max(min, Math.min(max, valor));
  const sorteio = () => clamp(Number(rng()) || 0, 0, 1);
  const livre = (ponto) => Number.isFinite(ponto.x) && Number.isFinite(ponto.y) &&
    limites.xMin <= limites.xMax && limites.yMin <= limites.yMax &&
    pontos.every((outro, indice) =>
      (opcoes.reutilizarPontos && (pontos.length - indice) * opcoes.intervaloMs >= intervaloSeguro) ||
      Math.hypot(outro.x - ponto.x, outro.y - ponto.y) >= raio * 2 + 24) &&
    (!servicos.pontoLivre || servicos.pontoLivre(ponto.x, ponto.y, raio));
  const limitar = (x, y) => ({
    x: clamp(x, limites.xMin, limites.xMax),
    y: clamp(y, limites.yMin, limites.yMax),
  });
  const player = scene.player;
  const alvoInicial = limitar(player?.x ?? encontro.x, player?.y ?? encontro.y);
  if (!emAneis && !opcoes.mirarJogador && livre(alvoInicial)) pontos.push(alvoInicial);

  // Não sobrepõe regiões enquanto seus avisos/perigos coexistirem. Uma região
  // já encerrada pode voltar à sequência, sempre com um novo aviso completo.
  // Busca por emissão para que até um RNG constante consiga reutilizar o mapa.
  while (!emAneis && !opcoes.mirarJogador && pontos.length < opcoes.quantidade) {
    let escolhido = null;
    for (let tentativa = 0; tentativa < 24 && !escolhido; tentativa++) {
      const ponto = {
        x: limites.xMin + sorteio() * (limites.xMax - limites.xMin),
        y: limites.yMin + sorteio() * (limites.yMax - limites.yMin),
      };
      if (livre(ponto)) escolhido = ponto;
    }
    // Reaproveita um ponto validado antes de varrer o mapa novamente.
    if (opcoes.reutilizarPontos) escolhido ??= pontos.find(livre);
    const passoBusca = Math.max(8, Math.min(32, raio));
    for (let y = limites.yMin; !escolhido && y <= limites.yMax; y += passoBusca) {
      for (let x = limites.xMin; !escolhido && x <= limites.xMax; x += passoBusca) {
        const ponto = { x, y };
        if (livre(ponto)) escolhido = ponto;
      }
    }
    if (!escolhido) break;
    pontos.push(escolhido);
  }

  let tempo = 0;
  let destruida = false;
  if (emAneis && servicos.obterMarcasChuva) {
    // Como na perseguição, os falsos anunciam o mesmo campo da verdadeira.
    // Evita multiplicar a área visual por dez e encobrir toda a arena.
    pontos.push(...servicos.obterMarcasChuva());
  } else if (emAneis) {
    const centro = { x: encontro.x, y: encontro.y };
    const alcance = Math.max(...[[arena.xMin, arena.yMin], [arena.xMin, arena.yMax],
      [arena.xMax, arena.yMin], [arena.xMax, arena.yMax]]
      .map(([x, y]) => Math.hypot(x - centro.x, y - centro.y)));
    let anel = 0;
    // Frente contínua: círculos vizinhos se tocam e cada novo anel avança do centro.
    for (let distancia = raio * 1.25; distancia <= alcance + raio; distancia += raio * 1.5, anel++) {
      const quantidade = Math.min(24, Math.max(6, Math.ceil(Math.PI * 2 * distancia / (raio * 1.7))));
      for (let indice = 0; indice < quantidade; indice++) {
        const angulo = indice / quantidade * Math.PI * 2;
        const x = centro.x + Math.cos(angulo) * distancia;
        const y = centro.y + Math.sin(angulo) * distancia;
        if (x < limites.xMin || x > limites.xMax || y < limites.yMin || y > limites.yMax ||
            (servicos.pontoLivre && !servicos.pontoLivre(x, y, raio * 0.35))) continue;
        pontos.push({ x, y, anel, inicio: anel * (opcoes.intervaloAnelMs ?? 320) });
      }
    }
  }
  const alvos = opcoes.mirarJogador
    ? Array.from({ length: opcoes.quantidade }, () => ({ x: null, y: null })) : pontos;
  const marcas = alvos.map((ponto, indice) => ({
    ...ponto,
    indice,
    inicio: ponto.inicio ?? indice * opcoes.intervaloMs,
    aviso: null, visual: null, iniciou: false, impactoAvaliado: false, atingiu: false, concluida: false,
  }));
  const duracaoEfeito = Math.max(
    (opcoes.ultimoFrame + 1) * opcoes.frameMs,
    opcoes.frameImpacto * opcoes.frameMs + opcoes.perigoMs,
  );
  const duracao = Math.max(0, ...marcas.map((marca) => marca.inicio + opcoes.avisoMs + duracaoEfeito));

  function contextoMira() {
    return scene.coopRuntime?.bossTarget?.() ?? scene;
  }

  function cloneAtivo(contexto) {
    const clone = contexto?.estadoEspecial?.holograma ?? contexto?.especialHolograma;
    return clone?.active && (clone.expiraEm == null ||
      clone.expiraEm > (scene.time?.now ?? 0)) ? clone : null;
  }

  function mirarJogador(contexto = contextoMira()) {
    const clone = cloneAtivo(contexto);
    const area = clone ? null : contexto.hitboxDanoPlayer ?? contexto.player?.body;
    const temArea = area && [area.x, area.y, area.width, area.height].every(Number.isFinite) &&
      area.width > 0 && area.height > 0;
    const posicao = clone ? { x: clone.x, y: clone.y } : {
      x: temArea ? area.x + area.width / 2 : contexto.player?.x ?? encontro.x,
      y: temArea ? area.y + area.height / 2 : contexto.player?.y ?? encontro.y,
    };
    const alvo = limitar(posicao.x, posicao.y);
    const cabe = ponto => limites.xMin <= limites.xMax && limites.yMin <= limites.yMax &&
      Number.isFinite(ponto.x) && Number.isFinite(ponto.y) &&
      (!servicos.pontoLivre || servicos.pontoLivre(ponto.x, ponto.y, raio));
    if (cabe(alvo)) return alvo;
    // Na borda de uma parede/gerador, escolhe a área válida mais próxima do
    // jogador. Não troca a mira por um ponto aleatório distante da luta.
    let escolhido = null, distancia = Infinity;
    const passo = Math.max(8, Math.min(32, raio));
    for (let y = limites.yMin; y <= limites.yMax; y += passo) {
      for (let x = limites.xMin; x <= limites.xMax; x += passo) {
        const d = (x - posicao.x) ** 2 + (y - posicao.y) ** 2;
        if (d < distancia && cabe({ x, y })) { escolhido = { x, y }; distancia = d; }
      }
    }
    return escolhido;
  }

  function iniciarMarca(marca) {
    if (marca.iniciou) return;
    marca.iniciou = true;
    if (opcoes.mirarJogador) {
      marca.contextoMira = contextoMira();
      const alvo = servicos.obterAlvoChuva ? servicos.obterAlvoChuva(marca.indice) : mirarJogador(marca.contextoMira);
      if (!alvo) { marca.concluida = true; return; }
      marca.x = alvo.x;
      marca.y = alvo.y;
    }
    marca.aviso = servicos.criarAviso?.(marca.x, marca.y, raio, ateImpacto) ?? null;
  }

  function criarVisual(marca) {
    if (marca.visual) return;
    if (scene.textures?.exists(opcoes.textura) && scene.add?.sprite) {
      const sprite = scene.add.sprite(marca.x, marca.y, opcoes.textura, 0);
      // O núcleo do impacto está em y~288 da célula 384; o chão coincide com ele.
      sprite.setOrigin(opcoes.origemX, opcoes.origemY);
      sprite.setScale(opcoes.escala);
      sprite.setDepth(52);
      marca.visual = { tipo: "sprite", objeto: sprite };
    } else if (scene.add?.graphics) {
      const grafico = scene.add.graphics();
      grafico.setDepth(52);
      marca.visual = { tipo: "grafico", objeto: grafico };
    }
  }

  function limparMarca(marca) {
    marca.aviso?.destruir();
    marca.aviso = null;
    marca.visual?.objeto.destroy();
    marca.visual = null;
  }

  function atualizarMarca(marca) {
    const local = tempo - marca.inicio;
    if (local < 0 || marca.concluida) return;
    iniciarMarca(marca);
    if (marca.concluida) return;
    // A Aria pode invocar enquanto já está sob mira. Redireciona só os ataques
    // ainda sem impacto e conserva o dono da mira original no cooperativo.
    if (opcoes.mirarJogador && !marca.impactoAvaliado && !servicos.obterAlvoChuva &&
        cloneAtivo(marca.contextoMira)) {
      const alvo = mirarJogador(marca.contextoMira);
      if (alvo) {
        marca.x = alvo.x; marca.y = alvo.y;
        marca.aviso?.posicionar?.(marca.x, marca.y);
        marca.visual?.objeto.setPosition?.(marca.x, marca.y);
      }
    }
    marca.aviso?.atualizar(Math.min(1, local / ateImpacto));
    if (local >= opcoes.avisoMs) {
      criarVisual(marca);
      let frame = Math.min(opcoes.ultimoFrame, Math.floor((local - opcoes.avisoMs) / opcoes.frameMs));
      // A esfera branca é um flash de tela na referência. Em anéis simultâneos,
      // mantém o feixe anterior para conservar a leitura do chão e dos avisos.
      if (emAneis && frame === 3) frame = 2;
      if (marca.visual?.tipo === "sprite") marca.visual.objeto.setFrame(frame);
      if (marca.visual?.tipo === "grafico") {
        const grafico = marca.visual.objeto;
        grafico.clear();
        if (local >= ateImpacto) {
          const progresso = Math.min(1, (local - ateImpacto) / opcoes.perigoMs);
          grafico.fillStyle(0xfff2ba, (1 - progresso) * 0.7);
          grafico.fillCircle(marca.x, marca.y, raio);
          grafico.lineStyle(3, 0xffd15a, 1 - progresso);
          grafico.strokeCircle(marca.x, marca.y, raio);
        }
      }
    }
    if (local >= ateImpacto) {
      marca.aviso?.destruir();
      marca.aviso = null;
      // A seleção acontece uma vez, no zero do aviso (quadro de impacto).
      // Sair durante a animação não desfaz dano; entrar depois não recebe dano atrasado.
      if (!marca.impactoAvaliado) {
        marca.impactoAvaliado = true;
        servicos.somImpactoChuva?.({ x: marca.x, y: marca.y }, local - ateImpacto);
        if (servicos.jogadorAtingeCirculo?.(marca.x, marca.y, raio)) {
          marca.atingiu = Boolean(servicos.danoJogador?.(opcoes.dano, { x: marca.x, y: marca.y }));
        }
      }
    }
    if (local >= opcoes.avisoMs + duracaoEfeito) {
      marca.concluida = true;
      limparMarca(marca);
    }
  }

  if (marcas[0]) iniciarMarca(marcas[0]);

  return {
    tipo: "chuvaRaios",
    configuracaoVisual: opcoes,
    duracao,
    obterMarcasChuva() {
      return marcas.map(({ x, y, inicio, anel }) => ({ x, y, inicio, anel }));
    },
    // As cópias leem as coordenadas já anunciadas pela verdadeira. O registro
    // continua disponível após o fim, para consumir corretamente frames longos.
    obterAlvoChuva(indice) {
      const marca = marcas[indice];
      return marca?.iniciou && Number.isFinite(marca.x) && Number.isFinite(marca.y)
        ? { x: marca.x, y: marca.y } : null;
    },
    atualizar(delta) {
      if (destruida) return true;
      tempo += Number.isFinite(delta) ? Math.max(0, delta) : 0;
      for (const marca of marcas) atualizarMarca(marca);
      if (tempo >= duracao) this.destruir();
      return destruida;
    },
    destruir() {
      if (destruida) return;
      destruida = true;
      for (const marca of marcas) limparMarca(marca);
    },
    snapshot() {
      return { tipo: "chuvaRaios", padrao: emAneis ? "aneis" : "perseguicao", tempo, duracao, destruida, raio, escala: opcoes.escala,
        marcas: marcas.map((marca) => ({
          x: marca.x, y: marca.y, inicio: marca.inicio, anel: marca.anel,
          iniciou: marca.iniciou, impactoAvaliado: marca.impactoAvaliado,
          atingiu: marca.atingiu, concluida: marca.concluida,
          impactoEm: marca.inicio + ateImpacto,
        })) };
    },
  };
}
