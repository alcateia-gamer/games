/** Paleta compartilhada pelo inventário, minimapa e balões do personagem selecionado. */
const THEMES = {
  "kai-mercer": {
    accent: 0x38bdf8, accentCss: "#38bdf8", background: "#252f38",
    paths: "#345c70", outline: "#467e97", label: "#102b3b", player: 0xb5edff,
    vehicles: "#152633", vehicleOutline: "#6e9caf",
  },
  "magnus-force": {
    accent: 0xff9b42, accentCss: "#ff9b42", background: "#383029",
    paths: "#765238", outline: "#a4744b", label: "#3c210d", player: 0xffe1bd,
    vehicles: "#332318", vehicleOutline: "#b78e68",
  },
  "aria-kade": {
    accent: 0xff70b5, accentCss: "#ff70b5", background: "#382b33",
    paths: "#734358", outline: "#995c79", label: "#3c162b", player: 0xffd0e8,
    vehicles: "#331c28", vehicleOutline: "#b5839b",
  },
  nyx: {
    accent: 0xb486ff, accentCss: "#b486ff", background: "#302b38",
    paths: "#55456f", outline: "#776297", label: "#291a3e", player: 0xe6d4ff,
    vehicles: "#231b33", vehicleOutline: "#9e8bb7",
  },
};

export function obterTemaPersonagem(personagem) {
  return THEMES[personagem] ?? THEMES["kai-mercer"];
}
