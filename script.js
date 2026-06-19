const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timerText = document.getElementById("timerText");
const messageText = document.getElementById("messageText");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");

const nicknameBox = document.getElementById("nicknameBox");
const resultSummaryText = document.getElementById("resultSummaryText");
const nicknameInput = document.getElementById("nicknameInput");
const saveLogButton = document.getElementById("saveLogButton");
const nicknameErrorText = document.getElementById("nicknameErrorText");

const rankingList = document.getElementById("rankingList");
const emptyRankingText = document.getElementById("emptyRankingText");
const clearRankingButton = document.getElementById("clearRankingButton");

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

const GROUND_Y = 320;
const GAME_TIME = 30;
const RANKING_STORAGE_KEY = "jumpObstacleGameRankings";

let gameState = "ready";
// ready, playing, win, lose

let startTime = 0;
let animationId = null;

let audioContext = null;
let soundEnabled = true;

let currentGameResult = null;
let finalSurvivalTime = 0;
let currentResultSaved = false;

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
    currentGameResult = null;
    finalSurvivalTime = 0;
    currentResultSaved = false;

    timerText.textContent = `남은 시간: ${GAME_TIME}초`;
    messageText.textContent = "Space 키를 눌러 게임 시작";

    hideNicknameBox();

    cancelAnimationFrame(animationId);
    drawGame();
}

function startGame() {
    if (gameState !== "ready") return;

    gameState = "playing";
    startTime = Date.now();
    messageText.textContent = "장애물을 피하세요!";

    hideNicknameBox();
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

function playTone(audioCtx, options) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = options.type || "sine";

    oscillator.frequency.setValueAtTime(options.startFrequency, options.startTime);

    if (options.endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
            options.endFrequency,
            options.startTime + options.duration
        );
    }

    gainNode.gain.setValueAtTime(0.0001, options.startTime);
    gainNode.gain.exponentialRampToValueAtTime(
        options.volume || 0.2,
        options.startTime + 0.02
    );
    gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        options.startTime + options.duration
    );

    oscillator.start(options.startTime);
    oscillator.stop(options.startTime + options.duration + 0.02);
}

function prepareSound() {
    if (!soundEnabled) return null;

    const currentAudioContext = getAudioContext();

    if (!currentAudioContext) return null;

    if (currentAudioContext.state === "suspended") {
        currentAudioContext.resume();
    }

    return currentAudioContext;
}

function playJumpSound() {
    const currentAudioContext = prepareSound();

    if (!currentAudioContext) return;

    const now = currentAudioContext.currentTime;

    playTone(currentAudioContext, {
        type: "sine",
        startFrequency: 260,
        endFrequency: 620,
        startTime: now,
        duration: 0.18,
        volume: 0.25
    });
}

function playWinSound() {
    const currentAudioContext = prepareSound();

    if (!currentAudioContext) return;

    const now = currentAudioContext.currentTime;

    const winNotes = [523, 659, 784, 1046];

    winNotes.forEach(function(frequency, index) {
        playTone(currentAudioContext, {
            type: "triangle",
            startFrequency: frequency,
            endFrequency: frequency * 1.05,
            startTime: now + index * 0.12,
            duration: 0.16,
            volume: 0.23
        });
    });
}

function playLoseSound() {
    const currentAudioContext = prepareSound();

    if (!currentAudioContext) return;

    const now = currentAudioContext.currentTime;

    playTone(currentAudioContext, {
        type: "sawtooth",
        startFrequency: 260,
        endFrequency: 90,
        startTime: now,
        duration: 0.45,
        volume: 0.22
    });

    playTone(currentAudioContext, {
        type: "triangle",
        startFrequency: 120,
        endFrequency: 60,
        startTime: now + 0.2,
        duration: 0.35,
        volume: 0.18
    });
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

function getElapsedSeconds() {
    if (startTime === 0) return 0;

    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    return Math.min(elapsedTime, GAME_TIME);
}

function endGame(result) {
    if (gameState !== "playing") return;

    gameState = result;
    currentGameResult = result;
    finalSurvivalTime = getElapsedSeconds();

    cancelAnimationFrame(animationId);

    if (result === "win") {
        messageText.textContent = "승리! 30초 동안 살아남았습니다!";
        timerText.textContent = "남은 시간: 0초";
        playWinSound();
    }

    if (result === "lose") {
        messageText.textContent = "패배! 장애물에 부딪혔습니다.";
        playLoseSound();
    }

    showNicknameBox();
    drawGame();
}

function checkCollision() {
    const isColliding =
        player.x < obstacle.x + obstacle.width &&
        player.x + player.width > obstacle.x &&
        player.y < obstacle.y + obstacle.height &&
        player.y + player.height > obstacle.y;

    if (isColliding) {
        endGame("lose");
    }
}

function checkWinCondition() {
    const elapsedTime = getElapsedSeconds();
    const remainingTime = GAME_TIME - elapsedTime;

    timerText.textContent = `남은 시간: ${Math.max(remainingTime, 0)}초`;

    if (remainingTime <= 0) {
        endGame("win");
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
    ctx.fillText("닉네임을 입력해 기록을 남겨보세요", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);

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

function showNicknameBox() {
    nicknameBox.classList.remove("hidden");
    nicknameInput.value = "";
    nicknameErrorText.textContent = "";
    saveLogButton.disabled = false;
    saveLogButton.textContent = "기록 저장";

    if (currentGameResult === "win") {
        resultSummaryText.textContent = `승리 기록! 생존 시간: ${finalSurvivalTime}초`;
    }

    if (currentGameResult === "lose") {
        resultSummaryText.textContent = `패배 기록. 생존 시간: ${finalSurvivalTime}초`;
    }

    setTimeout(function() {
        nicknameInput.focus();
    }, 100);
}

function hideNicknameBox() {
    nicknameBox.classList.add("hidden");
    nicknameInput.value = "";
    nicknameErrorText.textContent = "";
}

function loadRankings() {
    try {
        const savedRankings = localStorage.getItem(RANKING_STORAGE_KEY);

        if (!savedRankings) {
            return [];
        }

        return JSON.parse(savedRankings);
    } catch (error) {
        console.error("랭킹 데이터를 불러오지 못했습니다.", error);
        return [];
    }
}

function saveRankings(rankings) {
    try {
        localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rankings));
    } catch (error) {
        console.error("랭킹 데이터를 저장하지 못했습니다.", error);
    }
}

function sortRankings(rankings) {
    return rankings.sort(function(a, b) {
        if (b.survivalTime !== a.survivalTime) {
            return b.survivalTime - a.survivalTime;
        }

        return b.timestamp - a.timestamp;
    });
}

function savePlayerLog() {
    if (currentResultSaved) {
        nicknameErrorText.textContent = "이미 이번 게임 기록을 저장했습니다.";
        return;
    }

    const nickname = nicknameInput.value.trim();

    if (nickname.length === 0) {
        nicknameErrorText.textContent = "닉네임을 입력해주세요.";
        return;
    }

    if (nickname.length > 10) {
        nicknameErrorText.textContent = "닉네임은 최대 10글자까지 가능합니다.";
        return;
    }

    const rankings = loadRankings();

    const newRecord = {
        nickname: nickname,
        result: currentGameResult,
        survivalTime: finalSurvivalTime,
        playedAt: new Date().toLocaleString("ko-KR"),
        timestamp: Date.now()
    };

    rankings.push(newRecord);

    const sortedRankings = sortRankings(rankings).slice(0, 10);

    saveRankings(sortedRankings);
    renderRankings();

    currentResultSaved = true;
    saveLogButton.disabled = true;
    saveLogButton.textContent = "저장 완료";
    nicknameErrorText.textContent = "기록이 저장되었습니다!";
    nicknameErrorText.style.color = "#16a34a";
}

function renderRankings() {
    const rankings = loadRankings();

    rankingList.innerHTML = "";

    if (rankings.length === 0) {
        emptyRankingText.style.display = "block";
        return;
    }

    emptyRankingText.style.display = "none";

    rankings.forEach(function(record, index) {
        const listItem = document.createElement("li");
        listItem.className = "ranking-item";

        const mainBox = document.createElement("div");
        mainBox.className = "ranking-main";

        const nameText = document.createElement("div");
        nameText.className = "ranking-name";

        const resultText = record.result === "win" ? "승리" : "패배";
        const resultClass = record.result === "win" ? "result-win" : "result-lose";
        const medal = index === 0 ? "🏆 " : "";

        nameText.textContent = `${medal}${index + 1}위 ${record.nickname}`;

        const metaText = document.createElement("div");
        metaText.className = "ranking-meta";

        const resultSpan = document.createElement("span");
        resultSpan.className = resultClass;
        resultSpan.textContent = resultText;

        metaText.appendChild(resultSpan);
        metaText.appendChild(document.createTextNode(` · ${record.playedAt}`));

        mainBox.appendChild(nameText);
        mainBox.appendChild(metaText);

        const scoreText = document.createElement("div");
        scoreText.className = "ranking-score";
        scoreText.textContent = `${record.survivalTime}초 생존`;

        listItem.appendChild(mainBox);
        listItem.appendChild(scoreText);

        rankingList.appendChild(listItem);
    });
}

function clearRankings() {
    const isConfirmed = confirm("저장된 플레이 기록을 모두 삭제할까요?");

    if (!isConfirmed) return;

    localStorage.removeItem(RANKING_STORAGE_KEY);
    renderRankings();
}

window.addEventListener("keydown", function(event) {
    if (document.activeElement === nicknameInput) {
        return;
    }

    if (event.code === "Space") {
        event.preventDefault();

        if (event.repeat) return;

        jump();
    }
});

nicknameInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        savePlayerLog();
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

saveLogButton.addEventListener("click", function() {
    savePlayerLog();
});

clearRankingButton.addEventListener("click", function() {
    clearRankings();
});

renderRankings();
drawGame();