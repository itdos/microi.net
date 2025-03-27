<template>
	<view class="template-edit tn-safe-area-inset-bottom" v-if="CurrentUser.YunxuFBNR">
		<!-- 顶部自定义导航 -->
		<tn-nav-bar fixed alpha customBack>
			<view slot="back" class='tn-custom-nav-bar__back' @click="goBack">
				<text class='icon tn-icon-left'></text>
				<text class='icon tn-icon-home-capsule-fill'></text>
			</view>
		</tn-nav-bar>

		<view class="tn-safe-area-inset-bottom" :style="{paddingTop: vuex_custom_bar_height + 'px'}">

			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top tn-margin">
				<view class="tn-flex justify-content-item">
					<view class="tn-bg-black tn-color-white tn-text-center"
						style="border-radius: 100rpx;margin-right: 8rpx;width: 45rpx;height: 45rpx;line-height: 45rpx;">
						<text class="tn-icon-topics" style="font-size: 30rpx;"></text>
					</view>
					<view class="tn-text-lg tn-padding-right-xs tn-text-bold">填写或采集内容</view>
				</view>
				<!-- <view class="justify-content-item tn-text-df tn-color-grey">
          <text class="tn-padding-xs">500字内</text>
          <text class="tn-icon-keyboard-circle"></text>
        </view> -->
			</view>

			<view class="tn-margin tn-bg-gray--light" style="border-radius: 10rpx;padding: 20rpx 30rpx;">
				<input v-model="ContentModel.Biaoti" placeholder="写下一句简短的标题" name="input"
					placeholder-style="color:#AAAAAA"></input>
			</view>
			<view v-if="ShowCaiji" class="tn-margin tn-bg-gray--light"
				style="border-radius: 10rpx;padding: 20rpx 30rpx;">
				<input v-model="ContentModel.CaijiLYURL" placeholder="采集来源url" name="input"
					placeholder-style="color:#AAAAAA"></input>
			</view>
			<view v-if="ShowCaiji" class="tn-margin tn-bg-gray--light"
				style="border-radius: 10rpx;padding: 20rpx 30rpx;">
				<input v-model="ContentModel.CaijiLYZZ" placeholder="采集来源作者" name="input"
					placeholder-style="color:#AAAAAA"></input>
			</view>
			<view class="tn-margin tn-bg-gray--light tn-padding" style="border-radius: 10rpx;">
				<textarea v-model="ContentModel.Xiangqing" maxlength="500" placeholder="内容详情或需要采集的地址"
					placeholder-style="color:#AAAAAA" style="height: 160rpx;width: 100%;"></textarea>
			</view>

			<view class="tn-margin">
				<view class="tn-flex-1 justify-content-item tn-text-center">
					<!-- <tn-button backgroundColor="#3668fc" padding="40rpx 0" width="100rpx" fontBold
						:disabled="BtnLoading" @click="pasteFromClipboard()" class="tn-margin-right-xs"
						style="margin-right: 10rpx;"
						>
						<text class="tn-color-white">粘贴</text>
					</tn-button> -->
					<tn-button backgroundColor="#3668fc" padding="40rpx 0" width="200rpx" fontBold
						:disabled="BtnLoading" @click="GetRenderHtml('Image')" class="tn-margin-right-xs"
						style="margin-right: 10rpx;">
						<text class="tn-icon-image-fill tn-color-white" style="margin-right: 4rpx;"></text>
						<text class="tn-color-white">采集图片</text>
					</tn-button>
					<tn-button backgroundColor="#3668fc" padding="40rpx 0" width="200rpx" fontBold
						:disabled="BtnLoading" @click="GetRenderHtml('ShortVideo')" class="tn-margin-right-xs"
						style="margin-right: 10rpx;">
						<text class="tn-icon-video-fill tn-color-white" style="margin-right: 4rpx;"></text>
						<text class="tn-color-white">采集视频</text>
					</tn-button>
					<!-- <tn-button backgroundColor="#3668fc" padding="40rpx 0" width="100rpx" fontBold
						:disabled="BtnLoading" @click="CheckUrl()">
						<text class="tn-color-white">检测</text>
					</tn-button> -->
				</view>
			</view>

			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xl tn-margin">
				<view class="tn-flex justify-content-item">
					<view class="tn-bg-black tn-color-white tn-text-center"
						style="border-radius: 100rpx;margin-right: 8rpx;width: 45rpx;height: 45rpx;line-height: 45rpx;">
						<text class="tn-icon-image" style="font-size: 30rpx;"></text>
					</view>
					<view class="tn-text-lg tn-padding-right-xs tn-text-bold">文件列表 *</view>
				</view>
				<view class="justify-content-item tn-text-df tn-color-grey" @tap="clear">
					<text class="tn-padding-xs">清空</text>
					<text class="tn-icon-delete"></text>
				</view>
			</view>

			<view class="tn-margin-left tn-padding-top-xs">
				<tn-image-upload-drag v-if="!Spidering && ContentModel.Fenlei == 'Image'" ref="imageUpload"
					:action="Microi.ApiBase + Microi.Api.UniappUpload" :multiple="true" :width="236" :height="236"
					:formData="UploadFormData" :header="UploadHeader" :fileList="fileList" :maxCount="maxCount"
					:autoUpload="true" uploadText="上传图片" @onSuccess="UploadOnSuccess" @onError="UploadOnError"
					@sort-list="onSortList" />
				<video v-if="!Spidering && ContentModel.Fenlei == 'ShortVideo'" :loop="true" :src="VideoUrl"
					:style="{ height:'236rpx', width:'236rpx' }" :enable-progress-gesture="false" :page-gesture="false"
					:controls="true" :http-cache="true" :show-loading="true" :show-fullscreen-btn="true"
					:show-center-play-btn="false" :object-fit="'contain'"
					:poster="Microi.FileServer + ContentModel.YulanT"
					></video>
				<view v-if="Spidering" style="height: 100rpx;line-height: 100rpx;text-align: center;font-size: 28rpx;">
					Loading...
				</view>

			</view>

			<!-- <view class="tn-margin">
				<view class="tn-flex-1 justify-content-item tn-margin-sm tn-text-center">
					<tn-button backgroundColor="#3668fc" padding="40rpx 0" width="70%" fontBold 
						:disabled="BtnLoading"
						@click="upload()">
						<text class="tn-color-white">全部上传</text>
					</tn-button>
				</view>
			</view> -->

			<!-- <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xl tn-margin">
				<view class="tn-flex justify-content-item">
					<view class="tn-bg-black tn-color-white tn-text-center"
						style="border-radius: 100rpx;margin-right: 8rpx;width: 45rpx;height: 45rpx;line-height: 45rpx;">
						<text class="tn-icon-tag" style="font-size: 30rpx;"></text>
					</view>
					<view class="tn-text-lg tn-padding-right-xs tn-text-bold">标签</view>
				</view>
				<view class="justify-content-item tn-text-df tn-color-grey">
					<text class="tn-padding-xs">多选</text>
					<text class="tn-icon-constellation"></text>
				</view>
			</view>

			<view class="tn-tag-content tn-margin tn-text-justify">
				<view v-for="(item, index) in tags" :key="index"
					class="tn-tag-content__item tn-margin-right tn-round tn-text-sm tn-text-bold"
					:class="[item.select ? `tn-bg-${item.color}--light tn-color-${item.color}` : 'tn-bg-gray--light tn-color-gray--dark']"
					@click="handleTagsClick(index)">
					<text :class="['tn-padding-right-xs tn-icon-' + item.icon]"></text> {{ item.title }}
				</view>
			</view> -->
			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xl tn-margin">
				<view class="tn-flex justify-content-item">
					<view class="tn-bg-black tn-color-white tn-text-center"
						style="border-radius: 100rpx;margin-right: 8rpx;width: 45rpx;height: 45rpx;line-height: 45rpx;">
						<text class="tn-icon-tag" style="font-size: 30rpx;"></text>
					</view>
					<view class="tn-text-lg tn-padding-right-xs tn-text-bold">内容分类</view>
				</view>
				<view class="justify-content-item tn-text-df tn-color-grey">
					<text class="tn-padding-xs">单选</text>
					<text class="tn-icon-constellation"></text>
				</view>
			</view>
			<view class="tn-tag-content tn-margin tn-text-justify">
				<view>
					<tn-radio-group v-model="ContentModel.NeirongFL" @change="NeirongFLChange">
						<tn-radio v-for="(item, index) in NeirongFLList" :key="item.Id" :name="item.Key">
							{{item.Mingcheng}}
						</tn-radio>
					</tn-radio-group>
				</view>
			</view>
			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xl tn-margin">
				<view class="tn-flex justify-content-item">
					<view class="tn-bg-black tn-color-white tn-text-center"
						style="border-radius: 100rpx;margin-right: 8rpx;width: 45rpx;height: 45rpx;line-height: 45rpx;">
						<text class="tn-icon-tag" style="font-size: 30rpx;"></text>
					</view>
					<view class="tn-text-lg tn-padding-right-xs tn-text-bold">浏览量</view>
				</view>
				<!-- <view class="justify-content-item tn-text-df tn-color-grey">
					<text class="tn-padding-xs">单选</text>
					<text class="tn-icon-constellation"></text>
				</view> -->
			</view>
			<view class="tn-tag-content tn-margin tn-text-justify">
				<view style="padding-left: 50rpx;padding-right: 50rpx;">
					<tn-slider v-model="ContentModel.Hits" :mix="0" :max="1500">
						<view class="tn-slider__custom-block">
						  {{ ContentModel.Hits }}
						</view>
					</tn-slider>
				</view>
			</view>
			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xl tn-margin">
				<view class="tn-flex justify-content-item">
					<view class="tn-bg-black tn-color-white tn-text-center"
						style="border-radius: 100rpx;margin-right: 8rpx;width: 45rpx;height: 45rpx;line-height: 45rpx;">
						<text class="tn-icon-tag" style="font-size: 30rpx;"></text>
					</view>
					<view class="tn-text-lg tn-padding-right-xs tn-text-bold">内容类型</view>
				</view>
				<view class="justify-content-item tn-text-df tn-color-grey">
					<text class="tn-padding-xs">单选</text>
					<text class="tn-icon-constellation"></text>
				</view>
			</view>

			<view class="tn-tag-content tn-margin tn-text-justify">
				<view class="tn-margin-bottom-sm">
					<tn-radio-group v-model="ContentModel.Fenlei" @change="FenleiChange">
						<tn-radio v-for="(item, index) in FenleiList" :key="item.Id" :name="item.Key">
							{{item.Mingcheng}}
						</tn-radio>
					</tn-radio-group>
				</view>
			</view>

			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xl tn-margin">
				<view class="tn-flex justify-content-item">
					<view class="tn-bg-black tn-color-white tn-text-center"
						style="border-radius: 100rpx;margin-right: 8rpx;width: 45rpx;height: 45rpx;line-height: 45rpx;">
						<text class="tn-icon-tag" style="font-size: 30rpx;"></text>
					</view>
					<view class="tn-text-lg tn-padding-right-xs tn-text-bold">其它信息</view>
				</view>
				<!-- <view class="justify-content-item tn-text-df tn-color-grey">
					<text class="tn-padding-xs">单选</text>
					<text class="tn-icon-constellation"></text>
				</view> -->
			</view>

			<view class="tn-tag-content tn-margin tn-text-justify">
				<!-- <tn-checkbox-group>
				  <tn-checkbox v-model="ContentModel.ShifouMF" :name="'ShifouMF'">是否免费</tn-checkbox>
				  <tn-checkbox v-model="ContentModel.ShifouTJ" :name="'ShifouTJ'">是否推荐首页</tn-checkbox>
				  <tn-checkbox v-model="ContentModel.WeixinXCXBKJ" :name="'WeixinXCXBKJ'">小程序不可见</tn-checkbox>
				  <tn-checkbox v-model="ContentModel.WeidengLBKJ" :name="'WeidengLBKJ'">未登录不可见</tn-checkbox>
				  <tn-checkbox v-model="ContentModel.MianfeiHYBKJ" :name="'MianfeiHYBKJ'">免费会员不可见</tn-checkbox>
				</tn-checkbox-group> -->
				<tn-form :labelWidth="200" style="text-align: center;">
					<view  class="tn-flex">
						<view class="tn-flex-6">
							<tn-form-item  label="是否发布" style="text-align: center;">
								<tn-switch v-model="ContentModel.ShifouFB"></tn-switch>
							</tn-form-item>
							
						</view>
						<view  class="tn-flex-6">
							<tn-form-item  label="是否免费" style="text-align: center;">
								<tn-switch v-model="ContentModel.ShifouMF"></tn-switch>
							</tn-form-item>
						</view>
					</view>
					<view class="tn-flex">
						<view class="tn-flex-6">
							<!-- <tn-form-item label="是否推荐首页">
								<tn-switch v-model="ContentModel.ShifouTJ"></tn-switch>
							</tn-form-item> -->
							<tn-form-item class="tn-flex-6" label="小程序不可见">
								<tn-switch v-model="ContentModel.WeixinXCXBKJ"></tn-switch>
							</tn-form-item>
						</view>
						<view class="tn-flex-6">
							<!-- <tn-form-item label="未登录不可见">
								<tn-switch v-model="ContentModel.WeidengLBKJ"></tn-switch>
							</tn-form-item>
							<tn-form-item label="非手机号会员不可见">
								<tn-switch v-model="ContentModel.FeishouJHHYBKJ"></tn-switch>
							</tn-form-item>
							<tn-form-item label="是否置顶">
								<tn-switch v-model="ContentModel.ShifouZD"></tn-switch>
							</tn-form-item> -->
							<tn-form-item  class="tn-flex-6"label="仅会员可见">
								<tn-switch v-model="ContentModel.MianfeiHYBKJ"></tn-switch>
							</tn-form-item>
						</view>
					</view>
					<view  class="tn-flex">
						<view class="tn-flex-6">
							<tn-form-item class="tn-flex-6" label="非竖屏内容">
								<tn-switch v-model="ContentModel.HengxiangSP"></tn-switch>
							</tn-form-item>
						</view>
						<view class="tn-flex-6">
							<tn-form-item class="tn-flex-6" label="不推荐近期">
								<tn-switch v-model="ContentModel.ButuiJJQRM"></tn-switch>
							</tn-form-item>
						</view>
					</view>
				</tn-form>
			</view>

			<!-- 悬浮按钮-->
			<view class="tn-flex tn-footerfixed">
				<view class="tn-flex-1 justify-content-item tn-margin-sm tn-text-center">
					<tn-button backgroundColor="#3668fc" padding="40rpx 0" width="70%" fontBold :disabled="BtnLoading"
						@click="SubmitContent">
						<!-- <text class="tn-icon-light tn-padding-right-xs tn-color-black"></text> -->
						<text class="tn-color-white">发 布 </text>
						<!-- <text class="tn-icon-camera tn-padding-left-xs tn-color-black"></text> -->
					</tn-button>
					<!-- <view class="tn-padding-xs tn-text-sm">
						<text class="tn-icon-tip-fill tn-color-gray tn-padding-right-xs"></text>
						<text class="tn-color-gray">发布 +20 积分</text>
					</view> -->
				</view>
			</view>

		</view>
		
		<tn-modal v-model="ShowCheck"
			:custom="true" 
			:showCloseBtn="true"
			:title="'采集重复检测'"
			:safeAreaInsetBottom="true"
			>
			<view class="custom-modal-content">
				<view class="tn-icon tn-icon-about-fill"></view>
				<view ref="content" class="content">
					<view class="text" v-html="CheckResultText"></view>
				</view>
				<view style="margin-top: 20rpx;margin-bottom: 20rpx;">
					<!-- <tn-button shape="round" backgroundColor="#1D2541" fontColor="#ffffff" padding="40rpx 70rpx" width="100%" shadow
						@tap="CopyContent()"
						>
					  <text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text>
					  <text class="">
						  复制内容
					  </text>
					</tn-button> -->
					<view>已采集预览图</view>
					<image v-for="(item, index) in CheckResultData" :key="item.Id"
						style="width: 150rpx;height:200rpx;float:left;margin: 10rpx;"
						:src="Microi.FileServer + item.YulanT"
						mode="aspectFill"
					></image>
				</view>
				<view style="clear: both;"></view>
				<view style="margin-top: 20rpx;margin-bottom: 20rpx;">
					<view>当前预览图</view>
					<image style="width: 150rpx;height:200rpx;margin: 10rpx;"
						:src="(ContentModel.YulanT.startsWith('http') || ContentModel.YulanT.startsWith('wxfile://') || ContentModel.YulanT.startsWith('_doc/uniapp_temp')) ? ContentModel.YulanT : Microi.FileServer + ContentModel.YulanT"
						mode="aspectFill"
					></image> 
				</view>
			</view>
		</tn-modal>


		<view class='tn-tabbar-height'></view>

	</view>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
	export default {
		name: 'TemplateEdit',
		mixins: [template_page_mixin],
		computed: {
			...mapState({
				CurrentUser: function() {
					return this.$MicroiStore.state.CurrentUser;
				},
				IsLogin: function() {
					return this.$MicroiStore.state.IsLogin;
				},
			}),
		},
		data() {
			return {
				Microi: this.Microi,
				ShowCheck : false,
				CheckResultText : '',
				CheckResultData:[],
				ShowCaiji: false,
				tags: [{
						icon: "topic",
						title: "原神",
						color: 'red',
						select: false
					},
					{
						icon: "topic",
						title: "LOL",
						color: 'cyan',
						select: false
					},
					{
						icon: "topic",
						title: "JsNZK",
						color: 'blue',
						select: false
					},
					{
						icon: "topic",
						title: "科技",
						color: 'green',
						select: false
					},
					{
						icon: "topic",
						title: "免费",
						color: 'orange',
						select: false
					},
					{
						icon: "topic",
						title: "前端",
						color: 'purplered',
						select: false
					},
					{
						icon: "topic",
						title: "后端",
						color: 'purple',
						select: false
					},
					{
						icon: "topic",
						title: "UI设计",
						color: 'orangered',
						select: false
					},
					{
						icon: "topic",
						title: "求助",
						color: 'orangeyellow',
						select: false
					},
					{
						icon: "topic",
						title: "吃货",
						color: 'brown',
						select: false
					},
					{
						icon: "topic",
						title: "萌宠",
						color: 'grey',
						select: false
					}
				],
				VideoUrl: '',
				UploadFormData: {
					Path: '/file',
					Limit: 'true',
					Preview: false,

					// apiType: 'this,ali',
					// token: 'dffc1e06e636cff0fdf7d877b6ae6a2e',
					// image: null
				},
				UploadHeader: {
					osclient: this.Microi.OsClient,
					authorization: 'Bearer ' + this.Microi.GetToken()
				},
				fileList: [],
				autoUpload: true,
				customStyle: false,
				maxCount: 100,
				FenleiList: [],
				NeirongFLList: [],
				ContentModel: {
					Fenlei: 'Image',
					NeirongFL: '',
					YulanT: '',
					WenjianDZ: [],
					CaijiLYURL: '', //采集来源Url
					CaijiLYZZ: '',
					Zhuangtai: 1,
					Hits:0,
					ShifouFB: true,
					ShifouMF: false,
					ShifouTJ: true,
					WeixinXCXBKJ: false,
					WeidengLBKJ: false,
					MianfeiHYBKJ: false,
					FeishouJHHYBKJ:false,
					ShifouZD:false,
					HengxiangSP:false,
					ButuiJJQRM : false,
					Biaoti: '',
					Xiangqing: '',
				},
				ContentModelDefault: {
					Fenlei: 'Image',
					NeirongFL: '',
					YulanT: '',
					WenjianDZ: [],
					CaijiLYURL: '', //采集来源Url
					CaijiLYZZ: '',
					Zhuangtai: 1,
					Hits:0,
					ShifouFB: true,
					ShifouMF: false,
					ShifouTJ: true,
					WeixinXCXBKJ: false,
					WeidengLBKJ: false,
					MianfeiHYBKJ: false,
					FeishouJHHYBKJ:false,
					ShifouZD:false,
					HengxiangSP:false,
					ButuiJJQRM : false,
					Biaoti: '',
					Xiangqing: '',
				},
				BtnLoading: false,
				Spidering: false,
			}
		},
		async onLoad() {
			var self = this;
			self.Microi.ApiEngine.Run('get_fenlei', {
				_GetAll: 1
			}, function(result) {
				if (self.Microi.CheckResult(result)) {
					self.NeirongFLList = result.Data;
				}
			})
			self.Microi.ApiEngine.Run('get_fenlei', {
				ParentKey: 'ContentType',
				_GetAll: 1,
			}, function(result) {
				if (self.Microi.CheckResult(result)) {
					self.FenleiList = result.Data;
				}
			})
		},
		methods: {
			pasteFromClipboard() {
				var self = this;
				uni.getClipboardData({
					success: (res) => {
						self.ContentModel.Xiangqing = res.data;
						const pattern = /((http|https):\/\/[^\s]+)/g;
						const links = self.ContentModel.Xiangqing.match(pattern) || [];
						if (links.length == 0) {
							self.Microi.Tips('未发现链接！', false);
							return;
						}
						var url = links[0];
						self.Microi.ApiEngine.Run('get_url_isspider', {
							Url: url
						}, function(result) {
							if (self.Microi.CheckResult(result)) {
								self.Microi.Tips(`该url【${url}】已采集过【${result.DataCount}】次。`);
							}
						});
					},
					fail: (err) => {
						self.Microi.Tips('获取剪切板内容失败:' + err.message, false);
					}
				});
			},
			CheckUrl() {
				var self = this;
				self.BtnLoading = true;
				try{
					const pattern = /((http|https):\/\/[^\s]+)/g;
					const links = self.ContentModel.Xiangqing.match(pattern) || [];
					if (links.length == 0) {
						self.Microi.Tips('未发现链接！', false);
						return;
					}
					var url = links[0];
					self.Microi.ApiEngine.Run('get_content_isspider', {
						Url: url,
						Biaoti: self.ContentModel.Biaoti,
						CaijiLYZZ: self.ContentModel.CaijiLYZZ
					}, function(result) {
						if (self.Microi.CheckResult(result)) {
							if(!self.ContentModel.Biaoti){
								self.Microi.Tips(`该url[${url}]已采集过[${result.DataCount}]次`);
							}else{
								var biaoti = self.ContentModel.Biaoti.toString();
								if(biaoti.length > 20){
									biaoti = biaoti.substring(0, 20) + '...';
								}
								var checkResultText = `该url【${url}】已采集过【${result.DataCount}】次。<br>该作者【${self.ContentModel.CaijiLYZZ}】、标题【${biaoti}】已采集过【${result.DataAppend.BiaotiDataCount}】次。`;
								//self.Microi.Tips(checkResultText);
								self.CheckResultText = checkResultText;
								self.CheckResultData = [];
								self.ShowCheck = true;
								if(result.DataAppend.BiaotiData && result.DataAppend.BiaotiData.length > 0){
									self.CheckResultData = result.DataAppend.BiaotiData;
								}
							}
						}
						self.BtnLoading = false;
					});
				}catch(e){
					self.Microi.Tips(e.message, false);
					self.BtnLoading = false;
				}
			},
			UploadOnError(err, index, sortList, index2) {
				var self = this;
			},
			UploadOnSuccess(data, index, sortList, index2) {
				var self = this;
			},
			async SubmitContent() {
				var self = this;
				self.BtnLoading = true;
				if (!self.ContentModel.Biaoti) {
					self.BtnLoading = false;
					self.Microi.Tips('请填写标题！', false);
					return;
				}
				if (!self.ContentModel.Fenlei) {
					self.BtnLoading = false;
					self.Microi.Tips('请选择类型！', false);
					return;
				}
				if (!self.ContentModel.NeirongFL) {
					self.BtnLoading = false;
					self.Microi.Tips('请选择分类！', false);
					return;
				}
				try {
					var param = {
						...self.ContentModel
					};
					if (self.ContentModel.Fenlei == 'Image') {
						var uploadSortList = self.$refs.imageUpload.sortList();
						/*
						var wenjianDZList = [];
						if(uploadSortList){
							for(var i = 0; i < uploadSortList.length; i++){
								var item = uploadSortList[i];
								if(item.progress != 100){
									self.BtnLoading = false;
									self.Microi.Tips('请等待图片全部上传成功！', false);
									return;
								}
								//item.response.Data在线上是undefined
								wenjianDZList.push(item.response.Data);
							}
						}
						
						if(wenjianDZList.length == 0){
							self.BtnLoading = false;
							self.Microi.Tips('未上传文件！', false);
							return;
						}
						*/

						param.WenjianDZ = JSON.stringify(self.ContentModel.WenjianDZ);

						//预览图取文件地址第1张，但文件地址是私有桶，需再传1次公有桶
						var yulantResult = await self.Microi.Upload({
							Path: '/img',
							File: uploadSortList[0].url,
						});
						if (!yulantResult.Code) {
							self.BtnLoading = false;
							self.Microi.Tips('上传预览图失败：' + yulantResult.Msg, false);
							return;
						}
						param.YulanT = yulantResult.Data.Path;
					} else {
						param.WenjianDZ = JSON.stringify(self.ContentModel.WenjianDZ);
					}
					if (self.ContentModel.CaijiSM) {
						param.Xiangqing = '';
						param.CaijiSM = self.ContentModel.CaijiSM;
					}
					var result = await self.Microi.FormEngine.AddFormData('diy_content', param);
					if (self.Microi.CheckResult(result)) {
						self.Microi.Tips('发布成功！');
						self.ContentModel = {
							...self.ContentModelDefault
						};
						self.clear();
					}
					self.BtnLoading = false;
				} catch (e) {
					self.BtnLoading = false;
					self.Microi.Tips('前端错误：' + e.message, false);
					return;
				}
			},
			async GetRenderHtml(type) {
				var self = this;
				
				self.ContentModel = {
					...self.ContentModelDefault
				};
				self.clear();
				
				uni.getClipboardData({
					success: async (res) => {
						self.ContentModel.Xiangqing = res.data;
						const pattern = /((http|https):\/\/[^\s]+)/g;
						const links = self.ContentModel.Xiangqing.match(pattern) || [];
						if (links.length == 0) {
							self.Microi.Tips('未发现链接！', false);
							return;
						}
						var url = links[0];
						var get_url_isspiderResult = await self.Microi.ApiEngine.Run('get_url_isspider', {
							Url: url
						});
						if (!self.Microi.CheckResult(get_url_isspiderResult)) {
							return;
						}
						
						if(get_url_isspiderResult.DataCount > 0){
							// self.Microi.Tips(`该url【${url}】已采集过【${get_url_isspiderResult.DataCount}】次。`);
							self.Microi.ConfirmTips(`该url【${url}】已采集过【${get_url_isspiderResult.DataCount}】次，是否继续采集？`,async function(){
								await self.RealGetRenderHtml(type);
							});
						}
						await self.RealGetRenderHtml(type);
					},
					fail: (err) => {
						self.Microi.Tips('获取剪切板内容失败:' + err.message, false);
					}
				});
			},
			async RealGetRenderHtml(type) {
				var self = this;
				self.ShowCaiji = true;
				self.Spidering = true;
				self.BtnLoading = true;
				if (!self.ContentModel.Xiangqing) {
					self.BtnLoading = false;
					self.Spidering = false;
					self.Microi.Tips('未发现链接！', false);
					return;
				}
				try{
					const pattern = /((http|https):\/\/[^\s]+)/g;
					const links = self.ContentModel.Xiangqing.match(pattern) || [];
					if (links.length == 0) {
						self.BtnLoading = false;
						self.Spidering = false;
						self.Microi.Tips('未发现链接！', false);
						return;
					}
					var caijiLink = links[0];
					self.ContentModel.CaijiLYURL = caijiLink;
					var param = {
						Headless: false,
						IsCloseBrowser: false,
						Url: caijiLink,
						ContentType: type,
					}
					if (type == 'ShortVideo') {
						self.ContentModel.Fenlei = 'ShortVideo';
						param.IsClosePage = true;
					} else {
						self.ContentModel.Fenlei = 'Image';
						param.IsClosePage = false;
					}
					var result = await self.Microi.Post(self.Microi.SpiderApiBase + '/apiengine/spider', param,  null, {
						DataType: 'json'
					});
					if (self.Microi.CheckResult(result)) {
						if(!result.Data.FileUrls && result.Data.FileUrls.length == 0){
							
						}
						if (result.Data.Author && result.Data.Author.length > 0) {
							self.ContentModel.CaijiLYZZ = result.Data.Author[0]; //采集作者
						}
						if (result.Data.Title && result.Data.Title.length > 0) {
							var title = result.Data.Title[0]; //采集标题
							title = title.replace(/ - 抖音/g, '');
							title = title.replace(/- 抖音/g, '');
							title = title.replace(/ 抖音/g, '');
							title = title.replace(/抖音/g, '');
							title = title.replace(/快手/g, '');
							self.ContentModel.Biaoti = title
						}
						self.ContentModel.CaijiSM = self.ContentModel.Xiangqing.toString(); //采集说明
						//采集内容
						self.fileList = [];
						if (type == 'Image') {
							//1、先批量并行下载
							const downloadPromises = result.Data.FileUrls.map(url => self.Microi.Download(
								url));
							const downloadResults = await Promise.all(downloadPromises);
							downloadResults.forEach(item => {
								self.fileList.push({
									url: item.Data.tempFilePath,
								});
							});
							//2、再批量并行上传
							const uploadPromises = downloadResults.map(item => self.Microi.Upload({
								Path: '/file',
								File: item.Data.tempFilePath,
								Limit: 'true',
							}));
							const uploadResults = await Promise.all(uploadPromises);
							var wenjianDZ = []
							uploadResults.forEach(item => {
								if(item.Code == 1){
									wenjianDZ.push(item.Data);
								}
							});
							self.ContentModel.WenjianDZ = wenjianDZ;
							if(downloadResults.length > 0){ 
								self.ContentModel.YulanT = downloadResults[0].Data.tempFilePath;
							}
							/*
							for(var i = 0; i < result.Data.FileUrls.length; i++){
								var url = result.Data.FileUrls[i];
								var downResult = await self.Microi.Download(url);
								if(self.Microi.CheckResult(downResult)){
									self.fileList.push({
										url : downResult.Data.tempFilePath,
									});
								}
							}*/
						} else {
							//如果是抖音视频，只需要FileUrls的第一个
							for (var i = 0; i < result.Data.FileUrls.length; i++) {
								if(i > 0 && type == 'ShortVideo' && caijiLink.indexOf('v.douyin.com') > -1){
									continue;
								}
								var url = result.Data.FileUrls[i];
								if(url.startsWith('//')){
									url = 'https:' + url;
								}
								var downResult = await self.Microi.Download(url);
								if (self.Microi.CheckResult(downResult)) {
									self.VideoUrl = downResult.Data.tempFilePath;
									//上传视频
									var uploadResult = await self.Microi.Upload({
										Path: '/file',
										File: downResult.Data.tempFilePath,
										Limit: 'true',
									});
									if (self.Microi.CheckResult(uploadResult)) {
										self.Microi.Tips('上传视频成功！', true);
										self.ContentModel.WenjianDZ = [uploadResult.Data];
									}
								}
							}
							for (var i = 0; i < result.Data.Cover.length; i++) {
								var url = result.Data.Cover[i];
								if(url.startsWith('//')){
									url = 'https:' + url;
								}
								var downResult = await self.Microi.Download(url);
								if (self.Microi.CheckResult(downResult)) {
									//上传封面
									var uploadResult = await self.Microi.Upload({
										Path: '/img',
										File: downResult.Data.tempFilePath,
										Limit: false,
										Preview: false,
									});
									if (self.Microi.CheckResult(uploadResult)) {
										self.Microi.Tips('上传封面成功！', true);
										self.ContentModel.YulanT = uploadResult.Data.Path;
									}
								}
							}
						}
						
						//CheckUrl
						self.BtnLoading = true;
						try{
							const pattern = /((http|https):\/\/[^\s]+)/g;
							const links = self.ContentModel.Xiangqing.match(pattern) || [];
							if (links.length == 0) {
								self.Spidering = false;
								self.BtnLoading = false;
								self.Microi.Tips('未发现链接！', false);
								return;
							}
							var url = links[0];
							var get_content_isspiderResult = await self.Microi.ApiEngine.Run('get_content_isspider', {
								Url: url,
								Biaoti: self.ContentModel.Biaoti,
								CaijiLYZZ: self.ContentModel.CaijiLYZZ
							});
							if (self.Microi.CheckResult(get_content_isspiderResult)) {
								if(!self.ContentModel.Biaoti){
									self.Microi.Tips(`该url[${url}]已采集过[${get_content_isspiderResult.DataCount}]次`);
								}else{
									var biaoti = self.ContentModel.Biaoti.toString();
									if(biaoti.length > 20){
										biaoti = biaoti.substring(0, 20) + '...';
									}
									var checkResultText = `该url【${url}】已采集过【${get_content_isspiderResult.DataCount}】次。<br>该作者【${self.ContentModel.CaijiLYZZ}】、标题【${biaoti}】已采集过【${get_content_isspiderResult.DataAppend.BiaotiDataCount}】次。`;
									//self.Microi.Tips(checkResultText);
									self.CheckResultText = checkResultText;
									self.CheckResultData = [];
									self.ShowCheck = true;
									if(get_content_isspiderResult.DataAppend.BiaotiData && get_content_isspiderResult.DataAppend.BiaotiData.length > 0){
										self.CheckResultData = get_content_isspiderResult.DataAppend.BiaotiData;
									}
								}
							}
							self.BtnLoading = false;
						}catch(e){
							self.Microi.Tips(e.message, false);
							self.BtnLoading = false;
						}
					}
					self.Spidering = false;
					self.BtnLoading = false;
				}catch(e){
					self.BtnLoading = false;
					self.Spidering = false;
				}
			},
			FenleiChange(key) {
				this.ContentModel.Fenlei = key;
			},
			NeirongFLChange(key) {
				var self = this;
				self.ContentModel.NeirongFL = key;
				if(self.ContentModel.NeirongFL == 'xinggan'){
					self.ContentModel.WeixinXCXBKJ = true;
					self.ContentModel.WeidengLBKJ = true;
					self.ContentModel.FeishouJHHYBKJ = true;
				}else{
					self.ContentModel.WeixinXCXBKJ = false;
					self.ContentModel.WeidengLBKJ = false;
					self.ContentModel.FeishouJHHYBKJ = false;
				}
			},
			// 处理标签点击事件
			handleTagsClick(index) {
				this.tags[index].select = !this.tags[index].select
			},
			// 跳转
			tn(e) {
				uni.navigateTo({
					url: e,
				});
			},
			// 手动上传文件
			upload() {
				this.$refs.imageUpload.upload()
			},
			// 手动清空列表
			clear() {
				try{
					this.$refs.imageUpload.clear()
				}catch(e){
					//TODO handle the exception
				}
			},
			// 图片拖拽重新排序
			onSortList(list) {
				console.log(list);
			},
		}
	}
</script>

<style lang="scss" scoped>
	.tn-slider__custom-block {
	    background-color: $tn-color-orange;
	    width: auto;
	    height: 40rpx;
	    line-height: 40rpx;
	    padding: 0rpx 20rpx;
	    border-radius: 50%;
	    text-align: center;
	    color: #FFFFFF;
	  }
	.template-edit {}

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

	/* 底部悬浮按钮 start*/
	.tn-tabbar-height {
		min-height: 180rpx;
		height: calc(220rpx + env(safe-area-inset-bottom) / 2);
		height: calc(220rpx + constant(safe-area-inset-bottom));
		background-color: #FFFFFF;
	}

	.tn-footerfixed {
		position: fixed;
		width: 100%;
		// bottom: calc(30rpx + env(safe-area-inset-bottom));
		bottom: 0;
		padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
		z-index: 1024;
		box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0);
		background-color: #FFFFFF;
	}

	/* 底部悬浮按钮 end*/

	/* 标签内容 start*/
	.tn-tag-content {
		&__item {
			display: inline-block;
			line-height: 45rpx;
			padding: 10rpx 30rpx;
			margin: 20rpx 20rpx 5rpx 0rpx;

			&--prefix {
				padding-right: 10rpx;
			}
		}
	}

	/* 标签内容 end*/
</style>