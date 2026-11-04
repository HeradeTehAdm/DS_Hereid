import Phaser from 'phaser';
import { createGameConfig } from './game.js';

const game = new Phaser.Game(createGameConfig());
window.addEventListener('beforeunload', () => game.destroy(true));
