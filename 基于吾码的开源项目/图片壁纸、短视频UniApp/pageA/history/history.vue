<template>
  <view class="tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#FFFFFF">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-black">创作记录</text>
      </view>
    </tn-nav-bar>
    
    <view class="tn-bg-white top-fixed" :style="{paddingTop: vuex_custom_bar_height + 10 +'px'}">
      <tn-tabs :list="fixedList" :current="current" :isScroll="false" activeColor="#000" bold="true" backgroundColor="#FFFFFF" :fontSize="32" :badgeOffset="[20, 50]" @change="tabChange"></tn-tabs>
    </view>
    
    <view class="tn-margin-sm tn-text-center" :style="{paddingTop: vuex_custom_bar_height + 60 +'px'}">
    <!-- 比例图文 start-->
      <view class="tn-flex tn-flex-wrap tn-padding-bottom" v-if="current==0">
        <block v-for="(item, index) in content0" :key="index">
          <view class="" style="width: 50%;" @click="tn('/pageB/result/result2')">
            <view class="tn-margin-xs img-shadow" style="border-radius: 10rpx;">
              <view class="tn-text-bold tn-padding-sm" style="position: absolute;">
                <text class="">AI</text>  
              </view>
              <view class="" style="padding: 15rpx;">
                <view class="image-aipic" :style="'background-image:url(' + item.mainImage + ')'">
                  <view class="image-ai">
                  </view>
                </view> 
              </view>
              <view class="tn-text-bold tn-padding-bottom-sm tn-text-center">
                <text class="">{{ item.date }}</text>  
              </view>
            </view>
          </view>
        </block>
      </view>
      <!-- 比例图文 end-->
      <!-- 比例图文 start-->
      <view class="tn-flex tn-flex-wrap tn-padding-bottom" v-if="current==1">
        <block v-for="(item, index) in content1" :key="index">
          <view class="" style="width: 50%;" @click="tn('/pageB/result/result2')">
            <view class="tn-margin-xs img-shadow" style="border-radius: 10rpx;">
              <view class="tn-text-bold tn-padding-sm" style="position: absolute;">
                <text class="">AI</text>  
              </view>
              <view class="" style="padding: 15rpx;">
                <view class="image-aipic" :style="'background-image:url(' + item.mainImage + ')'">
                  <view class="image-ai">
                  </view>
                </view> 
              </view>
              <view class="tn-text-bold tn-padding-bottom-sm tn-text-center">
                <text class="">{{ item.date }}</text>  
              </view>
            </view>
          </view>
        </block>
      </view>
      <!-- 比例图文 end-->
      <!-- 比例图文 start-->
      <view class="tn-flex tn-flex-wrap tn-padding-bottom" v-if="current==2">
        <block v-for="(item, index) in content2" :key="index">
          <view class="" style="width: 50%;" @click="tn('/pageB/result/result2')">
            <view class="tn-margin-xs img-shadow" style="border-radius: 10rpx;">
              <view class="tn-text-bold tn-padding-sm" style="position: absolute;">
                <text class="">AI</text>  
              </view>
              <view class="" style="padding: 15rpx;">
                <view class="image-aipic" :style="'background-image:url(' + item.mainImage + ')'">
                  <view class="image-ai">
                  </view>
                </view> 
              </view>
              <view class="tn-text-bold tn-padding-bottom-sm tn-text-center">
                <text class="">{{ item.date }}</text>  
              </view>
            </view>
          </view>
        </block>
      </view>  
      <!-- 比例图文 end-->  
    </view>    
    

  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateHistory',
    mixins: [template_page_mixin],
    data(){
      return {
        current: 0,
        fixedList: [
          {name: '创作中'},
          {name: '创作成功'},
          {name: '创作失败'}
        ],
        content0: [
          {
            date: '2022-12-20',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648149-assets/web-upload/767ea598-7700-4b91-8a1f-dde40dd0a671.jpeg',
          },
          {
            date: '2022-09-06',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648148-assets/web-upload/3da93e25-4916-47c9-a1c6-a834afd276e3.jpeg',
          },
          {
            date: '2021-11-12',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648156-assets/web-upload/3b9aa10c-36ca-43ff-9321-38fd1d3dfffc.jpeg',
          },
          {
            date: '2021-11-11',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648152-assets/web-upload/410aa585-dd43-4e9a-912c-fc8c04e0e8f9.jpeg',
          },
          {
            date: '2021-06-07',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648127-assets/web-upload/b8625625-2a52-47f9-a27c-adf6becd3c94.jpeg',
          },
          {
            date: '2021-02-28',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648313-assets/web-upload/4ca4536f-c5fa-4394-9e8e-beab23beaaf4.jpeg',
          },
          {
            date: '2021-01-08',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648186-assets/web-upload/244e6b96-177a-40e6-953d-3ab080c22793.jpeg',
          },
          {
            date: '2020-07-31',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg',
          }
        ],
        content1: [
          {
            date: '2022-09-06',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648148-assets/web-upload/3da93e25-4916-47c9-a1c6-a834afd276e3.jpeg',
          },
          {
            date: '2020-07-31',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg',
          },
          {
            date: '2022-01-01',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648182-assets/web-upload/6cb5b3d2-42d0-40f1-bea4-6c10cf984496.jpeg',
          }
        ],
        content2: [
          {
            date: '2022-12-20',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648149-assets/web-upload/767ea598-7700-4b91-8a1f-dde40dd0a671.jpeg',
          },
          {
            date: '2022-09-06',
            mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648148-assets/web-upload/3da93e25-4916-47c9-a1c6-a834afd276e3.jpeg',
          }
        ],
      }
    },
    methods: {
      // tab选项卡切换
      tabChange(index) {
        this.current = index
      },
      // 跳转
      tn(e) {
      	uni.navigateTo({
      		url: e,
      	});
      },
    }
  }
</script>

<style lang="scss" scoped>
  /* 胶囊*/
  .tn-custom-nav-bar__back {
    width: 60%;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    box-sizing: border-box;
    background-color: rgba(0, 0, 0, 0.15);
    border-radius: 1000rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.5);
    color: #FFFFFF;
    font-size: 18px;
    
    .icon {
      display: block;
      flex: 1;
      margin: auto;
      text-align: center;
    }
    
  }
  
  /* 页面阴影 start*/
  .img-shadow {
    border-radius: 15rpx;
    box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }
  
  .top-fixed{
    position: fixed;
    background-color: rgba(255,255,255,1);
    box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);
    top: 0;
    width: 100%;
    transition: all 0.25s ease-out;
    z-index: 100;
  }

  .image-ai{
    padding: 155rpx 0rpx;
    font-size: 16rpx;
    font-weight: 300;
    position: relative;
  }
  .image-aipic{
    background-size: cover;
    background-repeat:no-repeat;
    // background-attachment:fixed;
    background-position:top;
    border-radius: 0;
    clip-path: polygon(160rpx 0, 100% 0, 100% 100%, 0 100%, 0 60rpx,145rpx 50rpx);
  }
    
    
</style>
