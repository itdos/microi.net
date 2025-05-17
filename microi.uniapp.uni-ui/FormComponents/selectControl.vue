<template>
  <view>
    <view class="popup-content uni-common-pb">
      <view class="popup-close" @click="close()">
        <uni-icons type="closeempty" size="30px" color="#999" />
      </view>
      <view class="popup-search" v-if="currentFieldsConfig.EnableSearch || currentFieldsConfig.DataSourceSqlRemote">
        <uni-easyinput prefixIcon="search" v-model="keyword" placeholder="搜索" @iconClick="iconClick" @blur="iconClick"
          @clear="() => selectList = currentModel.Data"></uni-easyinput>
      </view>
      <view class="item">
        <text>请选择</text>
      </view>
      <scroll-view class="popup-list uni-common-pb" scroll-y
        v-if="selectList && selectList.length > 0">
        <view class="uni-common-mt" v-for="(item, index) in selectList" :key="index"
          @click="handleSelectItem(item)">
          <text>{{ item.text || item[currentFieldsConfig.SelectLabel] }}</text>
          <uni-icons v-if="item.selected" type="checkmarkempty" size="20px" color="#999" />
        </view>
      </scroll-view>
      <view v-else class="uni-center uni-text-gray">暂无数据</view>
      <view class="uni-common-mt popup-btn">
        <button type="primary" @click="handleSelectItemOk">确定</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, inject, watch, onMounted } from 'vue'
import { remoteSearchSelect } from '@/utils'
const props = defineProps({
  // 当前模型
  currentModel: {
    type: Object,
    default: () => ({})
  },
  // 当前字段配置
  currentFieldsConfig: {
    type: Object,
    default: () => ({})
  },
  // 是否多选
  isMultiSelect: {
    type: Boolean,
    default: false
  },
  // 初始数据
  list: {
    type: Array,
    default: () => ([])
  }
})
const V8 = inject('V8')
const keyword = ref('')
const popupSelect = ref(null)
const selectList = ref([])
const emits = defineEmits(['onSelectChange'])
onMounted(() => {
  selectList.value = props.list
})
const handleSelectItem = (item) => {
  // 如果是单选，就直接赋值
  if (!props.isMultiSelect) {
    selectList.value.map((i) => {
      if (i.value == item.value) {
        i.selected = true
      } else {
        i.selected = false
      }
    })
    // V8.ThisValueSet(item)
  } else { // 多选
    const index = selectList.value.findIndex((i) => i.value == item.value)
    selectList.value[index].selected = !selectList.value[index].selected
  }
}
const handleSelectItemOk = () => {
  let val = ''
  // 如果是多选，就取出选中的值
  if (props.isMultiSelect) {
    val = selectList.value.filter((i) => i.selected)
  } else {
    val = selectList.value.find((i) => i.selected)
  }
  V8.ThisValueSet(val)
  if (!val) {
    uni.showToast({
      title: '请选择',
      icon: 'none'
    })
    return
  }
  emits('onSelectChange', val)
}
const close = () => {
  emits('onSelectChange', 'close')
}
const iconClick = async () => {
  // 如果开启远程搜索就调用接口查询
  if (props.currentFieldsConfig.DataSourceSqlRemote) {
    const res = await remoteSearchSelect({
      _FieldId: props.currentModel.Id,
      _Keyword: keyword.value,
    }, props.currentFieldsConfig)
    selectList.value = res
  } else {
    selectList.value = props.currentModel.Data.filter((item) => {
      return item.text.includes(keyword.value)
    })
  }
}
</script>

<style lang="scss" scoped>
.popup-content {
  width: 100%;
  background: #fff;
  height: 75vh;
  border-radius: 10px 10px 0 0;
  padding: 20px;
  box-sizing: border-box;
}
.popup-content-child{
  padding: 0;
  .popup-close {
    right: 10px;
    top: 10px;
  }
}
.popup-search {
  margin-bottom: 20rpx;
}
.popup-list {
  overflow-y: scroll;
  height: 70%;
  margin-bottom: 50px;
}

.popup-close {
  position: relative;
  right: -10px;
  top: -10px;
  text-align: right;
}

.popup-btn {
  position: absolute;
  bottom: 20rpx;
  left: 20rpx;
  right: 20rpx;
}
</style>