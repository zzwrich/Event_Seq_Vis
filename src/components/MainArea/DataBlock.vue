<template>
  <div class="data-table-container" id="divBlock">
    <el-table
        :data="tableRows"
        style="cursor: pointer;font-size: 1vh;height:97%;top: 3%;width: 98%;left: 1%;border-radius: 5px;"
        @header-click="headerClicked"
    >
      <el-table-column
          v-for="sheet in sheetNames"
          :key="sheet"
          :prop="sheet"
          :label="sheet">
        <template v-slot="{ row }">
          <div class="clickable-cell">
            {{ row[sheet] }}
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>

import axios from "axios";

export default {
  props: {
    // 接受从父组件传入的tableData
    tableData: {
      type: Object,
      default: () => ({})
    }
  },
  watch: {
    // 监听tableData属性的变化
    tableData: {
      handler(newValue) {
        if (Object.keys(newValue).length > 0) {
          this.printFirstSheetInfo();
        }
      },
      deep: true,
      immediate: true,
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
    },
  },
  methods: {
    headerClicked(column, event) {
      this.$store.dispatch('saveIsSelectData');
      this.$store.dispatch('saveSelectedData', column.label || column.prop);
    },
    printFirstSheetInfo() {
      const sheetName = Object.keys(this.tableData)[0]
      this.$store.dispatch('saveSheetName', sheetName);

      // 前端可以直接把最后的操作传给后端 后面再改
      axios.post('http://127.0.0.1:5000/executeCode', { code: sheetName, startTime:"", endTime:"" })
          .then(response => {
            this.responseData = response.data;
            this.$store.dispatch('saveOriginalTableData', { key: sheetName, value: this.responseData['result'] });
          })
          .catch(error => {
            console.error(error);
          });

      const column = this.tableData[sheetName]
      this.$store.dispatch('saveSheetData', column);
    }
  }
};
</script>

<style>
.data-table-container {
  height: 28%;
  position: absolute;
  top: 8%; /* 底部与父容器底部对齐 */
  max-height: 100%;
  overflow: auto; /* 如果内容超出最大高度，显示滚动条 */
}
</style>
