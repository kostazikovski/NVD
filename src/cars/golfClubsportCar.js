import { TransformNode, SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

const MODEL_ROTATION_Y = 0;
const TARGET_LENGTH = 4.29;

export const golfClubsportCar = {
  id: "golfClubsportCar",
  name: "VW Golf GTI Clubsport Mk7",
  description: "Автор: Ddiaz Design",
  thumbnail: "/thumbnails/golf_clubsport_mk7.png",
  topSpeed: 265,
  sourceUrl: "https://sketchfab.com/3d-models/2016-volkswagen-golf-gti-clubsport-mk7-492301d401ea4fb7bb1cb63e980051d0",

  async build(scene) {
    const car = new TransformNode("car", scene);

    const correction = new TransformNode("modelCorrection", scene);
    correction.parent = car;

    const result = await SceneLoader.ImportMeshAsync("", "/models/2016_volkswagen_golf_gti_clubsport_mk7/", "scene.gltf", scene);
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
