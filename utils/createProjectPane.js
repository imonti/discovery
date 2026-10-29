import * as CamerakitPlugin from "@tweakpane/plugin-camerakit";
import { Pane } from "tweakpane";
import { paragraphPlugin } from "./tweakpaneParagraphPlugin.js";

const exposedProjects = [
  "valley",
  "bones",
  "bush",
  "shadows",
  "noise",
  "raymarch",
  "dithering",
];

export function createProjectPane(title, options = {}) {
  const {
    description,
    expanded = true,
    project = title.toLowerCase(),
    ...paneOptions
  } = options;
  const pane = new Pane(paneOptions);
  pane.registerPlugin(CamerakitPlugin);
  pane.registerPlugin(paragraphPlugin);

  const projectSelectorFolder = pane.addFolder({
    title: "Project",
  });
  const projectNavigation = projectSelectorFolder
    .addBlade({
      view: "list",
      options: exposedProjects.map((projectName) => ({
        text: projectName,
        value: projectName,
      })),
      value: project,
    })
    .on("change", ({ value }) => {
      if (value === project) {
        return;
      }

      window.location.assign(new URL(`../${value}/`, window.location.href));
    });
  if (description) {
    projectSelectorFolder.addBlade({
      view: "paragraph",
      text: description,
    });
  }
  const configFolder = pane.addFolder({ title: "Lab ⚙︎", expanded });
  pane.addBlade({ view: "separator" });
  const footer = pane.addBlade({
    view: "paragraph",
    text: "Ivo Monti\nComputer Graphics Engeneer",
  });

  return {
    pane,
    configFolder,
    footer,
    projectSelectorFolder,
    projectNavigation,
  };
}
