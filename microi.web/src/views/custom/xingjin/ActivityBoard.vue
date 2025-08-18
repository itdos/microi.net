<template>
  <div class="activity-board" v-loading="loading">
    <div class="board-header">
      <div class="header-left">
        <span class="title">
          {{ projectDetail.XiangmuH }} - {{ projectDetail.XiangmuMC }}
        </span>
        <span class="status-wrapper" v-if="projectDetail.XiangmuJD">
          项目阶段：{{ projectDetail.XiangmuJD }}
        </span>
        <div class="status-wrapper">
          <span class="status-label">项目状态:</span>
          <span :class="['status-tag', getStatusClass(projectDetail.XiangmuZT)]">
             {{ projectDetail.XiangmuZT }}
          </span>
          <el-tooltip placement="bottom" effect="light" popper-class="status-tooltip">
            <div slot="content">
              <div class="tooltip-content">
                <div class="tooltip-item">
                  <span class="tooltip-label red-label">R风险(红)</span>
                  <span class="tooltip-desc">1，项目有红灯活动时；2，项目有10个黄灯活动时</span>
                </div>
                <div class="tooltip-item">
                  <span class="tooltip-label yellow-label">Y关注(黄)</span>
                  <span class="tooltip-desc">项目黄灯活动数少于10个</span>
                </div>
                <div class="tooltip-item">
                  <span class="tooltip-label green-label">G正常(绿)</span>
                  <span class="tooltip-desc">除R/Y/D/C/S/T以外的项目</span>
                </div>
                <div class="tooltip-item">
                  <span class="tooltip-label gray-label">D呆滞(灰)</span>
                  <span class="tooltip-desc">处于停止状态，3个月没有更新APQP计划和上传交付物</span>
                </div>
                <div class="tooltip-item">
                  <span class="tooltip-label blue-label">C完成</span>
                  <span class="tooltip-desc">项目已批准量产并移交给工厂，交付物100%完成</span>
                </div>
                <div class="tooltip-item">
                  <span class="tooltip-label orange-label">S暂停</span>
                  <span class="tooltip-desc">客户原因项目处于停止状态，有重新启动的时间 ---流程触发</span>
                </div>
                <div class="tooltip-item">
                  <span class="tooltip-label black-label">T终止</span>
                  <span class="tooltip-desc">确认项目客户端停止或失败，项目已索赔完成；---流程触发</span>
                </div>
              </div>
            </div>
            <i class="el-icon-question" style="font-size: 24px; cursor: pointer; margin-left: 5px;"></i>
          </el-tooltip>
        </div>
      </div>
      <div class="header-right">
        <!-- 已移除统计数据显示 -->
        <div class="badge-group"></div>
        <div class="action-buttons">
          <el-button type="primary" @click="openApqpSettings">生成APQP任务活动</el-button>
          <el-button size="small" icon="el-icon-document" circle></el-button>
          <el-button size="small" icon="el-icon-bell" circle></el-button>
          <el-button size="small" icon="el-icon-setting" circle></el-button>
        </div>
      </div>
    </div>

    <div class="board-content">
      <div v-if="gatewayList.length === 0" class="empty-state">
        <el-empty :image-size="120" description="暂无活动数据">
        </el-empty>
      </div>
      <div v-for="(item, index) in gatewayList" :key="index">
        <div class="time-container">
          <span class="start-time">开始时间: {{ item.KaifaSJ || '未设置' }}</span>
          <span class="end-time">结束时间: {{ item.WanchengSJ || '未设置' }}</span>
          <el-button type="text" size="medium" icon="el-icon-time" @click="openTimeSettingDialog(item, index)">设置时间</el-button>
        </div>
        <div class="gateway-item">
          <div class="gateway-header">
            <span class="gateway-title">{{ item.title }}</span>
            <el-button
              type="text"
              @click="handleDeleteGateway(item, index)">
              <i class="el-icon-delete delete-btn"></i>
            </el-button>
          </div>
          <div class="gateway-content">
            <el-table :data="item.tableData" style="width: 100%" size="small">
              <el-table-column prop="activity" label="活动" width="200"></el-table-column>
              <el-table-column prop="status" label="状态">
                <template slot-scope="scope">
                  <span :class="getActivityStatusClass(scope.row.status)" style="padding: 2px 8px; border-radius: 4px;">
                    {{ scope.row.status }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- APQP设置对话框 -->
    <el-dialog
      v-el-drag-dialog
      title="APQP活动设置"
      :visible.sync="apqpDialogVisible"
      width="600px"
      :append-to-body="true">
      <div class="apqp-settings">
        <div v-for="category in apqpCategories" :key="category.Id" class="category-section">
          <div class="category-title">
            <el-checkbox
              v-model="selectedCategories[category.Id]"
              @change="handleMainCategoryChange(category.Id)">
              <span class="parent-category">{{ category.FenleiMC }}</span>
            </el-checkbox>
          </div>
          <p class="category-description">请选择项目涉及活动：</p>
          <div v-if="category._Child && category._Child.length" class="sub-activities">
            <div v-for="subActivity in category._Child" :key="subActivity.Id" class="sub-checkbox-item">
              <el-checkbox
                v-model="selectedCategories[subActivity.Id]"
                @change="handleSubActivityChange(category.Id, subActivity.Id)">
                {{ subActivity.FenleiMC }}
              </el-checkbox>
              <!-- 调试信息 -->
              <span class="debug-info" v-if="false">ID: {{subActivity.Id}} 状态: {{selectedCategories[subActivity.Id]}}</span>
            </div>
          </div>
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="apqpDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="saveApqpSettings" :loading="apqpSaveLoading" :disabled="apqpSaveLoading">确认保存</el-button>
      </span>
    </el-dialog>

    <!-- 设置时间对话框 -->
    <el-dialog
      v-el-drag-dialog
      title="设置活动时间"
      :visible.sync="timeDialogVisible"
      width="500px"
      :append-to-body="true"
      top="30vh">
      <div class="time-settings">
        <div class="dialog-item">
          <span class="dialog-label">活动名称：</span>
          <span class="dialog-value">{{ currentGateway.title }}</span>
        </div>
        <div class="dialog-item">
          <span class="dialog-label">开始时间：</span>
          <el-date-picker
            v-model="currentGateway.KaifaSJ"
            type="date"
            placeholder="选择开始日期"
            value-format="yyyy-MM-dd"
            style="width: 220px;">
          </el-date-picker>
        </div>
        <div class="dialog-item">
          <span class="dialog-label">结束时间：</span>
          <el-date-picker
            v-model="currentGateway.WanchengSJ"
            type="date"
            placeholder="选择结束日期"
            value-format="yyyy-MM-dd"
            style="width: 220px;">
          </el-date-picker>
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="timeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTimeSettings">确认</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import elDragDialog from "@/directive/el-drag-dialog";
export default {
  name: 'ActivityBoard',
  directives: {
    elDragDialog
  },
  computed: {
    GetCurrentUser: function(){ return this.$store.getters['DiyStore/GetCurrentUser'];},
    getActivityStatusClass() {
      return (status) => {
        const statusMap = {
          '完成': 'status-complete',
          '风险': 'status-risk',
          '延误': 'status-delay',
          '不适用': 'status-na',
          '进行中': 'status-progress'
        };
        return statusMap[status] || '';
      };
    }
  },
  data() {
    return {
      apqpDialogVisible: false,
      timeDialogVisible: false,
      apqpCategories: [],
      selectedCategories: {},
      projectStatus: '', // R:风险 Y:关注 G:正常 D:暂停 C:完成 S:暂停 T:终止
      gatewayList: [],
      // 项目台账ID
      projectId: '',
      projectDetail: {},
      apqpTasksPlanTime: [],
      apqpTasksPlan: [],
      // 当前选中的活动板块
      currentGateway: {},
      currentGatewayIndex: -1,
      loading: false,
      // 新增：APQP保存按钮的loading状态
      apqpSaveLoading: false
    }
  },
  methods: {
    getStatusClass(status) {
      const classMap = {
        '风险': 'risk',
        '关注': 'attention',
        '正常': 'normal',
        '呆滞': 'pause',
        '完成': 'complete',
        '暂停': 'stop',
        '终止': 'end'
      };
      return classMap[status] || 'normal';
    },
    // 获取项目台账详情
    async getProjectDetail() {
      this.loading = true;
      try {
        var res = await this.DiyCommon.ApiEngine.Run('GetProjectOverview',{
          Id: this.projectId
        })
        if (res.Code == 1) {
          this.projectDetail = res.Data;
          // 先获取计划时间数据
          // await this.generateApqpTasksPlanTime();
          // 再获取活动数据
          await this.generateApqpTasks();
        }
      } catch (error) {
        console.error('获取项目详情失败:', error);
        this.$message.error('获取项目详情失败');
      } finally {
        this.loading = false;
      }
    },
    // 打开APQP设置对话框
    async openApqpSettings() {
      this.apqpDialogVisible = true;
      // 获取已保存的活动设置并设置默认选中状态
      await this.loadSavedActivitiesAndSetDefaults();
    },

    // 获取已保存的活动设置并设置默认值
    async loadSavedActivitiesAndSetDefaults() {
      try {
        // 获取已保存的活动设置
        const savedActivities = await this.getSavedApqpActivities();

        // 初始化选中状态，并根据已保存的活动设置默认值
        this.initializeSelectedCategories(savedActivities);
      } catch (error) {
        console.error('获取已保存活动设置失败:', error);
        // 如果获取失败，仍然进行初始化，但不设置默认值
        this.initializeSelectedCategories();
      }
    },

    // 获取APQP设置分类数据
    async getApqpSettings() {
      let self = this;
      try {
        const result = await this.DiyCommon.ApiEngine.Run('getApqpSettings')
        if (result.Code == 1 && result.Data) {
          self.apqpCategories = result.Data;
          // 不在这里初始化选中状态，在打开弹窗时再处理
        }
      } catch (error) {
        console.error('获取APQP设置失败:', error);
        this.$message.error('获取APQP设置失败');
      }
    },

    // 获取已保存的APQP活动设置
    async getSavedApqpActivities() {
      try {
        const result = await this.DiyCommon.ApiEngine.Run('getSavedApqpActivities', {
          ProjectId: this.projectId
        });

        if (result.Code === 1 && result.Data) {
          // 注意：这里期望API返回的是活动名称数组，而不是ID数组
          // 如果API返回的是ID数组，需要在后端调整返回格式
          console.log('从API获取的已保存活动:', result.Data);
          return result.Data;
        }
      } catch (error) {
        console.error('获取已保存活动设置API调用失败:', error);
      }

      // 如果API不存在或调用失败，从现有活动数据中推断
      return this.inferSavedActivitiesFromGatewayList();
    },

    // 从现有活动列表推断已选择的活动
    inferSavedActivitiesFromGatewayList() {
      if (!this.gatewayList || this.gatewayList.length === 0) {
        return [];
      }

      // 从gatewayList中提取活动名称，这些是已选择的活动分类名称
      const savedActivityNames = this.gatewayList.map(gateway => gateway.title).filter(Boolean);

      return savedActivityNames;
    },

    // 初始化选中状态
    initializeSelectedCategories(savedActivities = []) {
      // 清空现有选择
      this.selectedCategories = {};

      // 为每个类别和子活动设置初始状态
      this.apqpCategories.forEach(category => {
        // 检查该类别名称是否在已保存的活动中
        const isSelected = savedActivities.includes(category.FenleiMC);
        this.$set(this.selectedCategories, category.Id, isSelected);

        if (category._Child) {
          // 检查子活动是否有被选中的
          let hasSelectedSubActivity = false;

          category._Child.forEach(subActivity => {
            // 通过子活动名称匹配
            const isSubSelected = savedActivities.includes(subActivity.FenleiMC);
            this.$set(this.selectedCategories, subActivity.Id, isSubSelected);

            if (isSubSelected) {
              hasSelectedSubActivity = true;
            }
          });

          // 如果有子活动被选中，但父级未被选中，则根据子活动状态更新父级
          if (hasSelectedSubActivity && !isSelected) {
            // 检查是否所有子活动都被选中
            const allSubActivitiesSelected = category._Child.every(sub =>
              this.selectedCategories[sub.Id] === true
            );
            this.$set(this.selectedCategories, category.Id, allSubActivitiesSelected);
          }
        }
      });

    },

    // 处理主类别选中状态变化
    handleMainCategoryChange(categoryId) {
      const category = this.apqpCategories.find(c => c.Id === categoryId);
      if (category && category._Child) {
        // 当选择父级时，子级全选
        const parentSelected = this.selectedCategories[categoryId];

        // 使用Vue.set确保响应式更新
        category._Child.forEach(subActivity => {
          this.$set(this.selectedCategories, subActivity.Id, parentSelected);
        });
      }
    },

    // 处理子活动选中状态变化
    handleSubActivityChange(categoryId, subActivityId) {
      const category = this.apqpCategories.find(c => c.Id === categoryId);
      if (category && category._Child) {
        // 检查是否所有子活动都被选中
        const allSubActivitiesSelected = category._Child.every(sub =>
          this.selectedCategories[sub.Id] === true
        );

        // 如果所有子活动都被选中或取消选中，则更新父级状态
        if (this.selectedCategories[categoryId] !== allSubActivitiesSelected) {
          // 使用Vue.set确保响应式更新
          this.$set(this.selectedCategories, categoryId, allSubActivitiesSelected);
        }
      }
    },
    // 获取选中活动的名称
    getSelectedActivitiesNames(selectedActivities) {
      const names = [];
      // 遍历所有类别
      this.apqpCategories.forEach(category => {
        // 检查主类别是否被选中
        if (selectedActivities.includes(category.Id)) {
          names.push(category.FenleiMC);
        }

        // 检查子类别是否被选中
        if (category._Child) {
          category._Child.forEach(subActivity => {
            if (selectedActivities.includes(subActivity.Id)) {
              names.push(subActivity.FenleiMC);
            }
          });
        }
      });

      return names;
    },
    // 保存APQP设置
    async saveApqpSettings() {
      // 防止重复提交
      if (this.apqpSaveLoading) {
        return;
      }

      this.apqpSaveLoading = true;
      try {
        const selectedActivities = Object.entries(this.selectedCategories)
          .filter(([_, selected]) => selected)
          .map(([id]) => id);
        // 获取选中活动的名称
        const selectedNames = this.getSelectedActivitiesNames(selectedActivities);
        const res = await this.DiyCommon.ApiEngine.Run('saveApqpSettings',{
            ProjectId: this.projectId,
            ProjectName: this.projectDetail.XiangmuMC,
            ProjectCode: this.projectDetail.XiangmuH,
            selectedNames: JSON.stringify(selectedNames)
        });
        if (res.Code === 1) {
          this.$message({
            message: '设置保存成功',
            type: 'success'
          });
          this.apqpDialogVisible = false;
          // this.generateApqpTasksPlanTime();
          this.generateApqpTasks();
        } else {
          this.$message.error(res.Message || '设置保存失败');
          this.apqpSaveLoading = false;
        }
      } catch (error) {
        console.error('保存APQP设置失败:', error);
        this.$message.error('保存APQP设置失败');
      } finally {
        this.apqpSaveLoading = false;
      }
    },

    // 生成APQP任务活动列表
    async generateApqpTasks() {
      var res = await this.DiyCommon.ApiEngine.Run('getApqpTasks',{
        ProjectId: this.projectId
      });
      if (res.Code == 1) {
        this.apqpTasksPlan = res.Data;
        this.gatewayList = (this.apqpTasksPlan || []).map(item => {
          return {
            planId: item.Id,
            title: item.Mingcheng,
            tableData: (item._Child || []).map(task => {
              return {
                activity: `${task.Bianhao} ${task.Mingcheng}`,
                status: task.Status || '-',
                bianhao: task.Bianhao || ''
              }
            }),
            KaifaSJ: item.KaifaSJ,
            WanchengSJ: item.WanchengSJ,
            HuodongFLFID: item.HuodongFLFID
          }
        })

        // 合并计划时间数据
        // this.mergePlanTimeData();
        // 计算项目状态
        // this.projectStatus = this.calculateProjectStatus(res.Data);
      }
    },

    // 生成APQP任务活动计划时间列表
    async generateApqpTasksPlanTime() {
      var res = await this.DiyCommon.FormEngine.GetTableData({
        FormEngineKey: "diy_apqp_project_plan",
        _Where: [
          { Name: 'ProjectId', Value: this.projectId, Type: 'Equal' }
        ]
      });
      if (res.Code == 1) {
        this.apqpTasksPlanTime = res.Data;
      }
    },

    // 合并计划时间数据
    mergePlanTimeData() {
      if (!this.apqpTasksPlan || this.apqpTasksPlan.length === 0 || !this.apqpTasksPlanTime || this.apqpTasksPlanTime.length === 0) {
        return;
      }

      // 创建计划时间的映射表，键为HuodongFLFMC
      const planTimeMap = {};
      this.apqpTasksPlanTime.forEach(plan => {
        if (plan.HuodongFLFMC) {
          planTimeMap[plan.HuodongFLFMC] = plan;
        }
      });

      // 创建活动分组映射
      const activityGroups = {};
      this.apqpTasksPlan.forEach(task => {
        if (!task.HuodongFLFMC) return;

        if (!activityGroups[task.HuodongFLFMC]) {
          activityGroups[task.HuodongFLFMC] = {
            title: task.HuodongFLFMC,
            tableData: [],
            KaifaSJ: '',
            WanchengSJ: '',
            HuodongFLFID: task.HuodongFLFID || '',
            planId: ''
          };
        }

        activityGroups[task.HuodongFLFMC].tableData.push({
          activity: `${task.Bianhao} ${task.Mingcheng}`,
          status: task.Status || '-',
          bianhao: task.Bianhao || ''
        });
      });

      // 合并时间信息
      Object.keys(activityGroups).forEach(groupKey => {
        const planTime = planTimeMap[groupKey];
        if (planTime) {
          activityGroups[groupKey].KaifaSJ = planTime.KaifaSJ || '';
          activityGroups[groupKey].WanchengSJ = planTime.WanchengSJ || '';
          activityGroups[groupKey].planId = planTime.Id;
          activityGroups[groupKey].HuodongFLFID = planTime.HuodongFLFID || activityGroups[groupKey].HuodongFLFID;
        }
      });
      // 更新gatewayList
      this.gatewayList = Object.values(activityGroups);
    },

    // 格式化日期为YYYY/MM/DD格式
    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}/${month}/${day}`;
    },
    // 计算项目状态
    calculateProjectStatus(data) {
      // 1. 终止、暂停优先级最高
      if (data.some(item => item.Status === '终止')) return 'T';
      if (data.some(item => item.Status === '暂停')) return 'S';

      // 2. 完成
      if (data.every(item => item.Status === '完成')) return 'C';

      // 3. 呆滞（如所有活动3个月无KaifaSJ/WanchengSJ更新）
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const isStagnant = data.every(item => {
      const kaifa = item.KaifaSJ ? new Date(item.KaifaSJ) : null;
      const wancheng = item.WanchengSJ ? new Date(item.WanchengSJ) : null;
      const shangchuan = item.ShangchuanSJ ? new Date(item.ShangchuanSJ) : null;
      // 只要有一个时间在3个月内，就不是呆滞
      return (!kaifa || kaifa < threeMonthsAgo)
          && (!wancheng || wancheng < threeMonthsAgo)
          && (!shangchuan || shangchuan < threeMonthsAgo);
      });
      if (isStagnant) return 'D';

      // 4. 风险/关注
      const redCount = data.filter(item => item.Status === '风险').length;
      const yellowCount = data.filter(item => item.Status === '延误').length;
      if (redCount > 0 || yellowCount >= 10) return 'R';  // R风险(红)：1，项目有红灯活动时；2，项目有10个黄灯活动时
      if (yellowCount > 0 && yellowCount < 10) return 'Y'; // Y关注(黄)：项目黄灯活动数少于10个

      // 5. 正常
      return 'G';
    },
    // 打开时间设置对话框
    openTimeSettingDialog(gateway, index) {
      this.currentGateway = JSON.parse(JSON.stringify(gateway)); // 深拷贝，避免直接修改原数据
      this.currentGatewayIndex = index;
      this.timeDialogVisible = true;
    },

    // 保存时间设置
    async saveTimeSettings() {
      try {
        // 验证日期
        if (this.currentGateway.KaifaSJ && this.currentGateway.WanchengSJ) {
          const startDate = new Date(this.currentGateway.KaifaSJ);
          const endDate = new Date(this.currentGateway.WanchengSJ);

          if (endDate < startDate) {
            this.$message.error('结束时间不能早于开始时间');
            return;
          }
        }
        console.log('开始时间:', this.currentGateway)
        // 调用API保存时间设置
        const res = await this.DiyCommon.ApiEngine.Run('saveApqpGateway',{
          ProjectId: this.projectId,
          planId: this.currentGateway.planId,
          HuodongFLFID: this.currentGateway.HuodongFLFID,
          KaifaSJ: this.currentGateway.KaifaSJ,
          WanchengSJ: this.currentGateway.WanchengSJ
        });
        // const res = await this.DiyCommon.FormEngine.UptFormData({
        //   FormEngineKey: 'diy_apqp_project_plan',
        //   Id: this.currentGateway.planId,
        //   _RowModel: {
        //     KaifaSJ : this.currentGateway.KaifaSJ,
        //     WanchengSJ : this.currentGateway.WanchengSJ
        //   }
        // });
        if (res.Code === 1) {
          // 更新本地数据
          this.$set(this.gatewayList, this.currentGatewayIndex, {
            ...this.gatewayList[this.currentGatewayIndex],
            KaifaSJ: this.currentGateway.KaifaSJ,
            WanchengSJ: this.currentGateway.WanchengSJ,
            formattedStartTime: this.currentGateway.KaifaSJ ? this.formatDate(this.currentGateway.KaifaSJ) : '',
            formattedEndTime: this.currentGateway.WanchengSJ ? this.formatDate(this.currentGateway.WanchengSJ) : ''
          });

          this.$message({
            message: '时间设置保存成功',
            type: 'success'
          });

          // 重新获取计划时间数据
          // this.generateApqpTasksPlanTime();
          this.timeDialogVisible = false;
        } else {
          this.$message.error(res.Message || '保存失败');
        }
      } catch (error) {
        console.error('保存时间设置失败:', error);
        this.$message.error('保存时间设置失败');
      }
    },
    // 删除活动阶段
    async handleDeleteGateway(gateway, index) {
      console.log(gateway,index)
      try {
        await this.$confirm('确定要删除该活动阶段吗？删除后将无法恢复。', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        });

        // 调用API删除活动阶段
        const res = await this.DiyCommon.ApiEngine.Run('deleteApqpGateway', {
          ProjectId: this.projectId,
          planId: gateway.planId,
          HuodongFLFID: gateway.HuodongFLFID
        });

        if (res.Code === 1) {
          // 从列表中移除该活动阶段
          this.gatewayList.splice(index, 1);
          this.$message({
            message: '删除成功',
            type: 'success'
          });
          // 重新生成活动列表
          this.generateApqpTasks();
        } else {
          this.$message.error(res.Message || '删除失败');
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除活动阶段失败:', error);
          this.$message.error('删除活动阶段失败');
        }
      }
    }
  },
  mounted() {
    this.projectId = this.GetCurrentUser.ProjectID;
    this.getProjectDetail()
    this.getApqpSettings();
  }
}
</script>

<style lang="scss">
/* 全局样式 - 状态提示弹窗 */
.status-tooltip {
  max-width: 550px !important;
  padding: 20px !important;
}

.status-tooltip .tooltip-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.status-tooltip .tooltip-content .tooltip-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  width: 100%;
}

.status-tooltip .tooltip-content .tooltip-item:last-child {
  margin-bottom: 0;
}

.status-tooltip .tooltip-content .tooltip-item .tooltip-label {
  font-weight: bold;
  width: 90px;
  margin-right: 16px;
  font-size: 14px;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  text-align: center;
}

/* 使用与状态标签相同的颜色 */
/* R:风险 - risk */
.status-tooltip .tooltip-content .tooltip-item .tooltip-label.red-label { background-color: #F56C6C; color: white; }
/* Y:关注 - attention */
.status-tooltip .tooltip-content .tooltip-item .tooltip-label.yellow-label { background-color: #E6A23C; color: white; }
/* G:正常 - normal */
.status-tooltip .tooltip-content .tooltip-item .tooltip-label.green-label { background-color: #67C23A; color: white; }
/* D:暂停 - pause */
.status-tooltip .tooltip-content .tooltip-item .tooltip-label.gray-label { background-color: #909399; color: white; }
/* C:完成 - complete */
.status-tooltip .tooltip-content .tooltip-item .tooltip-label.blue-label { background-color: #409EFF; color: white; }
/* S:暂停 - stop */
.status-tooltip .tooltip-content .tooltip-item .tooltip-label.orange-label { background-color: #909399; color: white; }
/* T:终止 - end */
.status-tooltip .tooltip-content .tooltip-item .tooltip-label.black-label { background-color: #909399; color: white; }

.status-tooltip .tooltip-content .tooltip-item .tooltip-desc {
  color: #606266;
  font-size: 14px;
  line-height: 1.5;
  flex: 1;
}
</style>

<style lang="scss" scoped>

// 多选框样式
.category-section {
  margin-bottom: 15px;
}

.category-title {
  margin-bottom: 10px;

  .parent-category {
    font-weight: bold;
  }
}

.sub-activities {
  display: flex;
  flex-wrap: wrap;
}

.sub-checkbox-item {
  margin-right: 20px;
  margin-bottom: 10px;
  min-width: 120px;
}

// 时间设置对话框样式
.time-settings {
  padding: 10px;
}

.dialog-item {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.dialog-label {
  width: 80px;
  text-align: right;
  margin-right: 10px;
  color: #606266;
}

.dialog-value {
  font-weight: bold;
  color: #303133;
}

.debug-info {
  font-size: 12px;
  color: #999;
  margin-left: 10px;
}

// APQP活动状态样式
.status-complete {
  background-color: #90EE90;
  color: #333;
}

.status-risk {
  background-color: #FF0000;
  color: #fff;
}

.status-delay {
  background-color: #FFFF00;
  color: #333;
}

.status-na {
  background-color: #CCCCCC;
  color: #333;
}

.status-progress {
  background-color: #409EFF;
  color: #fff;
}


.activity-board {
  padding: 10px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  background: #F6F4FF;

  .board-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
    margin-bottom: 30px;

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;

      .title {
        font-size: 16px;
        font-weight: bold;
        color: #303133;
        cursor: pointer;
        display: flex;
        align-items: center;
        background-color: #6A72FF;
        color: #fff;
        border-radius: 24px;
        padding: 8px 16px;
      }

      .status-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;

        .status-label {
          color: #212121;
          font-size: 14px;
          white-space: nowrap;
        }

        .status-tag {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;

          &.risk {
            background-color: #F56C6C;
            color: #fff;
          }

          &.attention {
            background-color: #E6A23C;
            color: #fff;
          }

          &.normal {
            background-color: #67C23A;
            color: #fff;
          }

          &.pause {
            background-color: #909399;
            color: #fff;
          }

          &.complete {
            background-color: #409EFF;
            color: #fff;
          }

          &.stop {
            background-color: #909399;
            color: #fff;
          }

          &.end {
            background-color: #909399;
            color: #fff;
          }
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;

      .badge-group {
        display: flex;
        gap: 16px;

        .badge-item {
          display: flex;
          align-items: center;
          gap: 4px;
          border: 1px solid #E0E0E0;
          border-radius: 24px;
          padding: 4px 10px;

          .badge-label {
            font-size: 14px;
            font-weight: 400;
            color: #212121;
          }

          .badge-value {
            font-size: 14px;
            color: #409EFF;

            &.risk {
              color: #F56C6C;
            }

            &.delay {
              color: #E6A23C;
            }
          }
        }
      }

      .action-buttons {
        display: flex;
        gap: 8px;
      }
    }
  }
.board-content{
  display: flex;
  gap: 20px;
  overflow-x: auto;
  white-space: nowrap;
  min-height: 600px;
  position: relative;

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    width: 100%;
    padding: 30px 0;

    ::v-deep .el-empty__description {
      margin-top: 10px;
      font-size: 16px;
      color: #606266;
    }

    ::v-deep .el-button {
      margin-top: 20px;
    }
  }
}
  .time-container {
    border: 1px solid #E0E0E0;
    background-color: #fff;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 16px;
    font-weight: 400;

    .start-time {
      color: #19994F;
    }

    .end-time {
      color: #E24B37;
    }
  }

  .gateway-item {
    flex-shrink: 0;
    margin-bottom: 20px;
    border-radius: 25px;
    overflow: hidden;
    padding-bottom: 10px;
    background-color: #fff;

    .gateway-header {
      padding: 12px 20px;
      background-color: #E2E3FF;
      display: flex;
      align-items: center;
      position: relative;

      .gateway-title {
        font-weight: 500;
        color: #6A72FF;
        text-align: center;
        font-size: 18px;
        flex: 1;
      }

      .el-button {
        position: absolute;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);

        .delete-btn {
          color: #F56C6C;
          font-size: 18px;

          &:hover {
            color: #f78989;
          }
        }
      }
    }

    .gateway-content {

      ::v-deep .el-table {
        &::before {
          display: none;
        }

        th {
          background-color: #E2E3FF;
          .cell{
            color: #6A72FF;
            font-size: 14px;
          }
        }
        td{
          font-size: 13px;
        }
      }
    }
  }
}
.apqp-settings{
  .category-title{
    border-bottom: 1px solid #E0E0E0;
    margin-bottom: 15px;
  }
  .category-description{
    margin-bottom: 20px;
    font-weight: 400;
    font-size: 16px;
  }
}
</style>
