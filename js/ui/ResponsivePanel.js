/** Keeps a DOM panel at its desktop dimensions and scales it uniformly to fit. */
export function createResponsivePanel(root, panel, width, height = null) {
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
    const horizontalPadding = parseFloat(rootStyle.paddingLeft) + parseFloat(rootStyle.paddingRight);
    const verticalPadding = parseFloat(rootStyle.paddingTop) + parseFloat(rootStyle.paddingBottom);
    const availableWidth = Math.max(0, root.clientWidth - horizontalPadding);
    const availableHeight = Math.max(0, root.clientHeight - verticalPadding);
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
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);
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
