// Build-only source inspection; keep filesystem APIs out of the browser-shared seo-policy module.
import { readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { canonicalPath, isIndexablePage } from './seo-policy.mjs'

export function sourceIsIndexable(input, docsRoot) {
  if (!isIndexablePage(input)) return false
  const canonical = canonicalPath(input).slice(1)
  const name = canonical.endsWith('/') || !canonical ? `${canonical}index.md` : canonical.replace(/\.html$/, '.md')
  const root = resolve(docsRoot)
  const file = resolve(root, name)
  if (relative(root, file).startsWith('..')) return false
  let source
  try { source = readFileSync(file, 'utf8') } catch { return true } // Preserve non-Markdown generated routes.
  const frontmatter = source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || ''
  // Author-facing boolean and generated withdrawal marker are explicit build contracts.
  // Conservatively omit alternates when frontmatter declares a robots noindex directive.
  return !/^noindex:\s*(?:true|["']true["'])(?:\s*(?:#.*)?)?$/mi.test(frontmatter)
    && !/^translationStatus:\s*withdrawn-pending-update\s*$/m.test(frontmatter)
    && !/\bcontent\s*:\s*[^\r\n]*\bnoindex\b/i.test(frontmatter)
}
