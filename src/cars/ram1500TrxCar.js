import { TransformNode, SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

const MODEL_ROTATION_Y = 0;
const TARGET_LENGTH = 5.85;

export const ram1500TrxCar = {
  id: "ram1500TrxCar",
  name: "Ram 1500 TRX '21",
  description: "Автор: Ddiaz Design",
  thumbnail: "/thumbnails/ram_1500_trx.png",
  topSpeed: 190,
  sourceUrl: "https://sketchfab.com/3d-models/2021-ram-1500-trx-372fbf37230c46eca1997841bfaf0758",

  async build(scene) {
    const car = new TransformNode("car", scene);

    const correction = new TransformNode("modelCorrection", scene);
    correction.parent = car;

    const result = await SceneLoader.ImportMeshAsync("", "/models/2021_ram_1500_trx/", "scene.gltf", scene);
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

    return car;
  }
};
