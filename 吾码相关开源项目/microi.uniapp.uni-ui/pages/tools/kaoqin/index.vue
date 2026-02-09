<template>
	<view class="kaoqin-container">
		<!-- 打卡卡片 -->
		<view class="clock-card">
			<!-- 当前时间和日期 -->
			<view class="time-section">
				<view class="current-time">{{ currentTime }}</view>
				<view class="date-info">
					<text class="weekday">星期{{ weekday }}</text>
					<text class="date">{{ currentDate }}</text>
				</view>
			</view>

			<!-- 考勤类型选择 -->
			<view class="attendance-type">
				<text class="type-label">考勤类型：</text>
				<view style="position: relative;">
					<view class="type-selector" @click="showTypeSelector">
						<text>{{ selectedType }}</text>
						<uni-icons type="down" size="20" color="#4179F7"></uni-icons>
					</view>

					<!-- 类型选择下拉菜单 -->
					<transition name="dropdown">
						<view class="type-dropdown" v-if="typeSelectorVisible">
							<view class="dropdown-item" v-for="(type, index) in attendanceTypes" :key="index"
								@click="selectType(type.name)">
								{{ type.name }}
							</view>
						</view>
					</transition>
				</view>

			</view>

			<!-- 打卡时间线 -->
			<view class="clock-timeline">
				<radio-group @change="onRadioChange">
					<!-- 上班打卡 -->
					<view class="relative clock-item-container">
						<view class="clock-item" @click="selectRadio('morning')">
							<view class="clock-icon">
								<image src="./images/shangban.png" class="icon-image"></image>
							</view>
							<view class="clock-time">{{ clockRules?.morning?.time || '09:00' }}</view>
							<view class="clock-status" :class="morningStatus.class">{{ morningStatus.text }}</view>
							<view style="flex: 1;"></view> <!-- 添加空白区域，将单选按钮推到最右边 -->
							<label class="radio" @click.stop>
								<radio value="morning" :checked="selectedClockType === 'morning'" color="#3B77FE" />
							</label>
						</view>

						<!-- 时间线 -->
						<view class="timeline-line"></view>

						<!-- 打卡详情 -->
						<view class="clock-details">
							<view class="detail-section">
								<view class="detail-title">上班打卡</view>
								<view v-if="morningClockTime" class="detail-time">
									<template v-if="isLate">迟到打卡</template>
									<template v-else>正常打卡</template>
									<text class="highlight-time">{{ morningClockTime }}</text>
								</view>
								<view class="detail-time" v-else-if="isInClockRange && selectedClockType === 'morning'">您已进入打卡范围</view>
								<view class="detail-time error-text" v-else-if="selectedClockType === 'morning' && !isInClockRange">您当前不在打卡范围内，请移动到指定位置</view>
							</view>
						</view>
					</view>


					<!-- 下班打卡 -->
					<view>
						<view class="clock-item" @click="selectRadio('evening')">
							<view class="clock-icon">
								<image src="./images/xiaban.png" class="icon-image"></image>
							</view>
							<view class="clock-time">{{ clockRules?.evening?.time || '18:00' }}</view>
							<view class="clock-status" :class="eveningStatus.class">{{ eveningStatus.text }}</view>
							<view style="flex: 1;"></view> <!-- 添加空白区域，将单选按钮推到最右边 -->
							<label class="radio" @click.stop>
								<radio value="evening" :checked="selectedClockType === 'evening'" color="#3B77FE" />
							</label>
						</view>

						<!-- 打卡详情 -->
						<view class="clock-details">
							<view class="detail-section">
								<view class="detail-title">下班打卡</view>
								<view class="detail-time" v-if="isInClockRange && selectedClockType === 'evening' && !eveningStatus.checked">您已进入打卡范围</view>
								<view class="detail-time error-text" v-else-if="selectedClockType === 'evening' && !isInClockRange && !eveningStatus.checked">您当前不在打卡范围内，请移动到指定位置</view>
							</view>
						</view>
					</view>
				</radio-group>
			</view>
			<template v-if="showExtraFields">
				<!-- 客户名称 - 只在非上下班考勤和非值班考勤时显示 -->
				<view class="extra-field-item customer-info">
					<view class="info-label">客户名称：</view>
					<view class="field-content">
						<zxz-uni-data-select 
							v-model="selectedCustomerId"
							:localdata="customerList"
							dataValue="Id"
							dataKey="KehuMC"
							:placeholder="'请选择客户名称'"
							filterable
							@change="handleCustomerChange"
							class="customer-select"
						></zxz-uni-data-select>
					</view>
				</view>

				<!-- 拍照 - 只在非上下班考勤和非值班考勤时显示 -->
				<view class="extra-field-item photo-section">
					<view class="info-label">拍照：</view>
					<view class="field-content photo-container">
						<!-- 已上传的照片 -->
						<view class="photo-item" v-for="(photo, index) in photoList" :key="index">
							<image :src="photo.url" mode="aspectFill" class="photo-image"></image>
							<view class="delete-icon" @click="deletePhoto(index)">
								<text class="delete-text">×</text>
							</view>
						</view>
						
						<!-- 上传按钮 -->
						<view class="photo-upload" @click="choosePhoto" v-if="photoList.length < maxPhotos">
							<text class="upload-icon">+</text>
							<!-- <text class="upload-text">上传图片或视频</text> -->
						</view>
					</view>
				</view>
			</template>
			<!-- 位置信息 -->
			<view class="location-info" v-if="locationText && locationText.address">
				<view class="location-icon">
					<image src="./images/dzhi.png" class="icon-image"></image>
				</view>
				<view class="location-text">{{ locationText.address }}</view>
				<view class="location-refresh" @click="refreshLocation">
					<image src="./images/shuaxin.png" class="icon-image"></image>
				</view>
			</view>
			

			<!-- 打卡按钮 -->
			<view class="clock-button-container">
				<button class="clock-button" :disabled="isSubmitting" @click="clockIn">
					<text v-if="!isSubmitting">{{ clockButtonText }}</text>
					<text v-else>提交中...</text>
				</button>
			</view>
			
		</view>
		<!-- 底部提示 -->
		<view class="bottom-tips">
			<text>{{ hasRules ? '已设置打卡规则' : '未设置打卡规则' }}</text>
			<text class="link-text" @click="contactAdmin" v-if="!hasRules">联系管理员</text>
		</view>
		<view class="location-tips">
			若位置信息不准确，请点击位置旁边的刷新按钮
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue';
import { getClockRules, getTodayClockRecords, submitClockRecord } from './services/kaoqinService';
import { getLocation, uploadFile } from '@/utils';
import { 
    getCurrentTime, 
    getCurrentDate, 
    getCurrentWeekday, 
    calculateDistance, 
    formatDateWithHyphens, 
    updateTimeAndDate,
    isLate as isLateUtil,
    getClockInStatus,
    formatLocationInfo,
    getLocationFromCustomer,
    findNearestTargetLocation
} from './utils/kaoqinUtils';

// 注入Microi实例
const Microi = inject('Microi');
const V8 = inject('V8');

// 打卡规则
const clockRules = ref(null);
const isLoading = ref(false);
const hasRules = computed(() => clockRules.value !== null);

// 打卡记录
const todayClockRecords = ref({
    morning: null,
    evening: null
});

// 当前时间和日期
const currentTime = ref('14:57:07');
const currentDate = ref('2025.03.05');
const weekday = ref('三');

// 考勤类型
const selectedType = ref('上下班考勤');
const typeSelectorVisible = ref(false);
const attendanceTypes = ref([
	{ name: '上下班考勤' },
	{ name: '销售外出考勤' },
	{ name: '服务外出考勤', isSubItem: true },
	{ name: '实施考勤', isSubItem: true },
	{ name: '出差考勤', isSubItem: true },
	{ name: '值班考勤', isSubItem: true },
]);

// 是否需要显示客户和照片字段
const showExtraFields = computed(() => {
    return selectedType.value !== '上下班考勤' && selectedType.value !== '值班考勤';
});

// 客户名称
const customerName = ref('');
const customerNameVisible = ref(false);
const selectedCustomerId = ref('');
const selectedCustomerInfo = ref(null); // 新增：保存选中客户的完整信息
const customerList = ref([]);

// 照片
const photoList = ref([]);
const maxPhotos = 1;

// 打卡状态
const morningStatus = ref({
	text: '未打卡',
	class: 'status-pending',
	checked: false
});
const eveningStatus = ref({
	text: '未打卡',
	class: 'status-pending',
	checked: false
});

// 打卡时间
const morningClockTime = ref('');
const eveningClockInRange = ref(true);

// 位置信息
const locationText = ref({});
const isInClockRange = ref(false); // 是否在打卡范围内

// 打卡按钮文本
const clockButtonText = ref('下班打卡');

// 添加loading状态
const isSubmitting = ref(false);

// 是否可以打卡
const canClockIn = ref(false); // 默认不可打卡，需要检查位置

// 选中的打卡类型
const selectedClockType = ref('');

// 是否迟到
const isLate = computed(() => {
    if (!morningClockTime.value || !clockRules.value) return false;
    
    // 使用工具函数判断是否迟到
    return isLateUtil(clockRules.value.morning.time, morningClockTime.value);
});

// 定时器
let timer = null;

// 获取今日打卡记录
const fetchTodayClockRecords = async () => {
    try {
        const res = await getTodayClockRecords();
        if (res.code === 0) {
            todayClockRecords.value = res.data;
            
            // 更新上下班打卡状态
            updateClockStatusFromRecords();
        } else {
            console.error('获取今日打卡记录失败:', res.message);
        }
    } catch (error) {
        console.error('获取今日打卡记录出错:', error);
    }
};

// 根据打卡记录更新状态
const updateClockStatusFromRecords = () => {
	console.log('更新打卡状态:', todayClockRecords.value);
    // 更新上班打卡状态
    if (todayClockRecords.value.morning) {
        morningStatus.value = {
            text: '已打卡',
            class: 'status-done',
            checked: true
        };
        morningClockTime.value = todayClockRecords.value.morning.time;
    }
    
    // 更新下班打卡状态
    if (todayClockRecords.value.evening) {
        eveningStatus.value = {
            text: '已打卡',
            class: 'status-done',
            checked: true
        };
    }
    
    // 根据打卡状态更新默认选中的类型
    if (!morningStatus.value.checked && !eveningStatus.value.checked) {
        // 如果今天还没打卡，默认选中上班打卡
        selectedClockType.value = 'morning';
        clockButtonText.value = '上班打卡';
    } else if (morningStatus.value.checked && !eveningStatus.value.checked) {
        // 如果只打了上班卡，默认选中下班打卡
        selectedClockType.value = 'evening';
        clockButtonText.value = '下班打卡';
    }
};

// 获取打卡规则
const fetchClockRules = async () => {
	isLoading.value = true;
	try {
		const res = await getClockRules();
		if (res.code === 0 && res.data) {
			clockRules.value = res.data;
			console.log('获取打卡规则成功:', clockRules.value);
			
			// 更新UI显示
			updateUIWithRules();
		} else {
			console.error('获取打卡规则失败:', res.message);
			uni.showToast({
				title: res.message || '获取打卡规则失败',
				icon: 'none'
			});
		}
	} catch (error) {
		console.error('获取打卡规则出错:', error);
		uni.showToast({
			title: '获取打卡规则出错，请稍后再试',
			icon: 'none'
		});
	} finally {
		isLoading.value = false;
	}
};

// 根据规则更新UI
const updateUIWithRules = async () => {
	if (!clockRules.value) return;
	
	// 更新上下班时间显示（这部分保留）
	const morningTime = clockRules.value.morning.time;
	const eveningTime = clockRules.value.evening.time;
    
    // 获取位置并检查是否在打卡范围内
	try {
		const locationData = await getLocation();
		console.log('获取位置成功:', locationData);
		
		// 使用工具函数格式化位置信息
		locationText.value = formatLocationInfo(locationData);
		
		// 检查是否在打卡范围内
		checkLocationInRange();
		
		// 如果需要显示客户数据，则获取附近客户数据
		if (showExtraFields.value) {
			fetchCustomerList(locationData);
		}
	} catch (error) {
		console.error('获取位置失败:', error);
		uni.showToast({
			title: '获取位置失败，请检查定位权限',
			icon: 'none'
		});
	}
};

// 根据考勤类型计算距离并检查是否在范围内
const calculateDistanceByAttendanceType = () => {
    // 获取当前位置
    if (!locationText.value || !locationText.value.latitude || !locationText.value.longitude) {
        console.error('当前位置信息不完整');
        return {
            inRange: false,
            distance: Infinity,
            targetLocation: null,
            targetRadius: 500
        };
    }
    
    const currentLocation = {
        latitude: locationText.value.latitude,
        longitude: locationText.value.longitude
    };
    
    // 根据考勤类型选择目标位置
    if (selectedType.value === '上下班考勤' || selectedType.value === '值班考勤') {
        // 使用打卡规则中的位置
        if (clockRules.value && clockRules.value.locations && clockRules.value.locations.length > 0) {
            // 使用工具函数找出最近的位置
            return findNearestTargetLocation(currentLocation, clockRules.value.locations);
        } else {
            console.warn('打卡规则中没有位置信息');
            return {
                inRange: false,
                distance: Infinity,
                targetLocation: null,
                targetRadius: 500
            };
        }
    } else {
        // 使用选中客户的位置
        let customerLocation = null;
        
        // 优先使用selectedCustomerInfo中的数据
        if (selectedCustomerInfo.value) {
            customerLocation = getLocationFromCustomer(selectedCustomerInfo.value);
        }
        
        // 如果没有找到位置信息，尝试从customerList中查找
        if (!customerLocation && selectedCustomerId.value && customerList.value && customerList.value.length > 0) {
            const selectedCustomer = customerList.value.find(customer => customer.Id === selectedCustomerId.value);
            if (selectedCustomer) {
                customerLocation = getLocationFromCustomer(selectedCustomer);
            }
        }
        
        if (customerLocation) {
            // 这里我们只有一个客户位置，所以直接计算距离
            const distance = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                customerLocation.latitude,
                customerLocation.longitude
            );
            
            return {
                inRange: distance <= customerLocation.radius,
                distance: distance,
                targetLocation: customerLocation,
                targetRadius: customerLocation.radius
            };
        } else {
            console.warn('未找到有效的客户位置信息');
            return {
                inRange: false,
                distance: Infinity,
                targetLocation: null,
                targetRadius: 500
            };
        }
    }
};

// 检查当前位置是否在打卡范围内
const checkLocationInRange = () => {
    // 基本检查：如果没有位置信息或打卡规则，则直接返回不在范围内
    if (!locationText.value || !locationText.value.latitude || !locationText.value.longitude) {
        isInClockRange.value = false;
        canClockIn.value = false;
        console.log('位置检查：没有有效的位置信息');
        return;
    }

    // 使用新方法计算距离并检查是否在范围内
    const result = calculateDistanceByAttendanceType();
    
    // 更新状态
    isInClockRange.value = result.inRange;
    canClockIn.value = result.inRange;
    
    // 日志输出，帮助调试
    if (result.targetLocation) {
        console.log(
            '位置检查结果:',
            result.inRange ? '✓ 在打卡范围内' : '✗ 不在打卡范围内',
            '| 距离:', Math.round(result.distance), '米',
            '| 目标:', result.targetLocation.name || '未命名位置',
            '| 允许范围:', result.targetRadius, '米'
        );
    } else {
        console.log(
            '位置检查结果:', 
            result.inRange ? '✓ 在打卡范围内' : '✗ 不在打卡范围内', 
            '| 无有效目标位置'
        );
    }
};

// 更新当前时间
const updateCurrentTime = () => {
    // 使用单独的工具函数获取时间、日期和星期
    currentTime.value = getCurrentTime();
    currentDate.value = getCurrentDate();
    weekday.value = getCurrentWeekday();

    // 根据时间更新打卡状态
    updateClockStatus(new Date());
};

// 更新打卡状态
const updateClockStatus = (now) => {
	const hours = now.getHours();
	const minutes = now.getMinutes();
	const currentMinutes = hours * 60 + minutes;

	// 如果有打卡规则，使用规则中的时间
	let morningClockMinutes = 9 * 60; // 默认上班时间 9:00
	let eveningClockMinutes = 18 * 60; // 默认下班时间 18:00
	let rangeMinutes = 30; // 默认打卡范围30分钟
	
	if (clockRules.value) {
		const morningTime = clockRules.value.morning.time.split(':');
		const eveningTime = clockRules.value.evening.time.split(':');
		
		morningClockMinutes = parseInt(morningTime[0]) * 60 + parseInt(morningTime[1]);
		eveningClockMinutes = parseInt(eveningTime[0]) * 60 + parseInt(eveningTime[1]);
		rangeMinutes = clockRules.value.morning.rangeMinutes;
	}

	// 判断是否在下班打卡范围内
	if (currentMinutes >= eveningClockMinutes - rangeMinutes) {
		eveningClockInRange.value = true;

		// 如果在下班打卡时间范围内且未选择打卡类型，默认选择下班打卡
		if (!selectedClockType.value && !eveningStatus.value.checked) {
			selectedClockType.value = 'evening';
			clockButtonText.value = '下班打卡';
		}
	} else {
		eveningClockInRange.value = false;

		// 如果在上班打卡时间范围内且未选择打卡类型，默认选择上班打卡
		if (!selectedClockType.value && !morningStatus.value.checked &&
			currentMinutes >= morningClockMinutes - rangeMinutes && currentMinutes <= morningClockMinutes + rangeMinutes) {
			selectedClockType.value = 'morning';
			clockButtonText.value = '上班打卡';
		}
	}

	// 根据选择的打卡类型更新按钮文本
	if (selectedClockType.value === 'morning') {
		clockButtonText.value = '上班打卡';
	} else if (selectedClockType.value === 'evening') {
		clockButtonText.value = '下班打卡';
	}
};

// 显示考勤类型选择器
const showTypeSelector = () => {
	typeSelectorVisible.value = !typeSelectorVisible.value;
};

// 选择考勤类型
const selectType = (type) => {
	selectedType.value = type;
	typeSelectorVisible.value = false;
	
	// 如果切换到不需要额外字段的类型，清空相关数据
	if (type === '上下班考勤' || type === '值班考勤') {
		customerName.value = '';
		photoList.value = [];
		selectedCustomerId.value = '';
	} else {
		// 如果切换到需要显示客户的类型，获取客户数据
		fetchCustomerList();
	}
};

// 处理单选按钮变化
const onRadioChange = (e) => {
	selectClockType(e.detail.value);
};

// 选择打卡类型
const selectClockType = (type) => {
	selectedClockType.value = type;
	
	// 更新按钮文本
	if (type === 'morning') {
		clockButtonText.value = '上班打卡';
	} else if (type === 'evening') {
		clockButtonText.value = '下班打卡';
	}
};

// 点击行选择单选按钮
const selectRadio = (value) => {
	selectedClockType.value = value;
	selectClockType(value);
};

// 刷新位置
const refreshLocation = async () => {
	uni.showLoading({
		title: '获取位置中...'
	});
	
	const locationData = await getLocation();
	
	// 使用工具函数格式化位置信息
	locationText.value = formatLocationInfo(locationData);
	
    // 刷新位置后重新检查是否在打卡范围内
    checkLocationInRange();
	uni.hideLoading();
};

// 打卡
const clockIn = async () => {
    // 防重提交检查
    if (isSubmitting.value) {
        return;
    }
    
    // 设置提交状态
    isSubmitting.value = true;
    
    // 首先检查是否有有效的位置信息
    if (!locationText.value || !locationText.value.latitude || !locationText.value.longitude) {
        // 如果没有位置信息，显示提示并自动获取位置
        uni.showLoading({
            title: '正在获取位置信息...'
        });
        
        try {
            // 重新获取位置信息
            const locationData = await getLocation();
            
            // 更新位置信息
            locationText.value = formatLocationInfo(locationData);
            
            // 检查是否在打卡范围内
            checkLocationInRange();
            
            uni.hideLoading();
            
            // 如果仍然没有位置信息，提示用户
            if (!locationText.value || !locationText.value.latitude || !locationText.value.longitude) {
                uni.showToast({
                    title: '获取位置信息失败，请检查定位权限',
                    icon: 'none'
                });
                isSubmitting.value = false;
                return;
            }
        } catch (error) {
            uni.hideLoading();
            uni.showToast({
                title: '获取位置信息失败，请检查定位权限',
                icon: 'none'
            });
            console.error('自动获取位置失败:', error);
            isSubmitting.value = false;
            return;
        }
    }
    
    // 检查是否已经打卡
    if (selectedClockType.value === 'morning' && morningStatus.value.checked) {
        uni.showToast({
            title: '您今日已完成上班打卡',
            icon: 'none'
        });
        isSubmitting.value = false;
        return;
    }

    // 使用calculateDistanceByAttendanceType方法获取最新的距离计算结果
    const distanceResult = calculateDistanceByAttendanceType();
    const distance = distanceResult.distance ? Math.round(distanceResult.distance) : 0;
    const targetRadius = distanceResult.targetRadius || 500;
    
    // 使用工具函数获取打卡状态
    const statusResult = getClockInStatus(distance, targetRadius);
    const dakaStatus = statusResult.status;
    
    // 使用工具函数格式化日期为 YYYY-MM-DD
    const formattedDate = formatDateWithHyphens(currentDate.value);
    const dakaId = V8.NewGuid();
    const obj = {
        DakaLX: selectedClockType.value == 'morning' ? '签到' : '签退',
        Paizhao: photoList.value,
        DakaDD: locationText.value.address || locationText.value.adddress,
        Jingweidu: locationText.value.latitude + ',' + locationText.value.longitude,
        KaoqinLX: selectedType.value,
        KehuMC: customerName.value,
        DKD_Jingdu: distance + '米', // 打卡距离
        DakaRQ: formattedDate, // 打卡日期，格式化为 YYYY-MM-DD
        DakaZT: dakaStatus, // 打卡状态
        DakaSJ: formattedDate + ' ' + currentTime.value, // 当前时间，年月日时分秒
        KaoqinD: showExtraFields.value ? '' : '汇鼎大厦',
        DakaFW: targetRadius + '米',
        Id: dakaId,
        DakaId: dakaId
    }
    console.log('打卡提交数据:', obj);
    
    // 检查是否选择了打卡类型
    if (!selectedClockType.value) {
        uni.showToast({
            title: '请选择打卡类型',
            icon: 'none'
        });
        isSubmitting.value = false;
        return;
    }
    
    // 检查是否在打卡范围内
    if (!isInClockRange.value) {
        uni.showToast({
            title: '您不在打卡范围内，请移动到指定位置',
            icon: 'none'
        });
        isSubmitting.value = false;
        return;
    }
    
    if (showExtraFields.value) {
        // 检查是否选择了客户
        if (!selectedCustomerId.value) {
            uni.showToast({
                title: '请选择客户',
                icon: 'none'
            });  
            isSubmitting.value = false;
            return;
        }
        
        // 检查是否选择了照片
        if (photoList.value.length === 0) {
            uni.showToast({
                title: '请上传照片',
                icon: 'none'
            });
            isSubmitting.value = false;
            return;
        }
    }

    // 显示加载提示
    uni.showLoading({
        title: '提交打卡中...'
    });
    
    try {
        // 调用打卡服务提交打卡记录
        const result = await submitClockRecord(obj);
        
        if (result.code === 0) {
            // 打卡成功，更新UI状态
            if (selectedClockType.value === 'morning') {
                morningStatus.value = {
                    text: '已打卡',
                    class: 'status-done',
                    checked: true
                };
                morningClockTime.value = currentTime.value;
            } else if (selectedClockType.value === 'evening') {
                eveningStatus.value = {
                    text: '已打卡',
                    class: 'status-done',
                    checked: true
                };
            }
            
            // 刷新打卡记录
            fetchTodayClockRecords();
            
            // 显示成功提示
            uni.showToast({
                title: selectedClockType.value === 'morning' ? '上班打卡成功' : '下班打卡成功',
                icon: 'success'
            });
            
            // 延迟一秒后跳转到打卡明细列表页面
            setTimeout(() => {
                // 注意：请根据实际项目中的打卡明细列表页面路径进行调整
                uni.redirectTo({
                    url: '/pages/workbench/work-list/index?MenuId=38bc3af8-1216-4118-a405-d48d386e9bbe&MenuName=在线打卡' // 可能的打卡记录列表页面路径，请根据实际情况修改
                });
            }, 1000);
        } else {
            // 打卡失败
            uni.showToast({
                title: result.message || '打卡失败',
                icon: 'none'
            });
        }
    } catch (error) {
        console.error('打卡提交错误:', error);
        uni.showToast({
            title: error.message || '打卡失败',
            icon: 'none'
        });
    } finally {
        uni.hideLoading();
        isSubmitting.value = false;
    }
};

// 联系管理员
const contactAdmin = () => {
	uni.showToast({
		title: '请联系人事部门设置打卡规则',
		icon: 'none'
	});
};

// 选择客户
const showCustomerSelector = () => {
    customerNameVisible.value = !customerNameVisible.value;
};

// 选择客户名称
const selectCustomer = (customer) => {
    customerName.value = customer.name;
    customerNameVisible.value = false;
};

// 处理客户选择变化
const handleCustomerChange = (value) => {
    console.log('选中客户数据:', value);
    if (value) {
        // 保存客户名称
        customerName.value = value.KehuMC;
        
        // 保存选中客户的完整信息
        selectedCustomerInfo.value = value;
        
        // 客户变更后重新检查位置
        checkLocationInRange();
    } else {
        customerName.value = '';
        selectedCustomerInfo.value = null;
    }
};

// 上传照片
const choosePhoto = () => {
    if (photoList.value.length >= maxPhotos) {
        uni.showToast({
            title: '最多只能上传1张照片',
            icon: 'none'
        });
        return;
    }
    
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['camera', 'album'],
        success: async (res) => {
            // 显示加载提示
            uni.showLoading({
                title: '上传照片中...'
            });
            
            try {
                // 使用uploadFile接口上传照片
                const uploadResult = await uploadFile(res.tempFilePaths, { Component: 'ImgUpload' });
                
                if (uploadResult.Code == 1) {
                    // 如果上传成功，将返回的数据加入照片列表
                    if (photoList.value && photoList.value.length > 0) {
                        photoList.value = [...photoList.value, ...uploadResult.Data];
                    } else {
                        photoList.value = uploadResult.Data;
                    }
                    
                    uni.showToast({
                        title: '照片上传成功',
                        icon: 'success'
                    });
                } else {
                    // 上传失败
                    uni.showToast({
                        title: uploadResult.Msg || '照片上传失败',
                        icon: 'none'
                    });
                    console.error('照片上传失败:', uploadResult);
                }
            } catch (error) {
                uni.showToast({
                    title: '照片上传错误',
                    icon: 'none'
                });
                console.error('照片上传错误:', error);
            } finally {
                uni.hideLoading();
            }
        }
    });
};

// 删除照片
const deletePhoto = (index) => {
    photoList.value.splice(index, 1);
};

// 新增：获取附近客户数据
const fetchCustomerList = async (locationData) => {
    try {
        // 如果没有传入位置数据，则获取当前位置
        if (!locationData) {
            locationData = await getLocation();
        }
        
        // 默认搜索半径（公里）
        const searchRadius = 5;
        // 调用API获取附近客户
        const res = await Microi.ApiEngine.Run('get_location_kehu', {
            Latitude: locationData.latitude, //"29.802374"
            Longitude: locationData.longitude,//"121.550192",
            Km: searchRadius,
            Type: Microi.GetCurrentUser()?.RoleIds
        });
        
        // 处理API返回结果
        if (res && res.Code === 1) {
            // 转换为下拉框所需的格式
            customerList.value = res.Data
        } else {
            // 如果API调用失败或返回空数据，可以选择保留默认数据或清空
            console.error('获取客户数据失败:', res?.Msg || '未知错误');
            uni.showToast({
                title: '获取客户数据失败',
                icon: 'none'
            });
        }
    } catch (error) {
        console.error('获取客户数据出错:', error);
        uni.showToast({
            title: '获取客户数据出错，请稍后再试',
            icon: 'none'
        });
    }
};

// 组件挂载时
onMounted(() => {
	// 立即更新一次时间
	updateCurrentTime();

	// 设置定时器，每秒更新一次时间
	timer = setInterval(updateCurrentTime, 1000);
	
	// 获取打卡规则
	fetchClockRules();
    
    // 获取今日打卡记录
    fetchTodayClockRecords();
});

// 组件卸载时
onUnmounted(() => {
	// 清除定时器
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
});
</script>

<style lang="scss" scoped>
.kaoqin-container {
	min-height: 100vh;
	background-color: #f5f5f5;
	background-image: url('./images/bg.jpg');
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	position: relative;
	border-top: 1px solid transparent;
	/* 或者使用 padding */
	box-sizing: border-box;
}

/* 卡片内容需要在遮罩层之上 */
.clock-card {
	position: relative;
	z-index: 2;
	background-color: rgba(255, 255, 255, 0.9);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	border-radius: 20rpx;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
	padding: 40rpx;
	margin: 20px;
}

/* 导航栏样式 */
.nav-bar {
	display: flex;
	align-items: center;
	height: 90rpx;
	background-color: #4080ff;
	color: #fff;
	padding: 0 30rpx;
	position: relative;

	.back-icon {
		font-size: 40rpx;
		width: 60rpx;
	}

	.nav-title {
		flex: 1;
		text-align: center;
		font-size: 36rpx;
		font-weight: 500;
	}
}

/* 时间部分样式 */
.time-section {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 40rpx;

	.current-time {
		font-size: 64rpx;
		font-weight: bold;
		color: #00004F;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.date-info {
		display: flex;
		flex-direction: column;
		align-items: flex-end;

		.weekday {
			font-size: 32rpx;
			color: #999999;
			font-weight: 500;
			margin-bottom: 10rpx;
		}

		.date {
			font-size: 32rpx;
			color: #999999;
		}
	}
}

/* 考勤类型选择样式 */
.attendance-type {
	display: flex;
	align-items: center;
	margin-bottom: 40rpx;

	.type-label {
		font-size: 30rpx;
		color: #999999;
	}

	.type-selector {
		display: flex;
		align-items: center;
		background-color: #DAE5FF;
		padding: 5rpx 30rpx;
		border-radius: 50rpx;
		color: #4179F7;
		font-size: 26rpx;
		position: relative;
		font-weight: 800;
	}

	.type-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		background-color: #fff;
		border-radius: 28rpx;
		box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
		padding: 10rpx 0;
		z-index: 100;
		margin-top: 10rpx;
		border: 2rpx solid #4179F7;
		width: 221rpx;
		.dropdown-item {
			padding: 20rpx;
			font-size: 26rpx;
			color: #333333;
			text-align: left;
			transition: background-color 0.2s;
			font-weight: 800;

			&:active {
				background-color: #f0f0f0;
			}

			&.sub-item {
				color: #666;
				font-size: 26rpx;
				border-top: 1px solid #f0f0f0;
			}
		}
	}
}

/* 打卡时间线样式 */
.clock-timeline {
	position: relative;
	background-color: rgba(255, 255, 255, 0.6);
	border-radius: 15rpx;
	padding: 20rpx;
	display: flex;
	flex-direction: column;

	.timeline-line {
		position: absolute;
		left: 25rpx;
		/* 精确对齐图标中心 */
		top: 70rpx;
		/* 从第一个图标中间开始 */
		width: 2rpx;
		height: calc(100% - 66rpx);
		/* 调整高度到第二个图标中间 */
		background: transparent;
		z-index: 1;
		border-left: 4rpx solid;
		border-image: linear-gradient(180deg, rgba(254, 141, 6, 1), rgba(115, 77, 242, 1)) 1;
	}
	.clock-item-container{
		min-height: 260rpx;
		margin-bottom: 20rpx;
	}
	.clock-item {
		display: flex;
		align-items: center;
		position: relative;
		margin-bottom: 20rpx;
		/* 减少间距，为详情留出空间 */
		z-index: 2;

		.clock-icon {
			width: 57rpx;
			height: 66rpx;
			display: flex;
			justify-content: center;
			align-items: center;
			position: relative;
			/* 确保图标位置固定 */
			z-index: 3;
			/* 确保图标在时间线上方 */

	
		}

		.clock-time {
			width: 120rpx;
			margin-left: 20rpx;
			font-size: 36rpx;
			font-weight: bold;
			color: #333;
		}

		.clock-status {
			width: 100rpx;
			padding: 4rpx 10rpx;
			border-radius: 10rpx;
			font-size: 24rpx;
			text-align: center;

			&.status-pending {
				background-color: #D9D9D9;
				color: #333333;
			}

			&.status-done {
				background-color: #DAE5FF;
				color: #4179F7;
			}
		}

		.radio {
			margin-right: 10rpx;
			display: flex;
			align-items: center;
			transform: scale(0.9); /* 稍微缩小一点 */
		}
	}

	.clock-details {
		padding-left: 80rpx;
		/* 与时间对齐 */
		margin-bottom: 40rpx;
		margin-top: -10rpx;
		/* 向上调整，使其更靠近时间 */

		.detail-section {
			display: flex;
			flex-direction: column;

			.detail-title {
				font-size: 28rpx;
				color: #666;
				margin-bottom: 4rpx;
			}

			.detail-time {
				font-size: 24rpx;
				color: #999;

				.highlight-time {
					color: #ff6b81;
					margin-left: 4rpx;
				}
			}
		}
	}
}

/* 位置信息样式 */
.location-info {
	display: flex;
	align-items: center;
	padding: 20rpx;
	border-radius: 15rpx;
	background-color: rgba(255, 255, 255, 0.6);
	margin-bottom: 40rpx;

	.location-icon {
		color: #4080ff;
		font-size: 36rpx;
		margin-right: 10rpx;
		min-width: 44rpx;
		height: 44rpx;
		flex-shrink: 0;
	}

	.location-text {
		font-size: 28rpx;
		color: #333;
		font-weight: 500;
		flex: 1;
		white-space: wrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0 10rpx;
	}

	.location-refresh {
		min-width: 44rpx;
		height: 44rpx;
		display: flex;
		justify-content: center;
		align-items: center;
		color: #666;
		font-size: 32rpx;
		margin-left: 10rpx;
		flex-shrink: 0;
	}
}

/* 通用额外字段样式 */
.extra-field-item {
	display: flex;
	padding: 20rpx;
	border-radius: 15rpx;
	background-color: rgba(255, 255, 255, 0.6);
}

.info-label {
	font-size: 30rpx;
	color: #333;
	margin-right: 20rpx;
	width: 180rpx; /* 增加固定宽度 */
	min-width: 180rpx; /* 增加最小宽度确保不收缩 */
	text-align: right; /* 添加文本右对齐，确保文字对齐 */
	white-space: nowrap; /* 防止文字换行 */
}

.field-content {
	width: 70%;
	position: relative;
}

/* 客户名称样式 */
.customer-info {
	align-items: center;
}

.customer-select {
	width: 100%;
	:deep(.uni-data-select) {
		width: 100%;
	}
	:deep(.uni-select--input) {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	:deep(.uni-select__label-text) {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: calc(100% - 30px);
	}
}

.customer-selector {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background-color: #F5F5F5;
	padding: 12rpx 20rpx;
	border-radius: 10rpx;
	color: #333;
	font-size: 28rpx;
	position: relative;
	width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* 照片上传样式 */
.photo-section {
	align-items: flex-start;
}

.photo-container {
	display: flex;
	flex-wrap: wrap;
}

.photo-item {
	width: 160rpx;
	height: 160rpx;
	margin-right: 20rpx;
	margin-bottom: 20rpx;
	position: relative;
	border-radius: 8rpx;
	overflow: hidden;
}

.photo-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.delete-icon {
	position: absolute;
	top: 0;
	right: 0;
	width: 40rpx;
	height: 40rpx;
	background-color: rgba(0, 0, 0, 0.5);
	display: flex;
	justify-content: center;
	align-items: center;
	border-bottom-left-radius: 8rpx;
}

.delete-text {
	color: #fff;
	font-size: 30rpx;
	line-height: 1;
}

.photo-upload {
	width: 160rpx;
	height: 160rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	background-color: #F5F5F5;
	border: 2rpx dashed #CCCCCC;
	border-radius: 8rpx;
}

.upload-icon {
	font-size: 48rpx;
	color: #999;
	line-height: 1;
	margin-bottom: 10rpx;
}

.upload-text {
	font-size: 24rpx;
	color: #999;
	text-align: center;
	padding: 0 10rpx;
}

/* 打卡按钮样式 */
.clock-button-container {
	margin: 40rpx 0;

	.clock-button {
		width: 60%;
		height: 90rpx;
		line-height: 90rpx;
		background: linear-gradient(135deg, #4080ff, #2463e8);
		color: #fff;
		font-size: 32rpx;
		font-weight: 500;
		border-radius: 45rpx;
		box-shadow: 0 6rpx 15rpx rgba(32, 96, 255, 0.3);

		&:disabled {
			background: linear-gradient(135deg, #cccccc, #999999);
			box-shadow: none;
		}
	}
}

/* 底部提示样式 */
.bottom-tips {
	text-align: center;
	font-size: 24rpx;
	color: #333333;
	padding: 10rpx;
	border-radius: 10rpx;
	margin-top: -20rpx;

	.link-text {
		color: #4080ff;
		margin-left: 10rpx;
		font-weight: 500;
	}
}

.location-tips {
	text-align: center;
	font-size: 24rpx;
	color: #333333;
	padding: 10rpx;
	border-radius: 10rpx;
}

/* 图标字体 */
.iconfont {
	font-family: "iconfont" !important;
	font-style: normal;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.icon-left:before {
	content: "\e6a5";
}

.icon-arrow-down:before {
	content: "\e665";
}

.icon-sun:before {
	content: "\e668";
}

.icon-moon:before {
	content: "\e62c";
}

.icon-location:before {
	content: "\e651";
}

.icon-refresh:before {
	content: "\e6a2";
}

.icon-check:before {
	content: "\e645";
}

.dropdown-enter-active {
	transition: all 0.3s ease-out;
}

.dropdown-leave-active {
	transition: all 0.2s ease-in;
}

.dropdown-enter-from,
.dropdown-leave-to {
	opacity: 0;
	transform: translateY(-20rpx);
}
image {
				width: 100%;
				height: 100%;
			}

.error-text {
    color: #ff4d4f !important;
    font-weight: 500;
}
</style>
