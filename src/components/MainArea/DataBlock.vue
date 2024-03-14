<template>
  <div class="data-table-container">
    <el-table
        :data="tableRows"
        style="width: 100%;cursor: pointer;font-size: 1vh;height:100%"
        @header-click="headerClicked"
    >
      <el-table-column
          v-for="sheet in sheetNames"
          :key="sheet"
          :prop="sheet"
          :label="sheet">
        <template v-slot="{ row }">
          <div class="clickable-cell" @click="cellClicked(row[sheet], sheet)">
            {{ row[sheet] }}
          </div>
        </template>
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
    cellClicked(cellValue, columnName) {
      // this.$store.dispatch('saveIsSelectParameter');
      // this.$store.dispatch('saveSelectedParameter',cellValue);
    },
    headerClicked(column, event) {
      this.$store.dispatch('saveIsSelectData');
      this.$store.dispatch('saveSelectedData', column.label || column.prop);
    },
    printFirstSheetInfo() {
      const sheetName = Object.keys(this.tableData)[0]
      this.$store.dispatch('saveSheetName', sheetName);
      const column = this.tableData[sheetName]
      this.$store.dispatch('saveSheetData', column);
    }
  }
};
</script>

<style>
.data-table-container {
  height: 36%;
  position: absolute;
  top: 5%; /* 底部与父容器底部对齐 */
  max-height: 100%;
  overflow: auto; /* 如果内容超出最大高度，显示滚动条 */
  left:0;
  width:100%;
}
</style>
