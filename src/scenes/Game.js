import Phaser from 'phaser';

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
    }

    preload() {
        // Load remote assets (images)
        this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
        this.load.image('red', 'https://labs.phaser.io/assets/particles/red.png');

        // Load local assets (audio, data, sprites)
        this.load.setBaseURL('');
        this.load.image('logo', 'assets/sprites/logo.png');
        this.load.audio('theme', 'assets/music/theme.mp3');
        this.load.audio('explosion', 'assets/sounds/explosion.mp3');
        this.load.text('enemyData', 'assets/dati.csv');
    }

    create() {
        this.add.image(400, 300, 'sky');

        this.sound.pauseOnBlur = false;

        this.music = this.sound.add('theme');

        // Check if we should play music immediately (race condition fix)
        if (this.shouldPlayMusic) {
            this.music.play({
                loop: true,
                volume: 0.5
            });
        }

        // Connect HTML slider to Phaser volume
        const volumeSlider = document.getElementById('volume');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (event) => {
                this.sound.volume = event.target.value / 100;
            });
        }

        this.logo = this.physics.add.image(400, 300, 'logo');
        this.logo.setScale(0.2); // Scale down the new logo
        this.logo.setCollideWorldBounds(true);

        this.cursors = this.input.keyboard.createCursorKeys();

        // Parse CSV and store data
        const data = this.cache.text.get('enemyData');
        const lines = data.split('\n');
        this.enemyData = [];

        // Skip header (index 0) and empty lines
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            this.enemyData.push(line);
        }

        // Shuffle the enemy data to ensure random order
        Phaser.Utils.Array.Shuffle(this.enemyData);

        // Track game start time
        this.startTime = this.time.now;
        this.gameEnded = false;

        // Create enemy group
        this.enemies = this.physics.add.group({
            bounceX: 1,
            bounceY: 1,
            collideWorldBounds: true
        });

        // Add collision between enemies
        this.physics.add.collider(this.enemies, this.enemies);

        // Create central obstacle (invisible circle)
        const centralObstacle = this.add.circle(400, 300, 50, 0x000000, 0); // Radius 50, invisible
        this.physics.add.existing(centralObstacle, true); // true = static body
        this.physics.add.collider(this.enemies, centralObstacle);
        this.physics.add.collider(this.logo, centralObstacle);

        // Add collision with player
        this.physics.add.collider(this.logo, this.enemies);

        // Create explosion emitter
        this.explosionEmitter = this.add.particles(0, 0, 'red', {
            lifespan: 500,
            speed: { min: 150, max: 250 },
            scale: { start: 0.8, end: 0 },
            gravityY: 0,
            blendMode: 'ADD',
            emitting: false
        });

        // Spawn first batch of enemies immediately
        for (let i = 0; i < 4; i++) {
            this.spawnEnemy();
        }

        // Spawn new batch of enemies every 8 seconds
        this.spawnEvent = this.time.addEvent({
            delay: 8000,
            callback: () => {
                for (let i = 0; i < 4; i++) {
                    this.spawnEnemy();
                }
            },
            callbackScope: this,
            loop: true
        });

        this.timerBar = document.getElementById('spawn-timer-bar');

        // Create Progress Bar using Graphics
        this.timerGraphics = this.add.graphics();
    }

    spawnEnemy() {
        if (this.enemyData.length === 0) {
            // No more enemies to spawn
            if (this.spawnEvent) {
                this.spawnEvent.remove();
                this.spawnEvent = null;
            }
            return;
        }

        const line = this.enemyData.pop();

        const parts = line.split(',');
        const modelName = parts[0];
        const companyName = parts[1];
        const potential = parseInt(parts[9], 10) || 10000; // Default to 10000 if missing

        // Pick a random corner
        const corners = [
            { x: 0, y: 0, vx: 100, vy: 100 }, // Top-Left
            { x: 800, y: 0, vx: -100, vy: 100 }, // Top-Right
            { x: 0, y: 600, vx: 100, vy: -100 }, // Bottom-Left
            { x: 800, y: 600, vx: -100, vy: -100 } // Bottom-Right
        ];
        const corner = Phaser.Utils.Array.GetRandom(corners);

        // Add random offset to prevent overlap
        const offsetX = Phaser.Math.Between(-50, 50);
        const offsetY = Phaser.Math.Between(-50, 50);

        const container = this.add.container(corner.x + offsetX, corner.y + offsetY);

        const textModel = this.add.text(0, 0, modelName, {
            fontSize: '18px',
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const textCompany = this.add.text(0, 20, companyName, {
            fontSize: '12px',
            fill: '#aaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        container.add([textModel, textCompany]);

        // Store potential as score/life
        container.setData('score', potential);
        container.setData('maxScore', potential); // For reference if needed

        // Enable physics for the container
        this.physics.world.enable(container);

        // Set container size for physics body (approximate based on text)
        container.body.setSize(textModel.width + 20, 40);
        container.body.setOffset(-textModel.width / 2 - 10, -10);

        // Make interactive
        container.setInteractive(new Phaser.Geom.Rectangle(-textModel.width / 2 - 10, -20, textModel.width + 20, 40), Phaser.Geom.Rectangle.Contains);

        container.on('pointerdown', () => {
            this.sound.play('explosion');
            this.explosionEmitter.emitParticleAt(container.x, container.y, 30);
            container.destroy();
        });

        // Add to group FIRST
        this.enemies.add(container);

        // Add some randomness to velocity
        const vx = corner.vx + Phaser.Math.Between(-20, 20);
        const vy = corner.vy + Phaser.Math.Between(-20, 20);

        // Set velocity AFTER adding to group
        container.body.setVelocity(vx, vy);
        container.body.setBounce(1, 1);
        container.body.setCollideWorldBounds(true);
    }

    update(time, delta) {
        if (this.gameEnded) return;

        // Update enemy scores (decay)
        this.enemies.getChildren().forEach(enemy => {
            let score = enemy.getData('score');
            score -= delta; // Decrease by milliseconds elapsed (1000 per second)
            enemy.setData('score', score);

            // Update visual indication? (Maybe shake or turn redder?)
            // For now, just check death
            if (score <= 0) {
                this.sound.play('explosion');
                this.explosionEmitter.emitParticleAt(enemy.x, enemy.y, 30);
                enemy.destroy();
            }
        });

        // Check Win Condition
        if (this.enemyData.length === 0 && this.enemies.getLength() === 0) {
            this.gameEnded = true;
            const totalTime = (this.time.now - this.startTime) / 1000;
            this.showGameOver(totalTime);
        }

        // Update Progress Bar
        if (this.spawnEvent && this.timerGraphics) {
            const progress = this.spawnEvent.getProgress();

            this.timerGraphics.clear();

            // Draw background
            this.timerGraphics.fillStyle(0x333333, 0.8);
            this.timerGraphics.fillRect(10, 10, 200, 20);

            // Draw fill
            this.timerGraphics.fillStyle(0xff4444, 1);
            this.timerGraphics.fillRect(10, 10, 200 * progress, 20);

            // Draw border
            this.timerGraphics.lineStyle(2, 0xffffff, 1);
            this.timerGraphics.strokeRect(10, 10, 200, 20);
        }

        if (this.cursors.left.isDown) {
            this.logo.setVelocityX(-160);
        } else if (this.cursors.right.isDown) {
            this.logo.setVelocityX(160);
        } else {
            this.logo.setVelocityX(0);
        }

        if (this.cursors.up.isDown) {
            this.logo.setVelocityY(-160);
        } else if (this.cursors.down.isDown) {
            this.logo.setVelocityY(160);
        } else {
            this.logo.setVelocityY(0);
        }
    }

    startMusic() {
        if (this.music) {
            this.music.play({
                loop: true,
                volume: 0.5
            });
        } else {
            // Music not ready yet, set flag to play in create()
            this.shouldPlayMusic = true;
        }
    }

    startMusic() {
        if (this.music) {
            this.music.play({
                loop: true,
                volume: 0.5
            });
        } else {
            // Music not ready yet, set flag to play in create()
            this.shouldPlayMusic = true;
        }
    }

    showGameOver(totalTime) {
        const gameOverScreen = document.getElementById('game-over-screen');
        const timeDisplay = document.getElementById('game-over-time');
        if (gameOverScreen && timeDisplay) {
            timeDisplay.innerText = `Tempo totale: ${totalTime.toFixed(2)}s`;
            gameOverScreen.style.display = 'flex';
            setTimeout(() => {
                gameOverScreen.style.opacity = '1';
            }, 10);
        }
    }
}
