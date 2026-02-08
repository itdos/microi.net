<template>
  <div v-if="curWidgetIdx > -1">
    <el-button
      size="small"
      type="success"
      plain
      class="btnJson"
      @click="drawerjson = true"
      >组件JSON</el-button
    >

    <el-collapse v-model="activeName" accordion>
      <el-collapse-item title="通用配置" name="1">
        <el-form>
          <el-form-item label="组件类型">
            <el-input
              disabled
              size="small"
              :model-value="curWidget.label"
            ></el-input>
          </el-form-item>

          <el-form-item label="组件编号">
            <el-input
              disabled
              size="small"
              :model-value="curWidget.widgetOption.number"
            ></el-input>
          </el-form-item>

          <el-form-item label="容器编号">
            <el-input
              disabled
              size="small"
              :model-value="curWidget.widgetOption.wrapperNumber"
            ></el-input>
          </el-form-item>

          <el-form-item label="栅格宽度">
            <el-input-number
              size="small"
              style="clear: both"
              :model-value="curWidget.widgetOption.span"
              @update:model-value="
                (val) => handleGeneralInputChange('widgetOption.span', val)
              "
              :min="0"
              :max="24"
              :step="1"
              label=""
            ></el-input-number>
          </el-form-item>

          <el-form-item label="" style="width: 90%">
            <el-slider
              :min="0"
              :max="24"
              :step="1"
              show-stops
              :model-value="curWidget.widgetOption.span"
              @update:model-value="
                (val) => handleGeneralInputChange('widgetOption.span', val)
              "
            >
            </el-slider>
          </el-form-item>

          <el-form-item label="组件高度">
            <el-input-number
              size="small"
              style="clear: both"
              :model-value="curWidget.widgetOption.height"
              @update:model-value="
                (val) => handleGeneralInputChange('widgetOption.height', val)
              "
              :min="0"
              :max="1920"
              :step="10"
              label=""
            ></el-input-number>
          </el-form-item>

          <!-- <el-form-item label="" style="width: 90%">
        <el-slider
          :min="0"
          :max="1920"
          :step="10"
          show-stops
          v-model="curWidget.widgetOption.height"
        >
        </el-slider>
      </el-form-item> -->

          <el-form-item label="组件上移">
            <el-input-number
              size="small"
              style="clear: both"
              :model-value="curWidget.widgetOption.marginTop"
              @update:model-value="
                (val) => handleGeneralInputChange('widgetOption.marginTop', val)
              "
              :step="10"
              :min="-1920"
              :max="0"
              label=""
            ></el-input-number>
          </el-form-item>

          <!-- <el-form-item label="" style="width: 90%">
        <el-slider
          :step="10"
          :min="-1920"
          :max="0"
          show-stops
          v-model="curWidget.widgetOption.marginTop"
        >
        </el-slider>
      </el-form-item> -->

          <el-form-item label="左侧间隔">
            <el-input-number
              size="small"
              style="clear: both"
              :model-value="curWidget.widgetOption.offset"
              @update:model-value="
                (val) => handleGeneralInputChange('widgetOption.offset', val)
              "
              :min="0"
              :max="24"
            ></el-input-number>
          </el-form-item>

          <el-form-item label="栅格右移">
            <el-input-number
              size="small"
              style="clear: both"
              :model-value="curWidget.widgetOption.push"
              @update:model-value="
                (val) => handleGeneralInputChange('widgetOption.push', val)
              "
              :min="0"
              :max="24"
            ></el-input-number>
          </el-form-item>

          <el-form-item label="栅格左移">
            <el-input-number
              size="small"
              style="clear: both"
              :model-value="curWidget.widgetOption.pull"
              @update:model-value="
                (val) => handleGeneralInputChange('widgetOption.pull', val)
              "
              :min="0"
              :max="24"
            ></el-input-number>
          </el-form-item>

          <el-form-item label="内边距值">
            <el-input
              size="small"
              :model-value="curWidget.widgetOption.dynamicStyle.padding"
              @input="
                (val) =>
                  handleGeneralInputChange(
                    'widgetOption.dynamicStyle.padding',
                    val
                  )
              "
            ></el-input>
          </el-form-item>

          <el-form-item label="背景颜色">
            <el-color-picker
              show-alpha
              size="small"
              :model-value="curWidget.widgetOption.dynamicStyle.backgroundColor"
              @update:model-value="
                (val) =>
                  handleGeneralInputChange(
                    'widgetOption.dynamicStyle.backgroundColor',
                    val
                  )
              "
            ></el-color-picker>
          </el-form-item>
        </el-form>
      </el-collapse-item>
      <el-collapse-item title="特色配置" name="2">
        <el-form label-position="left" label-width="80px">
          <el-form-item label="组件JSON"> </el-form-item>
        </el-form>

        <el-form label-position="left" label-width="80px">
          <!-- #####在这里面添加新组件代码属性,代码开始##### -->
          <template
            v-for="(item, index) in curWidget.widgetParams"
            :key="index"
          >
            <el-form-item :label="item.label">
              <template v-if="item.type === 'textarea'">
                <el-input
                  style="width: 166px"
                  :model-value="localInputValues[index] || item.value"
                  @input="handleInputChange(index, $event)"
                  type="textarea"
                  :rows="item.typeOptions.rows"
                  placeholder="请输入webapi地址"
                />
                <template v-if="index === 0">
                  <el-button
                    class="seeBtn"
                    size="small"
                    type="success"
                    plain
                    @click="getDataJson(item.typeOptions.dataJson, index)"
                    >查看数据格式</el-button
                  >
                  <el-button
                    style="margin-left: 0 !important"
                    class="seeBtn"
                    size="small"
                    type="warning"
                    plain
                    @click="getDataHtml(item.typeOptions.dataHtml, index)"
                    >查看Html代码</el-button
                  >
                </template>
              </template>

              <template v-else-if="item.type === 'input'">
                <el-input
                  :disabled="item.typeOptions?.disabled"
                  size="small"
                  :model-value="localInputValues[index] || item.value"
                  @input="handleInputChange(index, $event)"
                ></el-input>
              </template>

              <template v-else-if="item.type === 'number'">
                <el-input-number
                  size="small"
                  :model-value="localInputValues[index] || item.value"
                  @update:model-value="handleInputChange(index, $event)"
                  :min="item.typeOptions?.min"
                  :max="item.typeOptions?.max"
                  :step="item.typeOptions?.step"
                ></el-input-number>
              </template>

              <template v-else-if="item.type === 'color'">
                <el-color-picker
                  show-alpha
                  size="small"
                  :model-value="localInputValues[index] || item.value"
                  @update:model-value="handleInputChange(index, $event)"
                ></el-color-picker>
              </template>

              <template v-else-if="item.type === 'switch'">
                <el-switch
                  :model-value="localInputValues[index] || item.value"
                  @update:model-value="handleInputChange(index, $event)"
                  :disabled="item.typeOptions?.disabled"
                ></el-switch>
              </template>

              <template v-else-if="item.type === 'slider'">
                <el-slider
                  style="width: 90%"
                  show-stops
                  :model-value="localInputValues[index] || item.value"
                  @update:model-value="handleInputChange(index, $event)"
                  :min="item.typeOptions?.min"
                  :max="item.typeOptions?.max"
                  :step="item.typeOptions?.step"
                ></el-slider>
              </template>

              <template v-else-if="item.type === 'select'">
                <el-select
                  size="small"
                  :model-value="localInputValues[index] || item.value"
                  @update:model-value="handleInputChange(index, $event)"
                >
                  <el-option
                    v-for="(option, optionIndex) in item.typeOptions?.options"
                    :key="optionIndex"
                    :value="option.value"
                    :label="option.label"
                  />
                </el-select>
              </template>
              <template v-else-if="item.type === 'radio'">
                <el-radio-group
                  :model-value="localInputValues[index] || item.value"
                  @update:model-value="handleInputChange(index, $event)"
                >
                  <el-radio
                    v-for="(option, optionIndex) in item.typeOptions?.options"
                    :key="optionIndex"
                    :value="option.value"
                    :label="option.label"
                  ></el-radio>
                </el-radio-group>
              </template>
            </el-form-item>
          </template>
          <!-- ####在这里面添加新组件代码属性,代码结束##### -->
        </el-form>
      </el-collapse-item>
    </el-collapse>

    <el-drawer size="60%" title="动态数据格式" v-model="drawer" direction="ltr">
      <el-tabs v-model="activeName1" type="card">
        <el-tab-pane label="接口格式" name="first">
          <JsonEditor
            v-if="drawer"
            height="480px"
            v-model="dataJsonStr"
            :option="jsonEditorOption"
          />
        </el-tab-pane>
        <el-tab-pane label="HTML代码" name="second">
          <div style="height: 480px; overflow: auto">
            <codemirror
              v-if="drawer"
              :htmlStr="dataHtmlStr"
              @editor-content="handleEditorContent"
            ></codemirror>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <el-drawer size="60%" title="组件JSON" v-model="drawerjson" direction="ltr">
      <JsonEditor
        v-if="drawerjson"
        height="480px"
        v-model="curWidgetJson"
        :option="{ mode: 'code' }"
      />
    </el-drawer>
  </div>
</template>

<script setup name="widget-attr">
import { ref, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../../../stores/pageEngine'
import JsonEditor from 'ceel-json-editor'
import 'jsoneditor/dist/jsoneditor.css'
import { ElMessage } from 'element-plus'

import codemirror from '../../codemirror/index.vue'

const pageEngineStore = usePageEngineStore()
const { curWidget, curWidgetIdx } = storeToRefs(pageEngineStore)
const dataJsonStr = ref('')
const dataHtmlStr = ref('')
const drawer = ref(false)
const drawerjson = ref(false)
const activeName = ref('1')
const activeName1 = ref('first')
const updateIndex = ref(0)

// 防抖工具函数
const debounce = (func, delay) => {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

// 本地输入值缓存，用于防抖
const localInputValues = ref({})

// 初始化本地输入值
const initLocalValues = () => {
  if (curWidget.value?.widgetParams) {
    curWidget.value.widgetParams.forEach((item, index) => {
      localInputValues.value[index] = item.value
    })
  }
}

// 监听组件变化，初始化本地值
watch(
  () => curWidget.value?.widgetParams,
  () => {
    nextTick(() => {
      initLocalValues()
    })
  },
  { immediate: true }
)

// 防抖更新函数 - 用于组件参数
const debouncedUpdate = debounce((index, value) => {
  if (curWidget.value?.widgetParams?.[index]) {
    curWidget.value.widgetParams[index].value = value
  }
}, 300) // 1000ms 防抖延迟

// 防抖更新函数 - 用于通用配置
const debouncedUpdateGeneral = debounce((path, value) => {
  const pathArray = path.split('.')
  let target = curWidget.value
  for (let i = 0; i < pathArray.length - 1; i++) {
    target = target[pathArray[i]]
  }
  target[pathArray[pathArray.length - 1]] = value
}, 300) // 1000ms 防抖延迟

// 处理输入变化 - 组件参数
const handleInputChange = (index, value) => {
  localInputValues.value[index] = value
  debouncedUpdate(index, value)
}

// 处理通用配置输入变化
const handleGeneralInputChange = (path, value) => {
  debouncedUpdateGeneral(path, value)
}

//当前组件json
const curWidgetJson = computed({
  get() {
    return JSON.stringify(curWidget.value, null, '  ')
  },
  set(newValue) {
    try {
      const parsed = JSON.parse(newValue)
      // 更新 curWidget 的值，假设 curWidget 是响应式的 ref 或 pinia store 的响应式属性
      Object.assign(curWidget.value, parsed)
    } catch (e) {
      console.error('JSON 解析失败')
    }
  },
})

const getDataJson = (dataJson, index) => {
  if (dataJson) {
    dataJsonStr.value = JSON.stringify(dataJson, null, '  ')
    drawer.value = true
    activeName1.value = 'first'
    updateIndex.value = index
  }
}

const getDataHtml = (dataHtml, index) => {
  if (dataHtml) {
    dataHtmlStr.value = JSON.stringify(dataHtml)
    drawer.value = true
    activeName1.value = 'second'
    updateIndex.value = index
  } else {
    ElMessage({
      message: '只适用于超文本组件',
      type: 'warning',
    })
  }
}

const jsonEditorOption = {
  mode: 'code',
  onChange: (v) => {
    curWidget.value.widgetParams[updateIndex.value].typeOptions.dataJson = v
  },
}

// html编辑器回调函数
const handleEditorContent = (content) => {
  ElMessage({
    message: '已完成修改',
    type: 'success',
  })
  curWidget.value.widgetParams[updateIndex.value].typeOptions.dataHtml = content
  drawer.value = false
}
</script>

<style scoped>
.seeBtn {
  margin-top: 10px;
  width: 150px;
}
.btnJson {
  width: 100%;
  margin: 10px auto;
}
</style>
