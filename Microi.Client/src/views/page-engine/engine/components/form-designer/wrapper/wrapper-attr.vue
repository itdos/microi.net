<template>
  <div>
    <el-collapse v-model="activeName" accordion>
      <el-button
        size="small"
        type="primary"
        plain
        class="btnJson"
        @click="drawerjson = true"
        >容器JSON</el-button
      >

      <el-collapse-item title="通用配置" name="1">
        <el-form v-if="curWrapperIdx > -1">
          <el-form-item label="容器编号">
            <el-input
              disabled
              size="small"
              v-model="curWrapper.wrapperOption.number"
            ></el-input>
          </el-form-item>

          <el-form-item label="标题名称">
            <el-input
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.title"
            ></el-input>
          </el-form-item>

          <el-form-item label="栅格宽度">
            <el-input-number
              size="small"
              style="clear: both"
              v-model="curWrapper.wrapperOption.span"
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
              v-model="curWrapper.wrapperOption.span"
            >
            </el-slider>
          </el-form-item>

          <el-form-item label="容器高度">
            <el-input-number
              size="small"
              style="clear: both"
              v-model="curWrapper.wrapperOption.height"
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
          v-model="curWrapper.wrapperOption.height"
        >
        </el-slider>
      </el-form-item> -->

          <el-form-item label="容器上移">
            <el-input-number
              size="small"
              style="clear: both"
              v-model="curWrapper.wrapperOption.marginTop"
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
          v-model="curWrapper.wrapperOption.marginTop"
        >
        </el-slider>
      </el-form-item> -->

          <el-form-item label="栅格间距">
            <el-input-number
              size="small"
              style="clear: both"
              v-model="curWrapper.wrapperOption.gutter"
              :min="0"
              :max="24"
              :step="1"
              label=""
            ></el-input-number>
          </el-form-item>

          <el-form-item label="左侧间隔">
            <el-input-number
              size="small"
              style="clear: both"
              v-model="curWrapper.wrapperOption.offset"
              :min="0"
              :max="24"
            ></el-input-number>
          </el-form-item>

          <el-form-item label="栅格右移">
            <el-input-number
              size="small"
              style="clear: both"
              v-model="curWrapper.wrapperOption.push"
              :min="0"
              :max="24"
            ></el-input-number>
          </el-form-item>

          <el-form-item label="栅格左移">
            <el-input-number
              size="small"
              style="clear: both"
              v-model="curWrapper.wrapperOption.pull"
              :min="0"
              :max="24"
            ></el-input-number>
          </el-form-item>

          <el-form-item label="外边距值">
            <el-input
              size="small"
              v-model="curWrapper.wrapperOption.margin"
            ></el-input>
          </el-form-item>

          <el-form-item label="内边距值">
            <el-input
              size="small"
              v-model="curWrapper.wrapperOption.dynamicStyle.padding"
            ></el-input>
          </el-form-item>

          <el-form-item label="面板背景">
            <el-color-picker
              show-alpha
              size="small"
              v-model="curWrapper.wrapperOption.pannelColor"
            ></el-color-picker>
          </el-form-item>

          <el-form-item label="内容背景">
            <el-color-picker
              show-alpha
              size="small"
              v-model="curWrapper.wrapperOption.dynamicStyle.backgroundColor"
            ></el-color-picker>
          </el-form-item>

          <el-form-item label="显示标题">
            <el-switch
              v-model="curWrapper.wrapperOption.titleOption.hidden"
            ></el-switch>
          </el-form-item>

          <el-form-item label="标题位置">
            <el-select
              size="small"
              v-model="
                curWrapper.wrapperOption.titleOption.dynamicStyle.textAlign
              "
              placeholder="请选择"
            >
              <el-option label="左对齐" value="left"> </el-option>
              <el-option label="居中" value="center"> </el-option>
              <el-option label="右对齐" value="right"> </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="标题边距">
            <el-input
              size="small"
              v-model="
                curWrapper.wrapperOption.titleOption.dynamicStyle.padding
              "
            ></el-input>
          </el-form-item>

          <el-form-item label="标题高度">
            <el-input
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.dynamicStyle.height"
            ></el-input>
          </el-form-item>

          <el-form-item label="标题行高">
            <el-input
              size="small"
              v-model="
                curWrapper.wrapperOption.titleOption.dynamicStyle.lineHeight
              "
            ></el-input>
          </el-form-item>

          <el-form-item label="标题字号">
            <el-input
              size="small"
              v-model="
                curWrapper.wrapperOption.titleOption.dynamicStyle.fontSize
              "
            ></el-input>
          </el-form-item>

          <el-form-item label="标题颜色">
            <el-color-picker
              show-alpha
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.dynamicStyle.color"
            ></el-color-picker>
          </el-form-item>

          <el-form-item label="启用更多">
            <el-switch
              v-model="curWrapper.wrapperOption.titleOption.moreOption.hidden"
            ></el-switch>
          </el-form-item>

          <el-form-item label="更多标题">
            <el-input
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.moreOption.text"
            ></el-input>
          </el-form-item>

          <el-form-item label="更多字号">
            <el-input
              size="small"
              v-model="
                curWrapper.wrapperOption.titleOption.moreOption.dynamicStyle
                  .fontSize
              "
            ></el-input>
          </el-form-item>

          <el-form-item label="更多颜色">
            <el-color-picker
              show-alpha
              size="small"
              v-model="
                curWrapper.wrapperOption.titleOption.moreOption.dynamicStyle
                  .color
              "
            ></el-color-picker>
          </el-form-item>

          <el-form-item label="更多图标">
            <el-input
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.moreOption.icon"
            ></el-input>
          </el-form-item>

          <el-form-item label="显示图标">
            <el-switch
              v-model="curWrapper.wrapperOption.titleOption.moreOption.iconShow"
            ></el-switch>
          </el-form-item>

          <el-form-item label="更多链接">
            <el-input
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.moreOption.linkurl"
            ></el-input>
          </el-form-item>

          <el-form-item label="跳转方式">
            <el-select
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.moreOption.linktype"
              placeholder="请选择"
            >
              <el-option label="router" value="router"> </el-option>
              <el-option label="_parent" value="_parent"> </el-option>
              <el-option label="_blank" value="_blank"> </el-option>
              <el-option label="_self" value="_self"> </el-option>
              <el-option label="_top" value="_top"> </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="刷新数据">
            <el-select
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.moreOption.refresh"
              placeholder="请选择"
            >
              <el-option label="不显示" value="0"> </el-option>
              <el-option label="仅文本" value="1"> </el-option>
              <el-option label="仅图标" value="2"> </el-option>
              <el-option label="文本图标" value="3"> </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="日期时间">
            <el-select
              size="small"
              v-model="curWrapper.wrapperOption.titleOption.moreOption.datetime"
              placeholder="请选择"
            >
              <el-option label="不显示" value="0"> </el-option>
              <el-option label="仅日期" value="1"> </el-option>
              <el-option label="日期时间" value="2"> </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="动态时间">
            <el-switch
              v-model="curWrapper.wrapperOption.titleOption.moreOption.autotime"
            ></el-switch>
          </el-form-item>

          <el-form-item label="时间间隔">
            <el-input
              type="number"
              size="small"
              v-model="
                curWrapper.wrapperOption.titleOption.moreOption.autotimeval
              "
            ></el-input>
          </el-form-item>
        </el-form>
      </el-collapse-item>
    </el-collapse>

    <el-drawer size="60%" title="组件JSON" v-model="drawerjson" direction="ltr">
      <JsonEditor
        v-if="drawerjson"
        height="480px"
        v-model="curWrapperJson"
        :option="{ mode: 'code' }"
      />
    </el-drawer>
  </div>
</template>

<script setup name="wrapper-attr">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../../../stores/pageEngine'
const pageEngineStore = usePageEngineStore()
import JsonEditor from 'ceel-json-editor'
import 'jsoneditor/dist/jsoneditor.css'
const { curWrapper, curWrapperIdx } = storeToRefs(pageEngineStore)
const drawerjson = ref(false)
const activeName = ref('1')

//当前容器json
const curWrapperJson = computed({
  get() {
    return JSON.stringify(curWrapper.value, null, '  ')
  },
  set(newValue) {
    try {
      const parsed = JSON.parse(newValue)
      // 更新 curWidget 的值，假设 curWidget 是响应式的 ref 或 pinia store 的响应式属性
      Object.assign(curWrapper.value, parsed)
    } catch (e) {
      console.error('JSON 解析失败')
    }
  },
})

const wrapperFields = [
  {
    label: '容器编号',
    value: 'number',
    type: 'input',
    disabled: true,
  },

  {
    label: '标题名称',
    value: 'titleOption.title',
    type: 'input',
  },

  {
    label: '栅格宽度',
    value: 'span',
    type: 'number',
    slider: true,
    step: 1,
    min: 0,
    max: 24,
  },
  {
    label: '容器高度',
    value: 'height',
    type: 'number',
    slider: true,
    step: 10,
    min: 0,
    max: 1920,
  },

  {
    label: '容器上移',
    value: 'marginTop',
    type: 'number',
    step: 10,
    min: -1920,
    max: 0,
  },
  {
    label: '栅格间距',
    value: 'gutter',
    type: 'number',
    step: 1,
    min: 0,
    max: 24,
  },
  {
    label: '左侧间隔',
    value: 'offset',
    type: 'number',
    min: 0,
    max: 24,
  },
  {
    label: '栅格右移',
    value: 'push',
    type: 'number',
    min: 0,
    max: 24,
  },
  {
    label: '栅格左移',
    value: 'pull',
    type: 'number',
    min: 0,
    max: 24,
  },
  {
    label: '外边距值',
    value: 'margin',
    type: 'input',
  },
  {
    label: '内边距值',
    value: 'dynamicStyle.padding',
    type: 'input',
  },
  {
    label: '容器背景',
    value: 'pannelColor',
    type: 'color',
  },
  {
    label: '内容背景',
    value: 'dynamicStyle.backgroundColor',
    type: 'color',
  },
  {
    label: '显示标题',
    value: 'titleOption.hidden',
    type: 'switch',
  },

  {
    label: '标题位置',
    value: 'titleOption.dynamicStyle.textAlign',
    type: 'select',
    options: [
      { label: '左对齐', value: 'left' },
      { label: '居中', value: 'center' },
      { label: '右对齐', value: 'right' },
    ],
  },
  {
    label: '标题边距',
    value: 'titleOption.dynamicStyle.padding',
    type: 'input',
  },
  {
    label: '标题高度',
    value: 'titleOption.dynamicStyle.height',
    type: 'input',
  },
  {
    label: '标题行高',
    value: 'titleOption.dynamicStyle.lineHeight',
    type: 'input',
  },
  {
    label: '标题字号',
    value: 'titleOption.dynamicStyle.fontSize',
    type: 'input',
  },
  {
    label: '标题颜色',
    value: 'titleOption.dynamicStyle.color',
    type: 'color',
  },

  {
    label: '启用更多',
    value: 'titleOption.moreOption.hidden',
    type: 'switch',
  },
  {
    label: '更多标题',
    value: 'titleOption.moreOption.text',
    type: 'input',
  },
  {
    label: '更多字号',
    value: 'titleOption.moreOption.dynamicStyle.color',
    type: 'input',
  },
  {
    label: '更多颜色',
    value: 'titleOption.moreOption.dynamicStyle.color',
    type: 'color',
  },

  {
    label: '更多图标',
    value: 'titleOption.moreOption.icon',
    type: 'input',
  },
  {
    label: '显示图标',
    value: 'titleOption.moreOption.iconShow',
    type: 'switch',
  },
  {
    label: '更多链接',
    value: 'titleOption.moreOption.linkurl',
    type: 'input',
  },
]
</script>

<style scoped>
.btnJson {
  width: 100%;
  margin: 10px auto;
}
</style>
