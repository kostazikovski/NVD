import { Engine, Scene, Color4, Vector3, UniversalCamera } from "@babylonjs/core";
import "bootstrap/dist/css/bootstrap.min.css";
import "./style.css";

import { CONFIG } from "./config.js";
import { buildTrack } from "./track.js";
import { createPhysicsState, updatePhysics } from "./car.js";
import { state as inputState, initInput, resetInputState } from "./input.js";
import * as Hud from "./hud.js";
import { TRACKS } from "./tracks/index.js";
import { CARS } from "./cars/index.js";

const carSelectEl = document.getElementById("carSelect");
const carListEl = document.getElementById("carList");
const topbarEl = document.getElementById("topbar");
const hudEl = document.getElementById("hud");
const backToMenuBtnEl = document.getElementById("backToMenuBtn");

const track = TRACKS[0];

let activeSession = null;

CARS.forEach((car) => {
  const topSpeed = car.topSpeed ?? CONFIG.MAX_SPEED * 10;

  const col = document.createElement("div");
  col.className = "col";

  const card = document.createElement("div");
  card.className = "card h-100 shadow-sm car-card";
  card.setAttribute("role", "button");

  const thumb = document.createElement("div");
  thumb.className = "ratio ratio-16x9 bg-body-secondary";
  const fallback = document.createElement("span");
  fallback.className = "d-flex h-100 align-items-center justify-content-center fs-1 opacity-25";
  fallback.textContent = "🚗";
  thumb.appendChild(fallback);
  if (car.thumbnail) {
    const img = document.createElement("img");
    img.src = car.thumbnail;
    img.alt = car.name;
    img.className = "object-fit-cover";
    img.addEventListener("error", () => img.remove());
    thumb.appendChild(img);
  }
  card.appendChild(thumb);

  const body = document.createElement("div");
  body.className = "card-body d-flex flex-column";
  body.innerHTML = `
    <h3 class="h5 card-title">${car.name}</h3>
    <p class="card-text text-body-secondary small">${car.description}</p>
    ${car.sourceUrl ? `<a class="link-secondary small mb-2" href="${car.sourceUrl}" target="_blank" rel="noopener">Извор на моделот &#8599;</a>` : ""}
    <div class="d-flex justify-content-between align-items-center border-top pt-2 mt-auto">
      <span class="text-uppercase text-body-secondary" style="font-size:.7rem; letter-spacing:.03em;">Топ брзина</span>
      <strong class="text-primary">${topSpeed} km/h</strong>
    </div>
    <div class="play-hint text-primary small fw-semibold text-end mt-2">Избери &rarr;</div>
  `;
  card.appendChild(body);
  col.appendChild(card);

  const sourceLink = body.querySelector("a");
  if (sourceLink) sourceLink.addEventListener("click", (e) => e.stopPropagation());

  card.addEventListener("click", () => {
    carListEl.querySelectorAll(".car-card").forEach((c) => c.classList.remove("border-primary", "border-2"));
    card.classList.add("border-primary", "border-2");
    const hint = card.querySelector(".play-hint");
    hint.textContent = "Вчитувам...";
    card.classList.add("opacity-50", "pe-none");
    startGame(car, track);
  });
  carListEl.appendChild(col);
});

function resetCarCards() {
  carListEl.querySelectorAll(".car-card").forEach((c) => {
    c.classList.remove("border-primary", "border-2", "opacity-50", "pe-none");
    const hint = c.querySelector(".play-hint");
    if (hint) hint.textContent = "Избери →";
  });
}

function goToMenu() {
  if (activeSession) {
    activeSession.engine.stopRenderLoop();
    window.removeEventListener("resize", activeSession.onResize);
    activeSession.scene.dispose();
    activeSession.engine.dispose();
    activeSession = null;
  }

  resetInputState();
  Hud.hideFinish();
  Hud.resetDisplay(CONFIG.TOTAL_LAPS);
  resetCarCards();

  topbarEl.classList.add("d-none");
  hudEl.classList.add("d-none");
  backToMenuBtnEl.classList.add("d-none");
  carSelectEl.classList.remove("d-none");
}

Hud.onBackToMenu(goToMenu);

async function startGame(carDef, track) {
  const canvas = document.getElementById("renderCanvas");
  const engine = new Engine(canvas, true, { stencil: true }, true);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.53, 0.8, 0.98, 1);

  const { path, startPoint, startTangent, checkpoints } = buildTrack(scene, track.points);
  const carMesh = await carDef.build(scene);

  const startHeading = Math.atan2(startTangent.x, startTangent.z);
  carMesh.position = startPoint.clone();
  carMesh.rotation.y = startHeading;

  const camera = new UniversalCamera("cam", new Vector3(0, 5, -10), scene);
  camera.fov = 0.9;
  scene.activeCamera = camera;

  carSelectEl.classList.add("d-none");
  topbarEl.classList.remove("d-none");
  hudEl.classList.remove("d-none");
  backToMenuBtnEl.classList.remove("d-none");

  function nearestPathInfo(pos) {
    let bestDist = Infinity, bestIdx = 0;
    for (let i = 0; i < path.length; i++) {
      const d = Vector3.DistanceSquared(pos, path[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return { dist: Math.sqrt(bestDist), index: bestIdx };
  }

  const carMaxSpeed = (carDef.topSpeed ?? CONFIG.MAX_SPEED * 10) / 10;

  let physics = createPhysicsState(startPoint, startHeading, carMaxSpeed);
  let lap = 1;
  let lapStartTime = performance.now();
  let bestLap = null;
  let nextCheckpoint = 1;
  let lapReady = false;
  let finished = false;
  let running = false;

  function resetRace() {
    physics = createPhysicsState(startPoint, startHeading, carMaxSpeed);
    carMesh.rotation.y = startHeading;
    lap = 1;
    lapStartTime = performance.now();
    bestLap = null;
    nextCheckpoint = 1;
    lapReady = false;
    finished = false;
    running = false;
    Hud.resetBest();
    Hud.hideFinish();
    Hud.playCountdown(() => {
      lapStartTime = performance.now();
      running = true;
    });
  }

  Hud.onRestart(resetRace);
  initInput(resetRace);

  Hud.playCountdown(() => {
    lapStartTime = performance.now();
    running = true;
  });

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);

    if (running && !finished) {
      const info = nearestPathInfo(physics.pos);
      const onTrack = info.dist < CONFIG.ROAD_WIDTH / 2 + 1.2;

      updatePhysics(physics, inputState, dt, onTrack);

      const wallBoundary = CONFIG.ROAD_WIDTH / 2 + CONFIG.CURB_WIDTH;
      const afterInfo = nearestPathInfo(physics.pos);
      if (afterInfo.dist > wallBoundary) {
        const nearestPt = path[afterInfo.index];
        const outward = physics.pos.subtract(nearestPt);
        outward.y = 0;
        if (outward.lengthSquared() > 1e-6) {
          outward.normalize();
          physics.pos.copyFrom(nearestPt.add(outward.scale(wallBoundary)));
        }
        physics.speed *= CONFIG.CURB_BOUNCE;
      }

      carMesh.position.copyFrom(physics.pos);
      carMesh.rotation.y = physics.heading;

      if (!lapReady) {
        const cpIndex = checkpoints[nextCheckpoint];
        const cpPos = path[cpIndex];
        if (Vector3.Distance(physics.pos, cpPos) < CONFIG.ROAD_WIDTH) {
          nextCheckpoint++;
          if (nextCheckpoint >= checkpoints.length) {
            lapReady = true;
          }
        }
      } else if (Vector3.Distance(physics.pos, startPoint) < CONFIG.ROAD_WIDTH) {
        const now = performance.now();
        const lapTime = (now - lapStartTime) / 1000;
        if (bestLap === null || lapTime < bestLap) bestLap = lapTime;
        lapStartTime = now;
        nextCheckpoint = 1;
        lapReady = false;

        if (lap >= CONFIG.TOTAL_LAPS) {
          finished = true;
          Hud.showFinish(bestLap);
        } else {
          lap++;
        }
      }

      Hud.update({
        lap, totalLaps: CONFIG.TOTAL_LAPS,
        elapsed: (performance.now() - lapStartTime) / 1000,
        best: bestLap,
        speed: physics.speed
      });
    }

    const forward = new Vector3(Math.sin(physics.heading), 0, Math.cos(physics.heading));
    const desiredPos = physics.pos.subtract(forward.scale(11)).add(new Vector3(0, 6, 0));
    camera.position = Vector3.Lerp(camera.position, desiredPos, 0.08);
    const lookTarget = physics.pos.add(forward.scale(6)).add(new Vector3(0, 1, 0));
    camera.setTarget(lookTarget);
  });

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);
  activeSession = { engine, scene, onResize };

  engine.runRenderLoop(() => scene.render());
}
