class Level1 extends Phaser.Scene {
    constructor() {
        super("Level1");
    }
    create(){
        this.anims.create({
            key: "right",
            frames: this.anims.generateFrameNumbers("Verme", {start: 87, end: 95}),
            frameRate: 12,
            repeat: -1
        })
        
        this.player = this.physics.add.sprite(400, 300, "Verme", 14);
        this.player.setInteractive().on("pointerdown", () => {
           
            this.player.anims.play("right");
            this.player.setVelocityX(1000);
        });

    }
}
export default Level1;