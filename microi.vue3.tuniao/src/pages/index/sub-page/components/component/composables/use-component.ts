import { useIndexPageProvide } from '../../../composables'
import microiRequest from '@/config/api';
import { ref } from 'vue'
import configHttp from '@/config'
export const useComponent = () => {
	const workData = ref<any>([])
	const getData = async () => {
		try {
			const obj = {
				OsClient: configHttp.osClient
			}
			const res = await microiRequest.getSysMenuStep(obj);
			if (res.Code == 1) {
				var list = res.Data
				list.map((item: { _Child: any; Display: any; Name: string; show: boolean; }) => {
					if (item._Child && item.Display) {
						item._Child = item._Child.filter((i: { Display: number }) => i.Display == 1)
						item.show = true
						workData.value.push(item)
					}
				})
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

  useIndexPageProvide('component', onShow, onLoad)
	return { workData }
}
