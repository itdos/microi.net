<template>
	<view class="flowsheet-page" v-if="wkHistoryData.length > 0">
		<view class="flowsheet-item" v-for="(item, index) in wkHistoryData" :key="index">
			<view class="flowsheet-item-line"></view>
			<view class="flowsheet-item-img">
				<img :src="item.ApprovalType == 'Auto' ? '/static/image/icon-faqi.png' : '/static/image/icon-shenp.png'" style="object-fit: cover;">
			</view>
			<view class="uni-common-pb">
				<view class="w26 flex items-center" :class="{'text-[#3875C6]' : item.ApprovalType == 'Auto'}">
					<view class="w-8 h-8">
						<img class="sendTX" :src="getAvatar(item)">
					</view>
					<text class="mx-2" style="margin-left: 15rpx;">{{item.Sender}}</text>
					<uni-tag  style="margin-left: 15rpx;" 
          v-if="getApprovalType(item.ApprovalType)" :text="getApprovalType(item.ApprovalType)" size="small"
          :custom-style="item.ApprovalType == 'Agree' ? primaryTagsString(successTag) : item.ApprovalType == 'Disagree' ? primaryTagsString(errorTag) : primaryTagsString(primaryTags)" ></uni-tag>
					<uni-tag :text="item.FromNodeName" size="small" :custom-style="primaryTagsString(primaryTags)" style="margin-left: 15rpx;"></uni-tag>
				</view>
				<view class="w26 uni-common-mt" v-if="item.ApprovalIdea" style="margin-left: 15rpx;"> style="margin-left: 15rpx;"
					{{item.ApprovalIdea}}
				</view>
        <view v-if="item.Receivers && item.Receivers != '[]'">
          <!-- <r-divider content-position="left"
              :customStyle="{
                color: '#1989fa',
                borderColor: '#ccc',
                fontSize: '14px',
              }">接收人</r-divider> -->
					<view class="flex items-center" style="padding:10rpx 0 5rpx;">
						<uni-icons type="auth-filled" size="22" color="#999999" /> 
						<text class="text-xs ml-2" style="color: #999;font-weight: 400;font-size: 22rpx;">接收人</text>
					</view>
				
          <view class="flex items-center gap-1">
            <view v-for="(receiver, index) in JSON.parse(item.Receivers)" :key="index" class="bg-gray-100 px-2 py-1 rounded flex items-center">
              <!-- <uni-tag :text="receiver.Name" size="small" type="error" inverted circle></uni-tag> -->
							 <view class="w-8 h-8">
								<img class="sendTX" :src="getAvatar(receiver)">
							 </view>
							<text class=" text-xs ml-1" style="color:#444;font-size: 24rpx;">{{ receiver.Name }}</text>
            </view>
          </view>
        </view>
        <view v-if="item.CopyUsers && item.CopyUsers != '[]'">
          <!-- <r-divider content-position="left"
                :customStyle="{
                  color: '#1989fa',
                  borderColor: '#ccc',
                  fontSize: '14px',
                }">抄送人</r-divider> -->
					<view class="flex items-center">
						<uni-icons type="paperplane-filled" size="22" color="#999999" /> 
						<text class="text-[#999999] text-xs ml-2">抄送人</text>
					</view>
          <!-- <view class="uni-flex uni-flex-wrap">
            <view v-for="(receiver, index) in JSON.parse(item.CopyUsers)" :key="index" class="uni-common-mr-xs uni-common-mt-xs">
              <uni-tag :text="receiver.Name" size="small" type="error" inverted circle></uni-tag>
            </view>
          </view> -->
					<view class="flex items-center gap-1">
            <view v-for="(receiver, index) in JSON.parse(item.CopyUsers)" :key="index" class="bg-gray-100 px-2 py-1 rounded flex items-center">
              <!-- <uni-tag :text="receiver.Name" size="small" type="error" inverted circle></uni-tag> -->
							 <view class="w-8 h-8">
								<img class="sendTX" :src="getAvatar(receiver)">
							 </view>
							<text class="text-[#333333] text-xs ml-2 ">{{ receiver.Name }}</text>
            </view>
          </view>
        </view>
				<view class="w26 gray uni-common-mt">
					{{item.CreateTime}}
				</view>
			</view>
		</view>
	</view>
</template>
<script setup>
import { GetServerPath } from '@/utils'
	const props = defineProps({
		wkHistoryData: {
			type: Array,
			default: () => [],
		},
		UserPublicInfo: {
			type: Array,
			default: () => [],
		},
	})
	const primaryTags = {
		background: '#DAE5FF',
		color: '#4179F7',
		borderColor: '#DAE5FF',
		fontWeight: 500,
		fontSize: '13px'
	}
	const successTag = {
		background: '#BAE6BB',
		color: '#1EA523',
		borderColor: '#BAE6BB',
		fontWeight: 500,
		fontSize: '13px'
	}
	const errorTag = {
		background: '#FAD2D2',
		color: '#E95858',
		borderColor: '#FAD2D2',
		fontWeight: 500,
		fontSize: '13px'
	}
const primaryTagsString = (tags) =>  {
  return Object.entries(tags)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}
  const getApprovalType = (type) => {
		let txt = "";
		switch (type) {
			case 'Agree':
				txt = "同意";
				break;
			case 'Disagree':
				txt = "不同意";
				break;
			case 'Auto':
				txt = "";
				break;
			case 'Recall':
				txt = "撤回";
				break;
			case 'HandOver':
				txt = "移交";
				break;
		}
		return txt;
	}
	const getAvatar = (item) => {
		const row = props.UserPublicInfo.find(i => i.Id === item.UserId || i.Id === item.Id);
		if (row && row.Avatar) {
			return GetServerPath(row.Avatar)
		} else {
			return '/static/img/mrtx.png'
		}
	}
</script>
<style lang="scss" scoped>
	.flowsheet-page{
		margin-bottom: 20rpx;
		background: #fff;
		border-radius: 10rpx;
		box-shadow: 0px 20px 60px rgba(102, 127, 191, 0.25);
		padding: 30rpx  20rpx 20rpx 35rpx;
		.flowsheet-item{
			position: relative;
			padding-left: 30px;
			&-line{
				position: absolute;
				top: 30px;
				left: 6px;
				height: calc(100% - 70rpx);
				border-left: 2rpx solid #CCCCCC;
			}
			&-img{
				position: absolute;
				top: 0;
				left: -5px;
				width: 24px;
				height: 24px;
			}
		}
		.flowsheet-item:last-child{
			.flowsheet-item-line{
				border: none;
			}
		}
	}
	img { width: 100%;height:100%;}
	.sendTX {
		  width: 40rpx;height: 40rpx
	}
</style>