
import { optimize } from 'svgo'
import { promises as fs } from 'fs'

const fileName = './valley.svg'

const svgString = await fs.readFile(fileName, 'utf8')

const optimizedSvgString = optimize(svgString, {
    path: fileName,
    multipass: true,
    plugins: [
        {
            name: 'preset-default',
            params: {
                overrides: {
                    cleanupIds: false
                }
            }
        }
    ],
    js2svg: {
        indent: '  ',
        pretty: true,
    },
})

await fs.writeFile(fileName, optimizedSvgString.data, 'utf8');