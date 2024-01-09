<template>
  <div v-for="(box,index) in boxes" :key="box.id" :class="boxClass(box)" :style="boxStyle(box)" @click="selectBox(box)">
    <!--图表容器-->
    <div :id="`chart-container-${box.id}`" class="chart-container" @click="selectChart(box) && $event.stopPropagation()" style="position: relative;height: 98%; width: 100%; overflow: auto; top: 25px;"></div>
    <!--按钮容器-->
    <div class="button-container">
      <el-button @click="handleIncrement(boxes, index, rootWidth, rootHeight)" size="small">+</el-button>
      <el-button @click="handleDecrement(boxes, index)" :disabled="!canDecrement(box)" size="small">-</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useStore } from 'vuex'; // 引入 useStore 钩子
import { boxClass, boxStyle, handleIncrement, handleDecrement } from "./boxFunction.js";
import dataVisual from "./dataVisual.js"
import "./style.css"

// 使用 useStore 钩子获取 store 实例
const store = useStore();
// 定义响应式数据
const boxes = ref([{ id: 0, parentId:-1, width: '100%', height: '100%', x: 0, y: 0, children: [], parent:[], isSelected:false }]);

// 定义全局变量
let rootWidth = 1;
let rootHeight = 1;
let containerId = "chart-container-0";
let selectId = "chart-container-0";

// 判断 chart-container 是否包含元素
function selectChart(box) {
  selectId = `chart-container-${box.id}`;
  store.dispatch('saveIsClickContainer',selectId);
  const myDiv =  document.getElementById(selectId)
  let codeContext =myDiv.getAttribute("codeContext");
  if(codeContext!==null){
    store.dispatch('saveCurExpression',codeContext);
  }
  const divElement = document.getElementById(selectId);
  return !!(divElement && divElement.firstChild);
}
function canDecrement(box) {
  if (box.parentId === null) {
    return false;
  }
  // 计算拥有相同parentId的box的数量
  const siblingsCount = boxes.value.filter(b => b.parentId === box.parentId).length;
  // 如果有多于一个box拥有相同的parentId，则可以减少
  return siblingsCount > 1;
}
function selectBox(curBox) {
  // 重置所有盒子的选中状态
  boxes.value.forEach(box => {
    if (box !== curBox) {
      box.isSelected = false;
    }
  });
  curBox.isSelected = !curBox.isSelected;
  containerId = "chart-container-" + curBox.id;
  selectId = containerId
}

// 观察 boxes 数组的变化
watch(boxes, (newBoxes, oldBoxes) => {
  newBoxes.forEach(box => {
    // console.log(`Box: ${box.id}, Class: box-${box.id}`);
  });
}, { deep: true });

// 观察 Vuex 中 responseData 的变化
watch(() => store.state.responseData, (newValue, oldValue) => {
  const operation = newValue.operation
  const data = newValue.result
  const visualType=store.state.visualType
  const seqView=store.state.seqView
  if(containerId === selectId){
    dataVisual.chooseWhich(operation, containerId, data, visualType, seqView)
    //给点击的容器绑定执行的代码
    const myDiv = document.getElementById(containerId);
    // 将字符串信息绑定到div的自定义属性上
    myDiv.setAttribute("codeContext", store.state.curExpression);
  }
});

// 当组件挂载时执行
onMounted(() => {
  const rootElement = document.getElementsByClassName('grid-item block4')[0];
  const rootRect = rootElement.getBoundingClientRect();
  rootWidth = rootRect.width;
  rootHeight = rootRect.height;
});

</script>

<style scoped>

</style>
