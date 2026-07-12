const lapVal = document.getElementById("lapVal");
const timeVal = document.getElementById("timeVal");
const bestVal = document.getElementById("bestVal");
const speedVal = document.getElementById("speedVal");
const finishScreen = document.getElementById("finishScreen");
const finishSummary = document.getElementById("finishSummary");
const countdownEl = document.getElementById("countdown");

export function update({ lap, totalLaps, elapsed, best, speed }) {
  lapVal.textContent = Math.min(lap, totalLaps) + "/" + totalLaps;
  timeVal.textContent = elapsed.toFixed(1);
  bestVal.textContent = best !== null ? best.toFixed(1) : "--";
  speedVal.textContent = Math.round(Math.abs(speed) * 10);
}

export function resetDisplay(totalLaps) {
  lapVal.textContent = "1/" + totalLaps;
  timeVal.textContent = "0.0";
  bestVal.textContent = "--";
  speedVal.textContent = "0";
}

export function showFinish(bestLap) {
  finishSummary.textContent = "Најдобар круг: " + (bestLap ? bestLap.toFixed(1) + "s" : "--");
  finishScreen.style.display = "flex";
}

export function hideFinish() {
  finishScreen.style.display = "none";
}

export function resetBest() {
  bestVal.textContent = "--";
}

let countdownInterval = null;

export function playCountdown(onDone) {
  if (countdownInterval) clearInterval(countdownInterval);

  const steps = ["3", "2", "1", "СТАРТ!"];
  let i = 0;
  countdownEl.style.display = "flex";
  countdownEl.textContent = steps[i];
  countdownInterval = setInterval(() => {
    i++;
    if (i < steps.length) {
      countdownEl.textContent = steps[i];
    } else {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownEl.style.display = "none";
      onDone();
    }
  }, 700);
}

let restartHandler = null;
let restartBound = false;

export function onRestart(callback) {
  restartHandler = callback;
  if (restartBound) return;
  restartBound = true;
  document.getElementById("restartBtn").addEventListener("click", () => {
    if (restartHandler) restartHandler();
  });
}

let backToMenuHandler = null;
let backToMenuBound = false;

export function onBackToMenu(callback) {
  backToMenuHandler = callback;
  if (backToMenuBound) return;
  backToMenuBound = true;
  document.querySelectorAll(".back-to-menu-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (backToMenuHandler) backToMenuHandler();
    });
  });
}
