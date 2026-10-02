function criarTilesetsCidade(map) {
	const cityShopping = map.addTilesetImage(
		"Tileset_SciFi_CityShopping_Rasak",
		"cityShopping",
	);
	const street = map.addTilesetImage("Tileset_SciFi_Street_Rasak", "street");
	const street2 = map.addTilesetImage(
		"Tileset_SciFi_Street_Rasak_DUP",
		"street2",
	);
	const garbage = map.addTilesetImage("Tileset_SciFi_Garbage_Rasak", "garbage");
	const a5Street = map.addTilesetImage("A5_Street_Rasak", "a5Street");
	const slums = map.addTilesetImage("Tileset_SciFi_Slums_Rasak", "slums");
	const publicTransportation = map.addTilesetImage(
		"Tileset_SciFi_PublicTransportation_Slums_Rasak.png",
		"publicTransportation",
	);
	const a4Outside = map.addTilesetImage("A4_SciFi_Outside_Rasak", "a4Outside");
	const a3Outside = map.addTilesetImage("A3_SciFi_Outside_Rasak", "a3Outside");
	const a5Outside = map.addTilesetImage(
		"A5_SciFi_Outside_Rasak",
		"A5_SciFi_Outside_Rasak",
	);
	const buildingExtras = map.addTilesetImage(
		"Tileset_SciFi_BuildingExtras",
		"buildingExtras",
	);
	const torre = map.addTilesetImage("TorreTileset", "torre");
	const apartment2 = map.addTilesetImage(
		"Tileset_SciFi_Arpartment_2_Rasak",
		"apartment2",
	);
	const insideA1 = map.addTilesetImage("A1_SciFi_Inside_Rasak", "insideA1");
	const insideA2 = map.addTilesetImage("A2_SciFi_Inside_Rasak", "insideA2");
	const insideA3 = map.addTilesetImage("A3_SciFi_Inside_Rasak", "insideA3");
	const insideA4 = map.addTilesetImage("A4_SciFi_Inside_Rasak", "insideA4");
	const insideA5 = map.addTilesetImage("A5_SciFi_Inside_Rasak", "insideA5");
	const apartment1 = map.addTilesetImage(
		"Tileset_SciFi_Arpartment_1_Rasak",
		"apartment1",
	);
	const club = map.addTilesetImage("Tileset_SciFi_Club_Rasak", "club");
	const modernIndustrial2 = map.addTilesetImage(
		"Tileset_Modern_Industrial_2_Rasak",
		"ModernIndustrial2",
	);
	const modernIndustrial3 = map.addTilesetImage(
		"Tileset_Modern_Industrial_3_Rasak",
		"industrial3",
	);
	const modernInsideFactoryA1 = map.addTilesetImage(
		"A1_Modern_Inside_Factory_Rasak",
		"ModernInsideFactoryA1",
	);
	const wallBorder = map.addTilesetImage("parede-borda", "wallBorder");
	const shopDoor = map.addTilesetImage("!ShopDoor", "shopDoor");
	const vehiclesSpeederCivil5 = map.addTilesetImage(
		"Speeder_civil5",
		"VehiclesSpeederCivil5",
	);
	const speederCivil2 = map.addTilesetImage("Speeder_civil2", "Speeder_civil2");
	const transporterPrivate = map.addTilesetImage(
		"Transporter_Private",
		"Transporter_Private",
	);
	const transporterAmbulance = map.addTilesetImage(
		"Transporter_Ambulance",
		"Transporter_Ambulance",
	);
	const transporterPoliceSwat = map.addTilesetImage(
		"Transporter_PoliceSwat",
		"Transporter_PoliceSwat",
	);

	const tilesets = [
		cityShopping,
		street,
		street2,
		garbage,
		a5Street,
		slums,
		publicTransportation,
		a4Outside,
		a3Outside,
		a5Outside,
		buildingExtras,
		torre,
		apartment2,
		insideA1,
		insideA2,
		insideA3,
		insideA4,
		insideA5,
		apartment1,
		club,
		modernIndustrial2,
		modernIndustrial3,
		modernInsideFactoryA1,
		wallBorder,
		shopDoor,
		vehiclesSpeederCivil5,
		speederCivil2,
		transporterPrivate,
		transporterAmbulance,
		transporterPoliceSwat,
	].filter(Boolean);

	const textureKeyByTilesetName = new Map([
		["Tileset_SciFi_CityShopping_Rasak", "cityShopping"],
		["Tileset_SciFi_Street_Rasak_DUP", "street2"],
		["Tileset_SciFi_Street_Rasak", "street"],
		["Tileset_SciFi_Garbage_Rasak", "garbage"],
		["A5_Street_Rasak", "a5Street"],
		["Tileset_SciFi_Slums_Rasak", "slums"],
		[
			"Tileset_SciFi_PublicTransportation_Slums_Rasak.png",
			"publicTransportation",
		],
		["A4_SciFi_Outside_Rasak", "a4Outside"],
		["A3_SciFi_Outside_Rasak", "a3Outside"],
		["A5_SciFi_Outside_Rasak", "A5_SciFi_Outside_Rasak"],
		["Tileset_SciFi_BuildingExtras", "buildingExtras"],
		["TorreTileset", "torre"],
		["Tileset_SciFi_Arpartment_2_Rasak", "apartment2"],
		["A1_SciFi_Inside_Rasak", "insideA1"],
		["A2_SciFi_Inside_Rasak", "insideA2"],
		["A3_SciFi_Inside_Rasak", "insideA3"],
		["A4_SciFi_Inside_Rasak", "insideA4"],
		["A5_SciFi_Inside_Rasak", "insideA5"],
		["Tileset_SciFi_Arpartment_1_Rasak", "apartment1"],
		["Tileset_SciFi_Club_Rasak", "club"],
		["Tileset_Modern_Industrial_2_Rasak", "ModernIndustrial2"],
		["Tileset_Modern_Industrial_3_Rasak", "industrial3"],
		["A1_Modern_Inside_Factory_Rasak", "ModernInsideFactoryA1"],
		["parede-borda", "wallBorder"],
		["!ShopDoor", "shopDoor"],
		["Speeder_civil5", "VehiclesSpeederCivil5"],
		["Speeder_civil2", "Speeder_civil2"],
		["Transporter_Private", "Transporter_Private"],
		["Transporter_Ambulance", "Transporter_Ambulance"],
		["Transporter_PoliceSwat", "Transporter_PoliceSwat"],
	]);

	return {
		tilesets,
		textureKeyByTilesetName,
		tilesetByKey: {
			cityShopping,
			street,
			street2,
			garbage,
			a5Street,
			slums,
			publicTransportation,
			apartment2,
			modernIndustrial2,
			modernInsideFactoryA1,
			vehiclesSpeederCivil5,
		},
	};
}

function criarTilesetsFabrica(map, scene) {
	const registrosTilesets = [
		["A1_Modern_Inside_Factory_Rasak", "factoryInsideA1"],
		["A2_Industrial_Rasak", "industrialA2"],
		["A4_Modern_Industrial_Rasak", "industrialA4"],
		["A5_SciFi_Industrial_Rasak", "industrialA5"],
		["Tileset_Modern_Industrial_1_Rasak", "industrial1"],
		["Tileset_Modern_Industrial_2_Rasak", "ModernIndustrial2"],
		["Tileset_Modern_Industrial_3_Rasak", "industrial3"],
		["Tileset_ModernSciFi_Entertaining_District_Rasak", "entertainingDistrict"],
		["A3_SciFi_Outside_Rasak", "a3Outside"],
		["A4_SciFi_Outside_Rasak", "a4Outside"],
		["A5_SciFi_Outside_Rasak", "A5_SciFi_Outside_Rasak"],
		["Tileset_SciFi_BuildingExtras", "buildingExtras"],
		["A4_SciFi_Inside_Rasak", "insideA4"],
		["A5_SciFi_Inside_Rasak", "insideA5"],
		["A2_Scifi_Outside_Rasak", "a2Outside"],
		["A3_SciFi_Inside_Rasak", "insideA3"],
		["parede-borda", "wallBorders"],
		["Tileset_SciFi_Arpartment_1_Rasak", "apartment1"],
		["Tileset_SciFi_Arpartment_2_Rasak", "apartment2"],
		["Tileset_SciFi_CityShopping_Rasak", "cityShopping"],
		["Tileset_SciFi_Slums_Rasak", "slums"],
		["Tileset_SciFi_Garbage_Rasak", "garbage"],
		[
			"Tileset_SciFi_PublicTransportation_Slums_Rasak.png",
			"publicTransportation",
		],
		["A4_SciFi_Inside_Rasak", "insideA4"],
		["!Security Door", "securityDoor"],
		["!Industrial Gate", "industrialGate"],
		["!$Controlls", "industrialControls"],
		["!Industrial mashines", "industrialMachines"],
		["!Switch_Rasak", "industrialSwitch"],
		["Supercomputer", "supercomputer"],
		["$ElectricGenerator", "electricGenerator"],
		["!$Generator_char", "generatorCharacter"],
		["$Satalite", "satellite"],
		["!Ventilation System", "ventilationSystem"],
		["!$ShieldGenerator", "shieldGenerator"],
		["!Chem-Tank", "chemTank"],
		["!$Shield_Door_char", "shieldDoorCharacter"],
		["RoboPB", "roboPB"],
		["!$Neontubes1", "neonTubes1"],
		["!$Neontubes2", "neonTubes2"],
		["!Industrials_Lights1", "industrialLights1"],
		["EnergiaBoss", "energiaBoss"],
		["RoboV", "roboV"],
		["!$ModernFloorLights", "modernFloorLights"],
		["!ShopDoor", "shopDoor"],
	];

	const tilesets = registrosTilesets
		.map(([nome, chaveImagem]) => {
			const tileset = map.addTilesetImage(nome, chaveImagem);

			if (!tileset) {
				console.error(
					`Tileset da parte 2 não registrado: ${nome} (imagem: ${chaveImagem})`,
				);
			} else if (scene.DEBUG_MAP) {
				console.log(`[Parte 2] Tileset carregado: ${nome} -> ${chaveImagem}`);
			}

			return tileset;
		})
		.filter(Boolean);

	const textureKeyByTilesetName = new Map(
		registrosTilesets.map(([nome, chaveImagem]) => [nome, chaveImagem]),
	);

	return { tilesets, registrosTilesets, textureKeyByTilesetName };
}

export { criarTilesetsCidade, criarTilesetsFabrica };
