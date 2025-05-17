<template>
  <view class="page">
      <view class="container">
      <map 
        class="full-screen-map"
        id="map"
        :latitude="latitude" 
        :longitude="longitude" 
        :markers="markers" 
		:scale="15"
        :include-points="markers"
        :show-location="true"
        @markertap="markertap"
        ></map>
    </view>
    <!-- <view v-if="showPopup" class="popup">
      <view class="popup-content">
        <view>名称：{{ KehuModel.value.KehuMC }}</view>
        <view>税号：{{ KehuModel.value.Shuihao }}</view>
        <view>状态：{{ KehuModel.value.KehuZT }}</view>
        <view>类别：{{ KehuModel.value.CStatus }}</view>
        <view>
          <button size="mini" @click="GenJin">跟进</button>  <button size="mini" @click="showPopup = false">关闭</button>
        </view>
      </view>
    </view> -->
	<view class="popup uni-flex">
	    <view :class="caidan[0]" @click="select('',1)"><text>所有客户</text></view>
		<view :class="caidan[1]" @click="select('销售线索',2)"><text>销售线索</text></view>
		<view :class="caidan[2]" @click="select('正式客户',3)"><text>正式客户</text></view>
		<view :class="caidan[3]" @click="select('公海客户',4)"><text>公海客户</text></view>
	</view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Microi } from '../../../config/microi.uniapp';
import { getBrowserLocation } from '@/utils'

const showPopup = ref(false);
const refPopup = ref(null);
const markers = ref([]);
const maps = ref([]);
const userInfo = ref(Microi.GetCurrentUser()); // 用户信息
// const latitude = ref(39.9086920000)
const latitude = ref(29.802374)
// const longitude = ref(116.3974770000)
const longitude = ref(121.550192)
const KehuList = ref([]);
const caidan = ref([
	'uni-flex-item on',
	'uni-flex-item',
	'uni-flex-item',
	'uni-flex-item'
])
const KehuModel = reactive({});

onMounted(async () => {
	getCurrentLocation();
	// const res = await getBrowserLocation()
	// console.log(111,res)
});

async function getCurrentLocation() {
  try {
	 //  GetKehuList(5, '121.550192', '29.802374', function(result){
	 //  	if(Microi.CheckResult(result)){
	 //  		KehuList.value = result.Data;
	 //  		result.Data.forEach((item, index) => {
	 //  			markers.value.push({
	 //  				id: index,//item.Id,
	 //  				longitude: item.Dingwei_Lng,
	 //  				latitude: item.Dingwei_Lat,
	 //  				width: 50,
	 //  				height: 50,
	 //  				iconPath: '/static/img/tx_lianxiren.png',
	 //  				name: item.KehuMC
	 //  			});
	 //  		})
	 //  	}
		// markers.value.push({
		//     id: result.Data.length,
		//      longitude: '121.550192',
		//      latitude: '29.802374',
		//      width: 50,
		//      height: 50,
		//      iconPath: '/static/location.png',
		//      title: '我的位置',
		//      name: '我的位置',
		// });
	 //  });

		uni.getLocation({
		    type: 'gcj02',
		    geocode: true,
			isHighAccuracy: true,
			timeout: 1000 * 5,
			success(res) {
				longitude.value = res.longitude;
				latitude.value = res.latitude;
				GetData(res.longitude,res.latitude)
				//获取客户列表
				//Microi.Tips('获取我的位置成功：' + res.longitude + '-' +  res.latitude);
				// Microi.Tips('开始获取客户列表：' + res.longitude + '-' +  res.latitude, false, 5000);
				
			},
		    fail(err){
				Microi.Tips('获取当前位置失败：' + JSON.stringify(err), false, 5000);
				GetData(longitude.value,latitude.value)
			}
		})
  } catch (error) {
	  Microi.Tips('获取当前位置出现异常：' + JSON.stringify(error), false, 5000);
	  GetData(longitude.value,latitude.value)
  }
}
async function GetData(longitude,latitude){
	console.log('longitude')
	GetKehuList(50000, longitude, latitude, function(result){
		if(Microi.CheckResult(result)){
			KehuList.value = result.Data;
			result.Data.forEach((item, index) => {
				markers.value.push({
					id: index,//item.Id,
					longitude: Number(item.Dingwei_Lng),
					latitude: Number(item.Dingwei_Lat),
					width: 15,
					height: 20,
					iconPath: '/static/img/map.png',
					title: item.KehuMC,
					name: item.KehuMC,
					CStatus: item.CStatus,
					callout: {
					    content: item.KehuMC,
					    color: '#000',
					    fontSize: 12,
					    borderRadius: 2,
					    borderWidth: 0,
					    borderColor: '#333300',
					    bgColor: '#fff',
					    padding: '5',
					    display: 'ALWAYS',
					}
				});
			})
		}
		markers.value.push({
		    id: result.Data.length,
		     longitude: longitude,
		     latitude: latitude,
		     width: 50,
		     height: 50,
		     iconPath: '/static/location.png',
		     title: '我的位置'
		});
		maps.value = markers.value;
	});
}
async function GetKehuList(km, lng, lat, callback){
	Microi.ApiEngine.Run('get_location_kehu', {
		Km : km,
		Latitude : lat,
		Longitude : lng,
		Type : ''
	}, function(result){
		callback(result);
	})
}
function markertap(e) {
	if(e.detail.markerId == KehuList.value.length){
		return;
	}
	// KehuModel = KehuList.value.find(item => { return item.Id == e.detail.markerId });
	KehuModel.value = KehuList.value[e.detail.markerId];
	// refPopup.open('center')
	//showPopup.value = true;
}
function select(type,index){
	var newarr = [];
	if(type){
		maps.value.forEach(item=>{
		  if(item.CStatus == type){
		    newarr.push(item);
		  }
		});
		markers.value = newarr;
	}else{
		markers.value = maps.value;
	}
	if(index == 2){
		caidan.value = [
			'uni-flex-item',
			'uni-flex-item on',
			'uni-flex-item',
			'uni-flex-item'
		]
	}else if(index == 3){
		caidan.value = [
			'uni-flex-item',
			'uni-flex-item',
			'uni-flex-item on',
			'uni-flex-item'
		]
	}else if(index == 4){
		caidan.value = [
			'uni-flex-item',
			'uni-flex-item',
			'uni-flex-item',
			'uni-flex-item on'
		]
	}else{
		caidan.value = [
			'uni-flex-item on',
			'uni-flex-item',
			'uni-flex-item',
			'uni-flex-item'
		]
	}
}
async function GenJin(){
	
}
</script>

<style scoped>
.container {
  height: 100vh;
  width: 100vw;
  padding: 0;
  margin: 0;
}

.full-screen-map {
  width: 100%;
  height: 100%;
}

.page {
    position: relative;
    height: 100%;
}

.popup {
	font-size: 24rpx;
	line-height: 30px;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 120rpx;
	text-align: center;
	z-index: 9999;
	background-color: #25aff7;
	color:#fff;
}

.uni-flex-item{
	padding:25rpx 0;
    line-height: 50rpx;
	border-left: #fff 1rpx solid;
	border-bottom: #25aff7 20rpx solid;
}
.uni-flex-item:nth-child(1){
	border-left: 0;
}
.uni-flex-item.on{
	background-color: orange;
	border-bottom: orange 20rpx solid;
}
/*
::v-deep .amap-marker>.amap-icon>img{
	transform: scale(0.5);
}
*/
</style>