<template>
	<view class="flowsheet-page">
		<view class="flowsheet-item tn-pb-lg" v-for="(item, index) in CurrentWFHistoryList" :key="index">
			<view class="flowsheet-item-line"></view>
			<view class="flowsheet-item-img">
				<TnAvatar icon="my-lack-fill" />
			</view>
			<view class="tn-ml-xl tn-pl-sm">
				<view class="tn-text-lg">
					{{item.Sender}}
					<TnTag shape="round" class="tn-mr-sm" v-if="getApprovalType(item.ApprovalType)">{{getApprovalType(item.ApprovalType)}}</TnTag>
					<TnTag shape="round">{{item.FromNodeName}}</TnTag>
				</view>
				<view class="tn-text-sm tn-mt-sm">
					{{item.ApprovalIdea}}
				</view>
				<view class="tn-text-sm tn-gray_text tn-mt-sm">
					{{item.CreateTime}}
				</view>
			</view>
		</view>
	</view>
</template>

<script lang="ts" setup>
	import TnTag from '@tuniao/tnui-vue3-uniapp/components/tag/src/tag.vue'
	import TnAvatar from '@tuniao/tnui-vue3-uniapp/components/avatar/src/avatar.vue'
	import { definePropType } from '@tuniao/tnui-vue3-uniapp/utils'
	defineProps({
		CurrentWFHistoryList: {
			type: definePropType<any[]>(Array),
			default: () => [],
		},
	})
	const getApprovalType = (type: string) => {
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
</script>

<style lang="scss" scoped>
	.flowsheet-page{
		.flowsheet-item{
			position: relative;
			&-line{
				position: absolute;
				left: 4px;
				height: 100%;
				border-left: 2px solid #dfe4ed;
			}
			&-img{
				position: absolute;
				top: -9px;
				left: -12px;
			}
		}
		.flowsheet-item:last-child{
			.flowsheet-item-line{
				border: none;
			}
		}
		
	}
</style>