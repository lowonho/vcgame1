const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timerText = document.getElementById("timerText");
const messageText = document.getElementById("messageText");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

const GROUND_Y = 320;
const GAME_TIME = 30;

let gameState = "ready";
// ready, playing, win, lose

let startTime = 0;
let animationId = null;

let audioContext = null;
let soundEnabled = true;

const player = {
    x: 100,
    y: GROUND_Y - 60,
    width: 50,
    height: 60,
    velocityY: 0,
    jumpPower: -17,
    gravity: 0.8,
    isJumping: false
};

const obstacle = {
    x: CANVAS_WIDTH + 100,
    y: GROUND_Y - 50,
    width: 40,
    height: 50,
    speed: 7
};

function resetGame() {
    gameState = "ready";

    player.x = 100;
    player.y = GROUND_Y - player.height;
    player.velocityY = 0;
    player.isJumping = false;

    obstacle.x = CANVAS_WIDTH + 100;
    obstacle.speed = 7;

    startTime = 0;

    timerText.textContent = `남은 시간: ${GAME_TIME}초`;
    messageText.textContent = "Space 키를 눌러 게임 시작";

    cancelAnimationFrame(animationId);
    drawGame();
}

function startGame() {
    if (gameState !== "ready") return;

    gameState = "playing";
    startTime = Date.now();
    messageText.textContent = "장애물을 피하세요!";

    gameLoop();
}

function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        return null;
    }

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }

    return audioContext;
}

function playJumpSound() {
    if (!soundEnabled) return;

    const currentAudioContext = getAudioContext();

    if (!currentAudioContext) return;

    if (currentAudioContext.state === "suspended") {
        currentAudioContext.resume();
    }

    const oscillator = currentAudioContext.createOscillator();
    const gainNode = currentAudioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(currentAudioContext.destination);

    const now = currentAudioContext.currentTime;

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(260, now);
    oscillator.frequency.exponentialRampToValueAtTime(620, now + 0.08);
    oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.16);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
}

function jump() {
    if (gameState === "ready") {
        startGame();
    }

    if (gameState !== "playing") return;

    if (!player.isJumping) {
        player.velocityY = player.jumpPower;
        player.isJumping = true;
        playJumpSound();
    }
}

function updatePlayer() {
    player.y += player.velocityY;
    player.velocityY += player.gravity;

    const groundPlayerY = GROUND_Y - player.height;

    if (player.y >= groundPlayerY) {
        player.y = groundPlayerY;
        player.velocityY = 0;
        player.isJumping = false;
    }
}

function updateObstacle() {
    obstacle.x -= obstacle.speed;

    if (obstacle.x + obstacle.width < 0) {
        obstacle.x = CANVAS_WIDTH + Math.random() * 300;
        obstacle.speed += 0.3;

        if (obstacle.speed > 13) {
            obstacle.speed = 13;
        }
    }
}

function checkCollision() {
    const isColliding =
        player.x < obstacle.x + obstacle.width &&
        player.x + player.width > obstacle.x &&
        player.y < obstacle.y + obstacle.height &&
        player.y + player.height > obstacle.y;

    if (isColliding) {
        gameState = "lose";
        messageText.textContent = "패배! 장애물에 부딪혔습니다.";
        cancelAnimationFrame(animationId);
    }
}

function checkWinCondition() {
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    const remainingTime = GAME_TIME - elapsedTime;

    timerText.textContent = `남은 시간: ${Math.max(remainingTime, 0)}초`;

    if (remainingTime <= 0) {
        gameState = "win";
        messageText.textContent = "승리! 30초 동안 살아남았습니다!";
        cancelAnimationFrame(animationId);
    }
}

function drawBackground() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#bfdbfe";
    ctx.fillRect(0, 0, CANVAS_WIDTH, 230);

    ctx.fillStyle = "#86efac";
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    drawCloud(140, 80);
    drawCloud(520, 100);
}

function drawCloud(x, y) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.arc(x + 30, y - 10, 30, 0, Math.PI * 2);
    ctx.arc(x + 65, y, 25, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlayer() {
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(player.x, player.y, player.width, player.height);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(player.x + 10, player.y + 15, 8, 8);
    ctx.fillRect(player.x + 30, player.y + 15, 8, 8);

    ctx.fillStyle = "#1f2937";
    ctx.fillRect(player.x + 14, player.y + 19, 4, 4);
    ctx.fillRect(player.x + 34, player.y + 19, 4, 4);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(player.x + 14, player.y + 40, 22, 5);
}

function drawObstacle() {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    ctx.fillStyle = "#991b1b";
    ctx.fillRect(obstacle.x + 6, obstacle.y + 6, obstacle.width - 12, obstacle.height - 12);
}

function drawResultOverlay() {
    if (gameState !== "win" && gameState !== "lose") return;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";

    if (gameState === "win") {
        ctx.fillText("승리!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    }

    if (gameState === "lose") {
        ctx.fillText("패배!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    }

    ctx.font = "24px Arial";
    ctx.fillText("다시 시작 버튼을 눌러 재도전하세요", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);

    ctx.textAlign = "left";
}

function drawGame() {
    drawBackground();
    drawPlayer();
    drawObstacle();
    drawResultOverlay();
}

function gameLoop() {
    if (gameState !== "playing") return;

    updatePlayer();
    updateObstacle();
    checkCollision();

    if (gameState !== "playing") {
        drawGame();
        return;
    }

    checkWinCondition();

    if (gameState !== "playing") {
        drawGame();
        return;
    }

    drawGame();

    animationId = requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", function(event) {
    if (event.code === "Space") {
        event.preventDefault();

        if (event.repeat) return;

        jump();
    }
});

restartButton.addEventListener("click", function() {
    resetGame();
});

soundButton.addEventListener("click", function() {
    soundEnabled = !soundEnabled;

    if (soundEnabled) {
        soundButton.textContent = "효과음 ON";
        soundButton.style.background = "#16a34a";
    } else {
        soundButton.textContent = "효과음 OFF";
        soundButton.style.background = "#6b7280";
    }
});

drawGame();