<template>
  <div class="data-table-container">
    <el-table
        :data="tableRows"
        style="width: 100%"
    >
      <el-table-column
          v-for="sheet in sheetNames"
          :key="sheet"
          :prop="sheet"
          :label="sheet">
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
export default {
  props: {
    // 接受从父组件传入的tableData
    tableData: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    sheetNames() {
      // 获取所有sheet的名称
      return Object.keys(this.tableData);
    },
    tableRows() {
      // 计算表格的行数据
      let maxRows = 0;
      this.sheetNames.forEach(sheet => {
        maxRows = Math.max(maxRows, this.tableData[sheet].length);
      });

      const rows = [];
      for (let i = 0; i < maxRows; i++) {
        let row = {};
        this.sheetNames.forEach(sheet => {
          row[sheet] = this.tableData[sheet][i] || '';
        });
        rows.push(row);
      }
      return rows;
    }
  }
};
</script>

<style>
.data-table-container {
  position: absolute;
  bottom: 0; /* 底部与父容器底部对齐 */
  max-height: 100%;
  overflow-y: auto; /* 如果内容超出最大高度，显示滚动条 */
  left:0;
  width:100%;
}

</style>
