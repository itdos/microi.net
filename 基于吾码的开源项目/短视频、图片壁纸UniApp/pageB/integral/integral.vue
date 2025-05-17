<template>
  <view class="tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#FFFFFF">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-black">积分明细</text>
      </view>
    </tn-nav-bar>
    
    
    <view class="" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
      <view class="tn-padding-bottom-lg">
        <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding" v-for="(item,index) in integral" :key="index" >
          <view class="justify-content-item">
            <view class="tn-color-gray--dark tn-text-lg">
             {{item.name}}
            </view>
            <view class="tn-color-gray tn-padding-top-xs">
              {{item.time}}
            </view>
          </view>
          <view class="justify-content-item tn-text-xl tn-padding-top">
            <view :class="'tn-color-' + item.color + ';'"> {{item.integral}} </view>
          </view>
        </view>
      
      </view>
    </view>
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateIntegral',
    mixins: [template_page_mixin],
    data(){
      return {
        integral: [
		// 	{
  //         name: '完成手机号绑定',
  //         time: '2022-12-22 08:02:21',
  //         color: 'blue',
  //         integral: '+100'
  //       }, {
  //         name: 'Ai创作成功',
  //         time: '2022-12-18 20:21:36',
  //         color: 'orange',
  //         integral: '-5'
  //       }, {
  //         name: 'Ai创作成功',
  //         time: '2022-12-18 20:18:38',
  //         color: 'orange',
  //         integral: '-5'
  //       }, {
  //         name: 'Ai创作成功',
  //         time: '2022-12-18 20:16:59',
  //         color: 'orange',
  //         integral: '-5'
  //       }, {
  //         name: 'Ai创作成功',
  //         time: '2022-12-18 20:15:08',
  //         color: 'orange',
  //         integral: '-5'
  //       }, {
  //         name: 'Ai创作成功',
  //         time: '2022-12-18 20:13:50',
  //         color: 'orange',
  //         integral: '-5'
  //       }, {
  //         name: 'Ai创作成功',
  //         time: '2022-12-18 20:13:02',
  //         color: 'orange',
  //         integral: '-5'
  //       }, {
  //         name: 'Ai创作成功',
  //         time: '2022-12-18 20:12:36',
  //         color: 'orange',
  //         integral: '-5'
  //       }, {
  //         name: '完善个人头像',
  //         time: '2022-12-16 12:14:43',
  //         color: 'blue',
  //         integral: '+50'
  //       }, {
  //         name: '完善职业',
  //         time: '2022-05-15 10:21:08',
  //         color: 'blue',
  //         integral: '+50'
  //       }, {
  //         name: '完善生日',
  //         time: '2022-12-14 08:56:32',
  //         color: 'blue',
  //         integral: '+50'
  //       }, {
  //         name: '完善个人姓名',
  //         time: '2022-12-13 08:40:57',
  //         color: 'blue',
  //         integral: '+10'
  //       }, 
		// {
  //         name: '授权登录',
  //         time: '2022-12-06 22:06:36',
  //         color: 'blue',
  //         integral: '+100'
  //       }
  ],
      }
    },
    methods: {
      
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
  
  /* 间隔线 start*/
  .tn-strip-bottom-min {
    width: 100%;
    border-bottom: 1rpx solid #F8F9FB;
  }
  
  .tn-strip-bottom {
   width: 100%;
   border-bottom: 20rpx solid rgba(241, 241, 241, 0.8);
  }
   /* 间隔线 end*/
</style>
