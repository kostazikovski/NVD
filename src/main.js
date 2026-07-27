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
  const engine = new Engine(canvas, true, { stencil: true }, false);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.53, 0.8, 0.98, 1);
  scene.skipPointerMovePicking = true;

  const trackResult = await buildTrack(scene, track.points);
  const { path, startPoint, startTangent, checkpoints, shadowGenerator } = trackResult;
  const carMesh = await carDef.build(scene);
  if (shadowGenerator) {
    carMesh.getChildMeshes().forEach((childMesh) => shadowGenerator.addShadowCaster(childMesh, false));
  }

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

  const CAM_DISTANCE = 11;
  const CAM_HEIGHT = 6;
  const CAM_LOOK_AHEAD = 6;
  const CAM_LOOK_HEIGHT = 1;
  const CAM_FOLLOW_RATE = 4.5;
  let camHeading = startHeading;

  let physics = createPhysicsState(startPoint, startHeading, carMaxSpeed);
  let lap = 1;
  let lapStartTime = performance.now();
  let bestLap = null;
  let nextCheckpoint = 1;
  let lapReady = false;
  let finished = false;
  let running = false;
  let prevStartSigned = -1;

  function resetRace() {
    physics = createPhysicsState(startPoint, startHeading, carMaxSpeed);
    carMesh.rotation.y = startHeading;
    camHeading = startHeading;
    lap = 1;
    lapStartTime = performance.now();
    bestLap = null;
    nextCheckpoint = 1;
    lapReady = false;
    finished = false;
    running = false;
    prevStartSigned = -1;
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

      const toStart = physics.pos.subtract(startPoint);
      const startSigned = Vector3.Dot(toStart, startTangent);
      const crossedStartLine =
        prevStartSigned < 0 && startSigned >= 0 && toStart.length() < CONFIG.ROAD_WIDTH * 1.5;

      if (!lapReady) {
        const cpIndex = checkpoints[nextCheckpoint];
        const cpPos = path[cpIndex];
        if (Vector3.Distance(physics.pos, cpPos) < CONFIG.ROAD_WIDTH) {
          nextCheckpoint++;
          if (nextCheckpoint >= checkpoints.length) {
            lapReady = true;
          }
        }
      } else if (crossedStartLine) {
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

      prevStartSigned = startSigned;

      Hud.update({
        lap, totalLaps: CONFIG.TOTAL_LAPS,
        elapsed: (performance.now() - lapStartTime) / 1000,
        best: bestLap,
        speed: physics.speed
      });
    }

    let headingDelta = physics.heading - camHeading;
    headingDelta = Math.atan2(Math.sin(headingDelta), Math.cos(headingDelta));
    const followAmount = 1 - Math.exp(-CAM_FOLLOW_RATE * dt);
    camHeading += headingDelta * followAmount;

    const camForward = new Vector3(Math.sin(camHeading), 0, Math.cos(camHeading));
    const desiredPos = physics.pos.subtract(camForward.scale(CAM_DISTANCE)).add(new Vector3(0, CAM_HEIGHT, 0));
    camera.position = Vector3.Lerp(camera.position, desiredPos, followAmount);
    const lookTarget = physics.pos.add(camForward.scale(CAM_LOOK_AHEAD)).add(new Vector3(0, CAM_LOOK_HEIGHT, 0));
    camera.setTarget(lookTarget);
  });

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);
  activeSession = { engine, scene, onResize };

  engine.runRenderLoop(() => scene.render());
}
