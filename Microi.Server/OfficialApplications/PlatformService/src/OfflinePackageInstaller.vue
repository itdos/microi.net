<template>
  <main class="offline-installer">
    <section class="offline-installer__intro">
      <div class="offline-installer__icon">⇧</div>
      <div>
        <strong>安装应用离线包</strong>
        <p>支持普通应用，以及 Web、UniApp、前端微服务等 AI 应用离线包。提交后由后台任务安装，可在右上角通知中心查看进度。</p>
      </div>
    </section>

    <section class="offline-installer__card">
      <label
        class="offline-upload"
        :class="{ 'is-dragging': dragging }"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <input type="file" accept=".json,application/json" @change="onFileChange" />
        <b>{{ file ? '重新选择离线包' : '点击选择或拖入离线包 JSON' }}</b>
        <span>选择后会先校验格式并展示应用名称、版本和类型，不会立即安装</span>
      </label>

      <div v-if="packageInfo" class="offline-package-meta">
        <div><span>文件</span><strong :title="file?.name">{{ file?.name }}</strong></div>
        <div><span>大小</span><strong>{{ formatSize(file?.size) }}</strong></div>
        <div><span>应用</span><strong :title="packageName">{{ packageName }}</strong></div>
        <div><span>版本</span><strong>{{ packageVersion }}</strong></div>
        <div><span>包类型</span><strong>{{ packageType }}</strong></div>
        <div><span>格式版本</span><strong>{{ packageInfo.SchemaVersion || packageInfo.PackageVersion || '-' }}</strong></div>
      </div>

      <p v-if="error" class="offline-installer__error">{{ error }}</p>
      <p class="offline-installer__notice">安装会修改当前租户的表结构、菜单、接口引擎和应用文件。正式环境操作前请确认数据库与文件存储已完成备份。</p>

      <footer>
        <button class="button button--ghost" type="button" :disabled="submitting" @click="cancel">取消</button>
        <button class="button button--primary" type="button" :disabled="!packageModel || submitting" @click="submit">
          <span v-if="submitting" class="spinner"></span>{{ submitting ? '正在提交' : '开始后台安装' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { configureV8, dispatch } from './microi.js'

const file = ref(null)
const packageModel = ref(null)
const packageInfo = ref(null)
const error = ref('')
const dragging = ref(false)
const submitting = ref(false)

const packageName = computed(() => packageInfo.value?.Name || packageInfo.value?.PackageName || file.value?.name || '-')
const packageVersion = computed(() => packageInfo.value?.Version || packageInfo.value?.AppVersion || '-')
const packageType = computed(() => {
  if (!packageModel.value) return '-'
  const bundles = []
  if (packageModel.value.ApplicationBundle) bundles.push(packageModel.value.ApplicationBundle)
  if (Array.isArray(packageModel.value.ApplicationBundles)) bundles.push(...packageModel.value.ApplicationBundles)
  if (!bundles.length) return '普通应用'
  const types = [...new Set(bundles.map(item => item?.ApplicationType || item?.Application?.AppType).filter(Boolean))]
  return `AI 应用${types.length ? `（${types.join(' / ')}）` : ''}`
})

function formatSize(value) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function selectFile(nextFile) {
  error.value = ''
  packageModel.value = null
  packageInfo.value = null
  file.value = nextFile || null
  if (!nextFile) return
  try {
    const text = await nextFile.text()
    const parsed = JSON.parse(text || '{}')
    if (!parsed || typeof parsed !== 'object' || !parsed.PackageInfo) {
      throw new Error('离线包格式不正确：缺少 PackageInfo')
    }
    packageModel.value = parsed
    packageInfo.value = parsed.PackageInfo
  } catch (currentError) {
    error.value = `无法读取离线包：${currentError?.message || currentError}`
  }
}

function onFileChange(event) { selectFile(event.target.files?.[0]) }
function onDrop(event) {
  dragging.value = false
  selectFile(event.dataTransfer?.files?.[0])
}

async function submit() {
  if (!packageModel.value || !file.value || submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const V8 = configureV8()
    const result = await V8.post('/apiengine/platform-background-task', {
      Action: 'RunApiEngine',
      TargetApiEngineKey: 'import-microi-store-package',
      Param: { Package: packageModel.value, PackageFileName: file.value.name },
      Title: `安装离线包应用：${packageName.value}`
    })
    if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '后台任务创建失败')
    dispatch('app-dialog:success', {
      ...result,
      PackageName: packageName.value,
      PackageType: packageType.value,
      message: '离线包安装任务已提交，请在右上角通知中心查看进度。'
    })
  } catch (currentError) {
    error.value = currentError?.message || String(currentError)
    dispatch('app-dialog:error', { message: error.value })
  } finally {
    submitting.value = false
  }
}

function cancel() { dispatch('app-dialog:cancel') }
</script>
