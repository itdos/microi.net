<template>
  <div class="layout-headerPanel">
    <div class="header-accent-bar"></div>
    <div class="header-body">
      <div class="header-section header-left">
        <el-icon class="lefticon" @click="pageEngineStore.changeLeft">
          <component
            :is="formData.JsonObj.formConfig.left == true ? Fold : Expand"
          ></component>
        </el-icon>
        <div class="header-brand">
          <span class="brand-text">{{ title }}</span>
          <el-icon class="brand-icon" :size="15"><MagicStick /></el-icon>
        </div>
      </div>
      <div class="header-section header-center">
        <div class="toolbar-group">
          <el-tooltip content="页面数据可视化" placement="bottom">
            <el-button size="small" text :icon="Tickets" @click="showJsonClick">JSON</el-button>
          </el-tooltip>
          <el-tooltip content="清空所有容器和组件" placement="bottom">
            <el-button size="small" text :icon="Delete" @click="clearClick">清空</el-button>
          </el-tooltip>
          <el-dropdown trigger="click" @command="mockClick" :teleported="true">
            <el-button size="small" text :loading="btnLoading" :icon="Star">
              模板<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="0"><el-icon><Star /></el-icon>模板 1</el-dropdown-item>
                <el-dropdown-item :command="1"><el-icon><Star /></el-icon>模板 2</el-dropdown-item>
                <el-dropdown-item :command="2"><el-icon><Star /></el-icon>模板 3</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <el-divider direction="vertical" class="header-divider" />
        <el-button type="success" size="small" plain :icon="View" @click="previewClick" round>预览</el-button>
        <el-button type="primary" size="small" :loading="btnLoading" @click="saveClick" :icon="Collection" round>保存</el-button>
      </div>
      <div class="header-section header-right">
        <el-tooltip content="切换主题模式" placement="bottom">
          <el-switch
            @change="darkChange"
            v-model="isDark"
            class="theme-switch"
            :active-action-icon="Moon"
            :inactive-action-icon="Sunny"
          />
        </el-tooltip>
        <el-tooltip content="初始化页面配置" placement="bottom">
          <el-button size="small" type="info" text :icon="Setting" @click="setIni" circle />
        </el-tooltip>
      </div>
    </div>
  </div>
  <el-drawer title="页面JSON" v-model="jsonDrawer" direction="ltr">
    <el-form>
      <el-form-item label="">
        <JsonEditor
          v-if="jsonDrawer"
          height="680px"
          v-model="curPageJson"
          :option="jsonEditorOption"
        />
      </el-form-item>
    </el-form>
  </el-drawer>

  <el-dialog
    @closed="closeDialog"
    top="5vh"
    title="预览页面"
    width="90%"
    v-model="dialogFormVisible"
    draggable
    align-center
  >
    <form-renderer
      :isPrivew="dialogFormVisible"
      v-if="dialogFormVisible"
    ></form-renderer>
  </el-dialog>
</template>

<script setup name="layout-header">
import { nextTick, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { EventBus } from '../../../utils/eventBus.js'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { ElMessageBox, ElNotification, ElLoading } from 'element-plus'
import { useDark } from '@vueuse/core'
import formRenderer from '../../form-renderer/index.vue'
import {
  Moon,
  Sunny,
  Fold,
  Expand,
  InfoFilled,
  QuestionFilled,
  FullScreen,
  View,
  Collection,
  Tickets,
  ScaleToOriginal,
  Delete,
  Setting,
  Star,
  Lock,
  Unlock,
  ArrowDown,
} from '@element-plus/icons-vue'
import JsonEditor from 'ceel-json-editor'
import 'jsoneditor/dist/jsoneditor.css'

// 动态导入新文件
const importTempData = async (index) => {
  switch (index) {
    case 0:
      return (await import('../../../mocks/temp0')).temp0
    case 1:
      return (await import('../../../mocks/temp1')).temp1
    case 2:
      return (await import('../../../mocks/temp2')).temp2
    default:
      return null
  }
}

const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)
const btnLoading = ref(false)

//页面标题
const title = ref('界面引擎')

//是否暗黑模式
const isDark = useDark()
isDark.value = pageEngineStore.dark == 'true' || pageEngineStore.dark == true

//json在线编辑器
const jsonEditorOption = {
  mode: 'code',
  onChange: (v) => {
    // console.log(v)
  },
}

//切换主题
const darkChange = () => {
  pageEngineStore.setDark(isDark.value)
}

//预览
const dialogFormVisible = ref(false)
const previewClick = () => {
  dialogFormVisible.value = true
}

//关闭预览时恢复设置
const closeDialog = () => {
  formData.value.JsonObj.formConfig.mask = true
  formData.value.JsonObj.formConfig.drag = true
  formData.value.JsonObj.formConfig.hover = true
  formData.value.JsonObj.formConfig.link = false
  dialogFormVisible.value = false
}

//保存事件

const saveClick = () => {
  btnLoading.value = true
  ElNotification({
    type: 'warning',
    title: '提示',
    message: '保存成功!',
    duration: 2000,
    onClose: () => {
      btnLoading.value = false
    },
  })

  // 平台将使用事件总线形式来实现穿透交互.
  EventBus.emit('saveFormJson', formData.value)
  // 在发送方，我们需要将响应式数据转换为普通对象
  const dataToSend = JSON.stringify(formData.value)
  // 通过 postMessage 方式向父窗口通信
  window.parent.postMessage({ key: 'saveFormJson', value: dataToSend }, '*')
  //清除缓存
  localStorage.removeItem('page_formData')
}

const jsonDrawer = ref(false)
const showJsonClick = () => {
  jsonDrawer.value = true
}

//当前组件json
const curPageJson = computed({
  get() {
    return JSON.stringify(formData.value, null, '  ')
  },
  set(newValue) {
    try {
      const parsed = JSON.parse(newValue)
      // 更新 curWidget 的值，假设 curWidget 是响应式的 ref 或 pinia store 的响应式属性
      Object.assign(formData.value, parsed)
    } catch (e) {
      console.error('JSON 解析失败')
    }
  },
})

//清空组件
const clearClick = () => {
  ElMessageBox.confirm('是否清空当前画布所有容器和组件?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.clearWrapper()
      //清除缓存
      localStorage.removeItem('page_formData')
      ElNotification({
        type: 'success',
        title: '提示',
        message: '画布已清空',
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
    }).canel
}

//初始化当前页面，
const setIni = () => {
  ElMessageBox.confirm('是否初始化当前页面配置吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.setIni()
      ElNotification({
        type: 'success',
        title: '提示',
        message: '页面已初始化',
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
    })
}

//是否切换模板1
const mockClick = (index) => {
  ElMessageBox.confirm('是否切换模板吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      const loadingInstance = ElLoading.service({ fullscreen: true })
      btnLoading.value = true

      let mockData = await importTempData(index)
      formData.value.JsonObj = { ...mockData.JsonObj }

      nextTick(() => {
        btnLoading.value = false
        loadingInstance.close()
      })
      ElNotification({
        type: 'success',
        title: '提示',
        message: '已切换模板' + (index + 1),
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
      btnLoading.value = false
    })
}
</script>

<style lang="scss" scoped>
.layout-headerPanel {
  position: relative;

  .header-accent-bar {
    height: 3px;
    background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-success), var(--el-color-warning));
  }

  .header-body {
    display: flex;
    align-items: center;
    height: 53px;
    padding: 0 16px;
    background-color: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-lighter);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
    transition: all 0.3s;
    gap: 12px;
  }

  .header-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-left {
    flex: 0 0 auto;
    gap: 12px;
  }

  .header-center {
    flex: 1;
    justify-content: center;
    gap: 8px;
  }

  .header-right {
    flex: 0 0 auto;
    gap: 12px;
    .ve__button.is-circle{
      width: 32px;
      height: 32px;
    }
  }

  .lefticon {
    font-size: 18px;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s;
    &:hover {
      color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
    }
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    .brand-text {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background-image: linear-gradient(135deg, var(--el-color-primary), var(--el-color-success));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      white-space: nowrap;
    }
    .brand-icon {
      color: var(--el-color-success);
      animation: sparkle 2s ease-in-out infinite;
    }
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
    padding: 2px 4px;
    gap: 2px;
    transition: background-color 0.3s;
  }

  .header-divider {
    height: 20px;
    margin: 0 4px;
  }

  .theme-switch {
    --el-switch-on-color: #e6a23c;
    --el-switch-off-color: #409eff;
  }
}

@keyframes sparkle {
  0%, 100% { opacity: 1; transform: rotate(0deg); }
  50% { opacity: 0.6; transform: rotate(15deg); }
}
</style>
