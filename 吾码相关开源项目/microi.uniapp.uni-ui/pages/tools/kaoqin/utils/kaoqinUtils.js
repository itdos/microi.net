/**
 * 考勤打卡工具类
 */

/**
 * 获取当前格式化时间 HH:MM:SS
 * @returns {string} 格式化后的时间字符串
 */
export function getCurrentTime() {
	const now = new Date();
	const hours = now.getHours().toString().padStart(2, '0');
	const minutes = now.getMinutes().toString().padStart(2, '0');
	const seconds = now.getSeconds().toString().padStart(2, '0');
	return `${hours}:${minutes}:${seconds}`;
}

/**
 * 获取当前格式化日期 YYYY.MM.DD
 * @returns {string} 格式化后的日期字符串
 */
export function getCurrentDate() {
	const now = new Date();
	const year = now.getFullYear();
	const month = (now.getMonth() + 1).toString().padStart(2, '0');
	const day = now.getDate().toString().padStart(2, '0');
	return `${year}.${month}.${day}`;
}

/**
 * 获取当前星期
 * @returns {string} 星期几（中文）
 */
export function getCurrentWeekday() {
	const now = new Date();
	const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
	return weekdays[now.getDay()];
}

/**
 * 判断当前时间是否在指定时间范围内
 * @param {number} targetHour - 目标小时
 * @param {number} targetMinute - 目标分钟
 * @param {number} rangeMinutes - 允许的范围分钟数
 * @returns {boolean} 是否在时间范围内
 */
export function isTimeInRange(targetHour, targetMinute, rangeMinutes = 30) {
	const now = new Date();
	const currentHour = now.getHours();
	const currentMinute = now.getMinutes();
	
	// 转换为分钟进行比较
	const targetMinutes = targetHour * 60 + targetMinute;
	const currentMinutes = currentHour * 60 + currentMinute;
	
	return Math.abs(currentMinutes - targetMinutes) <= rangeMinutes;
}

/**
 * 格式化打卡记录
 * @param {Object} record - 打卡记录
 * @returns {Object} 格式化后的记录
 */
export function formatClockRecord(record) {
	if (!record) return null;
	
	const now = new Date();
	const clockTime = record.clockTime ? new Date(record.clockTime) : now;
	
	const hours = clockTime.getHours().toString().padStart(2, '0');
	const minutes = clockTime.getMinutes().toString().padStart(2, '0');
	
	return {
		time: `${hours}:${minutes}`,
		status: record.status || 'normal', // normal, late, early
		location: record.location || '未知位置'
	};
}

/**
 * 计算两个地理坐标点之间的距离（米）
 * @param {number} lat1 - 第一个点的纬度
 * @param {number} lon1 - 第一个点的经度
 * @param {number} lat2 - 第二个点的纬度
 * @param {number} lon2 - 第二个点的经度
 * @returns {number} 两点之间的距离（米）
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371000; // 地球半径，单位米
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
			  Math.sin(dLon/2) * Math.sin(dLon/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	return R * c;
}

/**
 * 更新时间和日期信息
 * @returns {Object} 包含当前时间、日期和星期的对象
 */
export function updateTimeAndDate() {
	return {
		time: getCurrentTime(),
		date: getCurrentDate(),
		weekday: getCurrentWeekday()
	};
}

/**
 * 将点分隔的日期格式转换为连字符格式 (YYYY.MM.DD -> YYYY-MM-DD)
 * @param {string} dateString - 点分隔的日期字符串 (YYYY.MM.DD)
 * @returns {string} 连字符分隔的日期字符串 (YYYY-MM-DD)
 */
export function formatDateWithHyphens(dateString) {
	// 使用正则表达式替换所有的点为连字符
	return dateString.replace(/\./g, '-');
}

/**
 * 判断是否迟到
 * @param {string} scheduledTime - 规定时间 (格式: "09:00")
 * @param {string} actualTime - 实际打卡时间 (格式: "09:15:30")
 * @returns {boolean} 是否迟到
 */
export function isLate(scheduledTime, actualTime) {
    // 获取规定的上班时间
    const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);
    
    // 获取实际打卡时间
    const [actualHour, actualMinute] = actualTime.split(':').map(Number);
    
    // 将时间转换为分钟进行比较
    const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
    const actualMinutes = actualHour * 60 + actualMinute;
    
    // 如果打卡时间晚于规定时间，则算迟到
    return actualMinutes > scheduledMinutes;
}

/**
 * 获取位置的打卡状态
 * @param {number} distance - 当前距离（米）
 * @param {number} targetRadius - 目标范围半径（米）
 * @returns {Object} 包含打卡状态信息的对象 
 */
export function getClockInStatus(distance, targetRadius) {
    if (distance <= targetRadius) {
        return {
            status: '正常',
            inRange: true
        };
    } else if (distance <= targetRadius * 2) {
        return {
            status: '超出范围打卡',
            inRange: false
        };
    } else {
        return {
            status: '远距离打卡',
            inRange: false
        };
    }
}

/**
 * 格式化位置信息对象
 * @param {Object} locationData - 位置信息数据
 * @returns {Object} 格式化后的位置信息对象
 */
export function formatLocationInfo(locationData) {
    return {
        ...locationData,
        address: locationData.address || locationData.adddress || '未知位置',
        latitude: parseFloat(locationData.latitude),
        longitude: parseFloat(locationData.longitude)
    };
}

/**
 * 从客户数据中获取有效的位置信息
 * @param {Object} customerData - 客户数据对象
 * @returns {Object|null} 包含位置信息的对象或null
 */
export function getLocationFromCustomer(customerData) {
    if (!customerData) return null;
    
    // 直接尝试获取经纬度字段
    if (customerData.Dingwei_Lat && customerData.Dingwei_Lng) {
        const lat = parseFloat(customerData.Dingwei_Lat);
        const lng = parseFloat(customerData.Dingwei_Lng);
        
        if (!isNaN(lat) && !isNaN(lng)) {
            return {
                latitude: lat,
                longitude: lng,
                name: customerData.KehuMC || '客户位置',
                radius: 500 // 默认客户打卡范围（米）
            };
        }
    }
    
    // 尝试解析Dingwei字段
    if (customerData.Dingwei) {
        try {
            const dingweiInfo = typeof customerData.Dingwei === 'string' 
                ? JSON.parse(customerData.Dingwei)
                : customerData.Dingwei;
                
            if (dingweiInfo.latitude && dingweiInfo.longitude) {
                return {
                    latitude: parseFloat(dingweiInfo.latitude),
                    longitude: parseFloat(dingweiInfo.longitude),
                    name: dingweiInfo.name || customerData.KehuMC || '客户位置',
                    radius: 500 // 默认客户打卡范围（米）
                };
            }
        } catch (error) {
            console.error('解析Dingwei字段失败:', error);
        }
    }
    
    return null;
}

/**
 * 找出当前位置与多个目标位置中的最近距离
 * @param {Object} currentLocation - 当前位置坐标对象 {latitude, longitude}
 * @param {Array} targetLocations - 目标位置数组 [{latitude, longitude, radius, name}]
 * @returns {Object} 包含最近目标位置信息、距离和是否在范围内的对象
 */
export function findNearestTargetLocation(currentLocation, targetLocations) {
    if (!currentLocation || !currentLocation.latitude || !currentLocation.longitude) {
        return {
            inRange: false,
            distance: Infinity,
            targetLocation: null,
            targetRadius: 0
        };
    }
    
    if (!targetLocations || !targetLocations.length) {
        return {
            inRange: false,
            distance: Infinity,
            targetLocation: null,
            targetRadius: 0
        };
    }
    
    let minDistance = Infinity;
    let nearestLocation = null;
    let isInRange = false;
    
    // 遍历所有目标位置，找出最近的
    for (const location of targetLocations) {
        if (!location.latitude || !location.longitude) continue;
        
        const distance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            location.latitude,
            location.longitude
        );
        
        // 更新最小距离
        if (distance < minDistance) {
            minDistance = distance;
            nearestLocation = location;
        }
        
        // 检查是否在任一位置的范围内
        const radius = location.radius || 100;
        if (distance <= radius) {
            isInRange = true;
        }
    }
    
    const targetRadius = nearestLocation ? (nearestLocation.radius || 100) : 0;
    
    return {
        inRange: isInRange,
        distance: minDistance,
        targetLocation: nearestLocation,
        targetRadius: targetRadius
    };
}
