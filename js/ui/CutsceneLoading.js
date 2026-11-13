import { CUTSCENE_LAYOUT, CutsceneGate, fitCutscene } from "./CutsceneLayout.js";
import { CutsceneTelevision } from "./CutsceneTelevision.js";

/** DOM nativo mantém o GIF animado e o MP4 decodificado enquanto o Phaser carrega. */
export class CutsceneLoading {
  constructor(game) {
    this.game = game;
    this.gate = new CutsceneGate();
    this.destroyed = false;
    this.finishing = false;
    this.root = document.createElement("section");
    this.root.className = "cutscene-loading";
    this.powerOffDuration = 480;
    this.root.style.setProperty("--cutscene-power-off-duration", `${this.powerOffDuration}ms`);
    this.root.setAttribute("aria-label", "Introdução de Nullborns");
    const backdrop = document.createElement("img");
    backdrop.className = "cutscene-backdrop";
    backdrop.alt = "";
    backdrop.setAttribute("aria-hidden", "true");
    const stage = this.stage = document.createElement("div");
    stage.className = "cutscene-television";
    const television = this.television = document.createElement("img");
    television.className = "cutscene-television-art";
    television.alt = "Televisão da introdução";
    television.draggable = false;
    const screen = this.screen = document.createElement("div");
    screen.className = "cutscene-television-screen";
    const layout = CUTSCENE_LAYOUT;
    for (const [property, value] of Object.entries({ left: layout.screen.x / layout.width,
      top: layout.screen.y / layout.height, width: layout.screen.width / layout.width,
      height: layout.screen.height / layout.height })) screen.style[property] = `${value * 100}%`;
    const video = this.video = document.createElement("video");
    video.src = "assets/efeitos/derivados/cutscene-tv.mp4";
    video.preload = "auto";
    video.playsInline = true;
    video.setAttribute("webkit-playsinline", "");
    video.disablePictureInPicture = true;
    video.controls = false;
    video.hidden = true;
    video.volume = 0.8;
    video.setAttribute("aria-label", "Vídeo de introdução");
    screen.append(video);
    stage.append(television, screen);
    this.televisionRenderer = new CutsceneTelevision(television, screen, backdrop);
    this.message = document.createElement("p");
    this.message.className = "cutscene-message";
    this.message.setAttribute("role", "status");
    this.message.hidden = true;
    this.action = document.createElement("button");
    this.action.className = "cutscene-action";
    this.action.type = "button";
    this.action.hidden = true;
    this.skip = document.createElement("button");
    this.skip.className = "cutscene-skip";
    this.skip.type = "button";
    this.skip.textContent = "Pular introdução";
    this.skip.addEventListener("click", () => this.finishVideo({ powerOff: true }));
    this.root.append(backdrop, stage, this.message, this.action, this.skip);
    (document.getElementById("game-container") || document.body).append(this.root);
    this.onPlaying = () => { if (!this.gate.videoFinished) this.video.hidden = false; };
    this.onEnded = () => this.finishVideo();
    this.onMediaError = () => this.showMediaError();
    this.onVisibility = () => {
      if (!document.hidden) {
        if (!this.gate.videoFinished && this.video.paused && !this.mediaFailed) void this.play();
        this.tryFinish();
      }
    };
    this.onResize = () => {
      if (this.destroyed) return;
      const { width, height } = this.root.getBoundingClientRect();
      const rect = fitCutscene(width, height);
      Object.assign(stage.style, { width: `${rect.width}px`, height: `${rect.height}px`,
        left: `${rect.x}px`, top: `${rect.y}px` });
    };
    video.addEventListener("playing", this.onPlaying);
    video.addEventListener("ended", this.onEnded);
    video.addEventListener("error", this.onMediaError);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("resize", this.onResize, { passive: true });
    this.observer = typeof ResizeObserver === "function" ? new ResizeObserver(this.onResize) : null;
    this.observer?.observe(this.root);
    this.onGameDestroy = () => this.destroy();
    game.events.once("destroy", this.onGameDestroy);
    this.onResize();
    this.game.musicaMenu?.stop();
    void this.televisionRenderer.ready.then(() => this.play());
  }

  attach(scene) {
    this.release();
    this.scene = scene;
    this.onSceneShutdown = () => this.destroy();
    scene.events.once("shutdown", this.onSceneShutdown);
  }

  /** Transfere a mesma apresentação entre BootPartida e preloader sem reiniciá-la. */
  release() {
    this.scene?.events.off("shutdown", this.onSceneShutdown);
    this.scene = null;
  }

  async play() {
    if (this.destroyed || this.gate.videoFinished || this.mediaFailed) return;
    try {
      await this.video.play();
    } catch (error) {
      if (this.destroyed || this.gate.videoFinished || error.name === "AbortError") return;
      if (error.name !== "NotAllowedError") { this.showMediaError(); return; }
      // Safari pode exigir um novo gesto para áudio, mesmo após o menu.
      this.video.muted = true;
      try { await this.video.play(); }
      catch {
        if (this.destroyed || this.gate.videoFinished) return;
        this.setAction("Toque para assistir", () => {
          this.clearMessage(); this.video.muted = false; void this.play();
        });
      }
    }
  }

  finishVideo({ powerOff = false } = {}) {
    if (this.destroyed || this.gate.videoFinished) return;
    this.gate.videoFinished = true;
    this.video.pause();
    this.skip.hidden = true;
    if (this.mediaFailed && !this.loadFailed) this.clearMessage();
    if (powerOff) {
      this.poweringOff = true;
      this.televisionRenderer.freeze();
      this.root.classList.add("cutscene-powering-off");
      this.powerOffTimer = window.setTimeout(() => {
        if (this.destroyed) return;
        this.poweringOff = false;
        this.root.classList.remove("cutscene-powering-off");
        this.root.classList.add("cutscene-powered-off");
        this.video.hidden = true;
        this.tryFinish();
      }, this.powerOffDuration);
      return;
    }
    // A tela limpa não revela a estática do GIF original durante a espera.
    if (!this.gate.assetsReady) this.video.hidden = true;
    this.tryFinish();
  }

  setAssetsReady(callback) {
    this.onComplete = callback;
    this.gate.assetsReady = true;
    this.tryFinish();
  }

  tryFinish() {
    if (this.destroyed || this.finishing || this.poweringOff || this.loadFailed || document.hidden || !this.onComplete || !this.gate.complete()) return;
    this.finishing = true;
    this.root.classList.add("cutscene-leaving");
    this.exitTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      const complete = this.onComplete;
      this.destroy();
      complete();
    }, 350);
  }

  setAction(label, callback) {
    this.action.hidden = false;
    this.action.textContent = label;
    this.action.onclick = callback;
  }

  showMediaError() {
    if (this.destroyed || this.mediaFailed || this.gate.videoFinished) return;
    this.mediaFailed = true;
    this.video.hidden = true;
    if (this.loadFailed) return;
    this.message.textContent = "Não foi possível reproduzir a transmissão.";
    this.message.hidden = false;
    this.setAction("Continuar", () => this.finishVideo());
  }

  showLoadError(message, retry) {
    if (this.destroyed) return;
    this.loadFailed = true;
    this.message.textContent = message;
    this.message.hidden = false;
    this.setAction("Tentar novamente", retry);
  }

  clearMessage() {
    this.loadFailed = false;
    this.message.hidden = true;
    this.action.hidden = true;
    this.action.onclick = null;
    if (this.mediaFailed && !this.gate.videoFinished) {
      this.message.textContent = "Não foi possível reproduzir a transmissão.";
      this.message.hidden = false;
      this.setAction("Continuar", () => this.finishVideo());
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.clearTimeout(this.exitTimer);
    window.clearTimeout(this.powerOffTimer);
    this.release();
    this.observer?.disconnect();
    this.televisionRenderer.destroy();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.game.events.off("destroy", this.onGameDestroy);
    this.video.removeEventListener("playing", this.onPlaying);
    this.video.removeEventListener("ended", this.onEnded);
    this.video.removeEventListener("error", this.onMediaError);
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.root.remove();
    this.onComplete = null;
  }
}
