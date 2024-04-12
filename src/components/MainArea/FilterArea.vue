<template>
  <div class="uploadArea" id="divBlock">
<!--    <span class="module-title">Data Source</span>-->
    <span style="margin-left: 15px;color: #666666;font-weight: bold;">Data Source</span>
    <el-upload
        class="upload-demo"
        action="http://127.0.0.1:5000/uploadFile"
        :on-success="handleSuccess"
        :file-list="fileList"
        :fileType="fileType"
        :show-file-list="false"
        :before-upload="beforeUpload"
        style="flex: 1; display: flex; justify-content: flex-end;margin-right: 10px"
    >
      <el-button size="small" style="position:relative; cursor: pointer;">
        <upload style="width: 15px;height: 15px;cursor: pointer;color: #606266"></upload>
      </el-button>
    </el-upload>
  </div>
  <div class="tool" id="divBlock">
    <span class="module-title">Tool</span>
    <img src="../../assets/brush.svg" alt="Image"  class="tool-image" @click="brush"/>
    <img src="../../assets/cancelBrush.svg" alt="Image"  class="tool-image" @click="cancelBrush"/>
    <img src="../../assets/cancelFilter.svg" alt="Image"  class="tool-image" @click="cancelFilter"/>
    <img src="../../assets/reset.svg" alt="Image"  class="tool-image" @click="reset"/>
  </div>

  <div class="history" id="divBlock">
    <span class="module-title">Code</span>
    <div class="historyPanel">
      <el-input v-model="searchText" placeholder="Search code" prefix-icon="Search" class="searchBox"></el-input>
      <ul class="historyList">
        <li v-for="(item, index) in filteredHistory" :key="index" @click="selectHistory(item)" class="historyItem">
          {{ item }}
          <delete style="width: 15px;height: 15px;cursor: pointer;color: #606266"  @click.stop="deleteHistory(index)" class="deleteBtn"></delete>
        </li>
      </ul>
    </div>
<!--    <el-tabs v-model="activeTab" @tab-click="handleTabClick" type="card" stretch="stretch">-->
<!--      &lt;!&ndash; 历史查询面板 &ndash;&gt;-->
<!--      <el-tab-pane label="Code" name="history" style="border-radius: 5px">-->
<!--        <div class="historyPanel">-->
<!--          <el-input v-model="searchText" placeholder="Search code" prefix-icon="Search" class="searchBox"></el-input>-->
<!--          <ul class="historyList">-->
<!--            <li v-for="(item, index) in filteredHistory" :key="index" @click="selectHistory(item)" class="historyItem">-->
<!--              {{ item }}-->
<!--              <el-button @click.stop="deleteHistory(index)" type="text" class="deleteBtn" style="font-size: 2%;">Delete</el-button>-->
<!--            </li>-->
<!--          </ul>-->
<!--        </div>-->
<!--      </el-tab-pane>-->
<!--      &lt;!&ndash; 异常序列记录面板 &ndash;&gt;-->
<!--      <el-tab-pane label="Anomaly" name="anomalies">-->
<!--        <el-collapse v-model="activeCollapse" style="border-radius: 5px">-->
<!--          <el-collapse-item v-for="(sequence, index) in unusualSequences" :key="index" :title="'Sequence ' + (index + 1)"  @click="selectSequence(sequence)">-->
<!--            <ul>-->
<!--              <li v-for="(statement, stmtIndex) in sequence" :key="stmtIndex" >-->
<!--                {{ statement }}-->
<!--              </li>-->
<!--            </ul>-->
<!--            <el-button type="danger" size="small" @click="removeSequence(index)">Delete</el-button>-->
<!--          </el-collapse-item>-->
<!--        </el-collapse>-->
<!--      </el-tab-pane>-->
<!--    </el-tabs>-->
  </div>
  <DataBlock :tableData="responseFileData" />
  <div >
<!--    <div style="top: 6%;position: absolute" id="divPanel"><span style="margin-left: 10px">Data Message</span></div>-->
    <div class="module-title" style="position: absolute;top: 7.1%;margin-left: 6px">Metadata</div>
  </div>

</template>

<script>
import axios from "axios";
import DataBlock from './DataBlock.vue';
import {Search} from "@element-plus/icons";
import "./style.css"
import { mapState } from 'vuex';
import store from "@/store/index.js";
import {Upload} from "@element-plus/icons-vue";
import * as d3 from "d3";
export default {
  components:{
    Upload,
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
      isSelectNode: state=>state.isSelectNode,
      selectedViewType: state => state.selectedViewType,
      isSelectedViewType: state => state.isSelectedViewType,
      dateRange: state => state.dateRange
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
    isSelectedViewType() {
      this.selectedOption = this.selectedViewType
      this.$store.dispatch('saveVisualType', this.selectedViewType);
    },
    // 监听当前表达式的变化
    isSelectNode() {
      this.codeInput = this.curExpression
      // 先判断是否已经有这个表达式对应的视图
      const  allChildDivs=this.getDiv()
      // 找出allChildDivs数组中值为this.codeInput对应的键
      const matchingKeys = Object.keys(allChildDivs).find(key => allChildDivs[key] === this.codeInput);

      if (matchingKeys) {
        store.dispatch('saveSelectBox',matchingKeys);
      } else {
        // 没有找到匹配的键
        this.executeCode()
      }
    },
  },
  methods: {
    brush() {
      store.dispatch('saveIsClickBrush');
    },
    cancelBrush() {
      store.dispatch('saveIsClickCancelBrush');
    },
    reset() {
      store.dispatch('saveIsClickReset');
    },
    cancelFilter() {
      store.dispatch('saveIsClickCancelFilter');
    },
    getDiv(){
      const parentDiv = document.getElementsByClassName('grid-item block4')[0];
      const childDivs = parentDiv.querySelectorAll('div');
      const allChildDivs = {};
      // 遍历 children 数组
      for (let i = 0; i < childDivs.length; i++) {
        // 获取当前子元素的所有子 div 元素
        const currentChildDivs = childDivs[i].querySelectorAll('div');
        // 在当前子元素的子 div 中查找类名为 'chart-container' 的元素
        for (let j = 0; j < currentChildDivs.length; j++) {
          const currentDiv = currentChildDivs[j];
          if (currentDiv.classList.contains('chart-container')) {
            // 将 'chart-container' 元素的 id 添加到数组中
            const curDivId = currentDiv.id
            allChildDivs[curDivId] = document.getElementById(curDivId).getAttribute("codeContext");
          }
        }
      }
      return allChildDivs
    },
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
      if(this.extractSeqViewContent(this.codeInput)){
        const seqEvent = this.extractSeqViewContent(this.codeInput)
        this.$store.dispatch('saveSeqView', seqEvent);
      }

      if(this.extractViewType(this.codeInput)){
        const viewType = this.extractViewType(this.codeInput)
        store.commit('setSelectedViewType',viewType)
      }

      // 前端可以直接把最后的操作传给后端 后面再改
      axios.post('http://127.0.0.1:5000/executeCode', { code: this.codeInput })
          .then(response => {
            // 使用 Vuex action 更新 responseData
            this.$store.dispatch('saveResponseData', response.data);
            this.$store.dispatch('saveCurExpression',this.codeInput);
            this.responseData = response.data;
            this.operation = this.responseData["operation"]

            if(!response.data){
              const codeIndex = this.history.indexOf(this.codeInput);
              if (codeIndex !== -1) {
                this.history.splice(codeIndex, 1);
              }
            }

            if (this.operation === "original") {
              this.$store.dispatch('saveOriginalTableData', { key: this.codeInput, value: this.responseData['result'] });
            }
            else{
              axios.post('http://127.0.0.1:5000/executeCode', { code: this.codeInput.split(".")[0] })
                  .then(response => {
                    const responseData = response.data;
                    this.$store.dispatch('saveOriginalTableData', { key: this.codeInput.split(".")[0], value: responseData['result'] });
                  })
                  .catch(error => {
                  });
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
        // 使用match()方法查找所有匹配项
        const regex = /\.(\w+)\(/g; // 正则表达式，寻找所有的操作
        const matches = this.codeInput.match(regex);

        let lastOperation = null;
        if (matches !== null && matches.length > 0) {
          // 获取最后一个匹配项，并从匹配结果中提取操作名
          const lastMatch = matches[matches.length - 1];
          lastOperation = lastMatch.slice(1, lastMatch.indexOf('('));
        }
        if(lastOperation==="filter"){
          // 使用正则表达式匹配所有包含 filter() 的部分
          const regex = /(?:filter\([^)]*\))(?=\s*\)|$)/g;
          const matches = this.codeInput.match(regex);
          if(matches[0]!=='filter()'){
            this.history.push(this.codeInput)
          }
        }
        else if(lastOperation==="unique_attr"){
          const regex = /(?:unique_attr\([^)]*\))(?=\s*\)|$)/g;
          const matches = this.codeInput.match(regex);
          if(matches[0]!=='unique_attr()'){
            this.history.push(this.codeInput)
          }
        }
        else{
          if (this.codeInput.includes("view_type")) {
            this.history.push(this.codeInput)
          }
        }
      }
    },

    selectHistory(item) {
      this.codeInput = item; // 设置 codeInput 为选中的历史记录
      store.dispatch('saveIsSelectHistory');
      store.dispatch('saveCurExpression',item);
      const  allChildDivs=this.getDiv()
      const matchingKeys = Object.keys(allChildDivs).find(key => allChildDivs[key] === this.codeInput);

      if (matchingKeys) {
        store.dispatch('saveSelectBox',matchingKeys);
      } else {
        this.executeCode()
      }
    },

    deleteHistory(index) {
      this.history.splice(index, 1); // 删除特定的历史记录
    },
  },
};
</script>

<style scoped>
:deep(.el-tabs__item) {
  color: #666666;
  font-size: 0.8vw;
  background: #eeeeee;
  //border: 2px solid white;
  //border-radius: 5px;
}

:deep(.el-tabs__item.is-active) {
  color: grey;
  background: #f1f9ff;
}

</style>