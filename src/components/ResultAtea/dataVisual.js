import * as echarts from 'echarts';
import * as d3 from 'd3';
import * as d3Sankey from './d3-sankey/index.js';
import store from '@/store'
import {formatDateTime, hexToRgb, parseAction, findSequencesContainingSubsequence, generateColorMap, toggleVisibility, getBarChartOption,
    getPieChartOption, convertToTreeData, filterEvents, getRelatedNodes, getRelatedLinks, estimateSankeySize, addHierarchyInfo, processSankeyData,
    createSunburstData} from './tool.js'
import axios from "axios";
let usernameTextWidth = {}
let sankeyChart
let sankeyNodesData=[]
let sankeyLinksData=[]
let sankeyLinks;
let sankeyNodes;
let sankeyHeads;
let sankeyTails

export default {
    chooseWhich(operation, containerId, data, visualType, seqView){
        const divElement = document.getElementById(containerId);
        if(divElement.firstChild){
            while (divElement.firstChild) {
                divElement.removeChild(divElement.firstChild);
            }
        }

        if (["filter", "original", "difference_set", "intersection_set"].includes(operation)) {
            this.createTable(containerId, data);
        }
        if(operation === "unique_attr"){
            this.createList(containerId, data);
        }
        if(operation === "unique_count" || operation === "count"){
            let option
            if(visualType==null || visualType==="barChart"){
                this.createChart(containerId, data, "bar");
            }
            else{
                this.createChart(containerId, data, "pie");
            }
        }
        if(operation === "group_by" || operation === "seq_view"){
            if(visualType==null || visualType==="timeLine"){
                this.createTimeLine(containerId, data, seqView);
            }
            else if(visualType==="hierarchy"){
                this.createHierarchy(containerId, convertToTreeData(data,seqView));
            }
            else if(visualType==="sunburst"){
                this.createIcicle(containerId, convertToTreeData(data,seqView));
            }
            else{
                this.createTimeLine(containerId, data, seqView);
            }
        }
    },
    // 表格类型
    createTable(containerId, data) {
        // 检查数据的有效性
        if (!data || !Object.keys(data).length) {
            console.error('Invalid or empty data provided to createTable');
            return;
        }
        // 创建包含表格的滚动容器的 HTML
        let tableHtml = '<div class="el-table-wrapper">';
        tableHtml += '<button id="exportButton" class="el-button" style="margin-left: 0">导出表格</button>';

        tableHtml += '<table class="el-table">';
        // 添加表头
        tableHtml += '<thead><tr>';
        Object.keys(data).forEach(key => {
            tableHtml += `<th class="el-table-column">${key}</th>`;
        });
        tableHtml += '</tr></thead>';

        // 添加表格数据
        tableHtml += '<tbody>';
        const rowCount = data[Object.keys(data)[0]].length; // 假设所有数组长度相同
        for (let i = 0; i < rowCount; i++) {
            tableHtml += '<tr>';
            Object.keys(data).forEach(key => {
                const cellData = data[key][i];
                if (typeof cellData === 'string' && cellData.includes('GMT')) {
                    // 如果数据是日期时间字符串类型，进行格式化
                    const formattedDateTime = formatDateTime(cellData);
                    tableHtml += `<td class="el-table-column">${formattedDateTime}</td>`;
                } else {
                    // 否则直接显示数据
                    tableHtml += `<td class="el-table-column">${cellData}</td>`;
                }
            });

            tableHtml += '</tr>';
        }
        tableHtml += '</tbody>';
        tableHtml += '</table></div>';

        function exportTableToCSV(filename) {
            const csv = [];
            const rows = document.querySelectorAll("#" + containerId + " .el-table tr");

            for (let i = 0; i < rows.length; i++) {
                const row = [], cols = rows[i].querySelectorAll("td, th");

                for (let j = 0; j < cols.length; j++) {
                    const text = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, "").replace(/(\s\s+)/gm, " ");
                    row.push(`"${text}"`);
                }

                csv.push(row.join(","));
            }
            // 正常显示中文
            const BOM = "\uFEFF";
            const csvData = BOM + csv.join("\n");

            const csvFile = new Blob([csvData], { type: "text/csv" });
            const downloadLink = document.createElement("a");

            downloadLink.download = filename;
            downloadLink.href = window.URL.createObjectURL(csvFile);
            downloadLink.style.display = "none";

            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
        // 获取目标容器元素
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = tableHtml;
            // 绑定导出按钮的点击事件
            document.getElementById('exportButton').addEventListener('click', function () {
                exportTableToCSV('exported_table.csv');
            });
        } else {
            console.error(`Container with ID '${containerId}' not found.`);
        }
    },

    createList(containerId, data) {
    // 获取目标容器元素
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    function renderData(data, level) {
        const table = document.createElement('table');
        table.classList.add('el-table');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';

        for (const key in data) {
            const tr = document.createElement('tr');
            tr.classList.add('el-table-row', `level-${level}`);

            const th = document.createElement('th');
            th.textContent = key;
            th.classList.add('el-table-column', `level-${level}`);
            th.style.border = '1px solid #e0e0e0';
            th.style.padding = '10px';
            th.style.textAlign = 'left';
            th.style.background = '#f3f3f3';
            th.style.fontWeight = 'bold';

            const value = data[key];

            if (typeof value === 'object' && !Array.isArray(value)) {
                // 添加展开/隐藏按钮
                const toggleButton = document.createElement('button');
                toggleButton.className = 'el-button';
                toggleButton.textContent = '隐藏'; // 默认状态为展开，所以按钮显示“隐藏”
                const nestedRow = document.createElement('tr');
                nestedRow.classList.add('nested-table', `level-${level + 1}`);

                toggleButton.onclick = () => {
                    toggleVisibility(nestedRow, toggleButton);
                };
                th.appendChild(toggleButton);

                // 创建嵌套表格所在的行
                const td = document.createElement('td');
                td.colSpan = 2;
                td.appendChild(renderData(value, level + 1));
                nestedRow.appendChild(td);

                tr.appendChild(th);
                table.appendChild(tr);
                table.appendChild(nestedRow);
            } else {
                // 显示键值对
                const tdValue = document.createElement('td');
                tdValue.textContent = value;
                tdValue.style.border = '1px solid #e0e0e0';
                tdValue.style.width = "70%"; // 直接设置宽度
                tdValue.style.padding = '10px';
                tdValue.style.textAlign = 'left';

                tr.appendChild(th);
                tr.appendChild(tdValue);
                table.appendChild(tr);
            }
        }

        return table;
    }

    container.innerHTML = ''; // 清空容器
    const topLevelTable = renderData(data, 1); // 从第一级开始渲染
    container.appendChild(topLevelTable);
    },

    createChart(containerId, data, chartType) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        let chartContainer = container.querySelector('.echart-container');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.className = "echart-container";
            chartContainer.style.width = '100%'; // 设置宽度
            chartContainer.style.height = '100%'; // 设置高度，根据需要调整
            container.appendChild(chartContainer);
        }

        let myChart = echarts.getInstanceByDom(chartContainer);
        if (myChart) {
            myChart.dispose();
        }
        myChart = echarts.init(chartContainer);

        let option;
        if (chartType === 'bar') {
            option = getBarChartOption(data);
        } else if (chartType === 'pie') {
            option = getPieChartOption(data);
        }

        myChart.setOption(option);
    },

    createTimeLine(containerId, data, seqView) {
        // 检查数据的有效性
        if (!data || Object.keys(data).length === 0) {
            return;
        }

        const container = document.getElementById(containerId);
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerRect = document.getElementById(containerId).getBoundingClientRect();

        const colorMap = generateColorMap(data,seqView);
        // 创建 SVG 容器
        let margin = { top: 0.01*containerHeight, left: 0.01*containerHeight, right: 0.02*containerWidth };
        // 找到最长的事件序列的长度
        let maxLength = 0;
        let eventCount= 0
        // 计算圆形的半径
        const scaleFactor = 0.025;
        let circleRadius = Math.min(containerWidth, containerHeight) * scaleFactor / 2;
        let circleSpacing = circleRadius/2

        Object.values(data).forEach(user => {
            eventCount = user[seqView].length
            if (eventCount > maxLength) {
                maxLength = eventCount;
            }
        })
        // 在容器中添加按钮
        const startButton = document.createElement('button');
        startButton.innerText = '开始框选';
        startButton.id = 'start-selection';
        startButton.className = 'el-button';
        const closeButton = document.createElement('button');
        closeButton.innerText = '关闭框选';
        closeButton.id = 'close-selection';
        closeButton.className = 'el-button';
        // 创建一个勾选框
        const queryBox = document.createElement('input');
        queryBox.type = 'checkbox';
        queryBox.id = 'query-selection';
        queryBox.className = 'el-checkbox-input';
        // 创建一个标签来显示文字
        const label = document.createElement('label');
        label.className = 'el-checkbox';
        label.htmlFor = 'query-selection';
        // 创建用于自定义外观的 span 元素
        const customCheckbox = document.createElement('span');
        customCheckbox.className = 'el-checkbox__inner';
        // 将勾选框、自定义的 span 元素和标签添加到页面的某个元素中
        label.appendChild(queryBox);
        label.appendChild(customCheckbox);
        label.appendChild(document.createTextNode('模糊查询'));
        // 创建包装容器
        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';
        // 创建起始时间输入框
        const startTimeInput = document.createElement('input');
        startTimeInput.type = 'number';
        startTimeInput.id = 'start-time-input';
        startTimeInput.className = 'el-input';
        startTimeInput.placeholder = '分钟';
        // 创建结束时间输入框
        const endTimeInput = document.createElement('input');
        endTimeInput.type = 'number';
        endTimeInput.id = 'end-time-input';
        endTimeInput.className = 'el-input';
        endTimeInput.placeholder = '分钟';
        // 创建表示范围的标签
        const toLabel = document.createElement('span');
        toLabel.innerText = '-';
        toLabel.className = 'range-label';

        // 创建起始时间输入框
        const Event1Input = document.createElement('input');
        Event1Input.id = 'event1-input';
        Event1Input.className = 'el-input';
        Event1Input.placeholder = '事件1';
        // 创建结束时间输入框
        const Event2Input = document.createElement('input');
        Event2Input.id = 'event2-input';
        Event2Input.className = 'el-input';
        Event2Input.placeholder = '事件2';
        const checkButton = document.createElement('button');
        checkButton.innerText = '查看';
        checkButton.id = 'check';
        checkButton.className = 'el-button';
        const resetButton = document.createElement('button');
        resetButton.innerText = '还原';
        resetButton.id = 'reset';
        resetButton.className = 'el-button';
        // 创建选择框
        const filterCheckbox = document.getElementById('checkbox-container') || document.createElement('div');
        filterCheckbox.id = 'checkbox-container';

        // 创建新的包装容器
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'controls-container';
        // 将元素添加到新的包装容器中
        controlsContainer.appendChild(label);
        controlsContainer.appendChild(startButton);
        controlsContainer.appendChild(closeButton);
        controlsContainer.appendChild(inputContainer);
        inputContainer.appendChild(startTimeInput);
        inputContainer.appendChild(toLabel);
        inputContainer.appendChild(endTimeInput);
        inputContainer.appendChild(Event1Input);
        inputContainer.appendChild(Event2Input);
        inputContainer.appendChild(checkButton);
        inputContainer.appendChild(resetButton);
        container.appendChild(controlsContainer);

        // 为起始时间输入框添加事件监听器
        startTimeInput.addEventListener('input', function() {
            let startTimeValue = parseInt(this.value, 10);
            if (isNaN(startTimeValue)) {
                endTimeInput.value = ''; // 如果输入非数字，清空结束时间输入框
            } else {
                if (startTimeValue > 0) {
                    startTimeValue = -startTimeValue; // 如果输入的是正数，转换为负数
                    this.value = startTimeValue;
                }
                endTimeInput.value = -startTimeValue; // 设置结束时间为起始时间的相反数
            }
        });
        // 添加查看按钮的点击事件监听器
        checkButton.addEventListener('click', function() {
            const startTime = parseInt(startTimeInput.value, 10);
            const endTime = parseInt(endTimeInput.value, 10);
            const event1 = Event1Input.value;
            const event2 = Event2Input.value;
            // 调用函数来筛选事件
            const filteredEvents = filterEvents(data, startTime, endTime, event1, event2, seqView);
            // 展示筛选出的事件
            displayFilteredEvents(filteredEvents);
        });

        let isChangeUsername = false
        function displayFilteredEvents(filteredEvents) {
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            // 首先移除所有旧的线条
            svg.selectAll('.event-pairs').remove();
            // 先将所有事件圆形颜色设置为灰色
            svg.selectAll('.event-circle').style('fill', 'grey');
            Object.keys(filteredEvents).forEach(username => {
                filteredEvents[username].forEach(eventPair => {
                    // 为属于eventPair的事件圆形添加特定类名
                    let circleName = `circle-${username}`;
                    svg.selectAll(`[circleName="${circleName}"]`)
                        .filter((d, i) => i === eventPair.event1 || i === eventPair.event2)
                        .classed('paired-event', true);

                    const event1Coords = getCircleCoordinates(username, eventPair.event1, data, containerWidth, containerHeight);
                    const event2Coords = getCircleCoordinates(username, eventPair.event2, data, containerWidth, containerHeight);
                    // 计算控制点坐标
                    const controlX = (event1Coords.x + event2Coords.x) / 2;
                    const controlY = Math.min(event1Coords.y, event2Coords.y) - 40; // 控制点偏移量，可根据需要调整
                    // 绘制弧形路径
                    const pathData = `M ${event1Coords.x} ${event1Coords.y} Q ${controlX} ${controlY} ${event2Coords.x} ${event2Coords.y}`;
                    svg.append('path')
                        .attr('class', 'event-pairs') // 为线条添加类名，便于后续选择和移除
                        .attr('d', pathData)
                        .attr('stroke', '#555555')
                        .attr('fill', 'none');
                });
            });
            // 将属于eventPair的事件圆形颜色设置回原色
            svg.selectAll('.paired-event').style('fill', (d) => colorMap[parseAction(d)]);
        }
        // 重置按钮
        resetButton.addEventListener('click', function() {
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            // 移除所有连接线
            svg.selectAll('.event-pairs').remove();
            // 将所有事件圆形的颜色还原到原始状态
            svg.selectAll('.event-circle')
                .style('fill', d => colorMap[parseAction(d)])
                .classed('paired-event', false); // 如果使用了特定类名进行高亮显示，移除该类名
        });
        //获取事件坐标
        function getCircleCoordinates(username, index, data) {
            // 构造对应的选择器
            const selector = `.event-circle[circleName="circle-${username}"]:nth-child(${index + 1})`;
            // 选择对应的圆形元素
            const selectedCircle = d3.select(selector);
            // 获取圆心坐标
            const xPos = parseFloat(selectedCircle.attr('cx'))+ (circleRadius * 2 + circleSpacing) + usernameTextWidth["username"+containerId];
            const yPos = parseFloat(selectedCircle.attr('cy')) + (Object.keys(data).indexOf(username) + 1) * (circleRadius * 2.5 + circleSpacing) -circleRadius*2;
            return { x: xPos, y: yPos };
        }

        // 计算 SVG 的宽度
        let svgWidth = margin.left + (maxLength+1) * (circleRadius * 2 + circleSpacing) + margin.right;
        if (svgWidth < containerWidth){
            svgWidth = containerWidth
        }
        const svg = d3.select(container)
            .append('svg')
            .attr('class', 'svgContainer'+containerId)
            .attr('width', svgWidth)
            .attr('height', '100%')
            .attr('overflow','auto')
            .attr('transform', `translate(${margin.left},${margin.top})`)

        // 创建图例
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(15, ${Object.keys(data).length * (circleRadius * 2.5 + circleSpacing) + containerHeight*0.05})`); // 控制图例位置

        // 添加图例矩形和文字
        const legendItems = Object.keys(colorMap);

        function toggleCirclesVisibility(item) {
            const circles = svg.selectAll('.event-circle');
            const isVisible = circles.filter(d => parseAction(d) === item).style('visibility') === 'visible';
            circles.filter(d => parseAction(d) === item)
                .style('visibility', isVisible ? 'hidden' : 'visible');
        }

        let totalLegendWidth = 0; // 用于存储总宽度
        let legendY = 0;
        // 点击图例变色
        const highlightColor = "#909399"; // 高亮颜色，比如灰色
        legendItems.forEach((item, index) => {
            const rectSize = Math.min(containerWidth, containerHeight) * 0.02;
            // 添加图例文字
            const legendText = legend.append('text').text(item).style('font-size', rectSize/1.5);
            // 获取图例文本的宽度
            const legendTextWidth = legendText.node().getBBox().width;

            let gap = circleRadius*1.5
            let legendX = totalLegendWidth;
            let legendCountInRow = 0;
            // 总宽度
            totalLegendWidth += gap+rectSize+legendTextWidth;
            // 计算一行可以容纳多少个图例
            const availableLegendCount = Math.floor(svgWidth / totalLegendWidth);
            // 根据图例数量决定是否换行
            if (legendCountInRow >= availableLegendCount) {
                legendX = 0;
                totalLegendWidth = 0;
                totalLegendWidth += gap+rectSize+legendTextWidth;
                legendY += rectSize*2;
                legendCountInRow = 0;
            }
            legendCountInRow++;
            legendText
                .attr('x', legendX+rectSize*1.5+legendTextWidth/2).attr('y', legendY+ rectSize*0.6)
                .attr('text-anchor', 'middle').attr('alignment-baseline', 'middle')
                .style('fill', colorMap[item]) // 根据操作类型选择颜色
                .style('font-weight', 'bold')
                .style('cursor', 'pointer') // 设置鼠标悬浮时显示手指样式
                .on('click', function() {
                // 切换与此图例项相关的事件圆形的可见性
                toggleCirclesVisibility(item);
                const currentColor = d3.select(this).style('fill');
                const originalColorRgb = hexToRgb(colorMap[item]);
                // 切换颜色
                d3.select(this).style('fill', currentColor === originalColorRgb ? highlightColor : colorMap[item]);
            });

            // 添加图例矩形
            legend.append('rect')
                .attr('x', legendX)
                .attr('y', legendY)
                .attr('width', rectSize)
                .attr('height', rectSize)
                .style('fill', colorMap[item]);
        });
        // 用于存储已选中的用户名
        const selectedUsernames = [];
        // 遍历数据，创建事件符号
        Object.keys(data).forEach((username, index) => {
            const events = data[username][seqView];
            const yPos = (index+1) * (circleRadius * 2.5 + circleSpacing); // 控制圆形的垂直位置
            // 用于估算宽度的用户名
            const usernameTextforWidth = svg.append('text')
                .attr('x', 10) // 控制用户名的水平位置
                .attr('y', yPos+circleRadius/2)
                .text(username)
            // 定义颜色映射比例尺
            const colorScale = d3.scaleSequential(d3.interpolate('#00FF00', '#FF0000')) // 从绿色插值到红色
                .domain([0, maxLength]); // 设定域为 [0, maxLength]
            // 添加矩形框
            const usernameRect = svg.append('rect')
                .attr('x', 10-usernameTextforWidth.node().getBBox().width*0.1) // 控制矩形框的水平位置，与用户名文本的位置一致
                .attr('y', yPos-circleRadius)
                .attr('width', usernameTextforWidth.node().getBBox().width*1.2)
                .attr('height',  Math.max(20,usernameTextforWidth.node().getBBox().height))
                .style('fill',  d => colorScale(events.length))
                .style('opacity', 0.2)
                .style('cursor', 'pointer')

            const usernameText = svg.append('text')
                .attr('x', 10) // 控制用户名的水平位置
                .attr('y', yPos+circleRadius/2)
                .text(username)
                .attr("username", `username-${username}`)
                .style('fill', "#909399")
                .style('font-weight', 'bold')
                .style('cursor','pointer')
                .on('click', function () {
                    svg.selectAll(".highlighted-username").classed("highlighted-username", false);
                    const selectedUsername = d3.select(this).text();
                    const isSelected = selectedUsernames.includes(selectedUsername);
                    d3.select(this).classed('selectedName', !isSelected);
                    if (isSelected) {
                        // 如果已选中，从数组中移除
                        const index = selectedUsernames.indexOf(selectedUsername);
                        if (index !== -1) {
                            selectedUsernames.splice(index, 1);
                        }
                    } else {
                        // 如果未选中，添加到数组中
                        selectedUsernames.push(selectedUsername);
                    }
                    selectedUsernames.forEach(username => {
                        const name = `username-${username}`;
                        svg.select(`[username="${name}"]`)
                            .classed("highlighted-username", true); // 添加高亮类
                    });
                    // // 获取所有已选中用户的事件序列
                    // const nodesArray = selectedUsernames.flatMap(username => {
                    //     const userEvents = data[username][seqView];
                    //     return Object.entries(userEvents).map(([key, value]) => `${value} ${key}`);
                    // });
                    // 测试后端
                    const requestData = {
                        data:data,
                        selectedNames:selectedUsernames,
                        seqView:seqView
                    };
                    axios.post('http://127.0.0.1:5000/get_highlight_data', requestData)
                        .then(response => {
                            const nodesArray = response.data['nodesArray'];
                            // 获取与已选中用户相关的连线
                            const linksArray = getRelatedLinks(nodesArray, sankeyLinksData);
                            highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, linksArray, nodesArray,true)
                        })
                        .catch(error => {
                            console.error('Error:', error);
                        });
                });
            // 获取用户名文本的宽度
            usernameTextWidth["username"+containerId] = usernameText.node().getBBox().width;

            // 在 SVG 容器外部创建一个提示框元素
            const tooltip = d3.select(container)
                .append("div")
                .attr("class", "tooltip")

            let circleName = `circle-${username}`;
            const hierarchyEvent=addHierarchyInfo(data[username],seqView)
            const {nodes,links}=processSankeyData(hierarchyEvent,seqView)
            d3Sankey.sankey()
                .nodeAlign(d3Sankey.sankeyCenter)
                .nodePadding(0)
                .size([events.length * (circleRadius*2 + circleSpacing), circleRadius*4])
                ({nodes:nodes, links:links});
            // 创建桑基图
            const eventChart = svg.append('g')
                .attr('class', 'sankeyChart')
                .attr('transform', `translate(${usernameTextWidth["username"+containerId]+(circleRadius * 2 + circleSpacing)}, ${yPos-circleRadius * 2})`); // 控制图例位置
            // 绘制链接
            eventChart.append("g")
                .selectAll('path')
                .data(links)
                .enter()
                .append('path')
                .filter(d => d.target.name !== 'unknown')
                .attr('d', d => d3Sankey.sankeyLinkHorizontal(0, false)(d))
                .attr('stroke', 'grey')
                .attr('stroke-width', 2)
                .attr('stroke-opacity', 0.6)
                .attr('fill', 'none');
            // 绘制节点
            const circles = eventChart.append("g")
                .selectAll('circle')
                .data(nodes.filter(d => d.name !== 'unknown'))
                .enter()
                .append('circle')
                .attr('class','event-circle')
                .attr('circleName', `circle-${username}`)
                .attr('id', (d, i) =>i)
                .attr('cx', d => (d.x0 + d.x1) / 2)
                .attr('cy', d => (d.y0 + d.y1) / 2)
                .attr('r', d => Math.max((d.x1 - d.x0) / 4,(d.y1 - d.y0) / 4))
                .attr('fill', d => colorMap[parseAction(d.name.replace(/\s\d+$/, ''))])
                .attr('fill-opacity', 1)
                .style('cursor','pointer')
                .on("mouseover", function(event, d) {
                    const circleId = this.id; // 获取当前圆形的 ID
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);
                    // 创建要显示的信息字符串
                    let tooltipContent = "<strong>" + username + "</strong><br/>";
                    Object.keys(data[username]).forEach(key => {
                        if (Array.isArray(data[username][key]) && data[username][key][circleId] !== undefined) {
                            let cellData = data[username][key][circleId]
                            if (typeof cellData === 'string' && cellData.includes('GMT')) {
                                // 如果数据是日期时间字符串类型，进行格式化
                                cellData = formatDateTime(cellData);
                            }
                            tooltipContent += key + ": " + cellData + "<br/>";
                        }
                    });
                    tooltip.html(tooltipContent) // 设置提示框的内容
                        .style("left", (event.pageX)-containerRect.left+ container.scrollLeft  + "px")
                        .style("top", (event.pageY - containerRect.top) + "px")
                        .style("width", "auto")
                        .style("white-space", "nowrap");
                })
                .on("mouseout", function(d) {
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
        });
        // 桑基图高亮样式
        function highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes, isSelectUser) {
            sankeyLinks.attr('stroke-opacity', link => (relatedLinks.includes(link) ? 0.8 : 0.1));
            sankeyLinks.attr('stroke', link => (relatedLinks.includes(link) ? `url(#line-gradient-${link.index})` : '#DCDCDC'));
            sankeyHeads.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
            sankeyTails.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
            if (!isSelectUser) {
                relatedNodes = relatedNodes.map(item => item.name);
                // sankeyNodes.attr('fill-opacity', node => (relatedNodes.includes(node) ? 1 : 0.1));
            }
            // else{
            //     sankeyNodes.attr('fill-opacity', node => (relatedNodes.includes(node.name) ? 1 : 0.1));
            // }
            sankeyChart.selectAll('.sunburst-node')
                .filter(function () {
                    return relatedNodes.includes(d3.select(this).attr('nodeText'));
                })
                .attr('fill-opacity', 1)
            // 设置不在 namesArray 中的节点的透明度
            sankeyChart.selectAll('.sunburst-node')
                .filter(function () {
                    return !relatedNodes.includes(d3.select(this).attr('nodeText'));
                })
                .attr('fill-opacity', 0.1)
            // 画突出线段
            relatedLinks.forEach(link => {
                const pathCoordinates = d3Sankey.sankeyLinkHorizontal(30,true)(link);
                sankeyChart.append('path')
                    .attr('d', pathCoordinates)
                    .attr('fill', 'none')
                    .attr('stroke-opacity', 0.5)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 2)
                    .attr('class', 'highlight-line');
            });
        }
        function resetSankeyChart(sankeyChart,sankeyLinksData, sankeyNodes, sankeyHeads, sankeyTails, sankeyTooltip) {
            sankeyChart.selectAll('path.highlight-line').remove();
            // sankeyNodes.attr('fill-opacity', 1);
            sankeyChart.selectAll(`.sunburst-node`).attr('fill-opacity', 1);
            sankeyLinks.attr('stroke-opacity', 0.5);
            sankeyLinks.attr('stroke', link => (`url(#line-gradient-${link.index})`));
            sankeyHeads.attr('fill-opacity', 1);
            sankeyTails.attr('fill-opacity', 1);
            sankeyTooltip.transition()
                .duration(500)
                .style("opacity", 0);
        }

        // 桑基图数据
        axios.post('http://127.0.0.1:5000/get_sankey_data', { data: data, seqView: seqView })
            .then(response => {
                sankeyNodesData = response.data["nodes"]
                sankeyLinksData = response.data["links"]
                // 构建节点映射，方便后续查找
                const nodeMap = new Map(sankeyNodesData.map(node => [node.name, node]));
                // 填充 links 数组中的 source 和 target 属性
                sankeyLinksData.forEach(link => {
                    link.source = nodeMap.get(link.source.name);
                    link.target = nodeMap.get(link.target.name);
                });

                const  sankeyWidth  = estimateSankeySize(sankeyNodesData,200);
                const sankey = d3Sankey.sankey()
                    .nodePadding(25)
                    .nodeAlign(d3Sankey.sankeyLeft)
                    .iterations(8)
                    .size([sankeyWidth*0.9, Object.keys(data).length*35])
                    ({nodes:sankeyNodesData, links:sankeyLinksData});
                // 更新 SVG 的宽度
                svg.style("width", sankeyWidth*1.1 + "px");
                // 创建桑基图
                sankeyChart = svg.append('g')
                    .attr('class', 'sankeyChart')
                    .attr('transform', `translate(40, ${(Object.keys(data).length+1.2) * (circleRadius * 2.5 + circleSpacing) + containerHeight*0.05})`); // 控制图例位置

                const sankeyTooltip = d3.select(container)
                    .append("div")
                    .attr("class", "sankeyTooltip")
                // 绘制链接
                sankeyLinks = sankeyChart.append("g")
                    .selectAll('g')
                    .data(sankeyLinksData.filter(d => d.target.name !== 'unknown'))
                    .enter().append('g')
                    .attr('fill', 'none')
                    .attr('stroke-opacity', 0.5)
                    .attr('stroke', d => `url(#line-gradient-${d.index})`)
                    .on('mouseover', function (e, d) {
                        const relatedNodes = [d.source, d.target];
                        const relatedLinks = [d];
                        highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes, false)
                        // 显示tooltip
                        sankeyTooltip.transition()
                            .duration(200)
                            .style("opacity", .9)
                        sankeyTooltip.html(`<p>${d.source.name.replace(/\s\d+$/, '')} -- ${d.target.name.replace(/\s\d+$/, '')} <strong>${d.value}</strong></p>`) // 设置提示框的内容
                            .style("left", (e.pageX)- containerRect.left + container.scrollLeft + "px")
                            .style("top", (e.pageY - containerRect.top + 10) + "px")
                            .style("width", "auto")
                            .style("white-space", "nowrap");
                    })
                    .on('mouseout', function () {
                        resetSankeyChart(sankeyChart, sankeyLinksData, sankeyNodes, sankeyHeads, sankeyTails, sankeyTooltip)
                    })

                // 定义渐变
                const gradient = sankeyLinks.append('defs')
                    .append('linearGradient')
                    .attr('id', (d, i) => `line-gradient-${i}`)
                    .attr('gradientUnits', 'userSpaceOnUse')
                    .attr('x1', d => d.source.x1)
                    .attr('x2', d => d.target.x0);
                gradient.append('stop')
                    .attr('offset', '0%')
                    .attr('stop-color', (d) => colorMap[parseAction(d.source.name.replace(/\s\d+$/, ''))]); // 起始节点颜色
                gradient.append('stop')
                    .attr('offset', '100%')
                    .attr('stop-color', (d) => colorMap[parseAction(d.target.name.replace(/\s\d+$/, ''))]); // 终止节点颜色
                sankeyLinks.append('path')
                    .attr('d', d => d3Sankey.sankeyLinkHorizontal(30,true)(d))
                    .attr('stroke-width', d => Math.max(1, d.width/2));

                // 绘制节点
                // sankeyNodes = sankeyChart.append("g")
                //     .selectAll('circle')
                //     .data(sankeyNodesData.filter(d => d.name !== 'unknown'))
                //     .enter()
                //     .append('circle')
                //     .attr('cx', d => (d.x0 + d.x1) / 2) // 圆心 x 坐标
                //     .attr('cy', d => (d.y0 + d.y1) / 2) // 圆心 y 坐标
                //     .attr('r', d => Math.max((d.x1 - d.x0) / 2,(d.y1 - d.y0) / 2)) // 半径
                //     .attr('fill', d => colorMap[parseAction(d.name.replace(/\s\d+$/, ''))])
                //     .attr('fill-opacity', 1)
                //     .on('mouseover', function (e, d) {
                //         // 获取与当前节点相关的所有连线
                //         const relatedLinks = sankeyLinksData.filter(link => link.source === d || link.target === d);
                //         const relatedNodes = getRelatedNodes(d,sankeyLinksData);
                //         highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes,false)
                //         sankeyTooltip.transition()
                //             .duration(200)
                //             .style("opacity", .9)
                //         sankeyTooltip.html(`<p>${d.name.replace(/\s\d+$/, '')} <strong>${d.value}</strong></p>`) // 设置提示框的内容
                //             .style("left", (e.pageX)- containerRect.left + container.scrollLeft + "px")
                //             .style("top", (e.pageY - containerRect.top + 10) + "px")
                //             .style("width", "auto")
                //             .style("white-space", "nowrap");
                //     })
                //     .on('mouseout', function () {
                //         resetSankeyChart(sankeyChart, sankeyLinksData, sankeyNodes, sankeyHeads, sankeyTails, sankeyTooltip)
                //     })
                // 绘制旭日图节点
                // const partition = d3.partition();
                // 分区图布局
                const partition = (newData) => {
                    return d3.partition().size([2 * Math.PI, newData.height + 1])(newData)
                }

                // 循环遍历 sankeyNodesData
                sankeyNodesData.forEach((nodeData, index) => {
                    const number = Object.keys(nodeData.data).length
                    if(nodeData.name!=="unknown"){
                        // 创建每个节点的旭日图数据
                        const hierarchyData = createSunburstData(nodeData.data, seqView);
                        // 创建颜色比例尺
                        const sunburstColor = d3.scaleOrdinal(d3.schemeSet3);
                        // 计算每个旭日图的圆心位置和半径
                        const centerX = (nodeData.x0 + nodeData.x1) / 2
                        const centerY = (nodeData.y0 + nodeData.y1) / 2
                        const radius = Math.max((nodeData.x1 - nodeData.x0),(nodeData.y1 - nodeData.y0))/2
                        // 绘制旭日图
                        const root = d3.hierarchy(hierarchyData).sum((d) => d.value).sort((a, b) => b.value - a.value)
                        const sunburstData = partition(root)
                        // 添加路径元素
                        // let arc = d3.arc()
                        //     .startAngle(function(d) { return d.x0; })
                        //     .endAngle(function(d) { return d.x1; })
                        //     .innerRadius(function(d) {
                        //         if(d.depth===0){return 0}
                        //         else{return radius/1.6}})
                        //     .outerRadius(function(d) {
                        //         if(d.depth===0){return radius/1.7}
                        //         else{return radius}});
                        let arc
                        if(number!==1){
                            arc = d3.arc()
                                .startAngle(function(d) { return d.x0; })
                                .endAngle(function(d) { return d.x1; })
                                .innerRadius(function(d) {
                                    if(d.depth===0){return 0}
                                    else{return radius/1.6}})
                                .outerRadius(function(d) {
                                    if(d.depth===0){return radius/1.7}
                                    else{return radius}});
                        }
                        else{
                            arc = d3.arc()
                                .startAngle(function(d) { return d.x0; })
                                .endAngle(function(d) { return d.x1; })
                                .innerRadius(function(d) {return 0})
                                .outerRadius(function(d) {return radius});
                        }
                        sankeyNodes = sankeyChart.selectAll(`#sunburst-node-${index}`)
                            .data(sunburstData.descendants(), (d) => d.data.name)
                            .enter()
                            .append('path')
                            .attr('class', `sunburst-node`)
                            .attr('id', `sunburst-node-${index}`)
                            .attr("nodeText", nodeData.name)
                            .attr('transform', `translate(${centerX}, ${centerY})`)
                            .attr('d', arc)
                            .style("fill", function(d) {
                                if(d.depth === 0){return  colorMap[parseAction(nodeData.name.replace(/\s\d+$/, ''))]}
                                else{return sunburstColor(d.data.name);}
                            })

                            .attr('fill-opacity', 1)
                            .on('mouseover', function (e, d) {
                                // 获取与当前节点相关的所有连线
                                const relatedLinks = sankeyLinksData.filter(link => link.source === nodeData || link.target === nodeData);
                                const relatedNodes = getRelatedNodes(nodeData,sankeyLinksData);
                                highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes,false)
                                sankeyTooltip.transition()
                                    .duration(200)
                                    .style("opacity", .9)
                                let tooltipText
                                if(d.data.name===nodeData.name.replace(/\s\d+$/, '')){
                                    tooltipText = `<p>${d.data.name} <strong>${nodeData.value}</strong></p>`
                                }
                                else{
                                    if (typeof d.data.name === 'string' && d.data.name.includes('GMT')) {
                                        d.data.name = formatDateTime(d.data.name);
                                    }
                                    tooltipText = `<p>${d.data.name}</p>`
                                }
                                sankeyTooltip.html(tooltipText) // 设置提示框的内容
                                    .style("left", (e.pageX)- containerRect.left + container.scrollLeft + "px")
                                    .style("top", (e.pageY - containerRect.top + 10) + "px")
                                    .style("width", "auto")
                                    .style("white-space", "nowrap");
                            })
                            .on('mouseout', function () {
                                resetSankeyChart(sankeyChart, sankeyLinksData, sankeyNodes, sankeyHeads, sankeyTails, sankeyTooltip)
                            });
                    }
                });

                const rectWidth = 30
                const rectHeight = 18

                // 绘制head
                sankeyHeads = sankeyChart.append("g")
                    .selectAll('rect')
                    .data(sankeyLinksData.filter(d => d.target.name !== 'unknown'))
                    .enter()
                    .append('rect')
                    .attr('x', d => d.head.x)
                    .attr('y', d => d.head.y)
                    .attr('width', rectWidth)
                    .attr('height', rectHeight)
                    .attr('fill', "grey")
                    .attr('fill-opacity', 1)

                const headText = sankeyChart.append("g")
                    .selectAll('text')
                    .data(sankeyLinksData.filter(d => d.target.name !== 'unknown'))
                    .enter()
                    .append('text')
                    .attr('x', d => d.head.x + rectWidth / 2)
                    .attr('y', d => d.head.y + rectHeight / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', 'white')
                    .style('font-size', '12px')
                    .text(d => d.head.name);

                // 绘制tail
                sankeyTails = sankeyChart.append("g")
                    .selectAll('rect')
                    .data(sankeyLinksData.filter(d => d.target.name !== 'unknown'))
                    .enter()
                    .append('rect')
                    .attr('x', d => d.tail.x)
                    .attr('y', d => d.tail.y)
                    .attr('width', rectWidth)
                    .attr('height', rectHeight)
                    .attr('fill', "grey")
                    .attr('fill-opacity', 1)

                const tailText = sankeyChart.append("g")
                    .selectAll('text')
                    .data(sankeyLinksData.filter(d => d.target.name !== 'unknown'))
                    .enter()
                    .append('text')
                    .attr('x', d => d.tail.x + rectWidth / 2)
                    .attr('y', d => d.tail.y + rectHeight / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', 'white')
                    .style('font-size', '12px')
                    .text(d => d.tail.name);
            })
            .catch(error => {
                console.error(error);
            });

        // 更改筛选出来的序列样式
        function highlightSequences(matchingSequences) {
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            svg.selectAll(".highlighted-username").classed("highlighted-username", false);
            Object.keys(matchingSequences).forEach(username => {
                let name = `username-${username}`;
                svg.select(`[username="${name}"]`)
                    .classed("highlighted-username", true); // 添加高亮类
            });
        }

        // 创建框选区域
        const brush = d3.brush()
            .on("start brush", brushed);
        function brushed(event) {
            if (!event.selection) return;
            const [[x0, y0], [x1, y1]] = event.selection;
            const selectedData = [];
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            svg.selectAll(".event-circle")
                .classed("event-selected", function(d) {
                    const circleName = d3.select(this).attr("circleName")
                    // 使用 split 方法按照 '-' 分割字符串
                    const username = circleName.split('-')[1]
                    const cx = parseFloat(d3.select(this).attr("cx")) + (circleRadius * 2 + circleSpacing) + usernameTextWidth["username"+containerId];
                    const cy = parseFloat(d3.select(this).attr("cy")) + (Object.keys(data).indexOf(username) + 1) * (circleRadius * 2.5 + circleSpacing) -circleRadius*2;
                    const isSelected = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
                     if (isSelected) {
                        selectedData.push(parseAction(d.name.replace(/\s\d+$/, '')));  // 将选中的数据添加到数组中
                    }
                    return isSelected;
                });

            let matchingSequences={}
            if (document.getElementById('query-selection').checked) {
                matchingSequences = findSequencesContainingSubsequence(data, selectedData,seqView,true);
            } else {
                matchingSequences = findSequencesContainingSubsequence(data, selectedData,seqView, false);
            }
            highlightSequences(matchingSequences);
            // 移除旧的点击区域
            svg.selectAll('.clickable-region').remove();
            // 创建一个点击响应区域，是否加入异常序列
            svg.append('rect')
                .attr('class', 'clickable-region')
                .attr('x', x0)
                .attr('y', y0)
                .attr('width', x1 - x0)
                .attr('height', y1 - y0)
                .style('fill', 'none')
                .style('pointer-events', 'all')
                .on('click', () => showConfirmationDialog(selectedData));

        }
        // 监听选中的异常事件
        store.watch(() => store.state.selectedSeq, (newValue, oldValue) => {
            const matchingSequences = findSequencesContainingSubsequence(data, newValue,seqView,true);
            highlightSequences(matchingSequences);
        });

        function showConfirmationDialog(data) {
            if (confirm('是否将选中的序列加入异常序列？')) {
                store.commit('setUnusualSeq', data);
            }
        }
        // 添加框选到 SVG 容器
        svg.append("g")
            .attr("class", "brush")

        startButton.addEventListener('click', function() {
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            svg.select(".brush").call(brush);
        });

        closeButton.addEventListener('click', function() {
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            svg.selectAll('.clickable-region').remove();
            svg.select(".brush").call(brush.move, null);
            svg.select(".brush").selectAll("*").remove(); // 移除 brush 的所有子元素
            svg.select(".brush").on(".brush", null); // 移除事件监听器
            svg.selectAll("circle.event-selected").classed("event-selected", false);
            // 移除先前的高亮效果
            svg.selectAll(".highlighted-username").classed("highlighted-username", false);
        });
        window.addEventListener('resize', updateCircleSizes);
        function updateCircleSizes() {
            // 重新计算半径
            const container = document.getElementById(containerId);
            const circleRadius = Math.min(container.clientWidth, container.clientHeight) * scaleFactor / 2;
            circleSpacing = circleRadius/2
            // 更新所有圆形的半径
            d3.selectAll('circle')
                .attr('r', circleRadius);
        }
    },

    createHierarchy(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // 动态确定布局方向
        const isHorizontalLayout = containerWidth > containerHeight;
        const width = isHorizontalLayout ? containerWidth : containerHeight;
        const height = isHorizontalLayout ? containerHeight : containerWidth;
        const scale=0.05
        const translateWidth = isHorizontalLayout ? scale*containerWidth : 0;
        const translateHeight = isHorizontalLayout ? 0 : scale*containerWidth;
        // 创建D3.js布局
        const treeLayout = isHorizontalLayout ? d3.tree().size([height, width*0.8]) : d3.tree().size([height*0.8, width]);

        // 在容器中创建SVG元素
        const svg = d3.select(container).append("svg")
            .attr("width", width)
            .attr("height", height)
        const g = svg
            .append("g")
            .attr("transform", `translate(${translateWidth},${translateHeight})`);

        const hierarchyData = d3.hierarchy(data);
        const nodesData = treeLayout(hierarchyData);

        // 创建连接线
        const links = g.selectAll(".link")
            .data(nodesData.descendants().slice(1))
            .enter().append("path")
            .attr("class", "link")
            .attr('fill', 'none')
            .attr('stroke', '#ccc')
            .attr("d", d => {
                if (isHorizontalLayout) {
                    return `M${d.y},${d.x}C${(d.y + d.parent.y) / 2},${d.x} ${(d.y + d.parent.y) / 2},${d.parent.x} ${d.parent.y},${d.parent.x}`;

                } else {
                    return `M${d.x},${d.y}C${d.x},${(d.y + d.parent.y) / 2} ${d.x},${(d.y + d.parent.y) / 2} ${d.parent.x},${d.parent.y}`;
                }
            });
        // 创建提示框
        const tooltip = d3.select(`#${containerId}`)
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // 创建节点
        const nodes = g.selectAll(".node")
            .data(nodesData.descendants())
            .enter().append("g")
            .attr("class", d => `node${d.children ? " node--internal" : " node--leaf"}`)
            .attr("transform", d => {
                if (isHorizontalLayout) {
                    return `translate(${d.y},${d.x})`;
                } else {
                    return `translate(${d.x},${d.y})`;
                }
            });

        nodes.append("circle")
            .attr("r",  d => {
                if(d.data.value){return Math.sqrt(d.data.value) * 10}
                else{
                    return 0
                }
            }) // 根据事件出现次数设置节点大小
            .style("fill", d => d.children ? "lightblue" : "#fff")
            .on("mouseover", function (event, d) {
                const containerRect = document.getElementById(containerId).getBoundingClientRect();
                const mouseX = event.clientX - containerRect.left; // 鼠标相对于容器的X坐标
                const mouseY = event.clientY - containerRect.top;  // 鼠标相对于容器的Y坐标

                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                tooltip.html(`Name: ${d.data.name}<br>Value: ${d.data.value}`)
                    .style("position","absolute")
                    .style("left", mouseX + "px")
                    .style("top", mouseY+0.02*containerHeight + "px");
                })
                .on("mouseout", function (d) {
                    // 鼠标移出事件处理
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
        nodes.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d.children ? -6 : 6)
            .style("text-anchor", d => d.children ? "end" : "start")
            .style("fill","#303133")
            .text(d => d.data.name);
        },

    createIcicle(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        const width = container.clientWidth;
        const height = container.clientHeight;

        const root = d3.hierarchy(data).sum(d => d.value);

        d3.partition()
            .size([width, height])
            (root);

        const svg = d3.select(container).append("svg")
            .attr("width", width)
            .attr("height", height)
            .style("font", "10px sans-serif");

        const cell = svg.selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.y0},${d.x0})`);

        cell.append("rect")
            .attr("width", d => d.y1 - d.y0)
            .attr("height", d => d.x1 - d.x0)
            .attr("fill", d => {
                while (d.depth > 1) d = d.parent;
                return d3.scaleOrdinal(d3.schemeCategory10)(d.data.name);
            });

        cell.append("text")
            .attr("x", 4)
            .attr("y", 13)
            .text(d => d.data.name);
    }
};
