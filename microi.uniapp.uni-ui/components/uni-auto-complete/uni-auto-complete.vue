<template>
  <view class="uni-auto-complete">
    <uni-easyinput
      v-model="inputValue"
      :placeholder="placeholder"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      class="uni-auto-complete__input"
      :class="{ 'uni-auto-complete__input--disabled': disabled }"
      :styles="styles"
      :disabled="disabled"
      :clearable="clearable"
    />
    <view 
      v-if="showSuggestions && filteredSuggestions.length" 
      class="uni-auto-complete__popup"
    >
      <scroll-view 
        scroll-y="true" 
        class="uni-auto-complete__list"
      >
        <view
          v-for="(item, index) in filteredSuggestions"
          :key="index"
          class="uni-auto-complete__item"
          @click="handleSelect(item)"
          :hover-class="'uni-auto-complete__item--hover'"
        >
          <text class="uni-auto-complete__text">{{ getLabelValue(item) }}</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'UniAutoComplete',
  props: {
    // v-model值
    modelValue: {
      type: [String, Number],
      default: ''
    },
    // 占位符
    placeholder: {
      type: String,
      default: '请输入内容'
    },
    // 数据源
    fetchSuggestions: {
      type: Array,
      default: () => []
    },
    // 显示字段名
    labelField: {
      type: String,
      default: 'value'
    },
    // 值字段名
    valueField: {
      type: String,
      default: 'value'
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      default: false
    },
    // 是否可清空
    clearable: {
      type: Boolean,
      default: true
    },
    // 自定义样式
    styles: {
      type: Object,
      default() {
        return {}
      }
    }
  },
  
  emits: ['update:modelValue', 'select', 'input', 'clear', 'blur'],
  
  data() {
    return {
      inputValue: this.modelValue || '', 
      showSuggestions: false,
      filteredSuggestions: [],
      debounceTimer: null,
      isUserInput: false,
      isFocused: false,
      lastInputTime: 0
    }
  },
  
  created() {
    // 确保初始值正确设置
    this.inputValue = this.modelValue || ''
  },
  
  watch: {
    modelValue: {
      immediate: true, // 立即执行一次
      handler(val) {
        if (!this.isUserInput || val !== this.inputValue) {
          this.inputValue = val || ''
          // 选择后立即关闭下拉框
          this.showSuggestions = false
          this.filteredSuggestions = []
        }
      }
    },
    
    fetchSuggestions: {
      handler(val) {
        // 只在有输入值且获得焦点时更新建议列表
        if (this.inputValue && this.isFocused) {
          this.updateSuggestions(this.inputValue)
        }
      }
    }
  },
  
  methods: {
    // 获取显示的标签值
    getLabelValue(item) {
      return item[this.labelField] || item[this.valueField] || ''
    },
    
    // 获取实际的值
    getActualValue(item) {
      return item[this.valueField] || ''
    },
    
    // 防抖函数
    debounce(fn, delay = 300) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }
      this.debounceTimer = setTimeout(() => {
        fn()
      }, delay)
    },

    // 更新建议列表
    updateSuggestions(value) {
      if (!this.fetchSuggestions || !Array.isArray(this.fetchSuggestions)) {
        this.showSuggestions = false
        return
      }
      
      this.filteredSuggestions = this.fetchSuggestions.filter(item => {
        const label = this.getLabelValue(item)
        if (!label) return false
        return String(label).toLowerCase().includes(String(value).toLowerCase())
      })
      
      this.showSuggestions = this.filteredSuggestions.length > 0
    },

    // 处理获取焦点
    handleFocus() {
      this.isFocused = true
      if (!this.fetchSuggestions || !Array.isArray(this.fetchSuggestions)) return
      
      // 有输入值时，过滤显示匹配项
      if (this.inputValue) {
        this.updateSuggestions(this.inputValue)
      } else {
        // 无输入值时，显示所有选项
        this.filteredSuggestions = [...this.fetchSuggestions]
      }
      
      // 如果有数据就显示下拉框
      this.showSuggestions = this.filteredSuggestions.length > 0
    },
    
    // 处理失去焦点
    handleBlur() {
      this.isFocused = false
      
      // 清除防抖定时器
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }
      
      // 延迟关闭，以便点击选项时能够正常选中
      setTimeout(() => {
        if (!this.isFocused) {
          this.showSuggestions = false
          this.filteredSuggestions = []
          this.isUserInput = false
          // 触发 blur 事件
          this.$emit('blur', this.inputValue)
        }
      }, 200)
    },
    
    // 处理输入
    handleInput(value) {
      this.isUserInput = true
      this.$emit('update:modelValue', value)
      
      // 如果输入为空，立即清空并返回，不触发防抖
      if (!value || value.trim() === '') {
        this.showSuggestions = false
        this.filteredSuggestions = []
        this.$emit('input', '')
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer)
          this.debounceTimer = null
        }
        return
      }
      
      // 如果已经失去焦点，不处理输入
      if (!this.isFocused) return
      
      this.debounce(() => {
        this.$emit('input', value)
        this.updateSuggestions(value)
      }, 300)
    },
    
    // 处理选择
    handleSelect(item) {
      const value = this.getActualValue(item)
      this.inputValue = this.getLabelValue(item)
      this.isUserInput = false
      
      // 立即关闭下拉框
      this.showSuggestions = false
      this.filteredSuggestions = []
      
      // 发送事件
      this.$emit('update:modelValue', value)
      this.$emit('select', item)
    }
  }
}
</script>

<style lang="scss" scoped>
.uni-auto-complete {
  position: relative;
  width: 100%;
  
  &__input {
    width: 100%;
    
    &--disabled {
      :deep(.uni-easyinput__content-input) {
        color: #999;
        -webkit-text-fill-color: #999;
        background-color: #f5f7fa;
      }
    }
  }
  
  &__popup {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
    z-index: 999;
  }
  
  &__list {
    max-height: 300px;
  }
  
  &__item {
    padding: 10px 15px;
    font-size: 14px;
    
    &--hover {
      background-color: #f5f7fa;
    }
  }
  
  &__text {
    color: #606266;
  }
}
</style>
