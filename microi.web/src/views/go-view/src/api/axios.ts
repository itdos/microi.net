import axios, { AxiosResponse, InternalAxiosRequestConfig, AxiosError } from 'axios'
import { ResultEnum } from "@goview/enums/httpEnum"

const axiosInstance = axios.create({
  // go-view 组件的动态数据请求使用组件自身配置的 requestOriginUrl + requestUrl
  // 这里提供一个本地的 baseURL 作为 fallback
  baseURL: '',
  timeout: ResultEnum.TIMEOUT,
})

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config
  },
  (error: AxiosError) => {
    Promise.reject(error)
  }
)

// 响应拦截器
axiosInstance.interceptors.response.use(
  (res: AxiosResponse) => {
    const { code } = res.data as { code: number }
    if (code === undefined || code === null) return Promise.resolve(res.data)
    if (code === ResultEnum.DATA_SUCCESS) return Promise.resolve(res.data)
    return Promise.resolve(res.data)
  },
  (err: AxiosResponse) => {
    Promise.reject(err)
  }
)

export default axiosInstance
