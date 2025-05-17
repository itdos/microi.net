<template>
	<view>
		<!--自定义地址选择器-->
		<view class="cc_area_mask" v-show="show == true"></view>
		<view :class="'cc_area_view ' + (show ? 'show':'hide')">
			<view class="cc_area_view_btns">
				<text class="cc_area_view_btn_cancle" @tap="handleNYZAreaCancle">取消</text>
				<text class="cc_area_view_btn_sure" @tap="handleNYZAreaSelect" :data-province="province"
					:data-city="city" :data-area="area">确定</text>
			</view>
			<picker-view class="cc_area_pick_view" indicator-style="height: 35px;" @change="handleNYZAreaChange"
				:value="value">
				<picker-view-column>
					<view v-for="(item, index) in provinces" :key="index" class="cc_area_colum_view">{{item}}</view>
				</picker-view-column>
				<picker-view-column>
					<view v-for="(item, index) in citys" :key="index" class="cc_area_colum_view">{{item}}</view>
				</picker-view-column>
				<picker-view-column>
					<view v-for="(item, index) in areas" :key="index" class="cc_area_colum_view">{{item}}</view>
				</picker-view-column>
			</picker-view>
		</view>
	</view>
</template>

<script>
	import {getProvinces,getMyCity,getAreas,getAreasCode} from "./area.js"

	let index = [0, 0, 0];
	let provinces = getProvinces();
	let citys = getMyCity(index[0]);
	let areas = getMyCity(index[0], index[1]);

	export default {
		mixins: [{
			methods: {
				setData: function(obj, callback) {
					let that = this;
					const handleData = (tepData, tepKey, afterKey) => {
						tepKey = tepKey.split('.');
						tepKey.forEach(item => {
							if (tepData[item] === null || tepData[item] === undefined) {
								let reg = /^[0-9]+$/;
								tepData[item] = reg.test(afterKey) ? [] : {};
								tepData = tepData[item];
							} else {
								tepData = tepData[item];
							}
						});
						return tepData;
					};
					const isFn = function(value) {
						return typeof value == 'function' || false;
					};
					Object.keys(obj).forEach(function(key) {
						let val = obj[key];
						key = key.replace(/\]/g, '').replace(/\[/g, '.');
						let front, after;
						let index_after = key.lastIndexOf('.');
						if (index_after != -1) {
							after = key.slice(index_after + 1);
							front = handleData(that, key.slice(0, index_after), after);
						} else {
							after = key;
							front = that;
						}
						if (front.$data && front.$data[after] === undefined) {
							Object.defineProperty(front, after, {
								get() {
									return front.$data[after];
								},
								set(newValue) {
									front.$data[after] = newValue;
									that.$forceUpdate();
								},
								enumerable: true,
								configurable: true
							});

							// #ifndef VUE3
							that.$set(front, after, val);
							// #endif

							// #ifdef VUE3
							Reflect.set(front, after, val);
							// #endif

						} else {

							// #ifndef VUE3
							that.$set(front, after, val);
							// #endif

							// #ifdef VUE3
							Reflect.set(front, after, val);
							// #endif
						}
					});
					isFn(callback) && this.$nextTick(callback);
				}
			}
		}],
		data() {
			return {
				provinces: getProvinces(),
				citys: getMyCity(index[0]),
				areas: getAreas(index[0], index[1]),
				value: [0, 0, 0]
			};
		},

		components: {},
		props: {
			// 省
			province: {
				//控制area_select显示隐藏
				type: String,
				default: ''
			},
			// 市
			city: {
				//控制area_select显示隐藏
				type: String,
				default: ''
			},
			// 区
			area: {
				//控制area_select显示隐藏
				type: String,
				default: ''
			},

			show: {
				//控制area_select显示隐藏
				type: Boolean,
				default: false
			},
			maskShow: {
				//是否显示蒙层
				type: Boolean,
				default: true
			}
		},
		watch: {
			province() {
				this.init();
			},
			city() {
				this.init();
			},
			area() {
				this.init();
			}
		},
		mounted() {
			// let provinceIndex = this.provinces.indexOf(this.province);
			// this.citys = getMyCity(provinceIndex);
			// let cityIndex = this.citys.indexOf(this.city);
			// this.areas = getAreas(provinceIndex, cityIndex);
			// let areaIndex = this.areas.indexOf(this.area);

			// // 设置选择序列
			// this.value = [provinceIndex, cityIndex, areaIndex];
			// let areaCode = getAreasCode(provinceIndex, cityIndex, areaIndex);
			
			this.init();
			
			//console.log(areaCode)
			//console.log("this.value = " + JSON.stringify(this.value));
		},
		methods: {
			init() {
				//console.log(this.area)
				let provinceIndex = this.provinces.indexOf(this.province);
				this.citys = getMyCity(provinceIndex);
				let cityIndex = this.citys.indexOf(this.city);
				this.areas = getAreas(provinceIndex, cityIndex);
				let areaIndex = this.areas.indexOf(this.area);
				
				// 设置选择序列
				this.value = [provinceIndex, cityIndex, areaIndex];
				let areaCode = getAreasCode(provinceIndex, cityIndex, areaIndex);
			},
			handleNYZAreaChange: function(e) {
				var that = this;
				//console.log("e:" + JSON.stringify(e));
				var value = e.detail.value;
				/**
				 * 滚动的是省
				 * 省改变 市、区都不变
				 */

				if (index[0] != value[0]) {
					index = [value[0], 0, 0];
					let selectCitys = getMyCity(index[0]);
					let selectAreas = getAreas(index[0], 0);
					that.setData({
						citys: selectCitys,
						areas: selectAreas,
						value: [index[0], 0, 0],

					});

					let areaCode = getAreasCode(index[0], index[1], index[2]);
					that.$emit("changeClick", provinces[index[0]], selectCitys[index[1]], selectAreas[index[2]],areaCode);

				} else if (index[1] != value[1]) {
					/**
					 * 市改变了 省不变 区变
					 */
					index = [value[0], value[1], 0];
					let selectCitys = getMyCity(index[0]);
					let selectAreas = getAreas(index[0], value[1]);
					that.setData({
						citys: selectCitys,
						areas: selectAreas,
						value: [index[0], index[1], 0],

					});

					let areaCode = getAreasCode(index[0], index[1], index[2]);
					that.$emit("changeClick", provinces[index[0]], selectCitys[index[1]], selectAreas[index[2]],areaCode);

				} else if (index[2] != value[2]) {
					/**
					 * 区改变了
					 */
					index = [value[0], value[1], value[2]];
					let selectCitys = getMyCity(index[0]);
					let selectAreas = getAreas(index[0], value[1]);
					that.setData({
						citys: selectCitys,
						areas: selectAreas,
						value: [index[0], index[1], index[2]],

					});
					
					let areaCode = getAreasCode(index[0], index[1], index[2]);
					that.$emit("changeClick", provinces[index[0]], selectCitys[index[1]], selectAreas[index[2]],areaCode);
				}
			},

			/**
			 * 确定按钮的点击事件
			 */
			handleNYZAreaSelect: function(e) {
				var myEventDetail = e; // detail对象，提供给事件监听函数
				var myEventOption = {}; // 触发事件的选项
				this.$emit('sureSelectArea', {
					detail: myEventDetail
				}, myEventOption);

				index = [0, 0, 0];
			},

			/**
			 * 取消按钮的点击事件
			 */
			handleNYZAreaCancle: function(e) {
				var that = this;
				//console.log("e:" + JSON.stringify(e));
				this.$emit('hideShow', {
					detail: false
				});
				// 复原初始状态
				index = [0, 0, 0];
			}
		}
	};
</script>
<style scoped lang="scss">
	.cc_area_view {
		width: 100%;
		position: fixed;
		bottom: -1000px;
		left: 0px;
		background-color: #fff;
		z-index: 21;
		transition: all 0.3s;
	}

	.cc_area_pick_view {
		height: 400px;
		width: 100%;

	}

	.cc_area_colum_view {
		line-height: 35px;
		text-align: center;
		font-size: 28upx;
	}

	.hide {
		bottom: -1000upx;
		transition: all 0.3s;
	}

	.show {
		bottom: 0upx;
		transition: all 0.3s;
	}

	.cc_area_view_btns {
		background-color: #fff;
		border-bottom: 1px solid #eeeeee;
		font-size: 30upx;
		padding: 18upx 0upx;
	}

	.cc_area_view_btns>text {
		display: inline-block;
		word-spacing: 4upx;
		letter-spacing: 4upx;
	}

	.cc_area_view_btn_cancle {
		color: #939393;
		padding-right: 20upx;
		padding-left: 25upx;
	}

	.cc_area_view_btn_sure {
		float: right;
		padding-left: 20upx;
		padding-right: 25upx;
	}

	.cc_area_mask {
		width: 100%;
		height: 100vh;
		background-color: rgba(28, 28, 28, 0.6);
		position: absolute;
		top: 0upx;
		left: 0upx;
		z-index: 20;
	}
</style>