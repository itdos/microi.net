<template>
	<CustomPage title="详情" :is-h5-demo-page="isDemoH5Page">
		<view class="job-page">
			<view class="detail_header tn-shadow tn-mb">
				<view class="tn-text-lg tn-mb-sm">{{CurrentWork.FlowTitle}}</view>
				<view class="tn-gray_text">{{CurrentWork.CreateTime}}</view>
			</view>
			<view class="tn-mb" v-if="list.length > 0">
				<cardDetailControl :list="list" :TableRowId="CurrentWork.TableRowId"/>
			</view>
			<view class="detail_header tn-shadow">
				<view class="tn-text-lg tn-mb-lg">流转记录</view>
				<flowsheet :CurrentWFHistoryList="CurrentWFHistoryList" />
			</view>
		</view>

		<view class="footer_btn tn-shadow tn-p tn-flex-stretch-around" v-if="jobObj.WorkType == 'Todo'">
			<TnButton width="50%" height="80" font-size="40" @click="clickAgree('Agree')">同意</TnButton>
			<TnButton width="40%" height="80" font-size="40" type="danger" size="xl" @click="clickAgree('Disagree')">拒绝</TnButton>
		</view>
		<TnPopup v-model="showNormalPopup" open-direction="bottom">
			<view class="tn-p">
				<TnInput
					class="tn-mb-sm"
					v-model="Comment"
          type="textarea"
          placeholder="请输入意见/评论"
          height="250"
          clearable
        />
				<TnInput v-if="CurrentApprovalType == 'Disagree'" type="select" v-model="ReturnNode" placeholder="请选择退回节点" right-icon="down-triangle" clearable @click="select = true" />
			</view>
			<view class="tn-p">
				<TnButton width="100%" height="80" @click="clickSendWork" :loading="BtnLoading">
					确认{{CurrentApprovalType == 'Agree' ? '同意' : '拒绝'}}
				</TnButton>
			</view>
		</TnPopup>
		<TnPicker label-key="NodeName" value-key="Id" v-model:open="select" :data="selectData"
			@confirm="confirmValue" />
	</CustomPage>
</template>

<script lang="ts" setup>
	import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import cardDetailControl from '@/components/cardDetail-control/index.vue'
	import flowsheet from '@/components/flowsheet/flowsheet.vue'
	import { useDemoH5Page } from '@/hooks'	
	import { onLoad } from '@dcloudio/uni-app';
	import microiRequest from '@/config/api';
	import { ref, reactive, inject } from 'vue'
	import { GetDiyFormField, GetDiyList } from '@/utils'
	import TnPopup from '@tuniao/tnui-vue3-uniapp/components/popup/src/popup.vue'
	import TnInput from '@tuniao/tnui-vue3-uniapp/components/input/src/input.vue'
	import TnPicker from '@tuniao/tnui-vue3-uniapp/components/picker/src/picker.vue'
	const { isDemoH5Page } = useDemoH5Page()
	const Microi: any = inject('Microi'); // 使用注入Microi实例
	// 接收传值
	const jobObj = reactive({
		Id: '',
		WorkType: ''
	})
	let CurrentWork = ref<any>({})
	let CurrentWFHistoryList = ref<any>([])
	const GetDiyFieldList = ref<any>([]) // 字段名list
	const GetDiyTableList = ref<any>([]) // 数据list
	const list = ref<any>([])
	const CurrentApprovalType = ref<string>('') // 审批类型
	const showNormalPopup = ref(false) // 弹窗
	const Comment = ref<string>('') // 评论内容
	const ReturnNode = ref<string>('') // 退回节点
	const BackNodeId = ref<string>('') // 退回节点Id
	const selectData = ref<any>([]) // 选择节点数据
	const select = ref(false) // 打开节点弹窗
	const BtnLoading = ref(false)
	onLoad((options: any) => {
		jobObj.Id = options.Id
		jobObj.WorkType = options.WorkType
		getData()
	});
	const getData = async () => {
		try {
			uni.showLoading({
				title: "加载中",
				mask: true
			});
			const obj = {
				TableName: jobObj.WorkType == "Todo" ? "wf_work" : "wf_flow",
				Id: jobObj.Id
			}
			const res = await microiRequest.GetFormData(obj);
			if (res.Code == 1) {
				CurrentWork.value = res.Data
				GetWFHistoryData()
				GetFormData()
				if (CurrentWork.value.NodeId) {
					GetReturnNode()
				}
			}
			uni.hideLoading();
		} catch (error) {
			console.error(error);
		}
	}
	// 获取流程内容
	const GetFormData = async () => {
		try {
			const objForm = {
				FormEngineKey: CurrentWork.value.TableId,
				Id: CurrentWork.value.TableRowId
			}
			const resData = await microiRequest.GetFormData(objForm);
			if (resData.Code == 1) {
				GetDiyTableList.value = resData.Data
			}
			const obj: any = {
				TableId: CurrentWork.value.TableId,
			}
			GetDiyFieldList.value = await GetDiyFormField(obj);
			list.value = await GetDiyList(GetDiyFieldList.value, GetDiyTableList.value,CurrentWork.value.TableRowId)
		} catch (error) {
			console.error(error);
		}
	}
	// 获取流程记录
	const GetWFHistoryData = async () => {
		try {
			const obj = {
				FlowId: CurrentWork.value.FlowId,
			}
			const res = await microiRequest.GetWFHistory(obj);
			if (res.Code == 1) {
				CurrentWFHistoryList.value = res.Data
			}
		} catch (error) {
			console.error(error);
		}
	}
	// 点击同意拒绝
	const clickAgree = async (type: string) => {
		CurrentApprovalType.value = type
		showNormalPopup.value = true
	}
	// 获取退回节点数据
	const GetReturnNode = async () => {
		try {
			const obj = {
				NodeId: CurrentWork.value.NodeId,
			}
			const res = await microiRequest.GetReturnNode(obj);
			if (res.Code == 1) {
				if (res.Data.BackNodes) {
					selectData.value = JSON.parse(res.Data.BackNodes)
				}
			}
		} catch (error) {
			console.error(error);
		}
	}
	// 选择节点值
	const confirmValue = async (value: any) => {
		ReturnNode.value = selectData.value.filter((item: any) => item.Id == value)[0].NodeName
		BackNodeId.value = value
	}
	// 点击提交处理流程
	const clickSendWork = async () => {
		BtnLoading.value = true
		const res = await microiRequest.SendWork({
			WorkId: CurrentWork.value.Id,
			FlowId: CurrentWork.value.FlowId,
			FormData: JSON.stringify(GetDiyTableList.value), // 表单数据
			ApprovalType: CurrentApprovalType.value, // 审批类型
			ApprovalIdea: Comment.value, // 审批意见
			NoticeFields: [],
			BackNodeId: BackNodeId.value // 节点id
		})
		console.log(res,'提交')
		if (res.Code == 1) {
			uni.showToast({
				title: '提交成功',
				icon: 'none'
			})
			showNormalPopup.value = false
			BtnLoading.value = false;
			const objForm = {
				TableName: 'diy_table',
				Id: CurrentWork.value.TableId
			}
			const tableData = await microiRequest.GetFormData(objForm);
			// var params1 = {
			// 	Id: CurrentWork.value.TableRowId,
			// 	TableName: tableData.Data.Name,
			// 	ApprovalType: CurrentApprovalType.value
			// }
			// var res1 = await Microi.ApiEngine.Run('ShenpiZT_mobile',params1);
			uni.navigateBack({
				delta: 1
			})
		} else {
			uni.showToast({
				title: res.Msg,
				icon: 'none'
			})
			BtnLoading.value = false;
		}
	}
</script>

<style lang="scss" scoped>
	.job-page{
		padding-bottom: 100rpx;
		.detail_header{
			padding: 20px;
			border-radius: 20rpx;
			background: white;
		}
	}
	.footer_btn{
			position: fixed;
			bottom: 0;
			left: 0;
			background: white;
			width: 100%;
		}
</style>