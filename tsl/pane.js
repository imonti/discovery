import { createProjectPane } from '../utils/createProjectPane.js';

const { pane, configFolder } = createProjectPane('TSL Sphere', {
  project: 'tsl',
  description: 'Explore TSL foliage and procedural grid shading.',
});

export { pane, configFolder }
