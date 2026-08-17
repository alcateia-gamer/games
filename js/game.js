import config from './config.js';
import Start from './scenes/start.js';
import PreLoader from './scenes/preloader.js';
import Level1 from './scenes/Level1.js';

class Game extends Phaser.Game {
    constructor() {
        super(config);

        this.scene.add("Start", Start);
        this.scene.add("PreLoader", PreLoader);
        this.scene.add("Level1", Level1);
        
        this.scene.start("Start");
    }
}

window.onload = () => {
    const game = new Game();
};