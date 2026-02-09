<template>
  <view class="popup-search">
    <form @submit="formSubmit" @reset="formReset">
      <view class="popup-search-item">
        <block v-for="(item, index) in searchList" :key="index">
          <view class="uni-form-item uni-flex-align-center">
            <view class="uni-label">{{item.Label}}</view>
            <view class="uni-flex-item uni-common-p-xs" v-if="tableFields[item.Name] && tableFields[item.Name].Component == 'Radio'">
              <uni-data-checkbox v-model="searchValue[item.Name]" :localdata="tableFields[item.Name].Data" multiple />
            </view>
            <view class="uni-flex-item" v-else-if="tableFields[item.Name] && tableFields[item.Name].Component == 'Select'">
              <!-- <uni-data-select
                v-model="searchValue[item.Name]"
                :localdata="tableFields[item.Name].Data"
                :key="new Date().getTime()"
              ></uni-data-select> -->
              <zxz-uni-data-select v-model="searchValue[item.Name]" :localdata="tableFields[item.Name].Data" multiple filterable @inputChange="handleInputChange($event,tableFields[item.Name].Config,item)"></zxz-uni-data-select>
            </view>
            <view class="uni-flex-item" v-else-if="tableFields[item.Name] && tableFields[item.Name].Component == 'Department'">
              <!-- <uni-data-picker :placeholder="tableFields[item.Name] && tableFields[item.Name].Placeholder" popup-title="请选择" :localdata="tableFields[item.Name].Data"
                v-model="searchValue[item.Name]"></uni-data-picker> -->
                <m-cascader
                  v-model="searchValue[item.Name]"
                  :options="tableFields[item.Name].Data"
                  :multiple="false"
                  :fieldProps="{
                    value: tableFields[item.Name].Config.SelectSaveField || 'Id',
                    label: tableFields[item.Name].Config.SelectLabel || 'Name',
                    children: '_Child'
                  }"
                  placeholder="请选择"
                  :save-full-path="false"
                  @change="handleChange($event, item)"
                />
            </view>
            <view class="uni-flex-item" v-else-if="item.Id == 'CreateTime' || tableFields[item.Name] && tableFields[item.Name].Component == 'DateTime'">
              <uni-datetime-picker v-model="searchValue[item.Name]" type="daterange" />
            </view>
            <view class="uni-flex-item" v-else>
              <uni-easyinput v-model="searchValue[item.Name]" :placeholder="tableFields[item.Name] && tableFields[item.Name].Placeholder" />
            </view>
          </view>
        </block>
      </view>
      <view class="uni-flex uni-common-mt btn">
        <button type="default" form-type="reset" style="width: 100%; margin-right: 10px; background-color: #EEEEEE; border: none;" class="rounded-full">重置</button>
        <button type="primary" form-type="submit" style="width: 100%;" class="rounded-full">确认</button>
      </view> 
    </form>
  </view>
</template>
<script setup>
  import { ref, inject } from 'vue'
import { remoteSearchSelect, handleArrayObj } from '@/utils'
  const V8 = inject('V8')
  const props = defineProps({
    searchList: {
      type: Array,
      default: () => []
    },
    tableFields: {
      type: Object,
      default: () => {}
    },
    searchForm: {
      type: Object,
      default: () => {}
    }
  })
  const emits = defineEmits(['search'])
  const searchValue = ref(props.searchForm)
  const searchList = ref(props.searchList)
  const tableFields = ref(props.tableFields)
  // 确认
  const formSubmit = (e) => {
    console.log('确认数据', searchValue.value)
    emits('search', searchValue.value)
  }
  // 重置
  const formReset = () => {
    console.log('清空数据')
    searchValue.value = {}
  }
  // 处理输入框输入
  const handleInputChange = async (value, FieldsConfig,item) => {
    console.log('输入框输入', value, FieldsConfig)
    // 如果开启远程搜索
    if (FieldsConfig.DataSourceSqlRemote) {
      const res = await remoteSearchSelect({
        _FieldId: item.Id,
        _Keyword: value,
      }, FieldsConfig)
      tableFields.value[item.Name].Data = handleArrayObj(tableFields.value[item.Name].Data, res, 'Id')
    }
  }
  const handleChange = (e, item) => {
    searchValue.value[item.Name] = e
  }
</script>
<style scoped>
.popup-search{
  background: #fff;
  padding: 20px;
  border-radius: 0px 0px 20px 20px;
  overflow: visible;
  /* height: 70vh; */
  position: relative;
}
.popup-search-item{
  margin-bottom: 20px;
  overflow: visible;
  padding-bottom: 50px;
}
.uni-label {
	color: #666666;
	font-size: 28rpx;
  text-indent: 0px;
  margin-right: 20rpx;
}
.btn{ 
  position: absolute;
  bottom: 0;
  right: 0;
  left: 0;
  background: #fff;
  padding: 20px;
  border-radius: 0px 0px 20px 20px;
}
.btn button {
	font-size: 28rpx;
}
</style>