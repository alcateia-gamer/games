/** Reflows panels that opt in, then scales uniformly if the content still exceeds the viewport. */
export function createResponsivePanel(root, panel, width, height = null, { reflow = false } = {}) {
  if (!Number.isFinite(width) || width <= 0 ||
      (height !== null && (!Number.isFinite(height) || height <= 0))) {
    throw new RangeError('Panel dimensions must be positive finite numbers.');
  }

  Object.assign(panel.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    boxSizing: 'border-box',
    width: `${width}px`,
    maxWidth: 'none',
    flex: 'none',
    margin: '0',
    transformOrigin: 'center center',
  });
  if (height !== null) {
    panel.style.height = `${height}px`;
    panel.style.maxHeight = 'none';
  }

  const update = () => {
    if (!root.isConnected || root.hidden || root.clientWidth === 0 || root.clientHeight === 0) return;
    const rootStyle = getComputedStyle(root);
    const left = parseFloat(rootStyle.paddingLeft) || 0;
    const top = parseFloat(rootStyle.paddingTop) || 0;
    const availableWidth = Math.max(0, root.clientWidth - left - (parseFloat(rootStyle.paddingRight) || 0));
    const availableHeight = Math.max(0, root.clientHeight - top - (parseFloat(rootStyle.paddingBottom) || 0));
    if (reflow) panel.style.width = `${Math.min(width, availableWidth)}px`;
    panel.style.left = `${left + availableWidth / 2}px`;
    panel.style.top = `${top + availableHeight / 2}px`;
    const scale = Math.min(1, availableWidth / panel.offsetWidth, availableHeight / panel.offsetHeight);
    panel.style.transform = `translate(-50%, -50%)${scale < 1 ? ` scale(${scale})` : ''}`;
  };
  let resizeFrame = 0;
  const scheduleUpdate = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      update();
    });
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
  observer?.observe(root);
  observer?.observe(panel);
  window.addEventListener('resize', scheduleUpdate);
  window.visualViewport?.addEventListener('resize', scheduleUpdate);
  update();

  return {
    update,
    destroy() {
      observer?.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    },
  };
}
