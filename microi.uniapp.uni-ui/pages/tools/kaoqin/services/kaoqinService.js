/**
 * 考勤打卡服务
 */

// 导入Microi API
import {
	Microi,
	V8
} from "@/config/microi.uniapp.js"


/**
 * 获取今日打卡记录
 * @returns {Promise} 返回Promise对象
 */
export function getTodayClockRecords() {
	return new Promise(async (resolve, reject) => {
		try {
			// 获取今天的日期，格式为 YYYY-MM-DD
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');
			const dateString = `${year}-${month}-${day}`;
			
			// 调用 API 获取当天打卡记录
			const result = await Microi.FormEngine.GetTableData({
				FormEngineKey: 'diy_daka_list',
				_Where: [
					{ Name: 'UserId', Value: Microi.GetCurrentUser().Id, Type: '=' },
					{ Name: 'DakaRQ', Value: dateString, Type: '=' }
				]
			});
			
			// 处理返回数据
			if (result && result.Code == 1) {
				// 区分上午和下午打卡记录
				let morningRecord = null;
				let eveningRecord = null;
				
				// 遍历结果，找出上午和下午的打卡记录
				result.Data.forEach(record => {
					// 假设 DakaLX 字段表示打卡类型，"morning" 为上班打卡，"evening" 为下班打卡
					const time = record.DakaSJ ? record.DakaSJ.split(' ')[1] : ''; // 提取时间部分
					if (record.DakaLX && record.DakaLX.includes('签到')) {
						morningRecord = {
							time: time,
							status: record.Status || 'normal', // 打卡状态：normal, late, early
						};
					} else if (record.DakaLX && record.DakaLX.includes('签退')) {
						eveningRecord = {
							time: time,
							status: record.Status || 'normal',
						};
					}
				});
				
				// 返回格式化后的数据
				resolve({
					code: 0,
					data: {
						morning: morningRecord,
						evening: eveningRecord
					},
					message: 'success'
				});
			} else {
				// 今日无打卡记录
				resolve({
					code: 0,
					data: {
						morning: null,
						evening: null
					},
					message: 'success'
				});
			}
		} catch (error) {
			console.error('获取今日打卡记录失败:', error);
			reject({
				code: -1,
				message: '获取今日打卡记录失败'
			});
		}
	});
}

/**
 * 提交打卡记录
 * @param {Object} params 打卡参数
 * @returns {Promise} 返回Promise对象
 */
export function submitClockRecord(params) {
	return new Promise(async (resolve, reject) => {
		try {
			// 处理参数，检查对象或数组需要使用JSON.stringify转换
			const model = {};
			for (const key in params) {
				if (typeof params[key] === 'object' && params[key] !== null) {
					model[key] = JSON.stringify(params[key]);
				} else {
					model[key] = params[key];
				}
			}
			
			// 添加第一个接口调用：添加表单数据
			const daka = await Microi.FormEngine.AddFormData({
				FormEngineKey: 'diy_daka_list',
				Id: model.Id,
				_RowModel: model
			});
			
			// 添加第二个接口调用：运行打卡计算
			const run = await Microi.ApiEngine.Run('daka_jisuan', {
				Form: model,
			});
			
			// 处理返回结果
			if (daka && daka.Code === 1) {
				resolve({
					code: 0,
					data: {
						id: daka.Data,
						time: new Date().toISOString(),
						type: params.type,
						location: params.location,
						status: 'normal',
						daka: daka,
						run: run
					},
					message: 'success'
				});
			} else {
				reject({
					code: -1,
					message: daka?.Msg || '提交打卡记录失败'
				});
			}
		} catch (error) {
			console.error('提交打卡记录失败:', error);
			reject({
				code: -1,
				message: '提交打卡记录失败:' + error.message
			});
		}
	});
}

/**
 * 获取打卡规则
 * @returns {Promise} 返回Promise对象
 */
export function getClockRules() {
	return new Promise(async (resolve, reject) => {
		try {
			const result = await Microi.FormEngine.GetTableData({
				FormEngineKey: 'diy_kaoqindian',
				_Where: []
			});
			
			if (result.Code === 1 && result.DataCount>0) {
				// 处理成功响应
				// 假设返回的数据格式需要转换为我们的格式
				const formData = result.Data[0] || {};
				
				resolve({
					code: 0, // 保持与原有接口一致的成功码
					data: {
						morning: {
							time: formData.ShangbanSJ || '09:00',
							rangeMinutes: formData.DakaFW || 30 // 打卡范围，单位分钟
						},
						evening: {
							time: formData.XiabanSJ || '18:00',
							rangeMinutes: formData.DakaFW || 30
						},
						locations: [
							{
								name: formData.DakaD || '公司总部',
								longitude: formData.KaoqinD_Lng || 121.555908,
								latitude: formData.KaoqinD_Lat || 29.885354,
								radius: formData.DakaFW || 200 // 打卡范围半径，单位米
							}
						]
					},
					message: 'success'
				});
			} else {
				// 处理错误响应
				resolve({
					code: -1,
					message: result.Msg || '获取打卡规则失败'
				});
			}
		} catch (error) {
			console.error('获取打卡规则异常:', error);
			reject(error);
		}
	});
}

