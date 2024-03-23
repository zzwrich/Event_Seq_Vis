<template>
  <div class="container">
    <div class="data">Data:</div>
    <div class="view">View:</div>
    <div class="myLine"></div>
    <el-button @click="clearAll" style="position:absolute;right: 1%;top: 10px;z-index: 1;width: 5%;height: 15%;font-size: 2%">Clear All</el-button>
    <el-button @click="deleteNode(this.currentNode)" style="position:absolute;right: 7%;top: 10px;z-index: 1;width: 7%;height: 15%;font-size: 2%">Delete Node</el-button>
    <el-button @click="showAll" style="position:absolute;right: 15%;top: 10px;z-index: 1;width: 5%;height: 15%;font-size: 2%">Show All</el-button>
    <el-button @click="importExample" style="position:absolute;right: 21%;top: 10px;z-index: 1;width: 5%;height: 15%;font-size: 2%">Sample</el-button>
    <div class="workflowArea" id="workflowContainer"></div>
  </div>
  <pop-up
      :left="popupLeft"
      :top="popupTop"
      :visible="popupVisible"
      :operation-list="popupOperation"
      :visual-list="popupVisualization"
      :param-list="popupParam"
      :display-mode="displayParam"
      :checkbox-options="checkboxOptions"
      :img-list="popupVisImg"
      @close="closeHandler"/>
</template>

<script>
import {mapState} from 'vuex';
import * as d3 from "d3";
import dagreD3 from 'dagre-d3';
import store from "@/store/index.js";
import "./style.css"
import popUp from './popUp.vue';
import axios from "axios";
import {addParameter, enhanceFilterExpression, getNodePosition} from "@/components/OperArea/tool.js";

export default {
  components: {
    popUp
  },
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
      pathData: {},
      // 存储节点的上一个位置
      nodePositions: {},
      // 弹窗位置和内容
      popupLeft: 0,
      popupTop: 0,
      popupVisible: false,
      newPopupVisible: false,
      popupOperation:[],
      popupVisualization:[],
      popupVisImg:[],
      popupParam:[],
      displayParam:"",
      images: [
        { url: '../../../static/table.png', vis: "table", style:"width: 30px; height: 30px;margin: 0 5px;" },
        { url: '../../../static/barChart.png', vis: "barChart", style:"width: 30px; height: 30px;margin: 0 5px;" },
        { url: '../../../static/pieChart.png', vis: "pieChart", style:"width: 30px; height: 30px;margin: 0 5px;" },
        { url: '../../../static/sunBurst.png', vis: "sunBurst", style:"width: 30px; height: 30px;margin: 0 5px;" },
        { url: '../../../static/timeLine.png', vis: "timeLine", style:"width: 30px; height: 30px;margin: 0 5px;" },
        { url: '../../../static/Sankey.png', vis: "Sankey", style:"width: 35px; height: 35px;margin: 0 5px;" },
        { url: '../../../static/Heatmap.png', vis: "Heatmap", style:"width: 35px; height: 35px;margin: 0 5px;" }
      ],
      checkboxOptions:{},
      filterExpression: {},
      //当前的交互矩形块id,
      interactiveNodeId: "",
    };
  },
  computed: {
    ...mapState({
      selectedData: state => state.selectedData,
      selectedOperator: state => state.selectedOperator,
      selectedParameter: state => state.selectedParameter,
      isDrag: state => state.isDrag,
      isSelectedData: state => state.isSelectData,
      isSelectedParameter: state => state.isSelectParameter,
      curExpression: state => state.curExpression,
      selectContainer: state=>state.selectContainer,
      isSelectContainer: state=>state.isSelectContainer,
      isSelectVisualType: state=>state.isSelectVisualType,
      isSelectHistory: state =>state.isSelectHistory,
      filterParam: state=>state.filterParam,
      interactionData: state => state.interactionData
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
    isSelectedParameter() {
      if (this.currentNode && this.selectedParameter && this.currentNode!=="node0") {
        this.updateNodeWithSquare(this.currentNode, this.selectedParameter);
      }
      this.handleNodeClick(this.currentNode)
    },
    // 监听可视化构型的选择
    isSelectVisualType() {
      if (this.currentNode) {
        if(((this.selectedOperator==="group_by")||(this.selectedOperator==="flatten"))
            &&(["barChart", "pieChart", "sunBurst"].includes(store.state.visualType))){
          this.showOperator(this.currentNode,"count");
        }
        else{
          store.commit('setSelectedOperator',"view type")
          this.showOperator(this.currentNode,"view type");
          this.AddViewType(this.currentNode, store.state.visualType);
        }
      }
      this.handleNodeClick(this.currentNode)
    },
    // 监听代码的变化
    isSelectHistory() {
      // const myDiv =  document.getElementById(this.selectContainer)
      // let codeContext =myDiv.getAttribute("codeContext");
      let codeContext = this.curExpression
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
    },
    interactionData: {
      handler(newVal) {
        const svg = d3.select(".innerArea")
        const nodeId=Object.keys(newVal)[0]
        const value = newVal[nodeId]
        const expression = value["expression"]
        const curNode = this.graph.node(nodeId);
        let text = curNode.label
        const element = svg.select("#" + "interactiveRect" + text +"1"); // 使用CSS选择器语法查找ID
        const positionX=curNode.x;
        let positionY

        if (!element.empty()) {
          positionY = curNode.y + curNode.height*2 +15;
          text = text+"2"
        } else {
          positionY = curNode.y + curNode.height +10;
          text=text+"1"
        }

        const width = curNode.width
        const height = curNode.height

        const interactiveRect = svg.append("rect")
            .attr("x", positionX-width/2) // 矩形左上角的x坐标
            .attr("y", positionY) // 矩形左上角的y坐标
            .attr("width", width) // 矩形的宽度
            .attr("height", height) // 矩形的高度
            .attr("rx", 5) // 圆角的x半径
            .attr("ry", 5) // 圆角的y半径
            .attr('id', `${"interactiveRect"+text}`)
            .attr('class',"interactiveRect")
            .style("cursor","pointer")
            .style("fill", "transparent")
            .style("stroke", "grey")
            .style("stroke-width", 2)
            .style("stroke-dasharray", ("3, 3"))
            .on("click", () => {
              this.addNode(text,expression)
              // interactiveRect.remove()
              interactiveRect.style('display','none')
              textElem.style('display','none')
            });

        // 添加文字
        const textElem = svg.append('text')
            .attr('x', positionX)
            .attr('y', positionY+height / 2+3)
            .attr('text-anchor', 'middle')
            .text(text)
            .style("fill", "grey")
            .style("font-size", "60%")
            .style("font-weight", "bold");
      },
      deep: true
    }
},
  mounted() {
    this.setupGraph();
  },
  methods: {
    closeHandler() {
      // 关闭弹窗的逻辑
      this.popupVisible = false; // 将弹窗状态设置为不可见
    },
    onNodePositionChange() {
      // 重新计算路径
      this.linksData.forEach(link => {
        const sourceNode = this.graph.node(link.source);
        const targetNode = this.graph.node(link.target);
        const newPath = this.calculateArcPath(sourceNode, targetNode);
        d3.select(`#${link.source}-${link.target}`).attr('d', newPath);
        // 更新textPath的路径
        d3.select(`#textPath-${link.source}-${link.target}`).attr('d', newPath);
      });
    },

    clearAll(){
      if(this.nodes.length!==0){
        this.deleteNode("node0")
      }
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

    importExample(){
      this.clearAll()
      this.setupGraph()
      this.addNode(store.state.sheetName);
      this.$store.dispatch('clearCurExpression');
      this.$store.dispatch('saveSelectedOperator',"");
      this.handleNodeClick(this.currentNode);
      this.showOperator(this.currentNode,"group by");
      this.handleNodeClick(this.currentNode);
      this.updateNodeWithSquare(this.currentNode, store.state.sheetData[0]);
      this.showOperator(this.currentNode,"count");
      this.handleNodeClick(this.currentNode);
    },

    showAll(){
      const svg = d3.select(".svgArea")
      svg.selectAll('.mylink').style('visibility', 'visible');
      svg.selectAll('.linkText').style('visibility', 'visible');
      svg.selectAll('.node').style('visibility', 'visible');
      svg.selectAll('.mypath').style('visibility', 'visible');
      svg.selectAll('.edgeLabel').style('visibility', 'visible');
    },

    setupGraph() {
      const container = document.getElementsByClassName('grid-item block3')[0]
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const ranksep = 0.15*containerHeight
      const nodeseq = 0.05*containerWidth
      // 初始化图形设置
      this.graph.setGraph({ rankdir: 'TB', edgesep: 5, ranksep: ranksep, nodeseq:nodeseq });
      // 设置 SVG 和渲染器
      const offsetX = 0.05*containerWidth; // 水平偏移量
      const offsetY = 0.26*containerHeight; // 垂直偏移量
      const svg = d3.select(".workflowArea").append("svg").attr('width', containerWidth).attr('height', containerHeight)
          .attr("class",'svgArea')

      const inner = svg.append("g")
          .attr("transform", `translate(${offsetX}, ${offsetY})`).attr("class",'innerArea')

      // 用来后续更新图形
      this.updateGraph = () => {
        if (inner) {
          inner.call(this.render, this.graph);
          this.bindNodeEvents();
        }
        // 检查每个节点的位置是否发生了变化
        this.graph.nodes().forEach((nodeId) => {
          const node = this.graph.node(nodeId);
          const prevPosition = this.nodePositions[nodeId];

          if (!prevPosition || node.x !== prevPosition.x || node.y !== prevPosition.y) {
            this.onNodePositionChange(node);
            // 更新存储的位置
            this.nodePositions[nodeId] = { x: node.x, y: node.y };
          }
        });
      };
      this.updateGraph();
    },

    addNode(data,className) {
      const newNodeId = `node${this.nextNodeId++}`;
      const container = document.getElementsByClassName('grid-item block3')[0]
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const rectHeight = 0.07*containerHeight
      const rectWidth = 0.045*containerWidth
      this.nodes.push({ id: newNodeId, label: data});
      let nodeClass
      if(className){
        nodeClass = className
      }
      else nodeClass = newNodeId
      if(data === " "){
        this.graph.setNode(newNodeId, { label: data, id:newNodeId, class:nodeClass,
          style:"fill:#91b3d0;cursor:pointer",
          height: rectHeight,
          width:rectWidth,
          rx: 10,
          ry:10});
      }
      else{
        this.graph.setNode(newNodeId, { label: data, id:newNodeId,class:nodeClass,
          style:"fill:#6cc7b4;cursor:pointer",
          height: rectHeight,
          rx: 10,
          ry:10,
          labelStyle:"fill:white;font-size:70%;font-weight:bold"});
      }
      this.currentNode = newNodeId;
      this.updateGraph();
    },

    addEdge(source, operation, target) {
      this.edges.push({ source: source, target: target, label: operation });
      if (["view type"].includes(this.selectedOperator)) {
        this.graph.setEdge(source, target, { label: operation,class:"mypath",
          style: "fill:none;stroke:grey;stroke-width:2px",
          labelStyle: "fill:transparent;font-weight:bold;font-size:80%",
          arrowhead:"undirected",
          arrowheadStyle:"fill:grey;" });
        this.updateGraph();
      }
      else{
        const curLink = { source: source, target: target, label: operation }
        this.linksData.push(curLink);
        const sourceNode = this.graph.node(source);
        const targetNode = this.graph.node(target);
        // 计算弧线的路径
        const pathData = this.calculateArcPath(sourceNode, targetNode);

        // 重新计算所有路径
        const svg = d3.select(".svgArea");
        const links = svg.selectAll('.mylink')
            .data(this.linksData, d => `${d.source}-${d.target}`);
        // 处理新元素
        links.enter()
            .append('path')
            .attr('class', 'mylink')
            .merge(links)  // 合并新元素和已存在元素
            .attr('d', d => this.calculateArcPath(this.graph.node(d.source), this.graph.node(d.target)))
            .attr('stroke', 'grey')
            .attr('fill', 'none')
            .attr('stroke-width', 2)
            .attr("id", d => `${d.source}-${d.target}`)
            .attr('marker-end', 'url(#vee-arrowhead)');  // 使用 V 形箭头标记
        // 处理删除的元素
        links.exit().remove();

        // 为每个弧线生成唯一的ID
        const uniqueId = `textPath-${source}-${target}`;
        // 添加 <defs> 元素
        const defs = svg.append('defs');
        // 为每个 label 创建 <textPath>
        const linkTextPaths = defs.selectAll('.linkTextPath')
            .data(this.linksData)
            .enter()
            .append('path')
            .attr('id', `${uniqueId}`)
            .attr('d', pathData);
        // 添加 label 到每个弧线
        const linksTexts = svg.selectAll('.linkText')
            .data(this.linksData)
            .enter()
            .append('text')
            .attr('dy', -7)  // 垂直方向微调
            .append('textPath')
            .attr('xlink:href', (_, i) => `#${uniqueId}`)
            .text(operation)
            .attr('class', 'linkText')
            .attr("id", d => `${d.source}-${d.target}`)
            .style('fill', '#778899')
            .style('font-weight','bold')
            .style('font-size','80%')
            .attr('startOffset', '95%')
            .attr('text-anchor', 'end');

        const marker = svg.append('defs')
            .append('marker')
            .attr('id', 'vee-arrowhead')
            .attr('viewBox', '-0 -5 10 10')  // 设置视图框
            .attr('refX',6)  // 箭头坐标
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', "3%")  // 箭头大小
            .attr('markerHeight', "3%")
            .attr('xoverflow', 'visible');

        marker.append('svg:path')
            .attr('d', 'M0,-4L8,0L0,4L3,0L0,-4')
            .attr('fill', 'grey'); // 箭头颜色
      }
    },

    calculateArcPath(sourceNode, targetNode) {
      const container = document.getElementsByClassName('grid-item block3')[0]
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const offsetX = 0.05*containerWidth;
      const offsetY = 0.24*containerHeight;
      const height = 0.06*containerHeight
      // 根据需要计算弧线的路径，这里简化为一个弧线
      const sourcePosition = getNodePosition(sourceNode);
      const targetPosition = getNodePosition(targetNode);
      const distance = Math.sqrt(
          Math.pow(targetPosition.x - sourcePosition.x, 2) +
          Math.pow(targetPosition.y - sourcePosition.y, 2)
      );

      // 调整控制点的偏移量，根据距离来确定弧度
      const controlPointOffset = distance * 0.2;

      const curvePath = d3.path();
      curvePath.moveTo(sourcePosition.x+offsetX, sourcePosition.y+offsetY-height);
      curvePath.quadraticCurveTo(
          (sourcePosition.x + targetPosition.x) / 2+offsetX,
          (sourcePosition.y + targetPosition.y) / 2+offsetY-height - controlPointOffset,
          targetPosition.x+offsetX,
          targetPosition.y+offsetY-height
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

    createPopUp(completePath){
  // 筛选出包含 'operation' 键的对象，并提取其值
  const operationsArray = completePath
      .filter(item => item.operator) // 筛选出含有 'operator' 键的对象
      .map(item => item.operator); // 提取这些对象的 'operator' 键的值

  const operaLength = operationsArray.length
  const lastOperation = operationsArray[operaLength-1]

  store.dispatch('saveSelectedOperator', lastOperation);

  const codeContext = store.state.curExpression
  const [dataKey] = codeContext.split(".");
  const originalData = store.state.originalTableData[dataKey]
  const allKeys = Object.keys(originalData)
  if(lastOperation==="filter"){
    const uniqueProperties = {};// 遍历对象的每个键
    Object.keys(originalData).forEach(key => {
      if(!key.includes("时间")){
        const uniqueValues = new Set(originalData[key]);
        // 将 Set 转换为数组并存储在结果对象中
        uniqueProperties[key] = Array.from(uniqueValues);
      }
    });
    this.displayParam = "filter"
    this.checkboxOptions = uniqueProperties
  }
  else if(lastOperation==="unique_count"){
    this.displayParam = "unique_count"
    this.popupParam = allKeys
  }
  else{
    this.displayParam = "else"
    this.popupParam = allKeys
  }
  if(lastOperation!=="view_type"){
    // 获取下一步可能的操作和可视化构型
    axios.post('http://127.0.0.1:5000/next_opera_vis', { operation: operationsArray})
        .then(response => {
          const operationList = response.data["operationList"]
          const visualizationList = response.data["visualizationList"]
          this.popupOperation=operationList
          this.popupVisualization=visualizationList
          this.popupVisImg = this.images.filter(img => visualizationList.includes(img.vis));
          if(lastOperation==="group_by"||lastOperation==="flatten"){
            const groupNum = operationsArray.filter(item => item === "group_by").length;
            const flattenNum = operationsArray.filter(item => item === "flatten").length;
            // 计算group_by和flatten的数量差
            const diff = groupNum - flattenNum
            // 检查是否以count/unique_count结束
            if (diff === 1){
              this.popupVisualization.push("barChart", "pieChart")
              this.popupVisImg = this.images.filter(img => this.popupVisualization.includes(img.vis));
            }
            else if (diff > 1){
              this.popupVisualization.push("sunBurst")
              this.popupVisImg = this.images.filter(img => this.popupVisualization.includes(img.vis));
            }
          }
          this.popupVisible = true;
        })
        .catch(error => {
          this.popupVisible = true;
          console.error(error);
        });
  }
  else{
    this.popupVisible = false;
  }
},

    // 处理节点点击事件的逻辑
    handleNodeClick(nodeId) {
      // 获取点击节点
      const clickNode = this.graph.node(nodeId);
      const className = clickNode.class;
      // 为当前节点设置高亮效果
      this.highlightNode(clickNode)

      const container = document.getElementsByClassName('grid-item block3')[0]
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const offsetX = 0.05*containerWidth; // 水平偏移量

      this.popupLeft = clickNode.x + offsetX+50;
      this.popupTop = clickNode.y +10;

      this.updateGraph()
      // 设置当前节点
      this.currentNode = nodeId;
      // 显示从起点到当前节点的路径信息
      let pathToNode = this.findPath('node0', nodeId);
      const nodes = pathToNode.nodes
      const edges = pathToNode.edges
      const completePath = this.createCompletePaths(nodes, edges)

      if(completePath.length!==0){
        // 初始状态，还没有进行任何操作
        if(typeof(completePath)=="string"){
          this.$store.dispatch('saveCurExpression',completePath);
          this.popupParam = []
          // 获取下一步可能的操作和可视化构型
          axios.post('http://127.0.0.1:5000/next_opera_vis', { operation: []})
              .then(response => {
                const operationList = response.data["operationList"]
                const visualizationList = response.data["visualizationList"]
                this.popupOperation=operationList
                this.popupVisualization=visualizationList
                // 使用数组过滤方法来筛选保留符合条件的图片
                this.popupVisImg = this.images.filter(img => visualizationList.includes(img.vis));
                this.popupVisible = true;
              })
              .catch(error => {
                console.error(error);
              });
        }
        else{
          completePath.forEach((item,index) => {
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
              const lastIndex = index-1
              const lastKey = Object.keys(completePath[lastIndex])[0];
              const lastValue = completePath[index-1][lastKey];
              //更新表达式
              const curExpression = this.$store.state.curExpression
              let newExpression = addParameter(curExpression, value)
              if(lastValue==="filter"){
                if(value!=="time"){
                  if(this.filterExpression.hasOwnProperty(lastIndex.toString())){
                    newExpression = this.filterExpression[lastIndex];
                  }
                  else{
                    newExpression = enhanceFilterExpression(newExpression, this.filterParam);
                    this.filterExpression[lastIndex.toString()] = newExpression
                  }
                }
              }
              this.$store.dispatch('saveCurExpression',newExpression);
              if(lastValue==="view_type"){
                this.$store.dispatch('saveVisualType', value);
                this.$store.dispatch('saveNodeId', nodeId);
              }
            }
          });
          this.createPopUp(completePath)
        }
      }
      else{
        if(className!==clickNode.id){
          this.interactiveNodeId = clickNode.id
          this.$store.dispatch('saveCurExpression',className);
          this.popupParam = []
          // 获取下一步可能的操作和可视化构型
          axios.post('http://127.0.0.1:5000/next_opera_vis', { operation: []})
              .then(response => {
                const operationList = response.data["operationList"]
                const visualizationList = response.data["visualizationList"]
                this.popupOperation=operationList
                this.popupVisualization=visualizationList
                // 使用数组过滤方法来筛选保留符合条件的图片
                this.popupVisImg = this.images.filter(img => visualizationList.includes(img.vis));
                this.popupVisible = true;
              })
              .catch(error => {
                console.error(error);
              });
        }
        else{
          let pathToNode = this.findPath(this.interactiveNodeId, nodeId);
          const curInteractiveNode = this.graph.node(this.interactiveNodeId);
          const originalExpression = curInteractiveNode.class
          const nodes = pathToNode.nodes
          const edges = pathToNode.edges
          const completePath = this.createCompletePaths(nodes, edges)
          console.log("呵呵呵完整路径",completePath)
          completePath.forEach((item,index) => {
            // 获取对象的键和值
            let key = Object.keys(item)[0];
            let value = item[key];
            if(key === "node"){
              this.$store.dispatch('saveCurExpression',originalExpression);
            }
            else if(key === "operator"){
              this.$store.dispatch('saveCurExpression',this.$store.state.curExpression + '.' + value + "()");
            }
            else if(key === "parameter"){
              const lastIndex = index-1
              const lastKey = Object.keys(completePath[lastIndex])[0];
              const lastValue = completePath[index-1][lastKey];
              //更新表达式
              const curExpression = this.$store.state.curExpression
              let newExpression = addParameter(curExpression, value)
              if(lastValue==="filter"){
                if(value!=="time"){
                  if(this.filterExpression.hasOwnProperty(lastIndex.toString())){
                    newExpression = this.filterExpression[lastIndex];
                  }
                  else{
                    newExpression = enhanceFilterExpression(newExpression, this.filterParam);
                    this.filterExpression[lastIndex.toString()] = newExpression
                  }
                }
              }
              this.$store.dispatch('saveCurExpression',newExpression);
              if(lastValue==="view_type"){
                this.$store.dispatch('saveVisualType', value);
                this.$store.dispatch('saveNodeId', nodeId);
              }
            }
          });
          this.createPopUp(completePath)
        }
      }


      this.$store.dispatch('saveIsSelectNode');
      if (!this.pathData[store.state.curExpression]){
        this.pathData[store.state.curExpression] = nodes
      }
    },

    showOperator(nodeId, operation) {
      if (operation && this.graph.node(nodeId)) {
        const newNodeId = `node${this.nextNodeId}`;
        this.addNode(" ");
        this.addEdge(nodeId, operation, newNodeId);
        if(operation==="count"){
          const nextNodeId = `node${this.nextNodeId}`;
          store.commit('setSelectedOperator',"view type")
          this.addNode(" ");
          this.addEdge(newNodeId, "view type", nextNodeId);

          // 显示从起点到当前节点的路径信息
          let pathToNode = this.findPath('node0', newNodeId);
          const nodes = pathToNode.nodes
          const edges = pathToNode.edges
          const completePath = this.createCompletePaths(nodes, edges)
          const operationsArray = completePath
              .filter(item => item.operator) // 筛选出含有 'operator' 键的对象
              .map(item => item.operator); // 提取这些对象的 'operator' 键的值
          const groupNum = operationsArray.filter(item => item === "group_by").length;
          const flattenNum = operationsArray.filter(item => item === "flatten").length;
          // 计算group_by和flatten的数量差
          const diff = groupNum - flattenNum
          if (diff === 1){
            if(store.state.visualType==="pieChart"){
              store.commit('setSelectedViewType',"pieChart")
              this.AddViewType(this.currentNode, "pieChart");
            }
           else{
              store.commit('setSelectedViewType',"barChart")
              this.AddViewType(this.currentNode, "barChart");
            }
          }
          else if (diff > 1){
            store.commit('setSelectedViewType',"sunBurst")
            this.AddViewType(this.currentNode, "sunBurst");
          }
        }
        // else if(operation==="group by"){
        //   const nextNodeId = `node${this.nextNodeId}`;
        //   store.commit('setSelectedOperator',"view type")
        //   this.addNode(" ");
        //   this.addEdge(newNodeId, "view type", nextNodeId);
        //   if(store.state.visualType==="Sankey"){
        //     this.AddViewType(this.currentNode, "Sankey");
        //   }
        //   else{
        //     store.commit('setSelectedViewType',"timeLine")
        //     this.AddViewType(this.currentNode, "timeLine");
        //   }
        // }
      }
    },

    highlightNode(node) {
      this.nodes.forEach(n => {
        const oldNode = this.graph.node(n.id);
        if(n.id!=="node0"){
          this.graph.setNode(n.id, {...oldNode, style: "fill:#91b3d0;cursor:pointer"}); // 重置为原始样式
        }
        else{
          this.graph.setNode(n.id, {...oldNode, style: "fill:#6cc7b4;cursor:pointer"}); // 重置为原始样式
        }
      })
      this.graph.setNode(node.id, {...node, style: "fill:#e47470;cursor:pointer;"});
    },

    // 在数据节点中加入参数文字
    updateNodeWithSquare(nodeId, text) {
      const nodeElem = d3.select(`#${nodeId}`);
      const node = this.graph.node(nodeId);
      const existingSquares = nodeElem.selectAll('rect');
      const rectWidth =  node.width/2
      const rectHeight = rectWidth/2
      const spacing = rectHeight/2; // 矩形块之间的间距
      const translateY = rectHeight/2+1
      let xPosition, yPosition
      if(existingSquares.size()<=4) {
        if (existingSquares.size() <= 2) {
          // 更新现有矩形的位置
          existingSquares.each(function () {
            d3.select(this)
                .attr('y', d => parseFloat(d3.select(this).attr('y')) - translateY);
          });
          // 同步更新对应的文本位置
          const existingTexts = nodeElem.selectAll('text');
          existingTexts.each(function () {
            d3.select(this)
                .attr('y', d => parseFloat(d3.select(this).attr('y')) - translateY);
          });
          xPosition = -(rectWidth / 2);
          yPosition = -(rectHeight / 2) + spacing * (existingSquares.size() - 1);
        } else {
          if (existingSquares.size() === 3) {
            existingSquares.each(function (_, i) {
              const newX = parseFloat(d3.select(this).attr('x'));
              // 根据索引判断是否需要进行平移
              const adjustedX = i <= 2 ? newX - translateY * 2 : newX;
              d3.select(this).attr('x', adjustedX);
            });
            // 同步更新对应的文本位置
            const existingTexts = nodeElem.selectAll('text');
            existingTexts.each(function (_, i) {
              const newX = parseFloat(d3.select(this).attr('x'));
              // 根据索引判断是否需要进行平移
              const adjustedX = i <= 2 ? newX - translateY * 2 : newX;
              d3.select(this).attr('x', adjustedX);
            });
          }
          xPosition = 2;
          yPosition = -rectHeight / 2 - translateY;
          if (existingSquares.size() === 4) {
            xPosition = 2;
            yPosition = -(rectHeight / 2) + spacing * (existingSquares.size() - 3)
          }
        }
        const newSquare = nodeElem.append('g'); // 使用 'g' 元素来组合正方形和文本
        newSquare.append('rect')
            .attr('x', xPosition)
            .attr('y', yPosition)
            .attr('width', rectWidth)
            .attr('height', rectHeight)
            .style('fill', 'transparent');
        // 添加有限长度的文字
        const maxTextLength = 2; // 最大文本长度
        let displayText = text.length > maxTextLength ? text.substring(0, maxTextLength) + '...' : text;
        let CircleText = text.length > 1 ? text.substring(0, maxTextLength) : text;
        // 添加文字
        const textElem = newSquare.append('text')
            .attr('x', xPosition + rectWidth / 2)
            .attr('y', yPosition + rectHeight / 2 +3)
            .attr('text-anchor', 'middle')
            .text(displayText)
            .attr('id', text) // 设置 ID
            .style("fill", "#FFFFbb")
            .style("font-size", "60%")
            .style("font-weight", "bold");

        // 鼠标悬浮事件显示完整文本
        newSquare.on('mouseover', () => textElem.text(text));
        newSquare.on('mouseout', () => textElem.text(displayText));
        this.maxText += CircleText
        // 更新节点的 label 属性
        this.graph.setNode(nodeId, {
          ...node,
          label: text,
          labelStyle: "fill:rgba(0, 0, 0, 0);font-size:12px;font-weight:bold"
        });
        this.updateGraph();
      }
    },

    AddViewType(nodeId, text) {
      const container = document.getElementsByClassName('grid-item block3')[0]
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const nodeElem = d3.select(`#${nodeId}`);
      nodeElem.selectAll(".view_type").remove()
      const node = this.graph.node(nodeId);
      const rectWidth =  0.05*containerWidth;
      const rectHeight = 0.12*containerHeight
      let xPosition, yPosition
      xPosition = -rectWidth/2;
      yPosition = -rectHeight/2;
      const newSquare = nodeElem.append('g').attr('class','view_type');
      // 添加有限长度的文字
      const maxTextLength = 8; // 最大文本长度
      let displayText = text.length > maxTextLength ? text.substring(0, maxTextLength) + '...' : text;
      let CircleText = text.length > 1 ? text.substring(0, maxTextLength): text;
      // 添加文字
      const textElem = newSquare.append('text')
          .attr('x', xPosition + rectWidth / 2)
          .attr('y', yPosition + rectHeight / 2 + 3)
          .attr('text-anchor', 'middle')
          .text(displayText)
          .attr('id', text) // 设置 ID
          .style("fill", "#FFFFbb")
          .style("font-size", "78%")
          .style("font-weight", "bold");

      // 鼠标悬浮事件显示完整文本
      newSquare.on('mouseover', () => textElem.text(text));
      newSquare.on('mouseout', () => textElem.text(displayText));
      // 更新节点的 label 属性
      this.graph.setNode(nodeId, { ...node, label: text,labelStyle:"fill:rgba(0, 0, 0, 0);font-size:12px;font-weight:bold"});
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
        this.linksData = this.linksData.filter(link => {
          return link.source !== nodeId && link.target !== nodeId;
        });

        const linksToDelete = svg.selectAll('.mylink')
            .filter(link => {
              // 根据特定节点的 ID 进行筛选
              return link.source === nodeId || link.target === nodeId;
            });
        // 从选定的元素中移除
        linksToDelete.remove();
        svg.selectAll('.linkText')
            .filter(link => {
              // 根据特定节点的 ID 进行筛选
              return link.source === nodeId || link.target === nodeId;
            })
            .remove()
      })
      this.updateGraph();
      this.popupVisible = false
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
      edges.forEach(edge => {
        if (edge.label.includes(" ")) {
          edge.label = edge.label.replace(/ /g, "_");
        }
      });
      let containsViewType = edges.some(edge => edge.label === 'view_type');
      if (containsViewType) {
        let targetsOfViewType = edges.filter(edge => edge.label === 'view_type').map(edge => edge.target);
        // edges = edges.filter(edge => edge.label !== 'view_type');
        // nodes = nodes.filter(node => !targetsOfViewType.includes(node));
        const curText = this.getTextsInfo(targetsOfViewType[0])[0];
        store.commit('setSelectedViewType',curText.text)
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
          // if (targetLabel !== sourceLabel) {
          //   nodeTexts.forEach(textInfo => completePaths.push({ "parameter": textInfo.text }));
          // } else {
          //   completePaths.push({ "node": targetLabel });
          // }
          nodeTexts.forEach(textInfo => completePaths.push({ "parameter": textInfo.text }));
        } else {
          // 对于其他边，只需包括边的标签和终点
          completePaths.push({ "operator": edge.label });
          nodeTexts.forEach(textInfo => completePaths.push({ "parameter": textInfo.text }));
        }
      }
      return completePaths;
    },
  },
};
</script>


