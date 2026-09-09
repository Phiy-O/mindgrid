// ===== CONSTANTS =====
const GRID_SIZE = 6;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const ACTIVE_TILES = 10;
const MEMORIZE_TIME = 3000;
const RECALL_TIME = 10000;

// ===== DOM =====
const $ = (s) => document.querySelector(s);
const screenStart = $('#screen-start');
const screenCountdown = $('#screen-countdown');
const screenGame = $('#screen-game');
const screenResult = $('#screen-result');
const btnPlay = $('#btn-play');
const btnReplay = $('#btn-replay');
const btnExit = $('#btn-exit');
const countdownNumber = $('#countdown-number');
const countdownMessage = $('#countdown-message');
const grid = $('#grid');
const gameTimer = $('#game-timer');
const gamePhaseLabel = $('#game-phase-label');
const selectionCounter = $('#selection-counter');
const resultIcon = $('#result-icon');
const resultTitle = $('#result-title');
const resultScore = $('#result-score');
const resultSubtitle = $('#result-subtitle');
const resultPrize = $('#result-prize');
const soundToggle = $('#sound-toggle');
const volumeSliderWrap = $('#volume-slider-wrap');
const volumeSlider = $('#volume-slider');
const bgm = $('#bgm');

// ===== STATE =====
let activeTiles = [];
let selectedTiles = new Set();
let isMemoryPhase = false;
let isRecallPhase = false;
let timerInterval = null;
let soundEnabled = true;
let bgmEnabled = true;
let bgmVolume = 0.5;

// ===== AUDIO (Web Audio API) =====
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playCountdownBeep() { playTone(440, 0.15, 'sine', 0.12); }
function playCountdownGo() { playTone(880, 0.3, 'sine', 0.15); }
function playTileClick() { playTone(600, 0.08, 'square', 0.08); }
function playCorrect() {
  playTone(523, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 0.2, 'sine', 0.12), 200);
}
function playWrong() { playTone(200, 0.3, 'sawtooth', 0.1); }
function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.25, 'sine', 0.12), i * 120);
  });
}

// ===== BGM =====
let bgmFadeInterval = null;

function fadeBGM(targetVol, duration) {
  if (!bgm) return;
  if (bgmFadeInterval) clearInterval(bgmFadeInterval);
  const start = bgm.volume;
  const steps = 20;
  const stepTime = duration / steps;
  let step = 0;
  bgmFadeInterval = setInterval(() => {
    step++;
    bgm.volume = Math.max(0, Math.min(1, start + (targetVol - start) * (step / steps)));
    if (step >= steps) {
      clearInterval(bgmFadeInterval);
      bgmFadeInterval = null;
      if (targetVol === 0) bgm.pause();
    }
  }, stepTime);
}

function playBGM() {
  if (!bgm) return;
  if (!bgmEnabled) return;
  bgm.volume = 0;
  bgm.currentTime = 0;
  bgm.play().then(() => fadeBGM(bgmVolume, 600)).catch(() => {});
}

function pauseBGM() {
  fadeBGM(0, 600);
}

function resumeBGM() {
  if (!bgm) return;
  if (!bgmEnabled) return;
  bgm.play().catch(() => {});
  fadeBGM(bgmVolume, 600);
}

function muteBGM() {
  pauseBGM();
}

function unmuteBGM() {
  resumeBGM();
}

// ===== UTILITIES =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePattern() {
  const indices = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  return shuffle(indices).slice(0, ACTIVE_TILES);
}

// ===== SCREEN MANAGEMENT =====
function showScreen(screen) {
  [screenStart, screenCountdown, screenGame, screenResult].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ===== GRID =====
function buildGrid() {
  grid.innerHTML = '';
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.index = i;
    tile.addEventListener('click', () => handleTileClick(i));
    grid.appendChild(tile);
  }
}

function getTileEl(index) {
  return grid.children[index];
}

function clearAllTiles() {
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = getTileEl(i);
    tile.classList.remove('tile-active', 'tile-selected', 'tile-correct', 'tile-wrong', 'tile-missed');
  }
}

// ===== COUNTDOWN =====
function runCountdown() {
  return new Promise((resolve) => {
    showScreen(screenCountdown);
    let count = 3;
    countdownNumber.textContent = count;
    countdownNumber.style.display = '';
    countdownMessage.style.display = 'none';
    countdownNumber.style.animation = 'none';
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = '';
    playCountdownBeep();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
        countdownNumber.style.animation = 'none';
        void countdownNumber.offsetWidth;
        countdownNumber.style.animation = '';
        playCountdownBeep();
      } else {
        clearInterval(interval);
        countdownNumber.style.display = 'none';
        countdownMessage.style.display = '';
        countdownMessage.textContent = 'REMEMBER! 👀';
        countdownMessage.style.animation = 'none';
        void countdownMessage.offsetWidth;
        countdownMessage.style.animation = '';
        playCountdownGo();
        setTimeout(resolve, 800);
      }
    }, 800);
  });
}

// ===== MEMORY PHASE =====
function startMemoryPhase() {
  activeTiles = generatePattern();
  selectedTiles.clear();
  clearAllTiles();
  isMemoryPhase = true;
  isRecallPhase = false;

  showScreen(screenGame);
  gamePhaseLabel.textContent = 'REMEMBER! 👀';
  selectionCounter.textContent = '';
  gameTimer.classList.remove('warning');

  // Show active tiles
  activeTiles.forEach(i => getTileEl(i).classList.add('tile-active'));

  // Start timer
  let remaining = MEMORIZE_TIME;
  gameTimer.textContent = (remaining / 1000).toFixed(1);
  timerInterval = setInterval(() => {
    remaining -= 100;
    gameTimer.textContent = Math.max(0, remaining / 1000).toFixed(1);
    if (remaining <= 0) {
      clearInterval(timerInterval);
      endMemoryPhase();
    }
  }, 100);
}

function endMemoryPhase() {
  isMemoryPhase = false;
  // Hide active tiles
  activeTiles.forEach(i => getTileEl(i).classList.remove('tile-active'));
  playTileClick();
  startRecallPhase();
}

// ===== RECALL PHASE =====
function startRecallPhase() {
  isRecallPhase = true;
  gamePhaseLabel.textContent = 'YOUR TURN';
  selectionCounter.textContent = 'Selected: 0 / ' + ACTIVE_TILES;
  gameTimer.classList.remove('warning');

  let remaining = RECALL_TIME;
  gameTimer.textContent = (remaining / 1000).toFixed(1);
  timerInterval = setInterval(() => {
    remaining -= 100;
    gameTimer.textContent = Math.max(0, remaining / 1000).toFixed(1);
    if (remaining <= 5000) {
      gameTimer.classList.add('warning');
    }
    if (remaining <= 0) {
      clearInterval(timerInterval);
      endRecallPhase(true);
    }
  }, 100);
}

function handleTileClick(index) {
  if (!isRecallPhase) return;

  const tile = getTileEl(index);

  if (selectedTiles.has(index)) {
    selectedTiles.delete(index);
    tile.classList.remove('tile-selected');
  } else {
    if (selectedTiles.size >= ACTIVE_TILES) return;
    selectedTiles.add(index);
    tile.classList.add('tile-selected');
    playTileClick();
  }

  selectionCounter.textContent = 'Selected: ' + selectedTiles.size + ' / ' + ACTIVE_TILES;

  if (selectedTiles.size === ACTIVE_TILES) {
    clearInterval(timerInterval);
    endRecallPhase(false);
  }
}

function endRecallPhase(timedOut) {
  isRecallPhase = false;

  // Validate
  const correctSet = new Set(activeTiles);
  let correctCount = 0;

  selectedTiles.forEach(i => {
    if (correctSet.has(i)) correctCount++;
  });

  const isWin = correctCount === ACTIVE_TILES && !timedOut;

  // Show result tiles
  setTimeout(() => showResultTiles(isWin, correctCount, timedOut), 300);
}

function showResultTiles(isWin, correctCount, timedOut) {
  clearAllTiles();

  const selectedSet = selectedTiles;
  const activeSet = new Set(activeTiles);

  // Show correct/wrong for each tile the player selected
  selectedSet.forEach(i => {
    const tile = getTileEl(i);
    if (activeSet.has(i)) {
      tile.classList.add('tile-correct');
    } else {
      tile.classList.add('tile-wrong');
    }
  });

  // Show missed tiles (were active but not selected)
  activeTiles.forEach(i => {
    if (!selectedSet.has(i)) {
      const tile = getTileEl(i);
      tile.classList.add('tile-missed');
    }
  });

  if (isWin) {
    playCorrect();
    setTimeout(() => playWin(), 400);
    showConfetti();
  } else {
    playWrong();
  }

  // Transition to result screen after showing tiles
  setTimeout(() => showResultScreen(isWin, correctCount, timedOut), isWin ? 1200 : 1800);
}

// ===== RESULT SCREEN =====
function showResultScreen(isWin, correctCount, timedOut) {
  showScreen(screenResult);
  resumeBGM();

  if (isWin) {
    resultIcon.textContent = '🎉';
    resultTitle.textContent = 'PERFECT!';
    resultTitle.className = 'result-title win';
    resultScore.textContent = correctCount + ' / ' + ACTIVE_TILES;
    resultSubtitle.textContent = 'MEMORY MASTER';
    resultPrize.innerHTML = '🎁 <strong>YOU WIN!</strong><br>Show this screen to the booth staff to claim your prize.';
  } else {
    resultIcon.textContent = '😭';
    resultTitle.textContent = 'NICE TRY!';
    resultTitle.className = 'result-title lose';
    resultScore.textContent = correctCount + ' / ' + ACTIVE_TILES;
    resultSubtitle.textContent = 'Almost got it!';
    resultPrize.innerHTML = '🏷️ <strong>NICE TRY!</strong><br>Don\'t worry, you still get a participation gift.';
  }
}

// ===== CONFETTI =====
function showConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#00d4ff', '#7b61ff', '#ff6b35', '#00ff88', '#ff3366', '#ffd700'];
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    confetti.style.animationDelay = Math.random() * 0.8 + 's';
    confetti.style.width = (6 + Math.random() * 8) + 'px';
    confetti.style.height = (6 + Math.random() * 8) + 'px';
    container.appendChild(confetti);
  }

  setTimeout(() => container.remove(), 4000);
}

// ===== GAME FLOW =====
async function startGame() {
  pauseBGM();
  buildGrid();
  await runCountdown();
  startMemoryPhase();
}

// ===== EVENTS =====
btnPlay.addEventListener('click', startGame);
btnReplay.addEventListener('click', startGame);
btnExit.addEventListener('click', () => {
  showScreen(screenStart);
  playBGM();
});

// Sound toggle — show/hide volume slider
let volumeOpen = false;
soundToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  volumeOpen = !volumeOpen;
  volumeSliderWrap.classList.toggle('show', volumeOpen);
});

// Close volume slider on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.sound-controls')) {
    volumeOpen = false;
    volumeSliderWrap.classList.remove('show');
  }
});

// Volume slider
volumeSlider.addEventListener('input', () => {
  bgmVolume = volumeSlider.value / 100;
  if (bgmVolume > 0) {
    bgmEnabled = true;
    soundEnabled = true;
    soundToggle.textContent = '🔊';
    bgm.play().catch(() => {});
    fadeBGM(bgmVolume, 100);
  } else {
    bgmEnabled = false;
    soundEnabled = false;
    soundToggle.textContent = '🔇';
    pauseBGM();
  }
});

// Start BGM on page load
bgm.volume = 0.5;
bgm.play().catch(() => {});
