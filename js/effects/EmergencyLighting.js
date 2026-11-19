/** Perfis raster reutilizáveis; sem leitura de fontes do mapa. */
export function calcularPerfilNeon(x, y, emissor = false) {
  const r = Math.hypot(x, y);
  if (r >= 1) return 0;
  // Compensa o alcance maior para conservar o tamanho da pequena faixa emissiva.
  const nx = x * 1.8, ny = y * 1.8;
  const nucleo = Math.exp(-0.5 * (Math.max(0, Math.abs(nx) - 0.12) / 0.06) ** 2 -
    0.5 * (ny / 0.055) ** 2);
  if (emissor) return nucleo;
  const fade = (1 - r) ** 2 * (1 + 2 * r);
  return Math.max(nucleo, 0.7 * Math.exp(-0.5 * (r / 0.4) ** 2) * fade);
}
