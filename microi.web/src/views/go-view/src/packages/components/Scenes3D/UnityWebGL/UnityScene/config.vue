<template>
  <collapse-item name="Unity WebGL 配置" :expanded="true">
    <setting-item-box name="Loader JS" :alone="true">
      <setting-item name="*.loader.js 文件地址">
        <n-input
          v-model:value="optionData.loaderUrl"
          size="small"
          placeholder="https://cdn.example.com/Build/xxx.loader.js"
        />
      </setting-item>
    </setting-item-box>

    <setting-item-box name="Data 文件" :alone="true">
      <setting-item name="*.data 资产文件地址">
        <n-input
          v-model:value="optionData.dataUrl"
          size="small"
          placeholder="https://cdn.example.com/Build/xxx.data"
        />
      </setting-item>
    </setting-item-box>

    <setting-item-box name="Framework JS" :alone="true">
      <setting-item name="*.framework.js 文件地址">
        <n-input
          v-model:value="optionData.frameworkUrl"
          size="small"
          placeholder="https://cdn.example.com/Build/xxx.framework.js"
        />
      </setting-item>
    </setting-item-box>

    <setting-item-box name="WASM 文件" :alone="true">
      <setting-item name="*.wasm 文件地址">
        <n-input
          v-model:value="optionData.codeUrl"
          size="small"
          placeholder="https://cdn.example.com/Build/xxx.wasm"
        />
      </setting-item>
    </setting-item-box>
  </collapse-item>

  <collapse-item name="项目信息">
    <setting-item-box name="基本信息">
      <setting-item name="产品名称">
        <n-input v-model:value="optionData.productName" size="small" />
      </setting-item>
      <setting-item name="版本号">
        <n-input v-model:value="optionData.productVersion" size="small" />
      </setting-item>
      <setting-item name="公司名称">
        <n-input v-model:value="optionData.companyName" size="small" />
      </setting-item>
      <setting-item name="StreamingAssets">
        <n-input v-model:value="optionData.streamingAssetsUrl" size="small" />
      </setting-item>
    </setting-item-box>
  </collapse-item>

  <collapse-item name="外观">
    <setting-item-box name="样式">
      <setting-item name="背景色">
        <n-color-picker
          v-model:value="optionData.backgroundColor"
          size="small"
          :modes="['hex']"
        />
      </setting-item>
    </setting-item-box>
  </collapse-item>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { option } from './config'
import {
  CollapseItem,
  SettingItemBox,
  SettingItem
} from '@goview/components/Pages/ChartItemSetting'

defineProps({
  optionData: {
    type: Object as PropType<typeof option>,
    required: true
  }
})
</script>
