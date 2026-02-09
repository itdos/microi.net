# r-divider

`r-divider` 分割线组件,用于将内容分隔为多个区域。

## 示例

```vue
<template>
  <r-config-provider>
    <view style="padding: 20rpx">
      <view style="padding: 20rpx 0">基础用法</view>
      <r-divider />

      <view style="padding: 20rpx 0">展示文本 </view>
      <r-divider>文本</r-divider>

      <view style="padding: 20rpx 0">内容位置 </view>
      <r-divider content-position="left">文本</r-divider>
      <r-divider content-position="right">文本</r-divider>

      <view style="padding: 20rpx 0">虚线 </view>
      <r-divider dashed>文本</r-divider>

      <view style="padding: 20rpx 0">自定义样式 </view>

      <r-divider
        :customStyle="{
          color: '#1989fa',
          borderColor: '#1989fa',
          padding: '0 16px',
        }"
      >
        文本
      </r-divider>

      <view style="padding: 20rpx 0">垂直 </view>

      <r-divider vertical />
      文本
      <r-divider vertical dashed />
      文本
      <r-divider vertical :hairline="false" />
      文本
      <r-divider vertical :customStyle="{ borderColor: '#1989fa' }" />
    </view>
  </r-config-provider>
</template>
```

## API

### Props

| 名称            | 说明              | 类型    | 默认值   | 可选值         |
| --------------- | ----------------- | ------- | -------- | -------------- |
| dashed          | 是否使用虚线      | Boolean | false    | true           |
| hairline        | 是否使用 0.5px 线 | Boolean | false    | true           |
| contentPosition | 内容位置          | String  | `center` | `left` `right` |
| vertical        | 是否使用垂直      | Boolean | false    | true           |

### Slots

| 名称    | 说明       | 参数 |
| ------- | ---------- | ---- |
| default | 自内容页码 | -    |



更多组件，请前往[rainui](https://ext.dcloud.net.cn/plugin?id=19701)
