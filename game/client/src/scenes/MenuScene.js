import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x080610);
    this.add.text(width / 2, 82, 'HERADETALE', {
      fontFamily: 'monospace', fontSize: '38px', color: '#f4efff',
      stroke: '#32184c', strokeThickness: 5
    }).setOrigin(0.5);
    this.add.text(width / 2, 125, 'Б Е З Д Н А', {
      fontFamily: 'monospace', fontSize: '16px', color: '#a78bfa'
    }).setOrigin(0.5);
    this.add.text(width / 2, 230, 'НАЧАТЬ', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
      backgroundColor: '#32184c', padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('IntroScene'));
    this.add.text(width / 2, 286, 'ПРОТОТИП • WASD / СТРЕЛКИ • ENTER', {
      fontFamily: 'monospace', fontSize: '11px', color: '#77718b'
    }).setOrigin(0.5);
  }
}