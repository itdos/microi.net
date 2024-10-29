import { useIndexPageProvide } from '../../../composables'
import microiRequest from '@/config/api';
import { reactive } from 'vue'
export const useBasic = () => {
	const workData = reactive({
    TodoCount: 0,
    DoneCount: 0,
    SenderCount: 0,
    CopyCount: 0,
  })
	const getData = async () => {
		try {
			const obj = {
				WorkType: 'Todo',
				_Keyword: ''
			}
			const res = await microiRequest.GetWFWork(obj);
			if (res.Code == 1) {
				workData.TodoCount = res.DataCount
			}
		} catch (error) {
			console.error(error);
		}
		try {
			const obj = {
				WorkType: 'Done',
				_Keyword: ''
			}
			const res = await microiRequest.GetWFFlow(obj);
			if (res.Code == 1) {
				workData.DoneCount = res.DataCount
			}
		} catch (error) {
			console.error(error);
		}
		try {
			const obj = {
				WorkType: 'Sender',
				_Keyword: ''
			}
			const res = await microiRequest.GetWFFlow(obj);
			if (res.Code == 1) {
				workData.SenderCount = res.DataCount
			}
		} catch (error) {
			console.error(error);
		}
		try {
			const obj = {
				WorkType: 'Copy',
				_Keyword: ''
			}
			const res = await microiRequest.GetWFFlow(obj);
			if (res.Code == 1) {
				workData.CopyCount = res.DataCount
			}
		} catch (error) {
			console.error(error);
		}
	}
	getData()
  // 处理当前页面显示时的事件
  const onShow = () => {
    /** empty */
  }

  // 处理当前页面加载时的事件
  const onLoad = () => {
    /** empty */
  }

  useIndexPageProvide('basic', onShow, onLoad)
	return { workData }
}
