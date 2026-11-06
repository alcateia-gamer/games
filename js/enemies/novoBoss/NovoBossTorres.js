import { assetsNovoBoss } from "./NovoBossAssets.js";
import { calcularDepthAtor } from "../../map/ProfundidadeMapa.js";
import { areasSobrepostasNovoBoss } from "./NovoBossTeleporte.js";
import { quadrosChoqueTorreIdle } from "./NovoBossTorreChoque.js";
import { prepararPisoTorre } from "./NovoBossTorrePiso.js";

const POSES = {
  summon: assetsNovoBoss.torreSummon, idle: assetsNovoBoss.torreIdle,
  attacked: assetsNovoBoss.torreAttacked, death: assetsNovoBoss.torreDeath,
};
const DURACOES = Object.fromEntries(Object.entries(POSES).map(([estado, asset]) =>
  [estado, asset.duracoesMs?.reduce((soma, ms) => soma + ms, 0) ??
    (asset.ultimoFrame + 1) * asset.frameMs]));

/** Retângulos são a base no chão; o Y negativo do Tiled já é o Y do mundo. */
export function pontosTorresNovoBoss(scene) {
  const camada = scene.map?.getObjectLayer?.("TorreBoss");
  if (!camada) return null;
  const colisoes = (scene.map.getObjectLayer("collision")?.objects ?? [])
    .filter(o => !o.point && !o.ellipse && !o.polygon && !o.polyline && !o.text &&
      [o.x, o.y, o.width, o.height].every(Number.isFinite) && o.width > 0 && o.height > 0 &&
      !(o.rotation ?? 0));
  return (camada.objects ?? []).filter(o => o.visible !== false &&
    !o.point && !o.ellipse && !o.polygon && !o.polyline && !o.gid && !o.text &&
    [o.x, o.y, o.width, o.height].every(Number.isFinite) &&
    o.width > 0 && o.height > 0 && !(o.rotation ?? 0)).map(o => {
    const x = o.x + o.width / 2, y = o.y + o.height / 2;
    let colisao = null, distancia = Infinity;
    for (const c of colisoes) {
      const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
      if (cx < o.x || cx > o.x + o.width || cy < o.y || cy > o.y + o.height) continue;
      const d = Math.hypot(cx - x, cy - y);
      if (d < distancia) { colisao = c; distancia = d; }
    }
    return { id: o.id, x, y, width: o.width, height: o.height,
      referenciaDepthY: colisao ? colisao.y + colisao.height / 2 : o.y + o.height };
  });
}

export function assetsTorresDisponiveis(scene) {
  return Object.values(POSES).every(asset => scene.textures?.exists?.(asset.chave));
}

/** Um sprite por torre; troca de quadros apenas quando o relógio muda de quadro. */
export function criarTorreNovoBoss(scene, encontro, ponto, aoDestruir) {
  const poses = prepararPisoTorre(scene, ponto, POSES);
  const escala = Math.min(ponto.width, ponto.height) / 192;
  const peY = ponto.y + ponto.height / 2;
  const referenciaDepthY = ponto.referenciaDepthY ?? peY;
  const visual = scene.add.sprite(ponto.x, peY, poses.summon.chave, 0)
    .setOrigin(0.5, 1).setScale(escala).setName(`novo-boss-torre-${ponto.id}`);
  const vidaMaxima = encontro.config.geradores.vidaTorre ?? 120;
  let estado = "summon", tempo = 0, iniciada = false, destruida = false;
  let ultimoFrame = 0;
  const luzChoqueIdle = { x: ponto.x, y: peY - 208 * escala, raio: 96 * escala, intensidade: 0 };
  const hitbox = new Phaser.Geom.Rectangle(ponto.x - 96 * escala, peY - 258 * escala,
    192 * escala, 258 * escala);
  // Somente alvo de dano: as colisões de movimento pertencem à camada collision do Tiled.
  hitbox.enable = false;

  function mudarPose(pose) {
    estado = pose;
    tempo = 0;
    ultimoFrame = 0;
    luzChoqueIdle.intensidade = 0;
    visual.setTexture(poses[pose].chave, 0);
  }

  const torre = {
    id: ponto.id, x: ponto.x, y: ponto.y, torre: true, ligado: true,
    visual, luzChoqueIdle, body: hitbox, vida: vidaMaxima, vidaMaxima, morto: false,
    hitboxDano: hitbox,
    duracaoInvocacaoMs: DURACOES.summon,
    duracaoIdleMs: DURACOES.idle,
    pontoEmissor: { x: ponto.x, y: peY - 208 * escala },
    get estado() { return estado; },
    invocar() { if (!destruida && !torre.morto) iniciada = true; },
    prepararInvocacao() {
      if (destruida || torre.morto) return;
      iniciada = false;
      mudarPose("summon");
      torre.body.enable = false;
    },
    get active() {
      return !destruida && !torre.morto && iniciada && estado !== "summon" &&
        encontro.active && visual.visible && torre.body.enable;
    },
    get visible() { return visual.visible; },
    receberDano(quantidade, area = null) {
      if (!torre.active || !Number.isFinite(quantidade) || quantidade <= 0 ||
          (area && !areasSobrepostasNovoBoss(area, hitbox))) return false;
      torre.vida = Math.max(0, torre.vida - quantidade);
      if (torre.vida === 0) {
        torre.morto = true;
        torre.ligado = false;
        torre.body.enable = false;
        mudarPose("death");
        aoDestruir(torre);
      } else mudarPose("attacked");
      return true;
    },
    atualizar(delta, visivel, apresentando = false) {
      if (destruida) return;
      luzChoqueIdle.intensidade = 0;
      const combate = Boolean(encontro.active);
      if (combate && !apresentando) iniciada = true;
      // A base já aparece no chão; o relógio só avança quando a câmera invoca a torre.
      visual.setVisible(visivel && (iniciada || estado === "summon"));
      // Compara com body.bottom do jogador. -6010 está acima de -6000; não inverte o sinal.
      // Em empate, o personagem fica à frente, como nos demais objetos do cenário.
      visual.setDepth(calcularDepthAtor(scene, referenciaDepthY, visual) - 1e-9);
      torre.body.enable = visivel && iniciada && !torre.morto;
      if (!visivel || !iniciada || (!combate && !apresentando)) return;
      tempo += Number.isFinite(delta) ? Math.max(0, delta) : 0;
      if ((estado === "summon" || estado === "attacked") && tempo >= DURACOES[estado]) {
        const restante = tempo - DURACOES[estado];
        mudarPose("idle");
        tempo = restante;
      }
      const asset = poses[estado];
      let ms = estado === "idle" ? tempo % DURACOES.idle : Math.min(tempo, DURACOES[estado] - 1);
      let frame = 0;
      if (asset.duracoesMs) {
        while (frame < asset.ultimoFrame && ms >= asset.duracoesMs[frame]) {
          ms -= asset.duracoesMs[frame++];
        }
      } else frame = Math.floor(ms / asset.frameMs);
      if (frame !== ultimoFrame) { visual.setFrame(frame); ultimoFrame = frame; }
      const choque = estado === "idle" ? quadrosChoqueTorreIdle[frame] : null;
      if (choque) {
        luzChoqueIdle.x = visual.x + (choque.x - 96) * escala;
        luzChoqueIdle.y = visual.y + (choque.y - 258) * escala;
        luzChoqueIdle.intensidade = choque.intensidade;
      }
    },
    destruir() {
      if (destruida) return;
      destruida = true;
      luzChoqueIdle.intensidade = 0;
      visual.destroy();
    },
  };
  return torre;
}
