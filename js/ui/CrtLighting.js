import { dispositivoComToque } from '../core/MobileDisplay.js';
import { CUTSCENE_LAYOUT } from './CutsceneLayout.js';

/** CRT: amostragem de 160 pixels no desktop; apenas luz de estado no modo leve. */
export class CrtLighting {
  constructor(stage, screen, video) {
    Object.assign(this, { stage, screen, video });
    this.lowPower = dispositivoComToque() || navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4;
    stage.classList.toggle('crt-low-power', this.lowPower);
    // Ler vídeo de volta da GPU pode travar a decodificação nos celulares.
    this.canvas = this.lowPower ? null : document.createElement('canvas');
    if (this.canvas) { this.canvas.width = 16; this.canvas.height = 10; }
    this.context = this.canvas?.getContext('2d', { willReadFrequently: true }) || null;
    this.color = [80, 220, 140];
    this.emission = 0;
    this.spill = document.createElement('div');
    this.spill.className = 'crt-room-light';
    this.spill.setAttribute('aria-hidden', 'true');
    this.rim = document.createElement('div');
    this.rim.className = 'crt-rim-light';
    this.rim.setAttribute('aria-hidden', 'true');
    const rect = CUTSCENE_LAYOUT.screen;
    for (const [property, value] of Object.entries({ left: rect.x / CUTSCENE_LAYOUT.width,
      top: rect.y / CUTSCENE_LAYOUT.height, width: rect.width / CUTSCENE_LAYOUT.width,
      height: rect.height / CUTSCENE_LAYOUT.height })) this.rim.style[property] = `${value * 100}%`;
    const emitter = document.createElement('div');
    emitter.className = 'crt-rim-emitter';
    emitter.style.clipPath = rect.clipPath;
    this.rim.append(emitter);
    this.glass = document.createElement('div');
    this.glass.className = 'crt-glass';
    this.glass.setAttribute('aria-hidden', 'true');
    stage.append(this.spill, this.rim);
    screen.append(this.glass);
    this.timer = window.setInterval(() => this.update(), this.lowPower ? 600 : 160);
    this.update();
  }

  videoLight() {
    const video = this.video;
    if (this.lowPower) return { color: [150, 185, 170], emission: video.readyState >= 2 ? 0.16 : 0 };
    if (this.lastVideoTime === video.currentTime && this.lastVideoLight) return this.lastVideoLight;
    if (!this.context || this.samplingFailed || video.readyState < 2) return { color: [160, 190, 210], emission: 0.12 };
    try {
      // A imagem é esticada sobre todo o vidro, sem faixas de ajuste de proporção.
      this.context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, 16, 10);
      const pixels = this.context.getImageData(0, 0, 16, 10).data;
      const mean = [0, 0, 0];
      for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += pixels[i + c] / 160;
      const luma = (mean[0] * 0.2126 + mean[1] * 0.7152 + mean[2] * 0.0722) / 255;
      const peak = Math.max(25, ...mean);
      this.lastVideoTime = video.currentTime;
      this.lastVideoLight = { color: mean.map(value => Math.min(255, 25 + value / peak * 220)),
        emission: luma < 0.015 ? 0.015 : Math.min(0.95, 0.1 + luma * 1.15) };
      return this.lastVideoLight;
    } catch {
      // Bloqueio de leitura de pixels não interrompe vídeo ou narrativa.
      this.samplingFailed = true;
      return { color: [160, 190, 210], emission: 0.12 };
    }
  }

  target() {
    if (!this.video.hidden) return this.videoLight();
    const messenger = this.screen.querySelector('.hollow-messenger');
    if (!messenger || messenger.hidden) return { color: this.color, emission: 0 };
    const compromised = messenger.classList.contains('hollow-compromised');
    if (this.lowPower) return { color: compromised ? [255, 65, 55] : [40, 255, 115], emission: 0.24 };
    const messages = [...messenger.querySelectorAll('.hollow-message')].slice(-3);
    const text = messages.map(message => message.textContent).join('');
    const arrival = text !== this.lastText ? 0.055 : 0;
    this.lastText = text;
    return { color: compromised ? [255, 65, 55] : [40, 255, 115],
      emission: 0.24 + Math.min(0.19, text.length / 1500) + arrival };
  }

  update() {
    if (this.destroyed || document.hidden) return;
    const target = this.target();
    const smoothing = this.lowPower ? 1 : 0.5;
    this.emission += (target.emission - this.emission) * smoothing;
    this.color = this.color.map((value, i) => value + (target.color[i] - value) * smoothing);
    const color = this.color.map(Math.round).join(' '), emission = this.emission.toFixed(3);
    // Evita invalidar as camadas do vídeo quando a iluminação não mudou.
    if (color !== this.lastColor) this.stage.style.setProperty('--crt-color', color);
    if (emission !== this.lastEmission) this.stage.style.setProperty('--crt-emission', emission);
    this.lastColor = color;
    this.lastEmission = emission;
  }

  destroy() {
    this.destroyed = true;
    window.clearInterval(this.timer);
    this.spill.remove();
    this.rim.remove();
    this.glass.remove();
    if (this.canvas) this.canvas.width = this.canvas.height = 0;
    this.stage.classList.remove('crt-low-power');
    this.stage.style.removeProperty('--crt-color');
    this.stage.style.removeProperty('--crt-emission');
  }
}
