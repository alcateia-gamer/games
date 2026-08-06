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

    preload() {}

    create () {}
}

export default preloader;