import { createProjectPane } from "../utils/createProjectPane.js";

const threshold = {
  min: 0.60,
  max: 0.62,
};

const { pane, configFolder } = createProjectPane("Raymarch", {
  description: "Explore raymarched volumes and density thresholds.",
});
const thresholdFolder = configFolder.addFolder({ title: "threshold" });

thresholdFolder.addBinding(threshold, "min", {
  min: 0,
  max: 1,
  step: 0.02,
});

thresholdFolder.addBinding(threshold, "max", {
  min: 0,
  max: 1,
  step: 0.02,
});

export { pane, threshold, thresholdFolder };
