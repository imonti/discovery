import { createProjectPane } from "../utils/createProjectPane.js";

let config = null;
let configFolder = null;

/**
 * Create the shared Bones project pane.
 *
 * The controls owned by TreeScene and Windvane are added to the returned
 * configFolder. Keeping the pane creation here makes the Bones demo use the
 * same project navigation and footer as the other demos.
 */
function createConfig() {
  if (config !== null) return config;

  config = createProjectPane("Bones", {
    description:
      `Exploration of how I would implement wind animation on a deforming tree rigged with bones.
      The leaves used in this project are the result of the experiments in project "Bush".`,
  });
  configFolder = config.configFolder;

  return config;
}

export { configFolder, createConfig };
