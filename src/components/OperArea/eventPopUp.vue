<template>
  <div class="eventPopup" v-if="visible" :style="{ left: left + 'px', top: top + 'px'}">
    <check style="width: 10%;height: 10%;cursor: pointer;color: #606266;position: absolute;left:70%;top: 1.5%"
           @click="analyseEvent" class="myIcon"></check>
    <delete style="width: 10%;height: 10%;cursor: pointer;color: #606266;position: absolute;left:80%;top: 1.5%"
           @click="clearEvent" class="myIcon"></delete>
    <Close style="width: 10%;height: 10%;position: absolute;left:90%;cursor:pointer;color: #606266;top: 1.5%" @click="closePopup" class="myIcon"></Close>
    <!-- 第一个内容块 -->
    <div style="height: 100%;">
      <div class="content-block" style="margin-top: -30px">
        <h5>Time Range</h5>
        <div style="margin-top: -20px">
          <div class="range-selector">
            <!-- 最小值输入 -->
            <el-input-number
                v-model="startNum"
                :min="min"
                :max="max"
                @change="handleStartTimeChange"
                size="small"
            ></el-input-number>
            <div style="color: grey">-</div>
            <!-- 最大值输入 -->
            <el-input-number
                v-model="endNum"
                :min="min"
                :max="max"
                size="small"
            ></el-input-number>
            <el-select
                v-model="selectedUnit"
                placeholder="unit"
                style="width: 40%; border: none;background: none;margin-left: -2px"
                size="small">
              <el-option
                  v-for="item in units"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value">
              </el-option>
            </el-select>
          </div>
        </div>
      </div>
      <!-- 分割线 -->
      <div class="splitLine"></div>
      <!-- 第二个内容块 -->
      <div class="content-block" style="margin-top: -26px">
        <h5>Event Analyse</h5>
        <div style="margin-top: -16px">
          <el-select
              v-model="selectedEventAnalyse"
              placeholder="event Analyse"
              style="width: 50%; border: none;background: none;margin-left: -2px"
              size="small"  @change="chooseOperation">
            <el-option
                v-for="item in eventList"
                :key="item.value"
                :label="item.label"
                :value="item.value">
            </el-option>
          </el-select>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
import {Close, Delete} from "@element-plus/icons-vue";
import store from "@/store/index.js";


export default {
  components: {
    Delete,
    Close,
  },
  props: {
    left: Number,
    top: Number,
    visible: Boolean,
  },
  computed: {
  },
  data() {
    return {
      eventList : [ // 单位选项
        { value: 'event pairs', label: 'event pairs' },
        { value: 'event paths', label: 'event paths' },
        { value: 'seq pairs', label: 'seq pairs' }
      ],
      min: -100, // 最小值
      max: 100, // 最大值
      startNum: null,
      endNum: null,
      units: [ // 单位选项
        { value: 'hour', label: 'hour' },
        { value: 'min', label: 'min' },
        { value: 'sec', label: 'sec' }
      ],
      selectedUnit: null, // 选中的单位
      selectedEventAnalyse: null, // 选中的单位
    };
  },
  watch: {
  },
  methods: {
    analyseEvent(){
      let startNum, endNum
      if(this.selectedUnit==="sec"){
        startNum=this.startNum/60
        endNum=this.endNum/60
      }
      else if(this.selectedUnit==="hour"){
        startNum=this.startNum*60
        endNum=this.endNum*60
      }
      else if(this.selectedUnit==="min"){
        startNum=this.startNum
        endNum=this.endNum
      }
      if(this.startNum!==null&&this.endNum!==null&&this.selectedEventAnalyse!==null){
        store.dispatch('saveEventPairStartNum',startNum);
        store.dispatch('saveEventPairEndNum',endNum);
        store.dispatch('saveEventAnalyse',this.selectedEventAnalyse);
        store.dispatch('saveIsAnalyseEvent');
        this.$emit('close');
      }
    },
    clearEvent(){
      // 将交互数据置为空
      store.state.interactionData = {}
      this.$emit('close');
    },
    handleStartTimeChange(value) {
      if (isNaN(value)) {
        // 如果输入非数字，清空结束时间输入框
        this.endNum = '';
      } else {
        if (value > 0) {
          // 如果输入的是正数，转换为负数
          value = -value;
          this.startNum = value;
        }
        // 设置结束时间为起始时间的相反数
        this.endNum = -value;
      }
    },
    closePopup() {
      this.$emit('close');
    },
    chooseOperation(newValue) {
      this.selectedEventAnalyse = newValue
    },
  }
};
</script>

<style scoped>
.range-selector {
  display: flex; /* 启用Flexbox */
  align-items: center; /* 垂直居中 */
  justify-content: space-between; /* 元素之间平均分配空间 */
  gap: 10px; /* 元素之间的间隔 */
}
.range-selector > div {
  display: flex; /* 使"-""符号的div也支持flex布局 */
  align-items: center; /* 垂直居中 */
}

</style>
