import Vue from 'vue'
import Router from 'vue-router'
import { DosCommon } from 'microi.net'

Vue.use(Router)

/* Layout */
import Layout from '@/layout'

/* Router Modules */
// import componentsRouter from './modules/components'
// import chartsRouter from './modules/charts'
// import tableRouter from './modules/table'
// import nestedRouter from './modules/nested'

/**
 * Note: sub-menu only appear when route children.length >= 1
 * Detail see: https://panjiachen.github.io/vue-element-admin-site/guide/essentials/router-and-nav.html
 *
 * hidden: true                   if set true, item will not show in the sidebar(default is false)
 * alwaysShow: true               if set true, will always show the root menu
 *                                if not set alwaysShow, when item has more than one children route,
 *                                it will becomes nested mode, otherwise not show the root menu
 * redirect: noRedirect           if set noRedirect will no redirect in the breadcrumb
 * name:'router-name'             the name is used by <keep-alive> (must set!!!)
 * meta : {
    roles: ['admin','editor']    control the page roles (you can set multiple roles)
    title: 'title'               the name show in sidebar and breadcrumb (recommend set)
    icon: 'svg-name'/'el-icon-x' the icon show in the sidebar
    noCache: true                if set true, the page will no be cached(default is false)
    affix: true                  if set true, the tag will affix in the tags-view
    breadcrumb: false            if set false, the item will hidden in breadcrumb(default is true)
    activeMenu: '/example/list'  if set path, the sidebar will highlight the path you set
  }
 */

/**
 * constantRoutes
 * a base page that does not have permission requirements
 * all roles can be accessed
 */
export const constantRoutes = [
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/views/redirect/index')
      }
    ]
  },
  {
    path: '/login',
    component: () => import('@/views/login/index'),
    hidden: true
  },
  {
    path: '/auth-redirect',
    component: () => import('@/views/login/auth-redirect'),
    hidden: true
  },
  // {
  //   path: '/404',
  //   component: () => import('@/views/error-page/404'),
  //   hidden: true
  // },
  {
    path: '/401',
    component: () => import('@/views/error-page/401'),
    hidden: true
  }
]

/**
 * asyncRoutes
 * the routes that need to be dynamically loaded based on user roles
 */
export const asyncRoutes = [

  /** when your routing map is too long, you can split it into small modules **/
  // componentsRouter,
  // chartsRouter,
  // nestedRouter,
  // tableRouter,
  {
    path: '/servicename',
    component: Layout,
    redirect: '/servicename/dashboard',
    children: [
      {
        path: 'dashboard',
        component: () => import('@/views/dashboard/index'),
        name: 'Dashboard',
        meta: { title: 'Dashboard', icon: 'dashboard', affix: true }
      }
    ]
  },
  {
    path: '/anderson',
    component: Layout,
    redirect: '/anderson/test',
    children: [
      {
        path: 'test',
        component: () => import('@/views/anderson/test'),
        name: 'anderson',
        meta: { title: 'anderson-test', icon: 'dashboard', affix: true }
      }
    ]
  },
  // {
  //   path: '/zhouhao/test/test999',
  //   component: Layout,
  //   // redirect: '/zhouhao/test2',
  //   children: [
  //     {
  //       path: '/zhouhao/test/test999',
  //       // component: () => import('@/views/anderson/test'),
  //       component: (resolve) => require(['@/views' + '/anderson/test'], resolve),
  //       name: 'zhouhao',
  //       meta: { title: 'zhouhao-test2', icon: 'dashboard', affix: false }
  //     }
  //   ]
  // },
  // {
  //   path: '/anderson/test/test2',
  //   component: Layout,
  //   // redirect: '/zhouhao/test2',
  //   children: [
  //     {
  //       path: '/anderson/test/test2',
  //       // component: () => import('@/views/anderson/test'),
  //       component: (resolve) => require(['@/views' + '/anderson/test'], resolve),
  //       name: 'menu_15df0746199643f8bcef0a2cc3f44753',
  //       meta: { title: 'zhouhao-test2', icon: 'dashboard', affix: false }
  //     }
  //   ]
  // },
  // 404 page must be placed at the end !!!
  // { path: '*', redirect: '/404', hidden: true },
  {
		path: '*',
		component: Layout,
		children: [
			{
				path: '*',
				name: 'page_404',
				component: () => import('@/views/error-page/404'),
			}
		]
	},
]

const createRouter = () => new Router({
  mode: 'hash', // require service support
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()

// Detail see: https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher // reset router
  //清除asyncRoutes by itdos.com
  for (let index = 0; index < asyncRoutes.length; index++) {
      if (!DosCommon.IsNull(asyncRoutes[index].Id)) {
          asyncRoutes.splice(index, 1);
          index--;
      }
  }
}

export default router
