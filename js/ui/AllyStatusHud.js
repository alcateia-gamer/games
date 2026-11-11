/** Vida da equipe usando os mesmos retratos, molduras e preenchimentos do HUD principal. */
import { obterTemaPersonagem } from "./CharacterTheme.js";

const NOMES = { "kai-mercer": "KAI MERCER", "magnus-force": "MAGNUS FORCE", "aria-kade": "ARIA KADE", nyx: "NYX" };
const LARGURA = 240, ALTURA_LINHA = 50;
const ESCALA = 0.65;

export function obterAliadosHUD(scene) {
  if (!scene.multiplayer || !scene.coopRuntime) return [];
  const runtime = scene.coopRuntime, manager = runtime.manager;
  return (manager.room?.players ?? []).filter(p => p.id !== manager.playerId && p.character).map(p => {
    const remoto = runtime.players?.remotes?.get(p.id);
    const maxima = Number.isFinite(p.maxHealth) && p.maxHealth > 0 ? p.maxHealth : 100;
    const atual = remoto?.health ?? p.health;
    const vida = p.dead ? 0 : Number.isFinite(atual) ? Math.max(0, Math.min(maxima, atual)) : null;
    return { id: p.id, personagem: p.character, nome: p.name || NOMES[p.character] || "ALIADO",
      vida, maxima, morto: !!p.dead || vida === 0 };
  }).slice(0, 3);
}

export class AllyStatusHud {
  constructor(scene, obterArte) {
    this.scene = scene;
    this.obterArte = obterArte;
    this.elemento = null;
    this.chave = null;
  }

  atualizar() {
    const aliados = obterAliadosHUD(this.scene), principal = this.scene.hudStatus?.elemento;
    if (!aliados.length || !principal?.parentElement) { this.destruir(); return; }
    if (!this.elemento) {
      this.elemento = document.createElement("canvas");
      this.elemento.setAttribute("role", "img");
      Object.assign(this.elemento.style, { position: "absolute", pointerEvents: "none",
        touchAction: "none", zIndex: "100", display: "block" });
      principal.parentElement.appendChild(this.elemento);
    }
    const canvas = this.elemento, dpr = Math.max(1, window.devicePixelRatio || 1);
    const escala = parseFloat(principal.style.width) / 350;
    if (!(escala > 0)) return;
    const largura = Math.max(1, Math.round(LARGURA * ESCALA * escala * dpr));
    const altura = Math.max(1, Math.round(aliados.length * ALTURA_LINHA * ESCALA * escala * dpr));
    Object.assign(canvas.style, { left: principal.style.left,
      top: `${parseFloat(principal.style.top) + parseFloat(principal.style.height) + 4 * escala}px`,
      width: `${largura / dpr}px`, height: `${altura / dpr}px`, visibility: principal.style.visibility || "" });
    const chave = JSON.stringify([largura, altura, aliados]);
    if (this.chave === chave) return;
    this.chave = chave;
    canvas.width = largura; canvas.height = altura;
    canvas.setAttribute("aria-label", aliados.map(a => `${a.nome}: ${a.morto ? "caído" : `${a.vida ?? "?"} de ${a.maxima} de vida`}`).join("; "));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(largura / LARGURA, 0, 0, altura / (aliados.length * ALTURA_LINHA), 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    aliados.forEach((aliado, indice) => {
      const dados = this.obterArte(aliado.personagem), y = indice * ALTURA_LINHA;
      const tema = obterTemaPersonagem(aliado.personagem);
      const escalaRetrato = 46 / dados.altura;
      ctx.save();
      ctx.globalAlpha = aliado.morto ? 0.5 : 1;
      ctx.drawImage(dados.base, 0, 0, dados.estamina.x, dados.altura,
        0, y, dados.estamina.x * escalaRetrato, 46);
      // Recorta a barra original com sua borda, sem incluir a faixa de estamina.
      const b = dados.vida, margem = 8;
      const sx = Math.max(0, b.x - margem), sy = Math.max(0, b.y - margem);
      const sw = Math.min(dados.largura - sx, b.width + margem * 2);
      const sh = Math.min(dados.altura - sy, b.height + margem * 2);
      ctx.drawImage(dados.base, sx, sy, sw, sh, 58, y + 25, 176, 14);
      if (aliado.vida > 0) {
        ctx.save(); ctx.beginPath();
        ctx.rect(58 + (b.x - sx) / sw * 176, y + 25,
          b.width / sw * 176 * aliado.vida / aliado.maxima, 14);
        ctx.clip();
        ctx.drawImage(dados.preenchimentoVida, sx, sy, sw, sh, 58, y + 25, 176, 14);
        ctx.restore();
      }
      ctx.fillStyle = tema.accentCss;
      ctx.font = "bold 11px monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      ctx.shadowColor = "#000"; ctx.shadowBlur = 2;
      ctx.fillText(aliado.nome, 59, y + 14, 110);
      ctx.textAlign = "right"; ctx.fillStyle = aliado.morto ? "#ff7584" : "#edf4fa";
      if (aliado.morto) ctx.fillText("CAÍDO", 233, y + 14, 62);
      ctx.restore();
    });
  }

  destruir() {
    this.elemento?.remove(); this.elemento = null; this.chave = null;
  }
}
