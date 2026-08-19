import { Pane } from "tweakpane";

const threshold = {
  min: 0.60,
  max: 0.62,
};

const pane = new Pane();
const thresholdFolder = pane.addFolder({ title: "threshold" });

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
