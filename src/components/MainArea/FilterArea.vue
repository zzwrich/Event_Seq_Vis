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
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          range-separator="至"
          value-format="YYYY-MM-DD HH:mm:ss"
      />
    </div>
  </div>
  <div>
    <el-tabs v-model="activeTab" @tab-click="handleTabClick" stretch="stretch">
      <!-- 历史查询面板 -->
      <el-tab-pane label="历史记录" name="history">
        <div class="historyPanel">
          <el-input v-model="searchText" placeholder="搜索历史记录" prefix-icon="Search" class="searchBox" style="margin-left: 0"></el-input>
          <ul class="historyList">
            <li v-for="(item, index) in filteredHistory" :key="index" @click="selectHistory(item)" class="historyItem">
              {{ item }}
              <el-button @click.stop="deleteHistory(index)" type="text" class="deleteBtn">删除</el-button>
            </li>
          </ul>
        </div>
      </el-tab-pane>
      <!-- 异常序列记录面板 -->
      <el-tab-pane label="异常序列记录" name="anomalies">
        <el-collapse v-model="activeCollapse">
          <el-collapse-item v-for="(sequence, index) in unusualSequences" :key="index" :title="'序列 ' + (index + 1)"  @click="selectSequence(sequence)">
            <ul>
              <li v-for="(statement, stmtIndex) in sequence" :key="stmtIndex" >
                {{ statement }}
              </li>
            </ul>
            <el-button type="danger" size="small" @click="removeSequence(index)">删除序列</el-button>
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
        { value: 'hierarchy', label: '层次结构' },
        { value: 'sunburst', label: '旭日图' },
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
      curExpression: state => state.curExpression
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
    curExpression(newVal) {
      this.codeInput = newVal
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
      const regex = /seq_view\("([^"]+)"\)/;
      const match = str.match(regex);
      if (match) {return match[1];}
      else {return null;}
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
      // 前端可以直接把最后的操作传给后端 后面再改
      axios.post('http://127.0.0.1:5000/executeCode', { code: this.codeInput, startTime:startTime, endTime:endTime })
          .then(response => {
            // 使用 Vuex action 更新 responseData
            this.$store.dispatch('saveResponseData', response.data);
            this.responseData = response.data;
            this.operation = this.responseData["operation"]
          })
          .catch(error => {
            console.error(error);
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
