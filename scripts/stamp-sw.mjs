// Tamponne la version du service worker à chaque build.
// Remplace la ligne `const VERSION = '...'` par un identifiant unique (date)
// afin que le fichier sw.js change à chaque déploiement → le navigateur
// détecte la nouvelle version et met l'app à jour sans réinstallation.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const swPath = join(__dirname, '..', 'public', 'sw.js')

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
let src = readFileSync(swPath, 'utf8')
src = src.replace(
  /const VERSION = '[^']*'/,
  `const VERSION = 'meello-sw-${stamp}'`
)
writeFileSync(swPath, src)
console.log(`[stamp-sw] VERSION = meello-sw-${stamp}`)
