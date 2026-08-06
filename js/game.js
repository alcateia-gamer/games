import config from './config.js';
import Start from './scenes/start.js';
import PreLoader from './scenes/preloader.js';

class Game extends Phaser.Game {
    constructor() {
        super(config);

        this.scene.add("Start", Start);
        this.scene.start("Start");
        this.scene.add("PreLoader", PreLoader);
        this.scene.start("PreLoader");
    }
}

window.onload = () => {
    const game = new Game();
};