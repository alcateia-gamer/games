// Estado exclusivamente local: BootPartida troca o token a cada nova partida.
export const SCRAP_TUTORIAL_KEY = 'nullborns:scrap-tutorial:run';

function icon(scene, key, frame) {
  const source = scene.textures.getFrame(key, frame);
  const canvas = document.createElement('canvas');
  canvas.width = source.cutWidth; canvas.height = source.cutHeight;
  canvas.getContext('2d').drawImage(source.source.image, source.cutX, source.cutY,
    source.cutWidth, source.cutHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL();
}

/** Abre depois de create; não pausa física, relógios ou simulação cooperativa. */
export function showScrapTutorial(scene) {
  const run = scene.registry.get(SCRAP_TUTORIAL_KEY);
  if (!run || run.seen || scene.sys.settings.key !== 'Level1') return null;
  run.seen = true;
  const previous = { input: scene.input.enabled, keyboard: scene.input.keyboard.enabled,
    movement: scene.movimentoBloqueado, menu: scene.upgradeMenuOpen };
  const focused = document.activeElement;
  scene.scrapTutorialOpen = true;
  // Reutiliza a trava de modal já consultada por ataques, habilidades e interações.
  scene.upgradeMenuOpen = true; scene.movimentoBloqueado = true;
  scene.player.setVelocity(0, 0); scene.joystick?.reset?.();
  scene.input.keyboard.resetKeys(); scene.input.enabled = false; scene.input.keyboard.enabled = false;
  const root = document.createElement('div'); root.className = 'scrap-tutorial';
  const steps = [
    ['robo-bola', 0, 'DESTRUA ROBÔS', 'Derrote robôs inimigos para conseguir sucatas!'],
    ['scrap-components', 'scrap-10', 'COLETE SUCATAS', 'Aproxime-se das sucatas no chão para coletá-las automaticamente.'],
    ['upgrade-npc', 180, 'COMPRE MELHORIAS', 'Encontre o NPC de melhorias e use suas sucatas para melhorar armas e habilidades cibernéticas!'],
  ];
  root.innerHTML = `<section class="scrap-guide" role="dialog" aria-modal="true" aria-labelledby="scrap-guide-title">
    <small>NULLBORNS // TECNOLOGIA RECUPERADA</small>
    <h2 id="scrap-guide-title">SUCATAS — EVOLUA SEU PERSONAGEM</h2>
    <div class="scrap-guide-steps">${steps.map(([key, frame, title, copy], i) => `<article>
      <span class="scrap-guide-number">0${i + 1}</span><img alt="" src="${icon(scene, key, frame)}">
      <h3>${title}</h3><p>${copy}</p>${i === 1 ? '<strong class="scrap-guide-auto">▼ AUTOMÁTICO · SEM BOTÕES</strong>' : ''}
    </article>`).join('')}</div>
    ${scene.multiplayer ? '<p class="scrap-guide-team">As sucatas são compartilhadas com a equipe! Cada jogador pode melhorar seu próprio personagem.</p>' : ''}
    <button type="button">ENTENDI</button></section>`;
  const button = root.querySelector('button');
  const stop = event => event.stopPropagation();
  for (const type of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'wheel']) root.addEventListener(type, stop);
  const onKey = event => {
    event.stopImmediatePropagation();
    if (event.code === 'Tab') { event.preventDefault(); button.focus(); }
    if (event.type === 'keydown' && !event.repeat && ['Enter', 'Space'].includes(event.code)) {
      event.preventDefault(); close();
    }
  };
  window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true);
  let closed = false;
  function close(event) {
    event?.stopPropagation?.();
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true);
    for (const type of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'wheel']) root.removeEventListener(type, stop);
    button.removeEventListener('click', close); root.remove(); scene.events.off('shutdown', close);
    scene.scrapTutorialOpen = false; scene.upgradeMenuOpen = previous.menu;
    scene.input.enabled = previous.input; scene.input.keyboard.resetKeys(); scene.input.keyboard.enabled = previous.keyboard;
    if (!scene.morteEmAndamento && !scene.transicaoEmAndamento) scene.movimentoBloqueado = previous.movement;
    focused?.focus?.({ preventScroll: true });
  }
  button.addEventListener('click', close); scene.events.once('shutdown', close);
  document.body.append(root); button.focus({ preventScroll: true });
  return { root, close };
}
