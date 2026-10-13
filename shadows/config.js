import { Pane } from "tweakpane";
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  MathUtils,
  NeutralToneMapping,
  NoToneMapping,
  ReinhardToneMapping,
} from "three";

const toneMappingOptions = [
  { text: "None", value: NoToneMapping },
  { text: "Linear", value: LinearToneMapping },
  { text: "Reinhard", value: ReinhardToneMapping },
  { text: "Cineon", value: CineonToneMapping },
  { text: "ACES Filmic", value: ACESFilmicToneMapping },
  { text: "AgX", value: AgXToneMapping },
  { text: "Neutral", value: NeutralToneMapping },
];

export function createConfig(
  renderer,
  directionalLight,
  shadowMaterial,
  camera,
  scene,
  ssaoEnabled,
  bloomPass,
) {
  const pane = new Pane({ title: "Tone mapping" });
  const settings = {
    toneMappingExposure: renderer.toneMappingExposure,
    ssaoEnabled: true,
    bloomStrength: bloomPass.strength.value,
    bloomRadius: bloomPass.radius.value,
  };

  pane
    .addBlade({
      view: "list",
      label: "operator",
      options: toneMappingOptions,
      value: ACESFilmicToneMapping,
    })
    .on("change", ({ value }) => {
      renderer.toneMapping = value;
    });

  pane
    .addBinding(settings, "toneMappingExposure", {
      label: "exposure",
      min: 0.1,
      max: 5,
      step: 0.01,
    })
    .on("change", ({ value }) => {
      renderer.toneMappingExposure = value;
    });

  pane
    .addBinding(settings, "ssaoEnabled", {
      label: "SSAO",
    })
    .on("change", ({ value }) => {
      ssaoEnabled.value = value ? 1 : 0;
    });

  const bloomFolder = pane.addFolder({ title: "Bloom" });
  bloomFolder
    .addBinding(settings, "bloomStrength", {
      label: "strength",
      min: 0,
      max: 3,
      step: 0.01,
    })
    .on("change", ({ value }) => {
      bloomPass.strength.value = value;
    });

  bloomFolder
    .addBinding(settings, "bloomRadius", {
      label: "radius",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", ({ value }) => {
      bloomPass.radius.value = value;
    });

  pane
    .addButton({ title: "Log camera position" })
    .on("click", () => {
      const { x, y, z } = camera.position;
      console.log(
        `camera.position.set(${x.toFixed(6)}, ${y.toFixed(6)}, ${z.toFixed(6)});`,
      );
    });

  const environmentFolder = pane.addFolder({ title: "Environment" });
  const environmentSettings = {
    rotationY: MathUtils.radToDeg(scene.backgroundRotation.y),
    intensity: scene.environmentIntensity,
  };

  environmentFolder
    .addBinding(environmentSettings, "rotationY", {
      label: "rot-y",
      min: -180,
      max: 180,
      step: 1,
    })
    .on("change", ({ value }) => {
      const rotation = MathUtils.degToRad(value);
      scene.backgroundRotation.y = rotation;
      scene.environmentRotation.y = rotation;
    });

  environmentFolder
    .addBinding(environmentSettings, "intensity", {
      min: 0,
      max: 2,
      step: 0.01,
    })
    .on("change", ({ value }) => {
      scene.environmentIntensity = value;
    });

  const directionalLightFolder = pane.addFolder({ title: "Directional light" });
  const lightSettings = {
    intensity: directionalLight.intensity,
    color: `#${directionalLight.color.getHexString()}`,
  };
  const shadowSettings = {
    opacity: shadowMaterial.opacity,
    color: `#${shadowMaterial.color.getHexString()}`,
    radius: directionalLight.shadow.radius,
  };
  directionalLightFolder
    .addBinding(lightSettings, "intensity", {
      min: 0,
      max: 2,
      step: 0.1,
    })
    .on("change", ({ value }) => {
      directionalLight.intensity = value;
    });

  directionalLightFolder
    .addBinding(lightSettings, "color", {
      view: "color",
    })
    .on("change", ({ value }) => {
      directionalLight.color.set(value);
    });

  directionalLightFolder
    .addBinding(shadowSettings, "opacity", {
      label: "shadow opacity",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", ({ value }) => {
      shadowMaterial.opacity = value;
    });

  directionalLightFolder
    .addBinding(shadowSettings, "color", {
      label: "shadow color",
      view: "color",
    })
    .on("change", ({ value }) => {
      shadowMaterial.color.set(value);
    });

  directionalLightFolder
    .addBinding(shadowSettings, "radius", {
      label: "shadow radius",
      min: 0,
      max: 50,
      step: 0.1,
    })
    .on("change", ({ value }) => {
      directionalLight.shadow.radius = value;
    });

  const lightPositionSettings = {
    rotationY: MathUtils.radToDeg(
      Math.atan2(directionalLight.position.x, directionalLight.position.z),
    ),
  };
  const lightRadius = Math.hypot(
    directionalLight.position.x,
    directionalLight.position.z,
  );
  const lightHeight = directionalLight.position.y;

  directionalLightFolder
    .addBinding(lightPositionSettings, "rotationY", {
      label: "rot-y",
      min: -180,
      max: 180,
      step: 1,
    })
    .on("change", ({ value }) => {
      const rotation = MathUtils.degToRad(value);
      directionalLight.position.set(
        Math.sin(rotation) * lightRadius,
        lightHeight,
        Math.cos(rotation) * lightRadius,
      );
    });

  return { settings, lightSettings };
}
