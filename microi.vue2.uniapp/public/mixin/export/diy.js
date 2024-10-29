export default {
	data() {
		return {
			title: '新增',
			tableFieldList: [],
			tableId: '',
			tableRowId:'',
			formTitle: '',
			rules: {},
			init: false,
			formEngineKey:'',
			detail:{}
		}
	},

	computed: {
		// 获取所有必填项
		getRequiredRulesList() {
			return this.tableFieldList.filter(item => item.NotEmpty)
		},
		// 获取所有树型
		getSelectTreeList() {
			return this.tableFieldList.filter(item => item.Component == 'SelectTree')
		},

		// 获取所有下拉
		getSelectList() {
			return this.tableFieldList.filter(item => item.Component == 'Select')
		},

		// 获取所有下拉多选
		getMultipleSelectList() {
			return this.tableFieldList.filter(item => item.Component == 'MultipleSelect')
		},
		
		// 获取所有级联选择器
		getCascaderList() {
			return this.tableFieldList.filter(item => item.Component == 'Cascader')
		},
		
		// 获取所有日期时间
		getDateTimeList() {
			return this.tableFieldList.filter(item => item.Component == 'DateTime')
		},
		
		// 获取所有单选框
		getRadioList() {
			return this.tableFieldList.filter(item => item.Component == 'Radio')
		},
		
		// 获取所有复选框
		getCheckboxList() {
			return this.tableFieldList.filter(item => item.Component == 'Checkbox')
		},
		
		
		// 获取所有开关
		getSwitchList() {
			return this.tableFieldList.filter(item => item.Component == 'Switch')
		},
		
		//获取所有上传图片 或 文件
		getUploadList() {
			return this.tableFieldList.filter(item => item.Component == 'ImgUpload' || item.Component == 'FileUpload')
		},
	},

	methods: {

		// 获取表名
		async handleDiyTableModel() {
			if (this.tableId) {
				var params = {
					Id: this.tableId
				}
				const res = await this.$u.api.GetDiyTableModel(params)
				this.formTitle = res.data.Data.Description
				this.formEngineKey =  res.data.Data.Name
			}
		},

		// 获取所有字段
		async handleDiyField() {
			if (this.tableId) {
				const params = {
					TableId: this.tableId
				}
				const res = await this.$u.api.GetDiyField(params)
				this.tableFieldList = res.data.Data
				this.tableFieldList.map(item => {
					item.Placeholder = item.Component.includes('Select') ? '请选择' : '请输入' + item.Label
				})
				// console.log(this.tableFieldList)
			}
		},
		//获取详情
		async getDiyTableRowModel(){
			if(this.tableRowId){
				this.title = '编辑'
				var params = {
					TableId: this.tableId,
					_TableRowId: this.tableRowId
				}
				var res = await this.$u.api.GetDiyTableRowModel(params)
			
				if (res.data.Code!=1) return 
					
				this.detail = res.data.Data
				
				console.log(this.detail,'detail')
			}
		},
		//定义rules
		handleRules() {
			for (let key of this.getRequiredRulesList) {
				this.rules[key['Name']] = [{
					required: true,
					message: `请输入${key['Label']}`,
					trigger: ['blur','change']
				}]
			}
		},

		// 树型菜单
		handleDiyFieldSqlData() {
			this.getSelectTreeList.forEach(async field => {
				const params = {
					_FieldId: field.Id,
					_SqlParamValue: {}
				}
				const res = await this.$u.api.GetDiyFieldSqlData(params)
				const list1 = this.handleChild(res.data.Data)
				const list = this.handleMergeChild(list1)
				const index = this.tableFieldList.findIndex(item => item.Id == field.Id)
				this.$set(this.tableFieldList[index], 'Data', list)
			})
		},
		
		//级联菜单getCascaderList
		handleCascaderList() {
			this.getCascaderList.forEach(async field => {
				const params = {
					_FieldId: field.Id,
					_SqlParamValue: {}
				}
				const res = await this.$u.api.GetDiyFieldSqlData(params)
				const list = this.handleCascaderChild(res.data.Data)
				const index = this.tableFieldList.findIndex(item => item.Id == field.Id)
				this.$set(this.tableFieldList[index], 'Data', list)
			})
		},
		

		//下拉多选菜单
		handleMultipleSelectList() {
			this.getMultipleSelectList.forEach(item => {
				item.Data = JSON.parse(item.Data).map(_item => {
					return {
						value: _item,
						label: _item,
						selected:false,
					}
				})
			})
		},

		//下拉菜单
		handleSelectList() {
			this.getSelectList.forEach(async item => {
				console.log(typeof item.Data,'Select')
				if(JSON.parse(item.Data).length>0){
					item.Data = JSON.parse(item.Data).map(_item => {
						return {
							value: _item,
							label: _item,
						}
					})
				}else{
					const params = {
						_FieldId: item.Id,
						_SqlParamValue: {}
					}
					const res = await this.$u.api.GetDiyFieldSqlData(params)
					const list = this.handleSelectChild(res.data.Data)
					const index = this.tableFieldList.findIndex(f => f.Id == item.Id)
					this.$set(this.tableFieldList[index], 'Data', list)
				}
			})
		},
		
		//单选框
		handleRadioList(){
			this.getRadioList.forEach(item=>{
				item.Data = JSON.parse(item.Data).map(_item => {
					return {
						name:_item,
						disabled:false,
					}
				})
			})
		},
		
		//复选框
		handleCheckboxList(){
			this.getCheckboxList.forEach(item=>{
				item.Data = JSON.parse(item.Data).map(_item => {
					return {
						name:_item,
						checked:false,
					}
				})
			})
		},
		
		//上传文件
		handleUpload(){
			this.getUploadList.map(item=>{
				item.Data = []
			})
		},

		//树型合并
		handleMergeChild(arr) {
			let result = []
			arr.forEach(item => {
				result.push({
					label: item.label,
					value: item.value
				})
				if (item.children) {
					item.children.forEach(child => {
						result.push({
							label: `${item.label}-${child.label}`,
							value: child.value
						})

						if (child.children) {
							child.children.forEach(_child => {
								result.push({
									label: `${item.label}-${child.label}-${_child.label}`,
									value: _child.value
								})
							})
						}
					})
				}
			})
			return result
		},
		// 树型递归
		handleChild(arr) {
			return arr.map(item => {
				return {
					value: item.Id,
					label: item.FenleiMC || item.QuyuMC,
					children: item._Child ? this.handleChild(item._Child) : []
				}
			})
		},
		
		// 级联递归
		handleCascaderChild(arr){
			return arr.map(item => {
				return {
					value: item.Id,
					label: item.FenleiMC || item.QuyuMC,
					children: item._Child ? this.handleCascaderChild(item._Child) : [{
						value:'',
						label:''
					}]
				}
			})
		},
		//下拉单选递归
		handleSelectChild(arr){
			return arr.map(item => {
				return {
					value: item.Id,
					label: item.Name || item.suozaikw || item.GongyingSMC || item.DanweiMC,
				}
			})
		},
		

		// 初始化
		async handleInit() {
			await this.getDiyTableRowModel()
			await this.handleDiyTableModel()
			await this.handleDiyField()
			await this.handleDiyFieldSqlData()
			await this.handleSelectList()
			await this.handleCascaderList()
			await this.handleRadioList()
			await this.handleCheckboxList()
			await this.handleMultipleSelectList()
			await this.handleUpload()
			this.handleRules()
			this.init = true;
			
			console.log(this.tableFieldList)
		}
	},
	mounted() {
		this.handleInit()
	},
	
}
