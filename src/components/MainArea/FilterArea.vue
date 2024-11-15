<template>
  <div class="uploadArea" id="divBlock">
<!--    <span class="module-title">Data Source</span>-->
    <span style="margin-left: 15px;color: #666666;font-weight: bold;">Data Source</span>
<!--    <el-upload-->
<!--        class="upload-demo"-->
<!--        action="http://127.0.0.1:5000/uploadFile"-->
<!--        :on-success="handleSuccess"-->
<!--        :file-list="fileList"-->
<!--        :fileType="fileType"-->
<!--        :show-file-list="false"-->
<!--        :before-upload="beforeUpload"-->
<!--        style="flex: 1; display: flex; justify-content: flex-end;margin-right: 10px"-->
<!--    >-->
<!--      <el-button size="small" style="position:relative; cursor: pointer;">-->
<!--        <upload style="width: 15px;height: 15px;cursor: pointer;color: #606266"></upload>-->
<!--      </el-button>-->
<!--    </el-upload>-->

<!--    要删掉-->
    <el-select v-model="selectedFileUrl" placeholder="选择文件" style="flex: 1; display: flex; justify-content: flex-end;margin-right: 10px">
      <el-option
          v-for="file in availableFiles"
          :key="file.name"
          :label="file.name"
          :value="file.name"
      ></el-option>
    </el-select>
    <el-button @click="handleFileSelection">加载文件</el-button>

  </div>
  <div class="tool" id="divBlock">
    <span class="module-title">Tool</span>
    <img src="../../assets/brush.svg" alt="Image"  class="tool-image" @click="brush"/>
    <img src="../../assets/cancelBrush.svg" alt="Image"  class="tool-image" @click="cancelBrush"/>
    <img src="../../assets/cancelFilter.svg" alt="Image"  class="tool-image" @click="cancelFilter"/>
    <img src="../../assets/reset.svg" alt="Image"  class="tool-image" @click="reset"/>
  </div>
  <div class="colormap" id="divBlock" style='width: 46%'>
    <span class="module-color">ColorMap</span>
    <el-select v-model="selected" placeholder="Color By"
               style="border: none;top: 29%;width: 100%;background:none;left: 3%;" class="custom-select"
               size="small" @change="handleSelectChange">
      <el-option
          v-for="item in colorOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value">
      </el-option>
    </el-select>
  </div>
  <div class="colormap" id="divBlock" style="width: 46%;left: 51.5%">
    <span class="module-color">Support</span>
    <div class="support-container">
      <input id="support-input" class="el-input" type="text" placeholder="" v-model="inputSupport">
      <el-button id="submit-button" @click="clickSupport">Min Support:</el-button>
      <span class="percent-label">%</span>
    </div>
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
import * as XLSX from 'xlsx';

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
      isAddHistory :false,
      colorOptions: [],
      colormapData: [],
      selected: '',
      inputSupport: "",

      //临时加一下
      availableFiles: [
        { name: 'updated.xlsx', url: '/api/updated.xlsx' },
        { name: 'file1.xlsx', url: '/api/updated.xlsx' }
        // 可以继续添加其他文件信息
      ],
      selectedFileUrl: null, // 选中的文件名
    };
  },
  computed: {
    ...mapState({
      unusualSeq: state => state.unusualSeq,
      curExpression: state => state.curExpression,
      isSelectNode: state=>state.isSelectNode,
      selectedViewType: state => state.selectedViewType,
      isSelectedViewType: state => state.isSelectedViewType,
      dateRange: state => state.dateRange,
      curColorMap: state => state.curColorMap
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
        const regex = /\.(\w+)\(/g; // 正则表达式，寻找所有的操作
        const matches = this.codeInput.match(regex);

        let lastOperation = null;
        if (matches !== null && matches.length > 0) {
          // 获取最后一个匹配项，并从匹配结果中提取操作名
          const lastMatch = matches[matches.length - 1];
          lastOperation = lastMatch.slice(1, lastMatch.indexOf('('));

          if(lastOperation!=="filter" && lastOperation!=="unique_attr" ){

            if(lastOperation === "group_by"){
              const codeContext = store.state.curExpression
              const regex = /group_by\("([^"]+)"\)/g; // 使用全局标志`g`进行全文搜索
              const matches = codeContext.matchAll(regex);
              if(Array.from(matches).length!==0){
                this.executeCode()
              }
            }
            else{
              if (this.codeInput.includes("view_type")) {
                this.executeCode()
              }
            }
          }
          else{
            this.executeCode()
          }
        }
        else{
          this.executeCode()
        }
      }
    },

    curColorMap(newValue){
      this.selected = newValue
      let uniqueValues = new Set(this.colormapData[newValue]);
      // 如果需要转换回数组形式
      uniqueValues = [...uniqueValues];
      store.dispatch('saveGlobalColorMap',uniqueValues);
    }
  },
  methods: {
    // 删删删
    async handleFileSelection() {
      if (this.selectedFileUrl) {
        try {
          // 下载文件
          const response = await axios.get('/api'+this.selectedFileUrl, {
            responseType: 'blob', // 获取 Blob 类型数据
          });

          // 创建文件对象
          const fileName = this.selectedFileUrl.split('/').pop(); // 从 URL 中提取文件名
          const file = new File([response.data], fileName, { type: response.data.type });

          // 创建 FormData 对象
          const formData = new FormData();
          formData.append('file', file);

          // 上传到服务器
          const uploadResponse = await axios.post('http://127.0.0.1:5000/uploadFile', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          // 上传成功后的处理
          this.handleSuccess(uploadResponse.data);
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      }
    },
    // 删删删

    clickSupport(){
      if(this.inputSupport!==""){
        store.dispatch('saveCurMinSupport',this.inputSupport +"%")
        store.dispatch('saveIsClickSupport')
      }
    },
    convertToDropdownFormat(items) {
      return items.map(item => ({ value: item, label: item }));
    },
    handleSelectChange(newValue) {
      store.dispatch('saveCurColorMap',newValue)
      let uniqueValues = new Set(this.colormapData[newValue]);
      // 如果需要转换回数组形式
      uniqueValues = [...uniqueValues];
      store.dispatch('saveGlobalColorMap',this.colormapData[this.selected])
    },
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
      console.log(":re",response)
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
      axios.post('http://127.0.0.1:5000/executeCode', { code: this.codeInput, support: "50%" })
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
              this.colormapData = this.responseData['result']
              this.colorOptions = this.convertToDropdownFormat(Object.keys(this.responseData['result']))
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

.support-container {
  position: relative;
  display: inline-block;
  width: 88% !important;
  margin-left: 6%;
  top: 26%;
  border: 1px solid #dddfe5;
  border-radius: 3px;
}

.percent-label {
  position: absolute;
  right: 5px; /* Adjust based on padding and aesthetics */
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center; /* Center vertically */
  pointer-events: none; /* Allows click to pass through to the input */
  color: #A9A9A9;
  font-size: 2%;
}

#submit-button {
  position: absolute;
  left: 0;
  height: 100%;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center; /* Center vertically */
  font-size: 2%;
  width: 60%;
  margin-left: 0;
  color: #A9A9A9;
}

/* 输入框样式 */
#support-input {
  border: none;
  border-radius: 4px;
  height: 2vh;
  margin-left: 1px;
  box-sizing: border-box;
  transition: border-color .2s;
  font-size: 70% !important;
  color: #A9A9A9;
  width: 28%; /* Fill the container */
  left:68%;
  padding-right: 20px; /* Space for percent symbol */
}

::v-deep .el-input__wrapper {
  height: 2vh;
}

</style>