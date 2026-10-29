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
import { createProjectPane } from "../utils/createProjectPane.js";

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
  scene,
  ssaoEnabled,
  bloomPass,
) {
  const { pane, configFolder } = createProjectPane("Shadows", {
    description:
      "Explore soft directional shadows with PCSS, SSAO, bloom, and environment lighting.",
  });
  const settings = {
    toneMappingExposure: renderer.toneMappingExposure,
    ssaoEnabled: true,
    bloomEnabled: true,
    bloomStrength: bloomPass.strength.value,
    bloomRadius: bloomPass.radius.value,
  };
  const toneMappingFolder = configFolder.addFolder({ title: "Post Processing" });

  toneMappingFolder
    .addBlade({
      view: "list",
      label: "operator",
      options: toneMappingOptions,
      value: ACESFilmicToneMapping,
    })
    .on("change", ({ value }) => {
      renderer.toneMapping = value;
    });

  toneMappingFolder
    .addBinding(settings, "toneMappingExposure", {
      label: "exposure",
      min: 0.1,
      max: 5,
      step: 0.01,
    })
    .on("change", ({ value }) => {
      renderer.toneMappingExposure = value;
    });

  toneMappingFolder
    .addBinding(settings, "ssaoEnabled", {
      label: "SSAO",
    })
    .on("change", ({ value }) => {
      ssaoEnabled.value = value ? 1 : 0;
    });

  const bloomFolder = configFolder.addFolder({ title: "Bloom" });
  bloomFolder
    .addBinding(settings, "bloomEnabled", {
      label: "Enabled",
    })
    .on("change", ({ value }) => {
      bloomPass.strength.value = value ? settings.bloomStrength : 0;
    });

  bloomFolder
    .addBinding(settings, "bloomStrength", {
      label: "strength",
      view: "cameraring",
      series: 1,
      wide: true,
      min: 0,
      max: 3,
      unit: {
        pixels: 50,
        ticks: 10,
        value: 0.2
      }
    })
    .on("change", ({ value }) => {
      bloomPass.strength.value = settings.bloomEnabled ? value : 0;
    });

  bloomFolder
    .addBinding(settings, "bloomRadius", {
      label: "radius",
      view: "cameraring",
      series: 1,
      wide: true,
      min: 0,
      max: 1,
      unit: {
        pixels: 50,
        ticks: 10,
        value: 0.2
      }
    })
    .on("change", ({ value }) => {
      bloomPass.radius.value = value;
    });

  const environmentFolder = configFolder.addFolder({ title: "Environment" });
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

  const directionalLightFolder = configFolder.addFolder({
    title: "Directional light",
  });
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

  return { pane, configFolder, settings, lightSettings };
}
