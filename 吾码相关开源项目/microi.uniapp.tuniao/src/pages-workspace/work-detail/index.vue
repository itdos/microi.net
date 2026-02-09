<template>
	<CustomPage :title="title" :is-h5-demo-page="isDemoH5Page">
		<view class="work-page">
			<cardDetailControl :list="list" :TableRowId="TableRowId"/>
		</view>
		<movable-area class="movableArea">
			<movable-view class="movableView tn-flex items-center justify-center tn-shadow-md" direction="all" x="600rpx" y="800rpx">
				<TnBubbleBox :options="bubbleBoxOptionsWithIcon" position="bottom" @click="onBubbleOptionClickEvent">
					操作
				</TnBubbleBox>
			</movable-view>
		</movable-area>

	</CustomPage>
</template>

<script lang="ts" setup>
	import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import TnBubbleBox from '@tuniao/tnui-vue3-uniapp/components/bubble-box/src/bubble-box.vue'
	import { ref } from 'vue'
	import { useDemoH5Page } from '@/hooks'	
	import { onLoad,onShow } from '@dcloudio/uni-app';
	import microiRequest from '@/config/api';
	import { GetDiyFormField, GetDiyList, GoDelete } from '@/utils'
	import cardDetailControl from '@/components/cardDetail-control/index.vue'
	import type { BubbleBoxOption } from '@tuniao/tnui-vue3-uniapp'
	const { isDemoH5Page } = useDemoH5Page()
	const title = ref<string>('详情') // 标题
	const DiyTableId = ref<string>('') // 主id
	const TableRowId = ref<string>('') // 点击这条的id
	const GetDiyFieldList = ref<any>([]) // 字段名list
	const GetDiyTableList = ref<any>([]) // 数据list
	const list = ref<any>([])
	const bubbleBoxOptionsWithIcon: BubbleBoxOption = [
		{ text: '编辑', icon: 'edit-form' },
		{ text: '删除', icon: 'delete-fill' },
	]
	onLoad((options : any) => {
		console.log(options,111)
		DiyTableId.value = options.DiyTableId
		title.value = options.Description != 'undefined' ? options.Description : '详情'
		TableRowId.value = options.DiyTableRowId
	});
	onShow(() => {
		getData()
	})
	// 获取数据
	const getData = async () =>{
		try {
			uni.showLoading({
				title: "加载中",
				mask: true
			});
			const objDiyField: any = {
				TableId: DiyTableId.value
			}
			GetDiyFieldList.value = await GetDiyFormField(objDiyField);
			const obj: any = {
				TableId: DiyTableId.value,
				_TableRowId: TableRowId.value
			}
			const res = await microiRequest.GetDiyTableRowModel(obj);
			if (res.Code == 1) {
				GetDiyTableList.value = res.Data
			}
			list.value = await GetDiyList(GetDiyFieldList.value, GetDiyTableList.value,TableRowId.value)
			console.log(list.value,222)
			uni.hideLoading();
		} catch (error) {
			console.error(error);
		}
	}
	// 选项点击事件
	const onBubbleOptionClickEvent = (index: number) => {
		console.log(index,bubbleBoxOptionsWithIcon[index])
		if (bubbleBoxOptionsWithIcon[index].text == '编辑') {
			goEdit()
		} else {
			goDelete()
		}
	}
	// 去编辑了啊
	const goEdit = ()=> {
		uni.navigateTo({
		  url: `/pages-workspace/work-add/index?DiyTableId=${DiyTableId.value}&Description=${title.value}编辑&TableRowId=${TableRowId.value}`,
		});
	}
	// 去删除了呀
	const goDelete = async ()=> {
		await GoDelete(DiyTableId.value, GetDiyTableList.value.Id,list.value[0]._Value)
		uni.navigateBack({
			delta: 1
		});
	}
</script>

<style lang="scss" scoped>
	.work-page{
		height: 100%;
		.word-wrap{
			word-wrap: break-word;
		}
	}

	.movableArea {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;//设置area元素不可点击，则事件便会下移至页面下层元素
	}
	.movableView {
		height: 100rpx;
		width: 100rpx;
		color: white;
		background: var(--tn-color-primary);
		border-radius: 50%;
		pointer-events: auto;//可以点击
	}

</style>