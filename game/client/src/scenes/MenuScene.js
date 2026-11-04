import Phaser from 'phaser';
import { loadSave, clearSave } from '../save.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }
  create() {
    const { width, height } = this.scale;
    const save = loadSave();
    this.add.rectangle(width / 2, height / 2, width, height, 0x080610);
    this.add.text(width / 2, 82, 'HERADETALE', { fontFamily: 'monospace', fontSize: '38px', color: '#f4efff', stroke: '#32184c', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(width / 2, 125, 'Б Е З Д Н А', { fontFamily: 'monospace', fontSize: '16px', color: '#a78bfa' }).setOrigin(0.5);
    this.makeButton(width / 2, 205, 'НАЧАТЬ ЗАНОВО', () => { clearSave(); this.scene.start('IntroScene'); });
    this.makeButton(width / 2, 260, 'ПРОДОЛЖИТЬ', () => this.scene.start('RoomScene'), !save);
    this.add.text(width / 2, 318, 'ПРОТОТИП • WASD / СТРЕЛКИ • ENTER • E', { fontFamily: 'monospace', fontSize: '10px', color: '#77718b' }).setOrigin(0.5);
  }
  makeButton(x, y, label, callback, disabled = false) {
    const text = this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '17px', color: disabled ? '#5f586b' : '#ffffff', backgroundColor: disabled ? '#171126' : '#32184c', padding: { x: 18, y: 9 } }).setOrigin(0.5);
    if (!disabled) text.setInteractive({ useHandCursor: true }).on('pointerdown', callback);
    return text;
  }
}