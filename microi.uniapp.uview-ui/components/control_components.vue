<template>
	<view>
		<u-form :model="form" :rules="rules" ref="uForm">
			<block v-for="(item,Id) in tableFieldList" :key="Id">
				<u-form-item v-if="item.Visible" :label="item.Label" label-position="top" :required="item.NotEmpty"
					:prop="item.Name">
					<!-- 单行文本 数字 -->
					<u-input v-if="item.Component == 'NumberText'" :placeholder="item.Placeholder" type="number"
						:value="form[item.Name]" :disabled="item.Readonly"
						:style="item.Readonly?'':'background:none;'" />

					<!-- 自动编号 -->
					<u-input v-else-if="item.Component == 'AutoNumber'" :placeholder="item.Placeholder"
						:value="form[item.Name]" />

					<!-- 单选框 -->
					<u-radio-group v-else-if="item.Component == 'Radio'" :value="form[item.Name]">
						<u-radio @change="radioChange($event,item)" v-for="(val, ind) in item.Data" :key="ind"
							:name="val.name" :disabled="val.disabled">
							{{val.name || ''}}
						</u-radio>
					</u-radio-group>

					<!-- 复选框 -->
					<u-checkbox-group v-else-if="item.Component == 'Checkbox'">
						<u-checkbox @change="checkboxChange($event,item)" :value="val.checked"
							v-for="(val, ind) in item.Data" :key="ind" :name="val.name">{{val.name}}</u-checkbox>
					</u-checkbox-group>

					<!-- 开关 -->
					<u-switch v-else-if="item.Component == 'Switch'" @change="handleChangeSwitch($event,item)"
						:value="show.switch" />

					<!-- 上传图片 -->
					<view class="wrap" v-else-if="item.Component == 'ImgUpload'">
						<u-upload ref="uUpload" :action="image.action" :header="image.headers" :limitType="image.limitType"
							 auto-upload :multiple="false" custom-btn :show-progress="false"
							@on-remove="onRemove" @on-success="onSuccess">
							<view slot="addBtn" class="slot-btn" hover-class="slot-btn__hover" hover-stay-time="150" @click="handleImage(item)">
								<u-icon name="plus" size="60" label-pos="bottom" margin-top="20" color="#c0c4cc"
									:label="item.Label"></u-icon>
							</view>
						</u-upload>
					</view>
					
					<!-- 上传文件 -->
					<view v-else-if="item.Component == 'FileUpload'" class="upload-file">
						<view class="upload-img" @click="handleUploadFile(item)">
							<u-icon name="plus" size="60" label-pos="right" margin-left="30" color="#c0c4cc"
								label="文件上传"></u-icon>
						</view>
						
						<view class="file-list">
							<view class="file-item" v-for="(val,ind) in item.Data" :key="index">
								<view style="display:flex;align-items:center;">
									<u-icon name="file-text-fill" size="50" color="#2979FF"></u-icon>
									<view>{{val.name}}</view>
								</view>
								<u-icon name="close" size="30" color="#c0c4cc" @click="handleCloseFile(item,ind)"></u-icon>
							</view>
						</view>
					</view>

					<!-- 下拉单选 ， 时间选择 -->
					<u-input
						v-else-if="item.Component.includes('Select') || item.Component == 'DateTime' || item.Component == 'Cascader'"
						type="select" :placeholder="item.Placeholder" :value="form[item.Name]" :disabled="item.Readonly"
						@click="handleInput(item)" />

					<!-- 单行/多行 文本 -->
					<u-input v-else :placeholder="item.Placeholder" :value="form[item.Name]" auto-height
						:disabled="item.Readonly" @input="handleChangeInput($event,item)" />
				</u-form-item>
			</block>
		</u-form>

		<!-- 下拉单选 -->
		<u-select v-model="show.select"
			:mode="select.type.includes('Select')?'single-column':'mutil-column-auto'" :list="list.select"
			@confirm="confirmSelect" />

		<!-- 时间选择 -->
		<u-picker mode="time" v-model="show.picker" :params="time" @confirm="confirmRadio" />

		<!-- 下拉多选 -->
		<u-popup v-model="show.popup" mode="bottom">
			<view class="popup-content">
				<scroll-view class="popup-list" scroll-y>
					<view class="item">
						<text>请选择</text>
					</view>
					<view :class="[item.selected?'active':'','item']" v-for="(item,index) in list.multipleSelect"
						:key="index" @click="handlePopupSelect(index)">
						<text>{{item.label}}</text>
						<u-icon v-show="item.selected" name="checkbox-mark" color="#2979ff" size="32" />
					</view>
				</scroll-view>
			</view>
		</u-popup>

	</view>
</template>

<script>
	// #ifdef APP-PLUS
	var AfDocument = uni.requireNativePlugin("Aq-ChooseFile");
	// #endif
	export default {
		props: {
			tableFieldList: {
				type: Array,
				default: () => []
			},
			init: {
				type: Boolean,
				default: false,
			},
			rules: {
				type: Object,
				default: () => {}
			},
			detail:{
				type: Object,
				default: () => {}
			},
		},

		data() {
			return {
				select: {
					type: '',
					model: {}
				},
				show: {
					picker: false,
					select: false,
					popup: false,
					switch: false,
				},
				time: {
					year: true,
					month: true,
					day: true,
				},

				list: {
					select: [],
					radio: [],
					multipleSelect: [],
					fileList:[],
				},
				currentSelects: [],
				form: {},
			}
		},
		mounted() {
			console.log('嗨',this.detail)
			this.form = this.detail
			this.tableFieldList.forEach(async item=>{
				if(item.Name.includes('RFID')){
					item.Readonly = true
					item.Visible = false
					let val = await this.handleGetRFID()
					this.form[item.Name] = val
					console.log(this.form)
				}
			})
		},
		methods: {
			//判断类型后赋值
			handleInput(model) {
				//清空下拉数组内容
				this.$set(this.list, 'select', {})
				this.$set(this.list, 'radio', {})
				this.select.type = model.Component
				if (this.select.type == 'DateTime') {
					this.show.picker = true;
				} else if (this.select.type == 'MultipleSelect') {
					this.show.popup = true;
					this.$set(this.list, 'multipleSelect', model.Data)
					this.$forceUpdate()
				} else {
					this.show.select = true;
					this.$set(this.list, 'select', model.Data)
					this.$forceUpdate()
				}

				this.select.model = model
			},
			//下拉单选
			confirmSelect(e) {
				let val = ''
				e.forEach((item,index)=>{
					if(!item.label)return
					if(index>=1){
						val += '-'+item.label
					}else{
						val += item.label
					}
				})
				this.$set(this.form, this.select.model.Name, val)
				this.$forceUpdate()
			},
			
			//文本框
			handleChangeInput(e,model){
				console.log(e,model)
				this.$set(this.form, model.Name, e)
				this.$forceUpdate()
			},

			//时间选择
			confirmRadio(e) {
				let time = `${e.year}-${e.month}-${e.day}`
				this.$set(this.form, this.select.model.Name, time)
				this.$forceUpdate()
			},

			//下拉多选
			handlePopupSelect(index) {
				console.log(this.list.multipleSelect[index].selected)
				this.list.multipleSelect[index].selected = !this.list.multipleSelect[index].selected

				let list = []
				this.list.multipleSelect.forEach(item => {
					console.log(item.selected)
					if (item.selected) {
						list.push(item.value)
					}
				})
				console.log(list)
				this.$set(this.form, this.select.model.Name, this.arrayToString(list))
				this.$forceUpdate()
			},

			//开关
			handleChangeSwitch(e, model) {
				this.$set(this.form, model.Name, e)
				this.$forceUpdate()
			},

			//上传图片
			async onSuccess(data, index, lists, name) {
				this.select.model.Data.push(data.Data.Path)
				this.getFormImg(this.select.model.Data)
			},
			//删除图片
			onRemove(index, lists, name) {
				this.select.model.Data.splice(index, 1)
				this.getFormImg(this.select.model.Data)
			},
			//获取图片
			getFormImg(val){
				let value = this.arrayToString(val)
				this.$set(this.form, this.select.model.Name, value)
				this.$forceUpdate()
				console.log(this.form)
			},
			handleImage(model){
				this.select.model = model
			},
			
			//上传文件
			handleUploadFile(model){
				let that = this
				// #ifdef MP-WEIXIN
				uni.chooseMessageFile({
					success: function(res) {
						const tempFiles = res.tempFiles;
						uni.uploadFile({
							url: that.image.action,
							filePath: tempFiles[0].path,
							name: 'file',
							header:that.image.headers,
							success: uploadFileRes => {
								let temporaryImg = JSON.parse(uploadFileRes.data);
								// that.$config.ImgBaseUrl+
								model.Data.push({ name: tempFiles[0].name, url: temporaryImg.Data.Path });
								that.$set(that.form, model.Name, model.Data)
								that.$forceUpdate()
							},
							fail(err) {
								console.log(err,'err')
								uni.showToast({
									title: '上传失败',
									icon: 'none'
								});
							}
						});
					}
				});
				// #endif
				// #ifdef APP-PLUS
				AfDocument.openMode({
					size: '10', //选择总数量
					paths:['/storage/emulated/0/Download','/storage/emulated/0/A','sdcard/tencent/MicroMsg/Download'],   //自定义选择目录
					isDown:true,//是否下钻（true 筛选当前目录以下的所有文件，fales 只筛选当前目录文件） 
					types:[{
						name:'文档',
						value:["doc","wps","docx","xls","xlsx","pdf","apk"]
					},{
						name:'视频',
						value:["mp4"] 
					},{
						name:'音乐',
						value:['mp3','flac'] 
					},{
						name:'图片',
						value:['jpg','png'] 
					}]
				},(res)=>{
					let fileList = (JSON.parse(JSON.stringify(res))).res
					fileList.forEach(item =>{
						uni.uploadFile({
							url: that.image.action,
							filePath: item.path,
							name: 'file',
							header:that.image.headers,
							success: uploadFileRes => {
								console.log(uploadFileRes)
								let temporaryImg = JSON.parse(uploadFileRes.data);
								// that.$config.ImgBaseUrl+
								model.Data.push({ name: item.name, url: temporaryImg.Data.Path });
								that.$set(that.form, model.Name, model.Data)
								that.$forceUpdate()
							},
							fail(err) {
								console.log(err,'err')
								uni.showToast({
									title: '上传失败',
									icon: 'none'
								});
							}
						});
					})
				})
				// #endif
			},
			handleCloseFile(model,index){
				//删除文件
				model.Data.splice(index, 1)
			},
			
			// 选中某个单选框时，由radio时触发
			radioChange(e, model) {
				this.$set(this.form, model.Name, e)
				this.$forceUpdate()
			},

			//复选框
			checkboxChange(e, model) {
				let val = []
				this.$nextTick(_ => {
					model.Data.map(item => {
						if (item.checked) {
							val.push(item.name)
						}
					})
					this.$set(this.form, model.Name,this.arrayToString(val))
					this.$forceUpdate()
				})
			},
			
			arrayToString(arr){
				return arr+''
			},
			
			async handleGetRFID(){
				let res = await this.$u.api.ApiEngineRun({
					ApiKey: "RFID_shengcheng"
				})
				if(res.data.Code != 1) return 
				return res.data.Data
			},
		},

		watch: {
			init(newVal) {
				if (newVal) {
					this.$refs.uForm.setRules(this.rules)
				}
			},
		},
		computed: {
			image() {
				return {
					action: 'https://api.itdos.com/api/HDFS/Upload',
					showUploadList: false,
					lists: [],
					limitType: ['png', 'jpg', 'jpeg'],
					headers: {
						Authorization: this.vuex_token,
						'Content-Type': 'multipart/form-data'
					}
				}
			}
		},
	}
</script>

<style lang="scss" scoped>
	// ::v-deep .u-input__input {
	// 	background-color: #F7F7F7;
	// 	border-radius: 5rpx;
	// }


	// Popup弹出层
	.popup-content {
		padding: 30rpx;

		.popup-search {
			padding: 0 0 30rpx;
		}

		.popup-list {
			max-height: 60vh;

			.item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 20rpx 0;
				font-weight: bold;
				border-bottom: 1rpx solid #F7F7F7;

				&.active {
					color: $uni-color-primary;
				}
			}
		}

	}

	.wrap {
		padding: 24rpx;
	}

	.slot-btn {
		width: 200rpx;
		height: 200rpx;
		display: flex;
		justify-content: center;
		align-items: center;
		background: rgb(244, 245, 246);
		border-radius: 10rpx;
	}

	.slot-btn__hover {
		background-color: rgb(235, 236, 238);
	}

	.pre-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.pre-item {
		flex: 0 0 48.5%;
		border-radius: 10rpx;
		height: 140rpx;
		overflow: hidden;
		position: relative;
		margin-bottom: 20rpx;
	}

	.pre-item-image {
		width: 100%;
		height: 140rpx;
	}
	.upload-file{
		width:100%;
		
	}
	.upload-img{
		width:100%;
		padding:30rpx 50rpx;
		display: flex;
		justify-content:flex-start;
		background-color: #F4F5F6;
		border-radius:10rpx;
	}
	.file-list{
		margin: 5rpx 0;
	}
	.file-item{
		display: flex;
		padding:15rpx 30rpx 15rpx 0;
		align-items: center;
		justify-content:space-between;
		margin:8rpx 0;
	}
</style>
