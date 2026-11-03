/** Ataques completos, estritamente visuais e com recursos de cada cópia. */
import { definicaoAtaqueNovoBoss } from "./NovoBossFabricaAtaques.js";
import { criarServicosAtaques } from "./NovoBossServicosAtaques.js";
import { criarAvisoNovoBoss } from "./NovoBossAvisos.js";
import { criarExplosaoEnergia } from "./NovoBossEfeitosEnergia.js";

export function criarAtaquesIlusoriosNovoBoss(scene, encontro, alvo) {
  const objetos = new Set();
  const explosoes = new Set();
  const geometria = criarServicosAtaques(scene, encontro);
  let execucao = null;
  let fonte = null;
  let tipo = null;
  let tempo = 0;
  let inicio = 0;
  let destruido = false;

  function registrar(objeto) {
    if (!objeto) return objeto;
    objetos.add(objeto);
    objeto.novoBossAtaqueIlusorio = true;
    objeto.novoBossDonoIlusao = alvo.id;
    // A mesma fábrica define cor, alfa e profundidade das execuções reais e falsas.
    // A ausência de dano é garantida pelos serviços abaixo, sem pistas visuais.
    const nome = objeto.setName?.bind(objeto);
    const destruir = objeto.destroy.bind(objeto);
    objeto.setName = valor => { nome?.(`${valor}-ilusorio-${alvo.id}`); return objeto; };
    objeto.destroy = (...args) => {
      if (!objetos.delete(objeto)) return;
      destruir(...args);
    };
    objeto.setName("novo-boss-efeito").setDepth(52);
    return objeto;
  }

  // Só a criação de visuais é exposta às fábricas. Não há acesso à física,
  // controles, eventos de combate ou listas de projéteis ofensivos por esta cena.
  const cenaVisual = {
    textures: scene.textures,
    get player() { return scene.player; },
    add: Object.fromEntries(["graphics", "sprite", "circle"].map(metodo => [metodo,
      (...args) => registrar(scene.add?.[metodo]?.(...args))])),
  };

  function encerrarExecucao() {
    execucao?.destruir();
    execucao = null;
    fonte = null;
    tipo = null;
  }

  function cancelar() {
    encerrarExecucao();
    for (const item of explosoes) item.efeito.destruir();
    explosoes.clear();
    for (const objeto of [...objetos]) objeto.destroy();
  }

  return {
    get ativo() { return fonte !== null; },
    get tipo() { return tipo; },
    iniciar(nome, original, sorteios = []) {
      const def = definicaoAtaqueNovoBoss(nome);
      if (destruido || !alvo.active || !def || !original) return false;
      encerrarExecucao();
      fonte = original;
      tipo = nome;
      tempo = 0;
      inicio = (encontro.relogioCombate ?? 0) - (encontro.tempoAtaque ?? 0);
      let indiceSorteio = 0;
      const inofensivo = () => false;
      const servicos = {
        // Reutiliza o sorteio do ataque real sem consumir RNG extra da luta.
        rng: () => sorteios[indiceSorteio++] ?? 0.5,
        obterAlvoChuva: typeof original.obterAlvoChuva === "function"
          ? indice => original.obterAlvoChuva(indice) : undefined,
        pontoLivre: geometria.pontoLivre,
        segmentoBloqueado: geometria.segmentoBloqueado,
        criarAviso: (x, y, raio) => criarAvisoNovoBoss(cenaVisual, x, y, raio),
        jogadorAtingeCirculo: inofensivo,
        danoJogador: inofensivo,
        capturarJogador: inofensivo,
        liberarJogador: inofensivo,
        capturaAtiva: inofensivo,
        atingirJogadorComLaser: inofensivo,
        atingirAlvoComLaserRefletido: inofensivo,
        registrarLaser(visual) {
          // O projétil é só um desenho: não participa de parry ou hologramas.
          visual.especialLaserInimigo = false;
          visual.especialAtirador = null;
          visual.especialRefletido = false;
          visual.danoEspecial = 0;
          visual.setName("novo-boss-laser");
        },
        desregistrarLaser() {},
        criarExplosaoPulso(origem, raio, idade) {
          const efeito = criarExplosaoEnergia(cenaVisual, origem, raio, idade);
          if (efeito) explosoes.add({ efeito, inicio: inicio + tempo - idade });
        },
      };
      // A dimensão e o padrão são os mesmos. Zerar dano é uma segunda proteção,
      // além da ausência de serviços ofensivos e de corpos físicos.
      const ajustes = { ...encontro.config.ataques[def[1]], dano: 0, empurrao: 0 };
      execucao = def[0](cenaVisual, alvo, ajustes, servicos);
      return true;
    },
    avancar(delta) {
      if (destruido || !fonte || !Number.isFinite(delta) || delta < 0) return;
      tempo += delta;
      // Uma cópia perto da parede pode encerrar seus projéteis antes da real.
      // Continua no relógio da fonte até ela concluir, sem emitir efeitos novos.
      if (!execucao) return;
      if (execucao.atualizar(delta)) {
        execucao.destruir();
        execucao = null;
      }
    },
    // O fim natural conserva a cauda visual da explosão, como na verdadeira.
    encerrar: encerrarExecucao,
    atualizarEfeitos() {
      if (destruido) return;
      const agora = encontro.relogioCombate ?? 0;
      for (const item of explosoes) {
        if (item.efeito.atualizarIdade(agora - item.inicio)) explosoes.delete(item);
      }
    },
    cancelar,
    destruir() { if (!destruido) { cancelar(); destruido = true; } },
    snapshot() {
      return { somenteVisual: true, tipo, tempo, ativo: fonte !== null,
        execucao: execucao?.snapshot() ?? null, objetos: objetos.size,
        explosoes: explosoes.size, destruido };
    },
  };
}
