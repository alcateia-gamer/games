import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
const CHAVE = "porta-fabrica";
const VELOCIDADE = 5700 / 2500;
// O ciclo original de 5700 ms termina em 2500 ms; áudio e animação usam o mesmo fator.
// A subida acompanha o mecanismo; o impacto em 5,7 s marca o fim do curso.
export const SINCRONIA_PORTA_FABRICA = Object.freeze({
  velocidade: VELOCIDADE,
  atraso: 650 / VELOCIDADE,
  movimento: 5050 / VELOCIDADE,
  encaixe: 5.68,
});

export function carregarSomPortaFabrica(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/PORTA.mp3");
}

export function criarSomPortaFabrica(scene, area, animada) {
  scene = cenaSomCompartilhado(scene, () => ({ x: area.x + area.width / 2, y: area.y + area.height / 2 }), { range: 720 });
  let som = null;
  const parar = () => som?.stop();
  return {
    tocar(progresso = 0) {
      if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
      const dx = area.x + area.width / 2 - (scene.player?.x ?? area.x);
      const dy = area.y + area.height / 2 - (scene.player?.y ?? area.y);
      const distancia = Math.hypot(dx, dy);
      if (distancia >= 720 || progresso >= 1) return;
      if (!som) {
        som = scene.sound.add(CHAVE, { loop: false });
      }
      parar();
      // As duas persianas do leitor tocam juntas: cada uma usa menos volume.
      const parArena = area.name === "porta02" || area.name === "porta03";
      const volume = (animada ? 0.38 : 0.28) * (parArena ? 0.6 : 1)
        * Math.max(0, 1 - distancia / 720) ** 2;
      // Persianas usam o áudio inteiro. A porta sem movimento visual abre no
      // impacto e mantém toda a sua ressonância, sem cortar a cauda do arquivo.
      // A subida é linear, então seu progresso também corresponde ao tempo.
      const seek = !animada ? SINCRONIA_PORTA_FABRICA.encaixe
        : progresso > 0 ? (SINCRONIA_PORTA_FABRICA.atraso
          + progresso * SINCRONIA_PORTA_FABRICA.movimento) * VELOCIDADE / 1000 : 0;
      som.play({ loop: false, rate: VELOCIDADE, detune: 0, volume, seek });
    },
    parar,
    destruir() { parar(); som?.destroy(); som = null; },
  };
}
