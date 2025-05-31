<template>
	<view class="content">
		<u-navbar :is-back="true" :title="title" title-color="#fff" title-size="34" :border-bottom="false"
			:background="background" :immersive="true" back-icon-color="#fff" :title-bold="true">
			<!-- <view class="slot-wrap" style="justify-content: flex-end;padding-left:50rpx;">
				<u-image width="40rpx" height="40rpx" src="/static/img/work/edit.png" mode="" @click="choiceShow=true">
				</u-image>
			</view> -->
		</u-navbar>

		<view class="work-detail">
			<view class="banner" :style="{paddingTop:titleHeight+'px'}">
				<text>{{formTitle||''}}</text>
			</view>

			<view class="work-list" :style="{top:barHeight+'px',paddingBottom:barHeight+'px'}">
				<scroll-view scroll-y style="height: 100%;width: 100%;padding-top: 22rpx;padding-bottom: 50rpx;">
					<view v-if="tableFieldList.length>0" class="work-item">
						<control-components ref="dynamicForm" :init="init" :rules="rules"
							:tableFieldList="tableFieldList" :detail="detail"/>
						<u-button type="primary" style="margin:40rpx 0;" @click="handelAddForm">提交</u-button>
					</view>
					<view v-else class="work-loading">
						<u-loading mode="circle" size="50"></u-loading>
					</view>
				</scroll-view>
			</view>
		</view>
		<u-toast ref="uToast" />
	</view>
</template>

<script>
	import controlComponents from '@/components/control_components'
	import diy from '@/public/mixin/export/diy'
	export default {
		mixins: [diy],
		components: {
			controlComponents
		},
		data() {
			return {
				background: {
					background: 'transparent'
				},
				barHeight: 0,
				titleHeight: 0,
			}
		},
		methods: {
			handelAddForm() {
				console.log(this.$refs.dynamicForm.form,'addform')
				this.$refs.dynamicForm.$refs.uForm.validate(async valid => {
					if (valid) {
						if(!this.$refs.dynamicForm.form.Id){
							let params = {
								FormEngineKey: this.formEngineKey,
								...this.$refs.dynamicForm.form
							}
							let res = await this.$u.api.AddFormData(params)
							this.$refs.uToast.show({
								title: '添加成功！',
								type: 'success'
							})
						}else{
							let params = {
								FormEngineKey: 'Diy_ZiChanJLDW',
								Id: this.tableRowId,
								TableId: this.tableId,
								_RowModel:{
									...this.$refs.dynamicForm.form
								}
							}
							let res = await this.$u.api.UptFormData(params)
							this.$refs.uToast.show({
								title: '修改成功！',
								type: 'success'
							})
						}
						setTimeout(() => {
							uni.navigateBack({
								delta: 1
							});
						}, 1000)
						console.log('验证通过');
					} else {
						console.log('验证失败');
					}
				});
			},

		},
		onLoad() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 69.5
			this.titleHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 28
			console.log(this.$Route.query)
			this.tableId = this.$Route.query.TableId
			this.tableRowId = this.$Route.query.TableRowId
		},
		onShareAppMessage(res) { //发送给朋友
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		},
		onShareTimeline(res) { //分享到朋友圈
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		}
	}
</script>

<style lang="scss" scoped>
	.content {
		width: 100%;
		min-height: 100vh;
		position: absolute;
		top: 0;
		left: 0;
		z-index: 1000;
		background-color: #3F5CD9;
	}

	.banner {
		height: 429rpx;
		width: 100%;
		background-color: #3F5CD9;
		padding: 170rpx 0 0 40rpx;
		font-size: 36rpx;
		color: #fff;
		display: flex;
		justify-content: space-between;

		.banner-right {
			font-size: 28rpx;
			color: #C3CEFF;
			display: flex;
			justify-content: center;
			margin-right: 50rpx;
			padding-top: 6rpx;

			text {
				margin-left: 9rpx;
			}
		}
	}

	.work-list {
		width: 100%;
		height: 100%;
		border-radius: 62rpx 62rpx 0 0;
		position: absolute;
		background-color: #fff;
		overflow: hidden;

		.work-item {
			padding: 44rpx 40rpx;
			border-bottom: 1rpx solid #E6E6E6;

			.work-item-body {
				display: flex;
				justify-content: space-between;
				align-items: center;

				.work-item-key {
					color: #171717;
				}
			}

			.work-item-body1 {
				display: block;

				.work-item-key {
					color: #171717;
					margin-bottom: 38rpx;
				}
			}
		}

		.work-item:last-child {
			margin-bottom: 280rpx;
		}

		.work-loading {
			width: 100%;
			text-align: center;
			padding-top: 50rpx;
		}
	}
</style>
