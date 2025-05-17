<template>
  <view class="work">
    <view class="" v-if="formTabs[current] != '' && formTabs.length > 0">
      <scroll-view id="tab-bar" class="scroll-h" :scroll-x="true" :show-scrollbar="false" :scroll-into-view="scrollIntoViewId">
        <block v-for="(tab, index) in formTabs" :key="tab.id" >
          <view class="uni-tab-item" :id="'tab-' + index"  :data-current="index" 
            @click="onClickItem(index)">
            <text class="uni-tab-item-title" :class="current == index ? 'uni-tab-item-title-active' : ''">{{ tab }}</text>
          </view>
        </block>
      </scroll-view>
    </view>
    <view v-for="(field,index) in diyFormFields" :key="field.Id">
      <view v-if="((formTabs[current] == '' || field.Tab == formTabs[current]) && (field.AppVisible && field.Visible) && (!FieldsConfig.length || FieldsConfig.some(item => item.Id === field.Id))) || type == 'list'" >
        <!-- 是否需要表内编辑 -->
        <view v-if="InTableEdit && InTableEditFields.includes(field.Id) && type == 'edit'">
          <view class="uni-flex work-item">
          <view class="work-item-label" :class="{'text-red': field.NotEmpty}">{{ field.Label }}</view>
          <table-edit :field="field" :data="detail" :DiyTableId="DiyTableId" :diyFormFields="diyFormFields" :Guid="Guid" :currenTotal="currenTotal" :key="new Date().getTime()" />
          </view>
        </view>
        <template v-else>
        <!-- 如果是子表 -->
        <view v-if="field.Component == 'TableChild'" class="uni-common-mt-xs uni-common-mb-xs" :id="field.Name"  :class="{'uni-flex': type == 'list'}">
          <view class="work-item-label ">{{ field.Label }}</view>
          <view class="work-item-label uni-common-mt-xs" v-if="type == 'list'">
            <uni-tag text="查看数据" type="primary" />
          </view>
          <uni-row class="table-child" :width="730" v-else>
            <uni-col>
              <!-- <table-control ref="tableChild" :currentFieldsConfig="field.Config" :ParentFormData="detail" :isType="InTableEdit ? 'edit' : 'view' " :TableSearchList="TableSearchList[field.Name]" :listStyles="listStyles"/> -->
              <table-control :ref="setTableChildRef(index)" :currentFieldsConfig="field.Config" 
                        :ParentFormData="detail" :isType="InTableEdit ? 'edit' : 'view'" :ParentdiyFormFields="diyFormFields"  :ParentV8="GetV8()" :ParentIndex="index"
                        :TableSearchList="TableSearchList[field.Name]" :is="field.Name"
                        @handleEdit="handleEdit($event)" @click="handleClickChild(field, index)"/>
            </uni-col>
          </uni-row>
        </view>
        <!-- 评分 -->
        <view v-else-if="field.Component == 'Rate'" class="uni-flex  work-item">
          <view class="work-item-label">{{ field.Label }}</view>
          <uni-rate v-model="detail[field.Name]" disabled disabledColor="rgb(255, 202, 62)" />
        </view>
        <!-- 如果是图片 -->
        <view v-else-if="field.Component == 'ImgUpload'" class="uni-flex work-item">
          <view class="work-item-label">{{ field.Label }}</view>
            <view class="uni-flex uni-flex-wrap">
            <block v-for="(item, index1) in detail[field.Name]" :key="item.Id">
              <image slot='cover' :src="item.url" class="item-Img" @click.stop="previewImg(detail[field.Name], index1)" />
            </block>
            </view>
        </view>
        <!-- 如果是文件 -->
        <view v-else-if="field.Component == 'FileUpload'" class="border-b border-gray-100 py-2">
          <view class="work-item-label">{{ field.Label }}</view>
            <view v-for="(item, index_file) in detail[field.Name]" :key="item.Id" class="border border-blue-500 p-2 rounded-md border-dashed mt-2"
            @click="handleFileSelect(detail[field.Name], index_file)">
              <text class="text-xs">{{ item.name }}</text>
            </view>
            <!-- <uni-file-picker readonly v-model="detail[field.Name]" :listStyles="listStyles" file-mediatype="all" @click="handleFileSelect(detail[field.Name])">
            </uni-file-picker> -->
        </view>
        <!-- 如果是开关 -->
        <view v-else-if="field.Component == 'Switch'" class="uni-flex items-center border-b border-gray-100 py-2">
          <view class="work-item-label">{{ field.Label }}</view>
          <switch :checked="detail[field.Name] == 1 ? true : false"  disabled style="transform:scale(0.7)"></switch>
        </view>
        <!-- 如果是组织机构 -->
        <view class="work-item" v-else-if="field.Component == 'Department' || field.Component == 'Cascader'">
          <view class="work-item-label">{{ field.Label }}</view>
          <m-cascader
            v-model="detail[field.Name]"
            :options="field.Data"
            :multiple="field.Config.Department.Multiple"
            :fieldProps="{
              value: field.Config.SelectSaveField || 'Id',
              label: field.Config.SelectLabel || 'Name',
              children: '_Child'
            }"
            placeholder="请选择"
            :save-full-path="field.Config.Department.EmitPath"
            :readonly="true"
            :show-border="false"
          />
        </view>
        <!-- 按钮模式 -->
         <view v-else-if="field.Component == 'Button' && type != 'list'">
          <button :type="field.Config.Button.Type" :size="field.Config.Button.Size">
            {{ field.Label }}
          </button>
         </view>
         <!-- 弹出表格 -->
         <view v-else-if="field.Component == 'OpenTable' && type != 'list'" class="work-item">
          <view class="work-item-label">{{ field.Label }}</view>
          <button :type="field.Config.Button.Type" :size="field.Config.Button.Size" disabled>
            {{ field.Config.OpenTable.BtnName || '请选择' }}
          </button>
         </view>
         <!-- 分割线 -->
         <view class="" v-else-if="field.Component == 'Divider'">
            <r-divider content-position="left"
            :customStyle="{
              color: '#1989fa',
              borderColor: '#ccc',
            }">{{ field.Label }}</r-divider>
          </view>
          <!-- 定位 -->
          <view class="uni-common-mt" v-else-if="field.Component == 'Map' && type != 'list'" >
            <view class="work-item-label uni-common-mb-xs">{{ field.Label }}</view>
            <view v-if="detail[`${field.Name}_Lat`] && detail[`${field.Name}_Lng`]">
              <map :latitude="detail[`${field.Name}_Lat`]" :longitude="detail[`${field.Name}_Lng`]" :markers="[{
                latitude: detail[`${field.Name}_Lat`],
                longitude: detail[`${field.Name}_Lng`],
                iconPath: '/static/img/map.png',
                width: 20,
                height: 30,
              }]" style="width: 100%; height: 200px;"></map>
            </view>
          </view>
          <!-- 表单V8模版引擎 -->
        <view  class="work-item" v-else-if="field.Component == 'V8TmpEngineForm'">
          <view class="work-item-label">{{ field.Label }}</view>
          <view v-html="TmpEngineTableForm(field.V8TmpEngineForm)"></view>
        </view>
        <!-- 其他 -->
        <view class="work-item" v-else>
          <view class="work-item-label">{{ field.Label }}</view>
          <view class="item-value uni-flex ">
              <view v-html="TmpEngineTable(detail, diyFormFields, field)"></view>
              <!-- 复合文字 -->
              <view v-if="field.Config && field.Config.TextApend">{{ field.Config.TextApend }}</view>
            </view>
        </view>
      </template>
      </view>
    </view>

    <!-- 新增/编辑子表弹窗 -->
    <uni-popup ref="popupTable" type="bottom" border-radius="10px 10px 0 0">
      <view class="popup-box">
        <view class="popup-content uni-common-pb popup-content-child">
          <view class="popup-close" @click="ChildTableClose()">
            <uni-icons type="closeempty" size="30px" color="#999" />
          </view>
          <child-table v-if="showTableChild" :currentFieldsConfig="currentFieldsConfig" :ParentFormData="detail"
            :isType="isChildType" :ChildFormId="ChildFormId" :ChildDiyTableId="ChildDiyTableId" :key="new Date().getTime()"
            @ChildSubmitOk="ChildSubmitOk" :isChildTable="true" />
        </view>
      </view>
    </uni-popup>
  </view>
</template>
<script setup>
import { provide, computed, ref, inject, onMounted, reactive, nextTick, watch } from 'vue';
import{ TmpEngineTable, previewImg,TmpEngineTableForm, getFileType } from '@/utils'
import TableControl from './tableControl'
import TableEdit from './InTableEditFields.vue';
import ChildTable from '@/pages/workbench/work-add/index.vue';
  const props = defineProps({
		diyFormFields: {
			type: Array,
			default: [],
		},
		detail: {
			type: Object,
			default: {},
		},
    type: {
      type: String,
      default: ''
    },
    // 是否是表内编辑
    InTableEdit: {
      type: [Number, Boolean],
      default: false
    },
    // 表内编辑的字段
    InTableEditFields: {
      type: Array,
      default: []
    },
    // 子表的配置ID
    DiyTableId: {
      type: String,
      default: ''
    },
    //关联表单的guid
    Guid: {
      type: String,
      default: ''
    },
    // 用于子表的总数
    currenTotal: {
      type: Number,
      default: 0
    },
    TableSearchList: {
      type: Object,
      default: {}
    },
    DiyTableData: {
      type: Object,
      default: {}
    },
    FieldsConfig: {
      type: Array,
      default: []
    },
    ParentV8: {
      type: Object,
      default: {}
    },
	})
  const listStyles = {
					// 是否显示边框
					border: true,
					// 是否显示分隔线
					dividline: true,
					// 线条样式
					borderStyle: {
						width: 1,
						color: 'blue',
						style: 'dashed',
						radius: 2
					}
				}
const scrollIntoViewId = ref('') // 滚动到指定元素
const current = ref(0) // 当前选中的tab索引
const formTabs = ref(['']) // 表单分组
const V8 = inject('V8') // 注入微前端方法
const ParentV8 = ref(props.ParentV8) // 加载状态ParentV8
// 当前字段配置
let currentFieldsConfig = reactive({})
let currentModel = reactive({}) // 当前字段配置
const showTableChild = ref(false) // 是否显示子表
const popupTable = ref(null) // 新增/编辑子表弹窗
const tableChild = ref(null) // 子表格实例
const isChildType = ref('') // 新增还是编辑
const ChildFormId = ref('') // 子表表单ID
const ChildDiyTableId = ref('') // 子表自定义表单ID
let diyFormFields = reactive(props.diyFormFields) // 表单字段
const tableChildRefs = diyFormFields.map(() => ref(null)); // 创建一个引用数组

// 动态设置ref的函数
const setTableChildRef = (index) => {
  return (el) => {
    if (el) tableChildRefs[index].value = el; // 将组件实例存储到ref数组中
  }
}
if (props.DiyTableData && props.DiyTableData.Tabs) {
  const tabs = JSON.parse(props.DiyTableData.Tabs)
  formTabs.value = tabs.map((item) => {
    if (item.Name == 'none') {
      return ''
    }
    return item.Name
  }) // 表单分组
  props.diyFormFields.forEach((item) => {
    // 如果没分组，就默认第一个分组
    if (V8.IsNull(item.Tab)) {
      item.Tab = formTabs.value[0]
    }
  })
}
// 点击分组切换
const onClickItem = (e) => {
  current.value = e
  scrollIntoViewId.value = 'tab-' + e
}
const GetV8 = () => {
  return ParentV8.value
}
// 子表点击了
const handleEdit = (event) => {
  console.log('handleEdit', event)
  isChildType.value = event.type
  ChildFormId.value = event.id
  ChildDiyTableId.value = event.DiyTableId
}
// 子表新增/编辑弹窗
const handleClickChild = (item, index) => {
  isChildType.value = uni.getStorageSync('isChildType') 
  console.log('Clicked child component ref:',isChildType.value);
  if (isChildType.value == 'Del' || isChildType.value == '') return;
  currentFieldsConfig = item.Config
  currentModel = item
  tableChild.value = tableChildRefs[index].value
  showTableChild.value = true
  popupTable.value.open()
}
  // 子表弹窗关闭
const ChildTableClose = () => {
  popupTable.value.close()
  isChildType.value = ''
  uni.setStorageSync('isChildType', '')
}
// 子表提交啦
const ChildSubmitOk = async () => {
  isChildType.value = ''
  uni.setStorageSync('isChildType', '')
  // initForm()
  popupTable.value.close()
  showTableChild.value = false
  // 刷新数据
  nextTick(() => {
  tableChild.value.GetData()
  })
}
const handleFileSelect = (detail, index_file) => {
  console.log('handleFileSelect', detail, index_file)
  const fileType = getFileType(detail[index_file].extname)
  console.log('fileType', fileType)
  // 如果是图片则预览
  if (fileType) {
    previewImg(detail, index_file)
  } else {
    const ext = detail[index_file].url.split('.').pop().toLowerCase();
    // 如果是文件则下载
    uni.downloadFile({
      url: detail[index_file].url,
      success: (res) => {
        if (res.statusCode === 200) {
          const filePath = res.tempFilePath;
          uni.openDocument({
            filePath: filePath,
            fileType: ext, // 根据文件类型设置
            success: (res) => {
              console.log('文件打开成功', res);
            },
            fail: (err) => {
              console.log('文件打开失败', err);
            }
          });
        }
      },
      fail: (err) => {
        console.log('文件下载失败', err);
      }
    });
    // uni.navigateTo({
    //   url: '/pages/tools/web-view/index?url=' + detail[index_file].url,
    //   success: (res) => {
    //     console.log('打开网页成功', res)
    //   },
    //   fail: (err) => {
    //     console.log('打开网页失败', err)
    //   }
    // })
  }
}
// 从祖先组件注入 state
provide('parentMethod', handleEdit);
// 表内编辑提交更新数据
const handleEditOK = () => {
  console.log('handleInTableEditOK')
}
// 注入父组件方法
provide('handleEditOK', handleEditOK)
onMounted(() => {
  // console.log('onMounted',diyFormFields)
})
</script>
<style lang="scss" scoped>

.work-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding:18rpx 0;
  border-bottom: #eee 1rpx solid;
}

.work-item-label {
  font-size: 25rpx;
  color: #888;
  margin-right: 10px;
  width: 28%;
  flex-shrink: 0;
}

.item-value {
  font-size: 27rpx;
  color: #222;
  width: 72%;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  flex: 1;
  overflow: scroll;

  :deep(img) {
    max-width: 100%;
    height: auto !important;
  }
}
.table-child{
  overflow: hidden;
}

.item-Img{
  width: 100px;
  height: 100px;
  margin-right: 10px;
}
.work-item ::v-deep .img-container {
    display: inline-block;
  }
  
  .small-img {
    width: 100px;
    height: 100px;
  }
  
  .work-item ::v-deep .overlay {
    display: none;
    position: absolute;
    left: 100%; 
    width: 400px;
    height: auto;
    z-index: 9999;
  }
  
  .large-img {
    width: 100%;
    height: 100%;
    z-index: 9999;
    box-shadow: 0px 0px 10px 5px rgba(0,0,0,0.75);
    border:solid 1px #ccc;
  }
  
  .img-container:hover .overlay {
    display: block;
  }
  .text-red{
    color: red;
  }
  /* 导航条tab start */
.scroll-h {
  width: 750rpx;
  /* #ifdef H5 */
  width: 100%;
  /* #endif */
  height: 100rpx;
  flex-direction: row;
  /* #ifndef APP-PLUS */
  white-space: nowrap;
  /* #endif */
  /* flex-wrap: nowrap; */
  /* border-color: #cccccc;
  border-bottom-style: solid;
  border-bottom-width: 1px; */
}

.uni-tab-item {
  /* #ifndef APP-PLUS */
  display: inline-block;
  /* #endif */
  flex-wrap: nowrap;
  padding-left: 34rpx;
  padding-right: 34rpx;
}

.uni-tab-item-title {
  font-size: 26rpx;
  font-weight: 400;
  letter-spacing: 0px;
  color: rgba(119, 119, 119, 1);
  vertical-align: top;
  line-height: 100rpx;
}

.uni-tab-item-title-active {
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 0px;
  color: #007AFF;
  vertical-align: top;
}
/* 导航条tab end */

::v-deep img {
  width: 100% !important;
  height: 100% !important;
}

.popup-box {
  height: 100vh;
  display: flex;
  align-items: flex-end;
  width: 100%;
}

.popup-content {
  width: 100%;
  background: #fff;
  height: 75vh;
  border-radius: 10px 10px 0 0;
  box-sizing: border-box;
}
.popup-content-child{
  .popup-close {
    text-align: right;
    padding: 20px 20px 0 0;
  }
}
</style>