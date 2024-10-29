<template>
	<view class="table-page">
		<uni-table border stripe emptyText="暂无更多数据">
			<!-- 表头行 -->
			<uni-tr v-if="GetDiyFieldList.length > 0">
        <uni-th align="center" width="60">操作</uni-th>
        <uni-th v-if="type == 'edit'" align="center" width="60">操作</uni-th>
        <uni-th v-if="type == 'edit'" align="center" width="60">操作</uni-th>
				<uni-th v-for="(item, index) in GetDiyFieldList" :key="index" align="center" :width="item.TableWidth">{{item.Label}}</uni-th>
			</uni-tr>
			<!-- 表格数据行 -->
			<uni-tr v-for="(lsit, index) in NewChildList" :key="index">
				<uni-td align="center">
          <TnButton @click="goEdit(lsit.Id,lsit.obj[0],3)">详情</TnButton>
        </uni-td>
        <uni-td v-if="type == 'edit'" align="center">
          <TnButton @click="goEdit(lsit.Id,lsit.obj[0],1)" type="warning">编辑</TnButton>
        </uni-td>
				<uni-td v-if="type == 'edit'" align="center">
          <TnButton @click="goEdit(lsit.Id,lsit.obj[0],2)" type="danger">删除</TnButton>
        </uni-td>
				<uni-td v-for="(item, index1) in GetDiyFieldList" :key="index1" align="center" :width="item.TableWidth">
					<uni-tooltip :content="lsit[item.Name]">
						<view class="tn-text-ellipsis-1">{{lsit[item.Name]}}</view>
					</uni-tooltip>
				</uni-td>
			</uni-tr>
		</uni-table>
		<view class="uni-pagination-box" v-if="ChildList.length > 0">
			<uni-pagination show-icon :page-size="pageSize" :current="pageCurrent" :total="total" @change="change" />
		</view>
	</view>
</template>

<script lang="ts" setup>
	import { ref, reactive, watch } from 'vue'
	import { GetDiyFormField, GetTableData } from '@/utils'
	import { definePropType } from '@tuniao/tnui-vue3-uniapp/utils'
	import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
	import microiRequest from '@/config/api';
	const props = defineProps({
		ChildList: {
			type: definePropType<any[]>(Array),
			default: () => [],
		},
		TableChildTableData: {
			type: definePropType<any>(String),
		}, // 子表数据
		type: {
			type: definePropType<any>(String),
		},
		ChildListCount: {
			type: definePropType<any>(Number),
		},//总数
		TableRowId: {
			type: definePropType<any>(String),
		},
		formData: {
			type: definePropType<any>(Object),
		} // 表单数据
	})
	const GetDiyFieldList = ref<any>([]) // 表单列表
	const SelectFields = ref<any>([]) // 查询列
	const NotShowFields = ref<any>([]) // 不显示列
	const DiyConfig = ref<any>({})
	const pageCurrent = ref<number>(1) // 当前页码
	const pageSize = ref<number>(10) // 每页条数
	const total = ref<number>(props.ChildListCount) // 总条数
	const NewChildList = ref<any>(props.ChildList)
	const emits = defineEmits(['handlEdit', 'AddBtnType'])
	// 监听传递的数据变化
	watch([() => props.ChildList,() => props.ChildListCount],(newVal) => {
			NewChildList.value = newVal[0];
			total.value = newVal[1];
			getList()
		}
	);
	// 获取表单字段
	const getData = async () => {
		const TableChildTableData = JSON.parse(props.TableChildTableData)
		const TableChildTableId = TableChildTableData.TableChildTableId
		const TableChildSysMenuId = TableChildTableData.TableChildSysMenuId
		console.log(TableChildTableData,'TableChildCallbackField')
		try {
			const objMenu: any = {
				FormEngineKey: 'Sys_Menu',
				Id: TableChildSysMenuId
			}
			const res = await microiRequest.GetFormData(objMenu); // 获取表需要显示的字段
			if (res.Code == 1) {
				SelectFields.value = JSON.parse(res.Data.SelectFields)
				NotShowFields.value = JSON.parse(res.Data.NotShowFields)
				DiyConfig.value = JSON.parse(res.Data.DiyConfig)  // 新增模式
				emits('AddBtnType',DiyConfig.value.AddBtnType)
				// 如果不显示列有数据就过滤
				NotShowFields.value?.forEach((item: any) => {
					SelectFields.value = SelectFields.value.filter((val: any) => val.Id != item)
				})
			}
			const obj: any = {
				TableId: TableChildTableId
			}
			const list: any = await GetDiyFormField(obj) // 获取表单列表
			// 如果查询列有数据就显示查询列的，如果不显示列有数据就过滤,否则就显示全部
			if (SelectFields.value?.length > 0) {
				SelectFields.value.forEach((item: any) => {
					const arr = list.find((val: any) => val.Id == item.Id)
					if (arr) {
						GetDiyFieldList.value.push(arr)
					}
				})
			} else if (NotShowFields.value?.length > 0) { 
				GetDiyFieldList.value = list.filter((val: {Id: string})=>!NotShowFields.value.includes(val.Id));
			} else {
				GetDiyFieldList.value = list
			}
			getList()
		} catch (error) {
			console.error('获取表单列表', error);
		}
	}
	getData()
	const getList = () => {
		let arr: any = []
		NewChildList.value.forEach((item: any) => {
			let obj: any = []
			for (var key in item) {
				GetDiyFieldList.value.forEach((row: { Visible: number; Name: string; Label: string;TableId: string; }) => {
					if (row?.Visible == 1) {
						if (key == row.Name) {
							obj.push({
								Label: row.Label,
								Value: item[key],
								TableId: row.TableId
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
		NewChildList.value = arr
		console.log(NewChildList.value,'NewChildList')
	}
	// 点击分页啦
	const change = async (e: any) => {
		console.log(e,'点击分页啦')
		pageCurrent.value = e.current
		const res: any = await GetTableData(props.TableChildTableData, props.TableRowId, pageCurrent.value, pageSize.value, props.formData)
		console.log(res,'res')
		NewChildList.value = res.Data
	}
	// 点击操作
	const goEdit = (id:string,item: { Name: string; TableDescription: any; }, type: number) => {
		console.log('dinaji ')
		if (type == 3) {
			uni.navigateTo({
				url: `/pages-workspace/work-detail/index?DiyTableId=${JSON.parse(props.TableChildTableData).TableChildTableId}&Description=${item.TableDescription}&DiyTableRowId=${id}`,
			});
			return
		}
		emits('handlEdit',{id:id,item:item,type:type})
	}
</script>

<style>
</style>