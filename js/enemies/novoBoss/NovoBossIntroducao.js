/** Apresenta boss e torres, forma o escudo e fecha as duas persianas antes da luta. */
import { criarRaiosEscudoNovoBoss } from "./NovoBossRaiosEscudo.js";
import { ocultarHUDDuranteCena } from "../../ui/HudCinematic.js";
import BossIntroLighting from "../../effects/BossIntroLighting.js";
import { prepararMusicaNovoBoss } from "../../sounds/novoBoss.js";

const PORTAS_ENTRADA = new Set(["porta02", "porta03"]);
const duracao = (valor, padrao) => Number.isFinite(valor) && valor >= 0 ? valor : padrao;
const suavizar = p => p * p * (3 - 2 * p);

function jogadorNaPorta(player, porta) {
  const a = player.body?.width > 0 && player.body?.height > 0 ? player.body : player.getBounds?.();
  const b = porta.area;
  if (!b) return false;
  if (!a) return player.x >= b.x && player.x <= b.x + b.width &&
    player.y >= b.y && player.y <= b.y + b.height;
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

export function prepararIntroducaoNovoBoss(scene, encontro) {
  const config = encontro.config.cenaEntrada;
  const velocidade = Number.isFinite(config?.velocidade) && config.velocidade > 0 ? config.velocidade : 1;
  const velocidadeTorres = Number.isFinite(config?.velocidadeTorres) && config.velocidadeTorres > 0
    ? config.velocidadeTorres : velocidade;
  const principal = scene.cameras?.main;
  if (config?.ativo === false || !principal?.centerOn || !principal.stopFollow || !principal.startFollow) return null;
  let etapa = "aguardando", tempo = 0, concluida = false, destruida = false;
  let camera = null, anterior = null, portas = [];
  let origem = null, foco = null, retorno = null;
  let portasLiberadas = false;
  let roteiro = [], indiceEtapa = 0, torres = [], raios = null;
  let centroAtual = null, de = null, para = null, zoomDe = null, zoomPara = null;
  let hud = null;
  const iluminacao = new BossIntroLighting(encontro.config.arena);
  const musica = prepararMusicaNovoBoss(scene, encontro);

  function limparRaios() { raios?.destruir(); raios = null; }

  function liberarPortas() {
    if (portasLiberadas) return;
    for (const porta of portas) porta.liberarAposBoss?.();
    portasLiberadas = true;
  }

  function restaurarControle(cancelada = false) {
    hud?.restaurar(); hud = null;
    if (!anterior) return;
    if (camera?.scene !== null) {
      camera.setZoom?.(anterior.zoomX, anterior.zoomY);
      if (anterior.alvo?.active !== false && anterior.alvo) {
        camera.startFollow(anterior.alvo, anterior.roundPixels, anterior.lerpX, anterior.lerpY,
          anterior.offsetX, anterior.offsetY);
      } else if (cancelada) camera.centerOn(origem.x, origem.y);
    }
    scene.movimentoBloqueado = anterior.movimento;
    scene.cenaEntradaBossAtiva = anterior.cenaAtiva;
    if (!anterior.animacaoPausada) scene.player?.anims?.resume?.();
    if (anterior.input) anterior.input.enabled = anterior.inputEnabled;
    if (anterior.keyboard) {
      anterior.keyboard.resetKeys?.();
      anterior.keyboard.enabled = anterior.keyboardEnabled;
    }
    anterior = null;
    camera = null;
  }

  function cancelar() {
    limparRaios();
    musica.parar();
    encontro.sistemaGeradores?.cancelarApresentacao?.();
    restaurarControle(true);
    iluminacao.iniciar(scene.iluminacaoEmergencia?.luzes);
    liberarPortas();
    etapa = "aguardando";
    tempo = 0;
  }

  function iniciar() {
    camera = scene.cameras.main;
    const keyboard = scene.input?.keyboard;
    anterior = { alvo: camera._follow ?? scene.player, roundPixels: camera.roundPixels,
      lerpX: camera.lerp?.x ?? 1, lerpY: camera.lerp?.y ?? 1,
      offsetX: camera.followOffset?.x ?? 0, offsetY: camera.followOffset?.y ?? 0,
      zoomX: camera.zoomX ?? camera.zoom ?? 1, zoomY: camera.zoomY ?? camera.zoom ?? 1,
      movimento: scene.movimentoBloqueado, cenaAtiva: scene.cenaEntradaBossAtiva,
      animacaoPausada: scene.player.anims?.isPaused,
      input: scene.input, inputEnabled: scene.input?.enabled,
      keyboard, keyboardEnabled: keyboard?.enabled };
    origem = { x: camera.midPoint?.x ?? scene.player.x, y: camera.midPoint?.y ?? scene.player.y };
    centroAtual = { ...origem };
    foco = { x: encontro.sprite.x, y: encontro.sprite.y };
    retorno = { x: scene.player.x - anterior.offsetX, y: scene.player.y - anterior.offsetY };
    camera.stopFollow();
    scene.movimentoBloqueado = true;
    scene.cenaEntradaBossAtiva = true;
    hud = ocultarHUDDuranteCena(scene, camera);
    scene.player.setVelocity?.(0, 0);
    scene.player.anims?.pause?.();
    keyboard?.resetKeys?.();
    if (scene.input) scene.input.enabled = false;
    if (keyboard) keyboard.enabled = false;
    portasLiberadas = false;
    torres = encontro.sistemaGeradores?.iniciarApresentacao?.() ?? [];
    scene.zonasLuzApagada?.revelarPortas(portas, scene.time?.now ?? 0);
    iluminacao.iniciar(scene.iluminacaoEmergencia?.luzes);
    criarRoteiro();
    entrarEtapa(0);
  }

  function deslocar(de, para, progresso) {
    const p = suavizar(progresso);
    centroAtual.x = de.x + (para.x - de.x) * p;
    centroAtual.y = de.y + (para.y - de.y) * p;
    camera.setZoom?.(zoomDe.x + (zoomPara.x - zoomDe.x) * p,
      zoomDe.y + (zoomPara.y - zoomDe.y) * p);
    camera.centerOn(centroAtual.x, centroAtual.y);
  }

  function zoomEnquadramento() {
    const margem = duracao(config?.margemEnquadramento, 70);
    let meiaLargura = 95, meiaAltura = 95;
    for (const torre of torres) {
      const a = torre.hitboxDano;
      meiaLargura = Math.max(meiaLargura, Math.abs(a.x - foco.x), Math.abs(a.x + a.width - foco.x));
      meiaAltura = Math.max(meiaAltura, Math.abs(a.y - foco.y), Math.abs(a.y + a.height - foco.y));
    }
    const fator = Math.min(1, camera.width / ((meiaLargura + margem) * 2 * anterior.zoomX),
      camera.height / ((meiaAltura + margem) * 2 * anterior.zoomY));
    return { x: anterior.zoomX * fator, y: anterior.zoomY * fator };
  }

  function criarRoteiro() {
    roteiro = [
      { nome: "indo", velocidade: 1, duracao: duracao(config?.idaMs, 3200), alvo: foco,
        atualizar: p => { if (p > 0) iluminacao.avancar(suavizar(p)); } },
      { nome: "mostrando", velocidade: 1, duracao: duracao(config?.pausaMs, 900),
        atualizar: p => iluminacao.perceber(p) },
    ];
    // Y cresce para baixo também nas coordenadas negativas: superior esquerda, seguindo horário.
    torres = [...torres].sort((a, b) => Math.atan2(a.y - foco.y, a.x - foco.x) -
      Math.atan2(b.y - foco.y, b.x - foco.x));
    const canto = { x: Math.min(...torres.map(torre => torre.x)),
      y: Math.min(...torres.map(torre => torre.y)) };
    const primeira = torres.reduce((melhor, torre, indice) =>
      Math.hypot(torre.x - canto.x, torre.y - canto.y) <
      Math.hypot(torres[melhor].x - canto.x, torres[melhor].y - canto.y) ? indice : melhor, 0);
    torres = [...torres.slice(primeira), ...torres.slice(0, primeira)];
    for (const torre of torres) {
      roteiro.push({ nome: "indo-torre", torre: torre.id, velocidade: velocidadeTorres,
        duracao: duracao(config?.viagemTorreMs, 650),
        alvo: { x: torre.hitboxDano.x + torre.hitboxDano.width / 2,
          y: torre.hitboxDano.y + torre.hitboxDano.height / 2 } });
      roteiro.push({ nome: "invocando-torre", torre: torre.id, velocidade: velocidadeTorres,
        duracao: torre.duracaoInvocacaoMs,
        iniciar: () => torre.invocar(velocidadeTorres) });
      roteiro.push({ nome: "mostrando-choque-torre", torre: torre.id, velocidade: velocidadeTorres,
        duracao: torre.duracaoIdleMs });
    }
    if (torres.length) {
      roteiro.push({ nome: "enquadrando", duracao: duracao(config?.enquadramentoMs, 1000),
        alvo: foco, zoom: zoomEnquadramento });
      roteiro.push({ nome: "carregando-escudo", velocidade: 1, duracao: duracao(config?.cargaEscudoMs, 1500),
        iniciar: () => { raios = criarRaiosEscudoNovoBoss(scene, encontro, torres); },
        atualizar: p => {
          encontro.sistemaGeradores.definirCargaEscudo(Math.max(0, (p - 0.3) / 0.7));
          raios?.atualizar(tempo, Math.min(1, p / 0.3));
        } });
      roteiro.push({ nome: "dissipando-raios", velocidade: 1, duracao: duracao(config?.dissipacaoRaiosMs, 350),
        atualizar: p => raios?.atualizar(duracao(config?.cargaEscudoMs, 1500) + tempo, 1, 1 - p),
        concluir: limparRaios });
    }
    roteiro.push({ nome: "voltando", duracao: duracao(config?.voltaMs, 900),
      alvo: retorno, zoom: () => ({ x: anterior.zoomX, y: anterior.zoomY }) });
  }

  function entrarEtapa(indice) {
    indiceEtapa = indice;
    tempo = 0;
    const atual = roteiro[indice];
    if (!atual) {
      etapa = "fechando";
      for (const porta of portas) porta.fecharParaBoss?.();
      return;
    }
    etapa = atual.nome;
    de = { ...centroAtual };
    para = atual.alvo ?? de;
    zoomDe = { x: camera.zoomX ?? camera.zoom ?? 1, y: camera.zoomY ?? camera.zoom ?? 1 };
    zoomPara = atual.zoom?.() ?? zoomDe;
    atual.iniciar?.();
    atual.atualizar?.(0);
    encontro.sistemaGeradores?.atualizar(0);
  }

  const sistema = {
    iluminacao,
    get bloqueiaCombate() { return !destruida && !concluida && encontro.jogadorNaArena && !encontro.morto; },
    atualizar(delta = 0) {
      if (destruida) return false;
      const valido = encontro.sprite?.active && encontro.jogadorNaArena && !encontro.morto &&
        !encontro.encerrado && !encontro.suspenso && !scene.multiplayer && !scene.morteEmAndamento &&
        scene.player?.active && !scene.player.morto && (scene.vida ?? 1) > 0;
      if (!valido || (camera && camera !== scene.cameras?.main)) {
        if (anterior) cancelar();
        if (encontro.morto || encontro.encerrado || scene.morteEmAndamento || (scene.vida ?? 1) <= 0) liberarPortas();
        return false;
      }
      if (concluida) return false;
      if (etapa === "aguardando") {
        // Aguarda todos os recursos do encontro, inclusive os quatro sprites das torres.
        if (encontro.pendencia) return true;
        portas = (scene.portasFabrica ?? []).filter(porta => PORTAS_ENTRADA.has(porta.nome));
        // O corpo inteiro precisa terminar a passagem antes de congelar o personagem.
        if (scene.movimentoBloqueado || scene.generatorMenuOpen || scene.devItemMenuOpen || scene.atacando ||
            portas.some(porta => porta.estado === "abrindo" || jogadorNaPorta(scene.player, porta))) return true;
        iniciar();
        return true;
      }
      scene.player.setVelocity?.(0, 0);
      let restante = Number.isFinite(delta) ? Math.max(0, delta) : 0;
      while (etapa !== "fechando") {
        const atual = roteiro[indiceEtapa];
        const total = atual.duracao;
        const ritmo = atual.velocidade ?? velocidade;
        const passo = Math.min(restante * ritmo, Math.max(0, total - tempo));
        tempo += passo;
        // Ritmos fracionários não devem deixar uma etapa presa por resíduos de ponto flutuante.
        if (total - tempo < 1e-7) tempo = total;
        restante = Math.max(0, restante - passo / ritmo);
        const progresso = total > 0 ? Math.min(1, tempo / total) : 1;
        deslocar(de, para, progresso);
        atual.atualizar?.(progresso);
        musica.atualizar(etapa === "indo" ? progresso : 1);
        // Consome só o tempo desta etapa: a próxima torre não nasce adiantada em frames longos.
        encontro.sistemaGeradores?.atualizar(passo);
        if (tempo < total) return true;
        atual.concluir?.();
        entrarEtapa(indiceEtapa + 1);
        if (restante <= 0 && etapa !== "fechando") return true;
      }
      encontro.sistemaGeradores?.atualizar(restante * velocidade);
      if (portas.some(porta => porta.estado !== "fechada")) return true;
      etapa = "concluida";
      concluida = true;
      encontro.sistemaGeradores?.concluirApresentacao?.();
      iluminacao.restaurar();
      restaurarControle();
      // O frame que encerra a cena ainda não pertence ao relógio de combate.
      return true;
    },
    destruir() {
      if (destruida) return;
      limparRaios();
      // No shutdown os sprites podem já ter sido removidos pelo Phaser.
      if (!concluida && !encontro.encerrado) encontro.sistemaGeradores?.cancelarApresentacao?.();
      musica.destruir();
      iluminacao.restaurar();
      restaurarControle(true);
      liberarPortas();
      destruida = true;
      scene.events?.off("novo-boss:derrotada", derrotada);
    },
    snapshot() { return { etapa, concluida, destruida,
      torre: roteiro[indiceEtapa]?.torre ?? null, zoomEnquadramento: etapa === "enquadrando" ? zoomPara : null }; },
  };
  const derrotada = evento => { if (evento.encontro === encontro) liberarPortas(); };
  scene.events?.on("novo-boss:derrotada", derrotada);
  return sistema;
}
