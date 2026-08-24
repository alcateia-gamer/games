class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    this.threshold = 0.1;
    this.speed = 500;
    this.direction = undefined;
  }
  create() {
    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("Verme", { start: 87, end: 95 }),
      frameRate: 12,
      repeat: -1,
    });

    this.player = this.physics.add.sprite(400, 300, "Verme", 14);

    this.joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
      x: 100,
      y: 350,
      radius: 50,
      base: this.add.circle(0, 0, 50, 0xcccccc),
      thumb: this.add.circle(0, 0, 25, 0x666666),
    });
    this.joystick.on("update", () => {
      const angle = Phaser.Math.DegToRad(this.joystick.angle);
      const force = this.joystick.force;

      if (force > this.threshold) {
        this.direction = new Phaser.Math.Vector2(
          Math.cos(angle),
          Math.sin(angle),
        ).normalize();

        const x = this.direction.x * this.speed;
        const y = this.direction.y * this.speed;

        this.player.setVelocity(x, y);
      } else {
        this.player.setVelocity(0, 0);
      }

      console.log(this.direction, force);
    });
  }
}
export default Level1;
