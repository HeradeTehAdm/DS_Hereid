import Phaser from 'phaser';

const TILE = 16;
const ROOM = { x: 64, y: 32, width: 512, height: 288 };
const PLAYER_SIZE = 12;

export class RoomScene extends Phaser.Scene {
  constructor() { super('RoomScene'); }

  create() {
    this.add.rectangle(320, 180, 640, 360, 0x080610);
    this.add.rectangle(320, 180, ROOM.width, ROOM.height, 0x171126)
      .setStrokeStyle(3, 0x5b3b79);
    this.drawFloor();
    this.drawExit();

    this.player = this.add.rectangle(320, 250, PLAYER_SIZE, PLAYER_SIZE, 0xf4efff)
      .setStrokeStyle(2, 0x9b72d1);
    this.obstacles = [
      new Phaser.Geom.Rectangle(ROOM.x + 94, ROOM.y + 92, 56, 20),
      new Phaser.Geom.Rectangle(ROOM.x + 350, ROOM.y + 146, 70, 20),
      new Phaser.Geom.Rectangle(ROOM.x + 198, ROOM.y + 202, 42, 18)
    ];
    this.drawObstacles();
    this.enemyMarker = this.add.container(this.encounter.x, this.encounter.y);
    this.enemyMarker.add([
      this.add.ellipse(0, 0, 26, 24, 0x7c3aed),
      this.add.circle(-5, -2, 2, 0xf5f3ff),
      this.add.circle(5, -2, 2, 0xf5f3ff)
    ]);
    this.add.text(this.encounter.x, this.encounter.y + 22, '???', { fontFamily: 'monospace', fontSize: '9px', color: '#a78bfa' }).setOrigin(0.5);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ENTER,SPACE,E');
    this.dialogue = [
      '...Ты наконец очнулся.',
      'Не бойся. Меня зовут Искрик.',
      'Это первый этаж Бездны. Выход пока закрыт.',
      'Осмотрись. Если захочешь поговорить — подойди и нажми E.'
    ];
    this.doorDialogue = [
      'Дверь запечатана незнакомым символом.',
      'Похоже, сначала нужно понять, как устроена эта Бездна.'
    ];
    this.dialogueIndex = 0;
    this.dialogueOpen = true;
    this.encounter = { x: 470, y: 235, active: true };

    this.dialogueBox = this.add.rectangle(320, 300, 500, 70, 0x090610, 0.96)
      .setStrokeStyle(2, 0xa78bfa);
    this.dialogueText = this.add.text(90, 275, this.dialogue[0], {
      fontFamily: 'monospace', fontSize: '15px', color: '#f4efff',
      wordWrap: { width: 455 }
    });

    this.guide = this.add.container(320, 112);
    this.guide.add([
      this.add.ellipse(0, 0, 36, 42, 0xc4b5fd),
      this.add.circle(-7, -3, 3, 0x201333),
      this.add.circle(7, -3, 3, 0x201333),
      this.add.arc(0, 8, 7, 0, Math.PI, false, 0x201333).setStrokeStyle(2, 0x201333)
    ]);
    this.add.text(320, 145, 'ИСКРИК', {
      fontFamily: 'monospace', fontSize: '10px', color: '#c4b5fd'
    }).setOrigin(0.5);

    this.add.text(320, 48, 'ЭТАЖ 1 • ПОСЛЕДНЕЕ ПАДЕНИЕ', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8b7b9f'
    }).setOrigin(0.5);
    this.add.text(320, 345, 'WASD / ← ↑ → ↓ — движение   E — взаимодействие', {
      fontFamily: 'monospace', fontSize: '10px', color: '#6f6680'
    }).setOrigin(0.5);

    this.prompt = this.add.text(320, 190, 'E — поговорить', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f4efff',
      backgroundColor: '#211431', padding: { x: 7, y: 4 }
    }).setOrigin(0.5).setVisible(false);

    this.input.keyboard.on('keydown-ENTER', () => this.advanceDialogue());
    this.input.keyboard.on('keydown-SPACE', () => this.advanceDialogue());
  }

  drawFloor() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x261a38, 0.7);
    for (let x = ROOM.x; x <= ROOM.x + ROOM.width; x += TILE) {
      graphics.lineBetween(x, ROOM.y, x, ROOM.y + ROOM.height);
    }
    for (let y = ROOM.y; y <= ROOM.y + ROOM.height; y += TILE) {
      graphics.lineBetween(ROOM.x, y, ROOM.x + ROOM.width, y);
    }
    graphics.fillStyle(0x302044, 1);
    graphics.fillRect(ROOM.x + 16, ROOM.y + 16, 8, 8);
    graphics.fillRect(ROOM.x + ROOM.width - 24, ROOM.y + ROOM.height - 24, 8, 8);
  }

  drawObstacles() {
    const graphics = this.add.graphics();
    for (const obstacle of this.obstacles) {
      graphics.fillStyle(0x39264b, 1);
      graphics.fillRectShape(obstacle);
      graphics.lineStyle(1, 0x76528f, 1);
      graphics.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
  }

  drawExit() {
    this.add.rectangle(320, 44, 64, 8, 0x5b3b79);
    this.add.text(320, 58, 'ЗАПЕЧАТАННЫЙ ПРОХОД', {
      fontFamily: 'monospace', fontSize: '8px', color: '#7e6a93'
    }).setOrigin(0.5);
  }

  advanceDialogue() {
    if (!this.dialogueOpen) return;
    this.dialogueIndex += 1;
    if (this.dialogueIndex >= this.activeDialogue.length) {
      this.dialogueOpen = false;
      this.dialogueBox.setVisible(false);
      this.dialogueText.setVisible(false);
      return;
    }
    this.dialogueText.setText(this.activeDialogue[this.dialogueIndex]);
  }

  startDialogue(lines) {
    this.activeDialogue = lines;
    this.dialogueIndex = 0;
    this.dialogueOpen = true;
    this.dialogueBox.setVisible(true);
    this.dialogueText.setVisible(true).setText(lines[0]);
  }

  collidesAt(x, y) {
    const playerRect = new Phaser.Geom.Rectangle(
      x - PLAYER_SIZE / 2, y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE
    );
    return this.obstacles.some(obstacle => Phaser.Geom.Intersects.RectangleToRectangle(playerRect, obstacle));
  }

  update(_, delta) {
    if (!this.player) return;
    if (this.dialogueOpen) return;

    const speed = 110 * (delta / 1000);
    let dx = 0;
    let dy = 0;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= speed;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += speed;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= speed;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += speed;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }

    const nextX = Phaser.Math.Clamp(this.player.x + dx, ROOM.x + 10, ROOM.x + ROOM.width - 10);
    if (!this.collidesAt(nextX, this.player.y)) this.player.x = nextX;
    const nextY = Phaser.Math.Clamp(this.player.y + dy, ROOM.y + 10, ROOM.y + ROOM.height - 10);
    if (!this.collidesAt(this.player.x, nextY)) this.player.y = nextY;

    const nearGuide = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.guide.x, this.guide.y) < 42;
    const nearDoor = this.player.y < ROOM.y + 42 && Math.abs(this.player.x - 320) < 48;
    const nearEnemy = this.encounter.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.encounter.x, this.encounter.y) < 38;
    this.prompt.setVisible(nearGuide || nearDoor || nearEnemy);
    if (nearGuide) this.prompt.setPosition(this.guide.x, this.guide.y + 38).setText('E — поговорить');
    else if (nearDoor) this.prompt.setPosition(320, 76).setText('E — осмотреть дверь');
    else if (nearEnemy) this.prompt.setPosition(this.encounter.x, this.encounter.y - 28).setText('E — вступить в бой');

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      if (nearGuide) this.startDialogue(this.dialogue);
      else if (nearDoor) this.startDialogue(this.doorDialogue);
      else if (nearEnemy && this.encounter.active) this.scene.start('BattleScene', { returnScene: 'RoomScene' });
    }
  }
}
