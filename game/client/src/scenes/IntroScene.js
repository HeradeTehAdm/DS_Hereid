import Phaser from 'phaser';

export class IntroScene extends Phaser.Scene {
  constructor() { super('IntroScene'); }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x020106);
    const title = this.add.text(width / 2, 95, 'Последнее падение', {
      fontFamily: 'monospace', fontSize: '24px', color: '#d8c9ff'
    }).setOrigin(0.5);
    const lines = [
      'Они оставили Хераде внизу.',
      'Без объяснений. Без пути назад.',
      'Впереди — двадцать этажей Бездны.',
      '',
      'Нажми ENTER, чтобы продолжить.'
    ];
    this.add.text(width / 2, 180, lines.join('\n'), {
      fontFamily: 'monospace', fontSize: '16px', color: '#c4bfd2',
      align: 'center', lineSpacing: 9
    }).setOrigin(0.5);
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('RoomScene'));
    this.input.once('pointerdown', () => this.scene.start('RoomScene'));
  }
}