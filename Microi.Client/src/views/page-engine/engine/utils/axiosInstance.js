/**
 * axios 封装
 * utils/axiosInstance.js
 */

import axios from 'axios'
import { usePageEngineStore } from '../stores/pageEngine'
import { ElMessage } from 'element-plus'
import { DiyCommon } from "@/utils/diy.common.js";
import { reportApiServiceFailure, reportApiServiceRecovered } from "@/utils/api-service-status.js";
import { peT } from '../i18n.js'
// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: '',
  timeout: 10 * 60 * 1000,
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    const pageEngineStore = usePageEngineStore()
    const token = pageEngineStore.token || DiyCommon.getToken?.() || ''
    if (token) {
      config.headers['Authorization'] = `Bearer ${String(token).replace(/^Bearer\s+/i, '')}`
      config.headers['Authorization'] = `Bearer ${pageEngineStore.token}` // 在请求头中添加 token
      console.log('请求头已携带token')
    }
    if (token) {
      config.headers['Authorization'] = `Bearer ${String(token).replace(/^Bearer\s+/i, '')}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    reportApiServiceRecovered({
      apiBase: DiyCommon.GetApiBase(),
      url: response.config?.url,
      responseData: response.data
    })
    return response
  },
  (error) => {
    reportApiServiceFailure(error, {
      apiBase: DiyCommon.GetApiBase(),
      osClient: DiyCommon.GetOsClient(),
      url: error.config?.url,
      method: error.config?.method
    })
    if (error.response) {
      const { status } = error.response
      if (status === 401) {
        // 未授权，跳转到登录页面
        ElMessage.error(peT('未授权'))
      } else if (status === 403) {
        // 无权限访问，提示用户
        ElMessage.error(peT('无权限访问'))
      } else if (status === 500) {
        // 服务器错误
        console.error('服务器错误')
      }
    }
    return Promise.reject(error)
  }
)

export const resolveRuntimeUrl = (url) => {
  if (!url) return url
  const apiBase = DiyCommon.GetApiBase()
  const osClient = DiyCommon.GetOsClient()
  if (apiBase) {
    url = url.replace('$ApiBase$', apiBase)
  }
  if (osClient) {
    url = url.replace('$OsClient$', osClient)
  }
  return url
}

// 封装 get 请求
export const get = async (url, params) => {
  try {
    //2025-12-20 Anderson：新增支持$ApiBase$、$OsClient$变量替换
    url = resolveRuntimeUrl(url)
    const response = await axiosInstance.get(url, { params });
    return response.data;
  } catch (error) {
    // 处理错误
    console.error('GET 请求错误:', error);
    return null;
  }
}

// 封装 post 请求
export const post = async (url, data) => {

  try {
    //2025-12-20 Anderson：新增支持$ApiBase$、$OsClient$变量替换
    url = resolveRuntimeUrl(url)
    const response = await axiosInstance.post(url, data)
    return response.data
  } catch (error) {
    // 处理错误
    console.error('Post 请求错误:', error);
    return null;
  }

}

// 封装 put 请求
export const getFile = async (url, params) => {
  try {
    url = resolveRuntimeUrl(url)
    const response = await axiosInstance.get(url, {
      params,
      responseType: 'blob'
    })
    return response
  } catch (error) {
    console.error('GET file request error:', error)
    return null
  }
}

export const put = async (url, data) => {

  try {
    const response = await axiosInstance.put(url, data)
    return response.data
  } catch (error) {
    // 处理错误
    console.error('Put 请求错误:', error);
    return null;
  }
}

// 封装 delete 请求
export const del = async (url, params) => {

  try {
    const response = await axiosInstance.delete(url, { params })
    return response.data
  } catch (error) {
    // 处理错误
    console.error('Del 请求错误:', error);
    return null;
  }
}
export default axiosInstance
