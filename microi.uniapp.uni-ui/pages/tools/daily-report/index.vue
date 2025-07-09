<template>
  <view class="daily-report">
    <!-- 顶部搜索栏 -->
    <view class="search-box" :class="{ 'search-box-scrolled': isScrolled }">
      <view class="search-item uni-flex uni-common-mb-xs">
        <view class="search-input">
          <uni-easyinput prefixIcon="search" v-model="searchKeyword" placeholder="搜索" :styles="{ borderColor: '#4179F7' }"
            @iconClick="onSearch" @blur="onSearch" @clear="onClear" />
        </view>
        <view class="search-btn" v-if="searchListIds.length > 0">
          <view class="more-search-btn" @click.stop="onSearchClick('search')">
            <text>更多搜索</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 日报列表 -->
    <view scroll-y class="report-list">
      <view v-for="(group, index) in reportGroups" :key="index" class="report-group">
        <template v-if="group.detail.length > 0">
          <!-- 日期标题 -->
          <view class="date-header flex items-center">
            <image src="./img/daily-report-icon-time@2x.png" mode="widthFix" class="w-6 h-6 mr-2"></image>
            <text class="date text-lg font-bold text-primary">{{ formatDate(group.date) }}</text>
          </view>

          <!-- 用户头像列表 -->
          <view class="avatar-list">
            <!-- 将用户分组，每5个一组 -->
            <template v-for="(chunk, chunkIndex) in chunkArray(group.detail, 5)" :key="chunkIndex">
              <!-- 用户头像行 -->
              <view class="avatar-row">
                <view v-for="(item, itemIndex) in chunk" :key="itemIndex" class="avatar-wrapper">
                  <view class="avatar-item" :class="{ 'selected': selectedUserIndex === `index_${index}_${chunkIndex * 5 + itemIndex}` }"
                    @click="viewReport(item, `index_${index}_${chunkIndex * 5 + itemIndex}`)">
                    <view class="avatar-img-box">
                      <image :src="GetServerPath(item.Avatar) || '/static/img/mrtx.png'" mode="widthFix"
                        class="avatar-img"></image>
                    </view>
                    <text class="user-name" :class="{ 'text-red-500': item.isFinite === 0, 'text-gray-500': item.isFinite !== 0 }">{{ item.TianxieR }}</text>
                  </view>
                </view>
              </view>
              
              <!-- 用户日报详情 - 显示在当前行下方 -->
              <transition name="slide-fade">
                <view v-if="selectedUserIndex && 
                  parseInt(selectedUserIndex.split('_')[2]) >= chunkIndex * 5 && 
                  parseInt(selectedUserIndex.split('_')[2]) < (chunkIndex + 1) * 5 && 
                  selectedUserIndex.startsWith(`index_${index}_`)" 
                  class="user-report-detail-wrapper">
                  <view class="user-report-detail rounded-lg shadow-lg p-4">
                    <view class="detail-header ">
                      <text class="title">
                        <image src="./img/daily-report-icon-daily-summary@2x.png" class="w-6 h-6" mode="aspectFit"></image>
                        日总结</text>
                      <text class="close" @click="closeReport">
                        收起<uni-icons type="up" size="18" color="#999999"></uni-icons>
                      </text>
                    </view>
                    <view class="mt-4 border-b border-solid border-gray-200 pb-2">
                      <text class="text-sm text-gray-700 mr-5 font-extrabold">填写人</text>
                      <text class="text-sm text-gray-400">{{ selectedUser.TianxieR }}</text>
                    </view>
                    <view class="mt-4 pb-2">
                      <text class="text-sm text-gray-700 mr-5 font-extrabold">日总结主题</text>
                      <text class="text-sm text-gray-400">{{ selectedUser.RijiHZT }}</text>
                    </view>
                    <view class="detail-content">
                      <!-- 已完成的工作内容 -->
                      <view class="detail-item mb-4">
                        <view class="content-timeline">
                          <view class="timeline-dot blue"></view>
                        </view>
                        <view class="timeline-line blue"></view>

                        <view class="content-wrapper">
                          <view class="content-header">
                            <text class="content-title">已完成的工作内容</text>
                          </view>
                          <view class="content-box" v-if="selectedUser.GongzuoNR">
                            <text class="content-text blue">{{ selectedUser.GongzuoNR }}</text>
                            <image src="./img/daily-report-icon-completed-work@2x.png" class="content-icon" mode="aspectFit"></image>
                          </view>
                        </view>
                      </view>
                      
                      <!-- 未完成的工作内容 -->
                      <view class="detail-item mb-4">
                        <view class="content-timeline">
                          <view class="timeline-dot red"></view>
                        </view>
                        <view class="timeline-line red"></view>
                        <view class="content-wrapper">
                          <view class="content-header">
                            <text class="content-title content-title-red">未完成的工作内容</text>
                          </view>
                          <view class="content-box" v-if="selectedUser.WeiwanCDGZNR">
                            <text class="content-text">{{ selectedUser.WeiwanCDGZNR }}</text>
                            <image src="./img/daily-report-icon-pending-work@2x.png" class="content-icon" mode="aspectFit"></image>
                          </view>
                        </view>
                      </view>
                      
                      <!-- 遇到问题 -->
                      <view class="detail-item mb-4">
                        <view class="content-timeline">
                          <view class="timeline-dot blue"></view>
                        </view>
                        <view class="content-wrapper">
                          <view class="content-header">
                            <text class="content-title blue">遇到问题</text>
                          </view>
                          <view class="content-box" v-if="selectedUser.YudaoDWT">
                            <text class="content-text">{{ selectedUser.YudaoDWT }}</text>
                            <image src="./img/daily-report-icon-issues@2x.png" class="content-icon" mode="aspectFit"></image>
                          </view>
                        </view>
                      </view>
                    </view>
                    <view class="mt-4 border-b border-solid border-gray-200 pb-2">
                      <text class="text-sm text-gray-600 mr-5 font-extrabold">批阅</text>
                      <switch :checked="selectedUser.ShifouPY == 1 ? true : false"  disabled style="transform:scale(0.7)"></switch>
                      <text class="text-sm text-gray-400">{{ selectedUser.YiwanC }}</text>
                    </view>
                    <view class="mt-4 border-b border-solid border-gray-200 pb-2">
                      <text class="text-sm text-gray-600 mr-5 font-extrabold">需要协助人员</text>
                      <text class="text-sm text-gray-400">{{ GetXuyaoXZRY(selectedUser.XuyaoXZRY) }}</text>
                    </view>
                    <view class="mt-4 border-b border-solid border-gray-200 pb-2">
                      <text class="text-sm text-gray-600 mr-5 font-extrabold">查看次数</text>
                      <text class="text-sm text-gray-400">{{ selectedUser.Hits }}</text>
                    </view>
                    <view class="flex justify-end gap-4 mt-4">
                      <view class="btn-primary hover-primary" @click="goEdit(selectedUser.Id)">编辑</view>
                      <view class="btn-warning hover-warning" @click="goDel(selectedUser.Id)">删除</view>
                      <view class="btn-muted hover-muted" @click="goDetail(selectedUser.Id)">查看</view>
                    </view>
                    <!-- 底部信息 -->
                    <view class="detail-footer">
                        日总结编号：{{ selectedUser.RijiHBH }}
                    </view>
                  </view>
                </view>
              </transition>
            </template>
          </view>
        </template>
      </view>
    </view>
    <view class="flex justify-center mt-20" v-if="reportGroups.length == 0 && status !== 'loading'">
      <image src="/static/image/none.jpg" mode="widthFix" style="    transform: scale(0.8);"></image>
    </view>
    <uni-load-more :status="status" :content-text="contentText" />
    <movable-area class="movable-container">
      <movable-view class="movable-fab" direction="all" :x="initialX" :y="initialY" :inertia="true"
        :out-of-bounds="false" :damping="50">
        <view class="add-button" @click="goAdd">
          <uni-icons type="plusempty" size="32" color="#FFFFFF"></uni-icons>
        </view>
      </movable-view>
    </movable-area>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, reactive } from 'vue';
import { onPageScroll, onLoad, onShow, onReachBottom } from '@dcloudio/uni-app';
import { getAuthList, GetServerPath } from '@/utils';
const V8 = inject('V8'); // 使用注入V8实例
const Microi = inject('Microi'); // 使用注入Microi实例
const MenuId = ref('') // 当前菜单ID
const status = ref('loading')
const contentText = ref({
  contentdown: '查看更多',
  contentrefresh: '加载中',
  contentnomore: '没有更多'
})
// 分页数据
const reportGroups = ref([]);
const pageData = reactive({
  pageIndex: 1,
  pageSize: 10,
  totalPage: 0
})
const isScrolled = ref(false);
const searchKeyword = ref('');
const searchListIds = ref([]);
const selectedUser = ref(null); // 添加选中用户状态
const selectedUserIndex = ref(null); // 添加选中用户索引
// FAB 按钮相关
const initialX = ref(uni.getSystemInfoSync().windowWidth - 100);
const initialY = ref(uni.getSystemInfoSync().windowHeight - 200);
const DiyTableId = ref('a9e8bc52-9a04-47e4-9fe5-ffe525357ce8');
const pattern = {
  color: '#7A7E83',
  backgroundColor: '#fff',
  selectedColor: '#4179F7',
  buttonColor: '#4179F7'
};
const content = [{
  iconPath: '/static/icons/fab.png',
  selectedIconPath: '/static/icons/fab.png',
  text: '新增',
  value: 'Add',
  active: false
}]
const newContent = ref([]);

const popMenu = ref(false);
const GetXuyaoXZRY = (row) => {
  const data = JSON.parse(row) || [];
  if (data.length > 0) {
    return data.map(item => item.Name).join('、')
  } else {
    return '无'
  }
}
// 获取列表数据
const getListData = async () => {
  const params = {
    PageIndex: pageData.pageIndex,
    PageSize: pageData.pageSize,
    searchKeyword: searchKeyword.value
  }
  const res = await Microi.ApiEngine.Run('GetDailyWork', params)
  if (res.Code == 1) {
    const data = res.Data
    pageData.totalPage = Math.ceil(res.DataCount / pageData.pageSize);
    if (pageData.pageIndex === 1) {
      reportGroups.value = data
      status.value = 'onmore';
    } else {
      reportGroups.value = reportGroups.value.concat(data);
      if (res.Data.length < pageData.pageSize) {
        status.value = 'nomore';
      }
    }
  } else {
    Microi.Tips(res.Msg, false);
  }
}
// 编辑
const goEdit = (Id) => {
  const routeParams = {
			DiyTableId: DiyTableId.value,
			Id: Id,
			type: 'Edit',
		}
    const queryString = Object.entries(routeParams)
			.filter(([_, value]) => value !== undefined && value !== '')
			.map(([key, value]) => `${key}=${value}`)
			.join('&')
  Microi.RouterPush(`/pages/workbench/work-add/index?${queryString}`, true)
}
// 查看
const goDetail = (Id) => {
  console.log(Id)
  Microi.RouterPush(
    `/pages/workbench/work-detail/index?DiyTableId=${DiyTableId.value}&Id=${Id}&MenuId=${MenuId.value}`,
    true)
}
// 删除
const goDel = (Id) => {
  uni.showModal({
			title: '提示',
			content: '确定删除吗？',
			success: (res) => {
				if (res.confirm) {
					Microi.ShowLoading('删除中···')
					Microi.FormEngine.DelFormData({
						TableId: DiyTableId.value,
						Id: Id
					}).then(res => {
						if (res.Code == 1) {
							Microi.HideLoading()
							uni.showToast({
								title: '删除成功',
								icon: 'none'
							})
							getListData()
						} else {
							Microi.HideLoading()
							uni.showToast({
								title: '删除失败',
								icon: 'none'
							})
						}
					})
				}
			}
		})
}
// 新增
const goAdd = () => {
  Microi.RouterPush(
			`/pages/workbench/work-add/index?DiyTableId=${DiyTableId.value}&type=Add`,
			true)
}
onShow(async () => {
  await getListData()
})
// 上啦加载
onReachBottom(() => {
  console.log('onReachBottom',pageData)
  if (pageData.pageIndex < pageData.totalPage) {
    status.value = 'loading'
    pageData.pageIndex++
    getListData()
  } else {
    status.value = 'nomore'
  }
})
// 页面滚动处理
onPageScroll(({ scrollTop }) => {
  isScrolled.value = scrollTop > 10;
});

// 方法定义
const onSearch = (value) => {
  pageData.pageIndex = 1
  getListData()
};

const onClear = () => {
  searchKeyword.value = '';
  searchListIds.value = [];
  pageData.pageIndex = 1
  getListData()
};

const onSearchClick = (type) => {
  // 处理更多搜索点击
};

const trigger = (e) => {
  console.log('trigger', e);
  const { index } = e;
  switch (index) {
    case 0:
      uni.navigateTo({
        url: './edit'
      });
      break;
    default:
      break;
  }
};

// 悬浮按钮点击事件
const handleFab = () => {
  // 如果数据只有一条直接执行不用展开弹窗
  if (newContent.value.length <= 1) {
    popMenu.value = false
    trigger({
      item: newContent.value[0]
    })
  }
}
// 获取当前页面权限
const getPageAuth = () => {
  currentPermission.value = getAuthList(MenuId.value)
  content.map(item => {
    item.show = currentPermission.value.includes(item.value)
  })
  newContent.value = content.filter(item => item.show)
}

// 添加查看报告方法
const viewReport = (item, index) => {
  if (item.isFinite == 0) {
    Microi.Tips('该用户当日未填写工作日报', false)
    return
  }
  if (selectedUserIndex.value === index) {
    // 如果点击的是当前已选中的用户，则关闭详情
    selectedUserIndex.value = null;
    selectedUser.value = null;
  } else {
    // 否则显示新点击的用户详情
    selectedUserIndex.value = index;
    selectedUser.value = item;
  }
};

const closeReport = () => {
  selectedUserIndex.value = null;
  selectedUser.value = null;
};

// 将数组分组，每组n个元素
const chunkArray = (array, size) => {
  if (!array) return [];
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// 添加日期格式化函数
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear().toString().slice(-2); // 获取年份后两位
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}/${month}-${day}`;
};
</script>

<style lang="scss" scoped>
.daily-report {
  min-height: 100vh;
  background-image: url('@/pages/tools/kaoqin/images/bg.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 30rpx;

  .search-box-scrolled {
    background: white;
    box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);
  }

  .search-box {
    position: fixed;
    top: 0px;
    left: 0px;
    right: 0px;
    padding: 20px 20px 10px 20px;
    z-index: 2;
    transition: background-color 0.3s ease;



    .search-item {
      display: flex;
      align-items: center;

      .search-input {
        flex: 1;

        &::v-deep .is-input-border {
          border-radius: 20px;
          padding-left: 10px;
          background-color: #E9F0FF !important;
        }
      }

      .search-btn {
        margin-left: 20rpx;

        .more-search-btn {
          display: flex;
          align-items: center;
          color: #4179F7;
          font-size: 28rpx;
        }
      }
    }
  }

  .report-list {
    padding-top: 60px;

    .report-group {
      margin-bottom: 30rpx;
      background-color: #fff;
      border-radius: 12rpx;
      overflow: hidden;

      .date-header {
        padding: 20rpx;
        font-size: 28rpx;
        color: #333;
      }

      .avatar-list {
        padding: 20rpx;
        
        .avatar-row {
          display: flex;
          flex-wrap: nowrap;
          gap: 20rpx;
          margin-bottom: 20rpx;
        }
        
        .avatar-wrapper {
          width: calc(20% - 16rpx);
          box-sizing: border-box;
        }
        
        .avatar-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: transform 0.2s;

          .avatar-img-box {
            width: 100rpx; /* 设置容器的宽度 */
            height: 100rpx; /* 设置容器的高度 */
            border: 6rpx solid transparent;
            border-radius: 50%; /* 添加圆角效果 */
            overflow: hidden; /* 防止图片内容溢出 */
            display: flex; /* 居中对齐（可选） */
            align-items: center; /* 垂直居中（可选） */
            justify-content: center; /* 水平居中（可选） */
            .avatar-img {
              width: 100%;
              height: 100%;
              border-radius: 50%;
            }
          }

          &.selected {
            .avatar-img-box {
              background: linear-gradient(180deg, rgba(101, 163, 245, 1), rgba(59, 95, 143, 1));
            }

            .user-name {
              background: #3875C6;
              border-radius: 42rpx;
              color: #FFFFFF;
              padding: 4rpx 20rpx;
            }
          }

          .user-name {
            margin-top: 10rpx;
            font-size: 24rpx;
          }
        }
        
        .user-report-detail-wrapper {
          width: 100%;
          margin-top: 20rpx;
          margin-bottom: 20rpx;
        }
        
        .user-report-detail {
          position: relative;
          background: #F5F8FF;
          border-radius: 16rpx;
          box-shadow: 0rpx 2rpx 4rpx 0rpx rgba(52,76,195,0.08);
          overflow: hidden;
          
          .detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .title {
              font-size: 32rpx;
              font-weight: 800;
              color: #3875C6;
            }

            .close {
              font-size: 26rpx;
              color: #999;
              padding: 0 20rpx;
              cursor: pointer;
              background: #E1E5F0;
              border-radius: 60rpx 60rpx 60rpx 60rpx;
              font-weight: 800;
            }
          }

          .detail-content {
            padding: 20rpx 0;
            
            .detail-item {
              margin-bottom: 30rpx;
              display: flex;
              align-items: flex-start;
              position: relative;
              min-height: 120rpx;

              &:last-child {
                margin-bottom: 0;
              }

              .content-timeline {
                width: 40rpx;
                margin-right: 20rpx;
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                height: 100%;

                .timeline-dot {
                  width: 21rpx;
                  height: 21rpx;
                  border-radius: 50%;
                  background-color: #4179F7;
                  margin-bottom: 10rpx;
                  z-index: 2;
                }
                .red {
                  background-color: #F76941;
                }
              }
              .timeline-line {
                width: 2rpx;
                height: calc(100% - 10rpx);
                position: absolute;
                top: 25rpx;
                bottom: 0;
                z-index: 1;
                left: 19rpx;
                border-left: 2rpx solid;
                border-image: linear-gradient(180deg, rgba(56, 117, 198, 1), rgba(247, 105, 65, 1)) 2 2;
              }
              .red {
                border-image: linear-gradient(180deg, rgba(247, 105, 65, 1), rgba(56, 117, 198, 1)) 2 2;
              }
              .content-wrapper {
                flex: 1;
                margin-left: 10rpx;
                background: #fff;
                border-radius: 16rpx;
                padding: 20rpx;

                .content-header {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  margin-bottom: 15rpx;

                  .content-title {
                    font-size: 28rpx;
                    font-weight: bold;
                    color: #3875C6;
                  }
                  .content-title-red {
                    color: #F76941;
                  }
                }

                .content-box {
                  display: flex;
                  align-items: flex-start;
                  justify-content: space-between;
                  .content-text {
                    font-size: 26rpx;
                    color: #666666;
                    word-break: break-all;
                    line-height: 1.6;
                  }
                  .content-icon {
                    width: 110rpx;
                    height: 110rpx;
                    margin-left: 10rpx;
                    flex-shrink: 0;
                  }
                }
              }
            }
          }
          .detail-footer {
              margin-top: 30rpx;
              font-size: 24rpx;
              color: #999999;
              text-align: right;
            }
        }
      }
    }
  }

  .add-button {
    position: fixed;
    right: 40rpx;
    bottom: 40rpx;
  }

  .movable-container {
    pointer-events: none;
    height: 100vh;
    width: 100vw;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;

    .movable-fab {
      pointer-events: auto;
      width: 112rpx;
      height: 112rpx;
    }

    .add-button {
      width: 110rpx;
      height: 110rpx;
      background: #4179F7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(65, 121, 247, 0.35);
      transition: transform 0.2s;
      
      &:active {
        transform: scale(0.95);
      }
    }
  }

  /* 过渡动画效果 */
  .slide-fade-enter-active,
  .slide-fade-leave-active {
    transition: all 0.3s ease;
  }
  
  .slide-fade-enter-from,
  .slide-fade-leave-to {
    transform: translateY(-10px);
    opacity: 0;
  }
  
  .user-report-detail-wrapper {
    margin: 0.5rem 0;
  }
  
  .user-report-detail {
    position: relative;
    overflow: hidden;
    
    .detail-header {
      .title {
        font-weight: 500;
      }
      
      .close {
        cursor: pointer;
        padding: 0 8px;
        transition: all 0.2s;
        
        &:hover {
          color: #4179F7;
        }
      }
    }
    
    .detail-item {
      position: relative;
      
      .content-box {
        line-height: 1.5;
        word-break: break-word;
        white-space: pre-wrap;
      }
    }
  }
}
</style>