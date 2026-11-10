/** Quatro ciclos anteriores à IA principal. Um relógio, sem timers de invocação. */
import { novoBossConfig } from "./NovoBossConfig.js";
import { criarRoboBola } from "../RoboBola.js";
import { iniciarEmergenciaRoboBola } from "../RoboBolaEmergencia.js";
import { criarPortaisNovoBoss, escolherParPortais, pontoSeguroPortal } from "./NovoBossPortais.js";
import { criarPadraoPrologo } from "./NovoBossPadroesPrologo.js";
import { obterFilhosGrupoSeguro } from "../EnemyPathfinding.js";
import { criarSomCargaEscudoBoss } from "../../sounds/raioEscotilhaBoss.js";

export const ESTADOS_PROLOGO = Object.freeze({
  PORTAIS_ABRINDO: "PORTAIS_ABRINDO", ONDA_ROBOS: "ONDA_ROBOS",
  GERADORES_SUBINDO: "GERADORES_SUBINDO", GERADORES_EXPOSTOS: "GERADORES_EXPOSTOS",
  GERADORES_DESCENDO: "GERADORES_DESCENDO", BOSS_VULNERAVEL: "BOSS_VULNERAVEL",
  ESCUDO_RECARREGANDO: "ESCUDO_RECARREGANDO", COMBATE_PRINCIPAL: "COMBATE_PRINCIPAL",
});
let sequenciaEncontro = 0;

export function prepararPrologoNovoBoss(scene, encontro) {
  if (encontro.prologo) return encontro.prologo;
  if (scene.multiplayer || encontro.config.prologo?.ativo === false ||
      encontro.geradores.length !== 4 || !encontro.geradores.every(g => g.torre)) return null;
  const config = { ...novoBossConfig.prologo, ...encontro.config.prologo,
    lasers: { ...novoBossConfig.prologo.lasers, ...encontro.config.prologo?.lasers } };
  // O restante do encontro mantém sua configuração; apenas os ajustes do prólogo são completos.
  encontro.config = { ...encontro.config, prologo: config };
  const id = `novo-boss-prologo-${++sequenciaEncontro}`;
  let estado = "PORTAIS_ABRINDO", ciclo = 1, revisao = 0, ondaId = null;
  let iniciado = false, suspenso = false, destruido = false, tempo = 0, relogio = 0;
  let portais = null, parAnterior = [], tentadoEm = -Infinity;
  let invocados = 0, mortos = 0, proximoSpawn = 0, proximoPortal = 0, anteriorVivos = 0;
  let padrao = null, indicePadrao = 0, proximoPadrao = 0;
  let impactos = 0, ultimoImpacto = -Infinity, geradorDoCiclo = null;
  const ataquesContados = new Set(), robos = new Set();
  const grafico = scene.add.graphics().setDepth(52).setName("novo-boss-prologo-energia");
  const somCarga = criarSomCargaEscudoBoss(scene);
  const sobreviventes = () => encontro.geradores.filter(g => g.ligado && !g.morto);
  const regra = () => config.ciclos[Math.min(ciclo - 1, config.ciclos.length - 1)];
  const vivo = robo => !robo.morto && robo.vida > 0 && robo.active !== false && Boolean(robo.scene);
  const vivos = () => [...robos].filter(vivo);

  function mudar(proximo) {
    const anterior = estado;
    if (anterior === "ESCUDO_RECARREGANDO" && proximo !== anterior) somCarga.parar();
    estado = proximo;
    tempo = 0;
    encontro.estado = "prologo";
    scene.events.emit("novo-boss:prologo-estado", { encontro, anterior, estado, ciclo });
  }

  function encerrarPadrao() {
    padrao?.destruir();
    if (encontro.ataqueAtual === padrao) encontro.ataqueAtual = null;
    padrao = null;
    if (encontro.estado === "atacando") encontro.estado = "prologo";
  }

  function limparProjeteis() {
    encerrarPadrao();
    for (const projetil of obterFilhosGrupoSeguro(scene.lasersInimigo)) {
      if (projetil.especialAtirador?.prologoEncontroId === id) projetil.destroy();
    }
  }

  function limparRobos() {
    limparProjeteis();
    for (const robo of robos) {
      robo.removerBrilhoOlho?.();
      [robo.fundoVida, robo.barraVida, robo.bordaVida].forEach(v => v?.destroy());
      if (robo.body) robo.body.enable = false;
      scene.tweens?.killTweensOf?.(robo);
      if (robo.active !== false) robo.destroy();
    }
    scene.inimigos = (scene.inimigos ?? []).filter(r => r?.prologoEncontroId !== id);
    if (scene.inimigoTeste?.prologoEncontroId === id) scene.inimigoTeste = scene.inimigos[0] ?? null;
    robos.clear();
  }

  function prepararOnda() {
    limparRobos();
    portais?.destruir(); portais = null;
    ondaId = `${id}/${ciclo}/${++revisao}`;
    invocados = mortos = anteriorVivos = proximoPortal = 0;
    impactos = 0; ultimoImpacto = -Infinity; ataquesContados.clear(); geradorDoCiclo = null;
    tentadoEm = -Infinity;
    proximoSpawn = config.preparacaoOndaMs;
    proximoPadrao = config.preparacaoOndaMs;
    sobreviventes().forEach(g => g.recolher());
    encontro.sistemaGeradores.controlarEscudo(1, true, !encontro.sistemaGeradores.escudoOcupado());
    mudar("PORTAIS_ABRINDO");
  }

  function atualizarPortais(delta) {
    portais?.atualizar(delta, config.aberturaPortalMs, config.fechamentoPortalMs);
  }

  function abrirPortais() {
    if (portais || relogio < tentadoEm + 500) return;
    if (sobreviventes().some(g => g.estadoGerador !== "subterraneo")) return;
    tentadoEm = relogio;
    const par = escolherParPortais(scene, encontro, parAnterior);
    if (!par) { encontro.pendencia = "prologo-portais-aguardando-espaco"; return; }
    portais = criarPortaisNovoBoss(scene, par);
    parAnterior = par;
    encontro.pendencia = null;
    tempo = 0;
  }

  function invocar() {
    if (tempo < proximoSpawn || invocados >= regra().total || vivos().length >= regra().simultaneos) return;
    const portal = portais.pontos[proximoPortal % 2];
    // Aguarda o centro ficar livre em vez de materializar o robô fora do portal.
    if (!pontoSeguroPortal(scene, encontro, portal, 22)) { proximoSpawn = tempo + 250; return; }
    const robo = criarRoboBola(scene, portal);
    if (!robo) { proximoSpawn = tempo + 250; return; }
    robo.prologoEncontroId = id;
    robo.prologoOndaId = ondaId;
    robo.prologoPortal = proximoPortal % 2;
    robo.prologoProtegidoAte = scene.time.now + config.protecaoSpawnMs;
    robo.ultimoTiro = robo.prologoProtegidoAte;
    iniciarEmergenciaRoboBola(robo, portal.x < encontro.x ? 1 : -1);
    robos.add(robo);
    invocados++; proximoPortal++;
    proximoSpawn = tempo + config.intervaloSpawnMs;
    scene.events.emit("novo-boss:prologo-robo", { encontro, robo, ondaId, ciclo });
  }

  function atualizarOnda(delta) {
    const atuais = vivos().length;
    if (atuais < anteriorVivos) proximoSpawn = Math.max(proximoSpawn, tempo + config.reposicaoMs);
    mortos = invocados - atuais;
    if (invocados === regra().total && atuais === 0) {
      limparProjeteis();
      portais.fechar();
      sobreviventes().forEach(g => g.emergir());
      mudar("GERADORES_SUBINDO");
      return;
    }
    invocar(); anteriorVivos = vivos().length;
    if (encontro.config.ataques?.ativo !== false && !padrao && tempo >= proximoPadrao) {
      const tipos = regra().padroes;
      const tipo = tipos[indicePadrao % tipos.length];
      padrao = criarPadraoPrologo(scene, encontro, tipo, ondaId, indicePadrao++);
      encontro.ataqueAtual = padrao; encontro.estado = "atacando";
      scene.events.emit("novo-boss:ataque-iniciado", { encontro, tipo: "lasers", padrao: tipo, prologo: true });
    }
    if (padrao?.atualizar(delta)) {
      scene.events.emit("novo-boss:ataque-concluido", { encontro, tipo: "lasers", prologo: true });
      encerrarPadrao(); proximoPadrao = tempo + config.intervaloPadroesMs;
    }
  }

  function energia() {
    grafico.clear();
    if (estado === "ESCUDO_RECARREGANDO") {
      somCarga.atualizar(sobreviventes().length ? tempo / config.recargaEscudoMs / 0.8 : 0);
      grafico.lineStyle(2, 0x90f2ff, Math.min(0.8, tempo / config.recargaEscudoMs));
      for (const torre of sobreviventes()) grafico.lineBetween(torre.x, torre.y,
        encontro.x, encontro.y + 16);
    } else if (estado === "GERADORES_DESCENDO") {
      const duracao = sobreviventes().length ? config.falhaEscudoMs : config.colapsoMs;
      const p = Math.min(1, tempo / duracao);
      if (p < 1) {
        grafico.lineStyle(3, 0x9af3ff, 1 - p);
        grafico.strokeCircle(encontro.x, encontro.y + 16, 95 + 70 * p);
      }
    }
  }

  function concluir() {
    limparRobos(); portais?.destruir(); portais = null;
    encontro.sistemaGeradores.controlarEscudo(0, false, false);
    mudar("COMBATE_PRINCIPAL");
    encontro.estado = "preparando";
    encontro.tempoEstado = encontro.tempoSemAproximacao = 0;
    encontro.teleportePendente = null;
    encontro.verificarFase?.();
    scene.events.emit("novo-boss:prologo-concluido", { encontro });
  }

  function passo(delta) {
    tempo += delta; relogio += delta; encontro.relogioCombate += delta;
    atualizarPortais(delta);
    switch (estado) {
      case "PORTAIS_ABRINDO":
        encontro.sistemaGeradores.controlarEscudo(1, true, !encontro.sistemaGeradores.escudoOcupado());
        abrirPortais();
        if (portais && tempo >= config.aberturaPortalMs) mudar("ONDA_ROBOS");
        break;
      case "ONDA_ROBOS":
        encontro.sistemaGeradores.controlarEscudo(1, true, !encontro.sistemaGeradores.escudoOcupado());
        atualizarOnda(delta); break;
      case "GERADORES_SUBINDO":
        if (tempo >= config.fechamentoPortalMs && portais) { portais.destruir(); portais = null; }
        if (sobreviventes().every(g => g.estadoGerador === "exposto")) mudar("GERADORES_EXPOSTOS");
        break;
      case "GERADORES_DESCENDO": {
        const restantes = sobreviventes();
        const duracao = restantes.length ? config.falhaEscudoMs : config.colapsoMs;
        const p = Math.min(1, tempo / duracao);
        encontro.sistemaGeradores.controlarEscudo((1 - p) * (0.4 + 0.6 * Math.abs(Math.cos(tempo / 65))), false, false);
        if (p >= 1 && restantes.every(g => g.estadoGerador === "subterraneo")) {
          if (!restantes.length) concluir();
          else mudar("BOSS_VULNERAVEL");
        }
        break;
      }
      case "ESCUDO_RECARREGANDO": {
        const p = Math.min(1, tempo / config.recargaEscudoMs);
        const ocupado = encontro.sistemaGeradores.escudoOcupado();
        encontro.sistemaGeradores.controlarEscudo(p, true, p >= 1 && !ocupado);
        if (p >= 1 && !ocupado) { ciclo++; prepararOnda(); }
        break;
      }
    }
    energia();
  }

  const sistema = {
    id,
    get bloqueiaCombatePrincipal() { return !destruido && estado !== "COMBATE_PRINCIPAL"; },
    get estado() { return estado; },
    podeAtingirGerador(torre) {
      return !destruido && !suspenso && estado === "GERADORES_EXPOSTOS" &&
        geradorDoCiclo === null && torre.estadoGerador === "exposto";
    },
    geradorDestruido(torre) {
      if (geradorDoCiclo !== null || estado !== "GERADORES_EXPOSTOS") return;
      geradorDoCiclo = torre.id;
      sobreviventes().forEach(g => g.recolher());
      encontro.sistemaGeradores.controlarEscudo(1, false, false);
      mudar("GERADORES_DESCENDO");
      if (!sobreviventes().length) scene.events.emit("novo-boss:barreira-desativada", { encontro });
    },
    receberDanoBoss(quantidade, ataque = null) {
      if (destruido || suspenso || estado !== "BOSS_VULNERAVEL" ||
          impactos >= config.impactosPorJanela || relogio < ultimoImpacto + config.intervaloImpactosMs ||
          (ataque && ataquesContados.has(ataque))) return false;
      const anterior = encontro.vida;
      impactos++; ultimoImpacto = relogio;
      if (ataque) ataquesContados.add(ataque);
      // Mantém a entidade viva até o quarto gerador; o excedente será cobrado no próximo golpe principal.
      const aplicado = Math.min(quantidade, Math.max(0, encontro.vida - 1));
      encontro.vida -= aplicado;
      encontro.danoAdiadoPrologo = (encontro.danoAdiadoPrologo ?? 0) + quantidade - aplicado;
      scene.events.emit("novo-boss:vida", { encontro, anterior, vida: encontro.vida, vidaMaxima: encontro.vidaMaxima });
      if (impactos === config.impactosPorJanela) {
        encontro.sistemaGeradores.controlarEscudo(0, true, false);
        mudar("ESCUDO_RECARREGANDO");
      }
      return true;
    },
    suspender() {
      if (destruido || suspenso || estado === "COMBATE_PRINCIPAL") return;
      suspenso = true;
      somCarga.parar();
      limparRobos(); portais?.destruir(); portais = null;
      grafico.clear();
      encontro.geradores.forEach(g => g.suspenderColisao());
      encontro.sistemaGeradores.controlarEscudo(0, encontro.barreiraAtiva, false);
    },
    atualizar(delta) {
      if (destruido || estado === "COMBATE_PRINCIPAL") return false;
      if (!encontro.active || scene.multiplayer || scene.morteEmAndamento || scene.vida <= 0) {
        sistema.suspender(); return true;
      }
      if (!iniciado) {
        iniciado = true; suspenso = false;
        encontro.geradores.forEach(g => g.controlarPrologo());
        prepararOnda();
      } else if (suspenso) {
        suspenso = false;
        if (["PORTAIS_ABRINDO", "ONDA_ROBOS"].includes(estado)) prepararOnda();
        else if (["GERADORES_SUBINDO", "GERADORES_EXPOSTOS"].includes(estado)) {
          encontro.sistemaGeradores.controlarEscudo(1, true, !encontro.sistemaGeradores.escudoOcupado());
        }
      }
      if (!Number.isFinite(delta) || delta < 0) return true;
      let restante = delta;
      do {
        const dt = Math.min(50, restante);
        encontro.sistemaGeradores.atualizar(dt);
        passo(dt); restante -= dt;
      } while (restante > 0 && estado !== "COMBATE_PRINCIPAL");
      return true;
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      somCarga.destruir();
      limparRobos(); portais?.destruir(); portais = null;
      grafico.destroy(); ataquesContados.clear();
    },
    snapshot() {
      return { id, estado, ciclo, iniciado, suspenso, destruido, tempo, relogio, ondaId,
        portais: portais?.pontos.map(({ x, y, indice }) => ({ x, y, indice })) ?? [],
        invocados, mortos, vivos: vivos().length, pendentes: regra().total - invocados,
        restantesOnda: regra().total - invocados + vivos().length, total: regra().total,
        simultaneos: regra().simultaneos, impactos, impactosRestantes: config.impactosPorJanela - impactos,
        geradoresRestantes: sobreviventes().length, padrao: padrao?.padrao ?? null,
        projeteis: encontro.projeteisBoss?.length ?? 0, geradorDoCiclo,
        danoAdiado: encontro.danoAdiadoPrologo ?? 0,
        aguardandoSaidaEscudo: estado === "ESCUDO_RECARREGANDO" && encontro.sistemaGeradores.escudoOcupado() };
    },
  };
  encontro.prologo = sistema;
  return sistema;
}
