import axios from 'axios'

const request = axios.create({
  // baseURL: 'https://api-china.itdos.com', // 接口基础路径
  baseURL: 'https://api.nbweixin.cn',
  timeout: 20000, // 请求超时时间，默认20秒
})

export default request
