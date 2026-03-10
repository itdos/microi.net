import { ResultEnum } from '@goview/enums/httpEnum'

export enum ChartEnum {
  // 图表创建（映射到 microi.web 路由）
  CHART_HOME = '/mic/data-dashboard/design/:Id',
  CHART_HOME_NAME = 'mic_data_dashboard_design',
}

export enum PreviewEnum {
  //  图表预览（映射到 microi.web 路由）
  CHART_PREVIEW = '/mic/data-dashboard/preview/:Id',
  CHART_PREVIEW_NAME = 'mic_data_dashboard_preview',
}

export enum EditEnum {
  //  图表JSON编辑（复用设计器路由）
  CHART_EDIT = '/mic/data-dashboard/design/:Id',
  CHART_EDIT_NAME = 'mic_data_dashboard_design',
}

export enum PageEnum {
  // 登录（使用 microi.web 的登录页）
  BASE_LOGIN = '/login',
  BASE_LOGIN_NAME = 'Login',

  //重定向
  REDIRECT = '/redirect',
  REDIRECT_NAME = 'Redirect',
  RELOAD = '/reload',
  RELOAD_NAME = 'Reload',

  // 首页（回到 microi.web 首页）
  BASE_HOME = '/',
  BASE_HOME_NAME = 'Home',

  // 这些页面不再需要，保留枚举值避免引用报错
  BASE_HOME_ITEMS = '/',
  BASE_HOME_ITEMS_NAME = 'Home',
  BASE_HOME_TEMPLATE = '/',
  BASE_HOME_TEMPLATE_NAME = 'Home',
  BASE_HOME_TEMPLATE_MARKET = '/',
  BASE_HOME_TEMPLATE_MARKET_NAME = 'Home',

  // 错误
  ERROR_PAGE_NAME_403 = 'ErrorPage403',
  ERROR_PAGE_NAME_404 = 'ErrorPage404',
  ERROR_PAGE_NAME_500 = 'ErrorPage500'
}

export const ErrorPageNameMap = new Map([
  [ResultEnum.NOT_FOUND, PageEnum.ERROR_PAGE_NAME_404],
  [ResultEnum.SERVER_FORBIDDEN, PageEnum.ERROR_PAGE_NAME_403],
  [ResultEnum.SERVER_ERROR, PageEnum.ERROR_PAGE_NAME_500]
])
