<template>
  <view class="tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left'></text>
        <text class='icon tn-icon-home-capsule-fill'></text>
      </view>
    </tn-nav-bar>
    
    
    <view class="tn-bg-white top-fixed" :style="{paddingTop: vuex_custom_bar_height + 10 +'px'}">
      <tn-tabs :list="fixedList" :current="current" :isScroll="false" activeColor="#000" bold="true" backgroundColor="#FFFFFF" :fontSize="32" :badgeOffset="[20, 50]" @change="tabChange"></tn-tabs>
    </view>
    
    <view class="" :style="{paddingTop: vuex_custom_bar_height + 60 +'px'}">
    
      <view class="king-list tn-margin-top-sm" v-if="current==0">
        
        <view class="king-icon">
          <text class='tn-icon-footprint tn-color-white tn-text-lg tn-bg-blue tn-round tn-padding-xs'></text>
          <text class='tn-text-xl tn-margin-left tn-color-gray'>2022-05-22</text>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
      
      
      
        <view class="king-icon">
          <text class='tn-icon-footprint tn-color-white tn-text-lg tn-bg-blue tn-round tn-padding-xs'></text>
          <text class='tn-text-xl tn-margin-left tn-color-gray'>2022-03-16</text>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
      
      
        <view class="king-icon">
          <text class='tn-icon-footprint tn-color-white tn-text-lg tn-bg-blue tn-round tn-padding-xs'></text>
          <text class='tn-text-xl tn-margin-left tn-color-gray'>2022-03-16</text>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
        
        <view class="king-icon">
          <text class='tn-icon-footprint tn-color-white tn-text-lg tn-bg-blue tn-round tn-padding-xs'></text>
          <text class='tn-text-xl tn-margin-left tn-color-gray'>2022-03-16</text>
        </view>
        
        <view class='king-item tn-color-red tn-icon-circle-fill'>
         <view class="image-shadow tn-bg-white" @click="tn('')">
           <view class="tn-flex">
             <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg');width: 160rpx;height: 160rpx;background-size: cover;">
               <view class="image-article">
               </view>
             </view>
             <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
               <view class="" style="min-height: 105rpx;">
                 <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                   总是敲一扇推不开的门，是不礼貌的
                 </text>
                 
               </view>
               <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                 <view class="tn-margin-right tn-round tn-text-sm tn-text-bold tn-bg-indigo--light tn-color-blue">
                   <text class="tn-tag-content"># 随便聊聊</text> 
                 </view>
                 <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                   <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-padding-right tn-text-df">232</text> -->
                   <text class="tn-icon-like tn-padding-right-xs tn-text-lg"></text>
                   <text class="tn-text-df">129</text>
                 </view>
               </view>
             </view>
           </view>
         </view>
        </view>
      
      
      </view>
      
      <view class="" v-if="current==1">
        <view class="" style="padding: 6vh 20rpx;">
          <view class="tn-text-center" style="font-size: 200rpx;padding-top: 30rpx;">
            <text class="tn-icon-wea-wind tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容被台风吹走了</view>
        </view>
      </view>
    
    </view>
    
    
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateInteract',
    mixins: [template_page_mixin],
    data(){
      return {
        current: 0,
        fixedList: [
          {name: '下载'},
          {name: '收藏'},
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
    width: 100%;
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
    
    &:before {
      content: " ";
      width: 1rpx;
      height: 110%;
      position: absolute;
      top: 22.5%;
      left: 0;
      right: 0;
      margin: auto;
      transform: scale(0.5);
      transform-origin: 0 0;
      pointer-events: none;
      box-sizing: border-box;
      opacity: 0.7;
      background-color: #FFFFFF;
    }
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
  
   /* 历史内容 */
   .king-list {
     display: block;
     // background-color: #ffffff;
   }
   
   .king-list .king-icon {
     width: 100%;
     text-align: left;
     padding: 20rpx 0 20rpx 37rpx;
     font-size: 26rpx;
     color: #888;
     display: block;
   }
   
   .king-list>.king-item {
     padding: 30rpx 30rpx 30rpx 120rpx;
     position: relative;
     display: block;
     z-index: 0;
   }
   
   .king-list>.king-item::after {
     content: "";
     display: block;
     position: absolute;
     width: 1rpx;
     background-color: #E6E6E6;
     left: 60rpx;
     height: 100%;
     top: 0;
     z-index: 8;
   }
   
   .king-list>.king-item::before {
     display: block;
     position: absolute;
     top: 26rpx;
     z-index: 9;
     background-color: #ffffff;
     width: 30rpx;
     height: 30rpx;
     text-align: center;
     border: none;
     line-height: 30rpx;
     left: 46rpx;
     border-radius: 100rpx;
   }
   
   
   /* 图片边框微调 */
   .img-solid {
     border: 2rpx solid #eee;
   }
   
   .share-img {
     position: fixed;
     /* padding: 10rpx; */
     width: 100rpx;
     height: 100rpx;
     /* top: 680rpx; */
     bottom: 200rpx;
     right: 20rpx;
     z-index: 1024;
     opacity: 0.8;
     box-shadow: 0rpx 8rpx 30rpx 0rpx rgba(0, 0, 0, 0.3);
     border: none;
     border: 6rpx solid rgba(255, 255, 255, 0);
   }
   
   .resume {
     display: flex;
     justify-content: space-between;
     padding-top: 10rpx;
     border-radius: 6rpx;
     color: #666;
     line-height: 1.6;
   }
   
   .resume+.resume {
     margin-top: 20rpx;
   }
   
   .resume2 {
     padding-top: 10rpx;
     border-radius: 6rpx;
     display: block;
     color: #666;
     line-height: 1.6;
     text-align: justify;
   }
   
   /* 间隔线 start*/
   .tn-strip-bottom {
    width: 100%;
    border-bottom: 20rpx solid rgba(241, 241, 241, 0.8);
   }
    /* 间隔线 end*/
   
   
   .bg-img-cont {
     background-size: cover;
     background-position: center;
     background-repeat: no-repeat;
     height: 350rpx;
     margin: 20rpx 0;
     border-radius: 8rpx;
   }
   
   
   /* 标签内容 start*/
   .tn-tag-content {
     &__item {
       display: inline-block;
       line-height: 45rpx;
       padding: 10rpx 30rpx;
       margin: 0rpx 20rpx 25rpx 0rpx;
       
       &--prefix {
         padding-right: 10rpx;
       }  
     }
   }
   /* 标签内容 end*/
   
   .see {
     display: flex;
     justify-content: space-between;
     padding-top: 10rpx;
     border-radius: 6rpx;
     color: #666;
     line-height: 1.6;
   }
   
     
  
   .image-shadow {
     border-radius: 15rpx;
     box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
   }
     
   /* 资讯主图 start*/
   .image-article {
     border-radius: 8rpx;
     border: 1rpx solid #F8F7F8;
     width: 160rpx;
     height: 160rpx;
     position: relative;
   }
   
   .image-pic {
     background-size: cover;
     background-repeat: no-repeat;
     // background-attachment:fixed;
     background-position: top;
     border-radius: 10rpx;
   }
  
  // .image-shadow {
  //   border-radius: 15rpx;
  //   box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  // }
  
  /* 文字截取*/
  .clamp-text-1 {
    -webkit-line-clamp: 1;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  
  .clamp-text-2 {
    -webkit-line-clamp: 2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  
  /* 标签内容 start*/
  .tn-tag-content {
    padding-right: 10rpx;
    display: inline-block;
    line-height: 35rpx;
    padding: 5rpx 25rpx;
  }
</style>
