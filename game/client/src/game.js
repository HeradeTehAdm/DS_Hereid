import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { RoomScene } from './scenes/RoomScene.js';
import { BattleScene } from './scenes/BattleScene.js';

export function createGameConfig() {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#080610',
    pixelArt: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 640,
      height: 360
    },
    render: { roundPixels: true },
    scene: [BootScene, MenuScene, IntroScene, RoomScene, BattleScene]
  };
}