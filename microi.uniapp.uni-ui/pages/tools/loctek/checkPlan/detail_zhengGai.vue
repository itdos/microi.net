<template>
  <view class="uni-container">
    <view class="list">
      <view class="list-item" v-if="detail">
        <view class="uni-flex uni-justify-between uni-common-mb-xs">
          <view class="list-item-name">
            {{ detail.RenwuM }}
          </view>
          <view class="list-item-progress"
            :class="{ 'Ongoing': detail.ZhenggaiZT == '进行中' || detail.ZhenggaiZT == '待审核', 'Expired': detail.ZhenggaiZT == '过期未完成' || detail.ZhenggaiZT == '已作废' }">
            {{ detail.ZhenggaiZT }}
          </view>
        </view>
        <view class="list-item-desc uni-common-mb">
          {{ detail.KaishiSJ1 }} ~ {{ detail.YujiJSSJ }}
        </view>
        <view class="list-item-content uni-common-mb">
          {{ detail.YichangMS }}
        </view>
        <view class="item-YichangTP  uni-common-mb" v-if="detail.YichangTP && detail.YichangTP.length > 0">
          <uni-swiper-dot class="uni-swiper-dot-box" @clickItem="clickItem" :info="detail.YichangTP" :current="current"
            mode="nav" field="content">
            <swiper class="swiper-box" @change="change" :current="swiperDotIndex">
              <swiper-item v-for="(img, index) in detail.YichangTP" :key="index">
                <image mode='scaleToFill' :src="img.url" class="item-Img"
                  @click.stop="previewImg(detail.YichangTP, index)" />
              </swiper-item>
            </swiper>
          </uni-swiper-dot>
        </view>
        <view class="Divider"></view>
      </view>
      <view class="content">
        <view>
          <view class="uni-flex uni-justify-between uni-common-mb">
            <view class="content-title">整改结果</view>
            <!-- <view class="zhuanyi-btn" @click="Changezhuanyi" v-if="!detail.ShifouYJ && Zhuangtai != 1">
              <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="27" height="20"
                viewBox="0 0 55.125 39.37548828125" fill="none">
                <path
                  d="M21.2055 0.670856C20.5668 0.101472 19.6317 0.183005 19.1118 0.881765C18.8891 1.17421 18.7556 1.56435 18.7704 1.939L18.7704 9.32214C15.4592 9.58224 -1.26044 16.1851 0.0758541 39.3755C3.99612 31.423 9.38558 22.9173 18.7556 22.1208L18.7556 30.789C18.7556 31.6838 19.409 32.4317 20.2254 32.4317C20.5964 32.4317 20.968 32.2855 21.235 32.0086L36.128 17.0631C36.7518 16.4775 36.8404 15.4533 36.3064 14.77C36.2467 14.7047 36.1876 14.6238 36.128 14.5746L21.2055 0.670856ZM50.4722 38.1404C50.2347 38.5636 49.8483 38.856 49.4176 38.9537L49.0614 38.9537C48.7347 38.9537 48.408 38.856 48.1257 38.6613L47.3978 38.1242C46.67 37.571 46.4621 36.4983 46.9376 35.685C52.1794 25.6672 52.1794 13.3563 46.9376 3.33854C46.4774 2.49289 46.6854 1.40331 47.4274 0.833923L48.1552 0.313728C48.9273 -0.255657 49.9818 -0.0279027 50.4863 0.817751C50.4863 0.833923 50.5011 0.833923 50.5011 0.850095C56.6786 12.38 56.6639 26.6422 50.4722 38.1404ZM42.5578 31.5699C42.2908 31.9762 41.9044 32.2363 41.459 32.3179L41.192 32.3179C40.821 32.3179 40.4641 32.1878 40.1676 31.9439L39.4847 31.3745C38.7722 30.7728 38.6086 29.6832 39.1285 28.8699C42.6181 23.1781 42.6181 15.7457 39.1285 10.0539C38.6234 9.25678 38.7722 8.15103 39.4847 7.5493L40.1676 6.97991C40.88 6.34584 41.9198 6.47588 42.4987 7.25618C42.5282 7.28853 42.5584 7.33772 42.5732 7.37006C47.0865 14.6892 47.0865 24.2683 42.5578 31.5699Z"
                  fill="#3979F0">
                </path>
              </svg>
              <text class="uni-common-ml-xs">转移</text>
            </view> -->
          </view>
        </view>
        <view>
          <view class="content-desc uni-flex uni-justify-between">
            <view class="content-desc-right">
              <!-- 需要上传图片或拍照 -->
              <view>
                <view class="uni-common-p">
                  <view class="uni-flex uni-flex-wrap" v-if="Zhuangtai == 1">{{ detail.ZhenggaiMS }}</view>
                  <uni-easyinput v-else type="textarea" autoHeight v-model="detail.ZhenggaiMS"
                    placeholder="(必填)请输入整改情况描述···" :inputBorder="false"></uni-easyinput>
                </view>
                <view class="Divider"></view>
                <view class="uni-common-p">
                  <uni-file-picker v-model="detail.Tupian" file-mediatype="image" :imageStyles="imageStyles"
                    :sourceType="['album', 'camera']" :readonly="Zhuangtai == 1 || !isCheckWeixiuRID"
                    @select="upFileSelect($event)" @delete="upFileDelete($event)">
                    <uni-icons type="camera" size="40" color="#ccc"></uni-icons>
                  </uni-file-picker>
                </view>
              </view>
              <view class="">
                <view class="Divider"></view>
                <radio-group class="uni-flex" @change="radioChange1($event)" v-if="detail.ZhenggaiZT != '待审核'">
                  <label class="uni-flex uni-flex-align-center uni-common-p radio-item"
                    v-for="(radio, index) in itemsRadio" :key="index">
                    <view>
                      <radio :value="radio.value" :checked="radio.value == detail.ZhenggaiJGZ"
                        :activeBackgroundColor="radio.value == '未完成' ? '#E34242' : '#3579F6'"
                        :disabled="Zhuangtai == 1 || !isCheckWeixiuRID" />
                    </view>
                    <view>{{ radio.name }}</view>
                  </label>
                </radio-group>
                <radio-group class="uni-flex" @change="radioChange2($event)" v-else>
                  <label class="uni-flex uni-flex-align-center uni-common-p radio-item"
                    v-for="(radio, index) in itemsRadio2" :key="index">
                    <view>
                      <radio :value="radio.value" :checked="radio.value == detail.ZhenggaiJG"
                        :activeBackgroundColor="radio.value == '不通过' ? '#E34242' : '#3579F6'"
                        :disabled="Zhuangtai == 1 || !isCheckWeixiuRID" />
                    </view>
                    <view>{{ radio.name }}</view>
                  </label>
                </radio-group>
              </view>
            </view>
          </view>
          <view class="close-wrap">
            <!-- <view class="close" @click="closeIt">无需整改？点击此处提交关闭审核👈</view> -->
          </view>
        </view>
      </view>
    </view>
    <view class="sub-btn" v-if="Zhuangtai != 1 && isCheckWeixiuRID">
      <button type="primary" :loading="isLoading" :disabled="isLoading" @click="submit">提交</button>
    </view>
    <!-- 下拉选择 -->
    <uni-popup ref="popupSelect" type="bottom" border-radius="10px 10px 0 0">
      <select-control :currentModel="currentModel" :currentFieldsConfig="currentFieldsConfig" :isMultiSelect="false"
        :list="selectList" @onSelectChange="onSelectChange" :key="new Date().getTime()" />
    </uni-popup>
  </view>
</template>
<script setup>
import { ref, onMounted, inject, watch } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { calculateProgress, changeTu } from './public.js'
import { previewImg, GetServerPath, scanCodeH5, uploadFile, diyFormField } from '@/utils'
import { useStore } from 'vuex';
import SelectControl from '@/FormComponents/selectControl.vue'
const store = useStore();
const Microi = inject('Microi')
const detail = ref({})
const swiperDotIndex = ref(0)
const current = ref(0)
const isInCheck = ref(false)
const originDetail = ref(null)// 原始数据
const isShenheR = ref(false)// 是否是审核人

onLoad(async (options) => {
  console.log(options, 'options')
  Zhuangtai.value = options.Zhuangtai
  const Id = options.Id

  var Result = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'diy_zhenggai_list',
    _Where: [{ Name: 'Id', Value: Id, Type: '=' }]
  });
  detail.value = Result.Data
  originDetail.value = detail.value
  checkJurisdiction();
  getListData()
})

watch(originDetail, (newVal, oldVal) => {
  if (newVal.ZhenggaiZT == '待审核') {
    isInCheck.value = true
    console.log('newVal.ZhenggaiJG', newVal.ZhenggaiZT)
  }
})

const itemsRadio = [
  {
    value: '未完成',
    name: '未完成'
  },
  {
    value: '完成',
    name: '完成'
  }
]
const itemsRadio2 = [
  {
    value: '不通过',
    name: '不通过'
  },
  {
    value: '通过',
    name: '通过'
  }
]
const imageStyles = {
  width: 75,
  height: 75,
  "border": { // 如果为 Boolean 值，可以控制边框显示与否
    "color": "#eee",		// 边框颜色
    "width": "1px",		// 边框宽度
    "style": "solid", 	// 边框样式
    "radius": "20%" 		// 边框圆角，支持百分比
  }
}
const isLoading = ref(false)
const TableId = '5170a423-435d-4c51-9d0a-f087bf59534c'
const Zhuangtai = ref('')
const popupSelect = ref(null)
const selectList = ref([])
const currentModel = ref({})
const currentFieldsConfig = ref({})
const clickItem = (e) => {
  swiperDotIndex.value = e
}
const change = (e) => {
  current.value = e.detail.current
}
const scrollToSection = (sectionId) => {
  console.log(sectionId, '滚动到对应位置')
  const query = uni.createSelectorQuery().in(this); // 确保选择器是在当前组件上下文中
  query.select(`#${sectionId}`).boundingClientRect(rect => {
    console.log(rect, '元素位置');
    if (rect) {
      uni.pageScrollTo({
        scrollTop: rect.top,
        duration: 300 // 滚动动画持续时间，单位 ms
      });
    } else {
      console.error(`未找到ID为'${sectionId}'的元素`);
    }
  }).exec(); // 执行选择器查询
}
// 储存数据
const saveData = (formData, Name, tag, item) => {
  const obj = {
    TableId: TableId,
    Id: item.Id,
    _FormData: {
      ...formData
    }
  }
  store.commit('tableEdit/SET_CHILD_TABLE_DATA_EDIT', { obj: obj, Name: Name, parentId: detail.value.Id, Guid: tag.Id })
}
// 单选框
const radioChange1 = (e) => {
  detail.value.ZhenggaiJGZ = e.detail.value
}
const radioChange2 = (e) => {
  detail.value.ZhenggaiJG = e.detail.value
}

// 文件上传
const upFileSelect = async (e) => {
  const res = await uploadFile(e.tempFilePaths, { Component: 'ImgUpload' })
  if (res.Code == 1) {
    // 如果有值，就追加，没有就赋值
    if (detail.value.Tupian) {
      detail.value.Tupian = [...detail.value.Tupian, ...res.Data]
    } else {
      detail.value.Tupian = res.Data
    }
  }
}

// 文件删除
const upFileDelete = (e, tag, item) => {
  const index = detail.value.Tupian?.findIndex(item => item.Url == e.url)
  if (index > -1) {
    detail.value.Tupian.splice(index, 1)
  }
}
// 获取转移人数据
const getSelectList = async () => {
  var mession = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'diy_zhenggai_renwufenpei',
    Id: detail.value.Guid,//Id与_Where两者必传其一
  });
  if (mession.Code == 1) {
    var RenwuFLID = mession.Data.RenwuFLID;
    if (!RenwuFLID) {
      return
    }
    var fenleiInfo = await Microi.FormEngine.GetFormData({
      FormEngineKey: 'diy_zhenggai_fenlei',
      Id: RenwuFLID//Id与_Where两者必传其一
    });

    var Bumen = JSON.parse(fenleiInfo.Data.Bumen)
    var DeptCode = Bumen[Bumen.length - 1]
    var bumenUserList = await Microi.FormEngine.GetTableData({
      FormEngineKey: 'sys_user',
      _Where: [{ Name: 'DeptCode', Value: DeptCode, Type: '=' }]
    });
    var array = []
    if (bumenUserList.Code == 1 && bumenUserList.DataCount > 0) {
      bumenUserList.Data.forEach(item => {
        if (item.Id != detail.value.ZhenggaiRID) {
          var rows = {
            "Account": item.Account,
            "Name": item.Name,
            "userName": item.Account + '/ ' + item.Name,
            "Id": item.Id,
            "value": item.Id
          }
          array.push(rows)
        }
      })
    }
    currentModel.value.Data = array;
    selectList.value = array;
  }
}
// 获取列表数据
const getListData = async () => {
  Microi.ShowLoading('加载中···')
  detail.value.YichangTP = changeTu(detail.value.YichangTP)
  detail.value.Tupian = JSON.parse(detail.value.Tupian)
  detail.value.ZhenggaiJGZ = detail.value.ZhenggaiZT == '已完成' ? '完成' : '未完成'
  if (detail.value.ZhenggaiZT == "未开始" && isCheckWeixiuRID.value) {
    submitData((res) => { console.log(res) })
  }
  const formFields = await diyFormField({ TableId: TableId, _SelectFields: ['YijiaoR'] }) // 获取表单字段
  currentFieldsConfig.value = formFields[0].Config
  currentModel.value = formFields[0]
  if (detail.value.YijiaoZT == '转移中') {
    uni.showModal({
      title: '提示',
      content: '该任务在转移中，无法提报',
      showCancel: false,
      success: function (res) {
        if (res.confirm) {
          console.log('用户点击确定');
          uni.navigateBack()
        } else if (res.cancel) {
          console.log('用户点击取消');
        }
      }
    });
  } else {
    getSelectList() // 获取转移人数据
  }
  Microi.HideLoading()

  console.log('afterGetDetailData', detail.value)
  console.log('originDetail', originDetail.value)
}

function getCurrentFormattedTime() {
  const now = new Date();

  // 获取各个时间部分
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份从 0 开始，需加 1
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // 拼接为指定格式
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
const submitData = async (callback) => {
  let nextZhenggaiZT = '进行中'
  let nextZhenggaiJGZ = '进行中'

  if (isCheck.value) {
    nextZhenggaiZT = '待审核'
  } else {
    nextZhenggaiZT = detail.value.ZhenggaiJGZ == '完成' ? '已完成' : '进行中'
    nextZhenggaiJGZ = detail.value.ZhenggaiJGZ
  }


  console.log('nextZhenggaiZT', nextZhenggaiZT)
  console.log('nextZhenggaiJGZ', nextZhenggaiJGZ)
  let _FormData = {
    ZhenggaiMS: detail.value.ZhenggaiMS,
    ZhenggaiZT: nextZhenggaiZT,//整改状态
    Tupian: JSON.stringify(detail.value.Tupian),
    ZhenggaiJGZ: detail.value.ZhenggaiJGZ,//整改结果
    ZhenggaiJG: detail.value.ZhenggaiJG//审核结果
  }
  if (detail.value.ZhenggaiZT == '待审核') {
    _FormData.ZhenggaiZT = '已完成'
    _FormData.ZhenggaiJGZ = detail.value.ZhenggaiJG
    _FormData.ShijiWCSJ = getCurrentFormattedTime()//实际完成时间（目前取审核时间）
  }
  const formData = {
    TableId: TableId,
    Id: detail.value.Id,
    _FormData: _FormData
  }

  const res = await Microi.FormEngine.UptFormData(formData)
  callback(res)
}

// 提交关闭
const closeIt = async () => {
  uni.showModal({
    title: '是否要关闭？',
    cancelText: '否',
    confirmText: '是',
    success: res => {
      if (res.confirm) {
        isLoading.value = true

        // 修改下级任务为完成
        Microi.FormEngine.UptFormDataByWhere({
          FormEngineKey: 'diy_zhenggai_list',
          _Where: [{ Name: 'ZhurenWID', Value: detail.value.Id, Type: '=' }],
          _RowModel: {
            ZhenggaiZT: '已关闭'
          }
        });
        // 整改完成，通知审核人
        Microi.ApiEngine.Run('zhenggaiRW_SendMessageShenHR', {
          Guid: detail.value.Guid,
          RenwuM: detail.value.RenwuM
        })
        // 通知检查计划任务啊
        Microi.FormEngine.UptFormData({
          FormEngineKey: 'diy_zhenggai_renwufenpei',
          Id: detail.value.Guid,//必传
          _RowModel: {
            ZhenggaiZT: '已关闭'//要修改的字段，注意字段值不能是{}或[]，需要序列化
          }
        });

        submitData((res) => {
          if (res.Code == 1) {
            Microi.Tips('提交成功')
            uni.navigateBack()
          } else {
            Microi.Tips('提交失败', false)
          }
        })
        isLoading.value = false
      }
    }
  });
  return;

}


const isCheck = ref(false)
// 判断是否是维修人
const isCheckWeixiuRID = ref(false)
// 判断是否为审核人
const isCheckJurisdiction = ref(false)
// 判断审核人权限
const checkJurisdiction = async () => {
  let Guid = detail.value.Guid
  const res = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'diy_zhenggai_renwufenpei',
    Id: Guid
  })

  if (res.Code == 0 || res.Data.length == 0) {
    //提出人就是审核人
    Microi.Tips('查询审核人失败', false)
  }
  console.log('审核人列表', res)
  if (res.Code == 1) {
    let ShenheRIDQ = res.Data.ShenheRIDQ
    let WeixiuRID = res.Data.WeixiuRID

    try {
      ShenheRIDQ = JSON.parse(ShenheRIDQ)
    } catch (e) {
      ShenheRIDQ = [ShenheRIDQ]
    }

    let nowPeople = Microi.GetCurrentUser().Id
    console.log('当前用户', ShenheRIDQ.includes(nowPeople), ShenheRIDQ, nowPeople)
    // 判断是否是维修人
    isCheckWeixiuRID.value = WeixiuRID == nowPeople // 维修人
    //当前用户不再审核人列表中
    isCheckJurisdiction.value = ShenheRIDQ.includes(nowPeople)// 审核人
  }

}

// 提交
const submit = async () => {


  let nextZhenggaiZT = '进行中'
  if (detail.value.ZhenggaiJGZ != '未完成') {
    // 直接选择完成提交且整改状态处于进行中，下一状态会进入审核
    if (detail.value.ZhenggaiZT == '未开始' || detail.value.ZhenggaiZT == '进行中') {
      isCheck.value = true
      nextZhenggaiZT = '待审核'
    }
  }
  let _rowModel = {
    ZhenggaiZT: nextZhenggaiZT,
  }

  if (detail.value.ZhenggaiJG == '通过' || detail.value.ZhenggaiJG == '不通过') {
    nextZhenggaiZT = '已完成'
    _rowModel.ZhenggaiJG = detail.value.ZhenggaiJG
    _rowModel.ZhenggaiZT = nextZhenggaiZT
    if (!isCheckJurisdiction.value) {
      uni.showToast({
        title: '您没有审核权限',
        icon: 'none'
      })
      return
    }
  }


  console.log("下一个整改状态diy_zhenggai_renwufenpei", nextZhenggaiZT)
  console.log("下一个整改状态diy_zhenggai_list", _rowModel)
  console.log("审核结果", detail.value.ZhenggaiJG)
  console.log('整改结果', detail.value.ZhenggaiJGZ)
  uni.showModal({
    title: '是否要提交？',
    cancelText: '否',
    confirmText: '是',
    success: res => {
      if (res.confirm) {
        isLoading.value = true
        if (!detail.value.ZhenggaiMS) {
          Microi.Tips('请填写整改情况描述', false)
          isLoading.value = false
          return
        }
        if (!detail.value.ZhenggaiJGZ) {
          Microi.Tips('请填写整改结果', false)
          isLoading.value = false
          return
        }
        if (!originDetail.value.ZhenggaiJG && originDetail.value.ZhenggaiZT == '待审核') {
          Microi.Tips('请填写审核结果', false)
          console.log('originDetail.value.ZhenggaiJG', originDetail.value.ZhenggaiJG)
          console.log('originDetail.value.ZhenggaiZT', originDetail.value.ZhenggaiZT)
          isLoading.value = false
          return
        }

        //  提交前处理事件
        if (detail.value.ZhenggaiJGZ == '完成' || detail.value.ZhenggaiZT == '待审核') {
          console.log('提交前处理事件1111111111111111111111111111111', nextZhenggaiZT)
          // 修改下级任务为完成
          Microi.FormEngine.UptFormDataByWhere({
            FormEngineKey: 'diy_zhenggai_list',
            _Where: [{ Name: 'ZhurenWID', Value: detail.value.Id, Type: '=' }],
            _RowModel: _rowModel,
          });
          // 整改完成，通知审核人
          Microi.ApiEngine.Run('zhenggaiRW_SendMessageShenHR', {
            Guid: detail.value.Guid,
            RenwuM: detail.value.RenwuM,
            ZhenggaiZT: originDetail.value.ZhenggaiZT,
            ZhenggaiJG: detail.value.ZhenggaiJG,
          })



          // 通知检查计划任务啊
          Microi.FormEngine.UptFormData({
            FormEngineKey: 'diy_zhenggai_renwufenpei',
            Id: detail.value.Guid,//必传
            _RowModel: {
              ZhenggaiZT: nextZhenggaiZT
            }
          });
        }

        submitData((res) => {
          if (res.Code == 1) {
            Microi.Tips('提交成功')
            console.log('提交成功整改结果', detail.value.ZhenggaiJGZ)
            console.log('提交成功审核结果', detail.value.ZhenggaiJG)
            Microi.RouterPush('status/success')
            // 等待两秒钟后返回上一页
            setTimeout(() => {
              const pages = getCurrentPages();
              if (pages.length > 2) {
                setTimeout(() => {
                  uni.navigateBack({ delta: 2 });
                }, 2000);
              } else {
                uni.switchTab({ url: '/pages/naviBar/workbench/index' })
              }
            }, 2000)  // 延迟（2秒）

          } else {
            Microi.Tips('提交失败', false)
          }
        })
        isLoading.value = false
      } else {
        console.log('取消提交', detail.value)
      }
    }
  });
}
// 转移点击打开
const Changezhuanyi = async () => {
  popupSelect.value.open()
}
// 确认下拉框
const onSelectChange = (e) => {
  console.log(e)
  if (e == 'close') {
    popupSelect.value.close()
  } else {
    detail.value.YijiaoRID = e.Id // 转移人ID
    detail.value.YijiaoR = e.userName // 转移人名称
    popupSelect.value.close()
    zhuangyiSubmit()
  }
}
// 转移中处理提交数据
const zhuangyiSubmit = async () => {
  // 查询转移人数据
  var userInfo = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'sys_user',//必传
    Id: detail.value.YijiaoRID
  });
  if (userInfo.Code != 1) {
    Microi.Tips('获取转移人信息失败', false)
    return
  }
  var row1 = {
    ZhenggaiRW: detail.value.RenwuM,
    ZhenggaiRWID: detail.value.Id,
    YuanzhengGR: detail.value.ZhenggaiRXM,
    YuanzhengGRID: detail.value.ZhenggaiRID,
    YijiaoZGR: userInfo.Data.Account + '\ ' + userInfo.Data.Name,
    XinzhengGRID: detail.value.YijiaoRID,
    YijiaoZT: '',
  }
  // 新增一条转移数据
  const res = await Microi.FormEngine.AddFormData({
    FormEngineKey: 'diy_moveZhengGaiWork',//必传
    _RowModel: row1
  })
  if (res.Code != 1) {
    Microi.Tips('新增转移数据失败', false)
    return
  }
  // 修改原任务数据
  const res1 = await Microi.FormEngine.UptFormData({
    FormEngineKey: 'diy_zhenggai_list',
    Id: detail.value.Id,//必传
    _RowModel: {
      ShifouYJ: 1,
      YijiaoRID: detail.value.YijiaoRID,
      YijiaoZT: '转移中',
      YijiaoR: detail.value.YijiaoR
    }
  });
  if (res1.Code != 1) {
    Microi.Tips('修改原任务数据失败', false)
    return
  }
  // 通知转移人消息
  var Content = `<b>整改任务转移提醒</b> \n 尊敬的${detail.value.UserName} \n 您团队的${detail.value.ZhenggaiRXM}有条【${detail.value.RenwuM}】,需要转移给${userInfo.Data.Account + '\ ' + userInfo.Data.Name}。需要您的审批。`
  const res2 = await Microi.ApiEngine.Run('checkPlan_feishu_send_msg', {
    AppKey: 'MicroiH5',//MicroiH5
    MsgType: 'text',
    Receiver: detail.value.UserId,
    Content: Content
  })
  if (res2.Code != 1) {
    Microi.Tips('通知转移人消息失败', false)
    return
  }
  Microi.Tips('转移成功')
  uni.navigateBack()
}


</script>
<style lang="scss" scoped>
@import './index.scss';

.list {
  padding-bottom: 5em;
}

.list-item {
  box-shadow: none;
  margin-bottom: 10px;
}

.Divider {
  height: 1px;
  background-color: #DDDDDD;
}

.item-YichangTP {
  width: 200px;
  height: 200px;
  border-radius: 15px;
  overflow: hidden;

  .swiper-box {
    height: 200px;
  }
}

.content {
  padding: 10px 20px;

  &-title {
    font-size: 19px;
    font-weight: 400;
  }

  &-desc {
    margin-bottom: 20px;

    &-left {
      .drop {
        width: 12px;
        height: 12px;
        opacity: 1;
        background: #3579F4;
        border-radius: 50%;
      }

      .line {
        width: 1px;
        height: 100%;
        background-color: #DDDDDD;
        margin-top: 10px;
      }

      margin-right: 10px;
      margin-top: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    &-right {
      flex: 1;
      border-radius: 15px;
      background: #FFFFFF;
      box-shadow: 0px 20px 60px rgba(102, 127, 191, 0.25);

      &-item {
        padding: 20px;
      }

      &-item-img {
        width: 84px;
        height: 115px;
        flex-shrink: 0;
        margin-right: 10px;

        .swiper-box {
          height: 115px;
        }
      }

      &-item-text {
        font-size: 15px;
        font-weight: 400;
        color: #444444;
        line-height: 25px;
      }

      .radio-item {
        width: 50%;
        justify-content: center;
        font-size: 17px;
      }

      .radio-item:first-child {
        border-right: 1px solid #DDDDDD;
      }
    }
  }

  &-triangle {
    // transform: scale(0.7);
    background: #555555;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;

    &-up {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 8px solid white;
    }

    &-down {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 8px solid white;
    }
  }

  .item-TupianFK {
    width: 75px;
    height: 75px;
    border-radius: 20px;
    margin-right: 8px;
  }

  .text-tips {
    font-size: 17px;
    margin-left: 10px;
    font-weight: 400;
    color: #444444;
  }
}

.item-Img {
  width: 100%;
  height: 100%;
}

.sub-btn {
  position: fixed;
  bottom: 0rpx;
  left: 0;
  right: 0;
  background-color: white;
  padding: 20rpx;
  z-index: 3
}

::v-deep .uni-easyinput__placeholder-class {
  font-size: 15px;
}

.zhuanyi-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 28px;
}

.close-wrap {
  min-height: 40px;
  margin-top: 40px;
}

.close-wrap .close {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: #007aff;
  cursor: pointer;
}

.close-wrap .close image {
  width: 20px;
  height: 20px;
}

::v-deep .uni-easyinput__content-textarea {
  min-height: 20px;
  height: 20px;
}

::v-deep .uni-scroll-view-content {
  display: inline-block;
}
</style>