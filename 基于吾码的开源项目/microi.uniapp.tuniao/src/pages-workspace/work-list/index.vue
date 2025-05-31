<template>
	<CustomPage :title="title" :is-h5-demo-page="isDemoH5Page">
		<view class="work-page">
			<scroll-view style="height:90%;" lower-threshold="50" scroll-y class="item-list" @scrolltolower="handleScroll">
				<view class="work-item tn-shadow tn-mb tn-p" v-for="(item,index) in CurrentWork.workList" :key="index" @click.stop="goDetail(item)">
					<TnReadMore>
						<view v-for="(val,key) in item.obj" :key="key" class="tn-mb-sm">
							<text class="tn-mr-xs">{{val.Label}}: </text><text>{{val.Value}}</text>
						</view>
						<view class="tn-text-sm tn-mb-xs tn-mt tn-gray_text">
							<TnIcon name="time-fill" class="tn-mr-xs" />
							创建时间：{{item.CreateTime || ''}}
						</view>
						<view class="tn-text-sm tn-gray_text tn-mb-xs">
							<TnIcon name="my-job-fill" class="tn-mr-xs" />
							创建人：{{item.UserName||''}}
						</view>
						<view class="tn-text-sm tn-gray_text">
							<TnIcon name="time-fill" class="tn-mr-xs" />
							修改时间：{{item.UpdateTime||''}}
						</view>
					</TnReadMore>
          <view class="tn-flex-row tn-mt-sm tn-flex-stretch-end">
						<view class="tn-mr-sm" @click.stop="goEdit(item)">
							<TnButton plain type="warning" size="sm">
								<TnIcon name="edit-form"  size="45rpx" type="warning" />
								<text class="tn-orangeyellow_text">编辑</text>
							</TnButton>
						</view>
						<view class="" @click.stop="goDelete(item)">
							<TnButton plain  type="danger" class="tn-red_border tn-red_text" size="sm">
								<TnIcon name="delete-fill"  size="45rpx" type="danger" />
								<text class="tn-red_text">删除</text>
							</TnButton>
						</view>
          </view>
				</view>
				<TnLoadmore v-if="CurrentWork.workList.length > 0" :status="loadmoreStatus" color="tn-gray" />
				<TnEmpty v-else mode="data" size="xl" color="tn-gray-disabled" />
			</scroll-view>
			<view class="work-list-add" @click="goAdd">
				<TnIcon name="add-fill" size="120" color="tn-blue" />
			</view>
		</view>
	</CustomPage>
</template>

<script lang="ts" setup>
	import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import TnLoadmore from '@tuniao/tnui-vue3-uniapp/components/loadmore/src/loadmore.vue'
	import TnEmpty from '@tuniao/tnui-vue3-uniapp/components/empty/src/empty.vue'
	import { useDemoH5Page } from '@/hooks'	
	import { onLoad, onShow } from '@dcloudio/uni-app';
	import microiRequest from '@/config/api';
	import { ref, reactive } from 'vue'
	import type { LoadmoreStatus } from '@tuniao/tnui-vue3-uniapp';
	import { GetDiyFormField, GoDelete } from '@/utils'
	// import { useForm } from '@/stores';
	import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
	import TnReadMore from '@tuniao/tnui-vue3-uniapp/components/read-more/src/read-more.vue'
	// const userStore = useForm()
	const { isDemoH5Page } = useDemoH5Page()
	const loadmoreStatus = ref<LoadmoreStatus>('loadmore') // 加载更多
	// 接收传值
	const DiyTableId = ref<string>('')
	const title = ref<string>('列表')
	const SysMenuId = ref<string>()
	let CurrentWork = reactive<any>({
		workList: [], // 列表
		pageSize: 10, // 每页几条
		pageIndex: 1,// 页数
		pageCount: 0 // 总页数
	})
	const GetDiyFieldList = ref<any>([]) // 表字段
	const GetDiyTableRowList = ref<any>([]) // 表字段值
	const SelectFields = ref<any>([]) // 查询列
	const NotShowFields = ref<any>([]) // 不显示列
	onLoad((options: any) => {
		DiyTableId.value = options.DiyTableId
		title.value = options.Description
		SysMenuId.value = options.Id
	});
	onShow(() => {
		getData()
		// userStore.setUseFormInfo('null')
		GetDiyFieldList.value = []
		uni.setStorageSync('useFormInfo', [])
	})
	const getData = async () => {
		try {
			uni.showLoading({
				title: "加载中",
				mask: true
			});
			const obj: any = {
				FormEngineKey: 'Sys_Menu',
				Id: SysMenuId.value
			}
			const res = await microiRequest.GetFormData(obj); // 获取表需要显示的字段
			if (res.Code == 1) {
				SelectFields.value = JSON.parse(res.Data.SelectFields)
				NotShowFields.value = JSON.parse(res.Data.NotShowFields)
				// 如果不显示列有数据就过滤
				NotShowFields.value?.forEach((item: any) => {
					SelectFields.value = SelectFields.value.filter((val: any) => val.Id != item)
				})
			}
			uni.hideLoading();
			const objDiy: any = {
				TableId: DiyTableId.value
			}
			const list: any = await GetDiyFormField(objDiy);
			// 如果查询列有数据就显示查询列的，如果不显示列有数据就过滤,否则就显示全部
			if (SelectFields.value?.length > 0) {
				SelectFields.value.forEach((item: any) => {
					const arr = list.find((val: any) => val.Id == item.Id)
					GetDiyFieldList.value.push(arr)
				})
			} else if (NotShowFields.value?.length > 0) { 
				GetDiyFieldList.value = list.filter((val: {Id: string})=>!NotShowFields.value.includes(val.Id));
			} else {
				GetDiyFieldList.value = list
			}
			GetDiyTableRowData()
		} catch (error) {
			console.error(error);
		}
	}
	// 获取列表
	const GetDiyTableRowData = async () => {
		try {
			const obj = {
				TableId: DiyTableId.value,
				_PageIndex: CurrentWork.pageIndex,
				_PageSize: CurrentWork.pageSize,
				_SysMenuId: SysMenuId.value
			}
			const res = await microiRequest.GetDiyTableRow(obj);
			if (res.Code == 1) {
				CurrentWork.pageCount = Math.ceil(res.DataCount/Number(CurrentWork.pageSize))
				if (CurrentWork.pageIndex == 1) {
					GetDiyTableRowList.value = res.Data
				} else {
					GetDiyTableRowList.value = GetDiyTableRowList.value.concat(res.Data)
				}
				getList()
				if (CurrentWork.pageCount == CurrentWork.pageIndex) {
					loadmoreStatus.value = "nomore"
					return
				} 
			}
		} catch (error) {
			console.error(error);
		}
	}
	const getList = () => {
		let arr: any = []
		GetDiyTableRowList.value.forEach((item: any) => {
			let obj: any = []
			for (var key in item) {
				GetDiyFieldList.value.forEach((row: { Visible: number; Name: string; Label: string }, index: number) => {
					if (row?.Visible == 1) {
						if (key == row.Name) {
							obj.push({
								Label: row.Label,
								Value: item[key]
							})
						}
					}
				})
			}
			arr.push({
				...item,
				obj
			})
		})
		CurrentWork.workList = arr
		console.log(CurrentWork.workList,222)
	}
	// 滚动啦
	const handleScroll = () => {
		// 总页数与当前页数相等
		if (CurrentWork.pageCount == CurrentWork.pageIndex) {
			loadmoreStatus.value = "nomore"
			return
		} else {
			loadmoreStatus.value = "loading"
		}
		CurrentWork.pageIndex++
		GetDiyTableRowData()
	}
	// 去新增了啊
	const goAdd = ()=> {
		uni.navigateTo({
		  url: `/pages-workspace/work-add/index?DiyTableId=${DiyTableId.value}&Description=${title.value}新增`,
		});
	}
	// 去查看详情了
	const goDetail = (item: {Id:string}) => {
		console.log(item,'详情')
		uni.navigateTo({
		  url: `/pages-workspace/work-detail/index?DiyTableId=${DiyTableId.value}&Description=${title.value}&DiyTableRowId=${item.Id}`,
		});
	}
	// 去编辑了啊
	const goEdit = (item: {Id:string})=> {
		uni.navigateTo({
		  url: `/pages-workspace/work-add/index?DiyTableId=${DiyTableId.value}&Description=${title.value}编辑&TableRowId=${item.Id}`,
		});
	}
	// 去删除了呀
	const goDelete = async (item: {	obj: any;Id:string })=> {
		await GoDelete(DiyTableId.value, item.Id, item.obj[0].Value)
		getData()
	}
</script>

<style lang="scss" scoped>
	.work-page{
		height: 90vh;
		position: relative;
		.work-item{
			border-radius: 20rpx;
		}
		.work-list-add{
			position: absolute;
			bottom: 90rpx;
			right: 20rpx;
			background: white;
			border-radius: 50%;
		}
		.work-edit{
			width: 100%;
			justify-content: end;
		}
	}
</style>