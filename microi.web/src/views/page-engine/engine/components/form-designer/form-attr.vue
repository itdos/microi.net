<!-- ##页面参数设置## -->
<template>
  <el-form>
    <el-form-item label="页面编号">
      <el-input size="small" type="text" v-model="formData.Number"></el-input>
    </el-form-item>
    <el-form-item label="页面标题">
      <el-input
        size="small"
        v-model="formData.Title"
        placeholder="请输入页面标题"
      />
    </el-form-item>
    <el-form-item label="页面简介">
      <el-input
        size="small"
        style="width: 90%"
        v-model="formData.Desc"
        type="textarea"
        :rows="3"
        placeholder="请输入页面简介"
      />
    </el-form-item>
    <el-form-item label="显示遮罩">
      <el-switch v-model="formConfig.mask"></el-switch>
    </el-form-item>
    <el-form-item label="拖拽开关">
      <el-switch v-model="formConfig.drag"></el-switch>
    </el-form-item>
    <el-form-item label="左侧边栏">
      <el-switch v-model="formConfig.left"></el-switch>
    </el-form-item>
    <el-form-item label="选中边框">
      <el-switch v-model="formConfig.hover"></el-switch>
    </el-form-item>
    <el-form-item label="卡片阴影">
      <el-switch v-model="formConfig.shadow"></el-switch>
    </el-form-item>
    <el-form-item label="链接跳转">
      <el-switch v-model="formConfig.link"></el-switch>
    </el-form-item>
    <el-form-item label="显示水印">
      <el-switch v-model="formConfig.watermark"></el-switch>
    </el-form-item>
    <el-form-item label="移动模式">
      <el-switch v-model="formConfig.mobile"></el-switch>
    </el-form-item>
    <el-form-item label="暗黑模式">
      <el-switch v-model="formConfig.dark"></el-switch>
    </el-form-item>
    <el-form-item label="内边距值">
      <el-input
        type="text"
        size="small"
        v-model="formConfig.dynamicStyle.padding"
        placeholder="0px 0px 0px 0px"
      ></el-input>
    </el-form-item>
    <el-form-item label="栅格间距">
      <el-input-number
        size="small"
        v-model="formConfig.gutter"
        :min="0"
        :max="1920"
        label=""
      ></el-input-number>
    </el-form-item>
    <el-form-item label="页面透明">
      <el-input-number
        size="small"
        v-model="formConfig.dynamicStyle.opacity"
        :step="0.1"
        :min="0"
        :max="1"
        label=""
      ></el-input-number>
    </el-form-item>

    <el-form-item label="水印文字">
      <el-input
        v-model="formConfig.watermarkStyle.content"
        size="small"
        placeholder="请输入水印文字"
      />
    </el-form-item>

    <el-form-item label="文字大小" style="width: 90%">
      <el-slider
        :min="0"
        :max="100"
        :step="1"
        show-stops
        v-model="formConfig.watermarkStyle.font.fontSize"
      >
      </el-slider>
    </el-form-item>
    <el-form-item label="文字旋转" style="width: 90%">
      <el-slider
        :min="-180"
        :max="180"
        :step="1"
        show-stops
        v-model="formConfig.watermarkStyle.rotate"
      >
      </el-slider>
    </el-form-item>

    <el-form-item label="文字颜色">
      <el-color-picker
        show-alpha
        size="small"
        v-model="formConfig.watermarkStyle.font.color"
      ></el-color-picker>
    </el-form-item>
    <el-form-item label="背景颜色">
      <el-color-picker
        show-alpha
        size="small"
        v-model="formConfig.dynamicStyle.backgroundColor"
      ></el-color-picker>
    </el-form-item>

    <el-form-item label="刷新间隔">
      <el-input-number
        size="small"
        v-model="formConfig.autoRefresh"
        :step="1"
        :min="0"
        :max="3600 * 24 * 7"
        label=""
      ></el-input-number>
    </el-form-item>
    <el-form-item label="最后刷新">
      <el-input
        disabled
        type="text"
        size="small"
        v-model="formConfig.lastRefreshTime"
        placeholder=""
      ></el-input>
    </el-form-item>
  </el-form>
</template>
<script setup name="form-attr">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../../stores/pageEngine'
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)
import { useDark } from '@vueuse/core'

//是否暗黑模式
const isDark = useDark()
const formConfig = computed(() => {
  return formData.value.JsonObj.formConfig
})

isDark.value = pageEngineStore.dark == 'true' || pageEngineStore.dark == true
formConfig.value.dark = isDark.value

watch(
  () => formConfig.value.dark,
  (newVal) => {
    isDark.value = newVal
    pageEngineStore.setDark(newVal)
  },
  { immediate: false }
)
</script>
