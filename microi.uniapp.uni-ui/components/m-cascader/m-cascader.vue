<template>
  <view class="m-cascader" :class="{ 'is-disabled': disabled, 'is-readonly': readonly }">
    <!-- 输入框触发器 -->
    <view class="m-cascader__input" :class="{ 'has-border': showBorder }">
      <view class="m-cascader__label" :class="{ 'is-placeholder': !selectedLabels.length }" @click="handleInputClick">
        <template v-if="multiple">
          <view v-if="selectedLabels.length" class="m-tag-group">
            <view v-for="(tag, index) in selectedLabels" :key="index" class="m-tag">
              <view class="m-tag__text">{{ tag }}</view>
              <view v-if="!disabled && !readonly" class="m-tag__close" @click.stop="handleTagClose(index)">
                <uni-icons type="clear" size="14" color="#999"></uni-icons>
              </view>
            </view>
          </view>
          <text v-else class="is-placeholder">{{ placeholder }}</text>
        </template>
        <template v-else>
          <view v-if="selectedLabel">
            <text class="m-tag__text">{{ selectedLabel }}</text>
          </view>
          <text v-else class="is-placeholder">{{ placeholder }}</text>
        </template>
      </view>
      <view v-if="!disabled && !readonly">
        <uni-icons 
          v-if="selectedLabels.length" 
          type="clear" 
          size="20" 
          color="#999"
          @click="handleClearAll"
      ></uni-icons>
      <uni-icons v-else :type="showPopup ? 'top' : 'bottom'" size="14" color="#999"></uni-icons>
      </view>
    </view>

    <!-- 弹出层 -->
    <uni-popup ref="popup" type="bottom" @change="onPopupChange">
      <view class="m-cascader__popup">
        <view class="m-cascader__header">
          <view class="m-cascader__close" @click="handleClose">
            <uni-icons type="closeempty" size="20" color="#999"></uni-icons>
          </view>
          <text class="m-cascader__title">{{ title }}</text>
          <view v-if="multiple" class="m-cascader__confirm" @click="handleConfirm">
            <text>确定</text>
          </view>
        </view>

        <view class="m-cascader__content">
          <scroll-view class="m-cascader__menu" scroll-y v-for="(menu, index) in menus" :key="index">
            <view
              class="m-cascader__item"
              v-for="item in menu"
              :key="item[valueKey]"
              :class="{
                'is-active': isSelected(item, index),
                'is-disabled': item.disabled
              }"
              @click="handleNodeClick(item, index)"
            >
              <text class="m-cascader__label">{{ item[labelKey] }}</text>
              <view v-if="!multiple && item[childrenKey] && item[childrenKey].length" class="m-cascader__expand">
                <uni-icons type="right" size="14" color="#999"></uni-icons>
              </view>
              <text v-if="multiple && isSelected(item, index)" class="m-cascader__checkbox">✓</text>
            </view>
          </scroll-view>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
export default {
  name: 'MCascader',
  props: {
    options: {
      type: Array,
      default: () => []
    },
    modelValue: {
      type: [Array, String, Number],
      default: ''
    },
    fieldProps: {
      type: Object,
      default: () => ({})
    },
    placeholder: {
      type: String,
      default: '请选择'
    },
    title: {
      type: String,
      default: '请选择'
    },
    multiple: {
      type: Boolean,
      default: false
    },
    saveFullPath: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    showBorder: {
      type: Boolean,
      default: true
    },
    readonly: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      showPopup: false,
      menus: [this.options],
      selectedNodes: [],
      tempSelectedNodes: [],
      valueKey: this.fieldProps.value || 'value',
      labelKey: this.fieldProps.label || 'label',
      childrenKey: this.fieldProps.children || 'children',
      flattenedData: [], // 存储平铺后的数据
      pathMap: new Map() // 存储值到完整路径的映射
    }
  },

  computed: {
    selectedLabel() {
      if (!this.selectedNodes.length) return ''
      if (this.multiple) return ''

      const value = Array.isArray(this.selectedNodes[0]) ? 
        this.selectedNodes[0][this.selectedNodes[0].length - 1] : 
        this.selectedNodes[0]

      const pathInfo = this.getFullPathInfo(value)
      return pathInfo ? pathInfo.fullPathName : ''
    },

    selectedLabels() {
      if (!this.selectedNodes.length) return []
      if (!this.multiple) return [this.selectedLabel]

      return this.selectedNodes.map(node => {
        const value = Array.isArray(node) ? node[node.length - 1] : node
        const pathInfo = this.getFullPathInfo(value)
        return pathInfo ? pathInfo.fullPathName : ''
      })
    }
  },

  watch: {
    modelValue: {
      handler(val) {
        this.initSelected()
      },
      immediate: true
    },
    options: {
      handler(val) {
        this.initData()
      },
      immediate: true
    }
  },
  mounted() {
    // 确保初始值正确设置
    this.initData()
    this.initSelected()
  },
  methods: {
    handleClearAll() {
      this.selectedNodes = []
      this.tempSelectedNodes = []
      // this.handleChange()
    },
    // 处理输入框点击
    handleInputClick() {
      if (!this.disabled && !this.readonly) {
        this.togglePopup()
      }
    },

    // 切换弹出层
    togglePopup() {
      if (this.showPopup) {
        this.handleClose()
      } else {
        this.showPopup = true
        this.$refs.popup.open()
        if (this.multiple) {
          // 初始化临时选中节点
          this.tempSelectedNodes = JSON.parse(JSON.stringify(this.selectedNodes))
        }
      }
    },

    // 处理关闭
    handleClose() {
      this.showPopup = false
      this.$refs.popup.close()
      if (this.multiple) {
        // 如果是多选，恢复到之前的选中状态
        this.tempSelectedNodes = JSON.parse(JSON.stringify(this.selectedNodes))
      }
    },

    // 监听弹出层关闭事件
    onPopupChange(e) {
      this.showPopup = e.show
    },

    // 处理标签关闭
    handleTagClose(index) {
      this.tempSelectedNodes.splice(index, 1)
      this.selectedNodes = [...this.tempSelectedNodes]
      this.handleChange()
    },

    // 处理清空
    handleClear() {
      this.tempSelectedNodes = []
      this.selectedNodes = []
      this.handleChange()
    },

    // 处理节点点击
    handleNodeClick(item, menuIndex) {
      if (item.disabled) return

      if (this.multiple) {
        this.handleMultiSelect(item, menuIndex)
      } else {
        this.handleSingleSelect(item, menuIndex)
      }
    },

    // 处理多选节点选择
    handleMultiSelect(item, menuIndex) {
      // 如果有子节点，展开子节点但不选中
      if (item[this.childrenKey] && item[this.childrenKey].length) {
        this.$set(this.menus, menuIndex + 1, item[this.childrenKey])
        // 清空后续菜单
        this.menus.length = menuIndex + 2
        return
      }

      // 构建完整路径
      const currentPath = []
      let currentNode = item
      let currentIndex = menuIndex

      // 从当前节点往上找父节点
      while (currentIndex >= 0) {
        const menu = this.menus[currentIndex]
        const selectedItem = menu.find(node => 
          currentIndex === menuIndex ? 
          node[this.valueKey] === item[this.valueKey] : 
          node[this.childrenKey]?.some(child => child[this.valueKey] === currentNode[this.valueKey])
        )
        
        if (selectedItem) {
          currentPath.unshift(selectedItem[this.valueKey])
          currentNode = selectedItem
        }
        currentIndex--
      }

      // 检查是否已经选中
      const index = this.tempSelectedNodes.findIndex(node => {
        if (Array.isArray(node)) {
          return node.join(',') === currentPath.join(',')
        }
        return node === item[this.valueKey]
      })

      if (index > -1) {
        // 如果已选中，则取消选中
        this.tempSelectedNodes.splice(index, 1)
      } else {
        // 如果未选中，则添加到选中列表
        this.tempSelectedNodes.push(this.saveFullPath ? currentPath : item[this.valueKey])
      }
    },

    // 处理单选
    handleSingleSelect(item, menuIndex) {
      // 如果有子节点，只展开不选中
      if (item[this.childrenKey] && item[this.childrenKey].length) {
        // 更新当前选中的路径
        const currentPath = []
        let currentNode = item
        let currentIndex = menuIndex

        while (currentIndex >= 0) {
          const menu = this.menus[currentIndex]
          const selectedItem = menu.find(node => 
            currentIndex === menuIndex ? 
            node[this.valueKey] === item[this.valueKey] : 
            node[this.childrenKey]?.some(child => child[this.valueKey] === currentNode[this.valueKey])
          )
          
          if (selectedItem) {
            currentPath.unshift(selectedItem[this.valueKey])
            currentNode = selectedItem
          }
          currentIndex--
        }

        // 更新选中值但不触发change事件
        this.selectedNodes = [this.saveFullPath ? currentPath : item[this.valueKey]]
        
        // 展开子节点
        this.$set(this.menus, menuIndex + 1, item[this.childrenKey])
        this.menus.length = menuIndex + 2
        return
      }

      // 构建完整路径
      const currentPath = []
      let currentNode = item
      let currentIndex = menuIndex

      // 从当前节点往上找父节点
      while (currentIndex >= 0) {
        const menu = this.menus[currentIndex]
        const selectedItem = menu.find(node => 
          currentIndex === menuIndex ? 
          node[this.valueKey] === item[this.valueKey] : 
          node[this.childrenKey]?.some(child => child[this.valueKey] === currentNode[this.valueKey])
        )
        
        if (selectedItem) {
          currentPath.unshift(selectedItem[this.valueKey])
          currentNode = selectedItem
        }
        currentIndex--
      }

      // 更新选中值
      this.selectedNodes = [this.saveFullPath ? currentPath : item[this.valueKey]]
      this.handleChange()
      this.handleClose()
    },

    // 判断选项是否选中
    isSelected(item, menuIndex) {
      if (this.multiple) {
        return this.tempSelectedNodes.some(node => {
          if (Array.isArray(node)) {
            // 检查当前节点是否在任何选中路径的对应层级中
            return node[menuIndex] === item[this.valueKey]
          }
          return node === item[this.valueKey]
        })
      } else {
        if (!this.selectedNodes.length) return false
        const selectedPath = Array.isArray(this.selectedNodes[0]) ? this.selectedNodes[0] : [this.selectedNodes[0]]
        // 检查当前节点是否在选中路径的对应层级中
        return selectedPath[menuIndex] === item[this.valueKey]
      }
    },

    // 多选确认
    handleConfirm() {
      this.selectedNodes = [...this.tempSelectedNodes]
      this.handleChange()
      this.handleClose()
    },

    // 触发change事件
    handleChange() {
      let value
      if (this.multiple) {
        if (this.saveFullPath) {
          // 完整路径模式，确保每个选中项都是数组
          value = this.selectedNodes.map(node => Array.isArray(node) ? node : [node])
        } else {
          // 非完整路径模式，只返回最后一个值
          value = this.selectedNodes.map(node => {
            if (Array.isArray(node)) {
              return node[node.length - 1]
            }
            return node
          })
        }
      } else {
        value = this.selectedNodes.length ? this.selectedNodes[0] : undefined
      }
      this.$emit('update:modelValue', value)
      this.$emit('change', value)
    },

    // 初始化选中状态
    async initSelected() {
      if (this.multiple) {
        if (Array.isArray(this.modelValue)) {
          // 处理多选的情况
          this.selectedNodes = this.modelValue.map(item => {
            if (this.saveFullPath) {
              // 完整路径模式，确保每个项都是数组
              return Array.isArray(item) ? [...item] : [item]
            } else {
              // 非完整路径模式，如果是数组则取最后一个值，否则直接使用值
              return Array.isArray(item) ? item[item.length - 1] : item
            }
          })

          // 处理默认展开
          if (this.modelValue.length > 0) {
            this.menus = [this.options]
            const firstPath = Array.isArray(this.modelValue[0]) ? this.modelValue[0] : null
            if (firstPath && firstPath.length > 1) {
              let currentOptions = this.options
              for (let i = 0; i < firstPath.length - 1; i++) {
                const value = firstPath[i]
                const node = currentOptions.find(item => item[this.valueKey] === value)
                if (node && node[this.childrenKey]) {
                  currentOptions = node[this.childrenKey]
                  this.menus.push(currentOptions)
                }
              }
            }
          }
        } else {
          this.selectedNodes = []
          this.menus = [this.options]
        }
        // 确保 tempSelectedNodes 和 selectedNodes 保持同步
        this.tempSelectedNodes = JSON.parse(JSON.stringify(this.selectedNodes))
      } else {
        // 单选逻辑保持不变
        if (this.saveFullPath && Array.isArray(this.modelValue)) {
          let currentOptions = this.options
          let path = []
          let nodes = []
          let lastNode = null
          
          for (const value of this.modelValue) {
            const node = currentOptions.find(item => item[this.valueKey] === value)
            if (node) {
              if (lastNode) {
                node.parent = lastNode
              }
              nodes.push(node)
              path.push(value)
              lastNode = node
              currentOptions = node[this.childrenKey] || []
            }
          }
          if (path.length === this.modelValue.length) {
            this.selectedNodes = [path]
            this.menus = [this.options]
            for (let i = 0; i < nodes.length - 1; i++) {
              if (nodes[i][this.childrenKey]) {
                this.menus.push(nodes[i][this.childrenKey])
              }
            }
          } else {
            this.selectedNodes = []
            this.menus = [this.options]
          }
        } else {
          this.selectedNodes = this.modelValue ? [this.modelValue] : []
          this.menus = [this.options]
        }
      }
    },

    // 格式化数据，将多层级数据平铺并添加完整路径名称
    flattenAndMapData(data, parentPath = [], parentLabels = []) {
      let result = []
      data.forEach(item => {
        const currentPath = [...parentPath, item[this.valueKey]]
        const currentLabels = [...parentLabels, item[this.labelKey]]
        const fullPathName = currentLabels.join(' / ')
        
        // 添加到结果数组
        result.push({
          ...item,
          fullPathName,
          fullPath: currentPath
        })
        
        // 存储值到完整路径的映射
        this.pathMap.set(item[this.valueKey], {
          path: currentPath,
          labels: currentLabels,
          fullPathName
        })
        
        // 递归处理子节点
        if (item[this.childrenKey] && item[this.childrenKey].length) {
          result = result.concat(
            this.flattenAndMapData(
              item[this.childrenKey],
              currentPath,
              currentLabels
            )
          )
        }
      })
      return result
    },

    // 根据值获取完整路径信息
    getFullPathInfo(value) {
      return this.pathMap.get(value)
    },
    
    // 初始化数据
    initData() {
      // 初始化平铺数据和路径映射
      this.pathMap.clear()
      this.flattenedData = this.flattenAndMapData(this.options)
    },
  }
}
</script>

<style lang="scss">
.m-cascader {
  &.is-disabled {
    .m-cascader__input {
      cursor: not-allowed;
      background-color: #f5f7fa;
      border-color: #e4e7ed;
    }

    .m-cascader__label {
      cursor: not-allowed;
      color: #c0c4cc;
    }

    .m-tag {
      background-color: #f5f7fa;
      border-color: #e4e7ed;
      color: #c0c4cc;
    }
  }

  &.is-readonly {
    .m-cascader__input {
      cursor: default;
      background-color: transparent;
      border-color: transparent;
      padding: 0;

      &:hover {
        border-color: transparent;
      }
    }

    .m-cascader__label {
      color: #000;
      font-size: 16px;
    }

    .m-tag {
      background-color: transparent;
      border: none;
      padding: 2px 4px;
      font-size: 14px;
      color: #000;
    }
  }

  &__input {
    position: relative;
    width: 100%;
    min-height: 35px;
    padding: 4px 10px;
    box-sizing: border-box;
    font-size: 14px;
    background-color: #fff;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;

    &.has-border {
      border: 1px solid #dcdfe6;
      
      &:hover {
        border-color: #409eff;
      }
    }

    &.is-disabled {
      background-color: #f5f7fa;
      border-color: #e4e7ed;
      color: #c0c4cc;
      cursor: not-allowed;

      &:hover {
        border-color: #e4e7ed;
      }
    }
  }

  &__label {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 3px 0;

    &.is-placeholder {
      color: #999;
    }
  }

  &__popup {
    background-color: #fff;
    border-radius: 10px 10px 0 0;
  }

  &__header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50px;
    border-bottom: 1px solid #eee;
  }

  &__close {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    padding: 15px;
    cursor: pointer;
  }

  &__title {
    font-size: 16px;
    color: #333;
  }

  &__confirm {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    padding: 15px;
    color: #409eff;
    font-size: 14px;
    cursor: pointer;
  }

  &__content {
    display: flex;
    height: 400px;
  }

  &__menu {
    flex: 1;
    border-right: 1px solid #eee;

    &:last-child {
      border-right: none;
    }
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 34px;
    padding: 0 15px;
    font-size: 14px;
    color: #606266;

    &.is-active {
      color: #409eff;
      font-weight: bold;
    }

    &.is-disabled {
      color: #c0c4cc;
      cursor: not-allowed;
    }
  }

  &__expand {
    color: #c0c4cc;
    font-size: 12px;
  }

  &__checkbox {
    color: #409eff;
    font-size: 14px;
  }

  &__footer {
    display: none;
  }

  &__btn {
    display: none;
  }
}

.m-tag {
  display: inline-flex;
  align-items: center;
  margin-right: 4px;
  padding: 0 4px;
  font-size: 12px;
  height: 24px;
  line-height: 24px;
  border-radius: 4px;
  background-color: #f0f2f5;
  margin-bottom: 5px;

  &__text {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: wrap;
  }

  &__close {
    display: flex;
    align-items: center;
    margin-left: 4px;
    cursor: pointer;
  }
}
</style>
