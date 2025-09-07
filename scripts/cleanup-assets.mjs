#!/usr/bin/env node
/**
 * Cleanup old hashed asset files while keeping the most recent N generations per logical chunk base.
 * Strategy:
 *   - Group files by logical base (e.g. aiService, index, LoginView, etc.). Base extracted as prefix before first dash for js; for css keep full before hash.
 *   - Sort each group by mtime desc.
 *   - Keep latest KEEP count (default 3) of each (including .js/.css plus any paired .gz/.br).
 *   - Remove older ones safely.
 *   - Skip vendor bundles if only one generation.
 *   - Dry-run supported with --dry.
 *
 * Usage: node scripts/cleanup-assets.mjs [--keep=3] [--dry]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const distAssetsDir = path.resolve(__dirname, '..', 'dist', 'assets')
if (!fs.existsSync(distAssetsDir)) {
  console.error('dist/assets not found. Build first.')
  process.exit(1)
}

// Parse CLI args
const args = process.argv.slice(2)
let KEEP = 3
let dry = false
for (const a of args) {
  if (a.startsWith('--keep=')) KEEP = parseInt(a.split('=')[1], 10) || KEEP
  if (a === '--dry') dry = true
}

// Helper: derive logical key grouping
function logicalKey(filename) {
  // Ignore source maps (if any) and non asset ext
  if (/\.map$/.test(filename)) return null
  // Remove compression suffix first for grouping
  const baseName = filename.replace(/\.(br|gz)$/, '')
  // Pattern: <name>-<hash>.ext
  const m = baseName.match(/^(.*?)-[A-Za-z0-9_-]{6,}\.([a-z0-9]+)$/)
  if (m) return `${m[1]}::${m[2]}` // separate ext to not mix js/css
  return null
}

// Collect files
const allFiles = fs.readdirSync(distAssetsDir)
const groups = new Map()
for (const f of allFiles) {
  const key = logicalKey(f)
  if (!key) continue
  if (!groups.has(key)) groups.set(key, [])
  const full = path.join(distAssetsDir, f)
  let stat
  try {
    stat = fs.statSync(full)
  } catch {
    continue
  }
  groups.get(key).push({ file: f, full, mtime: stat.mtimeMs })
}

let totalDeleted = 0
let totalCandidates = 0

for (const [key, entries] of groups.entries()) {
  // Consolidate by base WITHOUT compression so we delete compressed pairs together
  // Build a map from canonical (no .br/.gz) -> all variants
  const canonicalMap = new Map()
  for (const e of entries) {
    const canonical = e.file.replace(/\.(br|gz)$/, '')
    if (!canonicalMap.has(canonical)) canonicalMap.set(canonical, [])
    canonicalMap.get(canonical).push(e)
  }
  // Build array of canonical with newest mtime (max of variants)
  const canonicalArr = Array.from(canonicalMap.entries()).map(([canon, list]) => ({
    canon,
    variants: list,
    mtime: Math.max(...list.map((v) => v.mtime)),
  }))
  canonicalArr.sort((a, b) => b.mtime - a.mtime)
  if (canonicalArr.length <= KEEP) continue
  const remove = canonicalArr.slice(KEEP)
  totalCandidates += remove.length
  for (const r of remove) {
    for (const v of r.variants) {
      if (dry) {
        console.log('[dry] delete', v.file)
      } else {
        try {
          fs.unlinkSync(v.full)
          totalDeleted++
        } catch (e) {
          console.warn('Failed delete', v.file, e.message)
        }
      }
    }
  }
}

console.log(
  `Cleanup summary: groups=${groups.size} removedSets=${totalCandidates} filesDeleted=${totalDeleted} keep=${KEEP} dry=${dry}`,
)
