import {
  Vector3, Curve3, Mesh, MeshBuilder,
  StandardMaterial, Color3, DynamicTexture,
  HemisphericLight, DirectionalLight, Texture
} from "@babylonjs/core";
import { CONFIG } from "./config.js";

function loadRoadTexture(scene) {
  const tex = new Texture("/textures/road.jpg", scene);
  tex.uScale = 18;
  tex.vScale = 1;
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function loadGrassTexture(scene) {
  const tex = new Texture("/textures/grass.jpg", scene);
  tex.uScale = 80;
  tex.vScale = 80;
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function makeCurbTexture(scene) {
  const size = 128;
  const tex = new DynamicTexture("curbTex", size, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = "#d81e1e";
  ctx.fillRect(0, 0, size / 2, size);
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(size / 2, 0, size / 2, size);
  tex.update();
  tex.uScale = 120;
  tex.vScale = 1;
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function buildSkybox(scene) {
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 900, sideOrientation: Mesh.BACKSIDE }, scene);
  const mat = new StandardMaterial("skyMat", scene);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  const tex = new DynamicTexture("skyGrad", { width: 4, height: 512 }, scene, false);
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#3a7bd5");
  grad.addColorStop(0.55, "#8fc6f0");
  grad.addColorStop(1, "#dff1ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  tex.update();
  mat.emissiveTexture = tex;
  sky.material = mat;
  sky.infiniteDistance = true;
  return sky;
}

export function buildTrack(scene, trackPoints) {
  buildSkybox(scene);

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0.2), scene);
  hemi.intensity = 0.9;
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.4), scene);
  sun.intensity = 0.55;
  sun.position = new Vector3(80, 120, -60);

  const ground = MeshBuilder.CreateGround("ground", { width: 500, height: 500 }, scene);
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseTexture = loadGrassTexture(scene);
  groundMat.specularColor = new Color3(0, 0, 0);
  ground.material = groundMat;

  const path = Curve3.CreateCatmullRomSpline(trackPoints, 24, true).getPoints();
  // CreateCatmullRomSpline(..., true) appends a closing point identical to path[0].
  // Left as-is, the wrap-around segment has zero length, which zeroes out the
  // tangent/normal there and collapses the road/curb/wall to the centerline
  // right at the start/finish seam. Drop the duplicate so every segment,
  // including the one that wraps back to index 0, has a real direction.
  if (path.length > 1 && Vector3.DistanceSquared(path[path.length - 1], path[0]) < 1e-6) {
    path.pop();
  }

  // Use a central-difference tangent (prev -> next, not just cur -> next) at every
  // point. A forward-difference tangent puts the *entire* direction change of the
  // closing segment onto a single face where the ribbon loops back to index 0,
  // which shows up as a visible pinch/gap right at the start/finish line even
  // though the total curvature there is no sharper than other bends in the track
  // (those bends spread the same turn over many faces instead of one). Central
  // difference spreads it out the same way everywhere, including the seam.
  const normals = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[(i - 1 + path.length) % path.length];
    const next = path[(i + 1) % path.length];
    const tangent = next.subtract(prev).normalize();
    normals.push(new Vector3(-tangent.z, 0, tangent.x));
  }

  const left = [], right = [];
  const half = CONFIG.ROAD_WIDTH / 2;
  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    const normal = normals[i];
    left.push(cur.add(normal.scale(half)).add(new Vector3(0, 0.03, 0)));
    right.push(cur.subtract(normal.scale(half)).add(new Vector3(0, 0.03, 0)));
  }
  left.push(left[0]);
  right.push(right[0]);

  const road = MeshBuilder.CreateRibbon("road", {
    pathArray: [left, right],
    closeArray: false,
    closePath: false,
    sideOrientation: Mesh.DOUBLESIDE
  }, scene);
  const roadMat = new StandardMaterial("roadMat", scene);
  roadMat.diffuseTexture = loadRoadTexture(scene);
  roadMat.specularColor = new Color3(0.05, 0.05, 0.05);
  road.material = roadMat;

  const curbMat = new StandardMaterial("curbMat", scene);
  curbMat.diffuseTexture = makeCurbTexture(scene);
  curbMat.specularColor = new Color3(0.1, 0.1, 0.1);
  const curbWidth = CONFIG.CURB_WIDTH;
  const curbBaseY = 0.06;
  const curbHeight = 0.16;
  [1, -1].forEach((side) => {
    const innerBottom = [], innerTop = [], outerTop = [], outerBottom = [];
    for (let i = 0; i < path.length; i++) {
      const cur = path[i];
      const normal = normals[i].scale(side);
      const inner = cur.add(normal.scale(half));
      const outer = cur.add(normal.scale(half + curbWidth));
      innerBottom.push(inner.add(new Vector3(0, curbBaseY, 0)));
      innerTop.push(inner.add(new Vector3(0, curbBaseY + curbHeight, 0)));
      outerTop.push(outer.add(new Vector3(0, curbBaseY + curbHeight, 0)));
      outerBottom.push(outer.add(new Vector3(0, curbBaseY, 0)));
    }
    [innerBottom, innerTop, outerTop, outerBottom].forEach((row) => row.push(row[0]));
    const curb = MeshBuilder.CreateRibbon("curb" + side, {
      pathArray: [innerBottom, innerTop, outerTop, outerBottom],
      closeArray: false,
      closePath: false,
      sideOrientation: Mesh.DOUBLESIDE
    }, scene);
    curb.material = curbMat;
  });

  const fenceMat = new StandardMaterial("fenceMat", scene);
  fenceMat.diffuseColor = new Color3(0.72, 0.72, 0.74);
  fenceMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const wallInnerOffset = half + curbWidth + 0.6;
  const wallThickness = 0.4;
  const wallHeight = 1.3;
  const wallBaseY = 0.05;
  [1, -1].forEach((side) => {
    const innerBottom = [], innerTop = [], outerTop = [], outerBottom = [];
    for (let i = 0; i < path.length; i++) {
      const cur = path[i];
      const normal = normals[i].scale(side);
      const inner = cur.add(normal.scale(wallInnerOffset));
      const outer = cur.add(normal.scale(wallInnerOffset + wallThickness));
      innerBottom.push(inner.add(new Vector3(0, wallBaseY, 0)));
      innerTop.push(inner.add(new Vector3(0, wallBaseY + wallHeight, 0)));
      outerTop.push(outer.add(new Vector3(0, wallBaseY + wallHeight, 0)));
      outerBottom.push(outer.add(new Vector3(0, wallBaseY, 0)));
    }
    [innerBottom, innerTop, outerTop, outerBottom].forEach((row) => row.push(row[0]));
    const wall = MeshBuilder.CreateRibbon("wall" + side, {
      pathArray: [innerBottom, innerTop, outerTop, outerBottom],
      closeArray: false,
      closePath: false,
      sideOrientation: Mesh.DOUBLESIDE
    }, scene);
    wall.material = fenceMat;
  });

  const startPoint = path[0];
  const startTangent = path[1].subtract(path[0]).normalize();
  const startLine = MeshBuilder.CreateGround("startLine", { width: CONFIG.ROAD_WIDTH, height: 1.2 }, scene);
  startLine.position = startPoint.add(new Vector3(0, 0.05, 0));
  startLine.rotation.y = Math.atan2(startTangent.x, startTangent.z);
  const checkerMat = new StandardMaterial("checkerMat", scene);
  checkerMat.diffuseColor = new Color3(1, 1, 1);
  checkerMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  startLine.material = checkerMat;

  const checkpoints = [];
  const step = Math.floor(path.length / CONFIG.CHECKPOINT_COUNT);
  for (let i = 0; i < CONFIG.CHECKPOINT_COUNT; i++) {
    checkpoints.push(i * step);
  }

  return { path, startPoint, startTangent, checkpoints, road, ground };
}
