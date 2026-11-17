/** Relógio do loop do Phaser; nenhum timer sobrevive à interface. */
export class TypewriterText {
  constructor(text, { characterMs = 30, punctuationMs = 90 } = {}) {
    this.characters = Array.from(text); this.characterMs = Math.max(1, characterMs);
    this.punctuationMs = Math.max(0, punctuationMs); this.index = 0; this.elapsed = 0;
  }
  get complete() { return this.index >= this.characters.length; }
  get text() { return this.characters.slice(0, this.index).join(''); }
  update(delta) {
    this.elapsed += Math.max(0, delta);
    while (!this.complete) {
      const delay = this.characterMs + (/[,.!?…]/u.test(this.characters[this.index - 1] || '') ? this.punctuationMs : 0);
      if (this.elapsed < delay) break;
      this.elapsed -= delay; this.index++;
    }
    return this.text;
  }
  reveal() { this.index = this.characters.length; return this.text; }
}
