<template>
  <div class="container">
    <div class="item block1">数据区</div>
    <div class="item block2">运算区</div>
    <div class="item block3">可视化构型</div>
  </div>
</template>

<style scoped>
.container {
  z-index: 9999;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 100%;
}

.item {
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #ddd;
  box-shadow: 5px 5px 10px rgba(0, 0, 0, 0.2), -5px -5px 10px rgba(255, 255, 255, 0.7);
  width: 30%;
  height: 80%;
  text-align: center;
  transition: transform 0.3s ease; /* 添加平滑过渡效果 */
}

.container :hover {
  transform: scale(1.05); /* 鼠标悬浮时放大1.05倍 */
  cursor: pointer; /* 更改鼠标样式 */
}

</style>

<script setup>
</script>

