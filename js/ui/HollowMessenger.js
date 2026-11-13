/** Renderiza no mesmo elemento que contém o vídeo; não altera a composição da TV. */
export class HollowMessenger {
  constructor(screen, notify = () => {}) {
    this.notify = notify;
    this.reducedEffects = !!screen.closest('.crt-low-power');
    this.root = document.createElement('div');
    this.root.className = 'hollow-messenger';
    this.root.setAttribute('aria-label', 'The Hollow — canal seguro');
    this.root.innerHTML = `<header><strong>● HOLLOW.NET</strong><span>SECURE / 2189</span></header>
      <div class="hollow-encryption">ENCRYPTION: ACTIVE <span>07.404</span></div>
      <div class="hollow-feed" role="log" aria-live="off"></div>
      <div class="hollow-typing" role="status"></div>
      <footer><span>CANAL CRIPTOGRAFADO</span><span class="hollow-status">● ONLINE</span></footer>`;
    screen.append(this.root);
    this.feed = this.root.querySelector('.hollow-feed');
    this.typing = this.root.querySelector('.hollow-typing');
    this.status = this.root.querySelector('.hollow-status');
    this.resize = () => {
      const scale = screen.clientWidth / 572;
      this.root.style.transform = `scale(${scale})`;
      if (scale > 0) this.root.style.height = `${screen.clientHeight / scale}px`;
    };
    this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(this.resize) : null;
    this.observer?.observe(screen);
    this.resize();
  }

  wait(text) { this.typing.textContent = text; }

  show(line, index, silent = false) {
    if (this.index === index) return;
    this.index = index;
    if (line.purge) for (const item of this.feed.querySelectorAll('.hollow-unknown')) item.remove();
    this.root.classList.toggle('hollow-connecting', !!line.connection);
    this.root.classList.toggle('hollow-compromised', line.role === 'unknown' || !!line.interference);
    this.root.classList.toggle('hollow-operation-active', !!line.operation);
    this.status.textContent = line.role === 'unknown' || line.interference ? '● UNSTABLE' : '● ONLINE';
    if (line.connection || line.operation) this.feed.replaceChildren();
    const row = document.createElement('article');
    row.className = `hollow-message hollow-${line.role}${line.operation ? ' hollow-operation' : ''}`;
    const name = document.createElement('b');
    name.textContent = line.name;
    this.text = document.createElement(line.operation ? 'pre' : 'p');
    row.append(name, this.text);
    this.feed.append(row);
    this.feed.scrollTo({ top: this.feed.scrollHeight, behavior: silent || this.reducedEffects ? 'auto' : 'smooth' });
    this.silentLine = silent;
  }

  progress(line, amount, silent = false) {
    const value = line.text.slice(0, Math.ceil(line.text.length * amount));
    if (this.text.textContent !== value) {
      const previous = this.text.textContent;
      const words = text => (text.match(/(?:^|\s)\S/gu) || []).length;
      // Um bip quando a próxima palavra começa; revelar/recuperar texto não gera rajadas.
      if (!silent && !this.silentLine && line.typing &&
          ['hollow', 'agent'].includes(line.role) &&
          value.length - previous.length <= 12) {
        for (let word = words(previous); word < words(value); word++) this.notify('word');
      }
      this.text.textContent = value;
      if (!line.operation) this.feed.scrollTop = this.feed.scrollHeight;
    }
    this.typing.textContent = amount < 1 ? `${line.name} digitando…` : '';
  }

  destroy() { this.observer?.disconnect(); this.root.remove(); }
}
