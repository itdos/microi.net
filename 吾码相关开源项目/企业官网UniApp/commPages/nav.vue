<template>
  <view class="template-content tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left'></text>
        <text class='icon tn-icon-home-capsule-fill'></text>
      </view>
    </tn-nav-bar>
    
    <swiper class="card-swiper" :circular="true"
      :autoplay="true" duration="500" interval="5000" @change="cardSwiper"> 
      <swiper-item v-for="(item,index) in swiperList" :key="index" :class="cardCur==index?'cur':''">
        <view class="swiper-item image-banner">
          <image :src="item.url" mode="aspectFill" v-if="item.type=='image'"></image>
        </view>

        <!-- <view class="swiper-item2 image-banner">
          <image :src="item.pngurl" mode="heightFix" v-if="item.type=='image'"></image>
        </view> -->
        <view class="swiper-item2 image-banner" :style="'background-image:url('+ item.pngurl + ');background-size: cover;height: 480rpx;width: 480rpx;'">
        </view>
        <view class="swiper-item-text">
          <view class="tn-text-xxl tn-text-bold tn-color-white">{{item.name}}</view>
          <view class="tn-text-xl tn-text-bold tn-color-white tn-padding-top-xs">{{item.text}}</view>
        </view>
    
      </swiper-item>
    </swiper>
    <view class="indication">
        <block v-for="(item,index) in swiperList" :key="index">
            <view class="spot" :class="cardCur==index?'active':''"></view>
        </block>
    </view>
    
    
    <view class="tn-padding-bottom" style="margin-top: -50rpx;">
      
      <!-- 更多信息-->
      <view class="tn-flex tn-flex-row-between tn-margin" @click="tn('')">
        <view class="justify-content-item tn-text-lg  tn-text-bold">
          群友项目
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <!-- <text class="tn-padding-xs">全部</text> -->
          <text class="tn-icon-right"></text>
        </view>
      </view>
      
      
      
      <view class="tn-flex tn-flex-wrap" style="margin: 15rpx;">
        <navigator target="miniProgram" :app-id="item.appid" :path="item.path" version="release" delta="1" hover-class="none"
           v-for="(item, index) in friend" :key="index" style="width: 50%;">
          <view class="tn-flex tn-flex-row-between tn-flex-col-center nav-shadow" style="margin: 15rpx;padding: 20rpx;">
            <view class="justify-content-item ">
              <view class="tn-flex tn-flex-col-center tn-flex-row-left">
                <view class="">
                  <view class="logo-pic">
                    <view class="logo-image" :style="'background-image:url('+ item.url +');background-size: cover;'">
                    </view>
                  </view>
                </view>
                <view class="">
                  <view class="tn-padding-right tn-padding-left-sm">
                    <text class="tn-color-cat tn-text-bold">{{item.title}}</text>
                    <!-- <text class=" tn-round tn-text-xs tn-bg-red tn-color-white tn-margin-left-sm" style="padding: 10rpx 20rpx;" @click="tn('/minePages/realname')">
                      未实名
                    </text> -->
                  </view>
                  <view class="tn-padding-right tn-padding-top-xs tn-text-xs tn-padding-left-sm tn-text-ellipsis">
                    <text class="tn-color-gray">{{item.author}}</text>
                  </view>
                </view>
          
              </view>
            </view>
          </view>
        </navigator>  
      </view>
      
      <!-- 更多信息-->
      <view class="tn-flex tn-flex-row-between tn-margin tn-padding-top-lg" @click="tn('')" >
        <view class="justify-content-item tn-text-lg  tn-text-bold">
          友情链接
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <!-- <text class="tn-padding-xs">全部</text> -->
          <text class="tn-icon-right"></text>
        </view>
      </view>
      
      
      <view class="tn-flex tn-flex-wrap" style="margin: 15rpx;">
        <navigator target="miniProgram" :app-id="item.appid" :path="item.path" version="release" delta="1" hover-class="none"
          v-for="(item, index) in support" :key="index" style="width: 33.33%;">
          <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center nav-shadow" style="margin: 15rpx;padding: 30rpx 0;">
            <view class="logo-pic">
              <view class="logo-image">
                <view class="" :style="'background-image:url('+ item.url +');width: 85rpx;height: 85rpx;background-size: cover;'">
                </view>
              </view>
            </view>
            <view class="tn-color-black tn-text-center tn-padding-top-xs">
              <text class="tn-text-ellipsis">{{item.title}}</text>
            </view>
          </view>
        </navigator>  
      </view>
      
      
      
      
      
      
      <!-- 更多信息-->
      <view class="tn-flex tn-flex-row-between tn-margin tn-padding-top-lg" @click="tn('')" >
        <view class="justify-content-item tn-text-lg  tn-text-bold">
          图鸟开源项目
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <!-- <text class="tn-padding-xs">全部</text> -->
          <text class="tn-icon-right"></text>
        </view>
      </view>
      
      
      <view class="nav-shadow tn-margin tn-padding" @click="copyDocuments">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex nav-pic tn-shadow">
              <view class="nav-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699053-assets/web-upload/8645ea3a-e0a9-4422-8364-cc5ede305c9f.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">使用文档</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制链接
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm tn-color-gray--dark">
          图鸟UI使用文档，一文读懂图鸟UI。
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding" @click="copyVideo">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex nav-pic tn-shadow">
              <view class="nav-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699098-assets/web-upload/e8b29292-72fc-4c1e-9d7c-fd9dba31cb62.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">视频教程</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制链接
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm tn-color-gray--dark">
          图鸟UI快速搭建uniapp项目、组件按需引入视频教程，视频长度4分钟。
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding" @click="copySource">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex nav-pic tn-shadow">
              <view class="nav-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105498-assets/web-upload/e21514a3-e2f5-457e-80c0-ba099b48357f.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">图鸟素材社区</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制链接
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm tn-color-gray--dark">
          图鸟免费商用素材，链接地址直接下载原图，或群公告获取素材包进行下载。
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding" @click="copyUi">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex nav-pic tn-shadow">
              <view class="nav-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105529-assets/web-upload/b046738f-225a-4887-89b1-f286746cb68a.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">图鸟UI</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制链接
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm tn-color-gray--dark">
          图鸟UI发布于DCloud插件市场上的免费可商用开源地址，支持适配微信小程序、APP、H5。
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding" @click="copyCircle">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex nav-pic tn-shadow">
              <view class="nav-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105529-assets/web-upload/b046738f-225a-4887-89b1-f286746cb68a.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">圈子博客</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制链接
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm tn-color-gray--dark">
          圈子博客发布于DCloud插件市场上的免费可商用开源地址，支持适配微信小程序、APP、H5。
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding" @click="copySimple">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex nav-pic tn-shadow">
              <view class="nav-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105529-assets/web-upload/b046738f-225a-4887-89b1-f286746cb68a.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">简约商圈</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制链接
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm tn-color-gray--dark">
          简约商圈发布于DCloud插件市场上的免费可商用开源地址，支持适配微信小程序、APP、H5。
        </view>
      </view>
      
      
      <view class="nav-shadow tn-margin tn-padding" @click="copyImage">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex nav-pic tn-shadow">
              <view class="nav-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105529-assets/web-upload/b046738f-225a-4887-89b1-f286746cb68a.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">凶姐壁纸</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制链接
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm tn-color-gray--dark">
          凶姐壁纸发布于DCloud插件市场上的免费可商用开源地址，支持适配微信小程序、APP、H5。
        </view>
      </view>
      
      
      <!-- 更多信息-->
       <view class="tn-flex tn-flex-row-between tn-margin tn-padding-top-lg" @click="tn('')">
         <view class="justify-content-item tn-text-lg  tn-text-bold">
           UI组件
         </view>
         <view class="justify-content-item tn-text-lg tn-color-gray">
           <!-- <text class="tn-padding-xs">全部</text> -->
           <text class="tn-icon-right"></text>
         </view>
       </view>
       
      
       
      <view class="tn-flex tn-flex-wrap tn-margin-sm">
        <navigator target="miniProgram" :app-id="item.appid" :path="item.path" version="release" delta="1" hover-class="none"
           v-for="(item, index) in uiList" :key="index" class="tn-flex-1 nav-shadow tn-bg-white" style="margin: 10rpx;padding: 20rpx;">
             <view class="tn-flex tn-flex-direction-row tn-flex-row-center tn-flex-col-center">
               <!-- <view class="logo-pic2 tn-padding-right-xs">
                 <view class="logo-image2">
                   <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699053-assets/web-upload/8645ea3a-e0a9-4422-8364-cc5ede305c9f.jpeg');width: 45rpx;height: 45rpx;background-size: cover;">
                   </view>
                 </view>
               </view> -->
               
               
               <view class="tn-text-center" style="font-size: 30rpx;">
                 <view class="tn-text-ellipsis">{{item.title}}</view>
               </view>
             </view>
         </navigator>
       </view>
       
      
      <!-- 更多信息-->
       <view class="tn-flex tn-flex-row-between tn-margin tn-padding-top-lg" @click="tn('')">
         <view class="justify-content-item tn-text-lg  tn-text-bold">
           其他功能
         </view>
         <view class="justify-content-item tn-text-lg tn-color-gray">
           <!-- <text class="tn-padding-xs">全部</text> -->
           <text class="tn-icon-right"></text>
         </view>
       </view>
      
      <view class="nav-shadow tn-margin tn-padding">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex shop-pic tn-shadow">
              <view class="shop-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699053-assets/web-upload/8645ea3a-e0a9-4422-8364-cc5ede305c9f.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">图鸟国际学院教务处电话</text>
            </view>
          </view>
          <view class="tn-color-gray">
            拨打电话
            <text class="tn-icon-tel-circle tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex shop-pic tn-shadow">
              <view class="shop-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105498-assets/web-upload/e21514a3-e2f5-457e-80c0-ba099b48357f.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">图鸟国际学院医务室电话</text>
            </view>
          </view>
          <view class="tn-color-gray">
            拨打电话
            <text class="tn-icon-tel-circle tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex shop-pic tn-shadow">
              <view class="shop-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105529-assets/web-upload/b046738f-225a-4887-89b1-f286746cb68a.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">图鸟国际学院邮编</text>
            </view>
          </view>
          <view class="tn-color-gray">
            复制邮编
            <text class="tn-icon-copy tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
      </view>
      
      <view class="nav-shadow tn-margin tn-padding" v-for="(item, index) in 2" :key="index">
        <view class="tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex">
            <view class="tn-flex shop-pic tn-shadow">
              <view class="shop-image">
                <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1647138105485-assets/web-upload/ad16d06b-c7ed-4d86-9c0e-277731627ea0.jpeg');width: 35rpx;height: 35rpx;background-size: cover;">
                </view>
              </view>
            </view>
            <view class="tn-flex tn-margin-left-xs" style="width: 400rpx;">
              <text class="clamp-text-1 tn-text-bold">图鸟科技-公众号</text>
            </view>
          </view>
          <view class="tn-color-gray">
            跳转公众号
            <text class="tn-icon-link tn-text-sm tn-color-gray" style="padding: 8rpx 0 8rpx 8rpx;"></text>
          </view>
        </view>
        <view class="tn-text-justify clamp-text-2 tn-padding-top-sm">
          公众号的描述公众号的描述公众号的描述
        </view>
      </view>
      
      
      
      
      <!-- <view id="top-info" class="tn-footerfixed tn-flex tn-flex-row-between tn-flex-col-center tn-padding tn-safe-area-inset-bottom dd-glass" :style="{transform: `translateY(${topInfoTranslateY}px)`}" @click="showModal"> -->
      <view class="tn-footerfixed tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-sm tn-padding-bottom-sm tn-padding-left tn-padding-right tn-bg-white" @click="showModal">
        <view class="justify-content-item">
          <view class="tn-flex tn-flex-col-center tn-flex-row-left">
            <view style="margin-right: 10rpx;">
              <tn-avatar-group :lists="groupList" size="sm"></tn-avatar-group>
            </view>
            <view class="tn-padding-right tn-color-gray">
              <view class="tn-padding-right tn-padding-left-sm">
                <text class="tn-text-df">1.29K 点赞</text>
              </view>
            </view>
          </view>
        </view>
        <view class="justify-content-item tn-flex-col-center tn-flex-row-center tn-text-center">
          <!-- 没点赞 -->
          <view class="tn-bg-gray--light tn-padding-xs tn-margin-sm tn-color-gray tn-round">
            <text class="tn-icon-like-lack" style="font-size: 50rpx;"></text>
          </view>
          <!-- 点赞 -->
          <!-- <view class="tn-bg-gray--light tn-padding-xs tn-margin-sm tn-color-orangered tn-round">
            <text class="tn-icon-like-fill" style="font-size: 50rpx;"></text>
          </view> -->
        </view>
      </view>
      
      
    </view>


    <view class='tn-tabbar-height'></view>
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateContent',
    mixins: [template_page_mixin],
    data(){
      return {
        cardCur: 0,
        swiperList: [{
          id: 0,
          type: 'image',
          name: '总有你想不到的创意',
          text: '海量分享',
          url: 'https://resource.tuniaokj.com/images/swiper/fullbg4.jpg',
          pngurl: 'https://resource.tuniaokj.com/images/swiper/c4d1.png'
        }, {
          id: 1,
          type: 'image',
          name: '寻找一起成长的小伙伴',
          text: '愉快玩耍',
          url: 'https://resource.tuniaokj.com/images/swiper/fullbg5.jpg',
          pngurl: 'https://resource.tuniaokj.com/images/swiper/c4d4.png'
        }, {
          id: 2,
          type: 'image',
          name: '更多彩蛋等你探索',
          text: '酷炫多彩',
          url: 'https://resource.tuniaokj.com/images/swiper/fullbg4.jpg',
          pngurl: 'https://resource.tuniaokj.com/images/swiper/c4d5.png'
        }, {
          id: 3,
          type: 'image',
          name: '商业合作请联系作者',
          text: '免费开源',
          url: 'https://resource.tuniaokj.com/images/swiper/fullbg5.jpg',
          pngurl: 'https://resource.tuniaokj.com/images/swiper/c4d6.png'
        }],
        friend: [
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666880829035-assets/web-upload/af62059a-aa92-44c5-9e6f-2be519f3de32.jpeg',
            // https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666880572856-assets/web-upload/77f07f2b-404d-4c08-8264-f70b8be138f9.jpeg
            title: '柒分糖图集',
            author: '弃续',
            appid: 'wxcd661761a9f2d61e',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666880878599-assets/web-upload/20429d4b-2776-445b-884a-78aa14901934.jpeg',
            title: '迷恋自留地',
            author: '今晚打老虎',
            appid: 'wx7560d334dd837f70',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666880969854-assets/web-upload/95902944-1be6-4c23-a2f5-47cf78eda072.jpeg',
            title: '江夏生活网',
            author: '王国柄',
            appid: 'wx2257f5c246ad1bcd',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1667656184223-assets/web-upload/cc3dbf5c-1483-4c74-83fc-03c2bd7c373e.jpeg',
            title: '多客圈子',
            author: '多客',
            appid: 'wx86cc21f2f7fa3efa',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666881024970-assets/web-upload/ce66dc47-d34f-499b-ab19-8253d5115f2c.jpeg',
            title: '见知网',
            author: '青云上云霄',
            appid: 'wx59376c14388a2165',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1679214581056-assets/web-upload/49298d50-78e1-4466-a01c-e3b4249adebb.jpeg',
            title: '小满同城圈',
            author: '筱智',
            appid: 'wxa1fdf598239935d7',
            path: ''
          }
        ],
        support: [
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666883514111-assets/web-upload/abc7f592-0967-458e-adc7-f8c1c11ef29f.jpeg',
            title: '绘图趣',
            author: 'Xu',
            appid: 'wx2f8cd6e0c703ca98',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1646963464962-assets/web-upload/3c14732e-cc92-4726-9a9c-1fa7133f8147.jpeg',
            title: '芊云全景',
            author: '天明',
            appid: 'wx9f77d65eb4eff65b',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/png/280373/1666764808285-assets/web-upload/b83d1b36-7355-4f36-bc02-9f06b8c0867c.png',
            title: '敬请期待',
            author: '作者名称',
            appid: 'wxf3d81a452b88ff4b',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/png/280373/1666764808285-assets/web-upload/b83d1b36-7355-4f36-bc02-9f06b8c0867c.png',
            title: '敬请期待',
            author: '作者名称',
            appid: 'wxf3d81a452b88ff4b',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/png/280373/1666764808285-assets/web-upload/b83d1b36-7355-4f36-bc02-9f06b8c0867c.png',
            title: '敬请期待',
            author: '作者名称',
            appid: 'wxf3d81a452b88ff4b',
            path: ''
          },
          {
            url: 'https://cdn.nlark.com/yuque/0/2022/png/280373/1666764808285-assets/web-upload/b83d1b36-7355-4f36-bc02-9f06b8c0867c.png',
            title: '敬请期待',
            author: '作者名称',
            appid: 'wxf3d81a452b88ff4b',
            path: ''
          }
        ],
        uiList: [
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1666427385515-assets/web-upload/5af071d8-55ba-4f2f-b574-196a068af7bd.png",
            title: "uView",
            appid: 'wxc256e348c4032ebd',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665816830025-assets/web-upload/8c87534b-c6eb-4e2f-9342-5cf5b811cb55.png",
            title: "VantUI",
            appid: 'wx5902fa56c2961815',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666427573390-assets/web-upload/3bcb5e18-b960-4133-84aa-c6a034c92a7e.jpeg",
            title: "ThorUI",
            appid: 'wxb6a98ca343f57a38',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665816830049-assets/web-upload/f68799a2-553e-4f91-9c57-14c61eb69d7c.png",
            title: "nPro",
            appid: 'wx4f16bef982e13464',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666435978831-assets/web-upload/f37fd596-9442-4653-8d1c-480d7ef5f0fe.jpeg",
            title: "ColorUI",
            appid: 'wxfd5241d66a07713f',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665814598054-assets/web-upload/b010d38b-08f8-46f6-8173-75e638cc2108.png",
            title: "TaroUI",
            appid: 'wx4d48003b69a17f4c',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665814598054-assets/web-upload/b010d38b-08f8-46f6-8173-75e638cc2108.png",
            title: "iViewUI",
            appid: 'wx307a52ca028d3c07',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666436108228-assets/web-upload/6b76e5af-edc4-4883-ae15-fd0e44eadde2.jpeg",
            title: "GraceUI",
            appid: 'wxbb7f9f1f2c6f4f33',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665816830025-assets/web-upload/8c87534b-c6eb-4e2f-9342-5cf5b811cb55.png",
            title: "TMUI",
            appid: 'wxa97ca08b1ed46b0a',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665814598054-assets/web-upload/b010d38b-08f8-46f6-8173-75e638cc2108.png",
            title: "FristUI",
            appid: 'wx6d1c826725d9a65a',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665816830025-assets/web-upload/8c87534b-c6eb-4e2f-9342-5cf5b811cb55.png",
            title: "WuxUI",
            appid: 'wx816264ac1982a645',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/png/280373/1665814598054-assets/web-upload/b010d38b-08f8-46f6-8173-75e638cc2108.png",
            title: "MinUI",
            appid: 'wx1163151b9383ce2b',
            remarks: ""
          },
          {
            icon: "https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1666435821970-assets/web-upload/86c2e49a-15d8-4583-9a1d-3cf3a55db499.jpeg",
            title: "AntUI",
            appid: 'wx282fc9c4183b714c',
            remarks: "下架了"
          }
        ],
        groupList: [
          {src: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648127-assets/web-upload/b8625625-2a52-47f9-a27c-adf6becd3c94.jpeg'},
          {src: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648152-assets/web-upload/410aa585-dd43-4e9a-912c-fc8c04e0e8f9.jpeg'},
          {src: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663571007436-assets/web-upload/e3fdeb91-d8d1-4187-8d91-593559543af3.jpeg'},
          {src: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648186-assets/web-upload/244e6b96-177a-40e6-953d-3ab080c22793.jpeg'},
          {src: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648156-assets/web-upload/3b9aa10c-36ca-43ff-9321-38fd1d3dfffc.jpeg'},
        ],
      }
    },
    methods: {
      // cardSwiper
      cardSwiper(e) {
        this.cardCur = e.detail.current
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
  
  /* 轮播视觉差 start */
  .card-swiper {
    height: 600rpx !important;
  }
    
  .card-swiper swiper-item {
    width: 750rpx !important;
    left: 0rpx;
    box-sizing: border-box;
    padding: 0rpx 0rpx 120rpx 0rpx;
    overflow: initial;
  }
    
  .card-swiper swiper-item .swiper-item {
    width: 100%;
    display: block;
    height: 100%;
    border-radius: 0rpx;
    transform: scale(1);
    transition: all 0.2s ease-in 0s;
    overflow: hidden;
  }
    
  .card-swiper swiper-item.cur .swiper-item {
    transform: none;
    transition: all 0.2s ease-in 0s;
  }
    
  .card-swiper swiper-item .swiper-item2 {
    margin-top: -340rpx;
    width: 100%;
    display: block;
    height: 100%;
    border-radius: 0rpx;
    transform: translate(340rpx, 20rpx) scale(0.5, 0.5);
    transition: all 0.6s ease 0s;
    overflow: hidden;
  }
    
  .card-swiper swiper-item.cur .swiper-item2 {
    margin-top: -340rpx;
    width: 100%;
    transform: translate(300rpx, 0rpx) scale(0.8, 0.8);
    transition: all 0.6s ease 0s;
  }
    
  .card-swiper swiper-item .swiper-item-text {
    margin-top: -320rpx;
    width: 100%;
    display: block;
    height: 50%;
    border-radius: 10rpx;
    transform: translate(0rpx, -40rpx) scale(0.7, 0.7);
    transition: all 0.6s ease 0s;
    overflow: hidden;
  }
    
  .card-swiper swiper-item.cur .swiper-item-text {
    margin-top: -380rpx;
    width: 100%;
    transform: translate(0rpx, 0rpx) scale(0.9, 0.9);
    transition: all 0.6s ease 0s;
  }
  
  .image-banner{
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .image-banner image{
    width: 100%;
  }
  
  /* 轮播指示点 start*/
  .indication{
    z-index: 9999;
    width: 100%;
    height: 36rpx;
    position: absolute;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:center;
  }
  
  .spot{
    background-color: #FFF;
    opacity: 0.4;
    width: 10rpx;
    height: 10rpx;
    border-radius: 20rpx;
    margin: 0 8rpx !important;
    left: -270rpx;
    top: -180rpx;
    position: relative;
  }
  
  .spot.active{
    opacity: 1;
    width: 30rpx;
    background-color: #FFF;
  }
  
  /* 底部安全边距 start*/
  .tn-tabbar-height {
  	min-height: 120rpx;
  	height: calc(140rpx + env(safe-area-inset-bottom) / 2);
    height: calc(140rpx + constant(safe-area-inset-bottom));
  }
  .tn-footerfixed {
    position: fixed;
    background-color: rgba(255,255,255,0.5);
    box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);
    bottom: 0;
    width: 100%;
    transition: all 0.25s ease-out;
    z-index: 100;
  }
  
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
  
  /* 用户头像 start */
  .shop-image {
    width: 35rpx;
    height: 35rpx;
    position: relative;
    overflow: hidden;
    border-radius: 50%;
  }
  
  .shop-pic {
    background-size: cover;
    background-repeat: no-repeat;
    // background-attachment:fixed;
    background-position: top;
    border: 1rpx solid rgba(255,255,255,0.05);
    box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
    border-radius: 50%;
    overflow: hidden;
    // background-color: #FFFFFF;
  }
  
  
  /* 阴影 start*/
  .nav-shadow {
    border-radius: 15rpx;
    box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }   
   
   
   /* 用户头像 start */
   .nav-image {
     width: 35rpx;
     height: 35rpx;
     position: relative;
     overflow: hidden;
     border-radius: 50%;
   }
   
   .nav-pic {
     background-size: cover;
     background-repeat: no-repeat;
     // background-attachment:fixed;
     background-position: top;
     border: 1rpx solid rgba(255,255,255,0.05);
     box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
     border-radius: 50%;
     overflow: hidden;
     // background-color: #FFFFFF;
   }
   
   .icon12 {
     &__item {
       width: 30%;
       background-color: #FFFFFF;
       border-radius: 10rpx;
       padding: 30rpx;
       margin: 20rpx 10rpx;
       transform: scale(1);
       transition: transform 0.3s linear;
       transform-origin: center center;
       
       &--icon {
         width: 100rpx;
         height: 100rpx;
         font-size: 60rpx;
         border-radius: 50%;
         margin-bottom: 18rpx;
         position: relative;
         z-index: 1;
         
         &::after {
           content: " ";
           position: absolute;
           z-index: -1;
           width: 100%;
           height: 100%;
           left: 0;
           bottom: 0;
           border-radius: inherit;
           opacity: 1;
           transform: scale(1, 1);
           background-size: 100% 100%;
           background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg.png);
   
             
         }
       }
     }
   }
   
   
   /* 用户头像 start */
   .logo-image {
     width: 85rpx;
     height: 85rpx;
     position: relative;
     overflow: hidden;
     border-radius: 50%;
   }
   
   .logo-pic {
     background-size: cover;
     background-repeat: no-repeat;
     // background-attachment:fixed;
     background-position: top;
     border: 1rpx solid #F8F7F8;
     // box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
     border-radius: 50%;
     overflow: hidden;
     // background-color: #FFFFFF;
   }
   
   /* 用户头像 start */
   .logo-image2 {
     width: 45rpx;
     height: 45rpx;
     position: relative;
     overflow: hidden;
     border-radius: 50%;
   }
   
   .logo-pic2 {
     background-size: cover;
     background-repeat: no-repeat;
     // background-attachment:fixed;
     background-position: top;
     border: 1rpx solid #F8F7F8;
     // box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
     border-radius: 50%;
     overflow: hidden;
     // background-color: #FFFFFF;
   }
   

</style>
