<template>
  <div class="layout-headerPanel">
    <el-row>
      <el-col :span="2">
        <el-icon class="lefticon" @click="pageEngineStore.changeLeft">
          <component
            :is="formData.JsonObj.formConfig.left == true ? Fold : Expand"
          ></component>
        </el-icon>
      </el-col>
      <el-col :span="6" class="colleft">
        <div contenteditable="false">
          <span>{{ title }} </span>
          <el-icon style="margin-left: 5px; color: #67c23a" :size="16">
            <MagicStick />
          </el-icon></div
      ></el-col>
      <el-col :span="8" class="main">
        <el-button-group>
          <el-tooltip content="页面数据可视化">
            <el-button size="small" :icon="Tickets" @click="showJsonClick"
              >查看JSON</el-button
            >
          </el-tooltip>
          <el-tooltip content="清空当前页面所有容器和组件">
            <el-button size="small" :icon="Delete" @click="clearClick"
              >清空画布</el-button
            >
          </el-tooltip>
          <el-tooltip content="简单排版，供参考学习">
            <el-button
              size="small"
              :loading="btnLoading"
              :icon="Star"
              @click="mockClick(0)"
              >模板1</el-button
            >
          </el-tooltip>
          <el-tooltip content="简单排版，供参考学习">
            <el-button
              size="small"
              :loading="btnLoading"
              :icon="Star"
              @click="mockClick(1)"
              >模板2</el-button
            >
          </el-tooltip>
          <el-tooltip content="简单排版，供参考学习">
            <el-button
              size="small"
              :loading="btnLoading"
              :icon="Star"
              @click="mockClick(2)"
              >模板3</el-button
            >
          </el-tooltip>
          <!-- <el-tooltip content="简单排版，供参考学习">
            <el-button
              size="small"
              :loading="btnLoading"
              :icon="Star"
              @click="mockClick(3)"
              >模板4</el-button
            >
          </el-tooltip> -->
          <!-- <el-tooltip content="临时保存页面数据到缓存">
            <el-button
              size="small"
              :loading="btnLoading"
              :icon="Lock"
              @click="lockClick()"
              >锁定</el-button
            >
          </el-tooltip>
          <el-tooltip content="清除数据缓存">
            <el-button
              size="small"
              :loading="btnLoading"
              :icon="Unlock"
              @click="unLockClick()"
              >解锁</el-button
            >
          </el-tooltip> -->
        </el-button-group>
      </el-col>
      <el-col :span="4">
        <div>
          <el-button
            type="success"
            size="small"
            plain
            :icon="View"
            round
            @click="previewClick"
            >预览</el-button
          >
          <el-button
            type="primary"
            size="small"
            plain
            :loading="btnLoading"
            @click="saveClick"
            :icon="Collection"
            >保存</el-button
          >
        </div>
      </el-col>
      <el-col :span="4" style="text-align: right">
        <el-tooltip content="切换主题模式">
          <el-switch
            @change="darkChange"
            v-model="isDark"
            style="
              --el-switch-on-color: #e6a23c;
              --el-switch-off-color: #409eff;
              margin-right: 10px;
            "
            :active-action-icon="Moon"
            :inactive-action-icon="Sunny"
          />
        </el-tooltip>
        <el-tooltip content="会清除页面所有缓存和自定义设置">
          <el-button size="small" type="info" text @click="setIni"
            >初始化配置 <el-icon class="el-icon--right"><Setting /></el-icon
          ></el-button>
        </el-tooltip>
      </el-col>
    </el-row>
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
const title = ref('界面设计引擎 v1.3.7')

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
  line-height: 60px;
  // background-color: #fff;
  box-shadow: 0 0px 1px 0 #999;
  text-align: center;
  .lefticon {
    font-size: 18px;
    cursor: pointer;
    color: #66b1ff;
  }
  .colleft {
    text-align: left;
    span {
      font-size: 0.9rem;
      letter-spacing: 1px;
      text-align: center;
      line-height: 1em;
      background-image: linear-gradient(90deg, #409eff, #67c23a);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      outline: none;
      // text-shadow: 0 0 4px #409eff;
    }
    i {
      font-size: 14px;
      font-weight: 500;
      margin-right: 5px;
    }
  }
}
</style>
