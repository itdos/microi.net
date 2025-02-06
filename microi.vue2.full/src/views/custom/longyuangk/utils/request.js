// 引入axios库
import axios from 'axios';

// 创建一个axios实例
const service = axios.create({
  baseURL: '', // 根据环境变量设置基础URL
  timeout: 5000, // 设置超时时间（单位：毫秒）
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
    // 可以在这里配置默认请求头
  },
});

// 请求拦截器，可以用来处理请求前的操作，如添加Token、统一错误处理等
service.interceptors.request.use(
  config => {
    // 在这里可以对请求参数进行处理，比如添加全局Token
    if (localStorage.getItem('token')) {
      config.headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// 响应拦截器，可以用来处理响应后的操作，如状态码判断、统一错误提示等
service.interceptors.response.use(
  response => {
    const res = response.data;
    // 如果返回的状态码为200，说明接口请求成功，可以正常拿到数据
    if (res.code === 200) {
      return Promise.resolve(res.data);
    } else {
      // 其他状态码则抛出异常
      return Promise.reject(new Error(res.message || 'Error'));
    }
  },
  error => {
    console.error('error', error); // 打印错误日志
    let message = '';
    if (error.response && error.response.data) {
      message = error.response.data.message || '网络异常';
    } else {
      message = '无法连接到服务器，请检查您的网络连接';
    }
    // 返回一个带有错误信息的Promise
    return Promise.reject(new Error(message));
  },
);

// 封装常用的HTTP方法
export const get = (url, params) => service.get(url, { params });
export const post = (url, data) => service.post(url, data);
export const put = (url, data) => service.put(url, data);
export const deleteRequest = (url, params) => service.delete(url, { params });