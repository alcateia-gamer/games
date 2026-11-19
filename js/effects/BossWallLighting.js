/** Perfis raster reutilizáveis; sem leitura de fontes do mapa. */
export function calcularEmissorLuzParede(x, y) {
  if (x < 0 || x >= 1 || Math.abs(y) >= 0.09) return 0;
  const ponta = Math.max(0, (Math.abs(y) - 0.06) / 0.03);
  return Math.exp(-0.5 * (x / 0.009) ** 2) * (1 - ponta * ponta * (3 - 2 * ponta));
}

export function calcularPerfilLuzParede(x, y) {
  const r = Math.hypot(x, y);
  if (x < 0 || r >= 1) return 0;
  const fade = (1 - r) ** 2 * (1 + 2 * r);
  const largura = 0.14 + x * 0.42;
  const banho = 0.72 * Math.exp(-0.5 * (x / 0.4) ** 2 - 0.5 * (y / largura) ** 2) * fade;
  const halo = 0.2 * Math.exp(-0.5 * (x / 0.55) ** 2 - 0.5 * (y / 0.38) ** 2) * fade;
  return Math.min(1, Math.max(calcularEmissorLuzParede(x, y), banho + halo));
}
