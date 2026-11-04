/** Aparições próprias do encontro; nenhuma vida ou ataque do boss é duplicado. */
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { calcularDepthAtor } from "../../map/ProfundidadeMapa.js";
import { aplicarPoseNovoBoss, pontoNucleoNovoBoss } from "./NovoBossApresentacao.js";
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";
import { criarAtaquesIlusoriosNovoBoss } from "./NovoBossAtaquesIlusorios.js";
import {
  areasSobrepostasNovoBoss, destinoValidoNovoBoss, sincronizarCorpoNovoBoss,
} from "./NovoBossTeleporte.js";

export function encontroIlusorioVisivel(scene, encontro) {
  return Boolean(!scene.multiplayer && !scene.morteEmAndamento &&
    (scene.vida ?? 1) > 0 && scene.player?.active && !scene.player.morto &&
    encontro.sprite?.active && !encontro.morto && !encontro.encerrado &&
    !encontro.suspenso && encontro.jogadorNaArena);
}

/** Os falsos não têm colisão de contato; só a verdadeira precisa evitar o jogador. */
export function destinoIlusorioValido(scene, encontro, ponto, ignorarJogador = false) {
  if (!ignorarJogador) return destinoValidoNovoBoss(scene, encontro, ponto);
  if (![ponto?.x, ponto?.y].every(Number.isFinite)) return false;
  const area = areaCorpoNovoBoss(encontro.config, ponto);
  const arena = encontro.config.arena;
  return area.x >= arena.xMin && area.y >= arena.yMin &&
    area.x + area.width <= arena.xMax && area.y + area.height <= arena.yMax &&
    retanguloLivreDoMapa(scene, area) &&
    !(encontro.obstaculosTeleporte ?? []).some(objeto => {
      const body = objeto.body ?? objeto;
      return body.enable !== false && areasSobrepostasNovoBoss(area, body);
    });
}

function criarRetangulo(area) {
  return {
    ...area, enable: true,
    setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; },
    get left() { return this.x; }, get right() { return this.x + this.width; },
    get top() { return this.y; }, get bottom() { return this.y + this.height; },
    get centerX() { return this.x + this.width / 2; },
    get centerY() { return this.y + this.height / 2; },
  };
}

/** Alvo virtual consumido pelas armas existentes; nunca entra na lista de robôs. */
export function criarAlvoIlusorio(scene, encontro, ponto, id, tipo = "ilusao") {
  const visual = encontro.config.visual;
  const sprite = scene.add.sprite(ponto.x, ponto.y, assetsNovoBoss.idle.chave, 0)
    .setOrigin(visual.origemX, visual.origemY).setScale(visual.escala)
    .setDepth(visual.profundidade).setName(`novo-boss-${tipo}-${id}`);
  sprite.play?.(assetsNovoBoss.idle.animacao);
  const hitbox = criarRetangulo(areaCorpoNovoBoss(encontro.config, ponto));
  let imitacao = null;
  let grafico = null;
  let destruido = false;
  const alvo = {
    id, tipo, config: encontro.config, sprite, vida: 1, vidaMaxima: 1, morto: false,
    hitboxDano: hitbox, hitbox, body: hitbox,
    get active() { return !destruido && !this.morto && sprite.active !== false && encontroIlusorioVisivel(scene, encontro); },
    get visible() { return sprite.visible !== false; },
    get x() { return sprite.x; }, get y() { return sprite.y; },
    receberDano(quantidade, area = null) {
      if (!this.active || !this.visible || !hitbox.enable || !Number.isFinite(quantidade) || quantidade <= 0 ||
          (area && !areasSobrepostasNovoBoss(area, hitbox))) return false;
      this.vida = 0;
      this.morto = true;
      this.destruir();
      scene.events?.emit("novo-boss:ilusao-dissipada", { encontro, alvo: this });
      return true;
    },
    posicionar(pontoNovo) { if (!destruido) sincronizarCorpoNovoBoss(this, pontoNovo); },
    imitarAtaque(tipoAtaque, atrasoMs = 0) {
      if (this.ataquesIlusorios?.ativo) return false;
      if (destruido || !["pulso", "chuva", "lasers", "tentaculos"].includes(tipoAtaque)) return false;
      imitacao = { tipo: tipoAtaque, tempo: -Math.max(0, atrasoMs), duracao: 500 };
      return true;
    },
    atualizarVisual(delta = 0) {
      if (destruido) return;
      const visivel = encontroIlusorioVisivel(scene, encontro);
      if (!visivel) this.ataquesIlusorios?.cancelar();
      else this.ataquesIlusorios?.atualizarEfeitos();
      sprite.setVisible(visivel);
      hitbox.enable = visivel;
      // Cada corpo conserva a oclusão dos atores na sua própria posição do mapa.
      sprite.setDepth(Number.isFinite(scene.profundidadePersonagemParte2)
        ? calcularDepthAtor(scene, hitbox.bottom, alvo) : visual.profundidade);
      // A pose acompanha toda a execução real, independentemente do efeito breve.
      aplicarPoseNovoBoss(scene, alvo,
        visivel && encontro.estado === "atacando" ? encontro.ataqueAtual : null);
      if (!imitacao) return;
      imitacao.tempo += Number.isFinite(delta) ? Math.max(0, delta) : 0;
      if (imitacao.tempo >= imitacao.duracao) {
        imitacao = null;
        grafico?.clear();
        grafico?.setVisible(false);
        return;
      }
      if (imitacao.tempo < 0 || !visivel) {
        grafico?.setVisible(false);
        return;
      }
      if (!grafico && scene.add.graphics) {
        grafico = scene.add.graphics().setName(`novo-boss-imitacao-${id}`).setDepth(51);
      }
      if (!grafico) return;
      const progresso = imitacao.tempo / imitacao.duracao;
      grafico.setVisible(true);
      grafico.clear();
      // Efeitos rosados pequenos indicam hologramas: não são avisos de perigo.
      grafico.lineStyle(2, 0xfca5d9, (1 - progresso) * 0.35);
      const { x, y } = sprite;
      if (imitacao.tipo === "pulso") grafico.strokeCircle(x, y + 25, 12 + progresso * 19);
      else if (imitacao.tipo === "chuva") {
        grafico.lineBetween(x - 8, y - 25, x - 8, y + 6);
        grafico.lineBetween(x + 8, y - 31, x + 8, y);
      } else if (imitacao.tipo === "lasers") {
        grafico.lineBetween(x - 25, y, x - 12, y - 9);
        grafico.lineBetween(x + 12, y - 9, x + 25, y);
      } else {
        grafico.lineBetween(x - 17, y + 25, x - 11, y + 9);
        grafico.lineBetween(x + 17, y + 25, x + 11, y + 9);
        grafico.strokeCircle(x, y + 21, 8);
      }
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      this.ataquesIlusorios?.destruir();
      hitbox.enable = false;
      sprite.destroy();
      grafico?.destroy();
      grafico = null;
      imitacao = null;
    },
    snapshot() {
      return { id, tipo, x: this.x, y: this.y, vida: this.vida,
        ataqueIlusorio: this.ataquesIlusorios?.snapshot() ?? null,
        active: this.active, morto: this.morto, imitacao: imitacao?.tipo ?? null };
    },
  };
  alvo.ataquesIlusorios = criarAtaquesIlusoriosNovoBoss(scene, encontro, alvo);
  return alvo;
}

export function prepararIlusoesNovoBoss(scene, encontro) {
  const config = { ativo: true, duracaoMs: 10000, ...encontro.config.ilusoes };
  const duracaoMs = Number.isFinite(config.duracaoMs) && config.duracaoMs > 0 ? config.duracaoMs : 10000;
  const alvos = [];
  let ativo = false;
  let destruido = false;
  let tempo = 0;
  let relogioCore = 0;
  let core = null;
  let pontoVerdadeiro = null;
  let ataqueAnterior = null;

  function encerrarQuatro() {
    for (const alvo of alvos) alvo.destruir();
    alvos.length = 0;
    ativo = false;
    tempo = 0;
    pontoVerdadeiro = null;
    ataqueAnterior = null;
  }

  function atualizarCore(delta) {
    relogioCore += Number.isFinite(delta) ? Math.max(0, delta) : 0;
    const visivel = config.ativo && encontroIlusorioVisivel(scene, encontro) &&
      encontro.sprite.visible !== false && !encontro.teleporte && !encontro.sistemaClones?.ativo;
    if (!core && visivel && scene.add?.circle) {
      core = scene.add.circle(0, 0, 4, 0xff4355, 1).setName("novo-boss-core-verdadeiro");
    }
    if (!core) return;
    core.setVisible(visivel);
    if (!visivel) return;
    const sprite = encontro.sprite;
    const ponto = pontoNucleoNovoBoss(encontro);
    core.setPosition(ponto.x, ponto.y);
    // A máscara de iluminação da fábrica fica em 50; a pista precisa atravessá-la.
    core.setDepth(54);
    core.setAlpha(0.62 + Math.sin(relogioCore / 180) * 0.32);
  }

  const sistema = {
    get ativo() { return ativo; }, get alvos() { return alvos; }, get core() { return core; },
    iniciarQuatro() {
      if (destruido || !config.ativo || ativo || encontro.teleporte || encontro.sistemaClones?.ativo ||
          !encontroIlusorioVisivel(scene, encontro) || !scene.add?.sprite) return false;
      const pontos = encontro.config.teleporte.pontos;
      if (pontos.length !== 4 || !pontos.every(ponto => destinoIlusorioValido(scene, encontro, ponto, true))) return false;
      // Exclui o slot atual para trocar a verdadeira de lugar em toda execução.
      const candidatos = pontos.filter(ponto =>
        Math.hypot(ponto.x - encontro.x, ponto.y - encontro.y) > 1 &&
        destinoIlusorioValido(scene, encontro, ponto));
      if (candidatos.length === 0) return false;
      const rng = Math.max(0, Math.min(0.999999, Number((encontro.rng ?? Math.random)()) || 0));
      const verdadeira = candidatos[Math.floor(rng * candidatos.length)];
      sincronizarCorpoNovoBoss(encontro, verdadeira);
      pontoVerdadeiro = verdadeira.id ?? pontos.indexOf(verdadeira);
      for (let indice = 0; indice < pontos.length; indice++) {
        if (pontos[indice] !== verdadeira) {
          alvos.push(criarAlvoIlusorio(scene, encontro, pontos[indice], `quatro-${indice + 1}`));
        }
      }
      ativo = true;
      tempo = 0;
      ataqueAnterior = encontro.ataqueAtual ?? null;
      atualizarCore(0);
      scene.events?.emit("novo-boss:ilusoes-iniciadas", { encontro, ponto: verdadeira });
      return true;
    },
    encerrarQuatro, cancelar: encerrarQuatro,
    /** Conserva as quatro posições quando a verdadeira vai ao centro para atacar. */
    trocarFalsaNoDestino(destino, origem) {
      if (!ativo) return;
      pontoVerdadeiro = encontro.config.teleporte.pontos.find(p =>
        Math.hypot(p.x - destino.x, p.y - destino.y) <= 1)?.id ?? null;
      if (Math.hypot(destino.x - origem.x, destino.y - origem.y) <= 1) return;
      const falsa = alvos.find(alvo => alvo.active && Math.hypot(alvo.x - destino.x, alvo.y - destino.y) <= 1);
      if (!falsa) return;
      if (!destinoIlusorioValido(scene, encontro, origem, true)) { encerrarQuatro(); return; }
      falsa.posicionar(origem);
    },
    atualizar(delta = 0) {
      if (destruido) return;
      if (!encontroIlusorioVisivel(scene, encontro) ||
          (encontro.teleporte && !encontro.teleporte.preservarIlusoes)) encerrarQuatro();
      if (ativo && Number.isFinite(delta) && delta >= 0) {
        tempo += delta;
        const ataque = encontro.ataqueAtual ?? null;
        if (ataque && ataque !== ataqueAnterior) {
          const nome = { pulsoRepulsao: "pulso", chuvaRaios: "chuva", lasersEspiral: "lasers" }[ataque.tipo] ?? ataque.tipo;
          for (let indice = 0; indice < alvos.length; indice++) alvos[indice].imitarAtaque(nome, indice * 25);
        }
        ataqueAnterior = ataque;
        for (const alvo of alvos) alvo.atualizarVisual(delta);
        if (tempo >= duracaoMs) encerrarQuatro();
      }
      atualizarCore(delta);
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      encerrarQuatro();
      core?.destroy();
      core = null;
    },
    snapshot() {
      return { ativo, destruido, tempo, duracaoMs, pontoVerdadeiro,
        alvos: alvos.map(alvo => alvo.snapshot()),
        core: core ? { x: core.x, y: core.y, visible: core.visible, alpha: core.alpha } : null };
    },
  };
  return sistema;
}
