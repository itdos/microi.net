<template>
    <div class="diy-v8design">
        <el-button class="edit" @click="show" type="primary">编辑</el-button>

        <!-- 已输入的V8操作 -->
        <el-timeline :reverse="reverse">
            <el-timeline-item v-for="(activity, index) in engineList" :key="index" :timestamp="activity.code">
                {{ activity.title }}
            </el-timeline-item>
        </el-timeline>

        <!-- 弹窗，V8设计器 -->
        <el-dialog
            v-model="dialogShow"
            width="90vw"
            top="20px"
            :before-close="handleClose"
            title="V8引擎设计器"
            class="v8design-dialog diy-v8design"
            :close-on-click-modal="false"
            :modal-append-to-body="false"
            append-to-body
            draggable
            @open="onDialogOpen"
        >
            <el-tabs v-model="activeName">
                <div class="func-list">
                    <div>
                        <el-row class="tac">
                            <el-col :span="4" style="overflow-y: auto">
                                <el-select
                                    class="searchV8"
                                    v-model="value"
                                    filterable
                                    remote
                                    reserve-keyword
                                    placeholder="请输入关键词"
                                    :remote-method="remoteMethod"
                                    :loading="loading"
                                    @change="gofun"
                                >
                                    <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"> </el-option>
                                </el-select>
                                <el-menu class="el-menu-vertical-demo" :default-active="menuIndex" @open="handleSubMenuOpen">
                                    <ElSubMenu index="1">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>赋值功能</span>
                                        </template>
                                        <template v-if="openedSubmenus['1']">
                                            <el-menu-item v-for="(item, index) in fuzhi_menu_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="2">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>表单动作判断</span>
                                        </template>
                                        <template v-if="openedSubmenus['2']">
                                            <el-menu-item v-for="(item, index) in action_menu_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="3">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>数据库功能</span>
                                        </template>
                                        <template v-if="openedSubmenus['3']">
                                            <el-menu-item v-for="(item, index) in sql_menu_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="4">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>功能方法</span>
                                        </template>
                                        <template v-if="openedSubmenus['4']">
                                            <el-menu-item v-for="(item, index) in func_menu_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="5">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>子表操作</span>
                                        </template>
                                        <template v-if="openedSubmenus['5']">
                                            <el-menu-item v-for="(item, index) in child_table_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="6">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>请求接口</span>
                                        </template>
                                        <template v-if="openedSubmenus['6']">
                                            <el-menu-item v-for="(item, index) in get_post_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="7">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>其他</span>
                                        </template>
                                        <template v-if="openedSubmenus['7']">
                                            <el-menu-item v-for="(item, index) in other_menu_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="8">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>访问</span>
                                        </template>
                                        <template v-if="openedSubmenus['8']">
                                            <el-menu-item v-for="(item, index) in visit_menu_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                    <ElSubMenu index="9">
                                        <template #title>
                                            <el-icon><Menu /></el-icon>
                                            <span>流程引擎</span>
                                        </template>
                                        <template v-if="openedSubmenus['9']">
                                            <el-menu-item v-for="(item, index) in work_flow_data" :key="index" :index="item.index" @click="goFunc(item)">
                                                {{ item.title }}
                                            </el-menu-item>
                                        </template>
                                    </ElSubMenu>
                                </el-menu>
                            </el-col>
                            <el-col v-show="spanLeft > 0" :span="spanLeft" style="position: relative">
                                <!-- <el-button type="primary" class="changeBtn1" @click="changeLeft">最大化/还原</el-button> -->
                                <template v-for="(item, index) in fuzhi_menu_data" :key="'fuzhi-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`fuzhu-form${index}`" class="fieldset-form" 
                                            :model="form" label-width="auto" :rules="rules"
                                            :label-position="'left'"
                                            >
                                             <!-- label="功能描述" -->
                                            <el-form-item prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="字段名称" prop="name" v-if="activeIndex !== '1-3' && activeIndex !== '1-4'">
                                                <el-select v-model="form.name" placeholder="请选择">
                                                    <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in fields" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="属性" prop="sql" v-if="activeIndex == '1-1'">
                                                <el-select v-model="form.sql" placeholder="请选择">
                                                    <el-option :label="key" :value="key" v-for="(value, key, index) in fields[0]" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="字段名称" prop="msg" v-if="activeIndex == '1-3' || activeIndex == '1-4'">
                                                <el-input style="width: 100%" v-model="form.msg" placeholder="请输入"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="值" prop="value">
                                                <el-input style="width: 100%" v-model="form.value" placeholder="请输入"> </el-input>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <!--这里应该封装成统一的，不应该用cmObj1、cmObj2、cmObj3这种，性能低下。   --byanderson 2022-05-30 -->
                                                <!-- <div>注：可以直接在框里写代码，但请务必按照如下格式添加，否则该代码不会收录进汇总中！！！</div>
                                                <div>//## 功能方法名字（必填）, 描述（选填） START</div>
                                                <div>...你的代码</div>
                                                <div>//## 功能方法名字（必填） END</div> -->
                                                <div class="CodeMirror-code">
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码" ></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in action_menu_data" :key="'action-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`action-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="类型" prop="type">
                                                <el-select v-model="form.type" placeholder="请选择">
                                                    <el-option :label="value" :value="JSON.stringify([key, value])" v-for="(value, key, index) in typeList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj2" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in sql_menu_data" :key="'sql-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`sql-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <!-- <el-form-item label="sql语句" prop="sql">
                          <el-input type="textarea" :rows="3" v-model="form.sql" placeholder="请输入"></el-input>
                        </el-form-item> -->
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="选择表单" prop="name">
                                                <el-select v-model="form.name" placeholder="请选择" @change="formChange">
                                                    <el-option :label="value.Description" :value="value.Name" v-for="(value, index) in TableList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="全选字段">
                                                <el-switch v-model="form.all"> </el-switch>
                                            </el-form-item>
                                            <el-form-item v-if="!form.all" label="显示字段" prop="attr">
                                                <el-select v-model="form.attr" multiple placeholder="请选择">
                                                    <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in ziduanList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>

                                            <el-form-item label="选择条件">
                                                <el-col :span="6" style="margin-right: 10px">
                                                    <el-select v-model="form.value" placeholder="请选择">
                                                        <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in ziduanList" :key="index"> </el-option>
                                                    </el-select>
                                                </el-col>
                                                <el-col :span="4" style="margin-right: 10px">
                                                    <el-select v-model="form.title" placeholder="请选择">
                                                        <el-option label="等于" value="="></el-option>
                                                        <el-option label="含有" value="LIKE"></el-option>
                                                    </el-select>
                                                </el-col>
                                                <el-col :span="6" style="margin-right: 10px">
                                                    <el-input type="text" placeholder="请输入内容" v-model="form.okText"> </el-input>
                                                </el-col>
                                                <el-col :span="4" style="margin-right: 10px" v-if="sqlWhereA.length > 0">
                                                    <el-select v-model="form.page" placeholder="请选择">
                                                        <el-option label="并且" value="AND"></el-option>
                                                        <el-option label="或者" value="OR"></el-option>
                                                    </el-select>
                                                </el-col>
                                                <el-col :span="4">
                                                    <el-button type="primary" @click="Inset">添加</el-button>
                                                </el-col>
                                            </el-form-item>
                                            <el-form-item label="已选择">
                                                <div v-for="(item, index) in sqlWhereA" :key="index">
                                                    {{ item.name }}
                                                </div>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj3" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in func_menu_data" :key="'func-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`func-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="类型" prop="value" v-if="activeIndex == '4-10'">
                                                <el-input type="text" v-model="form.value" placeholder="请输入类型"> </el-input>
                                            </el-form-item>
                                            <el-form-item
                                                label="内容"
                                                prop="msg"
                                                v-if="activeIndex == '4-1' || activeIndex == '4-2' || activeIndex == '4-6' || activeIndex == '4-9' || activeIndex == '4-10'"
                                            >
                                                <el-input type="textarea" :rows="3" v-model="form.msg" placeholder="请输入"></el-input>
                                            </el-form-item>
                                            <el-form-item label="标题" prop="sql" v-if="activeIndex == '4-9' || activeIndex == '4-10'">
                                                <el-input type="text" v-model="form.sql" placeholder="请输入标题"></el-input>
                                            </el-form-item>
                                            <el-form-item label="确认按钮" prop="okText" v-if="activeIndex == '4-9'">
                                                <el-input type="text" v-model="form.okText" placeholder="请输入确认按钮文字"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="取消按钮" prop="cancelText" v-if="activeIndex == '4-9'">
                                                <el-input type="text" v-model="form.cancelText" placeholder="请输入取消按钮文字"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="全拼前几" prop="value" v-if="activeIndex == '4-2'">
                                                <el-input type="text" v-model="form.value" placeholder="请输入数字值"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="类型" prop="type" v-if="activeIndex == '4-1' || activeIndex == '4-2' || activeIndex == '4-7' || activeIndex == '4-8'">
                                                <el-select v-model="form.type" placeholder="请选择">
                                                    <el-option :label="value" :value="key" v-for="(value, key, index) in typeList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="页码" prop="page" v-if="activeIndex == '4-3'">
                                                <el-input type="number" v-model.number="form.page" placeholder="请输入数字，可为空"></el-input>
                                            </el-form-item>
                                            <el-form-item label="url" prop="url" v-if="activeIndex == '4-4' || activeIndex == '4-5'">
                                                <el-input type="text" v-model="form.url" placeholder="请输入"></el-input>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj4" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in child_table_data" :key="'child-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`child-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="子表名称" prop="name" v-if="activeIndex !== '5-2'">
                                                <el-select v-model="form.name" placeholder="请选择" @change="tableChange">
                                                    <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in childList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="页码" prop="page" v-if="activeIndex == '5-1'">
                                                <el-input type="number" v-model.number="form.page" placeholder="请输入数字，可为空"></el-input>
                                            </el-form-item>
                                            <el-form-item label="是否关闭" prop="value" v-if="activeIndex == '5-2'">
                                                <el-select v-model="form.value" placeholder="请选择">
                                                    <el-option label="关闭" value="true"></el-option>
                                                    <el-option label="不关闭" value="false"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="保存后" prop="type" v-if="activeIndex == '5-2'">
                                                <el-select v-model="form.type" placeholder="请选择">
                                                    <el-option :label="value" :value="key" v-for="(value, key, index) in typeList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="搜索条件" v-if="activeIndex == '5-3' || activeIndex == '5-4'">
                                                <el-col :span="8">
                                                    <el-form-item prop="attr">
                                                        <el-select v-model="form.attr" placeholder="请选择">
                                                            <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in nameList" :key="index"> </el-option>
                                                        </el-select>
                                                    </el-form-item>
                                                </el-col>
                                                <el-col :span="8">
                                                    <el-form-item prop="title">
                                                        <el-input type="text" v-model="form.title" placeholder="请输入"> </el-input>
                                                    </el-form-item>
                                                </el-col>
                                                <el-col :span="8" style="text-align: center">
                                                    <el-button type="primary" @click="addSearch('child')">添加</el-button>
                                                </el-col>
                                            </el-form-item>
                                            <el-form-item label="已添加" prop="value" v-if="activeIndex == '5-3' || activeIndex == '5-4'">
                                                <el-col style="display: none">{{ form.value }}</el-col>
                                                <el-col v-for="(item, index) in valueSearch" :key="index">
                                                    {{ item.label }} : {{ item.value }}
                                                    <el-button style="margin-left: 20px" @click="delSearch(item, index)">删除</el-button>
                                                </el-col>
                                            </el-form-item>
                                            <el-form-item label="显示字段" prop="attr" v-if="activeIndex == '5-5'">
                                                <el-select v-model="form.attr" placeholder="请选择" multiple>
                                                    <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in nameList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="选择字段" prop="attr" v-if="activeIndex == '5-6'">
                                                <el-select v-model="form.attr" placeholder="请选择">
                                                    <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in nameList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj5" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in get_post_data" :key="'ajax-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`ajax-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="url" prop="url" v-if="activeIndex == '6-1' || activeIndex == '6-2' || activeIndex == '6-3' || activeIndex == '6-4'">
                                                <el-input type="text" v-model="form.url" placeholder="请输入请求地址"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="表单名" prop="value" v-if="activeIndex == '6-5' || activeIndex == '6-6' || activeIndex == '6-7' || activeIndex == '6-8'">
                                                <!-- <el-input type="text" v-model="form.value" placeholder="请输入表单id（TableId）"></el-input> -->
                                                <el-select v-model="form.value" placeholder="请选择" @change="getTableRowId(form.value)">
                                                    <el-option :label="item.Description" :value="item.Id" v-for="(item, index) in TableList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="选择数据" prop="msg" v-if="activeIndex == '6-5' || activeIndex == '6-6' || activeIndex == '6-7' || activeIndex == '6-8'">
                                                <!-- <el-input type="text" v-model="form.msg" placeholder="请输入表单行id（TableRowId）"></el-input> -->
                                                <el-select v-model="form.msg" placeholder="请选择">
                                                    <el-option :label="item.Mingcheng" :value="item.Id" v-for="(item, index) in TableRowList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item
                                                label="参数"
                                                prop="params"
                                                v-if="activeIndex == '6-1' || activeIndex == '6-2' || activeIndex == '6-3' || activeIndex == '6-4' || activeIndex == '6-5'"
                                            >
                                                <el-input type="textarea" :rows="3" v-model="form.params" placeholder="请输入所需参数，json格式，请记得加{}"></el-input>
                                            </el-form-item>
                                            <el-form-item label="参数" prop="rowModel" v-if="activeIndex == '6-6' || activeIndex == '6-7'">
                                                <el-input type="textarea" :rows="3" v-model="form.rowModel" placeholder="请输入所需参数，json格式，请记得加{}"></el-input>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj6" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in other_menu_data" :key="'other-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`other-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item label="搜索条件" v-if="activeIndex == '7-1' || activeIndex == '7-2'">
                                                <el-col :span="8">
                                                    <el-form-item prop="attr">
                                                        <el-select v-model="form.attr" placeholder="请选择">
                                                            <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in childList" :key="index"> </el-option>
                                                        </el-select>
                                                    </el-form-item>
                                                </el-col>
                                                <el-col :span="8">
                                                    <el-form-item prop="title">
                                                        <el-input type="text" v-model="form.title" placeholder="请输入"> </el-input>
                                                    </el-form-item>
                                                </el-col>
                                                <el-col :span="8" style="text-align: center">
                                                    <el-button type="primary" @click="addSearch('other')">添加</el-button>
                                                </el-col>
                                            </el-form-item>
                                            <el-form-item label="已添加" prop="value" v-if="activeIndex == '7-1' || activeIndex == '7-2'">
                                                <el-col style="display: none">{{ form.value }}</el-col>
                                                <el-col v-for="(item, index) in valueSearch" :key="index">
                                                    {{ item.label }} : {{ item.value }}
                                                    <el-button style="margin-left: 20px" @click="delSearch(item, index)">删除</el-button>
                                                </el-col>
                                            </el-form-item>
                                            <el-form-item label="名称" prop="attr" v-if="activeIndex == '7-3' || activeIndex == '7-4'">
                                                <el-select v-model="form.attr" placeholder="请选择">
                                                    <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in childList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="参数" prop="value" v-if="activeIndex == '7-3'">
                                                <el-input type="textarea" :rows="3" v-model="form.value" placeholder="请输入所需参数，json格式"></el-input>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj7" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in visit_menu_data" :key="'visit-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`visit-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>
                                            <el-form-item
                                                label="字段名称"
                                                prop="name"
                                                v-if="
                                                    activeIndex !== '8-7' &&
                                                    activeIndex !== '8-8' &&
                                                    activeIndex !== '8-9' &&
                                                    activeIndex !== '8-10' &&
                                                    activeIndex !== '8-11' &&
                                                    activeIndex !== '8-13'
                                                "
                                            >
                                                <el-select v-model="form.name" placeholder="请选择">
                                                    <el-option :label="value.Label" :value="value.Name" v-for="(value, index) in fields" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="显示字段" prop="attr" v-if="activeIndex == '8-3'">
                                                <el-select v-model="form.attr" placeholder="请选择">
                                                    <el-option :label="key" :value="key" v-for="(value, key, index) in fields[0]" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="模式" prop="type" v-if="activeIndex == '8-8'">
                                                <el-select v-model="form.type" placeholder="请选择">
                                                    <el-option :label="value" :value="JSON.stringify([key, value])" v-for="(value, key, index) in typeList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj8" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                                <template v-for="(item, index) in work_flow_data" :key="'work-' + index">
                                    <div v-if="activeIndex == item.index">
                                    <div class="fieldset">
                                        <h3>{{ item.title }}</h3>
                                        <p>{{ item.cont }}</p>
                                        <el-form :ref="`work-form${index}`" class="fieldset-form" :model="form" label-width="80px" :rules="rules">
                                            <el-form-item label="功能描述" prop="miaoshu">
                                                <el-input style="width: 100%" type="textarea" :rows="2" placeholder="请输入该V8功能的描述" v-model="form.miaoshu"> </el-input>
                                            </el-form-item>

                                            <el-form-item label="流程图" prop="name">
                                                <el-select v-model="form.name" placeholder="请选择流程图">
                                                    <el-option :label="item.FlowName" :value="item.Id" v-for="(item, index) in liuchengList" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>
                                            <el-form-item label="线内容" prop="okText">
                                                <el-input type="text" v-model="form.okText" placeholder="请输入LineValue（只有一条线时可不传）"></el-input>
                                            </el-form-item>
                                            <!-- <el-form-item label="表单数据" prop="title">
                          <el-input type="text" v-model="form.title" placeholder="请输入FormData（可选，object类型）"></el-input>
                        </el-form-item>
                        <el-form-item label="关联数据" prop="value1">
                          <el-input type="text" v-model="form.value1" placeholder="请输入TableRowId（必传，默认为当前表单Id，V8.Form.Id）"></el-input>
                        </el-form-item> -->
                                            <el-form-item label="通知数据" prop="attr">
                                                <el-select v-model="form.attr" multiple placeholder="请选择">
                                                    <el-option :label="item.Label" :value="item.Id" v-for="(item, index) in fields" :key="index"></el-option>
                                                </el-select>
                                            </el-form-item>

                                            <el-form-item class="creae-code">
                                                <el-button type="primary" @click="onSubmit(item.name, item.index)">生成代码 </el-button>
                                                <el-button @click="resetForm(item.name)">重置</el-button>
                                                <el-button type="primary" @click="setCode">确认添加</el-button>
                                            </el-form-item>
                                            <!-- <el-form-item>
                                                <el-col style="font-size: 12px; color: #a5a5a5">{{ tips }}</el-col>
                                            </el-form-item> -->
                                            <el-form-item>
                                                <div class="CodeMirror-code">
                                                    <!-- <codemirror ref="cmObj9" v-model="form.code" placeholder="请生成代码" :options="cmOptions" /> -->
                                                    <el-input type="textarea" :rows="15" v-model="form.code" placeholder="请生成代码"></el-input>
                                                </div>
                                            </el-form-item>
                                        </el-form>
                                    </div>
                                </div>
                                </template>
                            </el-col>
                            <el-col v-show="spanRight > 0" :span="spanRight" style="border-left: 1px solid #e6e6e6; position: relative">
                                <!-- <el-button type="primary" class="changeBtn" @click="changeRight">最大化/还原</el-button> -->
                                <div style="padding: 20px">
                                    <DiyCodeEditor ref="diyCodeEditor" v-model="currentModel" :height="CodeEditorHeight"> </DiyCodeEditor>
                                </div>
                            </el-col>
                        </el-row>
                    </div>
                </div>
            </el-tabs>
        </el-dialog>
    </div>
</template>

<script>
import qs from "qs";
import { DiyCommon } from "@/utils/diy.common";
import { Menu } from "@element-plus/icons-vue";
import { ElMenu, ElSubMenu } from 'element-plus';

export default {
    name: "DiyV8Design",
    directives: {},
    components: {
        Menu,
        ElMenu,
        ElSubMenu
    },
    props: {
        fields: {
            type: Array,
            default: []
        },
        model: {
            type: String,
            defalut: ""
        }
    },
    watch: {
        model: function (newVal, oldVal) {
            if (oldVal != newVal) {
                this.currentModel = newVal;
                // this.CodeEditorObj.setValue(newVal);
                this.getV8();
            }
        },
        currentModel: function (newVal, oldVal) {
            this.$emit("update:model", newVal);
        }
    },
    data() {
        var checkUrl = (rule, value, callback) => {
            var re = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\*\+,;=.]+$/;
            if (!re.test(value)) {
                callback(new Error("请输入正确的url地址"));
            }
            callback();
        };
        return {
            CodeEditorObj: {},
            CodeEditorHeight: "500px",
            activeName: "first",
            reverse: true,
            engineList: [],
            dialogShow: false,
            isPreRendered: false, // 标记是否已预渲染
            editorLoaded: false, // 新增：编辑器加载状态
            openedSubmenus: {}, // 记录已打开的子菜单，用于懒加载
            fuzhi_menu_data: [
                {
                    name: "fuzhu-form0",
                    title: "给字段属性赋值",
                    index: "1-1",
                    cont: "V8.FieldSet('字段名称', '属性', '值');如：Name、Label、Config、Data(绑定数据源)、Readonly、Visible、Placeholder等",
                    code: "V8.FieldSet"
                },
                {
                    name: "fuzhu-form1",
                    title: "给字段赋值",
                    index: "1-2",
                    cont: "V8.FormSet('字段名称', '值')",
                    code: "V8.FormSet"
                },
                {
                    name: "fuzhu-form2",
                    title: "给父级表单字段赋值",
                    index: "1-3",
                    cont: "V8.ParentV8.FormSet('字段名称', '值')",
                    code: "V8.ParentV8.FormSet"
                },
                {
                    name: "fuzhu-form3",
                    title: "给父级表单的父级表单字段赋值",
                    index: "1-4",
                    cont: "V8.ParentV8.ParentV8.FormSet('字段名称', '值')",
                    code: "V8.ParentV8.ParentV8.FormSet"
                }
            ],
            action_menu_data: [
                {
                    name: "action-form0",
                    title: "离开表单类型",
                    index: "2-1",
                    cont: "V8.FormOutAction用于离开表单/提交表单后V8引擎，常用作判断条件,可能的值：Update/Insert/Close/Delete",
                    code: "V8.FormOutAction",
                    typeList: {
                        Update: "修改",
                        Insert: "新增",
                        Close: "关闭",
                        Delete: "删除"
                    }
                },
                {
                    name: "action-form1",
                    title: "离开表单后类型",
                    index: "2-2",
                    cont: "V8.FormOutAfterAction用于离开表单/提交表单后V8引擎，常用作判断条件,可能的值：Insert/Update/View/Close",
                    code: "V8.FormOutAfterAction",
                    typeList: {
                        Update: "修改",
                        Insert: "新增",
                        Close: "关闭",
                        View: "查看"
                    }
                },
                {
                    name: "action-form2",
                    title: "表单提交类型",
                    index: "2-3",
                    cont: "V8.FormSubmitAction表单提交类型，可赋值 V8.Result = false; 以阻止表单提交。（Insert/Update/Delete）",
                    code: "V8.FormSubmitAction",
                    typeList: {
                        Update: "修改",
                        Insert: "新增",
                        Delete: "删除"
                    }
                }
            ],
            func_menu_data: [
                {
                    name: "func-form0",
                    title: "弹出提示",
                    index: "4-1",
                    cont: "V8.Tips(msgContent, true/false)弹出提示，true为成功消息，false为错误消息",
                    code: "V8.Tips",
                    typeList: {
                        false: "错误",
                        true: "成功"
                    }
                },
                {
                    name: "func-form1",
                    title: "中文转拼音",
                    index: "4-2",
                    cont: "V8.ChineseToPinyin(chinese, fullPyLen, type)中文转拼音",
                    code: "V8.ChineseToPinyin",
                    typeList: {
                        1: "驼峰",
                        2: "全大写",
                        3: "全小写"
                    }
                },
                {
                    name: "func-form2",
                    title: "刷新表格",
                    index: "4-3",
                    cont: "V8.RefreshTable({ _PageIndex : -1 })：刷新表格。_PageIndex传入-1表示跳转到最后一页。",
                    code: "V8.RefreshTable"
                },
                {
                    name: "func-form3",
                    title: "页面跳转",
                    index: "4-4",
                    cont: "V8.Router.Push(url)：页面跳转",
                    code: "V8.Router.Push"
                },
                {
                    name: "func-form4",
                    title: "打开新页面",
                    index: "4-5",
                    cont: "V8.Window.Open(url)：打开新页面",
                    code: "V8.Window.Open"
                },
                {
                    name: "func-form5",
                    title: "是否为空",
                    index: "4-6",
                    cont: "V8.IsNull(value)：判断内容是否为空",
                    code: "V8.IsNull"
                },
                {
                    name: "func-form6",
                    title: "重新加载Form表单",
                    index: "4-7",
                    cont: "V8.ReloadForm：重新加载Form表单",
                    code: "V8.ReloadForm",
                    typeList: {
                        Edit: "编辑状态",
                        View: "查看状态"
                    }
                },
                {
                    name: "func-form7",
                    title: "隐藏编辑/删除按钮",
                    index: "4-8",
                    cont: "V8.HideFormBtn('Update/Delete')：用于隐藏编辑、删除按钮",
                    code: "V8.HideFormBtn",
                    typeList: {
                        Update: "编辑",
                        Delete: "删除"
                    }
                },
                {
                    name: "func-form8",
                    title: "确认提示框",
                    index: "4-9",
                    cont: "V8.ConfirmTips：确认提示框。",
                    code: "V8.ConfirmTips"
                },
                {
                    name: "func-form9",
                    title: "新增日志",
                    index: "4-10",
                    cont: "V8.AddSysLog：新增日志。",
                    code: "V8.AddSysLog"
                }
            ],
            child_table_data: [
                {
                    name: "child-form0",
                    title: "刷新子表",
                    index: "5-1",
                    cont: "V8.TableRefresh(V8.Field.子表Name, { _PageIndex : -1 }):_PageIndex传入-1表示跳转到最后一页",
                    code: "V8.TableRefresh"
                },
                {
                    name: "child-form1",
                    title: "提交表单",
                    index: "5-2",
                    cont: "V8.FormSubmit({CloseForm:true, SavedType:'Insert'})：提交表单。CloseForm是否关闭Form表单；SavedType保存表单后的操作Insert/Update/View",
                    code: "V8.FormSubmit",
                    typeList: {
                        Insert: "新增",
                        Update: "编辑",
                        View: "查看"
                    }
                },
                {
                    name: "child-form2",
                    title: "给子表添加搜索条件",
                    index: "5-3",
                    cont: "V8.TableSearchSet(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})给子表添加搜索条件",
                    code: "V8.TableSearchSet"
                },
                {
                    name: "child-form3",
                    title: "给子表追加搜索条件",
                    index: "5-4",
                    cont: "V8.TableSearchAppend(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})给子表追加搜索条件",
                    code: "V8.TableSearchAppend"
                },
                {
                    name: "child-form4",
                    title: "显示子表隐藏字段",
                    index: "5-5",
                    cont: "V8.ShowTableChildHideField将子表已隐藏的字段强制显示出来，并且刷新子表。",
                    code: "V8.ShowTableChildHideField"
                },
                {
                    name: "child-form5",
                    title: "获取子表字段数据",
                    index: "5-6",
                    cont: "V8.GetChildTableData('子表字段名称')获取子表该字段的数据",
                    code: "V8.GetChildTableData"
                }
            ],
            sql_menu_data: [
                {
                    name: "sql-form0",
                    title: "执行SQL查询",
                    index: "3-1",
                    cont: "V8.Sql(sql, callback)：执行SQL查询语句",
                    code: "V8.Sql"
                },
                {
                    name: "sql-form1",
                    title: "执行SQL更新",
                    index: "3-2",
                    cont: "V8.SqlUpdate(sql, callback)：执行SQL更新语句",
                    code: "V8.SqlUpdate"
                },
                {
                    name: "sql-form2",
                    title: "执行SQL删除",
                    index: "3-3",
                    cont: "V8.SqlDelete(sql, callback)：执行SQL删除语句",
                    code: "V8.SqlDelete"
                },
                {
                    name: "sql-form3",
                    title: "执行SQL插入",
                    index: "3-4",
                    cont: "V8.SqlInsert(sql, callback)：执行SQL插入语句",
                    code: "V8.SqlInsert"
                }
            ],
            get_post_data: [
                {
                    name: "ajax-form0",
                    title: "发起post请求",
                    index: "6-1",
                    cont: "V8.Post(url, param, callback)：发起post请求",
                    code: "V8.Post"
                },
                {
                    name: "ajax-form1",
                    title: "发起get请求",
                    index: "6-2",
                    cont: "V8.Get(url, param, callback)：发起get请求",
                    code: "V8.Get"
                },
                {
                    name: "ajax-form2",
                    title: "发起post同步请求",
                    index: "6-3",
                    cont: "V8.PostAsync：发起post同步请求",
                    code: "V8.PostAsync"
                },
                {
                    name: "ajax-form3",
                    title: "发起get同步请求",
                    index: "6-4",
                    cont: "V8.GetAsync：发起get同步请求",
                    code: "V8.GetAsync"
                },
                {
                    name: "ajax-form4",
                    title: "获取一条表单数据",
                    index: "6-5",
                    cont: "V8.GetDiyTableRow：获取一条表单数据",
                    code: "V8.GetDiyTableRow"
                },
                {
                    name: "ajax-form5",
                    title: "编辑一条表单数据",
                    index: "6-6",
                    cont: "V8.UptDiyTableRow：编辑一条表单数据",
                    code: "V8.UptDiyTableRow"
                },
                {
                    name: "ajax-form6",
                    title: "新增一条表单数据",
                    index: "6-7",
                    cont: "V8.AddDiyTableRow：新增一条表单数据",
                    code: "V8.AddDiyTableRow"
                },
                {
                    name: "ajax-form7",
                    title: "删除一条表单数据",
                    index: "6-8",
                    cont: "V8.DelDiyTableRow：删除一条表单数据",
                    code: "V8.DelDiyTableRow"
                }
            ],
            other_menu_data: [
                {
                    name: "other-form0",
                    title: "Tabs设置搜索条件",
                    index: "7-1",
                    cont: "V8.SearchSet:({FieldName : value, FieldName2 : value})Tabs设置搜索条件",
                    code: "V8.SearchSet"
                },
                {
                    name: "other-form1",
                    title: "Tabs追加搜索条件",
                    index: "7-2",
                    cont: "V8.SearchAppend:({FieldName : value, FieldName2 : value})Tabs追加搜索条件",
                    code: "V8.SearchAppend"
                },
                {
                    name: "other-form2",
                    title: "向定制组件传数据",
                    index: "7-3",
                    cont: "V8.FieldSet('FieldName', 'DataAppend', {});向定制组件传数据定制组件接收：props: { DataAppend : { type : Object,default: () => {} } };定制组件回传数据至Form：self.$emit('FormSet', fieldName, value)",
                    code: "V8.FieldSet"
                },
                {
                    name: "other-form3",
                    title: "模板引擎部分参考语法",
                    index: "7-4",
                    cont: "模板引擎部分参考语法：var html = `<div>${V8.Form.FieldName}</div>`; V8.Result = html;",
                    code: "var html = "
                }
            ],
            visit_menu_data: [
                {
                    name: "visit-form0",
                    title: "当前表单所有字段",
                    index: "8-1",
                    cont: "V8.Form:访问当前表单所有字段。例如：V8.Form.字段名称",
                    code: "V8.Form"
                },
                {
                    name: "visit-form1",
                    title: "当前表单修改前的所有字段",
                    index: "8-2",
                    cont: "V8.OldForm:访问当前表单修改前的所有字段。例如：V8.OldForm.字段名称",
                    code: "V8.OldForm"
                },
                {
                    name: "visit-form2",
                    title: "当前表单所有Field对象",
                    index: "8-3",
                    cont: "V8.Field:访问当前表单所有Field对象。例如：V8.Field.字段名称.Visible",
                    code: "V8.Field"
                },
                {
                    name: "visit-form3",
                    title: "下拉框选择后的值对象",
                    index: "8-4",
                    cont: "V8.ThisValue：访问下拉框选择后的值对象。例如：V8.ThisValue.属性",
                    code: "V8.ThisValue"
                },
                {
                    name: "visit-form4",
                    title: "当前登录用户信息",
                    index: "8-5",
                    cont: "V8.CurrentUser：访问当前登录用户信息。例如：V8.CurrentUser.属性",
                    code: "V8.CurrentUser"
                },
                {
                    name: "visit-form5",
                    title: "获取已选择的行数组",
                    index: "8-6",
                    cont: "V8.TableRowSelected：获取已选择的行数组，每行包含了所有数据。例如：V8.TableRowSelected.属性",
                    code: "V8.TableRowSelected"
                },
                {
                    name: "visit-form6",
                    title: "父级表单所有字段",
                    index: "8-7",
                    cont: "V8.ParentForm：访问父级表单所有字段。例如：V8.ParentForm.属性",
                    code: "V8.ParentForm"
                },
                {
                    name: "visit-form7",
                    title: "当前Form打开的模式",
                    index: "8-8",
                    cont: "V8.FormMode：当前Form打开的模式",
                    code: "V8.FormMode",
                    typeList: {
                        Add: "新增",
                        Edit: "编辑",
                        View: "查看"
                    }
                },
                {
                    name: "visit-form8",
                    title: "当前Form的Id",
                    index: "8-9",
                    cont: "V8.TableRowId：当前Form的Id",
                    code: "V8.TableRowId"
                },
                {
                    name: "visit-form9",
                    title: "当前DIY表的Id",
                    index: "8-10",
                    cont: "V8.TableId：获取当前DIY表的Id",
                    code: "V8.TableId"
                },
                {
                    name: "visit-form10",
                    title: "键盘事件",
                    index: "8-11",
                    cont: "V8.KeyCode：键盘事件V8可获取键盘的code值，如Enter键对应13",
                    code: "V8.KeyCode"
                },
                {
                    name: "visit-form11",
                    title: "当前表的数据",
                    index: "8-12",
                    cont: "V8.CurrentTableData：获取当前表数据，V8.CurrentTableData.字段名",
                    code: "V8.CurrentTableData"
                },
                {
                    name: "visit-form12",
                    title: "当前表的父级表单数据",
                    index: "8-13",
                    cont: "V8.ParentV8.CurrentTableData 获取当前表的父级表单数据，V8.ParentV8.CurrentTableData.字段名",
                    code: "V8.ParentV8.CurrentTableData"
                }
            ],
            work_flow_data: [
                {
                    name: "work-form0",
                    title: "发起流程引擎",
                    index: "9-1",
                    cont: "V8.WorkFlow.StartWork:V8发起流程引擎函数",
                    code: "V8.WorkFlow.StartWork"
                }
            ],
            activeIndex: "1-1",
            form: {
                name: "",
                attr: "",
                value: "",
                code: "",
                type: "",
                sql: "",
                msg: "",
                page: "",
                url: "",
                title: "",
                okText: "",
                cancelText: "",
                params: "",
                active: {},
                all: false,
                value1: "",
                title1: "",
                okText1: "",
                page1: "",
                miaoshu: ""
            },
            rules: {
                name: [{ required: true, message: "请选择", trigger: "change" }],
                attr: [{ required: true, message: "请选择", trigger: "blur" }],
                value: [{ required: true, message: "请输入值", trigger: "blur" }],
                sql: [{ required: true, message: "请输入值", trigger: "blur" }],
                type: [{ required: true, message: "请选择", trigger: "change" }],
                msg: [{ required: true, message: "请输入值", trigger: "blur" }],
                url: [
                    { required: true, message: "请输入值", trigger: "blur" },
                    { validator: checkUrl, trigger: "blur" }
                ],
                rowModel: [{ required: true, message: "请输入值", trigger: "blur" }]
            },
            typeList: {},
            childList: [],
            nameList: [],
            valueSearch: [],
            TableList: [],
            TableRowList: [],
            ziduanList: [],
            sqlWhereA: [],
            liuchengList: [],
            tips: "注：请先[生成代码]，确认无误后再[确认添加]！",
            currentModel: this.model,
            spanLeft: 6,
            spanRight: 14,
            cmOptions: {
                // 所有参数配置见：https://codemirror.net/doc/manual.html#config
                tabSize: 4,
                styleActiveLine: true,
                lineNumbers: true,
                line: true,
                foldGutter: true,
                styleSelectedText: true,
                mode: "text/javascript",
                // keyMap: "sublime",
                matchBrackets: true,
                showCursorWhenSelecting: true,
                theme: "base16-dark",
                extraKeys: {
                    Ctrl: "autocomplete"
                },
                hintOptions: {
                    completeSingle: false
                },
                lineWrapping: true // 自动换行
            },
            options: [],
            value: [],
            list: [],
            loading: false,
            menuIndex: "",
            https: ""
        };
    },
    mounted() {
        // 延迟500ms后预渲染，避免影响页面初始加载
        setTimeout(() => {
            if (!this.isPreRendered) {
                this.dialogShow = true;
                this.$nextTick(() => {
                    // 预渲染后立即关闭
                    setTimeout(() => {
                        this.dialogShow = false;
                        this.isPreRendered = true;
                    }, 100);
                });
            }
        }, 500);
    },
    methods: {
        // 代码提示方法(返回一个数组)
        createTips() {
            return [
                {
                    label: "SetValue", //显示的提示名称
                    insertText: 'SetValue("text")' //选择后粘贴到编辑器中的文字
                }
            ];
        },
        show() {
            this.dialogShow = true;
            this.isPreRendered = true; // 标记已渲染
            var aa = localStorage.getItem("Microi.ChangeShow");
            if (aa == "left") {
                this.spanLeft = 20;
                this.spanRight = 0;
            } else if (aa == "right") {
                this.spanLeft = 0;
                this.spanRight = 20;
            } else {
                this.spanLeft = 6;
                this.spanRight = 14;
            }
        },
        SetCodeEditorHeight() {
            var self = this;
            // self.CodeEditorHeight = $(".v8design-dialog:visible .tac.el-row").height() - 50 + "px";
            // self.CodeEditorHeight = $('.v8design-dialog:visible .el-dialog__body').height() + 'px';
            // self.CodeEditorHeight = $('.tac.el-row').height() + "px";
        },
        handleClose(done) {
            done();
        },
        // 对话框打开时的回调
        onDialogOpen() {
            this.isPreRendered = true;
        },
        // 子菜单打开时记录，实现懒加载
        handleSubMenuOpen(index) {
            this.openedSubmenus[index] = true;
        },
        goFunc(item) {
            this.activeIndex = item.index;
            // console.log(item,1111,this.activeIndex)
            this.form.active = item;
            this.resetForm(item.name);

            if (item.index) {
                if (item.index.includes("2-") || item.index.includes("4-1") || item.index.includes("4-7") || item.index.includes("4-8") || item.index.includes("5-2") || item.index.includes("8-8")) {
                    this.typeList = item.typeList;
                }

                if (item.index.includes("4-2")) {
                    this.typeList = item.typeList;
                    this.form.value = 2;
                }

                // 找出子表字段赋值
                if (item.index.includes("5-")) {
                    this.childList = [];
                    this.fields.map((item) => {
                        if (item.Component == "TableChild") {
                            this.childList.push(item);
                        }
                    });
                    // console.log(this.childList)
                }

                // 找出该表字段赋值
                if (item.index.includes("7-")) {
                    this.childList = [];
                    this.fields.map((item) => {
                        this.childList.push(item);
                    });
                }

                if (item.index.includes("3-") || item.index == "6-5" || item.index == "6-6" || item.index == "6-7" || item.index == "6-8") {
                    this.getFormList();
                }

                if (item.index.includes("9-")) {
                    this.getLiucheng();
                }
            }

            var self = this;
            self.$nextTick(function () {
                if (self.$refs.cmObj1) {
                    self.$refs.cmObj1.map((it) => {
                        it.refresh();
                    });
                }
                if (self.$refs.cmObj2) {
                    self.$refs.cmObj2.map((it) => {
                        it.refresh();
                    });
                }
                if (self.$refs.cmObj3) {
                    self.$refs.cmObj3.map((it) => {
                        it.refresh();
                    });
                }
                if (self.$refs.cmObj4) {
                    self.$refs.cmObj4.map((it) => {
                        it.refresh();
                    });
                }
                if (self.$refs.cmObj5) {
                    self.$refs.cmObj5.map((it) => {
                        it.refresh();
                    });
                }
                if (self.$refs.cmObj6) {
                    self.$refs.cmObj6.map((it) => {
                        it.refresh();
                    });
                }
                if (self.$refs.cmObj7) {
                    self.$refs.cmObj7.map((it) => {
                        it.refresh();
                    });
                }
                if (self.$refs.cmObj8) {
                    self.$refs.cmObj8.map((it) => {
                        it.refresh();
                    });
                }
            });
        },
        onSubmit(formName, type) {
            // console.log(formName,type,this.$refs[formName][0])
            this.$refs[formName][0].validate((valid) => {
                if (valid) {
                    var formlist = this.form;

                    // var codeStat = '//--code START \n\n'

                    var title = "",
                        code = "";

                    // 赋值部分
                    if (type.includes("1-")) {
                        this.fuzhi_menu_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };

                        if (formlist.sql) {
                            var txt = code + "('" + formlist.name + "','" + formlist.sql + "','" + formlist.value + "') \n";
                        } else if (type == "1-3" || type == "1-4") {
                            var txt = code + "('" + formlist.msg + "','" + formlist.value + "') \n";
                        } else {
                            var txt = code + "('" + formlist.name + "','" + formlist.value + "') \n";
                        }
                    }

                    // 表单动作部分
                    if (type.includes("2-")) {
                        this.action_menu_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };
                        var txt = "// 当前表单选择 " + JSON.parse(formlist.type)[1] + " 时 \nif (" + code + " == '" + JSON.parse(formlist.type)[0] + "') { \n  // your code... \n \n \n} \n";
                    }

                    // sql功能部分
                    if (type.includes("3-")) {
                        this.sql_menu_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };

                        var sql = "",
                            aa = "";

                        if (formlist.all) {
                            sql = "SELECT * FROM " + formlist.name;
                        } else {
                            formlist.attr.map((item, i) => {
                                if (i == 0) {
                                    aa = item;
                                } else {
                                    aa = aa + "," + item;
                                }
                            });

                            sql = "SELECT " + aa + " FROM " + formlist.name;
                        }

                        if (this.sqlWhereAStr) {
                            sql = sql + " WHERE " + this.sqlWhereAStr;
                        }

                        var txt = code + "('" + sql + "',\nfunction(data){ \n  // your code... \n\n\n})\n";
                    }

                    // 功能方法
                    if (type.includes("4-")) {
                        this.func_menu_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };
                        if (type == "4-2") {
                            var txt = code + "('" + formlist.msg + "'," + formlist.value + "," + formlist.type + ")\n";
                        }
                        if (type == "4-1") {
                            var txt = code + "('" + formlist.msg + "'," + formlist.type + ")\n";
                        }
                        if (type == "4-3") {
                            if (formlist.page) {
                                var txt = code + "({_PageIndex:" + formlist.page + "})\n";
                            } else {
                                var txt = code + "()\n";
                            }
                        }
                        if (type == "4-4" || type == "4-5") {
                            var txt = code + "('" + formlist.url + "')\n";
                        }
                        if (type == "4-6") {
                            var txt = code + "('" + formlist.msg + "')\n";
                        }
                        if (type == "4-7") {
                            var txt = code + "(V8.TableRowId,'" + formlist.type + "')\n";
                        }
                        if (type == "4-8") {
                            var txt = code + "('" + formlist.type + "')\n";
                        }
                        if (type == "4-9") {
                            var txt =
                                code +
                                "('" +
                                formlist.msg +
                                "',\nfunction(){\n  //点击确认后，可执行...\n\n},\nfunction(){\n  //点击取消后，可执行...\n\n},\n{Title:'" +
                                formlist.title +
                                "',OkText:'" +
                                formlist.okText +
                                "',CancelText:'" +
                                formlist.cancelText +
                                "',Icon:''})\n";
                        }
                        if (type == "4-10") {
                            var txt = code + "({Type:'" + formlist.value + "',Title:'" + formlist.sql + "',Content:'" + formlist.msg + "'})\n";
                        }
                    }

                    // 子表操作
                    if (type.includes("5-")) {
                        this.child_table_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };

                        if (type == "5-1") {
                            if (formlist.page) {
                                var txt = code + "(V8.Field." + formlist.name + ",{_PageIndex:" + formlist.page + "})\n";
                            } else {
                                var txt = code + "(V8.Field." + formlist.name + ",{})\n";
                            }
                        }
                        if (type == "5-2") {
                            var txt = code + "({CloseForm:" + formlist.value + ",SavedType:'" + formlist.type + "'})\n";
                        }
                        if (type == "5-3" || type == "5-4") {
                            var txt = code + "(V8.Field." + formlist.name + "," + formlist.value + ")\n";
                        }
                        if (type == "5-5") {
                            var aa = "";
                            formlist.attr.map((item, i) => {
                                if (i == 0) {
                                    aa = "'" + item + "'";
                                } else {
                                    aa += ",'" + item + "'";
                                }
                            });
                            aa = "[" + aa + "]";
                            var txt = code + "('" + formlist.name + "'," + aa + ")\n";
                        }
                        if (type == "5-6") {
                            var txt = code + "('" + formlist.attr + "')\n";
                        }
                    }

                    //接口请求
                    if (type.includes("6-")) {
                        this.get_post_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };

                        if (type == "6-1" || type == "6-2") {
                            if (formlist.params) {
                                var txt = code + "('" + formlist.url + "',\n" + formlist.params + ",function(result){\n\n\n})\n";
                            } else {
                                var txt = code + "('" + formlist.url + "',\n{},function(result){\n  //your code...\n\n})\n";
                            }
                        }
                        if (type == "6-3" || type == "6-4") {
                            var txt1 = "";
                            if (type == "6-3") {
                                txt1 = "await ";
                            }
                            if (formlist.params) {
                                var txt = "var result = " + txt1 + code + "('" + formlist.url + "'," + formlist.params + ")\n";
                            } else {
                                var txt = "var result = " + txt1 + code + "('" + formlist.url + "',{})\n";
                            }
                        }
                        if (type == "6-5") {
                            if (formlist.params) {
                                var txt = code + "({TableId:'" + formlist.value + "',_TableRowId:'" + formlist.msg + "',_FormData:" + formlist.params + "},function(data){\n  //your code...\n\n})\n";
                            } else {
                                var txt = code + "({TableId:'" + formlist.value + "',_TableRowId:'" + formlist.msg + "'},function(data){\n  //your code...\n\n})\n";
                            }
                        }
                        if (type == "6-6" || type == "6-7") {
                            var txt = code + "({TableId:'" + formlist.value + "',_TableRowId:'" + formlist.msg + "',_FormData:" + formlist.rowModel + "},function(data){\n  //your code...\n\n})\n";
                        }
                        if (type == "6-8") {
                            var txt = code + "({TableId:'" + formlist.value + "',_TableRowId:'" + formlist.msg + "'},function(data){\n  //your code...\n\n})\n";
                        }
                    }

                    //其他
                    if (type.includes("7-")) {
                        this.other_menu_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };

                        if (type == "7-1" || type == "7-2") {
                            var txt = code + "(" + formlist.value + ")\n";
                        }
                        if (type == "7-3") {
                            var txt = code + "('" + formlist.attr + "','DataAppend'," + formlist.value + ")\n";
                        }
                        if (type == "7-4") {
                            var txt = code + "'<div>V8.Form." + formlist.attr + "</div>';\n\nV8.Result = html;\n";
                        }
                    }

                    // 访问
                    if (type.includes("8-")) {
                        this.visit_menu_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };

                        if (type == "8-3") {
                            var txt = code + "." + formlist.name + "." + formlist.attr + "\n";
                        } else if (type == "8-7") {
                            var txt = code + "\n";
                        } else if (type == "8-8") {
                            var txt = "// 当前表单选择 " + JSON.parse(formlist.type)[1] + " 时 \nif (" + code + " == '" + JSON.parse(formlist.type)[0] + "') { \n  // your code... \n \n \n} \n";
                        } else if (type == "8-9" || type == "8-10" || type == "8-11" || type == "8-13") {
                            var txt = code + "\n";
                        } else {
                            var txt = code + "." + formlist.name + "\n";
                        }
                    }

                    // 流程引擎部分
                    if (type.includes("9-")) {
                        this.work_flow_data.map((ite) => {
                            if (ite.index == type) {
                                title = ite.title;
                                code = ite.code;
                            }
                        });
                        var start = "\n//##" + title + "," + (this.form.miaoshu || code) + " START\n";
                        var end = "//##" + title + " END\n\n";

                        this.form.active = {
                            title: title,
                            code: this.form.miaoshu || code
                        };

                        var abb = [];
                        formlist.attr.map((item) => {
                            this.fields.map((ite) => {
                                if (item == ite.Id) {
                                    abb.push({
                                        Id: ite.Id,
                                        Name: ite.Name,
                                        Label: ite.Label,
                                        Value: "V8.Form." + ite.Name
                                    });
                                }
                            });
                        });

                        var abbString = "";

                        abb.map((item) => {
                            abbString += "{Id:'" + item.Id + "',Name:'" + item.Name + "',Label:'" + item.Label + "',Value:" + item.Value + "},";
                        });

                        var txt =
                            "v8.WorkFlow.StartWork({\n FlowDesignId:'" +
                            formlist.name +
                            "',\n LineValue:'" +
                            formlist.okText +
                            "',\n FormData:{},\n TableRowId:V8.Form.Id,\n NoticeFields:[" +
                            abbString +
                            "]\n}, function(result){\n //这是回调函数处理，result返回了Receivers、ToNodeName等\n});\n";

                        console.log(txt);
                    }

                    // 最后拼接
                    formlist.code = start + txt + end;
                } else {
                    console.log("error submit!!");
                    return false;
                }
            });
        },
        resetForm(formName) {
            this.$refs[formName][0].resetFields();
            // this.form.code = ''
            this.form = {
                name: "",
                attr: "",
                value: "",
                code: "",
                type: "",
                sql: "",
                msg: "",
                page: "",
                url: "",
                title: "",
                okText: "",
                cancelText: "",
                params: "",
                active: {},
                all: false,
                value1: "",
                title1: "",
                okText1: "",
                page1: ""
            };
            this.nameList = [];
            this.valueSearch = [];
            this.sqlWhereA = [];
            this.sqlWhereAStr = "";
        },
        // 子表更换后重新获取该子表字段
        tableChange(e) {
            // console.log(e)
            var self = this;
            this.form.attr = "";
            this.form.code = "";
            this.valueSearch = [];

            var aa = "";
            this.fields.map((item) => {
                if (item.Name == e) {
                    aa = item.Config;
                }
            });

            // console.log(JSON.parse(aa).TableChildTableId)

            this.$axios
                .post(
                    this.https + "/api/diyfield/getDiyField",
                    qs.stringify({
                        TableId: JSON.parse(aa).TableChildTableId
                    }),
                    {
                        headers: {
                            authorization: "Bearer " + DiyCommon.getToken(),
                            "content-type": "application/x-www-form-urlencoded",
                            did: this.newGuid()
                        }
                    }
                )
                .then(function (response) {
                    if (response.data.Code == 1) {
                        self.nameList = response.data.Data;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        },
        // 给子表添加搜索条件
        addSearch(type) {
            // console.log('搜索条件key--',this.form.attr,'搜索条件value--',this.form.title)
            var aa = "";

            if (type == "other") {
                this.childList.map((item) => {
                    if (item.Name == this.form.attr) {
                        aa = item.Label;
                    }
                });
            } else if (type == "child") {
                this.nameList.map((item) => {
                    if (item.Name == this.form.attr) {
                        aa = item.Label;
                    }
                });
            }

            // 添加到已添加部分显示
            if (this.form.attr && this.form.title) {
                if (this.form.value.includes(this.form.attr)) {
                    this.$message({
                        message: "已存在相同条件，请删除后再重新添加！",
                        type: "warning"
                    });
                } else {
                    this.valueSearch.push({
                        key: this.form.attr,
                        value: this.form.title,
                        label: aa
                    });

                    if (this.valueSearch.length == 1) {
                        this.form.value = "{" + this.valueSearch[0].key + ":'" + this.valueSearch[0].value + "'}";
                    } else {
                        this.form.value = "";
                        this.valueSearch.map((item, i) => {
                            if (i == 0) {
                                this.form.value += item.key + ":'" + item.value + "'";
                            } else {
                                this.form.value += "," + item.key + ":'" + item.value + "'";
                            }
                        });
                        this.form.value = "{" + this.form.value + "}";
                    }
                }

                // console.log('最终form.value----',this.form.value)
            } else {
                this.$message({
                    message: "请填写完整后再添加！",
                    type: "warning"
                });
            }
        },
        // 删除子表搜索条件
        delSearch(item, index) {
            this.valueSearch.splice(index, 1);
            this.form.value = "";
            if (this.valueSearch.length > 0) {
                this.valueSearch.map((item, i) => {
                    if (i == 0) {
                        this.form.value += item.key + ":" + item.value;
                    } else {
                        this.form.value += "," + item.key + ":" + item.value;
                    }
                });
                this.form.value = "{" + this.form.value + "}";
            }
        },
        // 最后确认添加代码到V8中
        setCode() {
            var aa = this.model;
            var reg = /(\/\/##=?)(\S*)(?= START)/gi;

            if (reg.test(this.form.code)) {
                if (this.form.active.title) {
                    if (this.engineList.length == 0) {
                        this.engineList.push(this.form.active);
                    } else {
                        this.engineList.unshift(this.form.active);
                    }

                    if (aa) {
                        aa += this.form.code;
                        this.$emit("update:model", aa);
                    } else {
                        aa = this.form.code;
                        this.$emit("update:model", aa);
                    }

                    this.currentModel = aa;
                    // this.CodeEditorObj.setValue(aa);
                } else {
                    this.$message({
                        message: "如果想直接添加，需要在[代码汇总]里添加！",
                        type: "warning"
                    });
                }
            } else {
                this.$message({
                    message: "请确认代码结果的格式！",
                    type: "warning"
                });
            }
        },
        newGuid() {
            // Crockford's Base32字母表（无I、L、O、U）
            const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

            // 生成安全的随机字符
            function getRandomChar() {
                // 优先使用crypto API
                if (window.crypto && window.crypto.getRandomValues) {
                    const buffer = new Uint8Array(1);
                    window.crypto.getRandomValues(buffer);
                    return ENCODING[buffer[0] % 32];
                }

                // 后备方案
                const rand = Math.floor(Math.random() * 32);
                return ENCODING[rand];
            }

            // 1. 时间戳部分（10个字符，48位毫秒时间戳）
            let time = Date.now();
            let timePart = "";

            for (let i = 0; i < 10; i++) {
                const mod = time % 32;
                timePart = ENCODING[mod] + timePart;
                time = Math.floor(time / 32);
            }

            // 2. 随机部分（16个字符）
            let randomPart = "";
            for (let i = 0; i < 16; i++) {
                randomPart += getRandomChar();
            }

            return timePart + randomPart; // 26字符的ULID
            var guid = "";
            for (var i = 1; i <= 32; i++) {
                var n = Math.floor(Math.random() * 16.0).toString(16);
                guid += n;
                if (i == 8 || i == 12 || i == 16 || i == 20) guid += "-";
            }
            return guid;
        },
        // 解析已有的V8代码赋值到时间线
        getV8() {
            // console.log(this.model)
            this.engineList = [];
            if (this.currentModel) {
                var substr = this.currentModel.match(/(\/\/##=?)(\S*)(?= START)/gi);
            }
            // console.log(substr);
            if (substr) {
                var bb = substr.map((item) => {
                    var aa = item.match(/(\/\/##=?)(\S*)/);
                    return aa[2];
                });

                // console.log(bb)
                var cc = bb.map((item) => {
                    var list = item.split(",");
                    return {
                        title: list[0],
                        code: list[1]
                    };
                });
                // console.log(cc)

                this.engineList = cc.reverse();
            }
        },
        // 数据库操作--获取所有表单列表
        getFormList() {
            var self = this;
            // console.log('数据库sql-------')
            this.$axios
                .post(
                    this.https + "/api/diytable/getDiyTable",
                    qs.stringify({
                        _Keyword: ""
                    }),
                    {
                        headers: {
                            authorization: "Bearer " + DiyCommon.getToken(),
                            "content-type": "application/x-www-form-urlencoded",
                            did: this.newGuid()
                        }
                    }
                )
                .then(function (response) {
                    if (response.data.Code == 1) {
                        self.TableList = response.data.Data;
                    }
                });
        },
        // 数据库操作--获取选择表单的字段
        formChange(e) {
            this.form.attr = "";
            this.form.value = "";
            this.form.title = "";
            this.form.okText = "";
            this.form.page = "";
            this.sqlWhereAStr = "";
            this.sqlWhereA = [];
            // console.log(2222,e)
            var aa = "",
                self = this;
            this.TableList.map((item) => {
                if (item.Name == e) {
                    aa = item.Id;
                }
            });

            if (aa) {
                this.$axios
                    .post(
                        this.https + "/api/diyfield/getDiyField",
                        qs.stringify({
                            TableId: aa
                        }),
                        {
                            headers: {
                                authorization: "Bearer " + DiyCommon.getToken(),
                                "content-type": "application/x-www-form-urlencoded",
                                did: this.newGuid()
                            }
                        }
                    )
                    .then(function (response) {
                        if (response.data.Code == 1) {
                            self.ziduanList = response.data.Data;
                        }
                    });
            }
        },
        // 获取一条数据--获取tablerowid
        getTableRowId(id) {
            var self = this;
            this.$axios
                .post(
                    this.https + "/api/diytable/getDiyTableRow",
                    qs.stringify({
                        _Keyword: "",
                        TableId: id
                    }),
                    {
                        headers: {
                            authorization: "Bearer " + DiyCommon.getToken(),
                            "content-type": "application/x-www-form-urlencoded",
                            did: this.newGuid()
                        }
                    }
                )
                .then(function (response) {
                    if (response.data.Code == 1) {
                        self.TableRowList = response.data.Data;
                    }
                });
        },
        // 数据库操作-新增条件
        Inset() {
            if (this.form.title == "" || this.form.value == "" || this.form.okText == "") {
                this.$message({
                    message: "请选择完整！",
                    type: "warning"
                });
                return false;
            }
            if (this.sqlWhereA.length > 0 && this.form.page == "") {
                this.$message({
                    message: "请选择完整！",
                    type: "warning"
                });
                return false;
            }
            if (this.sqlWhereA.length < 2) {
                var aa = "",
                    bb = "";
                this.ziduanList.map((item) => {
                    if (item.Name == this.form.value) {
                        bb = item.Label;
                    }
                });
                if (this.form.title == "=") {
                    aa = this.form.page + " " + this.form.value + " " + this.form.title + " '" + this.form.okText + "' ";
                    if (this.form.page) {
                        bb = (this.form.page == "AND" ? "并且 " : "或者 ") + bb + ": " + this.form.okText;
                    } else {
                        bb = bb + ": " + this.form.okText;
                    }
                } else {
                    aa = this.form.page + " " + this.form.value + " " + this.form.title + " '%" + this.form.okText + "%' ";
                    if (this.form.page) {
                        bb = (this.form.page == "AND" ? "并且 " : "或者 ") + bb + ": " + this.form.okText;
                    } else {
                        bb = bb + ": " + this.form.okText;
                    }
                }

                this.sqlWhereAStr += aa;
                this.sqlWhereA.push({
                    str: aa,
                    name: bb
                });

                this.form.value = "";
                this.form.title = "";
                this.form.okText = "";
                this.form.page = "";
            } else {
                this.$message({
                    message: "暂时只支持最多2个条件！",
                    type: "warning"
                });
            }
        },
        modelChange(e) {
            this.$emit("update:model", e);

            this.getV8();
        },
        // 切换显示
        changeRight() {
            if (this.spanLeft == 10) {
                this.spanLeft = 0;
                this.spanRight = 20;
                localStorage.setItem("Microi.ChangeShow", "right");
            } else {
                this.spanLeft = 10;
                this.spanRight = 10;
                localStorage.setItem("Microi.ChangeShow", "center");
            }
        },
        changeLeft() {
            if (this.spanLeft == 10) {
                this.spanLeft = 20;
                this.spanRight = 0;
                localStorage.setItem("Microi.ChangeShow", "left");
            } else {
                this.spanLeft = 6;
                this.spanRight = 14;
                localStorage.setItem("Microi.ChangeShow", "center");
            }
        },
        remoteMethod(query) {
            if (query !== "") {
                // console.log(11111,query)
                this.loading = true;
                setTimeout(() => {
                    this.loading = false;
                    this.options = this.list.filter((item) => {
                        return item.label.toLowerCase().indexOf(query.toLowerCase()) > -1;
                    });
                    // console.log(33333,this.options)
                }, 200);
            } else {
                this.options = [];
            }
        },
        gofun(e) {
            var item = JSON.parse(e);
            this.activeIndex = item.index;
            this.menuIndex = item.index;
            this.form.active = item;
            this.resetForm(item.name);

            if (item.index) {
                if (item.index.includes("2-") || item.index.includes("4-1") || item.index.includes("4-7") || item.index.includes("4-8") || item.index.includes("5-2") || item.index.includes("8-8")) {
                    this.typeList = item.typeList;
                }

                if (item.index.includes("4-2")) {
                    this.typeList = item.typeList0;
                    this.form.value = 2;
                }

                // 找出子表字段赋值
                if (item.index.includes("5-")) {
                    this.childList = [];
                    this.fields.map((item) => {
                        if (item.Component == "TableChild") {
                            this.childList.push(item);
                        }
                    });
                    // console.log(this.childList)
                }

                // 找出该表字段赋值
                if (item.index.includes("7-")) {
                    this.childList = [];
                    this.fields.map((item) => {
                        this.childList.push(item);
                    });
                }

                if (item.index.includes("3-") || item.index == "6-5" || item.index == "6-6" || item.index == "6-7" || item.index == "6-8") {
                    this.getFormList();
                }
            }
        },
        thatList() {
            this.list = [];
            var aa = [];

            aa[0] = this.fuzhi_menu_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });
            aa[1] = this.action_menu_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });
            aa[2] = this.sql_menu_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });
            aa[3] = this.func_menu_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });
            aa[4] = this.child_table_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });
            aa[5] = this.get_post_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });
            aa[6] = this.other_menu_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });
            aa[7] = this.visit_menu_data.map((item) => {
                return {
                    value: `${JSON.stringify(item)}`,
                    label: `${item.title},${item.code}`
                };
            });

            for (let i = 0; i < 8; i++) {
                aa[i].map((item) => {
                    this.list.push(item);
                });
            }

            // console.log(2222,this.list)
        },
        // 获取系统地址
        getDiyApiBase() {
            if (localStorage.getItem("Microi.ApiBase")) {
                this.https = localStorage.getItem("Microi.ApiBase");
            } else {
                this.https = "https://api-china.itdos.com";
            }
        },
        // 获取流程引擎列表
        getLiucheng() {
            var self = this;
            this.$axios
                .post(
                    this.https + "/api/diytable/getDiyTableRow",
                    qs.stringify({
                        TableId: "9b4f95be-8a22-41b3-9cf7-1f7a94fe2127"
                    }),
                    {
                        headers: {
                            authorization: "Bearer " + DiyCommon.getToken(),
                            "content-type": "application/x-www-form-urlencoded",
                            did: this.newGuid()
                        }
                    }
                )
                .then(function (response) {
                    if (response.data.Code == 1) {
                        self.liuchengList = response.data.Data;
                    }
                });
        }
    },
    mounted() {
        this.getDiyApiBase();
        this.getV8();
        this.thatList();
    }
};
</script>

<style lang="scss" scoped>
.CodeMirror-code{
    width:100%;
}
.diy-v8design {
    .creae-code{
        margin-top:20px;
    }
    //如果3100，会导致设计器里面有下拉框（在body层）被挡住。但不设置3100，设计器又会被编辑器挡住。
    z-index: 3100 !important;
    .fieldset {
        padding: 10px;
        overflow-y: auto;
        // max-height: 670px;
        line-height: 22px;

        .fieldset-form {
            margin-top: 10px;
        }
        :deep(.el-form-item.el-form-item--default){
            margin-bottom: 18px;
        }
    }

    .func-list {
        // height: 700px;
        height: 100%;
        overflow: hidden;
    }

    .el-timeline {
        padding: 0;
    }

    .edit {
        margin-bottom: 20px;
    }

    .el-timeline-item__timestamp {
        color: #a5a5a5;
        font-size: 12px;
    }

    .el-dialog__body {
        padding: 0px 20px 30px;
    }

    .codetips {
        font-size: 14px;
        color: #a5a5a5;
        margin-bottom: 5px;
    }

    .el-menu {
        border-right: 0;
    }

    .changeBtn {
        // position: absolute;
        // right: 0;
        // top: 0;
        // z-index: 999;
        margin-left: 30px;
    }

    .changeBtn1 {
        position: absolute;
        right: 20px;
        top: 0;
        z-index: 999;
    }

    .el-menu-vertical-demo {
        margin-top: 30px;
    }

    .searchV8 {
        width: 250px;
        position: fixed;
        z-index: 999;
        padding-left: 20px;
    }
}
</style>
