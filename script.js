const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const stageText = document.getElementById("stageText");
const timerText = document.getElementById("timerText");
const messageText = document.getElementById("messageText");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");
const bgmButton = document.getElementById("bgmButton");
const bgmVolumeSlider = document.getElementById("bgmVolumeSlider");
const bgmVolumeText = document.getElementById("bgmVolumeText");

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
const BGM_MASTER_MAX_VOLUME = 0.3;

const STAGES = [
    {
        level: 1,
        label: "1단계",
        description: "몸풀기",
        minTime: 0,
        startSpeed: 6.5,
        maxSpeed: 9,
        speedIncrease: 0.25,
        obstacleWidth: 40,
        obstacleHeight: 50,
        spawnMin: 260,
        spawnRandom: 260
    },
    {
        level: 2,
        label: "2단계",
        description: "속도 증가",
        minTime: 10,
        startSpeed: 8.5,
        maxSpeed: 11.5,
        speedIncrease: 0.35,
        obstacleWidth: 46,
        obstacleHeight: 58,
        spawnMin: 210,
        spawnRandom: 210
    },
    {
        level: 3,
        label: "3단계",
        description: "최고 난이도",
        minTime: 20,
        startSpeed: 10.5,
        maxSpeed: 14,
        speedIncrease: 0.45,
        obstacleWidth: 52,
        obstacleHeight: 66,
        spawnMin: 160,
        spawnRandom: 170
    }
];

let gameState = "ready";
// ready, playing, win, lose

let startTime = 0;
let animationId = null;

let audioContext = null;
let soundEnabled = true;

let bgmEnabled = true;
let bgmPlaying = false;
let bgmTimeoutId = null;
let bgmGainNode = null;

let currentStage = 1;
let currentGameResult = null;
let finalSurvivalTime = 0;
let finalStageReached = 1;
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

    startTime = 0;
    currentGameResult = null;
    finalSurvivalTime = 0;
    finalStageReached = 1;
    currentResultSaved = false;

    stopBgm();
    applyStageConfig(STAGES[0], true);

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
    messageText.textContent = "1단계 시작! 장애물을 피하세요!";

    hideNicknameBox();
    startBgm();
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

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    return audioContext;
}

function playTone(audioCtx, options) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    const destinationNode = options.destination || audioCtx.destination;

    oscillator.connect(gainNode);
    gainNode.connect(destinationNode);

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

function prepareEffectSound() {
    if (!soundEnabled) return null;

    return getAudioContext();
}

function prepareBgmSound() {
    if (!bgmEnabled) return null;

    return getAudioContext();
}

function getBgmTargetVolume() {
    const sliderValue = Number(bgmVolumeSlider.value);
    const volumeRatio = sliderValue / 100;

    if (volumeRatio <= 0) {
        return 0.0001;
    }

    return volumeRatio * BGM_MASTER_MAX_VOLUME;
}

function updateBgmVolumeText() {
    bgmVolumeText.textContent = `${bgmVolumeSlider.value}%`;
}

function applyBgmVolume() {
    updateBgmVolumeText();

    if (!bgmGainNode || !audioContext) return;

    const now = audioContext.currentTime;
    const targetVolume = getBgmTargetVolume();

    bgmGainNode.gain.cancelScheduledValues(now);
    bgmGainNode.gain.setValueAtTime(bgmGainNode.gain.value, now);
    bgmGainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.1);
}

function playJumpSound() {
    const currentAudioContext = prepareEffectSound();

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
    const currentAudioContext = prepareEffectSound();

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
    const currentAudioContext = prepareEffectSound();

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

function playStageUpSound() {
    const currentAudioContext = prepareEffectSound();

    if (!currentAudioContext) return;

    const now = currentAudioContext.currentTime;

    playTone(currentAudioContext, {
        type: "square",
        startFrequency: 420,
        endFrequency: 760,
        startTime: now,
        duration: 0.12,
        volume: 0.16
    });

    playTone(currentAudioContext, {
        type: "triangle",
        startFrequency: 760,
        endFrequency: 980,
        startTime: now + 0.12,
        duration: 0.12,
        volume: 0.16
    });
}

function getBgmGainNode(audioCtx) {
    if (!bgmGainNode) {
        bgmGainNode = audioCtx.createGain();
        bgmGainNode.gain.value = 0.0001;
        bgmGainNode.connect(audioCtx.destination);
    }

    return bgmGainNode;
}

function startBgm() {
    if (!bgmEnabled || bgmPlaying) return;

    const currentAudioContext = prepareBgmSound();

    if (!currentAudioContext) return;

    bgmPlaying = true;

    const bgmGain = getBgmGainNode(currentAudioContext);
    const now = currentAudioContext.currentTime;
    const targetVolume = getBgmTargetVolume();

    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(0.0001, now);
    bgmGain.gain.linearRampToValueAtTime(targetVolume, now + 0.5);

    playBgmLoop();
}

function stopBgm() {
    if (bgmTimeoutId) {
        clearTimeout(bgmTimeoutId);
        bgmTimeoutId = null;
    }

    if (bgmGainNode && audioContext) {
        const now = audioContext.currentTime;

        bgmGainNode.gain.cancelScheduledValues(now);
        bgmGainNode.gain.setValueAtTime(bgmGainNode.gain.value, now);
        bgmGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.25);
    }

    bgmPlaying = false;
}

function playBgmLoop() {
    if (!bgmPlaying || !bgmEnabled) return;

    const currentAudioContext = prepareBgmSound();

    if (!currentAudioContext) return;

    const bgmGain = getBgmGainNode(currentAudioContext);
    const now = currentAudioContext.currentTime;

    const melody = getBgmMelodyByStage();

    melody.forEach(function(note) {
        playTone(currentAudioContext, {
            type: "triangle",
            startFrequency: note.frequency,
            endFrequency: note.frequency * 1.01,
            startTime: now + note.time,
            duration: note.duration,
            volume: note.volume,
            destination: bgmGain
        });
    });

    playBgmBass(currentAudioContext, bgmGain, now);

    bgmTimeoutId = setTimeout(function() {
        playBgmLoop();
    }, 1600);
}

function getBgmMelodyByStage() {
    if (currentStage === 1) {
        return [
            { frequency: 392, time: 0.0, duration: 0.18, volume: 0.14 },
            { frequency: 494, time: 0.2, duration: 0.18, volume: 0.14 },
            { frequency: 523, time: 0.4, duration: 0.18, volume: 0.14 },
            { frequency: 494, time: 0.6, duration: 0.18, volume: 0.14 },
            { frequency: 392, time: 0.8, duration: 0.18, volume: 0.14 },
            { frequency: 330, time: 1.0, duration: 0.18, volume: 0.12 },
            { frequency: 392, time: 1.2, duration: 0.3, volume: 0.14 }
        ];
    }

    if (currentStage === 2) {
        return [
            { frequency: 440, time: 0.0, duration: 0.16, volume: 0.15 },
            { frequency: 523, time: 0.18, duration: 0.16, volume: 0.15 },
            { frequency: 587, time: 0.36, duration: 0.16, volume: 0.15 },
            { frequency: 659, time: 0.54, duration: 0.16, volume: 0.15 },
            { frequency: 587, time: 0.72, duration: 0.16, volume: 0.15 },
            { frequency: 523, time: 0.9, duration: 0.16, volume: 0.15 },
            { frequency: 440, time: 1.08, duration: 0.26, volume: 0.15 }
        ];
    }

    return [
        { frequency: 523, time: 0.0, duration: 0.12, volume: 0.16 },
        { frequency: 659, time: 0.15, duration: 0.12, volume: 0.16 },
        { frequency: 784, time: 0.3, duration: 0.12, volume: 0.16 },
        { frequency: 988, time: 0.45, duration: 0.12, volume: 0.16 },
        { frequency: 784, time: 0.6, duration: 0.12, volume: 0.16 },
        { frequency: 659, time: 0.75, duration: 0.12, volume: 0.16 },
        { frequency: 523, time: 0.9, duration: 0.22, volume: 0.16 },
        { frequency: 659, time: 1.2, duration: 0.22, volume: 0.16 }
    ];
}

function playBgmBass(audioCtx, destination, startTime) {
    const bassFrequency = currentStage === 1 ? 196 : currentStage === 2 ? 220 : 262;

    playTone(audioCtx, {
        type: "sine",
        startFrequency: bassFrequency,
        endFrequency: bassFrequency,
        startTime: startTime,
        duration: 0.45,
        volume: 0.08,
        destination: destination
    });

    playTone(audioCtx, {
        type: "sine",
        startFrequency: bassFrequency,
        endFrequency: bassFrequency,
        startTime: startTime + 0.8,
        duration: 0.45,
        volume: 0.08,
        destination: destination
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

function getStageConfigByElapsedTime(elapsedTime) {
    if (elapsedTime >= STAGES[2].minTime) {
        return STAGES[2];
    }

    if (elapsedTime >= STAGES[1].minTime) {
        return STAGES[1];
    }

    return STAGES[0];
}

function getCurrentStageConfig() {
    return STAGES[currentStage - 1];
}

function applyStageConfig(stageConfig, resetObstaclePosition) {
    currentStage = stageConfig.level;

    obstacle.width = stageConfig.obstacleWidth;
    obstacle.height = stageConfig.obstacleHeight;
    obstacle.y = GROUND_Y - obstacle.height;

    if (resetObstaclePosition) {
        obstacle.x = CANVAS_WIDTH + 100;
        obstacle.speed = stageConfig.startSpeed;
    } else {
        obstacle.speed = Math.max(obstacle.speed, stageConfig.startSpeed);
    }

    updateStageText();
}

function updateStage() {
    const elapsedTime = getElapsedSeconds();
    const nextStageConfig = getStageConfigByElapsedTime(elapsedTime);

    if (nextStageConfig.level !== currentStage) {
        applyStageConfig(nextStageConfig, false);
        playStageUpSound();
        messageText.textContent = `${nextStageConfig.label} 진입! ${nextStageConfig.description} 구간입니다.`;
    }
}

function updateStageText() {
    const stageConfig = getCurrentStageConfig();
    stageText.textContent = `현재 단계: ${stageConfig.label} - ${stageConfig.description}`;
}

function updateObstacle() {
    const stageConfig = getCurrentStageConfig();

    obstacle.x -= obstacle.speed;

    if (obstacle.x + obstacle.width < 0) {
        obstacle.x = CANVAS_WIDTH + stageConfig.spawnMin + Math.random() * stageConfig.spawnRandom;
        obstacle.width = stageConfig.obstacleWidth;
        obstacle.height = stageConfig.obstacleHeight;
        obstacle.y = GROUND_Y - obstacle.height;

        obstacle.speed += stageConfig.speedIncrease;

        if (obstacle.speed < stageConfig.startSpeed) {
            obstacle.speed = stageConfig.startSpeed;
        }

        if (obstacle.speed > stageConfig.maxSpeed) {
            obstacle.speed = stageConfig.maxSpeed;
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
    finalStageReached = currentStage;

    cancelAnimationFrame(animationId);
    stopBgm();

    if (result === "win") {
        messageText.textContent = "승리! 3단계를 모두 클리어했습니다!";
        timerText.textContent = "남은 시간: 0초";
        playWinSound();
    }

    if (result === "lose") {
        messageText.textContent = `패배! ${currentStage}단계에서 장애물에 부딪혔습니다.`;
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

    if (currentStage === 1) {
        ctx.fillStyle = "#bfdbfe";
    } else if (currentStage === 2) {
        ctx.fillStyle = "#fde68a";
    } else {
        ctx.fillStyle = "#fecaca";
    }

    ctx.fillRect(0, 0, CANVAS_WIDTH, 230);

    if (currentStage === 1) {
        ctx.fillStyle = "#86efac";
    } else if (currentStage === 2) {
        ctx.fillStyle = "#65a30d";
    } else {
        ctx.fillStyle = "#4b5563";
    }

    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    drawCloud(140, 80);
    drawCloud(520, 100);
    drawCanvasStageBadge();
}

function drawCloud(x, y) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.arc(x + 30, y - 10, 30, 0, Math.PI * 2);
    ctx.arc(x + 65, y, 25, 0, Math.PI * 2);
    ctx.fill();
}

function drawCanvasStageBadge() {
    const stageConfig = getCurrentStageConfig();

    ctx.fillStyle = "rgba(17, 24, 39, 0.85)";
    ctx.fillRect(24, 24, 150, 46);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText(stageConfig.label, 42, 54);

    ctx.textAlign = "left";
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
    if (currentStage === 1) {
        ctx.fillStyle = "#ef4444";
    } else if (currentStage === 2) {
        ctx.fillStyle = "#f97316";
    } else {
        ctx.fillStyle = "#7f1d1d";
    }

    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(
        obstacle.x + 6,
        obstacle.y + 6,
        obstacle.width - 12,
        obstacle.height - 12
    );
}

function drawResultOverlay() {
    if (gameState !== "win" && gameState !== "lose") return;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";

    if (gameState === "win") {
        ctx.fillText("승리!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
    }

    if (gameState === "lose") {
        ctx.fillText("패배!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
    }

    ctx.font = "24px Arial";

    if (gameState === "win") {
        ctx.fillText("3단계까지 모두 클리어했습니다!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    }

    if (gameState === "lose") {
        ctx.fillText(`${finalStageReached}단계까지 도달했습니다.`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    }

    ctx.font = "20px Arial";
    ctx.fillText("닉네임을 입력해 기록을 남겨보세요", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);

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

    updateStage();
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
    nicknameErrorText.style.color = "#dc2626";
    saveLogButton.disabled = false;
    saveLogButton.textContent = "기록 저장";

    if (currentGameResult === "win") {
        resultSummaryText.textContent = `승리 기록! 3단계 클리어 / 생존 시간: ${finalSurvivalTime}초`;
    }

    if (currentGameResult === "lose") {
        resultSummaryText.textContent = `패배 기록. 도달 단계: ${finalStageReached}단계 / 생존 시간: ${finalSurvivalTime}초`;
    }

    setTimeout(function() {
        nicknameInput.focus();
    }, 100);
}

function hideNicknameBox() {
    nicknameBox.classList.add("hidden");
    nicknameInput.value = "";
    nicknameErrorText.textContent = "";
    nicknameErrorText.style.color = "#dc2626";
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

        if (b.stageReached !== a.stageReached) {
            return b.stageReached - a.stageReached;
        }

        return b.timestamp - a.timestamp;
    });
}

function savePlayerLog() {
    if (currentResultSaved) {
        nicknameErrorText.textContent = "이미 이번 게임 기록을 저장했습니다.";
        nicknameErrorText.style.color = "#dc2626";
        return;
    }

    const nickname = nicknameInput.value.trim();

    if (nickname.length === 0) {
        nicknameErrorText.textContent = "닉네임을 입력해주세요.";
        nicknameErrorText.style.color = "#dc2626";
        return;
    }

    if (nickname.length > 10) {
        nicknameErrorText.textContent = "닉네임은 최대 10글자까지 가능합니다.";
        nicknameErrorText.style.color = "#dc2626";
        return;
    }

    const rankings = loadRankings();

    const newRecord = {
        nickname: nickname,
        result: currentGameResult,
        survivalTime: finalSurvivalTime,
        stageReached: finalStageReached,
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

        const stageReached = record.stageReached || 1;

        metaText.appendChild(resultSpan);
        metaText.appendChild(document.createTextNode(` · ${stageReached}단계 도달 · ${record.playedAt}`));

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

bgmButton.addEventListener("click", function() {
    bgmEnabled = !bgmEnabled;

    if (bgmEnabled) {
        bgmButton.textContent = "배경음악 ON";
        bgmButton.style.background = "#8b5cf6";

        if (gameState === "playing") {
            startBgm();
        }
    } else {
        bgmButton.textContent = "배경음악 OFF";
        bgmButton.style.background = "#6b7280";
        stopBgm();
    }
});

bgmVolumeSlider.addEventListener("input", function() {
    applyBgmVolume();
});

saveLogButton.addEventListener("click", function() {
    savePlayerLog();
});

clearRankingButton.addEventListener("click", function() {
    clearRankings();
});

applyStageConfig(STAGES[0], true);
updateBgmVolumeText();
renderRankings();
drawGame();