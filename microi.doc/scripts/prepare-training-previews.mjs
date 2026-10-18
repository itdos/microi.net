import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { trainingPreviewAssets } from '../docs/.vitepress/theme/training-previews.js'
import { prepareDocAssets } from './prepare-doc-assets.mjs'

// 全新检出也必须独立拉取并逐件验签当前114张预览；不能依赖发布电脑已有缓存。
export async function prepareTrainingPreviews(options = {}) {
  return prepareDocAssets({ ...options, assets: trainingPreviewAssets })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const records = await prepareTrainingPreviews()
  console.log(JSON.stringify({ files: records.length, totalBytes: records.reduce((total, asset) => total + asset.bytes, 0) }))
}
