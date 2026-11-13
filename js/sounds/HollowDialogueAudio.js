/** Bip curto de diálogo arcade, sintetizado no contexto de áudio já usado pelo jogo. */
export class HollowDialogueAudio {
  constructor(game) { this.game = game; this.voices = new Set(); }

  word() {
    const context = this.game.sound?.context;
    if (this.destroyed || this.game.sound?.locked || this.game.sound?.mute ||
        !context || context.state !== 'running') return;
    // Palavras curtas podem começar no mesmo frame; espaça os bipes sem sobrepô-los.
    const now = Math.max(context.currentTime, this.nextWordAt || 0);
    if (now - context.currentTime > 0.15) return;
    this.nextWordAt = now + 0.045;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const voice = { oscillator, gain };
      this.voices.add(voice);
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(740, now);
      oscillator.frequency.exponentialRampToValueAtTime(560, now + 0.032);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.018 * (this.game.sound.volume ?? 1), now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
      oscillator.connect(gain);
      gain.connect(this.game.sound.destination || context.destination);
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect(); this.voices.delete(voice);
      };
      oscillator.start(now);
      oscillator.stop(now + 0.036);
    } catch { /* O diálogo continua quando o navegador bloqueia o áudio. */ }
  }

  destroy() {
    this.destroyed = true;
    for (const { oscillator, gain } of this.voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Já encerrado. */ }
      oscillator.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }
}
