<template>
  <view class="tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#FFFFFF">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-black">发展历程</text>
      </view>
    </tn-nav-bar>
    <view class="tn-text-center" :style="{paddingTop: vuex_custom_bar_height +'px'}">
      
      <!-- 发展历程 start-->
      <view class="tn-flex tn-flex-wrap tn-padding-bottom">
        <view v-for="(item, index) in DataList" :key="index" class="king-list tn-margin-top-sm">
        
          <view class="king-icon">
            <text class='tn-icon-trophy tn-color-white tn-text-lg tn-bg-blue tn-round tn-padding-xs'></text>
            <text class='tn-text-xl tn-margin-left tn-color-gray'>{{item.Riqi}}</text>
          </view>
          
          <view class='king-item  tn-icon-circle-fill tn-color-red'>
           <view class="article-shadow tn-bg-white" @click="tn('')">
             <view class="tn-flex">
               <view class="image-pic tn-margin-left-sm tn-margin-top-sm tn-margin-bottom-sm img-solid" 
					style="width: 160rpx;height: 160rpx;background-size: cover;"
					:style="'background-image:url(' + Microi.FileServer + item.Tupian + ');background-size: cover;'">
                 <view class="image-article">
                 </view>
               </view>
               <view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
                 <view class="" style="min-height: 105rpx;">
                   <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                     {{item.Shuoming}}
                   </text>
                   
                 </view>
                 <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                   <view class="justify-content-item tn-tag-content__item tn-margin-right tn-text-sm tn-text-bold">
                     <text class="tn-tag-content__item--prefix">#</text> {{item.Biaoqian}}
                   </view>
                   <view class="justify-content-item tn-color-gray tn-text-center tn-color-gray--disabled" style="padding-top: 5rpx;">
                     <!-- <text class="tn-icon-footprint tn-padding-right-xs tn-text-lg"></text>
                     <text class="tn-padding-right tn-text-df">232</text> -->
                     <text class="tn-icon-rocket tn-padding-right-xs tn-text-lg"></text>
                     <!-- <text class="tn-text-df">129</text> -->
                   </view>
                 </view>
               </view>
             </view>
           </view>
          </view>
        </view>
            
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
		DataList:[],
		Microi:this.Microi,
      }
    },
	created() {
		var self = this;
		self.GetDataList();
	},
    methods: {
		GetDataList() {
			var self = this;
			self.DataList = [];
			self.$nextTick(() => {
				self.Microi.FormEngine.GetTableDataAnonymous('diy_development_history', {}, function(result) {
					if (self.Microi.CheckResult(result)) {
						self.DataList = result.Data;
					}
				});
			})
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

    
  
  /* 简历内容 */
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
    top: 36rpx;
    z-index: 9;
    background-color: #ffffff;
    width: 50rpx;
    height: 50rpx;
    text-align: center;
    border: none;
    line-height: 50rpx;
    left: 36rpx;
  }
  
  
  /* 名片微调 */
  .img-solid {
    border: 1rpx solid #eee;
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
  
  
  
  // .button-no {
  //   border: none;
  //   width: 100%;
  //   height: 100%;
  //   background-color: rgba(0, 0, 0, 0);
  // }
  
  
  /* 标签内容 start*/
  .tn-tag-content {
    &__item {
      display: inline-block;
      line-height: 35rpx;
      color: #1D2541;
      background-color: #F3F2F7;
      border-radius: 10rpx;
      font-size: 22rpx;
      padding: 5rpx 15rpx;
      
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
   
     /* 轮播堆叠差 start */
     // .card-swiper {
     //   height: 500rpx !important;
     // }
       
     // .card-swiper swiper-item {
     //   width: 250rpx !important;
     //   left: 250rpx;
     //   box-sizing: border-box;
     //   padding: 100rpx 0rpx 100rpx 0rpx;
     //   overflow: initial;
     // }
       
     // .card-swiper swiper-item .swiper-item {
     //   width: 100%;
     //   display: block;
     //   height: 200rpx;
     //   border-radius: 0rpx;
     //   transform: translate(0rpx, 0rpx) scale(1.5);
     //   transition: all 0.2s ease-in 0s;
     //   overflow: hidden;
     //   border: 5rpx solid red;
     // }
       
     // .card-swiper swiper-item.cur .swiper-item {
     //   transform: translate(0rpx, 0rpx) scale(2);
     //   transition: all 0.2s ease-in 0s;
     //   border: 5rpx solid pink;
     // }
     
     // .image-banner{
     //   display: flex;
     //   align-items: center;
     //   justify-content: center;
     // }
     // .image-banner image{
     //   width: 100%;
     // }
    
     
     /* 轮播指示点 start*/
     // .indication{
     //   z-index: 9999;
     //   width: 100%;
     //   height: 36rpx;
     //   position: absolute;
     //   display:flex;
     //   flex-direction:row;
     //   align-items:center;
     //   justify-content:center;
     // }
     
     // .spot{
     //   background-color: #FFF;
     //   opacity: 0.4;
     //   width: 10rpx;
     //   height: 10rpx;
     //   border-radius: 20rpx;
     //   margin: 0 8rpx !important;
     //   left: -270rpx;
     //   top: -180rpx;
     //   position: relative;
     // }
     
     // .spot.active{
     //   opacity: 1;
     //   width: 30rpx;
     //   background-color: #FFF;
     // }
     
     // .swiper-item1 {
     //   z-index: -1;
       
     //   &--active {
     //     z-index: 10;
     //   }
     // }
     
     
   /* 悬浮 */
   .rocket-sussuspension{
     animation: tiger 3s ease-in-out infinite;
   }
   
   @keyframes tiger {
     0%, 100% {
       transform: translate(0 , 0);
     }
     50% {
       transform: translate(-0.8rem , 1rem);
     }
   }
     
   .login {
     position: relative;
     height: 100%;
     z-index: 1;
     
   /* 背景图片 start */
     &__bg {
       z-index: -1;
       position: fixed;
       
       &--top {
         top: 0;
         left: 0;
         right: 0;
         width: 100%;
         
         .bg {
           width: 750rpx;
           will-change: transform;
         }
         .rocket {
           margin: 50rpx 30%;
           width: 300rpx;
           will-change: transform;
         }
       }
       
       &--bottom {
         bottom: -10rpx;
         left: 0;
         right: 0;
         width: 100%;
         // height: 144px;
         // margin-bottom: env(safe-area-inset-bottom);
         
         image {
           width: 750rpx;
           will-change: transform;
         }
       }
     }
   }
   /* 背景图片 end */
   
   .article-shadow {
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
  
  // .article-shadow {
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
