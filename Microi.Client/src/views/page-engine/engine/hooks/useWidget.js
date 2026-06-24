import { ref, watch } from 'vue'
import { get } from '../utils/axiosInstance'
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../stores/pageEngine'
import { useDebounceFn } from '@vueuse/core'
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

export function useWidget(widgetObj, dynamicData, dateRange = ref(), loading = ref(false), currentPage = ref(-1), requestPageSize = ref(), activePeriod = ref()) {
  const readMaybeRef = value =>
    value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')
      ? value.value
      : value

  const getCurrentDataJson = () =>
    widgetObj?.widgetParams?.[0]?.typeOptions?.dataJson || {}

  const getSearchData = () => {
    const searchData = getCurrentDataJson().searchData
    return Array.isArray(searchData) ? searchData : []
  }

  const getSearchValue = (...props) => {
    const searchData = getSearchData()
    const target = searchData.find(item => props.includes(item?.prop))
    return target?.value
  }

  const normalizeRemotePayload = (response) => {
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      if (Object.prototype.hasOwnProperty.call(response, 'Code')) {
        if (response.Code !== 1) {
          console.warn('[PageEngine] remote data request failed:', response.Msg || response)
          return undefined
        }
        return normalizeRemotePayload(response.Data)
      }
      if (response.Result && response.Result.Code !== undefined) {
        return normalizeRemotePayload(response.Result)
      }
    }
    return response
  }

  const normalizeWidgetDataJson = (payload) => {
    const widgetType = widgetObj?.type
    const currentDataJson = getCurrentDataJson()
    const listDataWidgets = ['statistic', 'pie', 'funnel', 'progress']
    const preservedSearchData = Array.isArray(currentDataJson.searchData)
      ? currentDataJson.searchData
      : []
    const nextSearchData = searchData =>
      Array.isArray(searchData) && searchData.length
        ? searchData
        : preservedSearchData

    if (payload === undefined || payload === null) return undefined

    if (listDataWidgets.includes(widgetType)) {
      if (Array.isArray(payload)) {
        return {
          data: payload,
          searchData: preservedSearchData,
        }
      }
      if (payload && typeof payload === 'object') {
        return {
          ...payload,
          data: Array.isArray(payload.data) ? payload.data : [],
          searchData: nextSearchData(payload.searchData),
        }
      }
      return { data: [], searchData: preservedSearchData }
    }

    if (['bar', 'line', 'linebar'].includes(widgetType)) {
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return {
          ...currentDataJson,
          ...payload,
          xAxis: Array.isArray(payload.xAxis) ? payload.xAxis : (currentDataJson.xAxis || []),
          series: Array.isArray(payload.series) ? payload.series : (currentDataJson.series || []),
          searchData: nextSearchData(payload.searchData),
        }
      }
      return undefined
    }

    if (widgetType === 'tabel') {
      if (Array.isArray(payload)) {
        return {
          ...currentDataJson,
          bodyData: payload,
          total: payload.length,
          searchData: preservedSearchData,
        }
      }
      if (payload && typeof payload === 'object') {
        return {
          ...currentDataJson,
          ...payload,
          headerData: Array.isArray(payload.headerData) ? payload.headerData : (currentDataJson.headerData || []),
          bodyData: Array.isArray(payload.bodyData) ? payload.bodyData : [],
          total: Number.isFinite(Number(payload.total)) ? Number(payload.total) : (Array.isArray(payload.bodyData) ? payload.bodyData.length : 0),
          searchData: nextSearchData(payload.searchData),
        }
      }
      return undefined
    }

    return payload
  }
  //把webapi数据同步到jsonObj
  const setResponse = (response) => {
    const payload = normalizeWidgetDataJson(normalizeRemotePayload(response))
    if (payload === undefined) return
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

        if (payload instanceof Object || payload instanceof Array) {
          formData.value.JsonObj.wrapperList[wrapperIdx].widgetList[
            widgetIdx
          ].widgetParams[0].typeOptions.dataJson = payload
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
  const getPageSize = () => {
    const overrideValue = readMaybeRef(requestPageSize)
    const rawValue =
      overrideValue !== undefined && overrideValue !== null && overrideValue !== ''
        ? overrideValue
        : widgetObj?.type === 'tabel'
          ? widgetObj.widgetParams[7]?.value
          : -1
    const pageSize = Number(rawValue)
    return Number.isFinite(pageSize) ? pageSize : -1
  }

  const loadRemoteData = async () => {
    let params = {}
    if (
      Array.isArray(dateRange.value) &&
      dateRange.value.length >= 2 &&
      dateRange.value[0] &&
      dateRange.value[1]
    ) {
      params.start = dateRange.value[0]
      params.end = dateRange.value[1]
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    //添加分页条件
    const activePageSize = getPageSize()
    const activeCurrentPage = readMaybeRef(currentPage)
    if (activeCurrentPage !== undefined && activeCurrentPage !== -1 && activePageSize > 0) {
      params.currentPage = activeCurrentPage
      params.pageSize = activePageSize
    }

    const hasDateRange =
      Array.isArray(dateRange.value) &&
      dateRange.value.length >= 2 &&
      dateRange.value[0] &&
      dateRange.value[1]
    const activePeriodValue =
      getSearchValue('period', '_period') || readMaybeRef(activePeriod) || (hasDateRange ? activePeriod?.value : '')
    if (activePeriodValue) {
      params.period = activePeriodValue
      params._period = activePeriodValue
    }

    if (getSearchData().length) {
      getSearchData().forEach(element => {
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
      if (dynamicData && currentPage.value !== -1 && activePageSize > 0) {
        let start = (currentPage.value - 1) * activePageSize
        let end = start + activePageSize
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


