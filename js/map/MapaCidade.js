import { DEPTHS, depthFromWorldY } from "./ProfundidadeMapa.js";
import { criarTilesetsCidade } from "./Tilesets.js";
import { criarCamadasCidade } from "./CamadasMapa.js";
import { criarObjetosCidade } from "./ObjetosMapa.js";
import { criarColisoesCidade } from "./ColisoesMapa.js";
import { criarLuzesPostes } from "./LuzesMapa.js";

function criarLevel1Map(scene) {
	const map = scene.make.tilemap({
		key: "mapa",
	});

	const {
		tilesets,
		textureKeyByTilesetName,
		tilesetByKey,
	} = criarTilesetsCidade(map);

	const camadas = criarCamadasCidade(map, tilesets, DEPTHS);

	criarObjetosCidade(scene, map, textureKeyByTilesetName);
	criarLuzesPostes(scene, map, DEPTHS);

	scene.camadaCercas = camadas.camadaCercas;
	scene.camadaCercaSpawn = camadas.camadaCercaSpawn;
	scene.camadaCercaFabrica = camadas.camadaCercaFabrica;
	scene.depths = DEPTHS;
	scene.calcularDepthMundo = depthFromWorldY;

	console.log("===== TILESETS =====");
	console.log("cityShopping:", tilesetByKey.cityShopping);
	console.log("street:", tilesetByKey.street);
	console.log("street2:", tilesetByKey.street2);
	console.log("garbage:", tilesetByKey.garbage);
	console.log("a5Street:", tilesetByKey.a5Street);
	console.log("slums:", tilesetByKey.slums);
	console.log("publicTransportation:", tilesetByKey.publicTransportation);
	console.log("apartment2:", tilesetByKey.apartment2);
	console.log("modernIndustrial2:", tilesetByKey.modernIndustrial2);
	console.log("modernInsideFactoryA1:", tilesetByKey.modernInsideFactoryA1);
	console.log("vehiclesSpeederCivil5:", tilesetByKey.vehiclesSpeederCivil5);

	criarColisoesCidade(scene, map);

	return map;
}

export { criarLevel1Map };
export default criarLevel1Map;
