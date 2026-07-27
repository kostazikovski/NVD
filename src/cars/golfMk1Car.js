import { TransformNode, SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

const MODEL_ROTATION_Y = 0;
const TARGET_LENGTH = 3.82;

export const golfMk1Car = {
  id: "golfMk1Car",
  name: "VW Golf GTI Mk1 '76",
  description: "Автор: Ddiaz Design",
  thumbnail: "/thumbnails/golf_mk1.png",
  topSpeed: 175,
  sourceUrl: "https://sketchfab.com/3d-models/1976-volkswagen-golf-gti-mk1-1fc46cb37bd748e3bb9355fcedaf3817",

  async build(scene) {
    const car = new TransformNode("car", scene);

    const correction = new TransformNode("modelCorrection", scene);
    correction.parent = car;

    const result = await SceneLoader.ImportMeshAsync("", "/models/1976_volkswagen_golf_gti_mk1/", "scene.gltf", scene);
    const root = result.meshes[0];
    root.parent = correction;

    const bounds1 = root.getHierarchyBoundingVectors(true);
    const size = bounds1.max.subtract(bounds1.min);
    const longestHorizontal = Math.max(size.x, size.z) || 1;
    root.scaling.scaleInPlace(TARGET_LENGTH / longestHorizontal);

    const bounds2 = root.getHierarchyBoundingVectors(true);
    root.position.y -= bounds2.min.y;
    root.position.x -= (bounds2.min.x + bounds2.max.x) / 2;
    root.position.z -= (bounds2.min.z + bounds2.max.z) / 2;

    correction.rotation.y = MODEL_ROTATION_Y;

    root.getChildMeshes().forEach((mesh) => {
      if (mesh.material) mesh.material.freeze();
    });

    return car;
  }
};
