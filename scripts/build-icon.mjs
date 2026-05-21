import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svg = readFileSync(join(root, 'resources', 'icon.svg'))

const sizes = [16, 32, 48, 64, 128, 256, 512]

console.log('Building icons...')

// PNG در سایزهای مختلف
for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(root, 'resources', `icon-${size}.png`))
  console.log(`  ✓ icon-${size}.png`)
}

// icon.png اصلی (256×256 برای electron-builder)
await sharp(svg)
  .resize(256, 256)
  .png()
  .toFile(join(root, 'resources', 'icon.png'))

console.log('  ✓ icon.png (256×256 - main)')
console.log('\nDone! Icons saved to resources/')
