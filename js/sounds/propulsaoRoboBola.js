/** O empuxo responde ao movimento observado; não há metrônomo ou onda de volume. */
const CHAVE = "robo-bola-propulsao";
const ALCANCE = 400;
const AFINACAO = -600; // Sustentação mais grave; deslocamento eleva o tom do motor.
const VOLUME_MAXIMO = 0.26;
const LIMITE_CONJUNTO = 0.41;
const ENTRADA_SUAVE_SEGUNDOS = 0.2;
const controles = new WeakMap();
const grupos = new WeakMap();
const limitar = (valor, min, max) => Math.max(min, Math.min(max, valor));

export function carregarSomPropulsaoRoboBola(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/robo_bola_voando_loop.wav");
}

export function configurarSomPropulsaoRoboBola(scene, robo, { silencioInicialMs = 600 } = {}) {
  if (robo.tipoRobo !== "bola" || robo.morto || controles.has(robo)) return;
  let som = null, filtro = null, tocando = false, destruido = false, volumeAnterior = null;
  let anterior = null, forca = 0, liberacao = 0.2, intervalo = Infinity, entrada = 0;
  let silencioNascimento = silencioInicialMs;
  let direcaoImpulso = null, velocidadeImpulso = 0, pan = null, afinacao = AFINACAO, afinacaoAplicada = AFINACAO;
  const grupo = grupos.get(scene) ?? new Set();
  grupos.set(scene, grupo);
  const fonte = { volume: 0, aplicar(volume) {
    if (!som || volume === volumeAnterior) return;
    volumeAnterior = volume;
    const gain = som.volumeNode?.gain, contexto = som.manager?.context;
    const valorAnterior = gain?.value;
    som.setVolume(volume);
    if (gain && contexto) {
      const agora = contexto.currentTime;
      gain.cancelScheduledValues(agora);
      gain.setValueAtTime(valorAnterior, agora);
      gain.linearRampToValueAtTime(volume, agora + 0.018);
    }
  } };
  const distribuir = () => {
    let total = 0;
    for (const item of grupo) total += item.volume;
    const fator = total > LIMITE_CONJUNTO ? LIMITE_CONJUNTO / total : 1;
    for (const item of grupo) item.aplicar(item.volume * fator);
  };
  const parar = () => {
    if (!tocando) return;
    const contexto = som.manager?.context;
    if (contexto) som.volumeNode?.gain.cancelScheduledValues(contexto.currentTime);
    som.stop(); tocando = false; volumeAnterior = null; pan = null;
    grupo.delete(fonte);
    distribuir();
  };
  const atualizar = (_tempo, delta = 16.67) => {
    if (destruido) return;
    if (!robo.active || robo.morto) { destruir(); return; }
    const dt = limitar(delta, 1, 100) / 1000;
    const nascendo = silencioNascimento > 0;
    silencioNascimento = Math.max(0, silencioNascimento - dt * 1000);
    const deslocamento = robo.deslocamentoFlutuacao ??
      (0.5 - (robo.originY ?? 0.5)) * 127 * (robo.scaleY ?? 0.56);
    const ouvinte = scene.player?.body?.center ?? scene.player;
    // Mede mesmo fora do alcance: aproximar-se não inventa uma aceleração atrasada.
    const salto = anterior && Math.hypot(robo.x - anterior.x, robo.y - anterior.y) > Math.max(64, dt * 350);
    if (salto) { anterior = null; forca = 0; direcaoImpulso = null; }
    const vx = robo.body?.velocity?.x ?? (anterior ? limitar((robo.x - anterior.x) / dt, -300, 300) : 0);
    const vy = robo.body?.velocity?.y ?? (anterior ? limitar((robo.y - anterior.y) / dt, -300, 300) : 0);
    const velocidade = Math.hypot(vx, vy);
    const vertical = anterior ? limitar((deslocamento - anterior.deslocamento) / dt, -80, 80) : 0;
    const aceleracao = anterior ? Math.hypot(vx - anterior.vx, vy - anterior.vy) / dt : 0;
    const direcao = velocidade > 18 ? Math.atan2(vy, vx) : null;
    if (!anterior || nascendo) {
      direcaoImpulso = direcao;
      velocidadeImpulso = velocidade;
    }
    const curva = direcao !== null && direcaoImpulso !== null
      ? Math.abs(Math.atan2(Math.sin(direcao - direcaoImpulso), Math.cos(direcao - direcaoImpulso))) : 0;
    const comecouSubida = anterior && vertical < -2 && anterior.vertical >= -2;
    // A primeira amostra só estabelece a velocidade: nascer não é um arranque.
    const arrancou = anterior && velocidade > 25 && anterior.velocidade < 8;
    const manobrou = anterior && ((aceleracao > 220 && anterior.aceleracao < 150) ||
      Math.abs(velocidade - velocidadeImpulso) > 32 || curva > 0.34);
    forca *= Math.exp(-dt / liberacao);
    intervalo += dt;
    // Só a ação medida dispara uma rajada. A trava curta evita ruído da física,
    // sem agendar novos pulsos: cada curva/arranque tem seu próprio instante.
    if (!nascendo && intervalo >= 0.08 && (comecouSubida || arrancou || manobrou)) {
      const intensidade = limitar((comecouSubida ? 0.58 : 0.3) +
        velocidade / 175 * 0.26 + Math.min(aceleracao / 700, 1) * 0.34, 0, 1);
      forca = Math.max(forca, intensidade);
      liberacao = 0.12 + intensidade * 0.15 + Math.min(velocidade / 175, 1) * 0.04;
      direcaoImpulso = direcao;
      velocidadeImpulso = velocidade;
      intervalo = 0;
    }
    const velocidadeOuvinte = anterior && ouvinte ? {
      x: limitar((ouvinte.x - anterior.ouvinteX) / dt, -300, 300),
      y: limitar((ouvinte.y - anterior.ouvinteY) / dt, -300, 300),
    } : { x: 0, y: 0 };
    anterior = { x: robo.x, y: robo.y, deslocamento, vx, vy, velocidade, vertical, aceleracao,
      ouvinteX: ouvinte?.x ?? 0, ouvinteY: ouvinte?.y ?? 0 };
    // Silêncio real ao nascer, inclusive nas primeiras subidas e manobras.
    // Continua medindo o robô para não reproduzir esse jato com atraso.
    if (nascendo) return;
    if (!ouvinte || scene.player?.active === false || scene.morteEmAndamento ||
      robo.visible === false || robo.alpha === 0) { parar(); return; }
    // O emissor acompanha a imagem que levita; o ouvinte é sempre o jogador local.
    const dx = robo.x - ouvinte.x, dy = robo.y + deslocamento - ouvinte.y;
    const distancia = Math.hypot(dx, dy);
    if (distancia >= ALCANCE) { parar(); return; }
    if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
    if (!som) {
      som = scene.sound.add(CHAVE, { volume: 0, loop: true });
      const contexto = som.manager?.context;
      const destino = som.spatialNode ?? som.pannerNode ?? som.manager?.destination;
      if (som.volumeNode && contexto?.createBiquadFilter && destino) {
        filtro = contexto.createBiquadFilter();
        filtro.type = "lowpass"; filtro.Q.value = 0.6;
        som.volumeNode.disconnect(destino);
        som.volumeNode.connect(filtro); filtro.connect(destino);
      }
    }
    const alvoPan = limitar(dx / Math.sqrt(dx * dx + dy * dy + 90 * 90) * 0.9, -0.9, 0.9);
    pan = pan === null ? alvoPan : pan + (alvoPan - pan) * (1 - Math.exp(-dt / 0.05));
    // Doppler discreto: aproximação sobe até 45 cents, afastamento desce até 45.
    const radial = (dx * (vx - velocidadeOuvinte.x) + dy * (vy + vertical - velocidadeOuvinte.y)) /
      Math.max(distancia, 1);
    // Som grave ao pairar; o motor afina com o deslocamento no mapa.
    // A levitação visual não entra nessa velocidade. Laterais têm mais presença.
    const deslocamentoMotor = limitar((velocidade - 8) / 167, 0, 1);
    const lateral = Math.abs(vx) / Math.max(velocidade, 1);
    const tomMovimento = deslocamentoMotor ** 0.8 * (260 + 100 * lateral);
    const alvoAfinacao = AFINACAO + tomMovimento + limitar(-radial * 0.22, -45, 45);
    const suavidadeTom = alvoAfinacao > afinacao ? 0.09 : 0.2;
    afinacao += (alvoAfinacao - afinacao) * (1 - Math.exp(-dt / suavidadeTom));
    if (!tocando) {
      const seek = som.totalDuration > 0
        ? ((robo.faseFlutuacao ?? Math.abs(robo.x) * 0.013) * 1.27) % som.totalDuration : 0;
      tocando = !!som.play({ volume: 0, loop: true, rate: 1, detune: afinacao, seek, pan });
      afinacaoAplicada = afinacao;
      entrada = 0;
    }
    if (!tocando) return;
    const proximidade = 1 - distancia / ALCANCE;
    const borda = proximidade * proximidade * (3 - 2 * proximidade);
    const atenuacao = borda / (1 + (distancia / 125) ** 2);
    const intensidade = limitar(0.018 + 0.035 * Math.min(velocidade / 175, 1) + 0.947 * forca, 0, 1);
    entrada = Math.min(1, entrada + dt / ENTRADA_SUAVE_SEGUNDOS);
    const ganhoEntrada = entrada * entrada * (3 - 2 * entrada);
    fonte.volume = VOLUME_MAXIMO * atenuacao * intensidade * limitar(robo.alpha ?? 1, 0, 1) * ganhoEntrada;
    som.setPan(pan);
    if (Math.abs(afinacao - afinacaoAplicada) >= 1) {
      som.setDetune?.(afinacao);
      afinacaoAplicada = afinacao;
    }
    // Distante perde agudos, além de volume; perto conserva a textura da propulsão.
    filtro?.frequency.setTargetAtTime(1000 + 9000 * proximidade ** 2, som.manager.context.currentTime, 0.06);
    grupo.add(fonte);
    distribuir();
  };
  const pausar = () => { if (tocando) som.pause(); };
  const retomar = () => {
    anterior = null; direcaoImpulso = null; intervalo = Infinity;
    if (tocando) som.resume();
  };
  const destruir = () => {
    if (destruido) return;
    destruido = true;
    parar(); som?.destroy(); filtro?.disconnect(); som = null; filtro = null;
    scene.events.off("postupdate", atualizar);
    scene.events.off("pause", pausar);
    scene.events.off("resume", retomar);
    scene.events.off("shutdown", destruir);
    robo.off("destroy", destruir);
    controles.delete(robo);
  };
  controles.set(robo, destruir);
  scene.events.on("postupdate", atualizar);
  scene.events.on("pause", pausar);
  scene.events.on("resume", retomar);
  scene.events.once("shutdown", destruir);
  robo.once("destroy", destruir);
}
