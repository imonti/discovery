import { Pane } from 'tweakpane'

export function createConfig(normalVariation, leafLightContrast) {
  const pane = new Pane({ title: 'Bush' })
  const settings = {
    normalVariation: normalVariation.value,
    leafLightContrast: leafLightContrast.value,
  }

  pane
    .addBinding(settings, 'normalVariation', {
      label: 'normal variation',
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on('change', ({ value }) => {
      normalVariation.value = value
    })

  pane
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
