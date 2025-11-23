import './style.css';
import Phaser from 'phaser';
import { Game } from './scenes/Game';

// l'area di gioco rimepie il 99% dello spazio disponibile
// e non si sovrappone ai nemici

const config = {
    type: Phaser.AUTO,
    width: '99%',
    height: '99%',
    parent: 'app',
    backgroundColor: '#028af8',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
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
const countdownEl = document.getElementById('countdown');

if (startScreen && countdownEl) {
    startScreen.addEventListener('click', () => {
        // Hide start screen
        startScreen.style.opacity = '0';
        setTimeout(() => {
            startScreen.style.display = 'none';
        }, 500);

        // Show countdown
        countdownEl.style.display = 'block';
        let count = 3;
        countdownEl.innerText = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownEl.innerText = count;
            } else if (count === 0) {
                countdownEl.innerText = 'GO!';
            } else {
                // Stop countdown
                clearInterval(interval);
                countdownEl.style.display = 'none';

                // Start Game
                const scene = game.scene.getScene('Game');
                if (scene) {
                    scene.startGame();
                }
            }
        }, 1000);
    });
}
