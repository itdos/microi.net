<template>
	<view class="uni-container">
		<view class="search-box" :class="{ 'search-box-scrolled': isScrolled }">
			<view class="search-item uni-flex uni-common-mb-xs">
				<view class="search-input">
					<uni-easyinput prefixIcon="search" v-model="keyword" :value="keyword?keyword:''" placeholder="关键词"
						:styles="{borderColor: '#4179F7'}" @iconClick="ClickSearch" @blur="ClickSearch"
						@clear="onClear" />
				</view>
				<view class="search-btn" v-if="searchListIds.length > 0">
					<view class="more-search-btn" @click.stop="onSearchClick('search')">
                        <text>更多搜索</text>
                        <!-- <uni-icons type="down" size="14"></uni-icons> -->
                    </view>
				</view>
			</view>
		</view>
		<view class="work-container">
			<view v-if="diyFormFields && diyFormFields.length > 0">
				<view class="work-list" v-for="item in listData" :key="item.Id" @click.stop="goDetail(item)">
					<cardDetail :diyFormFields="diyFormFields" :detail="item" type="list" :key="new Date().getTime()" />
					<view class="uni-flex uni-flex-wrap uni-flex-justify-end mt-2" :key="item.Id">
						<block v-for="btn in MoreBtns" :key="btn.Id">
							<view v-if="isShowBtn(btn,item, diyFormFields, currentPermission, 'edit')"
								class="ml-2">
								<button @click.stop="goBtn(btn,item)" class="uni-button" size="mini"
									:type="btn.type ? btn.type : 'primary'">{{ btn.Name }}</button>
							</view>
						</block>
					</view>
				</view>
			</view>
		</view>
		<view class="flex justify-center mt-20"
			v-if="listData.length == 0 && status !== 'loading'">
			<image src="/static/image/none.jpg" mode="widthFix" style="    transform: scale(0.8);"></image>
		</view>
		<uni-load-more :status="status" :content-text="contentText" />
		<!-- <view class="work-list-add" @click="goAdd" v-if="currentPermission.includes('Add')">
      <uni-icons type="plusempty" size="35" color="#fff" />
    </view> -->

		<movable-area class="movable-container">
			<movable-view class="movable-fab" direction="all" :x="initialX" :y="initialY" :inertia="true" :out-of-bounds="false" :damping="50">
				<uni-fab ref="fab" :popMenu="popMenu" :pattern="pattern" :content="newContent" horizontal="right"
			vertical="bottom" direction="horizontal" @trigger="trigger" @fabClick="handleFab"
			v-if="newContent.length > 0" />
			</movable-view>
		</movable-area>
		
		<!-- <uni-fab ref="fab" :popMenu="popMenu" :pattern="pattern" :content="newContent" horizontal="right"
			vertical="bottom" direction="horizontal" @trigger="trigger" @fabClick="handleFab"
			v-if="newContent.length > 0" /> -->
		<uni-popup ref="popupTable" type="bottom" border-radius="10px 10px 0 0">
			<view class="popup-box">
				<view class="popup-content uni-common-pb">
					<view class="popup-close" @click="onSearchClose('Table')">
						<uni-icons type="closeempty" size="30px" color="#999" />
					</view>
					<child-form :OpenAnyFormData="OpenAnyFormData" @ChildSubmitOk="ChildSubmitOk" />
				</view>
			</view>
		</uni-popup>
		<uni-popup ref="popupSearch" type="top">
			<view class="popup-search-box" @click.stop="onSearchClose('search')">
				<searchControl :searchList="searchListIds" :tableFields="tableFields" :searchForm="searchForm"
					:key="new Date().getTime()" @search="onSearch" @click.stop="onSearchClick" />
			</view>
		</uni-popup>
	</view>
</template>

<script setup>
	import {
		onLoad,
		onShow,
		onPullDownRefresh,
		onReachBottom,
		onUnload,
		onPageScroll
	} from '@dcloudio/uni-app';
	import {
		ref,
		reactive,
		inject,
		nextTick,
		watch,
		onMounted,
		onBeforeUnmount
	} from 'vue'
	import {
		diyFormField,
		DiyTableModule,
		isBase64,
		handleFormDetail,
		getAuthList,
		RunV8Code,
		initV8Init,
		isShowBtn,
		scanCodeH5,
		getApiUrl,
		diyTableField,
		deepCopyFunction,
		getCacheFormData
	} from '@/utils'
	import cardDetail from '@/FormComponents/cardDetail.vue';
	import childForm from '../work-add/index.vue';
	import searchControl from '@/FormComponents/searchControl.vue';
 
	import {
		Base64
	} from 'js-base64'
	const V8 = inject('V8'); // 使用注入V8实例
	const Microi = inject('Microi'); // 使用注入Microi实例
	const MenuId = ref('') // 当前菜单ID
	const status = ref('loading')
	const contentText = ref({
		contentdown: '查看更多',
		contentrefresh: '加载中',
		contentnomore: '没有更多'
	})
	// 分页数据
	const pageData = reactive({
		pageIndex: 1,
		pageSize: 10,
		totalPage: 0
	})
	const listData = ref([]) // 列表数据
	const DiyTableId = ref('') // 当前表单ID
	const diyFormFields = ref([]) // 当前表单字段
	const SearchEqual = ref({}) // 搜索条件
	// 给表单字段赋值（创建时间、创建人、修改时间）
	const createData = [{
		Label: '创建时间',
		Name: 'CreateTime',
		Visible: 1,
	}, {
		Label: '创建人',
		Name: 'UserName',
		Visible: 1
	}, {
		Label: '修改时间',
		Name: 'UpdateTime',
		Visible: 1
	}]
	const keyword = ref('') // 搜索关键字
	// 更多搜索条件列表
	const searchList = ref([])
	const MoreBtns = ref([{
			Id: 'Edit',
			Name: '编辑',
			type: 'primary'
		},
		{
			Id: 'Del',
			Name: '删除',
			type: 'warn'
		}
	]) // 显示行更多按钮
	const currentPermission = ref([]) // 当前用户权限
	const content = [{
		iconPath: '/static/icons/fab.png',
		selectedIconPath: '/static/icons/fab.png',
		text: '新增',
		value: 'Add',
		active: false
	}]
	const popMenu = ref(true) // 弹出菜单
	const newContent = ref([]) // 过滤后的按钮
	const pattern = {
		color: '#7A7E83',
		backgroundColor: '#fff',
		selectedColor: '#007AFF',
		buttonColor: '#007AFF',
		iconColor: '#fff',
		icon: 'compose'
	} // 按钮模式
	// 悬浮按钮初始位置
	const initialX = ref(uni.getSystemInfoSync().windowWidth - 100)
	const initialY = ref(uni.getSystemInfoSync().windowHeight - 100)
	const popupTable = ref(null) // 新增子表弹窗
	const OpenAnyFormData = ref({}) // 打开任意表单数据
	// 是否带流程表单
	const isWF = ref(false)
	const WorkData = ref({}) // 工作流表单数据
	const DiyTableObj = ref({}) // 自定义表单数据
	const popupSearch = ref(null) // 搜索弹窗
	const searchListIds = ref([]) // 搜索条件列表
	const tableFields = ref({}) // 自定义表格字段
	const searchForm = ref({}) // 搜索表单
	const where = ref([]) // 自定义查询条件
	const SearchDateTime = ref({}) // 搜索日期时间
	const DiyConfig = ref({}) // 自定义配置 SelectApi 查询接口替换
	const isScrolled = ref(false); // Track scroll state
	// 获取当前页面实例
	let currentPage = getCurrentPages().pop();
	// 搜索列表
	const ClickSearch = () => {
		pageData.pageIndex = 1
		getListData()
	}
	// 清空搜索条件
	const onClear = () => {
		keyword.value = ''
		getListData()
	}
	// 获取当前模块设计数据
	const getFormMenuData = async () => {
		 
		try {
			Microi.ShowLoading('加载中···')
			//走缓存处理流程
			let fromData =await getCacheFormData('Sys_Menu',MenuId.value)
			
			DiyTableId.value = fromData.DiyTableId // 表单ID
			DiyConfig.value = JSON.parse(fromData.DiyConfig) // 自定义配置
			const MoreBtns1 = JSON.parse(fromData.MoreBtns) ?? []
			MoreBtns.value = MoreBtns1.concat(MoreBtns.value) // 显示行更多按钮
			// 表单更多按钮
			uni.setStorageSync('FormBtns', fromData.FormBtns)
			const PageBtns = JSON.parse(fromData.PageBtns) ?? [] // 页面按钮
			PageBtns?.forEach(item => {
				content.push({
					iconPath: '/static/icons/fab.png' || item.Icon,
					selectedIconPath: '/static/icons/fab.png' || item.SelectedIcon,
					text: item.Name,
					value: item.Id,
					active: false,
					V8Code: item.V8Code
				})
			})
			searchListIds.value = JSON.parse(fromData.SearchFieldIds) // 更多搜索条件字段
			searchList.value = JSON.parse(fromData.SearchFieldIds) // 搜索条件列表
			const NotShowFields = JSON.parse(fromData.NotShowFields) // 不显示的字段
			const SelectFields = JSON.parse(fromData?.SelectFields)?.map(item => item.Id) ?? [];
			let NotSelectFields = []
			if (SelectFields?.length > 0) {
				NotSelectFields = SelectFields.concat(createData.map(item => item.Name)) // 查询列的字段
			}
			const DiyTableData = await DiyTableModule({
				Id: DiyTableId.value
			}) // 获取自定义表单
			DiyTableObj.value = DiyTableData
			V8.TableName = DiyTableData?.Name // 表单表名
			V8.TableId = DiyTableId.value // 表单ID
			const formFields = await diyTableField({
				TableId: DiyTableId.value,
				SysMenuId: MenuId.value
			}) // 获取表单字段
			var fields = {};
			formFields?.forEach(item => {
				fields[item.Name] = item;
			});
			tableFields.value = fields; // 自定义表格字段
			const arr = formFields?.concat(createData)
			// 过滤查询里面不显示字段的数据
			if (NotShowFields?.length > 0) { // 如果有不显示的字段，则过滤掉
				NotSelectFields = NotSelectFields.filter(item => !NotShowFields.includes(item))
			}
			if (NotSelectFields?.length > 0) { // 如果有查询列的字段，则过滤掉
				diyFormFields.value = arr.filter(item => NotSelectFields.includes(item.Id || item.Name))
				// 检查是否为空或者只包含createData中的三个字段
				const onlyHasCreateDataFields = diyFormFields.value.length > 0 && 
					diyFormFields.value.every(item => 
						createData.some(createItem => (item.Id || item.Name) === createItem.Name)
					) && 
					diyFormFields.value.length <= createData.length;
				
				if ((diyFormFields.value.length == 0 || onlyHasCreateDataFields) && NotShowFields?.length > 0) {
					diyFormFields.value = arr.filter(item => !NotShowFields.includes(item.Id || item.Name))
				}
			} else if (NotShowFields?.length > 0) { // 如果有不显示的字段，则显示全部字段
				diyFormFields.value = arr.filter(item => !NotShowFields.includes(item.Id || item.Name))
			} else {
				diyFormFields.value = arr
			}
			Microi.HideLoading()
			getPageAuth() // 获取当前页面权限
			// getListData()
		} catch (error) {
			console.error(error);
		} finally {
			Microi.HideLoading();
		}
	}
	// 获取列表数据
	const getListData = async () => {
		try {
			// 准备请求参数
			const params = {
				ModuleEngineKey: MenuId.value,
				_PageIndex: pageData.pageIndex,
				_PageSize: pageData.pageSize,
				_Keyword: keyword.value,
				_Where: where.value,
				_SearchDateTime: SearchDateTime.value
			}
			let res
			// 判断是否有自定义查询接口
			if (DiyConfig.value?.SelectApi) {
				console.log('走自定义查询接口')
				res = await Microi.Post(DiyConfig.value.SelectApi, params)
			}
			// 判断是否使用虚拟报表接口引擎
			else if (DiyTableObj.value?.ReportId && DiyTableObj.value?.DataSourceId) {
				console.log('走虚拟报表接口引擎')
				res = await Microi.Post(getApiUrl('ReportEngine'), {
					...params,
					DataSourceKey: DiyTableObj.value.DataSourceId
				})
			} else {
				res = await Microi.FormEngine.GetTableData({
					...params,
					_SearchEqual: SearchEqual.value
				})
			}
			// 处理响应数据
			if (res.Code === 1) {
				// 更新分页信息
				pageData.totalPage = Math.ceil(res.DataCount / pageData.pageSize)
				
				// 处理数据
				const data = await Promise.all(res.Data.map(item => handleFormDetail(item, diyFormFields.value)));
				
				// 更新列表数据
				nextTick(() => {
					if (pageData.pageIndex === 1) {
						listData.value = data
						status.value = 'onmore'
					} else {
						listData.value = listData.value.concat(data)
						if (data.length < pageData.pageSize) {
							status.value = 'nomore'
						}
					}
				})
			} else {
				Microi.Tips(res.Msg, false)
				status.value = 'onmore'
			}
		} catch (error) {
			console.error('获取列表数据失败:', error)
			Microi.Tips('获取列表数据失败', false)
		}
	}
	// 去新增
	const goAdd = () => {
		V8.OpenAnyFormData = {}
		Microi.RouterPush(
			`/pages/workbench/work-add/index?DiyTableId=${DiyTableId.value}&type=Add&isWF=${isWF.value}&WorkData=${JSON.stringify(WorkData.value)}`,
			true)
	}
	// 去详情
	const goDetail = (item, Workvalue) => {
		// 如果无详情权限，不跳转
		if (currentPermission.value.includes("NoDetail") && !Workvalue) return
		var FlowType = ''
		if (Workvalue) {
			FlowType = Workvalue.WorkType
		}
		Microi.RouterPush(
			`/pages/workbench/work-detail/index?DiyTableId=${DiyTableId.value}&Id=${item.Id}&MenuId=${MenuId.value}&FlowType=${FlowType}`,
			true)
	}
	// 去编辑
	const goEdit = async (item, leixing) => {
		const routeParams = {
			DiyTableId: DiyTableId.value,
			Id: item.Id,
			type: item.FormMode ? item.FormMode : 'Edit',
			isWF: isWF.value,
			WorkData: JSON.stringify(WorkData.value),
			leixing: leixing
		}
		if (!leixing) {
			V8.OpenAnyFormData = {}
		}
		const queryString = Object.entries(routeParams)
			.filter(([_, value]) => value !== undefined && value !== '')
			.map(([key, value]) => `${key}=${value}`)
			.join('&')
		Microi.RouterPush(`/pages/workbench/work-add/index?${queryString}`, true)
	}
	// 去删除
	const goDelete = (item) => {
		uni.showModal({
			title: '提示',
			content: '确定删除吗？',
			success: (res) => {
				if (res.confirm) {
					Microi.ShowLoading('删除中···')
					Microi.FormEngine.DelFormData({
						TableId: DiyTableId.value,
						Id: item.Id
					}).then(res => {
						if (res.Code == 1) {
							Microi.HideLoading()
							uni.showToast({
								title: '删除成功',
								icon: 'none'
							})
							getListData()
						} else {
							Microi.HideLoading()
							uni.showToast({
								title: '删除失败',
								icon: 'none'
							})
						}
					})
				}
			}
		})
	}
	// 点击更多按钮
	const goBtn = (btn, formData) => {
		if (btn.V8Code) {
			V8.Init(formData, diyFormFields.value);
			RunV8Code(btn.V8Code);
		}
		V8.FormWF = {
			IsWF: false,
		}
		// 如果是编辑按钮，则去编辑
		if (btn.Id == 'Edit') {
			goEdit(formData)
		} else if (btn.Id == 'Del') {
			goDelete(formData)
		}
	}
	// 发起工作流
	const StartWork = async (formData) => {
		console.log('StartWork', formData)
		const {
			FlowDesignId,
			TableRowId,
			FormData,
			NoticeFields,
			ForceSelectUsers
		} = formData
		let params = {
			FlowDesignId, //流程图Id，必传
			TableRowId, //数据Id（Form.Id），必传
			FormData, //表单数据
			NoticeFields,
			ForceSelectUsers //强制选择人员
		}
		const res = await Microi.Post(getApiUrl('StartWork'), params, function() {}, {
			DataType: "form"
		})
		console.log('提交工作流程结果', res)
		if (res.Code == 1) {
			uni.showToast({
				title: '发起成功',
				icon: 'none'
			})
			getListData()
		} else {
			uni.showToast({
				title: '发起失败：' + res.Msg,
				icon: 'none'
			})
		}
	}
	// 打开表单
	const OpenForm = (formData, type) => {
		if (type == 'Add') {
			goAdd()
		} else if (type == 'Edit') {
			goEdit(formData)
		}
	}
	/**
	 * 打开任意表单
	 **/
	const OpenAnyForm = (params) => {
		console.log('OpenAnyForm', params)
		// if (params.DialogType == 'Blank') {
		//   goEdit(params)
		// } else {
		//   // popupTable.value.open()
		//   // onSearchClick('Table')
		// }
		OpenAnyFormData.value = deepCopyFunction(params)
		V8.DataAppend = params.DataAppend
		V8.OpenAnyFormData = params
		// 如果是编辑，则去编辑
		// if (params.FormMode == 'Edit') {
			goEdit(params,'OpenAnyForm')
		// } else if (params.FormMode == 'Add'){
		// 	goAdd()
		// }
	}
	/**
	 * 打开工作流表单
	 **/
	const OpenFormWF = (formData, type, value) => {
		isWF.value = true
		console.log('OpenFormWF', formData, type, value)
		WorkData.value = value
		V8.FormWF = {
			...value,
			IsWF: true,
		}
		if (type == 'Add') {
			goAdd()
		} else if (type == 'Edit') {
			goEdit(formData)
		} else {
			goDetail(formData, value)
		}
	}
	// 子表提交啦
	const ChildSubmitOk = async () => {
		// popupTable.value.close()
		onSearchClose('Table')
		getListData()
	}
	// 刷新列表
	const RefreshTable = (data) => {
		pageData.pageIndex = data._PageIndex
		getListData()
	}
	// 触发按钮
	const trigger = async (e) => {
		// 如果是新增按钮，则去新增
		if (MenuId.value == '38bc3af8-1216-4118-a405-d48d386e9bbe') {
			Microi.RouterPush(`/pages/tools/daka/daka?DiyTableId=${DiyTableId.value}&type=Add`, true)
		} else if (e.item.value == 'Add') {
			goAdd()
		} else {
			await RunV8Code(e.item.V8Code)
		}
	}
	// 悬浮按钮点击事件
	const handleFab = () => {
		// 如果数据只有一条直接执行不用展开弹窗
		if (newContent.value.length <= 1) {
			trigger({
				item: newContent.value[0]
			})
		}
	}

	// 监听 newContent 变化，自动设置 popMenu
	watch(newContent, (newVal) => {
		popMenu.value = newVal.length > 1
	}, { immediate: true })

	// 更多搜索条件
	const onSearch = (e) => {
		Microi.ShowLoading('搜索中···')
		where.value = []
		SearchDateTime.value = {}
		for (let i in e) {
			if (e[i] && e[i] != '') {
				var TableId = searchListIds.value.find(item => item.Name == i)?.TableId
				// 如果是时间类型
				if (i == 'CreateTime' || (tableFields.value[i] && tableFields.value[i].Component == 'DateTime')) {
					SearchDateTime.value[i] = e[i]
				} else {
					// 如果e[i]是数组
					if (Array.isArray(e[i])) {
						where.value.push({
							FormEngineKey: TableId,
							Name: i,
							Value: JSON.stringify(e[i]),
							Type: 'In'
						})
					} else {
						where.value.push({
							FormEngineKey: TableId,
							Name: i,
							Value: e[i],
							Type: 'Like'
						})
					}
				}
			}
		}
		searchForm.value = e
		popupSearch.value.close()
		getListData()
		setTimeout(() => {
			Microi.HideLoading()
		}, 1000)
	}
	// 打开搜索弹窗
	const onSearchClick = (type) => {
		if (type == 'search') {
			popupSearch.value.open()
		}
		if (type == 'Table') {
			popupTable.value.open()
		}
	}
	// 关闭搜索弹窗
	const onSearchClose = (type) => {
		if (type == 'search') {
			popupSearch.value.close()
		}
		if (type == 'Table') {
			popupTable.value.close()
		}
	}
	onLoad(async (options) => {
		popMenu.value = true
		MenuId.value = options.MenuId
		keyword.value = options.Keyword || '';
		// 主菜单进来的名称
		uni.setNavigationBarTitle({
			title: options.MenuName
		})
		// 搜索条件
		SearchEqual.value = options.SearchEqual ? JSON.parse(options.SearchEqual) : {}
		// await getFormMenuData()
		V8.OpenForm = OpenForm; // 给V8实例添加OpenForm方法
		V8.OpenFormWF = OpenFormWF; // 给V8实例添加OpenFormWF方法
		V8.Method.ScanCode = scanCodeH5; // 给V8实例添加scanCodeH5方法
		V8.WF.StartWork = StartWork; // 给V8实例添加StartWork方法
		V8.RefreshTable = RefreshTable; // 给V8实例添加RefreshTable方法
	})
	onShow(async () => {
		if (diyFormFields.value.length == 0) {
			await getFormMenuData()
		}
		await getListData()
		V8.OpenForm = OpenForm;
		V8.OpenAnyForm = OpenAnyForm;
	})
	// 页面卸载时触发
	onUnload(() => {
		Microi.HideLoading()
	})
	// 下拉刷新
	onPullDownRefresh(() => {
		pageData.pageIndex = 1
		getListData()
		setTimeout(function() {
			uni.stopPullDownRefresh()
			console.log('stopPullDownRefresh')
		}, 1000)
	})
	// 上啦加载
	onReachBottom(() => {
		console.log('onReachBottom', pageData)
		if (pageData.pageIndex < pageData.totalPage) {
			status.value = 'loading'
			pageData.pageIndex++
			getListData()
		} else {
			status.value = 'nomore'
		}
	})

	// 获取当前页面权限
	const getPageAuth = () => {
		currentPermission.value = getAuthList(MenuId.value)
		content.map(item => {
			item.show = currentPermission.value.includes(item.value)
		})
		newContent.value = content.filter(item => item.show)
	}

	// Add the correct onPageScroll hook
	onPageScroll(({ scrollTop }) => {
		isScrolled.value = scrollTop > 10;
	});
</script>

<style lang="scss" scoped>
	.uni-container {
		padding: 30rpx;
		background-image: url('@/pages/tools/kaoqin/images/bg.jpg');
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		min-height: 100vh;
	}

	.work-container {
		padding-top: 70px;
	}

	.work-list {
		margin-bottom: 20px;
		background: #fff;
		border-radius: 10px;
		box-shadow: 0px 20px 60px rgba(102, 127, 191, 0.25);
		padding: 20px;
	}

	// 搜索框
	.search-box {
		position: fixed;
		top: 0px;
		left: 0px;
		right: 0px;
		background: transparent;
		padding: 20px 20px 10px 20px;
		z-index: 2;
		transition: background-color 0.3s ease;
	}

	.search-box-scrolled {
		background: white;
		box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);
	}

	.work-list-add {
		position: fixed;
		bottom: 90rpx;
		right: 20rpx;
		background: #1890ff;
		border-radius: 50%;
		width: 150rpx;
		height: 150rpx;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.search-input {
		flex: 1;

		&::v-deep .is-input-border {
			border-radius: 20px;
			padding-left: 10px;
			background-color: #E9F0FF !important;
		}
	}

	.search-btn {
		margin-left: 20rpx;
        display: flex;
        align-items: center;
        
        .more-search-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 20px;
            padding: 10rpx 20rpx;
            color: #666666;
            font-size: 26rpx;
            transition: all 0.3s;
            
            &:active {
                background-color: rgba(255, 255, 255, 0.2);
            }
            
            text {
                margin-right: 4rpx;
            }
        }
	}

	.popup-box {
		height: 100vh;
		display: flex;
		align-items: flex-end;
		width: 100%;
	}

	.popup-content {
		width: 100%;
		background: #fff;
		height: 75vh;
		border-radius: 10px 10px 0 0;
		// padding: 20px;
		box-sizing: border-box;
	}

	.popup-close {
		position: relative;
		right: 10px;
		top: 10px;
		text-align: right;
	}

	.popup-search-box {
		height: 100vh;
	}

	.movable-container {
		position: fixed;
		bottom: 0;
		right: 0;
		width: 100%;
		height: 100%;
		z-index: 999;
		pointer-events: none; /* Allow touch events to pass through to underlying elements */
	}

	.movable-fab {
		width: 112rpx;  /* Slightly larger than the FAB button */
		height: 112rpx;
		pointer-events: auto; /* Receive touch events */
		z-index: 1000;
	}

</style>