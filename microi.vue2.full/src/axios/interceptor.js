import request from './request'

// 请求拦截器
request.interceptors.request.use(
  config => {
    // 在请求发送之前做一些处理
    // const token_type = "Bearer";
    // if (localStorage.getItem("token")) {
    // 	config.headers.Authorization = token_type + ' ' + localStorage.getItem("token");
    // }
    return config
  },
  error => {
    // 对请求错误做处理
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    // 对响应数据做处理
    return response
  },
  error => {
    // 对响应错误做处理
    return Promise.reject(error)
  }
)

export default request