import {
  Vector3, Matrix, Curve3, Mesh, MeshBuilder,
  StandardMaterial, Color3, DynamicTexture,
  HemisphericLight, DirectionalLight, Texture,
  ShadowGenerator, Scene
} from "@babylonjs/core";
import { CONFIG } from "./config.js";

const TRACKSIDE_GAP = 1.4;
const TREE_STEP = 1;
const HILL_COUNT = 14;
const HILL_RADIUS = 230;

const GROUND_SIZE = 4000;
const GRASS_TILE_SIZE = 500 / 80;

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
  const tileScale = GROUND_SIZE / GRASS_TILE_SIZE;
  tex.uScale = tileScale;
  tex.vScale = tileScale;
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
  mat.fogEnabled = false;

  const size = { width: 256, height: 512 };
  const tex = new DynamicTexture("skyGrad", size, scene, false);
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, size.height);
  grad.addColorStop(0, "#2f6fc9");
  grad.addColorStop(0.45, "#8fc6f0");
  grad.addColorStop(0.75, "#d9edfb");
  grad.addColorStop(1, "#eef7ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  const cloudBands = [{ y: 80, count: 5 }, { y: 135, count: 4 }, { y: 190, count: 6 }];
  cloudBands.forEach((band) => {
    for (let i = 0; i < band.count; i++) {
      const cx = Math.random() * size.width;
      const cy = band.y + (Math.random() * 16 - 8);
      const r = 22 + Math.random() * 30;
      for (let j = 0; j < 5; j++) {
        const ox = (Math.random() - 0.5) * r * 1.6;
        const oy = (Math.random() - 0.5) * r * 0.4;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, r * 0.6, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  tex.update();

  mat.emissiveTexture = tex;
  sky.material = mat;
  sky.infiniteDistance = true;
  mat.freeze();
  return sky;
}

function buildDistantHills(scene) {
  const hillPalette = [
    new Color3(0.58, 0.64, 0.70),
    new Color3(0.50, 0.58, 0.66),
    new Color3(0.45, 0.53, 0.58),
    new Color3(0.52, 0.60, 0.57),
    new Color3(0.60, 0.56, 0.52),
    new Color3(0.63, 0.63, 0.73),
  ];
  const hillMats = hillPalette.map((color, idx) => {
    const mat = new StandardMaterial("hillMat" + idx, scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.72);
    mat.specularColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    return mat;
  });

  const snowMat = new StandardMaterial("hillSnowMat", scene);
  snowMat.diffuseColor = new Color3(0.93, 0.95, 0.98);
  snowMat.emissiveColor = new Color3(0.72, 0.74, 0.78);
  snowMat.specularColor = new Color3(0, 0, 0);
  snowMat.disableLighting = true;

  const SNOWLINE_HEIGHT = 115;
  const slotAngle = (Math.PI * 2) / HILL_COUNT;

  const parts = [];
  const footprints = [];
  for (let i = 0; i < HILL_COUNT; i++) {
    const angle = i * slotAngle + (Math.random() - 0.5) * slotAngle * 0.7;
    const isBackRow = Math.random() < 0.3;
    const radius = HILL_RADIUS + (isBackRow ? 55 + Math.random() * 55 : 0) + (Math.random() * 30 - 15);
    const height = 55 + Math.random() * 105;
    const width = 60 + Math.random() * 50;
    const hx = Math.sin(angle) * radius;
    const hz = Math.cos(angle) * radius;

    const coolToneIdx = [1, 2, 5];
    const looksFar = isBackRow || height > 115;
    const matIdx = looksFar
      ? coolToneIdx[Math.floor(Math.random() * coolToneIdx.length)]
      : Math.floor(Math.random() * hillMats.length);
    const hillMat = hillMats[matIdx];

    const hill = MeshBuilder.CreateCylinder("hill" + i, {
      diameterTop: 0, diameterBottom: width, height, tessellation: 10
    }, scene);
    hill.position.set(hx, height / 2 - 6, hz);
    hill.material = hillMat;
    parts.push(hill);

    const groundRadius = (width / 2) * (1 - 6 / height);
    footprints.push({ x: hx, z: hz, radius: groundRadius });

    if (height > SNOWLINE_HEIGHT) {
      const capHeight = height * 0.22;
      const cap = MeshBuilder.CreateCylinder("hillCap" + i, {
        diameterTop: 0, diameterBottom: width * 0.26, height: capHeight, tessellation: 9
      }, scene);
      cap.position.set(hx, height - 6 + capHeight * 0.32, hz);
      cap.material = snowMat;
      parts.push(cap);
    }
  }
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  merged.isPickable = false;
  merged.receiveShadows = false;
  return { mesh: merged, footprints };
}

function buildProceduralTree(scene) {
  const trunkMat = new StandardMaterial("procTrunkMat", scene);
  trunkMat.diffuseColor = new Color3(0.42, 0.29, 0.16);
  trunkMat.specularColor = new Color3(0, 0, 0);

  const foliageMat = new StandardMaterial("procFoliageMat", scene);
  foliageMat.diffuseColor = new Color3(0.16, 0.43, 0.19);
  foliageMat.specularColor = new Color3(0, 0, 0);

  const trunk = MeshBuilder.CreateCylinder("procTrunk", {
    diameterTop: 0.14, diameterBottom: 0.24, height: 1.1, tessellation: 6
  }, scene);
  trunk.position.y = 0.55;
  trunk.material = trunkMat;

  const foliage = MeshBuilder.CreateCylinder("procFoliage", {
    diameterTop: 0, diameterBottom: 1.7, height: 2.6, tessellation: 7
  }, scene);
  foliage.position.y = 1.1 + 1.2;
  foliage.material = foliageMat;

  const tree = Mesh.MergeMeshes([trunk, foliage], true, true, undefined, false, true);
  tree.isPickable = false;
  trunkMat.freeze();
  foliageMat.freeze();
  tree.freezeWorldMatrix();
  return tree;
}

function buildCabin(scene, x, z, rotY) {
  const wallMat = new StandardMaterial("cabinWallMat" + Math.round(x) + "_" + Math.round(z), scene);
  wallMat.diffuseColor = new Color3(0.45, 0.32, 0.20);
  wallMat.specularColor = new Color3(0, 0, 0);

  const roofMat = new StandardMaterial("cabinRoofMat" + Math.round(x) + "_" + Math.round(z), scene);
  roofMat.diffuseColor = new Color3(0.32, 0.15, 0.13);
  roofMat.specularColor = new Color3(0, 0, 0);

  const body = MeshBuilder.CreateBox("cabinBody", { width: 5, height: 3, depth: 4 }, scene);
  body.position.y = 1.5;
  body.material = wallMat;

  const roof = MeshBuilder.CreateCylinder("cabinRoof", {
    diameterTop: 0, diameterBottom: 6.5, height: 2.2, tessellation: 4
  }, scene);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3 + 1.1;
  roof.material = roofMat;

  const chimney = MeshBuilder.CreateBox("cabinChimney", { width: 0.6, height: 1.4, depth: 0.6 }, scene);
  chimney.position.set(1.2, 3 + 1.6, 0.8);
  chimney.material = wallMat;

  const cabin = Mesh.MergeMeshes([body, roof, chimney], true, true, undefined, false, true);
  cabin.position.set(x, 0, z);
  cabin.rotation.y = rotY;
  cabin.isPickable = false;
  cabin.receiveShadows = true;
  wallMat.freeze();
  roofMat.freeze();
  cabin.freezeWorldMatrix();
  return cabin;
}

function buildLake(scene, x, z, radius) {
  const lake = MeshBuilder.CreateDisc("lake", { radius, tessellation: 40 }, scene);
  lake.rotation.x = Math.PI / 2;
  lake.position.set(x, 0.04, z);
  const lakeMat = new StandardMaterial("lakeMat", scene);
  lakeMat.diffuseColor = new Color3(0.18, 0.35, 0.5);
  lakeMat.emissiveColor = new Color3(0.10, 0.22, 0.32);
  lakeMat.specularColor = new Color3(0.6, 0.7, 0.75);
  lakeMat.specularPower = 64;
  lake.material = lakeMat;
  lake.isPickable = false;
  lake.receiveShadows = true;
  lakeMat.freeze();
  lake.freezeWorldMatrix();
  return lake;
}

function pickFeatureClearings(path, hillFootprints, clearance, maxRadius) {
  const specs = [
    { type: "lake", radius: 28 },
    { type: "cabin", radius: 14 },
    { type: "cabin", radius: 14 },
  ];
  const features = [];

  specs.forEach((spec) => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const x = (Math.random() * 2 - 1) * maxRadius;
      const z = (Math.random() * 2 - 1) * maxRadius;
      if (x * x + z * z > maxRadius * maxRadius) continue;

      let nearestDistSq = Infinity;
      for (let i = 0; i < path.length; i++) {
        const dx = path[i].x - x;
        const dz = path[i].z - z;
        const d = dx * dx + dz * dz;
        if (d < nearestDistSq) nearestDistSq = d;
      }
      const minClearFromTrack = clearance + spec.radius + 45;
      if (nearestDistSq < minClearFromTrack * minClearFromTrack) continue;

      let blocked = false;
      for (let h = 0; h < hillFootprints.length; h++) {
        const hill = hillFootprints[h];
        const dx = hill.x - x;
        const dz = hill.z - z;
        const minDist = hill.radius + spec.radius + 6;
        if (dx * dx + dz * dz < minDist * minDist) { blocked = true; break; }
      }
      if (blocked) continue;

      for (let f = 0; f < features.length; f++) {
        const other = features[f];
        const dx = other.x - x;
        const dz = other.z - z;
        const minDist = other.radius + spec.radius + 20;
        if (dx * dx + dz * dz < minDist * minDist) { blocked = true; break; }
      }
      if (blocked) continue;

      features.push({ x, z, radius: spec.radius, type: spec.type });
      break;
    }
  });

  return features;
}

function treeInstanceMatrix(x, z, rotY, scaleXZ, scaleY) {
  return Matrix.Scaling(scaleXZ, scaleY, scaleXZ)
    .multiply(Matrix.RotationY(rotY))
    .multiply(Matrix.Translation(x, 0, z));
}

function addProceduralTreeInstance(procTree, x, z, rotY, scaleXZ, scaleY) {
  const matrix = treeInstanceMatrix(x, z, rotY, scaleXZ, scaleY);
  procTree.thinInstanceAdd(matrix, false);
}

function scatterTrackside(scene, path, normals, outerOffset, procTree) {
  const n = path.length;

  for (let i = 0; i < n; i += TREE_STEP) {
    [1, -1].forEach((side) => {
      const jitter = TRACKSIDE_GAP + Math.random() * 5;
      const pos = path[i].add(normals[i].scale(side * (outerOffset + jitter)));
      const rotY = Math.random() * Math.PI * 2;
      const scale = 0.6 + Math.random() * 0.85;
      const scaleY = scale * (0.8 + Math.random() * 0.4);
      addProceduralTreeInstance(procTree, pos.x, pos.z, rotY, scale, scaleY);
    });
  }
}

const NEAR_BELT_OFFSETS = [7, 12, 18, 25, 33, 42];
function scatterNearBelt(scene, path, normals, outerOffset, procTree, hillFootprints, featureClearings) {
  const footprints = hillFootprints || [];
  const features = featureClearings || [];
  const n = path.length;

  for (let i = 0; i < n; i++) {
    [1, -1].forEach((side) => {
      NEAR_BELT_OFFSETS.forEach((baseOffset) => {
        const offset = outerOffset + baseOffset + (Math.random() - 0.5) * 4;
        const alongJitter = Math.round((Math.random() - 0.5) * 1.6);
        const idx = Math.min(n - 1, Math.max(0, i + alongJitter));
        const pos = path[idx].add(normals[idx].scale(side * offset));

        let blocked = false;
        for (let h = 0; h < footprints.length; h++) {
          const hill = footprints[h];
          const dx = hill.x - pos.x, dz = hill.z - pos.z;
          const minDist = hill.radius + 5;
          if (dx * dx + dz * dz < minDist * minDist) { blocked = true; break; }
        }
        if (blocked) return;
        for (let f = 0; f < features.length; f++) {
          const feat = features[f];
          const dx = feat.x - pos.x, dz = feat.z - pos.z;
          const minDist = feat.radius + 4;
          if (dx * dx + dz * dz < minDist * minDist) { blocked = true; break; }
        }
        if (blocked) return;

        const rotY = Math.random() * Math.PI * 2;
        const scale = 0.5 + Math.random() * 1.6;
        const scaleY = scale * (0.75 + Math.random() * 0.5);
        addProceduralTreeInstance(procTree, pos.x, pos.z, rotY, scale, scaleY);
      });
    });
  }
}

function scatterForest(scene, path, procTree, clearance, count, maxRadius, hillFootprints, featureClearings) {
  const footprints = hillFootprints || [];
  const features = featureClearings || [];
  const HILL_MARGIN = 5;
  const FEATURE_MARGIN = 4;

  const area = Math.PI * maxRadius * maxRadius;
  const cellSize = Math.sqrt(area / count);
  const gridExtent = Math.ceil(maxRadius / cellSize);

  let placed = 0;
  for (let gi = -gridExtent; gi <= gridExtent; gi++) {
    for (let gj = -gridExtent; gj <= gridExtent; gj++) {
      const cellCenterX = gi * cellSize;
      const cellCenterZ = gj * cellSize;
      if (cellCenterX * cellCenterX + cellCenterZ * cellCenterZ > maxRadius * maxRadius) continue;

      for (let attempt = 0; attempt < 6; attempt++) {
        const useCenter = attempt === 5;
        const x = useCenter ? cellCenterX : cellCenterX + (Math.random() - 0.5) * cellSize;
        const z = useCenter ? cellCenterZ : cellCenterZ + (Math.random() - 0.5) * cellSize;
        if (x * x + z * z > maxRadius * maxRadius) continue;

        let nearestDistSq = Infinity;
        for (let i = 0; i < path.length; i++) {
          const dx = path[i].x - x;
          const dz = path[i].z - z;
          const d = dx * dx + dz * dz;
          if (d < nearestDistSq) nearestDistSq = d;
        }
        if (nearestDistSq < clearance * clearance) continue;

        let blocked = false;
        for (let h = 0; h < footprints.length; h++) {
          const hill = footprints[h];
          const dx = hill.x - x;
          const dz = hill.z - z;
          const minDist = hill.radius + HILL_MARGIN;
          if (dx * dx + dz * dz < minDist * minDist) { blocked = true; break; }
        }
        if (blocked) continue;

        for (let f = 0; f < features.length; f++) {
          const feat = features[f];
          const dx = feat.x - x;
          const dz = feat.z - z;
          const minDist = feat.radius + FEATURE_MARGIN;
          if (dx * dx + dz * dz < minDist * minDist) { blocked = true; break; }
        }
        if (blocked) continue;

        const rotY = Math.random() * Math.PI * 2;
        const scale = 0.35 + Math.random() * 2.6;
        const scaleY = scale * (0.7 + Math.random() * 0.7);
        addProceduralTreeInstance(procTree, x, z, rotY, scale, scaleY);
        placed++;
        break;
      }
    }
  }

  return placed;
}

export async function buildTrack(scene, trackPoints) {
  buildSkybox(scene);
  const hills = { mesh: null, footprints: [] };
  const procTree = buildProceduralTree(scene);

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.82, 0.9, 0.97);
  scene.fogStart = 200;
  scene.fogEnd = 460;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0.2), scene);
  hemi.intensity = 0.85;
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.4), scene);
  sun.intensity = 0.55;
  sun.position = new Vector3(80, 120, -60);

  const shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 24;
  shadowGenerator.setDarkness(0.3);

  const ground = MeshBuilder.CreateGround("ground", { width: GROUND_SIZE, height: GROUND_SIZE }, scene);
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseTexture = loadGrassTexture(scene);
  groundMat.specularColor = new Color3(0, 0, 0);
  ground.material = groundMat;
  ground.receiveShadows = true;
  groundMat.freeze();
  ground.freezeWorldMatrix();

  const path = Curve3.CreateCatmullRomSpline(trackPoints, 24, true).getPoints();
  if (path.length > 1 && Vector3.DistanceSquared(path[path.length - 1], path[0]) < 1e-6) {
    path.pop();
  }

  const normals = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[(i - 1 + path.length) % path.length];
    const next = path[(i + 1) % path.length];
    const tangent = next.subtract(prev).normalize();
    normals.push(new Vector3(-tangent.z, 0, tangent.x));
  }

  const half = CONFIG.ROAD_WIDTH / 2;
  const curbWidth = CONFIG.CURB_WIDTH;
  const wallThickness = 0.4;
  const wallInnerOffset = half + curbWidth + 0.6;
  const outerOffset = wallInnerOffset + wallThickness;

  const left = [], right = [];
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
  road.receiveShadows = true;
  roadMat.freeze();
  road.freezeWorldMatrix();

  const curbMat = new StandardMaterial("curbMat", scene);
  curbMat.diffuseTexture = makeCurbTexture(scene);
  curbMat.specularColor = new Color3(0.1, 0.1, 0.1);
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
    curb.receiveShadows = true;
    curb.freezeWorldMatrix();
  });
  curbMat.freeze();

  const fenceMat = new StandardMaterial("fenceMat", scene);
  fenceMat.diffuseColor = new Color3(0.72, 0.72, 0.74);
  fenceMat.specularColor = new Color3(0.05, 0.05, 0.05);
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
    wall.receiveShadows = true;
    wall.freezeWorldMatrix();
  });
  fenceMat.freeze();

  const forestClearance = outerOffset + TRACKSIDE_GAP;
  const forestMaxRadius = 430;
  const featureClearings = pickFeatureClearings(path, hills.footprints, forestClearance, forestMaxRadius);
  featureClearings.forEach((f) => {
    if (f.type === "lake") buildLake(scene, f.x, f.z, f.radius);
    else if (f.type === "cabin") buildCabin(scene, f.x, f.z, Math.random() * Math.PI * 2);
  });

  scatterTrackside(scene, path, normals, outerOffset, procTree);
  scatterNearBelt(scene, path, normals, outerOffset, procTree, hills.footprints, featureClearings);
  const openForestClearance = outerOffset + 48;
  scatterForest(scene, path, procTree, openForestClearance, 18000, forestMaxRadius, hills.footprints, featureClearings);
  procTree.thinInstanceRefreshBoundingInfo(false);

  const startPoint = path[0];
  const startTangent = path[1].subtract(path[0]).normalize();
  const startLine = MeshBuilder.CreateGround("startLine", { width: CONFIG.ROAD_WIDTH, height: 1.2 }, scene);
  startLine.position = startPoint.add(new Vector3(0, 0.05, 0));
  startLine.rotation.y = Math.atan2(startTangent.x, startTangent.z);
  const checkerMat = new StandardMaterial("checkerMat", scene);
  checkerMat.diffuseColor = new Color3(1, 1, 1);
  checkerMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  startLine.material = checkerMat;
  checkerMat.freeze();
  startLine.freezeWorldMatrix();

  const checkpoints = [];
  const step = Math.floor(path.length / CONFIG.CHECKPOINT_COUNT);
  for (let i = 0; i < CONFIG.CHECKPOINT_COUNT; i++) {
    checkpoints.push(i * step);
  }

  return { path, startPoint, startTangent, checkpoints, road, ground, shadowGenerator };
}
