<template>
  <div class="popup" v-if="visible" :style="{ left: left + 'px', top: top + 'px'}">
    <Close style="width: 8%;height: 8%;position: absolute;left:90%;cursor:pointer;color: #606266;top: 1.5%" @click="closePopup"></Close>
    <!-- 第一个内容块 -->
    <div style="height: 100%;">
      <div class="content-block">
        <h4>Opera</h4>
        <div class="operation-buttons">
          <el-button v-for="(item, index) in operationList" :key="index" @click="chooseOperation(index)" class="operation-button">{{ item }}</el-button>
        </div>
      </div>
      <!-- 分割线 -->
      <div class="splitLine"></div>
      <!-- 第二个内容块 -->
      <div class="content-block">
        <h4>Vis</h4>
        <div style="margin-top: -16px">
          <img v-for="(img, index) in imgList" :key="index" :src="img.url" alt="Image" :style=img.style  class="hoverable-image" @click="chooseVisual(img.vis)"/>
        </div>
      </div>
    </div>
  </div>
  <div v-if="newPopupVisible" class="newPopup" :style="{ left: left + 'px', top: top + 'px'}">
    <Close style="width: 8%;height: 8%;position: absolute;left:90%;cursor:pointer;color: #606266;top: 1.5%" @click="closeNewPopup"></Close>
    <div style="margin-top: 10px;" v-if="displayMode === 'filter'">
      <el-date-picker
          v-model="dateTimeRange"
          type="datetimerange"
          size="small"
          style="width: 87%;margin-left: 3%;margin-bottom: 5px;z-index: 9999"
          start-placeholder="Start Time"
          end-placeholder="End Time"
          range-separator="-"
          value-format="YYYY-MM-DD HH:mm:ss"
      />
      <h4 style="margin-bottom: 5px;margin-top: 5px">Event Attributes</h4>
      <el-select
          v-model="selectedLabel"
          placeholder="Select Attribute"
          @change="handleLabelChange"
          style="width: 86%; border: none;"
          popper-class="elOption"
          :popper-append-to-body="true"
      >
        <el-option
            v-for="(options, label) in checkboxOptions"
            :key="label"
            :label="label"
            :value="label">
        </el-option>
      </el-select>
      <check style="width: 18px;height: 18px;cursor: pointer;color: #606266;position: absolute;margin-top: 8px;margin-left: 5px"
             @click="checkFilterAttr"></check>
      <!-- 根据所选标签显示的选项列表 -->
      <h4 style="margin-top: 10px;margin-bottom: 5px">Values</h4>
      <el-input v-model="searchText" placeholder="Search" prefix-icon="Search" class="searchBox"></el-input>
      <div style="border: 2px solid #E9E9E9;border-radius: 5px;margin-top: 5px;width: 98%;margin-left: 3px">
        <ul class="popupList attrList" style="z-index: 9999;margin-top: 0">
          <li
              v-for="(option, index) in filteredAttributeList"
              :key="index"
              style="padding: 5px 5px 0 5px;transition: background-color 0.3s;color: #808080;font-size: 2%;
                      display: flex;align-items: center;border: none"
              :class="{ 'is-selected': selectedCheckboxes.includes(option) }"
              @click="chooseAttr(option)">
            {{ option }}
          </li>
        </ul>
      </div>
    </div>
    <div v-else-if="displayMode === 'unique_count'"
        style="border: 2px solid #E9E9E9;border-radius: 5px;margin-top: 5px;width: 98%;margin-left: 3px">
      <ul class="popupList attrList" style="z-index: 9999;margin-top: 0">
        <li
            v-for="(option, index) in paramList"
            :key="index"
            style="padding: 5px 5px 0 5px;transition: background-color 0.3s;color: #808080;font-size: 2%;
                      display: flex;align-items: center;border: none"
            :class="{ 'is-selected': selectedCountboxes.includes(option) }"
            @click="chooseCountAttr(option)">
          {{ option }}
        </li>
      </ul>
    </div>
    <!-- 否则显示列表 -->
    <ul class="popupList paramList" v-else style="z-index: 9999">
      <li v-for="(item, index) in paramList" :key="index" class="popupItem paramItem" @click="chooseParam(item)"
          style="padding: 15px 0 5px 5px;transition: background-color 0.3s;color: #808080;font-size: 2%;
                      display: flex;align-items: center;">
        {{ item }}
      </li>
    </ul>
  </div>
</template>


<script>
import {Close} from "@element-plus/icons-vue";
import store from "@/store/index.js";
import {mapState} from "vuex";

export default {
  components: {Close},
  props: {
    left: Number,
    top: Number,
    visible: Boolean,
    operationList: Array,
    visualList: Array,
    paramList: Array,
    displayMode: String,
    checkboxOptions:Object,
    imgList:Array,
  },
  computed: {
    filteredAttributeList() {
      if (!this.searchText) {
        return this.attributeList; // 如果搜索框为空，则显示所有历史记录
      }
      return this.attributeList.filter(item =>
          item.toLowerCase().includes(this.searchText.toLowerCase())
      );
    },
  },
  data() {
    return {
      selectedValues: [], // 用于存储选中的值,
      dateTimeRange: [], // 选择的日期范围
      selectedLabel: '',
      attributeList:[],
      selectedCheckboxes: [], // 存储被选中的选项
      selectedCountboxes: [], // 存储被选中的选项
      newPopupVisible: false,
      searchText: '',
    };
  },
  watch: {
    dateTimeRange(newValue) {
      if(newValue){
        this.$store.dispatch('saveDateRange', this.dateTimeRange);
      }
      else{
        this.$store.dispatch('saveDateRange', []);
      }
      this.$store.dispatch('saveIsSelectParameter');
      this.$store.dispatch('saveSelectedParameter',"time");
    },
    visible(newVal) {
      if (!newVal) {
        this.newPopupVisible = false
      }
    }
  },
  methods: {
    closePopup() {
      // 隐藏弹窗并将其状态设置为不可见
      this.$emit('close'); // 发送 close 事件给父组件
    },
    closeNewPopup() {
      this.newPopupVisible = false
      this.selectedCheckboxes = [];
      this.selectedCountboxes = [];
    },
    chooseOperation(index) {
      let operation = this.operationList[index];
      if(operation!=="count"){
        this.newPopupVisible = true;
      }
      store.dispatch('saveIsDrag');
      operation=operation.replace("_"," ")
      store.dispatch('saveSelectedOperator', operation);
    },
    chooseVisual(vis) {
      this.$store.dispatch('saveIsSelectVisualType');
      this.$store.dispatch('saveVisualType', vis);
    },
    chooseParam(item) {
      this.$store.dispatch('saveIsSelectParameter');
      this.$store.dispatch('saveSelectedParameter',item);
      this.newPopupVisible = false
    },
    handleLabelChange(value) {
      if (this.checkboxOptions[value]) {
        this.attributeList = this.checkboxOptions[value];
      } else {
        this.attributeList = [];
      }
      this.$store.dispatch('saveSelectedParameter',value);
      // 当标签更换时清空已选中的选项
      this.selectedCheckboxes = [];
    },
    chooseAttr(option){
      const index = this.selectedCheckboxes.indexOf(option);
      if (index > -1) {
        // 如果选项已经被选中，则移除它
        this.selectedCheckboxes.splice(index, 1);
      } else {
        // 否则，添加这个选项到数组中
        this.selectedCheckboxes.push(option);
      }
    },
    chooseCountAttr(option){
      const index = this.selectedCountboxes.indexOf(option);
      if (index > -1) {
        this.selectedCountboxes.splice(index, 1);
      } else {
        this.selectedCountboxes.push(option);
      }
      this.$store.dispatch('saveIsSelectParameter');
      this.$store.dispatch('saveSelectedParameter',option)
      this.newPopupVisible = false
    },
    checkFilterAttr(){
      this.$store.dispatch('saveIsSelectParameter');
      this.$store.dispatch('saveFilterParam',this.selectedCheckboxes)
      this.newPopupVisible = false
      this.selectedLabel = ""
    },
  }
};
</script>

<style scoped>
:deep(.el-tabs__item) {
  color: grey;
  font-size: 0.8vw;
  background: #eeeeee;
  //border: 2px solid white;
}

:deep(.el-tabs__item.is-active) {
  color: grey;
  background: #f1f9ff;
}

</style>
