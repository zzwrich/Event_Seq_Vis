<template>
  <div class="container">
    <el-button @click="clearAll" style="position:absolute;right: 10px;top: 10px;z-index: 1;">清除</el-button>
    <el-button @click="showAll" style="position:absolute;right: 180px;top: 10px;z-index: 1;">显示全部</el-button>
    <el-button @click="deleteNode(this.currentNode)" style="position:absolute;right: 80px;top: 10px;z-index: 1;">删除节点</el-button>
    <div class="workflowArea" id="workflowContainer"></div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import * as d3 from "d3";
import dagreD3 from 'dagre-d3';
import store from "@/store/index.js";

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
      maxText: "",
      links: null,
      linksData: [],
      // 存放路径(节点)与代码的对应关系
      pathData: {}
    };
  },
  computed: {
    ...mapState({
      selectedData: state => state.selectedData,
      selectedOperator: state => state.selectedOperator,
      selectedParameter: state => state.selectedParameter,
      isDrag: state => state.isDrag,
      isSelectedData: state => state.isSelectData,
      curExpression: state => state.curExpression,
      isClickContainer: state => state.isClickContainer
    }),
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
        this.addNode(this.selectedData);
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
    selectedParameter(newVal) {
      if (this.currentNode && newVal) {
        this.updateNodeWithSquare(this.currentNode, newVal);
      }
      this.handleNodeClick(this.currentNode)
    },
    // 监听代码的变化
    isClickContainer(newVal) {
      const myDiv =  document.getElementById(newVal)
      let codeContext =myDiv.getAttribute("codeContext");
      const svg = d3.select(".svgArea")
      const nodeInPath = this.pathData[codeContext]
      // 选择所有边，并根据条件筛选
      svg.selectAll('.mylink')
          .style('visibility', link => {
            const sourceIndex = nodeInPath.indexOf(link.source);
            const targetIndex = nodeInPath.indexOf(link.target);
            // 检查是否是相邻的两个节点
            if (sourceIndex !== -1 && targetIndex !== -1 && (targetIndex - sourceIndex) === 1) {
              return 'visible';
            } else {
              return 'hidden';
            }
          });
      svg.selectAll('.linkText')
          .style('visibility', link => {
            const sourceIndex = nodeInPath.indexOf(link.source);
            const targetIndex = nodeInPath.indexOf(link.target);
            // 检查是否是相邻的两个节点
            if (sourceIndex !== -1 && targetIndex !== -1 && Math.abs(targetIndex - sourceIndex)=== 1) {
              return 'visible';
            } else {
              return 'hidden';
            }
          });
      this.nodes.forEach(n => {
        svg.selectAll('.node')
            .style('visibility', node => {
              // 检查是否是相邻的两个节点
              if (nodeInPath.includes(node)) {
                return 'visible';
              } else {
                return 'hidden';
              }
            });
        svg.selectAll('.mypath')
            .style('visibility', path => {
              const sourceIndex = nodeInPath.indexOf(path.v);
              const targetIndex = nodeInPath.indexOf(path.w);
              // 检查是否是相邻的两个节点
              if (sourceIndex !== -1 && targetIndex !== -1 && Math.abs(targetIndex - sourceIndex)=== 1) {
                return 'visible';
              } else {
                return 'hidden';
              }
            });
        svg.selectAll('.edgeLabel')
            .style('visibility', pathLabel => {
              const sourceIndex = nodeInPath.indexOf(pathLabel.v);
              const targetIndex = nodeInPath.indexOf(pathLabel.w);
              // 检查是否是相邻的两个节点
              if (sourceIndex !== -1 && targetIndex !== -1 && Math.abs(targetIndex - sourceIndex)=== 1) {
                return 'visible';
              } else {
                return 'hidden';
              }
            });
      })
    }
  },
  mounted() {
    this.setupGraph();
  },
  methods: {
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

    showAll(){
      const svg = d3.select(".svgArea")
      svg.selectAll('.mylink').style('visibility', 'visible');
      svg.selectAll('.linkText').style('visibility', 'visible');
      svg.selectAll('.node').style('visibility', 'visible');
      svg.selectAll('.mypath').style('visibility', 'visible');
      svg.selectAll('.edgeLabel').style('visibility', 'visible');
    },

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

    setupGraph() {
      const container = document.getElementsByClassName('grid-item block3')[0]
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      // 初始化图形设置
      this.graph.setGraph({ rankdir: 'TB', edgesep: 10, ranksep: 10, nodeseq:5 });
      // 设置 SVG 和渲染器
      const offsetX = 50; // 水平偏移量
      const offsetY = 50; // 垂直偏移量
      const svg = d3.select(".workflowArea").append("svg").attr('width', containerWidth).attr('height', containerHeight)
          .attr("class",'svgArea')
      const inner = svg.append("g").attr("transform", `translate(${offsetX}, ${offsetY})`);
      // 用来后续更新图形
      this.updateGraph = () => {
        if (inner) {
          inner.call(this.render, this.graph);
          this.bindNodeEvents();
        }
      };
      this.updateGraph();
    },

    addNode(data, shape) {
      const newNodeId = `node${this.nextNodeId++}`;
      this.nodes.push({ id: newNodeId, label: data});
      if(data === " "){
        this.graph.setNode(newNodeId, { label: data, id:newNodeId,
          style:"fill:#6CA6CD;cursor:pointer",
          height: 34,
          width:70,
          rx: 10,
          ry:10});
      }
      else{
        this.graph.setNode(newNodeId, { label: data, id:newNodeId,
          style:"fill:#6CA6CD;cursor:pointer",
          height: 34,
          rx: 10,
          ry:10,
          labelStyle:"fill:white;font-size:18px;font-weight:bold"});
      }
      this.currentNode = newNodeId;
      this.updateGraph();
    },

    addEdge(source, operation, target) {
      this.edges.push({ source: source, target: target, label: operation });
      if(this.selectedOperator==="seq_view"){
        this.graph.setEdge(source, target, { label: operation,class:"mypath",
          style: "fill:none;stroke:grey;stroke-width:2px",
          labelStyle: "fill:#778899;font-weight:bold",
          arrowhead:"vee",
          arrowheadStyle:"fill:grey;" });
        this.updateGraph();
      }
      else{
        this.linksData.push({ source: source, target: target, label: operation });
        const sourceNode = this.graph.node(source);
        const targetNode = this.graph.node(target);
        // 计算弧线的路径
        const pathData = this.calculateArcPath(sourceNode, targetNode);
        const svg = d3.select(".svgArea")
        // 添加弧线到 SVG
        this.links = svg.selectAll('.mylink')
            .data(this.linksData, d => d.id)  // 使用 key 函数
            .enter()
            .append('path')
            .attr('d', pathData)
            .attr('stroke', 'grey')
            .attr('fill', 'none')
            .attr('stroke-width', 2)
            .attr('class', 'mylink')
            .attr("id", d => `${d.source}-${d.target}`)

        // 为每个弧线生成唯一的ID
        const uniqueId = `textPath_${this.linksData.length}`;
        // 添加 <defs> 元素
        const defs = svg.append('defs');
        // 为每个 label 创建 <textPath>
        const linkTextPaths = defs.selectAll('.linkTextPath')
            .data(this.linksData)
            .enter()
            .append('path')
            .attr('id', (_, i) => `${uniqueId}_${i}`)
            .attr('d', pathData);
        // 添加 label 到每个弧线
        const linksTexts = svg.selectAll('.linkText')
            .data(this.linksData)
            .enter()
            .append('text')
            .attr('dy', -5)  // 垂直方向微调
            .append('textPath')
            .attr('xlink:href', (_, i) => `#${uniqueId}_${i}`)
            .text(operation)
            .attr('class', 'linkText')
            .attr("id", d => `${d.source}-${d.target}`)
            .style('fill', '#778899')
            .style('font-weight','bold')
            .attr('startOffset', '20%');
      }
    },
    getNodePosition(node) {
      const x = node.x;
      const y = node.y;
      return {x, y};
    },

    calculateArcPath(sourceNode, targetNode) {
      const height = 26
      // 根据需要计算弧线的路径，这里简化为一个弧线
      const sourcePosition = this.getNodePosition(sourceNode);
      const targetPosition = this.getNodePosition(targetNode);

      // 在实际应用中，您可能需要更复杂的计算方法
      const curvePath = d3.path();
      curvePath.moveTo(sourcePosition.x+50, sourcePosition.y+50-height);
      curvePath.quadraticCurveTo(
          (sourcePosition.x + targetPosition.x) / 2+50,
          (sourcePosition.y + targetPosition.y) / 2+50-40-height ,
          targetPosition.x+50,
          targetPosition.y+50-height
      );

      return curvePath.toString();
    },

    // 为节点绑定事件
    bindNodeEvents() {
      const svg = d3.select(".svgArea")
      this.nodes.forEach(node => {
        d3.select(`#${node.id}`).on('click', () => {
          // 点击节点的处理逻辑
          this.handleNodeClick(node.id);
        });
        // 悬浮事件
        d3.select(`#${node.id}`).on('mouseover', () => {
          // 更新所有连线的颜色为蓝色
          svg.selectAll('.mylink')
              .style('stroke', function () {
                const linkId = d3.select(this).attr('id');
                return linkId.includes(node.id) ? '#69b3b2' : 'grey';
              })
        });
        d3.select(`#${node.id}`).on('mouseout', () => {
          // 移出事件的处理逻辑
          svg.selectAll('.mylink')
              .style('stroke', 'grey')
              .style('stroke-width', 2);
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
      if (!this.pathData[store.state.curExpression]){
        this.pathData[store.state.curExpression] = nodes
      }
    },

    showOperator(nodeId, operation) {
      if (operation && this.graph.node(nodeId)) {
        const newNodeId = `node${this.nextNodeId}`;
        this.addNode(" ");
        this.addEdge(nodeId, operation, newNodeId);
      }
    },

    highlightNode(node) {
      this.nodes.forEach(n => {
        const oldNode = this.graph.node(n.id);
        this.graph.setNode(n.id, {...oldNode, style: "fill:#6CA6CD;cursor:pointer"}); // 重置为原始样式
      })
      this.graph.setNode(node.id, {...node, style: "fill:#F56C6C;cursor:pointer;"});
    },

    // 在数据节点中加入参数文字
    updateNodeWithSquare(nodeId, text) {
      const nodeElem = d3.select(`#${nodeId}`);
      const node = this.graph.node(nodeId);
      const existingSquares = nodeElem.selectAll('rect');
      const rectWidth = 40;
      const rectHeight = 20;
      const spacing = 3; // 矩形块之间的间距
      const translateY = 8; // 平移的距离
      let xPosition, yPosition
      if(existingSquares.size()<=2){
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
        xPosition = -(rectWidth / 2);
        yPosition = -25 + (rectHeight/2 + spacing)* existingSquares.size(); // 垂直位置
      }
      else{
        // 更新现有矩形的位置
        if(existingSquares.size()===3){
          existingSquares.each(function(_, i) {
            const newX = parseFloat(d3.select(this).attr('x'));
            // 根据索引判断是否需要进行平移
            const adjustedX = i <= 2 ? newX - translateY*2.6 : newX;
            d3.select(this).attr('x', adjustedX);
          });
          // 同步更新对应的文本位置
          const existingTexts = nodeElem.selectAll('text');
          existingTexts.each(function(_, i) {
            const newX = parseFloat(d3.select(this).attr('x'));
            // 根据索引判断是否需要进行平移
            const adjustedX = i <= 2 ? newX - translateY*2.6 : newX;
            d3.select(this).attr('x', adjustedX);
          });
        }
        xPosition = 2;
        yPosition = -20 + (rectHeight/2 + spacing) * (existingSquares.size()-3); // 垂直位置
        if(existingSquares.size()===4){
          xPosition = 2;
          yPosition = -10 + (rectHeight/2 + spacing) * (existingSquares.size()-3); // 垂直位置
        }
      }
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
    deleteNode(nodeId) {
      const svg = d3.select(".svgArea")
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
      // 同时从 dagre-d3 的 graph 实例中删除节点和边
      nodesToDelete.forEach(nodeId => this.graph.removeNode(nodeId));
      edgesToDelete.forEach(edge => this.graph.removeEdge(edge.source, edge.target));
      // 把自己画的连线也删除
      nodesToDelete.forEach(nodeId => {
        svg.selectAll('.mylink')
            .filter(link => {
              // 根据特定节点的 ID 进行筛选
              return link.source === nodeId || link.target === nodeId;
            })
            .remove()
        svg.selectAll('.linkText')
            .filter(link => {
              // 根据特定节点的 ID 进行筛选
              return link.source === nodeId || link.target === nodeId;
            })
            .remove()
      })
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
      if(node){
        return node.label
      }
      else{
        return ""
      }
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


