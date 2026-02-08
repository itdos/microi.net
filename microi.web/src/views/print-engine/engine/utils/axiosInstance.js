import axios from 'axios'
import { usePrintEngineStore } from '../stores/printEngine'
import { ElMessage } from 'element-plus'

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: '', // 替换为你的 API 基础 URL
  timeout: 10000, // 请求超时时间
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // 使用 InternalAxiosRequestConfig 类型
    const printEngineStore = usePrintEngineStore()
    if (printEngineStore.token) {
      config.headers['Authorization'] = `Bearer ${printEngineStore.token}` // 在请求头中添加 token
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
    return response
  },
  (error) => {
    if (error.response) {
      const { status } = error.response
      if (status === 401) {
        // 未授权，跳转到登录页面
        ElMessage.error('未授权')
      } else if (status === 403) {
        // 无权限访问，提示用户
        ElMessage.error('无权限访问')
      } else if (status === 500) {
        // 服务器错误
        console.error('服务器错误')
      }
    }
    return Promise.reject(error)
  }
)

// 封装 get 请求
export const get = async (url, params) => {
  const response = await axiosInstance.get(url, { params })
  return response.data
}

// 封装 post 请求
export const post = async (url, data) => {
  const response = await axiosInstance.post(url, data)
  return response.data
}

// 封装 put 请求
export const put = async (url, data) => {
  const response = await axiosInstance.put(url, data)
  return response.data
}

// 封装 delete 请求
export const del = async (url, params) => {
  const response = await axiosInstance.delete(url, { params })
  return response.data
}
export default axiosInstance
