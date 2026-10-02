import { criarTilesetsFabrica } from "./Tilesets.js";
import { criarCamadasFabrica } from "./CamadasMapa.js";
import { criarObjetosFabrica } from "./ObjetosMapa.js";
import { criarColisoesFabrica } from "./ColisoesMapa.js";

function criarLevel1Parte2Map(scene) {
	const map = scene.make.tilemap({
		key: "mapaParte2",
	});

	const { tilesets, registrosTilesets, textureKeyByTilesetName } =
		criarTilesetsFabrica(map, scene);
	const camadas = criarCamadasFabrica(
		map,
		tilesets,
		scene,
		registrosTilesets,
	);

	scene.camadaParedeAbaixoPerso = camadas.camadaParedeAbaixoPerso;
	scene.camadaParedeAcimaPerso = camadas.camadaParedeAcimaPerso;

	criarObjetosFabrica(scene, map, textureKeyByTilesetName);
	criarColisoesFabrica(scene, map);

	scene.camadasMapaParte2 = camadas.camadasTiles.map(
		({ name }) => map.getLayer(name)?.tilemapLayer,
	);

	return map;
}

export { criarLevel1Parte2Map };
export default criarLevel1Parte2Map;
