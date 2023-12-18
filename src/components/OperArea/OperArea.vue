<template>
  <div class="container">
    <el-button @click="clearAll" style="position:absolute;right: 10px;top: 10px;z-index: 9999;">清除</el-button>
    <div class="workflowArea"></div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import * as d3 from 'd3';
import dagreD3 from 'dagre-d3';

export default {
  data() {
    return {
      graph: new dagreD3.graphlib.Graph().setGraph({}),
      render: new dagreD3.render(),
      nextNodeId: 0,
      nextEdgeId: 1,
      nodes: [],
      edges: [],
      currentNode: null,
      maxText: ""
    };
  },
  computed: {
    ...mapState({
      selectedData: state => state.selectedData,
      selectedOperator: state => state.selectedOperator,
      selectedParameter: state => state.selectedParameter,
      isDrag: state => state.isDrag,
      isSelectedData: state => state.isSelectData
    })
  },
  watch: {
    currentNode(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.maxText = ""
      }
      this.handleNodeClick(newVal);
    },
    // 监听数据的选择
    isSelectedData() {
      this.clearAll()
      this.setupGraph()
      if (this.selectedData) {
        this.addNode(this.selectedData, "circle");
      }
      this.$store.dispatch('clearCurExpression');
      this.handleNodeClick(this.currentNode);
    },
    // 监听操作符的变化
    isDrag() {
      if(this.currentNode){
        this.showOperator(this.currentNode,this.selectedOperator);
      }
    },
    // 监听选择参数的变化
    selectedParameter: {
      handler(newVal) {
        if (this.currentNode && newVal.length > 0) {
          this.updateNodeWithSquare(this.currentNode, newVal[newVal.length - 1]);
        }
        this.handleNodeClick(this.currentNode)
      },
      deep: true
    }
  },
  mounted() {
    this.setupGraph();
  },
  methods: {
    addParameter(string, parameter) {
      let parts = string.split('.');
      // 找到最后一个函数调用
      let lastFunction = parts[parts.length - 1];
      // 检查圆括号内是否有内容，以判断是否已有参数
      let parenthesisContent = lastFunction.substring(lastFunction.indexOf('(') + 1, lastFunction.lastIndexOf(')'));
      if (parenthesisContent.trim() !== '') {
        // 如果已有参数，添加新参数
        let lastParenIndex = lastFunction.lastIndexOf(')');
        lastFunction = lastFunction.substring(0, lastParenIndex) + ', "' + parameter + '")';
      } else {
        // 如果没有参数，添加第一个参数
        lastFunction = lastFunction.replace('()', '("' + parameter + '")');
      }
      // 重建字符串
      parts[parts.length - 1] = lastFunction;
      return parts.join('.');
      },

    clearAll(){
      this.nodes = []
      this.edges = []
      this.nextNodeId = 0
      this.nextEdgeId = 1
      this.currentNode = null
      this.graph = new dagreD3.graphlib.Graph().setGraph({})
      this.$store.dispatch('clearSelectedParameter');
      const divElement = document.getElementsByClassName('workflowArea')[0]
      if(divElement.firstChild){
        while (divElement.firstChild) {
          divElement.removeChild(divElement.firstChild);
        }
      }
    },

    setupGraph() {
      const container = document.getElementsByClassName('grid-item block3')[0]
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      // 初始化图形设置
      this.graph.setGraph({ rankdir: 'LR', edgesep: 10, ranksep: 10, nodeseq:5, align:'DL', });
      // 设置 SVG 和渲染器
      const svg = d3.select(".workflowArea").append("svg").attr('width', containerWidth).attr('height', containerHeight).attr("class",'svgArea')
      const inner = svg.append("g");
      // 用来后续更新图形
      this.updateGraph = () => {
        inner.call(this.render, this.graph);
        this.clickNodeEvents();
      };
    },

    addNode(data,shape) {
      const newNodeId = `node${this.nextNodeId++}`;
      this.nodes.push({ id: newNodeId, label: data, shape: shape });
      if(newNodeId==="node0"){
        this.graph.setNode(newNodeId, { label: data, shape: shape, class: `${shape}`, id:newNodeId,
          style:"fill:#6CA6CD;cursor:pointer",
          labelStyle:"fill:white;font-size:15px;font-weight:bold",});
      }
      else{
        this.graph.setNode(newNodeId, { label: " ", shape: shape, class: `${shape}`, id:newNodeId,
          style:"fill:#6CA6CD;cursor:pointer",
        });
      }
      this.currentNode = newNodeId;
      this.updateGraph();
    },

    addEdge(source, operation, target) {
      this.edges.push({ source: source, target: target, label: operation });
      this.graph.setEdge(source, target, { label: operation,
        style: "fill:grey;stroke:grey;stroke-width:2px",
        labelStyle: "fill:#778899;font-weight:bold",
        arrowhead:"vee",
        arrowheadStyle:"fill:grey" });
      this.updateGraph();
    },

    // 为节点绑定点击事件
    clickNodeEvents() {
      this.nodes.forEach(node => {
        d3.select(`#${node.id}`).on('click', () => {
          // 点击节点的处理逻辑
          this.handleNodeClick(node.id);
        });
        d3.select(`#${node.id}`).on('contextmenu', (event, d) => {
          console.log("右键")
              event.preventDefault();
              // this.showDeleteButton(node.id, event.pageX, event.pageY);
              this.deleteNodeAndSuccessors(node.id)
            });
      });
    },

    // 处理节点点击事件的逻辑
    handleNodeClick(nodeId) {
      // 获取点击节点
      const clickNode = this.graph.node(nodeId);
      // 为当前节点设置高亮效果
      this.highlightNode(clickNode)
      this.updateGraph()
      // 设置当前节点
      this.currentNode = nodeId;
      // 显示从起点到当前节点的路径信息
      let pathToNode = this.findPath('node0', nodeId);
      const nodes = pathToNode.nodes
      const edges = pathToNode.edges
      const completePath = this.createCompletePaths(nodes, edges)
      if(typeof(completePath)=="string"){
        this.$store.dispatch('saveCurExpression',completePath);
      }
      else{
        completePath.forEach(item => {
          // 获取对象的键和值
          let key = Object.keys(item)[0];
          let value = item[key];
          if(key === "node"){
            this.$store.dispatch('saveCurExpression',value);
          }
          else if(key === "operator"){
            this.$store.dispatch('saveCurExpression',this.$store.state.curExpression + '.' + value + "()");
          }
          else if(key === "parameter"){
            //更新表达式
            const curExpression = this.$store.state.curExpression
            const newExpression = this.addParameter(curExpression, value)
            this.$store.dispatch('saveCurExpression',newExpression);
          }
        });
      }
    },

    showOperator(nodeId, operation) {
      if (operation) {
        const newNodeId = `node${this.nextNodeId}`;
        this.addNode(operation, 'circle');
        this.addEdge(nodeId, operation, newNodeId);
      }
    },

    highlightNode(node) {
      this.nodes.forEach(n => {
        const oldNode = this.graph.node(n.id);
        this.graph.setNode(n.id, {...oldNode, style: "fill:#6CA6CD;cursor:pointer"}); // 重置为原始样式
      })
      this.graph.setNode(node.id, {...node, style: "fill:#F56C6C;cursor:pointer"});
    },

    // 在数据节点中加入参数文字
    updateNodeWithSquare(nodeId, text) {
      const nodeElem = d3.select(`#${nodeId}`);
      const node = this.graph.node(nodeId);
      const existingSquares = nodeElem.selectAll('rect');
      const rectWidth = 40;
      const rectHeight = 20;
      const spacing = -6; // 矩形块之间的间距
      const translateY = 15; // 平移的距离
      // 更新现有矩形的位置
      existingSquares.each(function() {
        d3.select(this)
            .attr('y', d => parseFloat(d3.select(this).attr('y')) - translateY);
      });
      // 同步更新对应的文本位置
      const existingTexts = nodeElem.selectAll('text');
      existingTexts.each(function() {
        d3.select(this)
            .attr('y', d => parseFloat(d3.select(this).attr('y')) - translateY);
      });
      const xPosition = -(rectWidth / 2);
      const yPosition = -10 + (rectHeight + spacing) * existingSquares.size(); // 垂直位置
      const newSquare = nodeElem.append('g'); // 使用 'g' 元素来组合正方形和文本
      newSquare.append('rect')
          .attr('x', xPosition)
          .attr('y', yPosition)
          .attr('width', rectWidth)
          .attr('height', rectHeight)
          .style('fill', '#EEB422');
      // 添加有限长度的文字
      const maxTextLength = 2; // 最大文本长度
      let displayText = text.length > maxTextLength ? text.substring(0, maxTextLength) + '...' : text;
      let CircleText = text.length > 1 ? text.substring(0, maxTextLength): text;
      // 添加文字
      const textElem = newSquare.append('text')
          .attr('x', xPosition + rectWidth / 2)
          .attr('y', yPosition + rectHeight / 2 + 5) // 轻微调整以垂直居中
          .attr('text-anchor', 'middle')
          .text(displayText)
          .attr('id', text) // 设置 ID
          .style("fill", "white")
          .style("font-size", "15px")
          .style("font-weight", "bold");

      // 鼠标悬浮事件显示完整文本
      newSquare.on('mouseover', () => textElem.text(text));
      newSquare.on('mouseout', () => textElem.text(displayText));
      this.maxText += CircleText
      // 更新节点的 label 属性
      this.graph.setNode(nodeId, { ...node, label: this.maxText,labelStyle:"fill:rgba(0, 0, 0, 0);font-size:12px;font-weight:bold"});
      this.updateGraph();
    },
    // 删除节点
    deleteNodeAndSuccessors(nodeId) {
      // 实现删除节点以及其后续节点和连线的逻辑
      let nodesToDelete = new Set();
      let edgesToDelete = new Set();
      const dfs = (currentNodeId) => {
        nodesToDelete.add(currentNodeId);
        let outgoingEdges = this.edges.filter(edge => edge.source === currentNodeId);
        outgoingEdges.forEach(edge => {
          edgesToDelete.add(edge);
          if (!nodesToDelete.has(edge.target)) {
            dfs(edge.target);
          }
        });
      };
      dfs(nodeId);
      // 删除节点和边
      this.nodes = this.nodes.filter(node => !nodesToDelete.has(node.id));
      this.edges = this.edges.filter(edge => !edgesToDelete.has(edge));

      this.updateGraph();
    },
    // 获取节点上的参数信息
    getTextsInfo(nodeId) {
      const nodeElem = d3.select(`#${nodeId}`);
      const textElems = nodeElem.selectAll('text');
      let textsInfo = [];
      textElems.each(function() {
        const textElem = d3.select(this);
        if(textElem.attr('id')!=null){
          textsInfo.push({
            text: textElem.attr('id')
          });
        }
      });
      return textsInfo;
    },

    findPath(startNodeId, targetNodeId) {
      let path = {
        nodes: [],
        edges: []
      };
      let visited = new Set();
      let found = false;
      const dfs = (currentNodeId) => {
        if (currentNodeId === targetNodeId) {
          found = true;
          path.nodes.push(currentNodeId);
          return;
        }
        visited.add(currentNodeId);
        path.nodes.push(currentNodeId);
        let neighbors = this.edges.filter(edge => edge.source === currentNodeId);
        for (let edge of neighbors) {
          if (!visited.has(edge.target)) {
            dfs(edge.target);
            if (found) {
              path.edges.push(edge);
              return;
            }
          }

        }
        path.nodes.pop();
      };
      dfs(startNodeId);
      return path;
    },

    getNodeLabel(nodeId) {
      const node = this.graph.node(nodeId);
      return node.label
    },

    createCompletePaths(nodes, edges) {
      if (edges.length === 0) {
        return this.getNodeLabel(nodes[0]);
      }

      let completePaths = [];
      for (let i = edges.length - 1; i >= 0; i--) {
        let edge = edges[i];
        let sourceLabel = this.getNodeLabel(edge.source);
        let targetLabel = this.getNodeLabel(edge.target);
        let nodeTexts = this.getTextsInfo(edge.target);
        if (i === edges.length - 1) {
          completePaths.push({ "node": sourceLabel });
          completePaths.push({ "operator": edge.label });
          if (targetLabel !== sourceLabel) {
            nodeTexts.forEach(textInfo => completePaths.push({ "parameter": textInfo.text }));
          } else {
            completePaths.push({ "node": targetLabel });
          }
        } else {
          // 对于其他边，只需包括边的标签和终点
          completePaths.push({ "operator": edge.label });
          if (targetLabel !== sourceLabel) {
            nodeTexts.forEach(textInfo => completePaths.push({ "parameter": textInfo.text }));
          } else {
            completePaths.push({ "node": targetLabel });
          }
        }
      }
      return completePaths;
    },
  },
};
</script>


