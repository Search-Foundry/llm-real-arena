import './style.css';
import Phaser from 'phaser';
import { Game } from './scenes/Game';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'app',
    backgroundColor: '#028af8',
    scene: [Game],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

const game = new Phaser.Game(config);
export default game;

// Start Screen Logic
const startScreen = document.getElementById('start-screen');
if (startScreen) {
    startScreen.addEventListener('click', () => {
        startScreen.style.opacity = '0';
        setTimeout(() => {
            startScreen.style.display = 'none';
        }, 500);

        // Start music
        const scene = game.scene.getScene('Game');
        if (scene && scene.music) {
            scene.music.play({
                loop: true,
                volume: 0.5
            });
        }
    });
}
