import { asyncRoutes, constantRoutes } from '@/router'
import { DiyApi, DiyCommon, DosCommon, DiyTable, DiyMyWork, DiyFlowIndex, DiyFlowDesign, DiyDesignList } from '@/utils/microi.net.import'
import Layout from '@/layout'
import { DiyOsClient } from '@/utils/itdos.osclient'
import _ from 'underscore'

/**
 * Use meta.role to determine if the current user has permission
 * @param roles
 * @param route
 */
function hasPermission(roles, route) {
    if (route.meta && route.meta.roles) {
        return roles.some(role => route.meta.roles.includes(role))
    } else {
        return true
    }
}
function GetComponent(item){
    if (DiyCommon.IsNull(item.ComponentPath)) {
        return null;
    }
    //如果是微服务，也要返回Null
    if (item.IsMicroiService) {
        return null;
    }
    //修复老数据
    if(item.ComponentPath.indexOf('/itdos/diy/') > -1){
        item.ComponentPath = item.ComponentPath.replace('/itdos/diy/','/diy/');
    }
    if(item.ComponentPath.length > 7 && item.ComponentPath.substring(0, 7) == '/views/'){
        item.ComponentPath = item.ComponentPath.replace('/views/','/');
    }
    if(item.ComponentPath.indexOf('diy-table-rowlist') > -1){
        return DiyTable;
    }
    if(item.ComponentPath.indexOf('microi/workflow/my-work') > -1){
        return DiyMyWork;
    }
    if(item.ComponentPath.indexOf('microi/workflow/index') > -1){
        return DiyFlowIndex;
    }
    if(item.ComponentPath.indexOf('diy/diy-table') > -1){
        return DiyDesignList;
    }
    return (resolve) => require(['@/views' + item.ComponentPath], resolve)
}
/**
 * 递归生成左则菜单模块  --by itdos.com
 * @param isFater 是否是顶级父亲菜单
 */
function MenuBuild(result, data, isFater) {
    data.forEach(item => {
        try {
            if(DiyCommon.IsNull(item.Url)){
                return;
            }
            item.Url = item.Url.trim();
            if(item.ComponentPath){
                item.ComponentPath = item.ComponentPath.trim();
            }
            if(item.Url.startsWith('/iframe/')){
                item.ComponentPath = '/diy/iframe';
                item.Url = '/iframe/' + encodeURIComponent(item.Url.replace('/iframe/', ''));
            }else{
                if(item.Url.indexOf('?') > -1){
                  //去掉?参数
                  item.UrlParam = item.Url.split('?')[1];
                  item.Url = item.Url.replace(/\?.*/, '');
                }
              }

            //将_Child下为空的Url干掉
            if (item._Child && item._Child.length > 0) {
                item._Child = _.filter(item._Child, function(child){
                    return !DiyCommon.IsNull(child.Url)
                });
            }
            var component = null
            var menu = {};
            //----定义 component  Start
            //如果是首次进来 ，第一级，那么一定是Layout组件
            if (isFater) {
                component = Layout;
                var menu = {
                    Id : item.Id,
                    Display: item.Display,
                    UrlParam : item.UrlParam,
                    Link: item.Link,
                    name : 'menu_' + DiyCommon.GuidRemoveSing(item.Id),
                    path : item.Url,
                    component : component,
                    meta : {
                        Id: item.Id,
                        DiyTableId : item.DiyTableId,
                        Display : item.Display,
                        UrlParam : item.UrlParam,
                        title : item.Name,
                        icon : item.IconClass ? item.IconClass : '',
                    },
                    children : [],
                };
                //如果没有下级，或只有一个下级
                if (
                    DiyCommon.IsNull(item._Child)
                    || item._Child.length == 0
                    //pengrui   [fix] 子菜单只有一个菜单项,且菜单为iframe时不生效
                    // || (item._Child.length == 1 && (DiyCommon.IsNull(item._Child[0]._Child) || item._Child[0]._Child.length == 0))
                    ) {
                    var coopyItem = (DiyCommon.IsNull(item._Child) || item._Child.length == 0) ? item : item._Child[0];
                    menu.children = [{
                                        Id : coopyItem.Id,
                                        Display: coopyItem.Display,
                                        UrlParam: coopyItem.UrlParam,
                                        Link: coopyItem.Link,
                                        path : coopyItem.Url,
                                        component : GetComponent(coopyItem),
                                        name : 'menu_' + DiyCommon.GuidRemoveSing(coopyItem.Id),
                                        meta : {
                                            Id: coopyItem.Id,
                                            DiyTableId: coopyItem.DiyTableId,
                                            Display:coopyItem.Display,
                                            UrlParam: coopyItem.UrlParam,
                                            title: coopyItem.Name,
                                            icon: coopyItem.IconClass ? coopyItem.IconClass : '',
                                        }
                                    }];
                    //注意一点：有下级的时候，father这级要设置alwaysShow
                    if(item._Child && item._Child.length == 1){
                        menu.alwaysShow  = true;
                    }
                    result.push(menu)
                }
                //如果有多个下级
                else if (
                    (item._Child && item._Child.length > 0)
                    ) {
                    menu.alwaysShow  = true;
                    MenuBuild(menu.children, item._Child, false)
                    result.push(menu)
                }
            }
            //如果不是第一级
            else{
                //如果没有下级，或只有一个下级
                if (DiyCommon.IsNull(item._Child)
                    || item._Child.length == 0
                    ) {
                    component = GetComponent(item);
                    var coopyItem = (DiyCommon.IsNull(item._Child) || item._Child.length == 0) ? item : item._Child[0];
                    var menu = {
                        Id : coopyItem.Id,
                        Display : coopyItem.Display,
                        UrlParam : coopyItem.UrlParam,
                        Link: coopyItem.Link,
                        path : coopyItem.Url,
                        name : 'menu_' + DiyCommon.GuidRemoveSing(coopyItem.Id),
                        meta : {
                            Id: coopyItem.Id,
                            DiyTableId : coopyItem.DiyTableId,
                            Display : coopyItem.Display,
                            UrlParam : coopyItem.UrlParam,
                            title : coopyItem.Name,
                            icon : coopyItem.IconClass ? coopyItem.IconClass : '',
                        },
                    };
                    if (component != null) {
                        menu.component = component;
                    }
                    result.push(menu)
                }
                else if(
                    (item._Child && item._Child.length > 0)
                    ){
                    component = (resolve) => require(['@/views/index'], resolve)
                    var menu = {
                        Id : item.Id,
                        Display : item.Display,
                        UrlParam : item.UrlParam,
                        Link: item.Link,
                        alwaysShow :true,
                        path : item.Url,
                        component : component,
                        name : 'menu_' + DiyCommon.GuidRemoveSing(item.Id),
                        meta : {
                            Id: item.Id,
                            DiyTableId : item.DiyTableId,
                            Display : item.Display,
                            UrlParam : item.UrlParam,
                            title : item.Name,
                            icon : item.IconClass ? item.IconClass : '',
                        },
                        children : [],
                    };
                    MenuBuild(menu.children, item._Child, false)
                    result.push(menu)
                }
            }
        } catch (error) {
            console.log('MenuBuild Error：')
            console.log(error)
        }
    })
}

/**
 * Filter asynchronous routing tables by recursion
 * @param routes asyncRoutes
 * @param roles
 */
export function filterAsyncRoutes(routes, roles) {
    const res = []

    routes.forEach(route => {
        const tmp = { ...route }
        if (hasPermission(roles, tmp)) {
            if (tmp.children) {
                tmp.children = filterAsyncRoutes(tmp.children, roles)
            }
            res.push(tmp)
        }
    })

    return res
}

const state = {
    routes: [],
    addRoutes: []
}

const mutations = {
    SET_ROUTES: (state, routes) => {
        state.addRoutes = routes
        state.routes = constantRoutes.concat(routes)
    }
}


const actions = {
    generateRoutes({ commit }, roles) {
        return new Promise(resolve => {
            // 从服务器端查询自定义功能模块
            var osClient = DiyOsClient.GetOsClient();
            DiyCommon.Post(DiyApi.GetSysMenuStep(), {
            // DiyCommon.Post(DiyApi.GetDiyTableRowTree, {
                OsClient: osClient,
                TableName: 'Sys_Menu',
                _OrderBy : 'Sort',
                _OrderByType : 'ASC'
                // Display: true
            }, function (result) {
                if (DiyCommon.Result(result)) {
                    var menuArr = []
                    MenuBuild(menuArr, result.Data, true)
                    // var menu = {
                    //     path : '/wf/flow-design/:Id',
                    //     component : Layout,
                    //     children : [{
                    //         path: '/wf/flow-design/:Id',
                    //         name: 'diy_form_page',
                    //         component: DiyFlowDesign
                    //     }],
                    // };
                    // menuArr.push(menu);
                    // debugger
                    menuArr.forEach(element => {
                        asyncRoutes.splice(asyncRoutes.length - 1, 0, element)
                    })

                    var fixedComponents = [];

                    fixedComponents.forEach(element => {
                        asyncRoutes.splice(asyncRoutes.length - 1, 0, element)
                    });

                    // 以下为默认代码
                    let accessedRoutes
                    if (roles.includes('admin')) {
                        accessedRoutes = asyncRoutes || []
                    } else {
                        accessedRoutes = filterAsyncRoutes(asyncRoutes, roles)
                    }
                    commit('SET_ROUTES', accessedRoutes)
                    //console.log("Menu Rsult:", accessedRoutes);
                    resolve(accessedRoutes)

                    // -----默认代码end
                }
            })
        })
    }
}

export default {
    namespaced: true,
    state,
    mutations,
    actions
}
