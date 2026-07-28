import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sdk = readFileSync(resolve(root, 'src/utils/microi.v8.js'), 'utf8')
const nativeField = readFileSync(resolve(root, 'src/components/mci-native-field/mci-native-field.vue'), 'utf8')
const mediaUploader = readFileSync(resolve(root, 'src/components/mci-media-uploader/mci-media-uploader.vue'), 'utf8')
const hdfs = readFileSync(resolve(root, '../Microi.Server/Microi.HDFS/MicroiHDFS.cs'), 'utf8')

assert.match(sdk, /INTERACTIVE_UPLOAD_ROOTS\s*=\s*new Set\(\['file', 'img', 'avatar', 'editor'\]\)/)
assert.match(sdk, /action !== 'UniappUpload'/)
assert.match(sdk, /options\.preview === false \? 'file' : 'img'/)
assert.match(nativeField, /if \(this\.isAvatar\) return 'avatar'/)
assert.match(nativeField, /return this\.isImage \? 'img' : 'file'/)
assert.doesNotMatch(nativeField, /native\/\$\{String\(this\.tableName/)
assert.match(mediaUploader, /this\.mediaType === 'image' \? 'img' : 'file'/)
assert.match(hdfs, /DateTime\.Now\.ToString\("yyyyMM"\)/)
assert.doesNotMatch(hdfs, /DateTime\.Now\.ToString\("yyyyMMdd"\)/)

console.log('Microi UniApp upload path policy checks passed.')
