export const state = { fwd: false, back: false, left: false, right: false, brake: false };

const keyMap = {
  "ArrowUp": "fwd", "KeyW": "fwd",
  "ArrowDown": "back", "KeyS": "back",
  "ArrowLeft": "left", "KeyA": "left",
  "ArrowRight": "right", "KeyD": "right",
  "Space": "brake"
};

let resetHandler = null;
let initialized = false;

export function initInput(onReset) {
  resetHandler = onReset;
  if (initialized) return;
  initialized = true;

  window.addEventListener("keydown", (e) => {
    if (keyMap[e.code]) { state[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === "KeyR" && resetHandler) resetHandler();
  });
  window.addEventListener("keyup", (e) => {
    if (keyMap[e.code]) { state[keyMap[e.code]] = false; e.preventDefault(); }
  });
}

export function resetInputState() {
  Object.keys(state).forEach((k) => { state[k] = false; });
}
