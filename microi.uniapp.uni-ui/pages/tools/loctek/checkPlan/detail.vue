<template>
  <view class="uni-container">
    <view class="list">
      <view class="list-item" v-if="detail && checkPoint">
        <view class="uni-flex uni-justify-between uni-common-mb-xs">
          <view class="list-item-name">
            {{ detail.LaiyuanJH }}
          </view>
          <view class="list-item-progress">
            {{ calculateProgress(detail.checkPoint || checkPoint) }}
          </view>
        </view>
        <view class="list-item-desc uni-common-mb">
          {{ detail.JianchaKSSJ }} ~ {{ detail.JianchaJSSJ }}
        </view>
        <view class="uni-flex uni-flex-wrap uni-common-mb-xs">
          <view class="list-item-tag" v-for="(tag, index) in checkPoint" :key="index"
            @click="scrollToSection('sectionId' + index)">
            <uni-icons :type="tag.over ? 'checkbox-filled' : 'circle'" size="22" color="#3579F4"
              class="uni-common-mr-xs"></uni-icons>
            <text>{{ tag.FengxianD }}</text>
          </view>
        </view>
        <view class="Divider"></view>
      </view>
      <view class="content" v-for="(tag, index) in checkPoint" :key="index">
        <view :id="'sectionId' + index">
          <view v-if="tag.JianchaQBXYZ" @click="changeScan(tag)" class="uni-flex uni-justify-between uni-common-mb">
            <view class="content-title">{{ tag.FengxianD }}</view>
            <uni-icons type="scan" size="22" color="#3579F4"></uni-icons>
          </view>
          <view v-else @click="tag.show = !tag.show" class="uni-flex uni-justify-between uni-common-mb">
            <view class="content-title">{{ tag.FengxianD }}</view>
            <view class="content-triangle">
              <view class="content-triangle-down" v-if="tag.show"></view>
              <view class="content-triangle-up" v-else></view>
            </view>
          </view>
        </view>
        <view v-if="tag.show">
          <view class="content-desc uni-flex uni-justify-between" v-for="(item, index) in tag.CheckX" :key="index">
            <view class="content-desc-left">
              <view class="drop"></view>
              <view class="line"></view>
            </view>
            <view class="content-desc-right">
              <view class="content-desc-right-item uni-flex">
                <view class="content-desc-right-item-img">
                  <uni-swiper-dot class="uni-swiper-dot-box" @clickItem="clickItem" :info="item.CankaoT"
                    :current="current" mode="nav" field="content">
                    <swiper class="swiper-box" @change="change" :current="swiperDotIndex">
                      <swiper-item v-for="(img, index) in item.CankaoT" :key="index">
                        <image mode='scaleToFill' :src="img.url" class="item-Img"
                          @click.stop="previewImg(item.CankaoT, index)" />
                      </swiper-item>
                    </swiper>
                  </uni-swiper-dot>
                </view>
                <view class="content-desc-right-item-text">
                  <text v-html="item.JianchaNR"></text>
                </view>
              </view>
              <view v-if="item.JianchaJG && (checkPlan.BixuSCZP || checkPlan.ZhinengPZJC)">
                <view class="Divider"></view>
                <view class="uni-common-p">
                  <view class="uni-flex uni-flex-wrap">
                    <block v-for="(img, index1) in item.TupianFK" :key="index1">
                      <image slot='cover' :src="img.url" class="item-TupianFK"
                        @click.stop="previewImg(item.TupianFK, index1)" />
                    </block>
                  </view>
                </view>
              </view>

              <!-- 需要上传图片或拍照 -->
              <view v-if="item.isPaiZhaoShow && !item.JianchaJG">
                <view class="Divider"></view>
                <view class="uni-common-p">
                  <uni-file-picker v-model="item.TupianFK" file-mediatype="image" :imageStyles="imageStyles"
                    :sourceType="checkPlan.ZhinengPZJC ? ['camera'] : ['album', 'camera']"
                    @select="upFileSelect($event, tag, item)" @delete="upFileDelete($event, tag, item)">
                    <uni-icons type="camera" size="40" color="#ccc"></uni-icons>
                  </uni-file-picker>
                </view>
              </view>
              <view class=""
                v-if="(checkPlan.BixuSCZP || checkPlan.ZhinengPZJC) && !item.JianchaJG && !item.isPaiZhaoShow">
                <view class="Divider"></view>
                <uni-file-picker file-mediatype="image" mode="list"
                  :sourceType="checkPlan.ZhinengPZJC ? ['camera'] : ['album', 'camera']"
                  @select="upFileSelect($event, tag, item)">
                  <view class="uni-flex uni-flex-align-center uni-common-p-xs uni-justify-center ">
                    <uni-icons type="camera-filled" size="32" color="#3579F6"></uni-icons>
                    <text class="text-tips">检查结果</text>
                  </view>
                </uni-file-picker>
              </view>
              <view class="" v-else>
                <view class="Divider"></view>
                <radio-group class="uni-flex" @change="radioChange($event, tag, item)">
                  <label class="uni-flex uni-flex-align-center uni-common-p radio-item"
                    v-for="(radio, index) in itemsRadio" :key="index">
                    <view>
                      <radio :value="radio.value" :checked="item.JianchaJG" :disabled="item.JianchaJG ? true : false"
                        :activeBackgroundColor="radio.value == '不合格' ? '#E34242' : '#3579F6'" />
                    </view>
                    <view>{{ radio.name }}</view>
                  </label>
                </radio-group>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view class="sub-btn" v-if="Zhuangtai == 0">
      <button type="primary" :loading="isLoading" @click="submit">提交</button>
    </view>
  </view>
</template>
<script setup>
import { ref, onMounted, inject } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { calculateProgress, changeTu } from './public.js'
import { previewImg, GetServerPath, scanCodeH5, uploadFile } from '@/utils'
import { useStore } from 'vuex';
const store = useStore();
const Microi = inject('Microi')
const detail = ref({})
const swiperDotIndex = ref(0)
const current = ref(0)
const itemsRadio = [
  {
    value: '不合格',
    name: '不合格'
  },
  {
    value: '合格',
    name: '合格'
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
const checkPoint = ref([]) // 风险点列表
const checkPlan = ref({}) // 计划详情
const isLoading = ref(false)
const TableId = '61fbf32b-a99d-4df7-a874-34b926fab8ce'
const Zhuangtai = ref('')

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
const radioChange = async (e, tag, item) => {
  const QiangzhiXJLX = await forceCheck(tag, item)
  if (QiangzhiXJLX) return item.JianchaJG = false
  saveData({ JianchaJG: e.detail.value }, 'JianchaJG', tag, item)
}

// 文件上传
const upFileSelect = async (e, tag, item) => {
  item.isPaiZhaoShow = true
  const QiangzhiXJLX = await forceCheck(tag)
  if (QiangzhiXJLX) return item.TupianFK = []
  const res = await uploadFile(e.tempFilePaths, { Component: 'ImgUpload' })
  if (res.Code == 1) {
    // 如果有值，就追加，没有就赋值
    if (item.TupianFK) {
      item.TupianFK = [...item.TupianFK, ...res.Data]
    } else {
      item.TupianFK = res.Data
    }
  }
  saveData({ TupianFK: JSON.stringify(item.TupianFK) }, 'TupianFK', tag, item)
}

// 文件删除
const upFileDelete = (e, tag, item) => {
  const index = item.TupianFK?.findIndex(item => item.Url == e.url)
  if (index > -1) {
    item.TupianFK.splice(index, 1)
  }
  saveData({ TupianFK: JSON.stringify(item.TupianFK) }, 'TupianFK', tag, item)
}

// 获取列表数据
const getListData = async () => {
  Microi.ShowLoading('加载中···')
  const res = await Microi.ApiEngine.Run('GetChckPlanDetail', {
    Id: detail.value.Id,
    LaiyuanJHID: detail.value.LaiyuanJHID,
  })
  if (res.Code == 1) {
    checkPlan.value = res.diy_checkPlan
    checkPoint.value = res.CheckPoint.map((item) => {
      // 判断是否需要扫码验证 并且风险点没提报完成
      if (checkPlan.value.JianchaQBXYZ && item.over != 1) {
        item.JianchaQBXYZ = true
        item.show = false
      } else {
        if (item.over) {
          item.show = false
        } else {
          item.show = true
        }
      }
      item.CheckX = item.CheckX.map((i) => {
        // 处理图片路径
        i.CankaoT = changeTu(i.CankaoT)
        i.TupianFK = changeTu(i.TupianFK)
        i.isPaiZhaoShow = true
        return i
      })
      return {
        ...item,
      }
    })
    const requiredData = ['JianchaJG']
    if (checkPlan.value.BixuSCZP || checkPlan.value.ZhinengPZJC) {
      requiredData.push('TupianFK')
    }
    store.commit('tableEdit/SET_CHILD_TABLE_REQUIRED', { requiredData: requiredData, TableId: TableId }) // 设置子表必填项
    // 周末不执行
    if (checkPlan.value.GongzuoRBZH && (new Date().getDay() == 0 || new Date().getDay() == 6)) {
      uni.showModal({
        title: '提示',
        content: '周末不执行',
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
    }
    Microi.HideLoading()
  }
  Microi.HideLoading()
}
// 扫码验证
const changeScan = async (tag) => {
  const QiangzhiXJLX = await forceCheck(tag)
  if (QiangzhiXJLX) return
  const res = await scanCodeH5()
  // 查看checkPoint.value中是否有对应的位置
  const index = checkPoint.value.findIndex(item => item.WeizhiM == res)
  if (index > -1) {
    checkPoint.value[index].JianchaQBXYZ = false
    checkPoint.value[index].show = true
  } else {
    Microi.ConfirmTips('扫码验证失败', null, {
      ShowCancel: false,
    })
  }
  // if (tag.WeizhiM == res) {
  //   tag.JianchaQBXYZ = false
  //   tag.show = true
  // } else {
  //   // Microi.Tips('扫码验证失败', false)
  //   Microi.ConfirmTips('扫码验证失败', null, {
  //     ShowCancel: false,
  //   })
  // }
}
// 强制执行巡检路线
const forceCheck = async (tag, row) => {
  return new Promise(resolve => {
    if (checkPlan.value.QiangzhiXJLX) {
      // 如果前面的风险点没有完成，则强制执行
      const over = checkPoint.value.some(item => {
        if (item.Paixu < tag.Paixu && item.over != 1) {
          if (row) row.JianchaJG = true  // 为了阻止单选框的默认值
          return true
        }
      })
      if (over) {
        Microi.ConfirmTips('设置了强制执行巡检路线，请先完成前面的风险点', null, {
          ShowCancel: false,
        })
        resolve(true)
      }
    }
    resolve(false)
  })
}
// 提交
const submit = async () => {
  isLoading.value = true
  let hasMissingData = false; // 用于跟踪是否有缺失的数据
  const { Child_TableData_Edit, Child_Table_Required } = store.state.tableEdit
  const currentFormChild = Child_TableData_Edit[detail.value.Id]
  if (!currentFormChild) {
    Microi.Tips('请填写检查结果', false)
    isLoading.value = false
    hasMissingData = true; // 标记有缺失的数据
    return
  }
  const combinedArray = Object.values(currentFormChild).reduce((acc, val) => acc.concat(val), []);
  // 检查必填项是否都有值
  const requiredData = Child_Table_Required[TableId]
  // const isAllRequired = requiredData.every(item => {
  //   return combinedArray.some(child => {
  //     return child._FormData[item]
  //   }) 
  // })
  // if (!isAllRequired) {
  //   Microi.Tips('请填写必填项', false)
  //   isLoading.value = false
  //   return
  // }
  // 检查必填项是否填写，没有则提示哪一项没填
  requiredData.forEach(element => {
    combinedArray.forEach(child => {
      if (!child._FormData[element]) {
        Microi.Tips(`请填写${element == 'TupianFK' ? '上传照片' : '检查结果'}`, false)
        isLoading.value = false
        hasMissingData = true; // 标记有缺失的数据
        return false
      }
    })
    if (hasMissingData) {
      return false; // 如果有缺失的数据，跳出外部循环
    }
  });
  if (hasMissingData) return hasMissingData = false
  const res = await Microi.FormEngine.UptFormDataBatch(combinedArray)
  if (res.Code == 1) {
    const res1 = await Microi.ApiEngine.Run('update_planSpeed', {
      Id: detail.value.Id,
      LaiyuanJHID: detail.value.LaiyuanJHID,
    })
    if (res1.Code == 1) {
      Microi.Tips('提交成功')
      uni.navigateBack()
    }
  } else {
    Microi.Tips('提交失败', false)
  }
  isLoading.value = false
}
onLoad((options) => {
  Zhuangtai.value = options.Zhuangtai
})
onMounted(() => {
  detail.value = JSON.parse(uni.getStorageSync('checkPlanDetail'))
  getListData()
})
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

      .item-Img {
        width: 100%;
        height: 100%;
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

.sub-btn {
  position: fixed;
  bottom: 0rpx;
  left: 0;
  right: 0;
  background-color: white;
  padding: 20rpx;
  z-index: 3
}
</style>