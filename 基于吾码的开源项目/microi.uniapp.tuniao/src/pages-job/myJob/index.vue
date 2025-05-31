<template>
	<CustomPage title="我的工作" :is-h5-demo-page="isDemoH5Page"  page-bg-color="#f8f7f8">
		<view class="mdept-list">
			<view class="subsection-item tn-mb">
			  <TnSubsection v-model="currentSubsectionIndex" mode="button" size="lg">
					<TnSubsectionItem v-for="item in TabList"  :key="item.WorkType" :title="item.name" @tap="clickTab(item)"/>
			  </TnSubsection>
			</view>
			<view class="item-list">
				<scroll-view style="height:100%;" scroll-y @scrolltolower="handleScroll">
					<view class="card-item tn-shadow" v-for="(item,index) in currnData[WorkType].jobList" :key="index" @click="goDetail(item)">
						<view class="card_hd">
							<view class="card_title_wrapper" >
								<view class="card_title">
									{{item.FlowTitle||''}}
								</view>
								<view class="card_status">
									<TnTag shape="round" type="warning">{{GetFlowState(item.FlowState)}}</TnTag>
								</view>
							</view>
						</view>
						<view class="card_bd">
							<view class="card_bd_item card_bd_flex">
								<text>内容：</text>
								<!-- <text>{{GetNoticeFields(item.NoticeFields)}}</text> -->
								<view class="card_bd_flex">
									<TnTag v-for="itemNotice in GetNoticeFields(item.NoticeFields)" :key="itemNotice.Label"
									 shape="round" class="tn-mr-sm">{{itemNotice.Label}}_{{itemNotice.Value}}</TnTag>
								</view>
							</view>
							<view v-if="WorkType == 'Todo'" class="card_bd_item">
								<text>发送人：</text>
								<text>{{item.Sender||''}}</text>
							</view>
							<view v-if="WorkType != 'Sender'" class="card_bd_item">
								<text>节点名称：</text>
								<text >{{GetNodeName(item)}}</text>
							</view>
							<view class="card_bd_item">
								<text>发起人：</text>
								<text>{{item.FirstSender || item.Sender}}</text>
							</view>
							<view class="card_bd_item">
								<text>提交时间：</text>
								<text>{{item.CreateTime||''}}</text>
							</view>
						</view>
					</view>
					<TnLoadmore v-if="currnData[WorkType].jobList.length > 0" :status="loadmoreStatus" />
					<TnEmpty v-else mode="data" size="xl" color="tn-gray-disabled" />
				</scroll-view>
			</view>
		</view>
	</CustomPage>
</template>

<script lang="ts" setup>
	import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import microiRequest from '@/config/api';
	import { ref, reactive } from 'vue'
	import { type LoadmoreStatus } from '@tuniao/tnui-vue3-uniapp';
	import { useDemoH5Page } from '@/hooks'
	import TnSubsection from '@tuniao/tnui-vue3-uniapp/components/subsection/src/subsection.vue'
	import TnSubsectionItem from '@tuniao/tnui-vue3-uniapp/components/subsection/src/subsection-item.vue'
	import TnTag from '@tuniao/tnui-vue3-uniapp/components/tag/src/tag.vue'
	import TnEmpty from '@tuniao/tnui-vue3-uniapp/components/empty/src/empty.vue'
	import TnLoadmore from '@tuniao/tnui-vue3-uniapp/components/loadmore/src/loadmore.vue'
	import { onLoad } from '@dcloudio/uni-app';
	// import { useUser } from '@/stores';
	// const userStore = useUser()
	const { isDemoH5Page } = useDemoH5Page()
	const loadmoreStatus = ref<LoadmoreStatus>('loadmore') // 加载更多
	const TabList = reactive([
		{name: '我的待办', WorkType: 'Todo'},
		{name: '我处理的', WorkType: 'Done'},
		{name: '我发起的', WorkType: 'Sender'},
		{name: '抄送我的', WorkType: 'Copy'}
	])
	const currnData = reactive<any>({
		'Todo': {
			jobList: [], // 列表
			pageSize: 10, // 每页几条
			pageIndex: 1,// 页数
			pageCount: 0 // 总页数
		},
		'Sender': {
			jobList: [], // 列表
			pageSize: 10, // 每页几条
			pageIndex: 1,// 页数
			pageCount: 0 // 总页数
		},
		'Done': {
			jobList: [], // 列表
			pageSize: 10, // 每页几条
			pageIndex: 1,// 页数
			pageCount: 0 // 总页数
		},
		'Copy': {
			jobList: [], // 列表
			pageSize: 10, // 每页几条
			pageIndex: 1,// 页数
			pageCount: 0 // 总页数
		}
	})
	const currentSubsectionIndex = ref<number>(0)
	const WorkType = ref<string>('Todo')
	// 获取部门列表数据
	const getData = async () => {
		const list = currnData[WorkType.value]
		try {
			uni.showLoading({
				title: "加载中",
				mask: true
			});
			const obj = {
				WorkType: WorkType.value,
				_PageSize: list.pageSize,
				_PageIndex: list.pageIndex,
				_Keyword: ''
			}
			let res = ref<any>({})
			if (WorkType.value == 'Todo') {
				res = await microiRequest.GetWFWork(obj);
			} else {
				res = await microiRequest.GetWFFlow(obj);
			}
			if (res.Code == 1) {
				list.pageCount = Math.ceil(res.DataCount/Number(list.pageSize))
				if (list.pageIndex == 1) {
					list.jobList = res.Data
				} else {
					list.jobList = list.jobList.concat(res.Data)
				}
			}
			uni.hideLoading();
		} catch (error) {
			console.error(error);
		}
	}
	// getData()
	onLoad((options: any) => {
		console.log(options)
		currentSubsectionIndex.value = Number(options.index)
		WorkType.value = TabList[currentSubsectionIndex.value].WorkType
		getData()
  })
	// 滚动啦
	const handleScroll = () => {
		const list = currnData[WorkType.value]
		// 总页数与当前页数相等
		if (list.pageCount == list.pageIndex) {
			loadmoreStatus.value = "nomore"
			return
		} else {
			loadmoreStatus.value = "loading"
		}
		list.pageIndex++
		getData()
	}
	// 点击tab
	const clickTab = (e: {WorkType: string}) => {
		WorkType.value = e.WorkType
		getData()
	}
	const GetFlowState = (flowState: string) => {
		let txt = "";
		switch (flowState) {
			case 'Running':
				txt = "运行中";
				break;
			case 'End':
				txt = "已结束";
		}
		return txt;
	}
	const GetNoticeFields = (NoticeFields: string) => {
		if (!NoticeFields) return
		const arr = JSON.parse(NoticeFields)
		return arr
	}
	const GetNodeName = (model: { HandlerUsers: string; CopyUsers: string; NotHandlerUsers: string; NodeName: any; }) => {
		let users = []
		let txt = "";
		if(WorkType.value == "Done"){
			users = JSON.parse(model.HandlerUsers);
		}else if(WorkType.value == "Copy"){
			users = JSON.parse(model.CopyUsers);
		}else if(WorkType.value == "Connect"){
			users = JSON.parse(model.NotHandlerUsers);
		}else{
			return model.NodeName
		}
		if(users && users.length > 0){
			users.forEach((element: { NodeName: string; }) => {
				txt += element.NodeName
			});
		}
		return txt;
	}
	const goDetail = (item: {Id: string}) => {
		// 源页面
		uni.navigateTo({
		  url: `/pages-job/myJob/job-detail?Id=${item.Id}&WorkType=${WorkType.value}`,
		});
	}
</script>

<style lang="scss" scoped>
	.mdept-list{
		height: 85vh;
		.item-list{
			height: 100%;
			padding-bottom: 50px;
		}
		.card-item {
			background: #fff;
			border-radius: 11rpx;
			margin-bottom: 40rpx;
			padding: 20rpx;
			
			.card_hd {
				.card_title_wrapper {
					display: flex;
					justify-content: space-between;
					align-items: center;
					position: relative;
					height: 98rpx;
					border-bottom: 1rpx solid #E6E6E6;
			
			
					&::before {
						content: '';
						position: absolute;
						display: block;
						width: 10rpx;
						height: 30rpx;
						background: #FFBA2E;
						border-radius:
							0px 8px 8px 0px;
					}
					.card_title {
						font-size: 29rpx;
						color: #000;
						font-weight: 700;
						padding-left: 42rpx;
					}
				}
			}
			
			.card_bd {
				display: flex;
				flex-direction: column;
				justify-content: center;
				padding: 0 33rpx;
			
				.card_bd_item {
					font-size: 28rpx;
					font-weight: 500;
					padding: 7rpx 0;
				}
				.card_bd_flex{
					display: flex;
				}
			}
		}
	}
	
</style>