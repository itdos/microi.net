import { reactive, ref } from 'vue'
import { useIndexPageProvide } from '../../../composables'

import microiRequest from '@/config/api';
// 随机获取1 - 9999之间的整数
const getRandom = () => {
  return Math.floor(Math.random() * 9999) + 1
}
export const useAbout = () => {
  // 处理当前页面显示时的事件
  const onShow = () => {
    /** empty */
  }

  // 处理当前页面加载时的事件
  const onLoad = () => {
    /** empty */
  }

  // 获取设置信息
  const setData = reactive([
    // {
    //   id: getRandom(),
    //   title: '服务器配置',
    //   url:'/pages-user/server/index',
    //   icon: 'server',
    //   class: 'tn-gradient-bg__cool-5'
    // },
    {
      id: getRandom(),
      title: '修改密码',
      url:'/pages/login/ChangePassword',
      icon: 'lock',
      class: 'tn-gradient-bg__blue'
    },
    {
      id: getRandom(),
      title: '退出登陆',
      url:'/pages/login/index',
      icon: 'logout',
      class: 'tn-gradient-bg__cool-2'
    }
  ])

  useIndexPageProvide('about', onShow, onLoad)

  return {
    setData,
  }
}
