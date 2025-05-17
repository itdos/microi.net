# uni-auto-complete 自动完成组件

自动完成组件，输入内容自动显示相关联想词。

## 使用方式

```vue
<template>
  <uni-auto-complete
    v-model="keyword"
    placeholder="请输入关键词"
    :fetch-suggestions="querySearch"
    @select="handleSelect"
  />
</template>

<script>
export default {
  data() {
    return {
      keyword: ''
    }
  },
  methods: {
    // 获取建议数据
    async querySearch(query) {
      // 这里可以是实际的API调用
      return [
        { value: '选项1' },
        { value: '选项2' },
        { value: query + '的联想结果' }
      ]
    },
    // 选择建议项
    handleSelect(item) {
      console.log('选中:', item)
    }
  }
}
</script>
```

## API

### Props

|属性名|类型|默认值|说明|
|:-|:-|:-|:-|
|modelValue/v-model|String|''|输入框的值|
|placeholder|String|'请输入内容'|输入框占位文本|
|fetchSuggestions|Function|-|获取建议列表的方法，需要返回一个 Promise，参数为当前输入值|
|disabled|Boolean|false|是否禁用|
|clearable|Boolean|true|是否可清空|
|styles|Object|{}|自定义样式|

### Events

|事件名|说明|回调参数|
|:-|:-|:-|
|select|选中建议项时触发|选中项|
|input|输入值变化时触发|输入值|
|clear|清空输入时触发|-|

### 建议数据格式

```js
[
  {
    value: '显示的文本'
    // 可以包含其他自定义字段
  }
]
```
