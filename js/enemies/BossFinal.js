/**
 * @file Ponto público de importação do boss. Reexporta a integração para que as cenas não
 * dependam da organização interna dos módulos.
 */

export {
  causarDanoBoss,
  solicitarAtaqueBoss,
  atualizarIABoss,
  vincularIABoss,
  prepararIABoss,
} from "./bossFinal/BossFinal.js";
