import { DiyCommon } from '@/utils/diy.common'
import diyTableRowlistProps from './diy-table-rowlist-props'
import _ from 'lodash'
import { debounce } from 'lodash'
export default {
  watch: {
    language: {
      handler: function (newVal, oldVal) {
        // 当user对象内部属性变化时，这里会触发
        console.log('language changed:', newVal)
        var self = this
        self.PageType = self.$route.query.PageType
        if (self.ParentFormLoadFinish !== false) self.Init()
      },
      deep: true // 开启深度监听
    },
    PropsWhere: function (newVal, oldVal) {
      var self = this
      if (!_.isEqual(newVal, oldVal)) self.Init()
    },
    ParentFormLoadFinish: function (newVal, oldVal) {
      var self = this
      if (newVal === true) self.Init()
    },
    TableChildSysMenuId: function (newVal, oldVal) {
      var self = this
      if (self.ParentFormLoadFinish !== false) self.Init()
    },
    TableChildFkFieldName: function (newVal, oldVal) {
      var self = this
      if (self.ParentFormLoadFinish !== false) self.Init()
    },
    PrimaryTableFieldName: function (newVal, oldVal) {
      var self = this
      if (self.ParentFormLoadFinish !== false) self.Init()
    },
    //当此控件为子表时，父form关闭弹层时，这个值会变成'‘空值，也会再一次执行这里的watch
    TableChildTableRowId: function (newVal, oldVal) {
      var self = this
      if (!self.DiyCommon.IsNull(newVal)) {
        // self.SetFieldFormDefaultValues(newVal);
        if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
          self.SetFieldFormDefaultValues(newVal)
        } else {
          //2022-07-23新增也可能不跟主表的Id进行关联
          if (self.PrimaryTableFieldName) {
            self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName])
          } else {
            self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id)
          }
        }
      } else {
        //2022-02-17 有可能二次开发传过来的FormDefaultValues
        self.FieldFormDefaultValues = { ...self.FormDefaultValues }
      }
      //2022-07-13注释
      if (self.ParentFormLoadFinish !== false) {
        //如果主表重新打开了其它的rowModel，Field-Form的TableChildTableRowId会变，这里监控到需要重新加载数据
        self.Init()
      }
    },
    FatherFormModel: function (newVal, oldVal) {
      var self = this
      if (!self.DiyCommon.IsNull(newVal)) {
        // self.SetFieldFormDefaultValues(self.TableChildTableRowId);
        if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
          self.SetFieldFormDefaultValues(self.TableChildTableRowId)
        } else {
          //2022-07-23新增也可能不跟主表的Id进行关联
          if (self.PrimaryTableFieldName) {
            self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName])
          } else {
            self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id)
          }
        }
      } else {
        //2022-02-17 有可能二次开发传过来的FormDefaultValues
        self.FieldFormDefaultValues = { ...self.FormDefaultValues }
      }
    },
    TableChildField: function (newVal, oldVal) {
      var self = this
    }
  },
  computed: {
    headersAuth() {
      return { authorization: 'Bearer ' + DiyCommon.Authorization() }
    }
  },
  props: diyTableRowlistProps.props,
  mounted() {},
  methods: {
    elTableColWidth(field, fieldIndex, ShowDiyFieldList) {
      const chose1 = DiyCommon.IsNull(field.TableWidth)
      const chose2 = fieldIndex == ShowDiyFieldList.length - 1 ? '' : field.TableWidth
      return chose1 || chose2
    },
    templateVhtml(field, scope) {
      return (
        !DiyCommon.IsNull(field.V8TmpEngineTable) &&
        scope.row[field.Name + '_TmpEngineResult'] !== undefined
      )
    },
    //可传入外键Id值 、父表model
    Init(parentFormModel, v8) {
      var self = this

      if (self.IsTableChild()) {
      }
      var queryKeyword = self.$route.query.Keyword

      if (!self.DiyCommon.IsNull(queryKeyword)) {
        self.Keyword = queryKeyword
      }
      if (self.EnableMultipleSelect === true) {
        self.TableEnableBatch = true
      }
      //这是传过来的父级formModel，用于子表关联数据，里面也包含了FkId，就是parentFormModel.Id
      if (parentFormModel) {
        self.FatherFormModel_Data = parentFormModel
        // self.FatherFormModel = parentFormModel;
      }
      if (v8) {
        // self.ParentV8 = v8;
        self.ParentV8_Data = v8
      }
      self.DiyTableRowList = []
      //如果是子表
      if (!self.DiyCommon.IsNull(self.TableChildTableId)) {
        self.TableId = self.TableChildTableId
      } else if (!self.DiyCommon.IsNull(self.PropsTableId)) {
        self.TableId = self.PropsTableId
      } else {
        self.TableId = self.$route.meta.DiyTableId
      }
      if (!self.DiyCommon.IsNull(self.TableChildSysMenuId)) {
        self.SysMenuId = self.TableChildSysMenuId
      } else if (!self.DiyCommon.IsNull(self.PropsSysMenuId)) {
        self.SysMenuId = self.PropsSysMenuId
      } else {
        self.SysMenuId = self.$route.meta.Id
      }
      if (
        (!self.DiyCommon.IsNull(self.TableChildTableRowId) &&
          !self.DiyCommon.IsNull(self.TableChildFkFieldName)) ||
        !self.DiyCommon.IsNull(self.FatherFormModel_Data)
        // || !self.DiyCommon.IsNull(self.FatherFormModel)
      ) {
        if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
          // if (self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
          self.SetFieldFormDefaultValues(self.TableChildTableRowId)
        } else {
          //2022-07-23新增也可能不跟主表的Id进行关联
          if (self.PrimaryTableFieldName) {
            self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName])
          } else {
            self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id)
          }
          // self.SetFieldFormDefaultValues(self.FatherFormModel.Id);
        }
      } else {
        //2022-02-17 有可能二次开发传过来的FormDefaultValues
        self.FieldFormDefaultValues = { ...self.FormDefaultValues }
      }
      // 取缓存中的DiyTableRowPageSize
      try {
        var cacheDiyTableRowPageSize = localStorage.getItem('DiyTableRowPageSize_' + self.TableId)
        if (!self.DiyCommon.IsNull(cacheDiyTableRowPageSize)) {
          self.DiyTableRowPageSize = Number(cacheDiyTableRowPageSize)
        }
      } catch (error) {
        self.DiyTableRowPageSize = 10
      }
      //这里修改，应该是先取SysMenuModel，再取DiyTableRow数据，因为SysMenuModel可能包含Tabs设置的条件
      self.GetAllData()

      self.$nextTick(function () {
        self.SetDiyTableMaxHeight()
      })
    },
    GetDiyTableRow(recParam) {
      //   this.TableMultipleSelection = [];
      //   this.$refs["diy-table-" + this.TableId].clearSelection();
      //   this._GetDiyTableRow(obj, this);
      // },
      // _GetDiyTableRow: debounce((recParam, self) => {
      var self = this
      this.TableMultipleSelection = []
      this.$refs['diy-table-' + this.TableId].clearSelection()
      self.tableLoading = true
      //2023-06-29：如果是表单设计模式，无需获取数据
      if (self.LoadMode == 'Design') {
        //---------处理需要真实显示的字段
        //注意：执行此句的时候，一定要保证 GetDiyField 已经执行完毕，所以在GetDiyField的时候，也需要调用一下这个方法？
        var tempShowDiyFieldList = self.GetShowDiyFieldList()
        //--------
        self.tableLoading = false
        return
      }
      if (recParam) {
        if (recParam.SearchCheckbox) {
          self.SearchCheckbox = recParam.SearchCheckbox
        }
        if (recParam.SearchModel) {
          self.SearchModel = recParam.SearchModel
        }
        if (recParam.SearchNumber) {
          self.SearchNumber = recParam.SearchNumber
        }
        if (recParam.SearchDateTime) {
          self.SearchDateTime = recParam.SearchDateTime
        }
      }

      self.TempBtnIsVisible = []

      if (typeof recParam == 'boolean' && recParam === true) {
        self.DiyTableRowPageIndex = 1
      } else if (!self.DiyCommon.IsNull(recParam)) {
        if (!self.DiyCommon.IsNull(recParam._PageIndex)) {
          if (recParam._PageIndex == -1) {
            //算出最后一页
            if (self.DiyTableRowCount != 0) {
              self.DiyTableRowPageIndex = Math.ceil(
                self.DiyTableRowCount / self.DiyTableRowPageSize
              )
            }
          } else {
            self.DiyTableRowPageIndex = recParam._PageIndex
          }
        }
      }
      var param = {
        // TableId: self.TableId,
        // TableName : self.CurrentDiyTableModel.Name,
        // FormEngineKey : self.CurrentDiyTableModel.Name,
        // _Keyword: self.Keyword,
        // _PageIndex: self.DiyTableRowPageIndex,
        // _PageSize: self.DiyTableRowPageSize,
        // _SysMenuId: self.SysMenuId,
        ModuleEngineKey: self.SysMenuModel.ModuleEngineKey,
        _OrderBy: self._OrderBy,
        _OrderByType: self._OrderByType
      }
      //2023-06-39：子表可关闭分页
      if (
        !self.TableChildConfig ||
        (self.TableChildConfig && !self.TableChildConfig.DisablePagination)
      ) {
        param._PageIndex = self.DiyTableRowPageIndex
        param._PageSize = self.DiyTableRowPageSize
      }

      if (recParam && recParam._Where && recParam._Where.length > 0) {
        param._Where = recParam._Where
        self.SearchWhere = param._Where
      } else if (recParam && recParam._Where && recParam._Where.length == 0) {
        self.SearchWhere = []
        delete param._Where
      } else if (self.SearchWhere.length > 0) {
        param._Where = self.SearchWhere
      } else {
        self.SearchWhere = []
        delete param._Where
      }

      if (self.PropsWhere && self.PropsWhere.length > 0) {
        param._Where = self.PropsWhere
      }

      if (self.Keyword) {
        param._Keyword = self.Keyword
      }

      // if(!param.TableName){
      //先设置模块引擎Key
      if (!param.ModuleEngineKey) {
        param.ModuleEngineKey = self.SysMenuId
      }
      //如果仍然不存在模块引擎Key，设置表单引擎Key
      if (!param.ModuleEngineKey) {
        param.FormEngineKey = self.CurrentDiyTableModel.Name
      }
      if (!param.ModuleEngineKey && !param.FormEngineKey) {
        param.FormEngineKey = self.TableId
      }

      //注意：这个是由主表传过来的主表行Id，需要在这里子表加入条件：where 外键Id=TableChildFkFieldName
      if (!self.DiyCommon.IsNull(self.TableChildFkFieldName)) {
        // param[self.TableChildFkFieldName] = self.TableChildFkValue;
        //2021-10-25 新增：如果是传过来的父级formModel，以这个为准
        if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
          // if (!self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
          // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
          // // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel.Id;
          //2022-02-14 关联表修改为等值条件
          //2022-07-23新增也可能不跟主表的Id进行关联
          if (self.PrimaryTableFieldName) {
            self.SearchEqual[self.TableChildFkFieldName] =
              self.FatherFormModel_Data[self.PrimaryTableFieldName]
          } else {
            self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id
          }
        } else {
          // self.SearchModel[self.TableChildFkFieldName] = self.TableChildTableRowId;
          //2022-02-14 关联表修改为等值条件
          self.SearchEqual[self.TableChildFkFieldName] = self.TableChildTableRowId
        }
      }

      //判断外部传来的新增条件SearchAppend
      if (!self.DiyCommon.IsNull(self.SearchAppend)) {
        for (const key in self.SearchAppend) {
          self.V8SearchModel[key] = self.SearchAppend[key]
        }
      }

      // //这里需要判断 V8SearchModel
      // if(!self.DiyCommon.IsNull(self.SearchSet)){
      //     self.V8SearchModel = self.SearchSet;
      // }

      //这里需要判断 V8SearchModel
      if (!self.DiyCommon.IsNull(self.V8SearchModel)) {
        for (const key in self.V8SearchModel) {
          self.SearchModel[key] = self.V8SearchModel[key]
        }
      }

      //2022-07-26新增 url 参数 _SearchDateTime 搜索条件
      var _searchDateTime = self.$route.query._SearchDateTime
      if (_searchDateTime) {
        var _searchDateTimeArr = _searchDateTime.split('|')
        if (_searchDateTimeArr.length == 3) {
          self.SearchDateTime[_searchDateTimeArr[0]] = [
            _searchDateTimeArr[1],
            _searchDateTimeArr[2]
          ]
        }
      }

      if (self.SearchModel && !_.isEqual(self.SearchModel, {})) {
        param._Search = self.SearchModel
      }
      if (self.SearchEqual && !_.isEqual(self.SearchEqual, {})) {
        param._SearchEqual = self.SearchEqual
      }
      if (self.SearchCheckbox && !_.isEqual(self.SearchCheckbox, {})) {
        param._SearchCheckbox = self.SearchCheckbox
      }
      if (self.SearchDateTime && !_.isEqual(self.SearchDateTime, {})) {
        param._SearchDateTime = self.SearchDateTime
      }
      if (self.SearchNumber) {
        for (let key in self.SearchNumber) {
          if (self.SearchNumber[key].Min || self.SearchNumber[key].Max) {
            param._SearchNumber = self.SearchNumber
            break
          }
        }
      }
      //判断模块引擎是否配置了查询接口替换
      var url = self.DiyApi.GetDiyTableRow
      if (self.CurrentDiyTableModel.IsTree) {
        url = self.DiyApi.GetDiyTableRowTree
      } else {
        url =
          '/api/FormEngine/getTableData-' +
          (param.ModuleEngineKey || param.FormEngineKey).replace(/\_/g, '-').toLowerCase()
      }
      // url = '/api/diytable/getDiyTableRowTree';
      if (self.SysMenuModel.DiyConfig && self.SysMenuModel.DiyConfig.SelectApi) {
        url = self.SysMenuModel.DiyConfig.SelectApi
      }
      //2024-04-24：如果是报表引擎，通过数据源引擎获取数据
      if (self.CurrentDiyTableModel.ReportId && self.CurrentDiyTableModel.DataSourceId) {
        url = '/api/DataSourceEngine/Run'
        param.DataSourceKey = self.CurrentDiyTableModel.DataSourceId
      }
      self.DiyCommon.Post(url, param, async function (result) {
        self.tableLoading = false
        if (self.DiyCommon.Result(result)) {
          //统计列的值，后来应该改成单独接口
          if (result.DataAppend && !self.DiyCommon.IsNull(result.DataAppend.StatisticsFields)) {
            self.StatisticsFields = result.DataAppend.StatisticsFields
          } else {
            self.StatisticsFields = null
          }

          //---------处理需要真实显示的字段
          //注意：执行此句的时候，一定要保证 GetDiyField 已经执行完毕，所以在GetDiyField的时候，也需要调用一下这个方法？
          var tempShowDiyFieldList = self.GetShowDiyFieldList()
          //--------

          //2021-08-30 新增：获取到数据后，提前处理好表格模板引擎
          //后来没这样干了，因为规定表格模板引擎不允许使用await，所以暂时还是在表格中每行渲染，其实后面还是应该提前渲染
          //并且后来发现如果这里要提前处理，那么后面使用V8.Form.字段取到的值是模板渲染后的值？这时候其实要赋值另外一个属性，如FieldName_TmpEngineResult
          //在2022-03-23重新开启这个功能，提前处理好模板引擎，不在表格中循环处理
          // self.ShowDiyFieldList.forEach(field => {
          await Promise.all(
            tempShowDiyFieldList.map(async field => {
              if (!self.DiyCommon.IsNull(field.V8TmpEngineTable)) {
                await Promise.all(
                  result.Data.map(async row => {
                    var tmpResult = await self.RunFieldTemplateEngine(field, row)
                    if (tmpResult !== false) {
                      row[field.Name + '_TmpEngineResult'] = tmpResult
                    }
                  })
                )
              }
            })
          )
          //之前是每行在 GetMoreBtnsGroup 函数处理
          //提前计算出行外、行更多内按钮分组，以及IsVisible，同时也要计算出当前所有行数据最大的行外按钮数量，以设置表格操作列的宽度
          self.MaxRowBtnsOut = 0

          // self.DiyTableRowList = [];

          //2022-07-02 处理可能为树形的结构。
          await self.DiguiDiyTableRowDataList(result.Data)
          self.DiyTableRowList = result.Data
          self.DiyTableRowCount = result.DataCount

          // self.$nextTick(() => {
          //   let tableRefName = "diy-table-" + self.TableId;
          //   let TableMultipleSelection = self.TableMultipleSelection;
          //   console.log("TableMultipleSelection", TableMultipleSelection);
          //   // self.$refs[tableRefName].clearSelection();
          //   // const flatArr = self.DiyTableRowList.flat(Infinity);
          //   // lodash 根据_Child 拍平数组
          //   const flatArr = _.flatMapDeep(self.DiyTableRowList, (item) => [
          //     item,
          //     _.get(item, "_Child", []),
          //   ]);

          //   console.log(flatArr);

          //   TableMultipleSelection.forEach((item) => {
          //     // flatmap DiyTableRowList
          //     flatArr.forEach((it) => {
          //       if (it.Id === item.Id) {
          //         console.log(it.Id, item.Id);
          //         self.$refs[tableRefName].toggleRowSelection(item, true);
          //       }
          //     });
          //   });
          // });

          if (result.DataAppend && result.DataAppend.NotSaveField) {
            self.NotSaveField = result.DataAppend.NotSaveField
          }
        }
      })
    }
  }
}
