import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const configFiles = [
  'docs/.vitepress/config/shared.ts',
  'docs/.vitepress/config/zh.ts',
  'docs/.vitepress/config/en.ts'
]

for (const relativePath of configFiles) {
  const source = await readFile(new URL(relativePath, root), 'utf8')
  assert.match(
    source,
    /appearance\s*:\s*["']dark["']/,
    `${relativePath} must keep appearance: 'dark'`
  )
}

const html = await readFile(new URL('docs/.vitepress/dist/index.html', root), 'utf8')
const match = html.match(/<script\s+id=["']check-dark-mode["'][^>]*>([\s\S]*?)<\/script>/i)
assert.ok(match, 'built index.html must contain VitePress check-dark-mode pre-paint script')

const prePaintScript = match[1]

function runPrePaint({ storedTheme = null, prefersDark = false } = {}) {
  const classes = new Set()
  const context = {
    document: {
      documentElement: {
        classList: {
          add(value) {
            classes.add(value)
          }
        }
      }
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, 'vitepress-theme-appearance')
        return storedTheme
      }
    },
    window: {
      matchMedia(query) {
        assert.equal(query, '(prefers-color-scheme: dark)')
        return { matches: prefersDark }
      }
    }
  }

  vm.runInNewContext(prePaintScript, context)
  return classes.has('dark')
}

assert.equal(
  runPrePaint({ prefersDark: false }),
  true,
  'a first visit must be dark even when the operating system prefers light'
)
assert.equal(
  runPrePaint({ storedTheme: 'light', prefersDark: true }),
  false,
  'an explicit saved light preference must remain light'
)
assert.equal(
  runPrePaint({ storedTheme: 'dark', prefersDark: false }),
  true,
  'an explicit saved dark preference must remain dark'
)

console.log('Default-dark production pre-paint contract passed.')
