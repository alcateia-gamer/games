class preloader extends Phaser.Scene {
    constructor() {
        super("preloader");
    }

    init() {
        this.add.image(400, 225, "start-background");

        this.add.rectangle(400, 300, 468, 32,).setStrokeStyle(1, 0xffffff);
        const bar = this.add.rectangle(400 -230, 300, 4, 28, 0xffffff);

        this.preload.toString("progress", (progress) => {
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        this.load.setPath("./assets/")
        this.load.spritesheet("Verme", "personagem/Verme.png", {
         frameWidth: 64,
         frameHeight: 64,
        });

        this.load.plugin("rexvirtualjoystickplugin", "../js/rexvirtualjoystickplugin.min.js", true,);
    }
    create () {
        this.scene.stop();
        this.scene.start("Level1")

    }
}

export default preloader;