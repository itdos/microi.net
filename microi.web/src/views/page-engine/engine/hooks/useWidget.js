import { ref, watch } from 'vue'
import { get } from '../utils/axiosInstance'
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../stores/pageEngine'
import { useDebounceFn } from '@vueuse/core'
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

export function useWidget(widgetObj, dynamicData, dateRange = ref(), loading = ref(false), currentPage = ref(-1)) {
  //把webapi数据同步到jsonObj
  const setResponse = (response) => {
    let wrapperNumber = widgetObj.widgetOption.wrapperNumber //当前组件所在容器编号
    let number = widgetObj.widgetOption.number //当前组件编号 
    let wrapperIdx = formData.value.JsonObj.wrapperList.findIndex(
      (item) => item.wrapperOption.number === wrapperNumber
    )
    if (wrapperIdx !== -1) {
      let widgetIdx = formData.value.JsonObj.wrapperList[
        wrapperIdx
      ].widgetList.findIndex((item) => item.widgetOption.number === number)
      if (widgetIdx !== -1) {

        if (response instanceof Object || response instanceof Array) {
          formData.value.JsonObj.wrapperList[wrapperIdx].widgetList[
            widgetIdx
          ].widgetParams[0].typeOptions.dataJson = response
        }
        else {
          formData.value.JsonObj.wrapperList[wrapperIdx].widgetList[
            widgetIdx
          ].widgetParams[0].typeOptions.dataJson = {}
        }
      }
    }
  }
  //加载webapi数据
  const loadRemoteData = async () => {
    let params = {}
    if (dateRange.value) {
      params.start = dateRange.value[0]
      params.end = dateRange.value[1]
    }
    //添加分页条件
    if (currentPage.value !== -1 && widgetObj.widgetParams[7]?.value !== -1) {
      params.currentPage = currentPage.value
      params.pageSize = widgetObj.widgetParams[7]?.value
    }

    if (widgetObj.widgetParams[0].typeOptions.dataJson.searchData) {
      widgetObj.widgetParams[0].typeOptions.dataJson.searchData?.forEach(element => {
        params[element.prop] = element.value
      });
    }

    if (widgetObj.widgetParams[0].value) {
      console.log('请求地址', widgetObj.widgetParams[0].value)
      console.log('请求参数', params)
      loading.value = true
      const response = await get(widgetObj.widgetParams[0].value, params)
      try {
        setResponse(response)
        loading.value = false
      } catch (error) {
        loading.value = false
        console.log(error)
      }
    }
    else {
      //模拟本地分页
      if (dynamicData && currentPage.value !== -1 && widgetObj.widgetParams[7] && widgetObj.widgetParams[7]?.value !== -1) {
        let start = (currentPage.value - 1) * widgetObj.widgetParams[7]?.value
        let end = start + widgetObj.widgetParams[7]?.value
        //这里需要根据接口返回的数据进行分页，这里只是模拟（目前只有tabel组件用到分页）
        if (widgetObj.widgetParams[0].typeOptions.dataJson.bodyData) {
          widgetObj.widgetParams[0].typeOptions.dataJson.bodyData = dynamicData?.slice(start, end)
        }
      }
    }
  }

  const fetchData = useDebounceFn(async () => {
    await loadRemoteData();
  }, 1000)

  watch(
    () => widgetObj.widgetParams[0].value,
    async (newValue, oldValue) => {
      if (newValue !== oldValue) {
        fetchData()
      }
    },
    {
      deep: true,
    }
  );

  watch(
    () => formData.value.JsonObj.formConfig.lastRefreshTime,
    async (newValue, oldValue) => {
      if (newValue !== oldValue) {
        fetchData()
      }
    },
    {
      // immediate: true,
      deep: false,
    }
  );
  return {
    loadRemoteData,
    setResponse
  }
}


