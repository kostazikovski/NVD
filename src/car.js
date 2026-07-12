import { Vector3, Scalar } from "@babylonjs/core";
import { CONFIG } from "./config.js";

export function createPhysicsState(startPoint, startHeading, maxSpeed = CONFIG.MAX_SPEED) {
  return {
    pos: startPoint.clone(),
    heading: startHeading,
    speed: 0,
    maxSpeed,
  };
}

export function updatePhysics(state, input, dt, onTrack) {
  const maxSpeed = onTrack ? state.maxSpeed : Math.min(state.maxSpeed, CONFIG.GRASS_MAX_SPEED);
  const friction = onTrack ? CONFIG.FRICTION : CONFIG.GRASS_FRICTION;

  if (input.fwd) state.speed += CONFIG.ACCEL * dt;
  else if (input.back) state.speed -= CONFIG.BRAKE_DECEL * dt;
  else {
    if (state.speed > 0) state.speed = Math.max(0, state.speed - friction * dt);
    else if (state.speed < 0) state.speed = Math.min(0, state.speed + friction * dt);
  }
  if (input.brake) {
    if (state.speed > 0) state.speed = Math.max(0, state.speed - CONFIG.BRAKE_DECEL * dt);
    else state.speed = Math.min(0, state.speed + CONFIG.BRAKE_DECEL * dt);
  }
  state.speed = Math.max(-CONFIG.MAX_REVERSE, Math.min(maxSpeed, state.speed));

  const steerFactor = Scalar.Clamp(Math.abs(state.speed) / 6, 0, 1);
  const dir = state.speed >= 0 ? 1 : -1;
  if (input.left) state.heading -= CONFIG.STEER_RATE * dt * steerFactor * dir;
  if (input.right) state.heading += CONFIG.STEER_RATE * dt * steerFactor * dir;

  const forward = new Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  state.pos.addInPlace(forward.scale(state.speed * dt));
}
