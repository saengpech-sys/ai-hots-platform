#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const distDir = path.resolve(process.cwd(), 'dist')
if (!fs.existsSync(distDir)) {
  console.error('dist not found – run build first')
  process.exit(1)
}
const version = {
  buildTime: new Date().toISOString(),
  hash: Math.random().toString(36).slice(2, 10),
}
fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(version, null, 2))
console.log('Wrote version.json', version)
