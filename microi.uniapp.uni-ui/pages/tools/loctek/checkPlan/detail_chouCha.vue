<template>
  <view class="uni-container">
    <view class="list">
      <view class="list-item" v-if="detail && checkPoint">
        <view class="uni-flex uni-justify-between uni-common-mb-xs">
          <view class="list-item-name">
            {{ detail.RenwuM }}
          </view>
          <view class="list-item-progress"
            :class="{ 'Ongoing': detail.Zhuangtai == '进行中', 'Expired': detail.Zhuangtai == '已作废' }">
            {{ detail.Zhuangtai }}
          </view>
        </view>
        <view class="list-item-desc uni-common-mb">
          {{ detail.KaishiSJ }} ~ {{ detail.JieshuSJ }}
        </view>
        <view class="uni-flex uni-flex-wrap uni-common-mb-xs">
          <view class="list-item-tag" v-for="(tag, index) in checkPoint" :key="index"
            @click="scrollToSection('sectionId' + index)">
            <uni-icons :type="tag.TibaoWB ? 'checkbox-filled' : 'circle'" size="22" color="#3579F4"
              class="uni-common-mr-xs"></uni-icons>
            <text>{{ tag.QuyuM }}</text>
          </view>
        </view>
        <view class="Divider"></view>
      </view>
      <view class="content" v-for="(tag, index) in checkPoint" :key="index">
        <view :id="'sectionId' + index">
          <view @click="tag.show = !tag.show" class="uni-flex uni-justify-between uni-common-mb">
            <view class="content-title">{{ tag.QuyuM }}</view>
            <view class="content-triangle">
              <view class="content-triangle-down" v-if="tag.show"></view>
              <view class="content-triangle-up" v-else></view>
            </view>
          </view>
        </view>
        <view v-if="tag.show">
          <view class="content-desc uni-flex uni-justify-between" v-for="(item, index) in tag.Mession" :key="index">
            <view class="content-desc-left">
              <view class="drop"></view>
              <view class="line"></view>
            </view>
            <view class="content-desc-right">
              <view class="content-desc-right-item uni-flex">
                <view class="content-desc-right-item-img" v-if="item.CankaoT && item.CankaoT.length > 0">
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
              <view class="uni-common-p">
                <view class="uni-flex uni-flex-wrap" v-if="Zhuangtai == 2">{{ item.WenziFK }}</view>
                <uni-easyinput v-else type="textarea" autoHeight v-model="item.WenziFK" placeholder="请输入抽查情况描述···"
                  :inputBorder="false" :disabled="item.ChouchaJG ? true : false"
                  @blur="WenziFKBlur($event, tag, item)"></uni-easyinput>
              </view>
              <!-- <view  v-if="Zhuangtai != 0">
                <view class="Divider"></view>
                <view class="uni-common-p">
                  <view class="uni-flex uni-flex-wrap">
                    <block v-for="(img, index1) in item.ChouchaTP" :key="index1">
                      <image slot='cover' :src="img.url" class="item-TupianFK" @click.stop="previewImg(item.ChouchaTP, index1)" />
                    </block>
                  </view>
                </view>
              </view> -->
              <!-- 需要上传图片或拍照 -->
              <view v-if="item.ChouchaTP.length > 0 || !item.ChouchaJG">
                <view class="Divider"></view>
                <view class="uni-common-p">
                  <uni-file-picker v-model="item.ChouchaTP" file-mediatype="image" :imageStyles="imageStyles"
                    :readonly="item.ChouchaJG ? true : false" @select="upFileSelect($event, tag, item)"
                    @delete="upFileDelete($event, tag, item)">
                    <uni-icons type="camera" size="40" color="#ccc"></uni-icons>
                  </uni-file-picker>
                </view>
              </view>
              <view class="">
                <view class="Divider"></view>
                <radio-group class="uni-flex" @change="radioChange($event, tag, item)">
                  <label class="uni-flex uni-flex-align-center uni-common-p radio-item"
                    v-for="(radio, index) in itemsRadio" :key="index">
                    <view>
                      <radio :value="radio.value" :checked="item.ChouchaJG == radio.value"
                        :disabled="item.ChouchaJG ? true : false"
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
const TableId = '2c0d228d-e17c-4a6b-8dd5-bc1c01ca39ad'
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
  saveData({ ChouchaJG: e.detail.value }, 'ChouchaJG', tag, item)
}
// 抽查内容
const WenziFKBlur = (e, tag, item) => {
  saveData({ WenziFK: e.detail.value }, 'WenziFK', tag, item)
}
// 文件上传
const upFileSelect = async (e, tag, item) => {
  item.isPaiZhaoShow = true
  const res = await uploadFile(e.tempFilePaths, { Component: 'ImgUpload' })
  if (res.Code == 1) {
    // 如果有值，就追加，没有就赋值
    if (item.ChouchaTP) {
      item.ChouchaTP = [...item.ChouchaTP, ...res.Data]
    } else {
      item.ChouchaTP = res.Data
    }
  }
  saveData({ ChouchaTP: JSON.stringify(item.ChouchaTP) }, 'ChouchaTP', tag, item)
}

// 文件删除
const upFileDelete = (e, tag, item) => {
  const index = item.ChouchaTP?.findIndex(item => item.Url == e.url)
  if (index > -1) {
    item.ChouchaTP.splice(index, 1)
  }
  saveData({ ChouchaTP: JSON.stringify(item.ChouchaTP) }, 'ChouchaTP', tag, item)
}

// 获取列表数据
const getListData = async () => {
  Microi.ShowLoading('加载中···')
  checkPoint.value = detail.value.Quyu.map(item => {
    if (item.TibaoWB) {
      item.show = false
    } else {
      item.show = true
    }
    item.Mession = item.Mession.map(item1 => {
      item1.ChouchaTP = changeTu(item1.ChouchaTP)
      item1.isPaiZhaoShow = Zhuangtai.value == 0 ? false : true
      item1.CankaoT = changeTu(item1.CankaoT)
      return item1
    })
    return item
  })
  console.log(checkPoint.value)
  const requiredData = ['ChouchaJG']
  store.commit('tableEdit/SET_CHILD_TABLE_REQUIRED', { requiredData: requiredData, TableId: TableId }) // 设置子表必填项
  Microi.HideLoading()
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
  // 检查必填项是否填写，没有则提示哪一项没填
  requiredData.forEach(element => {
    combinedArray.forEach(child => {
      if (!child._FormData[element]) {
        Microi.Tips(`请填写抽查结果`, false)
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
    const res1 = await Microi.ApiEngine.Run('CCmession_updateSpeed', {
      Id: detail.value.Id,
      JianchaR: detail.value.JianchaR,
      JianchaRID: detail.value.JianchaRID,
      LaiyuanRWID: detail.value.LaiyuanRWID,
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

::v-deep .uni-easyinput__content-textarea {
  min-height: 20px;
  height: 20px;
}

::v-deep .uni-easyinput__placeholder-class {
  font-size: 15px;
}
</style>