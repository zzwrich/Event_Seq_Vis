<template>
  <div class="uploadArea">
    <el-upload
        class="upload-demo"
        action="http://127.0.0.1:5000/uploadFile"
        :on-success="handleSuccess"
        :file-list="fileList"
        :fileType="fileType"
        :before-upload="beforeUpload"
    >
      <el-button slot="trigger" size="small" type="primary">选择文件</el-button>
    </el-upload>
  </div>
  <div class="codeExecutionArea">
    <el-input
        type="textarea"
        v-model="codeInput"
        placeholder="请输入要执行的代码"
        :rows="5">
    </el-input>
    <el-select v-model="selectedOption" @change="handleSelectChange" placeholder="请选择可视化构型">
      <el-option
          v-for="item in visualTypes"
          :key="item.value"
          :label="item.label"
          :value="item.value"
          :disabled="isOptionDisabled(item.value)">
      </el-option>
    </el-select>
    <el-button @click="executeCode" type="primary">执行代码</el-button>
    <!-- 时间范围选择器 -->
    <div class="timePicker">
      <el-date-picker
          v-model="dateTimeRange"
          type="datetimerange"
          start-placeholder="Start Time"
          end-placeholder="End Time"
          range-separator="-"
          value-format="YYYY-MM-DD HH:mm:ss"
      />
    </div>
  </div>
  <div class="history">
    <el-tabs v-model="activeTab" @tab-click="handleTabClick" stretch="stretch">
      <!-- 历史查询面板 -->
      <el-tab-pane label="Historical Record" name="history">
        <div class="historyPanel">
          <el-input v-model="searchText" placeholder="Search history" prefix-icon="Search" class="searchBox" style="margin-left: 0"></el-input>
          <ul class="historyList">
            <li v-for="(item, index) in filteredHistory" :key="index" @click="selectHistory(item)" class="historyItem">
              {{ item }}
              <el-button @click.stop="deleteHistory(index)" type="text" class="deleteBtn">Delete</el-button>
            </li>
          </ul>
        </div>
      </el-tab-pane>
      <!-- 异常序列记录面板 -->
      <el-tab-pane label="Anomalous Record" name="anomalies">
        <el-collapse v-model="activeCollapse">
          <el-collapse-item v-for="(sequence, index) in unusualSequences" :key="index" :title="'Sequence ' + (index + 1)"  @click="selectSequence(sequence)">
            <ul>
              <li v-for="(statement, stmtIndex) in sequence" :key="stmtIndex" >
                {{ statement }}
              </li>
            </ul>
            <el-button type="danger" size="small" @click="removeSequence(index)">Delete</el-button>
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>
    </el-tabs>
  </div>
  <div class="dataBlock">
  </div>
  <DataBlock :tableData="responseFileData" />
</template>

<script>
import axios from "axios";
import DataBlock from './DataBlock.vue';
import {Search} from "@element-plus/icons";
import "./style.css"
import { mapState } from 'vuex';
export default {
  components:{
    Search,
    DataBlock
  },
  data() {
    return {
      responseData: null,
      codeInput: '', // 用于存储用户输入的代码
      responseFileData:[],
      fileList: [],
      fileType: [ "xls", "xlsx","json"],
      selectedOption: '',
      visualTypes: [
        { value: 'table', label: '表格' },
        { value: 'barChart', label: '柱状图' },
        { value: 'pieChart', label: '扇形图' },
        { value: 'timeLine', label: '时间轴' },
        // { value: 'hierarchy', label: '层次结构' },
        // { value: 'sunburst', label: '旭日图' },
      ],
      operation: '',
      // 这里存储选择的日期范围
      dateTimeRange: [],
      history: [], // 用于存储历史记录
      searchText: '',
      // 导航栏
      activeTab: 'history',
      unusualSequences: [],
      isAddHistory :false
    };
  },
  computed: {
    ...mapState({
      unusualSeq: state => state.unusualSeq,
      curExpression: state => state.curExpression,
      isSelectNode: state=>state.isSelectNode
    }),
    filteredHistory() {
      if (!this.searchText) {
        return this.history; // 如果搜索框为空，则显示所有历史记录
      }
      return this.history.filter(item =>
          item.toLowerCase().includes(this.searchText.toLowerCase())
      );
    },
  },
  watch: {
    unusualSeq: {
      handler(newVal) {
        this.unusualSequences = newVal
      },
      deep: true
    },
    // 监听当前表达式的变化
    isSelectNode() {
      this.codeInput = this.curExpression
      this.executeCode()
    },
    dateTimeRange(newValue, oldValue) {
      if(newValue){
        this.$store.dispatch('saveDateRange', this.dateTimeRange);
      }
      else{
        this.$store.dispatch('saveDateRange', []);
      }
      this.executeCode()
    }
  },
  methods: {
    removeSequence(index) {
      this.$confirm('确定要删除这个序列吗?', '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.unusualSequences.splice(index, 1);
      }).catch(() => {
        // 可以处理取消删除的情况
      });
    },

    selectSequence(item){
      this.$store.dispatch('saveSelectedSeq', Object.values(item));
    },

    handleSelectChange(value) {
      this.$store.dispatch('saveVisualType', value);
      this.$store.dispatch('saveIsSelectVisualType');
    },

    isOptionDisabled(optionValue) {
      let regex = /\.(\w+)\(/g;
      let operations = [];
      let match;
      while ((match = regex.exec(this.codeInput)) !== null) {
        operations.push(match[1]);
      }
      const lastOperation = operations[operations.length - 1]
      if ((operations.length===0 && this.codeInput!=="") || ["filter","difference_set", "intersection_set", "unique_attr"].includes(lastOperation)) {
        return optionValue !== 'table'
      }
      if (lastOperation==="seq_view") {
        return (optionValue !== 'timeLine' && optionValue !== 'hierarchy' && optionValue !== 'sunburst')
      }
      if (lastOperation==="agg_view") {
        return (optionValue !== 'timeLine' && optionValue !== 'hierarchy' && optionValue !== 'sunburst')
      }
      if (["count","unique_count","view_type"].includes(lastOperation)) {
        return (optionValue !== 'barChart' && optionValue !== 'pieChart')
      }
    },

    // 上传之前判断文件格式
    beforeUpload(file){
      if (file.type != null){
        const FileExt = file.name.replace(/.+\./, "").toLowerCase();
        if(this.fileType.includes(FileExt)){
          return true;
        }
        else {
          this.$message.error("上传文件格式不正确!");
          return false;
        }
      }
    },

    handleSuccess(response, file, fileList) {
      this.responseFileData = response
    },
    // 找按照什么来进行事件序列的可视化
    extractSeqViewContent(str) {
      const regex = /(seq|agg)_view\("([^"]+)"\)/;
      const match = str.match(regex);
      return match ? match[2] : null;
      },

    extractViewType(str) {
      const pattern = /\.view_type\("(.+?)"\)/;
      const match = str.match(pattern);
      if (match && match[1]) {
        return match[1];
      } else {
        return null; // 或者你可以根据需要返回一个默认值
      }
    },

    executeCode() {
      let startTime = ""
      let endTime = ""
      if (this.dateTimeRange&&(this.dateTimeRange.length === 2)) {
          startTime  = this.dateTimeRange[0];
          endTime = this.dateTimeRange[1];
      }
      if(this.extractSeqViewContent(this.codeInput)){
        const seqEvent = this.extractSeqViewContent(this.codeInput)
        this.$store.dispatch('saveSeqView', seqEvent);
      }

      if(this.extractViewType(this.codeInput)){
        const viewType = this.extractViewType(this.codeInput)
      }

      // 前端可以直接把最后的操作传给后端 后面再改
      axios.post('http://127.0.0.1:5000/executeCode', { code: this.codeInput, startTime:startTime, endTime:endTime })
          .then(response => {
            // 使用 Vuex action 更新 responseData
            this.$store.dispatch('saveResponseData', response.data);
            this.responseData = response.data;
            this.operation = this.responseData["operation"]

            if (this.operation === "original") {
              this.$store.dispatch('saveOriginalTableData', { key: this.codeInput, value: this.responseData['result'] });
            }
          })
          .catch(error => {
            console.error(error);
            // 从history中移除this.codeInput
            const codeIndex = this.history.indexOf(this.codeInput);
            if (codeIndex !== -1) {
              this.history.splice(codeIndex, 1);
            }
          });
      if (!this.history.includes(this.codeInput)) {
        this.history.push(this.codeInput)
      }
    },
    selectHistory(item) {
      this.codeInput = item; // 设置 codeInput 为选中的历史记录
      this.executeCode();
    },
    deleteHistory(index) {
      this.history.splice(index, 1); // 删除特定的历史记录
    },
  },
};
</script>

<style scoped>
/deep/ .el-tabs__item {
  color: grey;
  font-size: 15.5px;
  background: #eeeeee;
  border: 2px solid white;
}

/deep/ .el-tabs__item.is-active {
  color: grey;
  background: #f1f9ff;
}

/deep/ .el-tabs__active-bar {
  background-color: transparent;
}

</style>