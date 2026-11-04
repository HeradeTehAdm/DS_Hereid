import Phaser from 'phaser';

const BOX = { x: 190, y: 142, width: 260, height: 112 };

export class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }
  init(data) { this.returnScene = data && data.returnScene || 'RoomScene'; }

  create() {
    this.enemyHp = 24; this.playerHp = 20; this.maxPlayerHp = 20;
    this.pacify = 0; this.phase = 'menu'; this.menuIndex = 0; this.bullets = [];
    this.add.rectangle(320, 180, 640, 360, 0x080610);
    this.add.text(52, 34, 'ПЕРВЫЙ ВРАГ', { fontFamily: 'monospace', fontSize: '12px', color: '#a78bfa' });
    this.enemy = this.add.container(320, 78);
    this.enemy.add([this.add.ellipse(0, 0, 58, 44, 0x7c3aed), this.add.circle(-12, -3, 5, 0xf5f3ff), this.add.circle(12, -3, 5, 0xf5f3ff)]);
    this.enemyName = this.add.text(320, 112, 'ТЕНЬ-ПОТЕРЯННЫЙ', { fontFamily: 'monospace', fontSize: '10px', color: '#c4b5fd' }).setOrigin(0.5);
    this.enemyHpText = this.add.text(320, 128, 'HP 24 / 24', { fontFamily: 'monospace', fontSize: '10px', color: '#9f91b5' }).setOrigin(0.5);
    this.box = this.add.rectangle(320, 198, BOX.width, BOX.height, 0x05030a).setStrokeStyle(2, 0xf4efff);
    this.heart = this.add.text(320, 198, '♥', { fontFamily: 'monospace', fontSize: '18px', color: '#ff426d' }).setOrigin(0.5);
    this.heartX = 320; this.heartY = 198;
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,ENTER,SPACE,ESC');
    this.statusText = this.add.text(54, 270, 'Тень смотрит на тебя, не понимая, кто ты.', { fontFamily: 'monospace', fontSize: '13px', color: '#e5dcef', wordWrap: { width: 530 } });
    this.hpText = this.add.text(54, 294, 'HP 20 / 20', { fontFamily: 'monospace', fontSize: '12px', color: '#fca5a5' });
    this.menuLabels = ['FIGHT', 'ACT', 'ITEM', 'MERCY'];
    this.menuObjects = this.menuLabels.map((label, i) => this.add.text(92 + i * 150, 330, (i === 0 ? '▶ ' : '  ') + label, { fontFamily: 'monospace', fontSize: '15px', color: i === 0 ? '#facc15' : '#e5dcef' }).setOrigin(0.5));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());
    this.input.keyboard.on('keydown-LEFT', () => this.changeMenu(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.changeMenu(1));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start(this.returnScene));
  }

  changeMenu(dir) {
    if (this.phase !== 'menu') return;
    this.menuIndex = Phaser.Math.Wrap(this.menuIndex + dir, 0, 4);
    this.menuObjects.forEach((o, i) => o.setText((i === this.menuIndex ? '▶ ' : '  ') + this.menuLabels[i]).setColor(i === this.menuIndex ? '#facc15' : '#e5dcef'));
  }

  confirm() {
    if (this.phase === 'menu') {
      if (this.menuIndex === 0) this.beginFight();
      else if (this.menuIndex === 1) this.act();
      else if (this.menuIndex === 2) this.item();
      else this.mercy();
    } else if (this.phase === 'fight-result' || this.phase === 'act-result') this.enemyTurn();
    else if (this.phase === 'enemy-turn') this.finishTurn();
    else if (this.phase === 'end') this.scene.start(this.returnScene, { encounterResolved: true });
  }

  beginFight() {
    this.phase = 'fight'; this.statusText.setText('Нажми ENTER, когда бегунок окажется в золотой зоне.');
    this.box.setVisible(false); this.heart.setVisible(false);
    this.meter = this.add.rectangle(320, 198, 220, 8, 0x312244).setStrokeStyle(1, 0xc4b5fd);
    this.target = this.add.rectangle(320, 198, 30, 12, 0xfacc15);
    this.cursor = this.add.rectangle(210, 198, 4, 18, 0xf4efff); this.cursorDirection = 1;
  }

  act() {
    this.phase = 'act-result'; this.pacify++;
    this.statusText.setText(this.pacify === 1 ? 'Ты спокойно называешься по имени. Тень перестаёт дрожать.' : 'Ты показываешь, что не хочешь причинять ей вред. Она успокаивается.');
    this.enemy.setAlpha(Math.max(0.45, 1 - this.pacify * 0.2));
    this.enemyHpText.setText('ПОКОЙ ' + Math.min(this.pacify, 2) + ' / 2');
  }

  item() {
    if (this.playerHp === this.maxPlayerHp) this.statusText.setText('У тебя и так полное здоровье.');
    else { this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + 8); this.statusText.setText('Ты используешь лечебный осколок. +8 HP'); this.hpText.setText('HP ' + this.playerHp + ' / ' + this.maxPlayerHp); }
    this.phase = 'act-result';
  }

  mercy() {
    if (this.pacify < 2) { this.phase = 'act-result'; this.statusText.setText('Тень ещё не готова успокоиться. Попробуй ACT.'); return; }
    this.phase = 'end'; this.statusText.setText('Ты отпускаешь Тень. Иногда победа — это не удар.');
    this.enemy.setVisible(false); this.enemyName.setText('ПОЩАЖЕНА'); this.box.setVisible(false); this.heart.setVisible(false);
  }

  enemyTurn() {
    if (this.enemyHp <= 0) { this.phase = 'end'; this.statusText.setText('Тень растворяется в воздухе. Ты выстоял.'); this.enemy.setVisible(false); this.box.setVisible(false); this.heart.setVisible(false); return; }
    this.phase = 'enemy-turn'; this.statusText.setText('Уклоняйся от сгустков тени! WASD или стрелки.');
    this.box.setVisible(true); this.heart.setVisible(true); this.heartX = 320; this.heartY = 198;
    this.heart.setPosition(this.heartX, this.heartY); this.spawnTimer = 0; this.turnTime = 0;
  }

  finishTurn() {
    this.phase = 'menu'; this.bullets.forEach(b => b.destroy()); this.bullets = [];
    this.statusText.setText('Тень ждёт твоего решения.');
  }

  update(_, delta) {
    if (this.phase === 'fight' && this.cursor) {
      this.cursor.x += this.cursorDirection * 230 * delta / 1000;
      if (this.cursor.x > 425 || this.cursor.x < 215) this.cursorDirection *= -1;
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        const damage = Math.max(1, Math.round(12 * (1 - Math.abs(this.cursor.x - 320) / 110)));
        this.enemyHp = Math.max(0, this.enemyHp - damage); this.enemyHpText.setText('HP ' + this.enemyHp + ' / 24');
        this.statusText.setText('Удар наносит ' + damage + ' урона.');
        this.meter.destroy(); this.target.destroy(); this.cursor.destroy(); this.cursor = null;
        this.phase = 'fight-result';
      }
    }
    if (this.phase !== 'enemy-turn') return;
    const speed = 130 * delta / 1000;
    if (this.keys.LEFT.isDown || this.keys.A.isDown) this.heartX -= speed;
    if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.heartX += speed;
    if (this.keys.UP.isDown || this.keys.W.isDown) this.heartY -= speed;
    if (this.keys.DOWN.isDown || this.keys.S.isDown) this.heartY += speed;
    this.heartX = Phaser.Math.Clamp(this.heartX, BOX.x - BOX.width / 2 + 10, BOX.x + BOX.width / 2 - 10);
    this.heartY = Phaser.Math.Clamp(this.heartY, BOX.y - BOX.height / 2 + 10, BOX.y + BOX.height / 2 - 10);
    this.heart.setPosition(this.heartX, this.heartY);
    this.turnTime += delta; this.spawnTimer += delta;
    if (this.spawnTimer > 420) {
      this.spawnTimer = 0;
      const b = this.add.circle(BOX.x + Phaser.Math.Between(-100, 100), BOX.y - BOX.height / 2, 5, 0xa78bfa); b.damage = 3; this.bullets.push(b);
    }
    for (const b of this.bullets) {
      b.y += 105 * delta / 1000;
      if (!b.hit && Phaser.Math.Distance.Between(b.x, b.y, this.heartX, this.heartY) < 10) {
        b.hit = true; b.setVisible(false); this.playerHp = Math.max(0, this.playerHp - b.damage); this.hpText.setText('HP ' + this.playerHp + ' / ' + this.maxPlayerHp);
      }
    }
    this.bullets = this.bullets.filter(b => { if (b.y > BOX.y + BOX.height / 2 + 12 || b.hit) { b.destroy(); return false; } return true; });
    if (this.turnTime >= 4000 || this.playerHp <= 0) {
      this.bullets.forEach(b => b.destroy()); this.bullets = []; this.box.setVisible(false); this.heart.setVisible(false);
      this.phase = this.playerHp <= 0 ? 'end' : 'menu';
      this.statusText.setText(this.playerHp <= 0 ? 'Ты теряешь силы. Бой окончен.' : 'Тень отступает на мгновение.');
    }
  }
}
