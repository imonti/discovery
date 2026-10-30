import { createProjectPane } from "../utils/createProjectPane.js";

const noiseTypes = [
  "2D Perlin",
  "2D Simplex",
  "3D Value",
  "3D Perlin"
]

const settings = {
  noiseType: "3D Perlin",
  noiseScale: 4,
  textureSize: 16,
  u: 0,
  v: 0,
  w: 0,
};

const { pane, configFolder } = createProjectPane("Noise", {
  description: "Explore procedural noise textures and sampling coordinates.",
});

const noiseScaleConfig = {
  min: 1,
  max: 512,
  step: 0.5,
  label: "scale",
};

const textureParams = configFolder.addFolder({ title: "texture" });

textureParams.addBinding(settings, "noiseType", {
  label: "type",
  options: noiseTypes.map(type => ({ text: type, value: type }))
});

textureParams.addBinding(settings, "noiseScale", noiseScaleConfig);

textureParams.addBinding(settings, "textureSize", {
  label: "texture size",
  min: 2,
  max: 1024,
  step: 1,
});

const coordParams = configFolder.addFolder({ title: "coordinates" });
const textureCoordsConfig = {
  min: -2,
  max: 2,
  step: 0.01,
};

coordParams.addBinding(settings, "u", textureCoordsConfig);
coordParams.addBinding(settings, "v", textureCoordsConfig);
coordParams.addBinding(settings, "w", textureCoordsConfig);

export { pane, settings, textureParams, coordParams };
