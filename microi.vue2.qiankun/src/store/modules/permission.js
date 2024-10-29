import { asyncRoutes, constantRoutes } from '@/router'
import { DiyApi } from 'microi.net'
import { DiyCommon } from 'microi.net'
import { DosCommon } from 'microi.net'
import Layout from '@/layout'
// import { DiyOsClient } from '@/utils/itdos.osclient'
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
    if (DosCommon.IsNull(item.ComponentPath)) {
        return null;    
    }
    if(item.ComponentPath.length > 7 && item.ComponentPath.substring(0, 7) == '/views/'){
        item.ComponentPath = item.ComponentPath.replace('/views/','/');
    }
    if(item.ComponentPath.indexOf('/itdos/diy/') > -1){
        item.ComponentPath = item.ComponentPath.replace('/itdos/diy/','/diy/');
    }
    return (resolve) => require(['@/views' + item.ComponentPath], resolve)
}
function MenuBuild(result, data, isFater) {
    data.forEach(item => {
        try {
            if(DosCommon.IsNull(item.Url)){
                return;
            }
            item.Url = item.Url.trim();
            if(item.ComponentPath){
                item.ComponentPath = item.ComponentPath.trim();
            }
            if(item.Url.startsWith('/iframe/')){
                item.ComponentPath = '/diy/iframe';
                item.Url = '/iframe/' + encodeURIComponent(item.Url.replace('/iframe/', ''));
            }
            if (item._Child && item._Child.length > 0) {
                item._Child = _.filter(item._Child, function(child){
                    return !DosCommon.IsNull(child.Url)
                });
            }
            var component = null
            var menu = {};
            if (isFater) {
                component = Layout;
                if (DosCommon.IsNull(item._Child) || item._Child.length == 0 || item._Child.length == 1) {
                    var coopyItem = (DosCommon.IsNull(item._Child) || item._Child.length == 0) ? item : item._Child[0];

                    var menu = {
                        Id : item.Id,
                        Display : item.Display,
                        Link: item.Link,
                        path : coopyItem.Url,
                        component : component,
                        children : [{
                                Id : coopyItem.Id,
                                Display: coopyItem.Display,
                                Link: coopyItem.Link,
                                path : coopyItem.Url,
                                component : (resolve) => require(['@/views' + coopyItem.ComponentPath], resolve), //GetComponent(coopyItem),
                                name : 'menu_' + DiyCommon.GuidRemoveSing(coopyItem.Id),
                                meta : {
                                    Id: coopyItem.Id,
                                    DiyTableId: coopyItem.DiyTableId,
                                    Display:coopyItem.Display,
                                    title: coopyItem.Name,
                                    icon: coopyItem.IconClass ? coopyItem.IconClass : '', 
                                }
                            }
                        ],
                    };
                    result.push(menu)
                }
                if (item._Child && item._Child.length > 1) {
                    var menu = {
                        Id : item.Id,
                        Display : item.Display,
                        Link: item.Link,
                        path : item.Url,
                        component : component,
                        name : 'menu_' + DiyCommon.GuidRemoveSing(item.Id),
                        meta : {
                            Id: item.Id,
                            DiyTableId : item.DiyTableId,
                            Display : item.Display,
                            title : item.Name,
                            icon : item.IconClass ? item.IconClass : '', 
                        },
                        children : [],
                    };
                    MenuBuild(menu.children, item._Child, false)
                    result.push(menu)
                }
            }
            else{
                if (DosCommon.IsNull(item._Child) || item._Child.length == 0 || item._Child.length == 1) {
                    component = (resolve) => require(['@/views' + item.ComponentPath], resolve); //GetComponent(item);
                    var coopyItem = (DosCommon.IsNull(item._Child) || item._Child.length == 0) ? item : item._Child[0];
                    var menu = {
                        Id : item.Id,
                        Display : coopyItem.Display,
                        Link: item.Link,
                        path : coopyItem.Url,
                        name : 'menu_' + DiyCommon.GuidRemoveSing(coopyItem.Id),
                        meta : {
                            Id: coopyItem.Id,
                            DiyTableId : coopyItem.DiyTableId,
                            Display : coopyItem.Display,
                            title : coopyItem.Name,
                            icon : coopyItem.IconClass ? coopyItem.IconClass : '', 
                        },
                    };
                    if (component != null) {
                        menu.component = component;
                    }
                    result.push(menu)
                }
                if(item._Child && item._Child.length > 1){
                    component = (resolve) => require(['@/views/index'], resolve)
                    var menu = {
                        Id : item.Id,
                        Display : item.Display,
                        Link: item.Link,
                        path : item.Url,
                        component : component,
                        name : 'menu_' + DiyCommon.GuidRemoveSing(item.Id),
                        meta : {
                            Id: item.Id,
                            DiyTableId : item.DiyTableId,
                            Display : item.Display,
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
            var osClient = DiyCommon.GetOsClient();
            DiyCommon.Post(DiyApi.GetSysMenuStep(), {
                OsClient: osClient,
            }, function (result) {
                if (DiyCommon.Result(result)) {
                    var menuArr = []
                    
                    MenuBuild(menuArr, result.Data, true)
                    console.log('------> asyncRoutes:', asyncRoutes);
                    menuArr.forEach(element => {
                        asyncRoutes.splice(asyncRoutes.length - 1, 0, element)
                    })
                    console.log('------> asyncRoutes 2:', asyncRoutes);
                    var fixedComponents = [];

                    fixedComponents.forEach(element => {
                        asyncRoutes.splice(asyncRoutes.length - 1, 0, element)
                    });

                    

                    let accessedRoutes
                    if (roles.includes('admin')) {
                        accessedRoutes = asyncRoutes || []
                    } else {
                        accessedRoutes = filterAsyncRoutes(asyncRoutes, roles)
                    }
                    commit('SET_ROUTES', accessedRoutes)
                    console.log("Menu Rsult Child:", accessedRoutes);
                    resolve(accessedRoutes)
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
