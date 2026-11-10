import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ROBO_BOLA_FLUTUACAO } from "../enemies/RoboBolaFlutuacao.js";
import { existsSync, readFileSync } from "node:fs";
import { carregarSomPropulsaoRoboBola, configurarSomPropulsaoRoboBola as configurarPropulsao } from "./propulsaoRoboBola.js";

// Os testes de movimento abaixo isolam o comportamento depois do nascimento.
const configurarSomPropulsaoRoboBola = (scene, robo) =>
  configurarPropulsao(scene, robo, { silencioInicialMs: 0 });

function fixture(webAudio = false, entradaWebAudio = false) {
  const sons = [], filtros = [], envelopes = [];
  const scene = { events: new EventEmitter(), player: { x: 0, y: 0, active: true },
    cache: { audio: { exists: () => true } }, sound: { add(key) {
      const som = { key, volume: 0, totalDuration: 8, plays: [], stops: 0, destroyed: false,
        play(config) { this.plays.push(config); this.detune = config.detune;
          this.ganhoAoIniciar = envelopes.at(-1)?.gain.value; return true; },
        stop() { this.stops++; }, destroy() { this.destroyed = true; },
        setVolume(volume) { this.volume = volume; }, setPan(pan) { this.pan = pan; },
        setDetune(detune) { this.detune = detune; },
        pause() { this.paused = true; }, resume() { this.paused = false; },
      };
      if (webAudio) {
        const parametro = () => ({ value: 0, cancelScheduledValues() {},
          setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; },
          setTargetAtTime(v) { this.value = v; } });
        som.spatialNode = {};
        som.volumeNode = { gain: parametro(), connect(node) { this.connected = node; }, disconnect() {} };
        som.manager = { context: { currentTime: 1, createBiquadFilter() {
          const filtro = { Q: parametro(), frequency: parametro(), connect(node) { this.connected = node; },
            disconnect() { this.disconnected = true; } };
          filtros.push(filtro); return filtro;
        } } };
        if (entradaWebAudio) som.manager.context.createGain = () => {
          const gain = parametro();
          gain.setValueCurveAtTime = (curve, time, duration) => {
            gain.curva = Array.from(curve); gain.inicio = time; gain.duracao = duration;
          };
          const node = { gain, connect(destino) { this.connected = destino; },
            disconnect() { this.disconnected = true; } };
          envelopes.push(node); return node;
        };
      }
      sons.push(som); return som;
    } } };
  const robo = () => Object.assign(new EventEmitter(), { tipoRobo: "bola", active: true,
    x: 0, y: 0, alpha: 1, faseFlutuacao: 1, deslocamentoFlutuacao: 0,
    body: { velocity: { x: 0, y: 0 } } });
  const tick = (delta = 20) => scene.events.emit("postupdate", 0, delta);
  const avancar = (n = 65) => { for (let i = 0; i < n; i++) tick(); };
  return { scene, sons, filtros, envelopes, robo, tick, avancar };
}

test("carrega o loop recortado e mantém a sustentação mais grave", () => {
  carregarSomPropulsaoRoboBola({ audio(key, path) {
    assert.equal(key, "robo-bola-propulsao");
    assert.ok(path.endsWith("robo_bola_voando_loop.wav"));
    assert.ok(existsSync(new URL(`../../assets/${path}`, import.meta.url)));
  } });
  const { scene, sons, robo, tick } = fixture();
  const r = robo(); configurarSomPropulsaoRoboBola(scene, r);
  configurarSomPropulsaoRoboBola(scene, r); tick();
  assert.equal(sons.length, 1);
  assert.deepEqual(sons[0].plays[0], { volume: 0, loop: true, rate: 1, detune: -600, seek: 1.27, pan: 0 });
});
test("loop de 7,15 s preserva estéreo e fecha sem salto de amplitude", () => {
  const wav = readFileSync(new URL("../../assets/sounds.mp3/SONS PARA BOTAR AINDA/robo_bola_voando_loop.wav", import.meta.url));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  const canais = wav.readUInt16LE(22), frequencia = wav.readUInt32LE(24);
  assert.equal(canais, 2); assert.equal(frequencia, 44100);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40) / (canais * 2 * frequencia), 7.15);
  for (let canal = 0; canal < canais; canal++) {
    const primeiro = wav.readInt16LE(44 + canal * 2);
    const ultimo = wav.readInt16LE(wav.length - canais * 2 + canal * 2);
    assert.ok(Math.abs(primeiro - ultimo) / 32767 < 0.005, "emenda sem degrau que produza outro tuk");
  }
});
test("sem movimento real não há pulsação artificial, mesmo mudando relógio e fase", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo(); configurarSomPropulsaoRoboBola(scene, r); tick(); avancar();
  const volume = sons[0].volume;
  for (let i = 0; i < 180; i++) { r.faseFlutuacaoAtual = i * 0.2; tick(); }
  assert.equal(sons[0].volume, volume);
  assert.equal(sons[0].plays.length, 1);
});
test("começar já em movimento não dispara rajada e a propulsão entra suavemente", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo(); r.body.velocity.x = 120;
  configurarSomPropulsaoRoboBola(scene, r); tick();
  const inicial = sons[0].volume;
  avancar(65); const cruzeiro = sons[0].volume;
  assert.ok(inicial < cruzeiro / 20, "entrada discreta, sem impacto de nascimento");
  assert.ok(cruzeiro < 0.02, "velocidade inicial não inventa uma rajada");
  avancar(30); assert.equal(sons[0].volume, cruzeiro);
  r.body.velocity.x = 0; tick(); avancar(50);
  r.body.velocity.x = 120; tick();
  assert.ok(sons[0].volume > cruzeiro * 5, "arranque posterior continua audível");
  assert.deepEqual(sons.map(s => s.key), ["robo-bola-propulsao"]);
  assert.equal(sons[0].plays.length, 1, "nenhum efeito extra é disparado");
});
test("nascimento fica silencioso mesmo com subidas e manobras, sem guardar jato para depois", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo();
  configurarPropulsao(scene, r);
  for (let i = 0; i < 30; i++) {
    r.body.velocity.x = i < 15 ? 120 : -120;
    r.deslocamentoFlutuacao = -i * 0.4;
    tick();
    assert.equal(sons.length, 0, "nenhuma voz toca durante os primeiros 600 ms");
  }
  tick(); avancar(15);
  assert.equal(sons.length, 1);
  assert.ok(sons[0].volume > 0 && sons[0].volume < 0.02, "retoma o motor sem rajada acumulada");
  const cruzeiro = sons[0].volume;
  r.body.velocity.x = 0; r.body.velocity.y = 120; tick();
  assert.ok(sons[0].volume > cruzeiro * 5, "manobras seguintes mantêm o jato normal");
  r.x = 500; tick(); r.x = 0; tick();
  assert.equal(sons[0].plays.length, 2, "aproximar de novo não repete o silêncio de nascimento");
});
test("rajadas seguem os instantes irregulares de arranque, curva e frenagem", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo(); configurarSomPropulsaoRoboBola(scene, r); tick(); avancar(65);
  const repouso = sons[0].volume;
  r.body.velocity.x = 120; tick(); const arranque = sons[0].volume;
  assert.ok(arranque > repouso * 10);
  avancar(31); const cruzeiro = sons[0].volume;
  assert.ok(cruzeiro < arranque / 3);
  r.body.velocity.x = 0; r.body.velocity.y = 120; tick();
  assert.ok(sons[0].volume > cruzeiro * 2, "curva dispara no instante da mudança");
  avancar(49); const antesFrear = sons[0].volume;
  r.body.velocity.y = 0; tick(); assert.ok(sons[0].volume > antesFrear * 2);
  avancar(80);
  assert.ok(sons[0].volume < arranque / 15, "sem eventos não repete a rajada");
  assert.equal(sons[0].plays.length, 1);
});
test("início real da subida dispara propulsão, altura estática não sustenta o pulso", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo(); configurarSomPropulsaoRoboBola(scene, r); tick(); avancar();
  r.deslocamentoFlutuacao = 0.5; tick(100); const descendo = sons[0].volume;
  r.deslocamentoFlutuacao = 0.2; tick(100);
  assert.ok(sons[0].volume > descendo * 10);
  const subindo = sons[0].volume; avancar(60);
  assert.ok(sons[0].volume < subindo / 20);
});
test("Web Audio começa com ganho zero e sobe continuamente por 1,2 segundo antes dos pulsos normais", () => {
  const { scene, sons, filtros, envelopes, robo, tick } = fixture(true, true);
  const r = robo(); configurarSomPropulsaoRoboBola(scene, r); tick();
  const envelope = envelopes[0];
  assert.equal(sons[0].ganhoAoIniciar, 0, "fonte inicia com a saída já silenciada");
  assert.equal(filtros[0].connected, envelope);
  assert.equal(envelope.connected, sons[0].spatialNode);
  assert.equal(envelope.gain.duracao, 1.2);
  assert.equal(envelope.gain.curva[0], 0);
  assert.equal(envelope.gain.curva.at(-1), 1);
  assert.ok(envelope.gain.curva[10] < 0.02, "primeiros ~94 ms continuam quase inaudíveis");
  for (let i = 1; i < envelope.gain.curva.length; i++) {
    assert.ok(envelope.gain.curva[i] >= envelope.gain.curva[i - 1]);
  }
  r.body.velocity.x = 175; tick();
  assert.equal(envelope.gain.inicio, 1, "arranque não reinicia nem pula a entrada de volume");
  scene.events.emit("shutdown"); assert.equal(envelope.disconnected, true);
});
test("aproximação tem mais presença e distância perde agudos; passagem cruza o estéreo", () => {
  const { scene, sons, filtros, robo, tick, avancar } = fixture(true);
  const r = robo(); r.x = 500; configurarSomPropulsaoRoboBola(scene, r); tick();
  assert.equal(sons.length, 0);
  r.x = 80; tick(); avancar(); const perto = sons[0].volume, agudos = filtros[0].frequency.value;
  assert.ok(sons[0].pan > 0.5);
  assert.equal(sons[0].volumeNode.connected, filtros[0]);
  assert.equal(filtros[0].connected, sons[0].spatialNode);
  r.x = 300; tick(); avancar();
  assert.ok(sons[0].volume < perto / 10);
  assert.ok(filtros[0].frequency.value < agudos / 2);
  r.x = -80; tick(); avancar(); assert.ok(sons[0].pan < -0.5);
  r.x = 400; tick(); assert.equal(sons[0].stops, 1);
  r.x = 40; tick(); assert.equal(sons[0].plays.length, 2);
  scene.events.emit("shutdown"); assert.equal(filtros[0].disconnected, true);
});
test("Doppler acompanha aproximação e afastamento sem esconder o tom de movimento", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo(); r.x = 100; configurarSomPropulsaoRoboBola(scene, r); tick();
  r.body.velocity.x = -150; avancar(40); const aproxima = sons[0].detune;
  r.body.velocity.x = 150; avancar(40); const afasta = sons[0].detune;
  assert.ok(aproxima > afasta + 40);
  assert.ok(afasta > -500, "mesmo afastando, deslocamento afina em relação ao pairar");
  r.body.velocity.x = 0; avancar(70); assert.ok(Math.abs(sons[0].detune + 600) < 2);
  for (let i = 0; i < 30; i++) { scene.player.x += 1; tick(); }
  assert.ok(sons[0].detune > -595, "ouvinte se aproximando também conta");
});
test("tom sobe progressivamente com velocidade lateral e retorna ao grave ao parar", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo(); r.y = 100; configurarSomPropulsaoRoboBola(scene, r); tick();
  const parado = sons[0].detune;
  r.body.velocity.x = 160; tick(); const inicio = sons[0].detune;
  avancar(40); const rapido = sons[0].detune;
  assert.ok(inicio > parado && inicio < rapido - 100, "transição sobe suavemente");
  assert.ok(rapido > parado + 280, "afinação lateral é claramente perceptível");
  r.body.velocity.x = -160; avancar(50);
  assert.ok(Math.abs(sons[0].detune - rapido) < 2, "ambos os lados afinam igualmente");
  r.body.velocity.x = 45; avancar(50); const lento = sons[0].detune;
  assert.ok(lento < rapido - 150 && lento > parado + 60);
  r.body.velocity.x = 0; avancar(70);
  assert.ok(Math.abs(sons[0].detune - parado) < 2);
  assert.equal(sons[0].plays.length, 1, "motor não reinicia para mudar de tom");
});
test("levitar sozinho preserva o grave mesmo com rajadas de sustentação", () => {
  const { scene, sons, robo, tick } = fixture();
  const r = robo(); r.y = 100; configurarSomPropulsaoRoboBola(scene, r); tick();
  for (let i = 0; i < 120; i++) {
    r.deslocamentoFlutuacao = Math.sin(i * 20 / ROBO_BOLA_FLUTUACAO.periodoMs * Math.PI * 2) *
      ROBO_BOLA_FLUTUACAO.amplitude; tick();
    assert.ok(Math.abs(sons[0].detune + 600) < 15);
  }
});

test("réplicas usam deslocamento observado, sem física e sem relógio de pulsação", () => {
  const { scene, sons, robo, tick, avancar } = fixture();
  const r = robo(); delete r.body; delete r.deslocamentoFlutuacao;
  r.x = 100; r.scaleY = 0.56; r.originY = 0.5;
  configurarSomPropulsaoRoboBola(scene, r); tick(); const parado = sons[0].volume;
  r.x += 3; tick(); assert.ok(sons[0].volume > parado * 10);
  avancar(60); const repouso = sons[0].volume;
  r.originY += 0.01; tick(); assert.ok(sons[0].volume > repouso * 5);
  assert.equal(sons[0].plays.length, 1);
});
test("teleporte não vira impulso falso e cache ausente é tolerado", () => {
  const { scene, sons, robo, tick } = fixture();
  const r = robo(); configurarSomPropulsaoRoboBola(scene, r);
  scene.cache.audio.exists = () => false; tick(); assert.equal(sons.length, 0);
  scene.cache.audio.exists = () => true; tick(); const quieto = sons[0].volume;
  r.x = 600; tick(); r.x = 0; tick();
  assert.equal(sons[0].volume, quieto);
  scene.morteEmAndamento = true; tick(); assert.equal(sons[0].stops, 2);
});
test("limita motores juntos e limpa áudio, filtros e listeners na morte/saída", () => {
  const { scene, sons, filtros, robo, tick, avancar } = fixture(true);
  const robos = Array.from({ length: 6 }, () => {
    const r = robo();
    configurarSomPropulsaoRoboBola(scene, r); return r;
  });
  tick(); avancar();
  robos.forEach(r => { r.body.velocity.x = 175; }); tick();
  const total = sons.reduce((soma, s) => soma + s.volume, 0);
  assert.ok(total > 0.3 && total <= 0.41000001);
  scene.events.emit("pause"); assert.ok(sons.every(s => s.paused));
  scene.events.emit("resume"); assert.ok(sons.every(s => !s.paused));
  robos[0].morto = true; tick(); assert.equal(sons[0].destroyed, true);
  robos[1].emit("destroy"); assert.equal(sons[1].destroyed, true);
  scene.events.emit("shutdown"); assert.ok(sons.every(s => s.destroyed));
  assert.ok(filtros.every(f => f.disconnected));
  for (const event of ["postupdate", "pause", "resume", "shutdown"]) assert.equal(scene.events.listenerCount(event), 0);
});
