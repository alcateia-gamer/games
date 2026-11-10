/** Recorta o ataque inicial do MP3 e fecha o motor em um loop sem estalo.
 * PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs node scripts/preparar-propulsao-robo-bola.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE) : await import("playwright");
const origem = new URL("../assets/sounds.mp3/SONS PARA BOTAR AINDA/robo_bola_voando.mp3", import.meta.url);
const destino = new URL("../assets/sounds.mp3/SONS PARA BOTAR AINDA/robo_bola_voando_loop.wav", import.meta.url);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  const resultado = await page.evaluate(async (base64) => {
    const contexto = new OfflineAudioContext(2, 1, 44100);
    const buffer = await contexto.decodeAudioData(Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer);
    // Descarta os ataques de 0–0,7 s (picos em 0,22–0,24 e 0,56 s).
    // A sobreposição mistura os últimos 50 ms com os primeiros 50 ms úteis.
    const inicio = Math.round(0.7 * buffer.sampleRate);
    const fim = Math.round(7.9 * buffer.sampleRate);
    const sobreposicao = Math.round(0.05 * buffer.sampleRate);
    const quadros = fim - inicio - sobreposicao;
    const canais = buffer.numberOfChannels;
    const dados = new Uint8Array(quadros * canais * 2);
    const view = new DataView(dados.buffer);
    let saltoEmenda = 0;
    for (let canal = 0; canal < canais; canal++) {
      const fonte = buffer.getChannelData(canal);
      let primeiro, ultimo;
      for (let i = 0; i < quadros; i++) {
        let valor = fonte[inicio + sobreposicao + i];
        if (i >= quadros - sobreposicao) {
          const j = i - (quadros - sobreposicao);
          const t = j / (sobreposicao - 1);
          const mistura = t * t * (3 - 2 * t);
          valor = valor * (1 - mistura) + fonte[inicio + j] * mistura;
        }
        const pcm = Math.round(Math.max(-1, Math.min(1, valor)) * 32767);
        view.setInt16((i * canais + canal) * 2, pcm, true);
        if (i === 0) primeiro = pcm;
        ultimo = pcm;
      }
      saltoEmenda = Math.max(saltoEmenda, Math.abs(primeiro - ultimo) / 32767);
    }
    let binario = "";
    for (let i = 0; i < dados.length; i += 16384) {
      binario += String.fromCharCode(...dados.subarray(i, i + 16384));
    }
    return { pcm: btoa(binario), sampleRate: buffer.sampleRate, canais, quadros, saltoEmenda };
  }, readFileSync(origem).toString("base64"));
  const pcm = Buffer.from(resultado.pcm, "base64");
  const cabecalho = Buffer.alloc(44);
  cabecalho.write("RIFF", 0); cabecalho.writeUInt32LE(36 + pcm.length, 4);
  cabecalho.write("WAVEfmt ", 8); cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20); cabecalho.writeUInt16LE(resultado.canais, 22);
  cabecalho.writeUInt32LE(resultado.sampleRate, 24);
  cabecalho.writeUInt32LE(resultado.sampleRate * resultado.canais * 2, 28);
  cabecalho.writeUInt16LE(resultado.canais * 2, 32); cabecalho.writeUInt16LE(16, 34);
  cabecalho.write("data", 36); cabecalho.writeUInt32LE(pcm.length, 40);
  writeFileSync(destino, Buffer.concat([cabecalho, pcm]));
  console.log(JSON.stringify({ arquivo: destino.pathname, duracao: resultado.quadros / resultado.sampleRate,
    saltoEmenda: resultado.saltoEmenda, inicioOriginalExcluidoAte: 0.7, emendaMs: 50 }));
} finally {
  await browser.close();
}
