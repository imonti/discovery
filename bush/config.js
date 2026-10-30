import { createProjectPane } from '../utils/createProjectPane.js'

export function createConfig(normalVariation, leafLightContrast) {
  const { pane, configFolder } = createProjectPane('Bush', {
    description: 'Explore procedural leaf clusters and environment lighting.',
  })
  const settings = {
    normalVariation: normalVariation.value,
    leafLightContrast: leafLightContrast.value,
  }

  configFolder
    .addBinding(settings, 'normalVariation', {
      label: 'normal variation',
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on('change', ({ value }) => {
      normalVariation.value = value
    })

  configFolder
    .addBinding(settings, 'leafLightContrast', {
      label: 'leaf light contrast',
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on('change', ({ value }) => {
      leafLightContrast.value = value
    })

  return { pane, settings }
}
