import * as d3 from 'd3';
import * as d3Sankey from './d3-sankey/index.js';
import store from '@/store'
import Swal from 'sweetalert2'

import {
    exportTableToCSV,
    changeGlobalHighlight,
    convertToTreeData,
    estimateSankeySize,
    findKeyByValue,
    findSequencesContainingSubsequence,
    formatDateTime,
    generateColorMap,
    generateUserColorMap,
    getKeysByValue,
    parseAction,
    toggleVisibility,
    getRelatedLinks,
    fillData,
    changeGlobalMouseover,
    createNodes,
    createHierarchyData,
    collectNamesByDepth,
    flatten,
    extractInfoBySeqView,
    groupData,
    changeInteractive,
    getRulesForInteractive,
} from './tool.js'
import axios from "axios";

let usernameTextWidth = {}
// 创建颜色比例尺
const sunburstColor = d3.scaleOrdinal(d3.schemePastel1);


export default {
    chooseWhich(operation, containerId, data, visualType){
        const divElement = document.getElementById(containerId);
        if(divElement.firstChild){
            while (divElement.firstChild) {
                divElement.removeChild(divElement.firstChild);
            }
        }

        if (["filter", "original", "difference_set", "intersection_set", 'filterTimeRange'].includes(operation)) {
            this.createTable(containerId, data);
        }
        if(operation === "unique_attr"){
            this.createList(containerId, data);
        }
        if(["count", "unique_count"].includes(operation)){
            if(store.state.curExpression.includes("view_type")){
                if(visualType==="pieChart"){
                    this.createPieChart(containerId, data);
                }
                else if(visualType==="sunBurst"){
                    this.createSunBurst(containerId, data);
                }
                else{
                    this.createBarChart(containerId, data);
                }
            }
        }
        if((operation === "group_by")||(operation === "flatten")){
            const codeContext = store.state.curExpression
            const regex = /group_by\("([^"]+)"\)/g; // 使用全局标志`g`进行全文搜索
            const matches = codeContext.matchAll(regex);
            const parameters = [];
            for (const match of matches) {
                parameters.push(match[1]);
            }
            const [dataKey] = codeContext.split(".");
            const originalData = store.state.originalTableData[dataKey]
            const allKeys = Object.keys(originalData)
            let seqView = allKeys.find(function(element) {
                return (!(parameters.includes(element))&&(!element.includes("时间")));
            });
            if(seqView===undefined){
                seqView = allKeys[0]
            }

            if(store.state.curExpression.includes("view_type")){
                if(visualType==null || visualType==="timeLine"){
                    this.createTimeLine(containerId, data, seqView,allKeys,false);
                }
                else if(visualType==="Sankey"){
                    this.createAggTimeLine(containerId, data, seqView);
                }
                else if(visualType==="hierarchy"){
                    this.createHierarchy(containerId, convertToTreeData(data,seqView));
                }
                else if(visualType==="Heatmap"){
                    this.createHeatmap(containerId, data, seqView);
                }
                else{
                    this.createTimeLine(containerId, data, seqView);
                }
            }
        }
        if(operation === "aggregate"){
            const codeContext = store.state.curExpression
            const match = codeContext.match(/group_by\(\"([^"]+)\"\)/);
            const parameter = match[1];
            const [dataKey] = codeContext.split(".");
            const originalData = store.state.originalTableData[dataKey]
            const allKeys = Object.keys(originalData)
            const seqView = allKeys.find(function(element) {
                return element !== parameter;
            });
            if(store.state.curExpression.includes("view_type")){
                if(visualType==null || visualType==="timeLine"){
                    this.createTimeLine(containerId, data, seqView, allKeys,true);
                }
                // else if(visualType==="Sankey"){
                //     this.createAggTimeLine(containerId, data, seqView);
                // }
                // else if(visualType==="Heatmap"){
                //     this.createHeatmap(containerId, data, seqView);
                // }
                // else{
                //     this.createTimeLine(containerId, data, seqView);
                // }
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

        const container = document.getElementById(containerId);
        createTableHTML(containerId, data);

        function createTableHTML(containerId, data) {
            // 创建包含表格的滚动容器的 HTML
            let tableHtml = '<div class="el-table-wrapper">';
            tableHtml += '<button id="exportButton" class="el-button" style="margin-left: 0">Export Table</button>';

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

            if (container) {
                container.innerHTML = tableHtml;
                // 绑定导出按钮的点击事件
                document.getElementById('exportButton').addEventListener('click', function () {
                    exportTableToCSV(containerId, 'exported_table.csv');
                });
            } else {
                console.error(`Container with ID '${containerId}' not found.`);
            }
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

    createBarChart(containerId, data){
        // 检查数据的有效性
        if (!data || Object.keys(data).length === 0) {
            return;
        }

        // 当容器尺寸变化时的处理函数
        function onResize() {
            // 获取新的容器尺寸
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const chartWidth = 0.88 * containerWidth;
            const chartHeight = 0.85 * containerHeight;
            // 检查尺寸变化是否超过阈值
            if (Math.abs(containerWidth - lastSize.width) > threshold ||
                Math.abs(containerHeight - lastSize.height) > threshold) {

                margin = {
                    top: 0.06 * containerHeight,
                    left: (containerWidth - chartWidth) / 2,
                    right: 0.02 * containerWidth
                };
                xScale.range([0, chartWidth]);
                yScale.range([chartHeight, 0]);

                svg.attr('width', containerWidth)
                    .attr('height', containerHeight)

                svg.style('width', containerWidth + 'px')
                    .style('height', containerHeight + 'px');

                chartGroup.attr('transform', `translate(${margin.left}, ${margin.top})`)
                // 更新坐标轴位置和调用
                chartGroup.select('.x-axis')
                    .attr('transform', `translate(0,${chartHeight})`)
                    .call(d3.axisBottom(xScale));

                chartGroup.select('.y-axis').call(d3.axisLeft(yScale));
                // 更新坐标轴

                outerKeys.forEach((key, i) => {
                    chartGroup.selectAll('.oldBarChart')
                        .attr('x', d => xScale(d) + i * (xScale.bandwidth() / outerKeys.length))
                        .attr('y', d => yScale(data[key][d]))
                        .attr('width', xScale.bandwidth() / outerKeys.length)
                        .attr('height', d => chartHeight - yScale(data[key][d]));
                    chartGroup.selectAll('.newBarChart')
                        .attr('x', d => xScale(d) + i * (xScale.bandwidth() / outerKeys.length))
                        .attr('y', d => yScale(filledData[key][d]))
                        .attr('width', xScale.bandwidth() / outerKeys.length)
                        .attr('height', d => {
                            return chartHeight - yScale(filledData[key][d])});
                    chartGroup.selectAll('.mouseoverBarChart')
                        .attr('x', d => xScale(d) + i * (xScale.bandwidth() / outerKeys.length))
                        .attr('y', d => yScale(mouseoverData[key][d]))
                        .attr('width', xScale.bandwidth() / outerKeys.length)
                        .attr('height', d => chartHeight - yScale(mouseoverData[key][d]));
                });

                // 更新记录的尺寸
                lastSize.width = containerWidth;
                lastSize.height = containerHeight;
            }
        }

        const container = document.getElementById(containerId);
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        let lastSize = { width: container.clientWidth, height: container.clientHeight };
        const threshold = 20; // 阈值
        let filledData
        let mouseoverData

        const containerRect = document.getElementById(containerId).getBoundingClientRect();
        const chartWidth = 0.88 * containerWidth;
        const chartHeight = 0.85 * containerHeight;
        let margin = { top: 0.06 * containerHeight, left: (containerWidth - chartWidth) / 2, right: 0.02 * containerWidth };
        const colorScale = d3.scaleOrdinal(d3.schemeSet3);
        const maxFontSize = 14;
        const minFontSize = 10;
        const fontSizeScale = d3.scaleLinear()
            .domain([0, 2000])
            .range([minFontSize, maxFontSize]);

        const svg = d3.select(container)
            .append('svg')
            .attr('class', 'svgContainer'+containerId)
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .attr('overflow','auto')

        const outerKeys = Object.keys(data);

        const chartGroup = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand()
            .domain(Object.keys(data[outerKeys[0]]))
            .range([0, chartWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(outerKeys, key => d3.max(Object.keys(data[key]), innerKey => data[key][innerKey]))])
            .range([chartHeight, 0]);
        const tooltip = d3.select(container)
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        chartGroup.append('g')
            .attr('transform', `translate(0, ${chartHeight})`)
            .attr('class', 'x-axis')
            .call(xAxis)
            .selectAll('.tick text') // 选择 x 轴上的标签
            .style("cursor","pointer")
            .on('click',(event, d)=>{
                event.stopPropagation();
                changeGlobalHighlight(d, containerId)})
            .on('mouseover',(event, d)=>{
                changeGlobalMouseover(d, containerId)})
            .on('mouseout',(event, d)=>{
                changeGlobalMouseover(d, containerId)});

        chartGroup.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

        chartGroup.selectAll('.x-axis text')
            .style('font-size', function(d) {
                const fontSize = fontSizeScale(containerWidth); // 根据宽度计算字体大小
                return fontSize + 'px';
            });

        chartGroup.selectAll('.y-axis text')
            .style('font-size', function(d) {
                const fontSize = fontSizeScale(containerWidth); // 根据宽度计算字体大小
                return fontSize + 'px';
            });

        outerKeys.forEach((key, i) => {
            chartGroup.selectAll('.oldBarChart')
                .data(Object.keys(data[key]))
                .enter().append('rect')
                .attr('barName', d=>'bar-'+key+d)
                .attr("class",'oldBarChart')
                .attr('containerId',containerId)
                .attr('x', d => xScale(d) + i * (xScale.bandwidth() / outerKeys.length))
                .attr('y', d => yScale(data[key][d]))
                .attr('width', xScale.bandwidth() / outerKeys.length)
                .attr('height', d => chartHeight - yScale(data[key][d]))
                .attr('fill', d=>colorScale(d))
                .style('cursor','pointer')
                .style('pointer-events', 'all')
                .on('mouseover', function(event, d) {
                    d3.select(this).attr('opacity', 0.7);
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.8);
                    let tooltipContent
                    if(key===""){tooltipContent=`${d} : <strong>${data[key][d]}</strong> `}
                    else{
                        tooltipContent=`${d}<br/>${key}: <strong>${data[key][d]}</strong> `
                    }
                    tooltip.html(tooltipContent)
                        .style('left', (event.pageX)-containerRect.left + 'px')
                        .style('top', (event.pageY*0.98)-containerRect.top + 'px');
                })
                .on('mouseout', function() {
                    d3.select(this).attr('opacity', 1);
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                })
                .on("click", function(event, d) {
                    event.stopPropagation();
                    if(key===""){
                        changeGlobalHighlight(d, containerId)}
                    else{
                        changeGlobalHighlight(key, containerId)
                    }
                })
        });

        store.watch(() => store.state.globalHighlight, (newValue) => {
            chartGroup.selectAll('.newBarChart').remove()
            const filteredCodeContext = container.getAttribute("filteredCodeContext");
            let keysInNewData
            if (filteredCodeContext !== null && filteredCodeContext !== "") {
                const code=container.getAttribute("filteredCodeContext")
                const startTime=container.getAttribute("startTime")
                const endTime=container.getAttribute("endTime")
                const [dataKey] = code.split(".");
                const originalData = store.state.originalTableData[dataKey]
                const foundKey = findKeyByValue(originalData, Object.keys(data[outerKeys[0]])[0]);
                axios.post('http://127.0.0.1:5000/executeCode', { code: code, startTime:startTime, endTime:endTime})
                    .then(response => {
                        const newData = response.data['result']
                        keysInNewData =  Object.keys(newData[Object.keys(newData)[0]]);
                        const filterParameters = store.state.filterRules

                        filledData = fillData(data, newData)
                        if(containerId!==store.state.curHighlightContainer){
                            outerKeys.forEach((key, i) => {
                                chartGroup.selectAll('.newBarChart')
                                    .data(Object.keys(filledData[key]))
                                    .enter().append('rect')
                                    .attr("class",'newBarChart')
                                    .attr('barName', d=>'newBar-'+key+'-'+d)
                                    .attr('x', d => xScale(d) + i * (xScale.bandwidth() / outerKeys.length))
                                    .attr('y', d => yScale(filledData[key][d]))
                                    .attr('width', xScale.bandwidth() / outerKeys.length)
                                    .attr('height', d => {
                                        return chartHeight - yScale(filledData[key][d])})
                                    .attr('fill', '#A9A9A9')
                                    .style('cursor','pointer')
                                    .on('mouseover', function(event, d) {
                                        d3.select(this).attr('opacity', 0.7);
                                        tooltip.transition()
                                            .duration(200)
                                            .style('opacity', 0.8);
                                        let tooltipContent
                                        if(key===""){tooltipContent=`${d} : <strong>${filledData[key][d]}</strong> `}
                                        else{
                                            tooltipContent=`${d}<br/>${key}: <strong>${filledData[key][d]}</strong> `
                                        }
                                        tooltip.html(tooltipContent)
                                            .style('left', (event.pageX)-containerRect.left + 'px')
                                            .style('top', (event.pageY*0.98)-containerRect.top + 'px');
                                    })
                                    .on('mouseout', function() {
                                        d3.select(this).attr('opacity', 1);
                                        tooltip.transition()
                                            .duration(500)
                                            .style('opacity', 0);
                                    })
                                    .on("click", function(event, d) {
                                        event.stopPropagation();
                                        if(key===""){
                                            changeGlobalHighlight(d, containerId)}
                                        else{
                                            changeGlobalHighlight(key, containerId)
                                        }
                                    })
                            });
                        }
                        // 高亮x轴
                        if(Object.keys(filterParameters).includes(foundKey)){
                            chartGroup.selectAll('.x-axis text')
                                .style('font-weight', axisText => keysInNewData.includes(axisText) ? 'bold' : 'normal')
                                .style('fill', axisText => keysInNewData.includes(axisText) ? '#F56C6C' : '#606266');
                        }
                        else{
                            chartGroup.selectAll('.x-axis text')
                                .style('font-weight', 'normal')
                                .style('fill', '#606266');
                        }

                    })
                    .catch(error => {
                        console.error(error);
                    });
            }
            else{
                chartGroup.selectAll('.x-axis text')
                    .style('font-weight', axisText => store.state.globalHighlight.includes(axisText) ? 'bold' : 'normal')
                    .style('fill', axisText => store.state.globalHighlight.includes(axisText) ? '#F56C6C' : '#606266');
            }
        }, { deep: true });

        store.watch(() => store.state.globalMouseover, (newValue) => {
            chartGroup.selectAll('.mouseoverBarChart').remove()
            const filteredCodeContext = container.getAttribute("mouseoverCodeContext");
            let keysInNewData
            if (filteredCodeContext !== null && filteredCodeContext !== "") {
                const code=container.getAttribute("mouseoverCodeContext")
                const startTime=container.getAttribute("startTime")
                const endTime=container.getAttribute("endTime")
                const [dataKey] = code.split(".");
                const originalData = store.state.originalTableData[dataKey]
                const foundKey = findKeyByValue(originalData, Object.keys(data[outerKeys[0]])[0]);
                axios.post('http://127.0.0.1:5000/executeCode', { code: code, startTime:startTime, endTime:endTime })
                    .then(response => {
                        const newData = response.data['result']
                        keysInNewData =  Object.keys(newData[Object.keys(newData)[0]]);
                        const filterParameters = store.state.mouseoverRules

                        // 高亮柱状图
                        filledData = fillData(data, newData)
                        if(containerId!==store.state.curMouseoverContainer){
                            outerKeys.forEach((key, i) => {
                                chartGroup.selectAll('.mouseoverBarChart')
                                    .data(Object.keys(filledData[key]))
                                    .enter().append('rect')
                                    .attr("class",'mouseoverBarChart')
                                    .attr('barName', d=>'mouseoverBar-'+key+'-'+d)
                                    .attr('x', d => xScale(d) + i * (xScale.bandwidth() / outerKeys.length))
                                    .attr('y', d => yScale(filledData[key][d]))
                                    .attr('width', xScale.bandwidth() / outerKeys.length)
                                    .attr('height', d => {
                                        return chartHeight - yScale(filledData[key][d])})
                                    .attr('fill', '#eeeeee')
                                    .style('cursor','pointer')
                                    .on('mouseover', function(event, d) {
                                        d3.select(this).attr('opacity', 0.7);
                                        tooltip.transition()
                                            .duration(200)
                                            .style('opacity', 0.8);
                                        let tooltipContent
                                        if(key===""){tooltipContent=`${d} : <strong>${filledData[key][d]}</strong> `}
                                        else{
                                            tooltipContent=`${d}<br/>${key}: <strong>${filledData[key][d]}</strong> `
                                        }
                                        tooltip.html(tooltipContent)
                                            .style('left', (event.pageX)-containerRect.left + 'px')
                                            .style('top', (event.pageY*0.98)-containerRect.top + 'px');
                                    })
                                    .on('mouseout', function() {
                                        d3.select(this).attr('opacity', 1);
                                        tooltip.transition()
                                            .duration(500)
                                            .style('opacity', 0);
                                    });
                            });
                        }
                        // 高亮x轴
                        if(Object.keys(filterParameters).includes(foundKey)){
                            chartGroup.selectAll('.x-axis text')
                                .classed('mouseover-legend', axisText => keysInNewData.includes(axisText));
                        }
                        else{
                            chartGroup.selectAll('.x-axis text')
                                .classed('mouseover-legend', axisText => keysInNewData.includes(axisText));
                        }
                    })
                    .catch(error => {
                        console.error(error);
                    });
            }
            else{
                chartGroup.selectAll('.x-axis text')
                    .classed('mouseover-legend', false)
            }
        }, { deep: true });

        const bbox = chartGroup.node().getBBox();
        svg.style("width",bbox.width+margin.left+margin.right)
        svg.style("height",bbox.height+margin.top)

        // 创建一个新的ResizeObserver实例，并将其绑定到容器上
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                onResize();
            }
        });
        resizeObserver.observe(container);
    },

    createPieChart(containerId, data) {
        const seriesData = [];
        for (const outerKey in data) {
            for (const innerKey in data[outerKey]) {
                seriesData.push({
                    name: innerKey,
                    value: data[outerKey][innerKey]
                });
            }
        }
        const container = document.getElementById(containerId);
        function updatePieChart() {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            const newRadius = Math.min(containerWidth, containerHeight) / 2.5;

            svg.attr('width', containerWidth)
                .attr('height', containerHeight)

            svg.style('width', containerWidth)
                .style('height', containerHeight);

            // 更新饼图容器和图例的位置
            pieContainer.attr('transform', `translate(${containerWidth / 2.4},${containerHeight / 2})`);
            legendContainer.attr('transform', `translate(${containerWidth/2.4},${containerHeight / 2})`);
            legend.attr('transform', (d, i) => `translate(10,${i * 25-newRadius})`);
            // 更新图例的矩形和文本元素
            legend.selectAll('rect')
                .attr('x', newRadius + containerWidth * 0.01)
                .attr('width', containerWidth * 0.015)
                .attr('height', containerHeight * 0.02);

            legend.selectAll('.legend-text')
                .attr('x', newRadius + containerWidth * 0.03)
                .attr('y', (d, i) => containerHeight * 0.01 + i * (containerHeight * 0.02 + 5)); // 假设图例项之间有间隔

            const newArc = d3.arc().outerRadius(newRadius).innerRadius(0);

            svg.selectAll('.arc path')
                .attr('d', newArc);
        }

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerRect = document.getElementById(containerId).getBoundingClientRect();
        const radius = Math.min(containerWidth, containerHeight) / 2.5;

        const svg = d3.select(container).append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight)
            .append('g')
        const pieContainer = svg.append('g')
            .attr('transform', `translate(${containerWidth / 2.4},${containerHeight / 2})`);
        const legendContainer = svg.append('g')
            .attr('transform', `translate(${containerWidth / 2.4},${containerHeight / 2})`);

        const color = d3.scaleOrdinal(d3.schemeSet3);
        const pie = d3.pie().value(d => d.value);
        const arc = d3.arc().outerRadius(radius).innerRadius(0);
        const tooltip = d3.select(container)
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        const arcs = pieContainer.selectAll('arc')
            .data(pie(seriesData))
            .enter()
            .append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => color(i))
            .on('mouseover', function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('filter', 'url(#shadow)');
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.8);

                let tooltipContent

                tooltipContent=`${d.data.name}: <strong>${d.data.value}</strong> `

                tooltip.html(tooltipContent)
                    .style('left', (event.pageX)-containerRect.left + 'px')
                    .style('top', (event.pageY)-containerRect.top + 'px');
            })
            .on('mouseout', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('filter', '');
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);

            })
            .on("click", function(event, d) {
                event.stopPropagation();
                changeGlobalHighlight(d.data.name, containerId)
            });

        svg.append('defs').append('filter')
            .attr('id', 'shadow')
            .append('feDropShadow')
            .attr('dx', 0)
            .attr('dy', 0)
            .attr('stdDeviation', 4)
            .attr('flood-color', '#888888')
            .attr('flood-opacity', 0.7);

        const legend = legendContainer.selectAll('.legend')
            .data(seriesData.map(item => item.name))
            .enter()
            .append('g')
            .attr('class', 'legend')
            .attr('transform', (d, i) => `translate(10,${i * 25-radius})`);
        legend.append('rect')
            .attr('x', radius + containerWidth*0.01)
            .attr('width', containerWidth*0.015)
            .attr('height', containerHeight*0.02)
            .attr('rx', 5)
            .attr('ry', 5)
            .style('fill', (d, i) => color(i));
        legend.append('text')
            .attr('x', radius + containerWidth*0.03)
            .attr('y', containerHeight*0.01)
            .attr('class','legend-text')
            .attr('dy', '.35em')
            .style('text-anchor', 'start')
            .style('fill','#606266')
            .style('cursor', 'pointer')
            .text(d => d)
            .on('mouseover', function(event, d) {
                changeGlobalMouseover(d, containerId)
            })
            .on('mouseout', function(event, d) {
                    changeGlobalMouseover(d, containerId)}
            )
            .on("click", function(event, d) {
                event.stopPropagation();
                changeGlobalHighlight(d, containerId)
            });
        store.watch(() => store.state.globalHighlight, () => {
            svg.selectAll('.legend-text').style('fill', d => store.state.globalHighlight.includes(d) ? '#F56C6C' : '#606266')
                .style('font-weight', d => store.state.globalHighlight.includes(d) ? 'bold' : 'normal')
        },{ deep: true });
        store.watch(() => store.state.globalMouseover, () => {
            svg.selectAll('.legend-text')
                .classed('mouseover-legend', d => store.state.globalMouseover.includes(d));
        },{ deep: true });

        // 创建 ResizeObserver 实例
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                updatePieChart();
            }
        });
        resizeObserver.observe(container);
        // 初始时绘制图表
        updatePieChart();
    },

    createSunBurst(containerId, data) {
        // 获取容器尺寸和位置
        const container = document.getElementById(containerId);
        function updateSunburst() {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            const newRadius = Math.min(containerWidth, containerHeight) / 2.8;

            if (Math.abs(containerWidth - lastSize.width) > threshold ||
                Math.abs(containerHeight - lastSize.height) > threshold) {
                svg.attr('width', containerWidth)
                    .attr('height', containerHeight)

                svg.style('width', containerWidth)
                    .style('height', containerHeight);

                // 更新饼图容器的位置
                sunburstContainer.attr('transform', `translate(${containerWidth / 2.4},${containerHeight / 2})`);
                legendContainer.attr('transform', `translate(${containerWidth / 2.5+newRadius},${0.01*containerHeight})`);
                legendItemHeight = 0.02*containerHeight; // 图例项的高度
                legendItemWidth = 0.015*containerWidth; // 图例项的宽度
                legendContainer.selectAll('rect')
                    .attr('width', legendItemWidth)
                    .attr('height', legendItemHeight)

                const newPartition = d3.partition()
                    .size([2 * Math.PI, newRadius]);

                // 计算节点的弧形布局
                newPartition(root);

                arc.startAngle(d => d.x0)
                    .endAngle(d => d.x1)
                    .innerRadius(d => d.y0)
                    .outerRadius(d => d.y1)
                path.attr('d', arc);
                // 更新记录的尺寸
                lastSize.width = containerWidth;
                lastSize.height = containerHeight;
            }

            const newbbox1 = sunburstContainer.node().getBBox();
            const newbbox2 = legendContainer.node().getBBox();
            const newWidth = newbbox1.width+newbbox2.width+containerWidth/2-radius
            if(newWidth>containerWidth){
                svg.style("width",newWidth)
            }
        }

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerRect = document.getElementById(containerId).getBoundingClientRect();
        let lastSize = { width: container.clientWidth, height: container.clientHeight };
        const threshold = 20; // 阈值
        let radius = Math.min(containerWidth, containerHeight) / 2.8; // 确定旭日图的半径
        // 在 SVG 容器外部创建一个提示框元素
        const tooltip = d3.select(container)
            .append("div")
            .attr("class", "tooltip")
        // 定义配色方案
        const colorSchemes = [
            d3.schemeSet1, // 第0层（实际使用时可能不会为根节点着色）
            d3.schemeSet3,// 第1层
            d3.schemePastel1, // 第2层
            d3.schemePastel2, // 第3层
            d3.schemeAccent// 第4层...
        ];

        // 为每个层级创建一个序数比例尺
        const colorScale = colorSchemes.map(scheme => d3.scaleOrdinal(scheme));

        // 创建SVG元素
        const svg = d3.select(container).append('svg')
            .attr('width', containerWidth)
            .attr('height', containerHeight)

        const sunburstContainer = svg.append('g')
            .attr('transform', `translate(${containerWidth / 2.4},${containerHeight / 2})`);

        const legendContainer= svg.append('g').attr('transform', `translate(${containerWidth / 2.5+radius},${0.01*containerHeight})`);
        // 每层级的图例容器
        let legendItemHeight = 0.02*containerHeight; // 图例项的高度
        let legendItemWidth = 0.015*containerWidth; // 图例项的宽度
        let legendItemMargin = 1.8*legendItemWidth; // 图例项的间距

        const sunburstData = createHierarchyData(data[""])

        const namesByDepth = collectNamesByDepth(sunburstData);

        let currentX = 0
        const depthTextWidth = {}
        namesByDepth.forEach((names, depth) => {
            if (depth === 0) return; // 跳过第0层
            let maxTextWidth = 0; // 存储该层级最宽的文本宽度
            // 预先绘制文本来测量宽度，并找出最宽的一个
            names.forEach(name => {
                const tempText = legendContainer.append('text')
                    .text(name)

                const textWidth = tempText.node().getBBox().width;
                maxTextWidth = Math.max(maxTextWidth, textWidth);
                depthTextWidth[depth] = maxTextWidth
                tempText.remove(); // 移除临时文本
            });
            // 更新当前X位置，为这层的图例留出足够空间
            if (depth > 1) {
                currentX += depthTextWidth[depth-1]; // 在层之间加上间隔
            }
            names.forEach((name, index) => {
                const y = index * 20; // 每个图例项之间的间隔是20px
                // 绘制颜色块
                const legendText = legendContainer.append('rect')
                    .attr('x', 10+depth*legendItemMargin+currentX)
                    .attr('y', y)
                    .attr('width', legendItemWidth)
                    .attr('height', legendItemHeight)
                    .style('fill', colorScale[depth](name)); // 获取name对应的颜色

                // 绘制文本标签
                legendContainer.append('text')
                    .attr('x', 10+1.3*legendItemWidth+depth*legendItemMargin+currentX)
                    .attr('y', y + legendItemHeight/1.1) // 文本位置稍微下移以对齐颜色块
                    .text(name)
                    .style('fill','#606266')
                    .attr('class',"legend-text");
            });
        });

        const bbox1 = sunburstContainer.node().getBBox();
        const bbox2 = legendContainer.node().getBBox();
        const newWidth = bbox1.width+bbox2.width+containerWidth/2-radius
        if(newWidth>containerWidth){
            svg.style("width",newWidth)
        }

        // 创建旭日图布局
        const partition = d3.partition()
            .size([2 * Math.PI, radius]);

        // 处理数据为层级格式
        const root = d3.hierarchy(sunburstData)
            .sum(d => d.value) // 定义如何计算每个节点的值
            .sort((a, b) => b.value - a.value);

        // 计算节点的弧形布局
        partition(root);

        // 弧生成器
        const arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1)

        // 绘制旭日图的每一块
        const path = sunburstContainer.selectAll('path')
            .data(root.descendants())
            .enter().append('path')
            .attr('display', d => d.depth ? null : 'none') // 隐藏根节点
            .attr('d', arc)
            .attr('class','sunBurstArc')
            .style('stroke', '#fff') // 设置分隔线颜色
            .on('mouseover', function (event, d) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.8);

                let tooltipContent
                if(d.data.value){
                    tooltipContent=`${d.data.name}: <strong>${d.data.value}</strong>`
                }
                else{
                    tooltipContent=`${d.data.name}`
                }
                tooltip.html(tooltipContent)
                    .style('left', (event.pageX)-containerRect.left + 'px')
                    .style('top', (event.pageY)-containerRect.top + 'px');
            })
            .on('mouseout', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('filter', '');
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            })
            .style('fill', d => colorScale[d.depth](d.data.name));

        // 创建 ResizeObserver 实例
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                updateSunburst();
            }
        });
        resizeObserver.observe(container);
        // 初始时绘制图表
        updateSunburst();
    },

    createTimeLine(containerId, originData, seqView, allAttributes, isAggregate) {
        const data = flatten(originData)
        let align_data = data
        // 检查数据的有效性
        if (!data || Object.keys(data).length === 0) {
            return;
        }
        let sankeyNodes;
        let sankeyHeads;
        let sankeyTails

        const container = document.getElementById(containerId);
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerRect = document.getElementById(containerId).getBoundingClientRect();

        const userColorMap = generateUserColorMap(data);
        // 创建 SVG 容器
        let margin = { top: 0.01*containerHeight, left: 0.01*containerHeight, right: 0.02*containerWidth };
        // 找到最长的事件序列的长度
        let maxLength = 0;
        let eventCount= 0
        // 计算圆形的半径
        const scaleFactor = 0.025;
        let circleRadius = Math.max(10,Math.min(containerWidth, containerHeight) * scaleFactor / 2);
        let circleSpacing = circleRadius/2

        // 创建下拉框
        const selectBox = document.createElement('select');
        selectBox.id = 'time-selection';
        selectBox.className = 'el-select';
        // 添加下拉选项
        const defaultOption = document.createElement('option');
        defaultOption.innerText = 'Align By'; // 这里设置您想要显示的默认文字
        defaultOption.disabled = true; // 禁止选择这个选项
        defaultOption.selected = true; // 默认选中这个选项
        const option1 = document.createElement('option');
        option1.value = '相对时间';
        option1.innerText = 'relative time';
        const option2 = document.createElement('option');
        option2.value = '绝对时间';
        option2.innerText = 'absolute time';
        const option3 = document.createElement('option');
        option3.value = '局部对齐';
        option3.innerText = 'local alignment';
        const option4 = document.createElement('option');
        option4.value = '全局对齐';
        option4.innerText = 'global alignment';

        // 将选项添加到下拉框中
        selectBox.appendChild(defaultOption);
        selectBox.appendChild(option1);
        selectBox.appendChild(option2);
        selectBox.appendChild(option3);
        selectBox.appendChild(option4);

        // 创建下拉框
        const selectAttribute = document.createElement('select');
        selectAttribute.id = 'attribute-selection';
        selectAttribute.className = 'el-select';
        // 添加下拉选项
        const defaultOption1 = document.createElement('option');
        defaultOption1.innerText = 'Attribute'; // 这里设置您想要显示的默认文字
        defaultOption1.disabled = true; // 禁止选择这个选项
        defaultOption1.selected = true; // 默认选中这个选项
        selectAttribute.appendChild(defaultOption1)
        // 遍历数组，创建并添加选项
        allAttributes.forEach(attribute => {
            const option = document.createElement('option');
            option.value = attribute;
            option.innerText = attribute;
            selectAttribute.appendChild(option);
        });

        // 在容器中添加按钮
        // 聚合下拉框
        const aggButton = document.createElement('button');
        aggButton.innerText = 'Aggregate';
        aggButton.id = 'aggregate';
        aggButton.className = 'el-button';

        // 创建下拉框
        const aggBox = document.createElement('select');
        aggBox.id = 'agg-selection';
        aggBox.className = 'el-select';
        // 添加下拉选项
        const defaultAggOption = document.createElement('option');
        defaultAggOption.innerText = 'Aggregate'; // 这里设置您想要显示的默认文字
        defaultAggOption.disabled = true; // 禁止选择这个选项
        defaultAggOption.selected = true; // 默认选中这个选项
        const aggOption1 = document.createElement('option');
        aggOption1.value = '聚合';
        aggOption1.innerText = 'true';
        const aggOption2 = document.createElement('option');
        aggOption2.value = '不聚合';
        aggOption2.innerText = 'false';

        // 将选项添加到下拉框中
        aggBox.appendChild(defaultAggOption);
        aggBox.appendChild(aggOption1);
        aggBox.appendChild(aggOption2);

        const startButton = document.createElement('button');
        startButton.innerText = 'Create brush';
        startButton.id = 'start-selection';
        startButton.className = 'el-button';
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
        label.appendChild(document.createTextNode('Fuzzy'));
        // 创建包装容器
        const inputContainer = document.createElement('div');
        inputContainer.className = 'input-container';
        // 创建起始时间输入框
        const startTimeInput = document.createElement('input');
        startTimeInput.type = 'number';
        startTimeInput.id = 'start-time-input';
        startTimeInput.className = 'my-input';
        startTimeInput.placeholder = 'min';
        // 创建结束时间输入框
        const endTimeInput = document.createElement('input');
        endTimeInput.type = 'number';
        endTimeInput.id = 'end-time-input';
        endTimeInput.className = 'my-input';
        endTimeInput.placeholder = 'min';
        // 创建表示范围的标签
        const toLabel = document.createElement('span');
        toLabel.innerText = '-';
        toLabel.className = 'range-label';

        // // 创建事件1输入框
        // const Event1Input = document.createElement('input');
        // Event1Input.id = 'event1-input';
        // Event1Input.className = 'my-input';
        // Event1Input.placeholder = 'eventSet1';
        // // 创建事件2输入框
        // const Event2Input = document.createElement('input');
        // Event2Input.id = 'event2-input';
        // Event2Input.className = 'my-input';
        // Event2Input.placeholder = 'eventSet2';


        const set1Button = document.createElement('button');
        set1Button.innerText = 'Get eventSet';
        set1Button.id = 'set1-selection';
        set1Button.className = 'el-button';
        // const set2Button = document.createElement('button');
        // set2Button.innerText = 'Get eventSet2';
        // set2Button.id = 'set2-selection';
        // set2Button.className = 'el-button';

        const checkButton = document.createElement('button');
        checkButton.innerText = 'Check';
        checkButton.id = 'check';
        checkButton.className = 'el-button';
        const resetButton = document.createElement('button');
        resetButton.innerText = 'Reset';
        resetButton.id = 'reset';
        resetButton.className = 'el-button';
        // 创建选择框
        const filterCheckbox = document.getElementById('checkbox-container') || document.createElement('div');
        filterCheckbox.id = 'checkbox-container';

        // 创建新的包装容器
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'controls-container';
        // 将元素添加到新的包装容器中
        controlsContainer.appendChild(selectBox);
        controlsContainer.appendChild(selectAttribute);
        controlsContainer.appendChild(aggBox);
        controlsContainer.appendChild(label);
        controlsContainer.appendChild(startButton);
        controlsContainer.appendChild(inputContainer);
        inputContainer.appendChild(startTimeInput);
        inputContainer.appendChild(toLabel);
        inputContainer.appendChild(endTimeInput);
        // inputContainer.appendChild(Event1Input);
        // inputContainer.appendChild(Event2Input);
        inputContainer.appendChild(set1Button);
        // inputContainer.appendChild(set2Button);
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
        let eventSet1=[],eventSet2=[]
        checkButton.addEventListener('click', function() {
            const startTime = parseInt(startTimeInput.value, 10);
            const endTime = parseInt(endTimeInput.value, 10);
            // 调用函数来筛选事件
            axios.post('http://127.0.0.1:5000/event_pairs', { data: data, startTime:startTime, endTime:endTime,eventSet1:eventSet1,eventSet2:eventSet2,seqView:seqView})
                .then(response => {
                    const filteredEvents = response.data["filteredEvents"]
                    displayFilteredEvents(filteredEvents);
                })
                .catch(error => {
                    console.error(error);
                });
        });

        function displayFilteredEvents(filteredEvents) {
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            // 首先移除所有旧的线条
            svg.selectAll('.event-pairs').remove();
            // 先将所有事件圆形颜色设置为灰色
            svg.selectAll('.event-circle').style('fill', '#eeeeee');
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
                        .attr('stroke', 'grey')
                        .attr('fill', 'none');
                });
            });
            // 将属于eventPair的事件圆形颜色设置回原色
            svg.selectAll('.paired-event').style('fill', (d) => colorMap[parseAction(d.data.name.split("*")[0])]);
        }
        // 重置按钮
        resetButton.addEventListener('click', function() {
            // Event1Input.value = ""
            // Event2Input.value = ""
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            // 移除所有连接线
            svg.selectAll('.event-pairs').remove();
            // 将所有事件圆形的颜色还原到原始状态
            svg.selectAll('.event-circle')
                .style('fill', d => colorMap[parseAction(d.data.name.split("*")[0])])
                .classed('paired-event', false); // 如果使用了特定类名进行高亮显示，移除该类名
        });

        //获取事件坐标
        function getCircleCoordinates(username, index) {
            // 构造对应的选择器
            const selector = `.event-circle[circleName="circle-${username}"]`;
            const circles = d3.selectAll(selector);
            const selectedCircle = circles.filter((d, i) => i === index);
            // 获取圆心坐标
            const xPos = parseFloat(selectedCircle.attr('cx'))+ (circleRadius * 2 + circleSpacing) + usernameTextWidth["username"+containerId];
            const yPos = parseFloat(selectedCircle.attr('cy'));
            return { x: xPos, y: yPos };
        }

        Object.values(data).forEach(user => {
            eventCount = user[seqView].length
            if (eventCount > maxLength) {
                maxLength = eventCount;
            }
        })

        createChart(seqView)
        // 为下拉框添加事件监听器，监听 change 事件
        selectAttribute.addEventListener('change', function() {
            // 获取当前选中的值
            createChart(this.value)
            selectBox.selectedIndex = 0;
            aggBox.selectedIndex = 0;
        });
        function createChart(seqView){
            const allUserData = []
            Object.keys(data).forEach((username, index) => {
                allUserData.push(data[username][seqView])
            })

            const colorMap = generateColorMap(data,seqView);
            // 选择要移除的 SVG 元素
            const svgToRemove = d3.select(container).select('.svgContainer'+containerId);
            // 移除 SVG 元素及其上的所有内容
            svgToRemove.remove();

            // 计算 SVG 的宽度
            let svgWidth = margin.left + (maxLength+3) * (circleRadius * 2 + circleSpacing) + margin.right;
            if (svgWidth < containerWidth){
                svgWidth = containerWidth
            }

            let svgHeight = (Object.keys(data).length+1) * (circleRadius * 2.5 + circleSpacing)+circleRadius * 2.5

            const svg = d3.select(container)
                .append('svg')
                .attr('class', 'svgContainer'+containerId)
                .attr('width', svgWidth)
                .attr('height', svgHeight)
                .attr('overflow','auto')
                .attr('transform', `translate(${margin.left},${margin.top})`)

            const seqContainer = svg.append('g')

            createLegend(data)

            function createLegend(data){
                // 创建图例
                const legend = seqContainer.append('g')
                    .attr('class', 'legend')
                    .attr('transform', `translate(15, ${(Object.keys(data).length+1) * (circleRadius * 2.5 + circleSpacing)})`); // 控制图例位置

                // 添加图例矩形和文字
                const legendItems = Object.keys(colorMap);

                let totalLegendWidth = 0; // 用于存储总宽度
                let legendY = 0;

                legendItems.forEach((item, index) => {
                    const rectSize = circleRadius*2;
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
                        .attr('x', legendX+rectSize*1.2+legendTextWidth/2).attr('y', legendY+ rectSize*0.6)
                        .attr('text-anchor', 'middle').attr('alignment-baseline', 'middle')
                        .attr('class', 'sankeyLegendText')
                        .attr('text',item)
                        .style('fill', colorMap[item]) // 根据操作类型选择颜色
                        .style('font-weight', 'bold')
                        .style('cursor', 'pointer') // 设置鼠标悬浮时显示手指样式
                        .on('click', function() {
                            event.stopPropagation();
                            changeGlobalHighlight(item, containerId)
                        })
                        .on('mouseover', function() {
                            changeGlobalMouseover(item, containerId)
                        })
                        .on('mouseout', function() {
                            changeGlobalMouseover(item, containerId)
                        });

                    // 添加图例矩形
                    legend.append('rect')
                        .attr('x', legendX)
                        .attr('y', legendY)
                        .attr('width', rectSize)
                        .attr('height', rectSize)
                        .style('fill', colorMap[item]);
                });
            }

            // 监听选中的需要高亮的路径信息
            store.watch(() => store.state.globalHighlight, (newValue) => {
                // 点击图例变色
                const highlightColor = "#C0C0C0";
                const highlightCircle = "#eeeeee"; // 高亮颜色，比如灰色
                const code=container.getAttribute("codeContext")
                const filterParameters = store.state.filterRules
                const [dataKey] = code.split(".");
                const originalData = store.state.originalTableData[dataKey]
                const foundKey = findKeyByValue(originalData, Object.keys(data)[0]);
                const foundDataKey = findKeyByValue(originalData, data[Object.keys(data)[0]][seqView][0]);

                // 当筛选规则里面包含现有的键的时候才需要高亮分组条件
                if(Object.keys(filterParameters).includes(foundKey)){
                    // 获取所有键 对于筛选得到的键，需要对他进行高亮
                    const keys = filterParameters[foundKey]
                    svg.selectAll(".selected-username").classed("selected-username", false);
                    keys.forEach(username => {
                        const name = `username-${username}`;
                        svg.select(`[username="${name}"]`)
                            .classed("selected-username", true); // 添加高亮类
                    });
                }
                else{
                    svg.selectAll(".selected-username").classed("selected-username", false);
                }
                //高亮数据项
                if(Object.keys(filterParameters).includes(foundDataKey)){
                    console.log("这里")
                    const keys = filterParameters[foundDataKey]
                    const circles = svg.selectAll('.event-circle');
                    circles.style('fill', d => keys.includes(parseAction(d.data.name.split("*")[0])) ? colorMap[parseAction(d.data.name.split("*")[0])] : highlightCircle)
                    svg.selectAll(".sankeyLegendText")
                        .style('fill', function() {
                            const textContent = d3.select(this).text(); // 获取当前元素的文本内容
                            return keys.includes(parseAction(textContent)) ? colorMap[textContent]: highlightColor
                        });
                }
                else{
                    console.log("哈哈")
                    svg.selectAll('.event-circle').style('fill', d=>colorMap[parseAction(d.data.name.split("*")[0])]);
                    svg.selectAll('.event-circle').style("fill", function(d) {
                        return colorMap[d.data.name.split("*")[0]] ? colorMap[d.data.name.split("*")[0]] : highlightColor
                    })
                    // 选择所有具有'sankeyLegendText'类的元素
                    svg.selectAll('.sankeyLegendText')
                        .each(function() {
                            const legendText = d3.select(this);
                            const textContent = legendText.text();
                            const fillColor = colorMap[textContent];
                            legendText.style('fill', fillColor);
                        });

                }
            }, { deep: true });

            // 监听选中的需要高亮的路径信息
            store.watch(() => store.state.globalMouseover, (newValue) => {
                const code=container.getAttribute("codeContext")
                const filterParameters = store.state.mouseoverRules
                const [dataKey] = code.split(".");
                const originalData = store.state.originalTableData[dataKey]
                const foundKey = findKeyByValue(originalData, Object.keys(data)[0]);
                const foundDataKey = findKeyByValue(originalData, data[Object.keys(data)[0]][seqView][0]);

                // 当筛选规则里面包含现有的键的时候才需要高亮分组条件
                if(Object.keys(filterParameters).includes(foundKey)){
                    // 获取所有键 对于筛选得到的键，需要对他进行高亮
                    const keys = filterParameters[foundKey]
                    svg.selectAll(".mouseover-username").classed("mouseover-username", false);
                    keys.forEach(username => {
                        const name = `username-${username}`;
                        svg.select(`[username="${name}"]`)
                            .classed("mouseover-username", true); // 添加高亮类
                    });
                }
                else{
                    svg.selectAll(".mouseover-username").classed("mouseover-username", false);
                }
                //高亮数据项
                if(Object.keys(filterParameters).includes(foundDataKey)){
                    const keys = filterParameters[foundDataKey]
                    const circles = svg.selectAll('.event-circle');
                    svg.selectAll(".mouseover-circle").classed("mouseover-circle", false);
                    svg.selectAll(".mouseover-legend").classed("mouseover-legend", false);
                    circles
                        .each(function(d) {
                            if (keys.includes(parseAction(d.data.name.split("*")[0]))) {
                                d3.select(this).classed('mouseover-circle', true); // 添加类名到满足条件的圆圈上
                            }
                        });

                    svg.selectAll(".sankeyLegendText")
                        .each(function() {
                            const legendText = d3.select(this);
                            const textContent = legendText.text(); // 获取当前元素的文本内容
                            if(keys.includes(parseAction(textContent))){
                                legendText.classed('mouseover-legend', true); // 根据条件添加或移除类名
                            }
                        });
                }
                else{
                    svg.selectAll(".mouseover-circle").classed("mouseover-circle", false);
                    svg.selectAll(".mouseover-legend").classed("mouseover-legend", false);
                }
            }, { deep: true });

            const userLocation ={}
            const aggUserLocation = {}
            // 桑基图数据
            // if(isAggregate)
            // {
            //
            // }
            // else{
            //
            // }
            withoutAgg()
            function withoutAgg(){
                // 遍历数据，创建事件符号
                Object.keys(data).forEach((username, index) => {
                    const yPos = (index+1) * (circleRadius * 2.5 + circleSpacing); // 控制圆形的垂直位置
                    // 用于估算宽度的用户名
                    const usernameTextforWidth = seqContainer.append('text')
                        .attr('x', 10) // 控制用户名的水平位置
                        .attr('y', yPos+circleRadius/2)
                        .text(username)
                        .style('fill', 'transparent');
                    // 定义颜色映射比例尺
                    const colorScale = d3.scaleSequential(d3.interpolate('#00FF00', '#FF0000')) // 从绿色插值到红色
                        .domain([0, maxLength]); // 设定域为 [0, maxLength]
                    // 添加矩形框
                    const usernameRect = seqContainer.append('rect')
                        // .attr('x', 10-usernameTextforWidth.node().getBBox().width*0.1) // 控制矩形框的水平位置，与用户名文本的位置一致
                        .attr('x', 12-usernameTextforWidth.node().getBBox().width*0.1) // 控制矩形框的水平位置，与用户名文本的位置一致
                        .attr('y', yPos-circleRadius-1)
                        .attr('width', usernameTextforWidth.node().getBBox().width*1.2)
                        .attr('height',  Math.max(20,usernameTextforWidth.node().getBBox().height))
                        // .style('fill',  userColorMap[username])
                        .style('fill',  "none")
                        .style('opacity', 1)
                        .style('cursor', 'pointer')

                    const usernameText = seqContainer.append('text')
                        .attr('x', 10) // 控制用户名的水平位置
                        .attr('y', yPos+circleRadius/2)
                        .text(username.replace(/&/g, " "))
                        .attr("username", `username-${username}`)
                        .style('fill','#808080')
                        .style('font-weight', 'bold')
                        .style('cursor','pointer')
                        .on('click', function () {
                            event.stopPropagation(); // 阻止事件传播
                            const selectedUsername = d3.select(this).text();
                            changeGlobalHighlight(selectedUsername, containerId)
                        })
                        .on('mouseover', function () {
                            const selectedUsername = d3.select(this).text();
                            changeGlobalMouseover(selectedUsername,containerId)
                        })
                        .on('mouseout', function () {
                            const selectedUsername = d3.select(this).text();
                            changeGlobalMouseover(selectedUsername,containerId)
                        });
                    // 获取用户名文本的宽度
                    usernameTextWidth["username"+containerId] = usernameText.node().getBBox().width;
                    userLocation[username]= yPos
                });
                getSankeyData('http://127.0.0.1:5000/get_timeline_data',data,false)
            }
            // 聚合下拉框
            aggBox.addEventListener('change', function() {
                seqContainer.selectAll("*").remove();
                if(this.value==="聚合"){
                    selectBox.disabled = true;
                    createLegend(originData)
                    Object.keys(originData).forEach((username, index) => {
                        const yPos = (index+1) * (circleRadius * 2.5 + circleSpacing);
                        const usernameText = seqContainer.append('text')
                            .attr('x', 10) // 控制用户名的水平位置
                            .attr('y', yPos+circleRadius/2)
                            .text(username)
                            .style('fill','#808080')
                            .style('font-weight', 'bold');
                        // 获取用户名文本的宽度
                        usernameTextWidth["username"+containerId] = usernameText.node().getBBox().width;
                        aggUserLocation[username]= yPos
                    });

                    const dataToAgg = extractInfoBySeqView(align_data, seqView);
                    const hierachyData = groupData(dataToAgg)

                    getSankeyData('http://127.0.0.1:5000/get_agg_timeline_data',hierachyData,true)
                }
                else{
                    selectBox.disabled = false;
                    createLegend(data)
                    withoutAgg()
                }
            });

            function getSankeyData(url,data,isAgg){
                // 选择tooltip并移除
                d3.select(container)
                    .select(".tooltip")
                    .remove();

                axios.post(url, { data: data, seqView: seqView })
                    .then(response => {
                        const nodes = response.data["nodes"]
                        const links = response.data["links"]

                        // 构建节点映射，方便后续查找
                        const nodeMap = new Map(nodes.map(node => [node.name, node]));
                        // 填充 links 数组中的 source 和 target 属性
                        links.forEach(link => {
                            link.source = nodeMap.get(link.source.name);
                            link.target = nodeMap.get(link.target.name);
                        });

                        // 在 SVG 容器外部创建一个提示框元素
                        const tooltip = d3.select(container)
                            .append("div")
                            .attr("class", "tooltip")

                        // 为下拉框添加事件监听器，监听 change 事件
                        selectBox.addEventListener('change', function() {
                            // 获取当前选中的值
                            drawSankey(this.value)
                            aggBox.selectedIndex = 0;
                        });
                        const existingChart = seqContainer.select('.sankeyChart');
                        // 检查是否存在
                        if (!existingChart.empty()) {
                            existingChart.remove();
                        }
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                        // 创建桑基图
                        const eventChart = seqContainer.append('g')
                            .attr('class', 'sankeyChart')
                            .attr('transform', `translate(${usernameTextWidth["username"+containerId]+(circleRadius * 2 + circleSpacing)}, ${0})`); // 控制图例位置

                        if(selectBox.value ==="Align By"){ drawSankey("相对时间")}
                        else{
                            drawSankey(selectBox.value)
                        }

                        function drawSankey(alignment){
                            // 清除eventChart中的全部元素
                            eventChart.selectAll("*").remove();
                            let sankeyWidth
                            if(isAgg&&selectBox.value==="全局对齐"){
                                sankeyWidth=(maxLength+10) * (circleRadius*2 + circleSpacing)-usernameTextWidth["username"+containerId]
                            }
                            else{sankeyWidth=(maxLength+3) * (circleRadius*2 + circleSpacing)-usernameTextWidth["username"+containerId]}

                            d3Sankey.sankey()
                                .nodeAlign(d3Sankey.sankeyLeft)
                                .nodeWidth(circleRadius*2)
                                .size([sankeyWidth, (circleRadius * 2.5 + circleSpacing)* Object.keys(data).length])
                                ({nodes:nodes, links:links});

                            // 使用对象来分组具有相同name.split("*")[1]的数据
                            const groupedData = nodes.reduce((acc, item) => {
                                const splitResult = item.name.split("*")
                                const key = splitResult[splitResult.length-1];
                                if (!acc[key]) {
                                    acc[key] = [];
                                }
                                acc[key].push(item);
                                return acc;
                            }, {});

                            const sequences = Object.keys(groupedData).map(key => {
                                return groupedData[key].map(item => item.name.split("*")[0]);
                            });

                            if(alignment==="全局对齐"){
                                if(!isAgg){
                                    axios.post('http://127.0.0.1:5000/global_align', { data: sequences })
                                        .then(response => {
                                            const location = response.data["location"]
                                            const align_result = response.data["align_result"]
                                            let outerKeys = Object.keys(data);
                                            align_data = outerKeys.reduce((acc, key, index) => {
                                                acc[key] = align_result[index];
                                                return acc;
                                            }, {});

                                            createNodes(false,containerId,container,containerRect,eventChart,nodes,links,sankeyNodes,sankeyHeads,sankeyTails,tooltip,seqView,colorMap,sunburstColor,2," ",data,alignment,userLocation,location)

                                            const newLength = response.data["length"]
                                            let svgWidth
                                            if(isAgg){
                                                svgWidth = margin.left + (newLength+10) * (circleRadius * 2 + circleSpacing) + margin.right;
                                            }
                                            else{
                                                svgWidth = margin.left + (newLength+3) * (circleRadius * 2 + circleSpacing) + margin.right;
                                            }
                                            if (svgWidth < containerWidth){
                                                svgWidth = containerWidth
                                            }
                                            d3.select('.svgContainer' + containerId).attr('width', svgWidth)
                                        })
                                        .catch(error => {
                                            console.error(error);
                                        });
                                }
                            }

                            if(alignment==="局部对齐"){
                                if(!isAgg){
                                    axios.post('http://127.0.0.1:5000/local_align', { data: sequences })
                                        .then(response => {
                                            const location = response.data["location"]
                                            let userMove ={}
                                            Object.keys(data).forEach((username, index) => {
                                                userMove[username]= location[index]
                                            });

                                            createNodes(false,containerId,container,containerRect,eventChart,nodes,links,sankeyNodes,sankeyHeads,sankeyTails,tooltip,seqView,colorMap,sunburstColor,2," ",data,alignment,userLocation,userMove)

                                            const newLength = response.data["length"]
                                            let svgWidth = margin.left + (newLength+maxLength) * (circleRadius * 2 + circleSpacing) + margin.right;
                                            if (svgWidth < containerWidth){
                                                svgWidth = containerWidth
                                            }
                                            d3.select('.svgContainer' + containerId).attr('width', svgWidth)
                                        })
                                        .catch(error => {
                                            console.error(error);
                                        });
                                }
                            }

                            else{
                                let svgWidth = margin.left + (maxLength+3) * (circleRadius * 2 + circleSpacing) + margin.right;
                                if (svgWidth < containerWidth){
                                    svgWidth = containerWidth
                                }
                                d3.select('.svgContainer' + containerId).attr('width', svgWidth)
                                if(!isAgg){
                                    createNodes(isAgg,containerId,container,containerRect,eventChart,nodes,links,sankeyNodes,sankeyHeads,sankeyTails,tooltip,seqView,colorMap,sunburstColor,2," ",data,alignment,userLocation)
                                }
                                else{
                                    createNodes(isAgg,containerId,container,containerRect,eventChart,nodes,links,sankeyNodes,sankeyHeads,sankeyTails,tooltip,seqView,colorMap,sunburstColor,2," ",data,alignment,aggUserLocation)
                                }
                            }
                        }
                    })
                    .catch(error => {
                        console.error(error);
                    });
            }

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
                .on("start brush", (event) => brushed(event,"brush"));

            // 创建事件集合选择区域
            const set1Brush = d3.brush()
                .on("start brush", (event) => brushed(event, "set1Brush"));

            // const set2Brush = d3.brush()
            //     .on("start brush", (event) => brushed(event, "set2Brush"));

            function brushed(event,chooseBrush) {
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
                        const cy = parseFloat(d3.select(this).attr("cy"));
                        const isSelected = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
                         if (isSelected) {
                            selectedData.push(parseAction(d.data.name.split("*")[0]));  // 将选中的数据添加到数组中
                        }
                        return isSelected;
                    });
                if(chooseBrush==="brush"){
                    findSeq(x0,y0,x1,y1,selectedData)
                }
                else if(chooseBrush==="set1Brush"){
                    createSet1(x0,y0,x1,y1,selectedData)
                }
                // else if(chooseBrush==="set2Brush"){
                //     createSet2(x0,y0,x1,y1,selectedData)
                // }
            }

            function findSeq(x0,y0,x1,y1,selectedData) {
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
                    .on('click', () => showConfirmationDialog(selectedData))
                    .on('contextmenu', function(event){
                        event.preventDefault();
                        svg.selectAll('.clickable-region').remove();
                        svg.select(".brush").call(brush.move, null);
                        svg.select(".brush").selectAll("*").remove(); // 移除 brush 的所有子元素
                        svg.select(".brush").on(".brush", null); // 移除事件监听器
                        svg.selectAll(".event-selected").classed("event-selected", false);
                        // 移除先前的高亮效果
                        svg.selectAll(".highlighted-username").classed("highlighted-username", false);
                    });
            }

            function createSet1(x0,y0,x1,y1,selectedData) {
                // 移除旧的点击区域
                svg.selectAll('.clickable-region').remove();
                // 创建一个点击响应区域，是否加入异常序列
                svg.append('rect')
                    .attr('class', 'set1-region')
                    .attr('x', x0)
                    .attr('y', y0)
                    .attr('width', x1 - x0)
                    .attr('height', y1 - y0)
                    .style('fill', 'none')
                    .style('pointer-events', 'all')
                    .on('click', () => {
                        Swal.fire({
                            title: 'Confirm',
                            text: "Add to event set?",
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#3085d6',
                            cancelButtonColor: '#d4605e',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'No'
                        }).then((result) => {
                            if (result.isConfirmed) {
                                // Event1Input.value=selectedData;
                                eventSet1 = selectedData
                                const myDiv = document.getElementById(containerId)
                                const nodeId =myDiv.getAttribute("nodeId");
                                const rulesForInteractive = getRulesForInteractive(selectedData,containerId)
                                const value={"expression":rulesForInteractive,"data":selectedData}
                                changeInteractive(nodeId,value)
                            }
                        })
                    })
                    .on('contextmenu',function(event){
                        event.preventDefault();
                        svg.selectAll('.set1-region').remove();
                        svg.select(".set1Brush").call(set1Brush.move, null);
                        svg.select(".set1Brush").selectAll("*").remove();
                        svg.select(".set1Brush").on(".set1Brush", null);
                        svg.selectAll(".event-selected").classed("event-selected", false);
                    });
            }

            // function createSet2(x0,y0,x1,y1,selectedData) {
            //     // 移除旧的点击区域
            //     svg.selectAll('.set2-region').remove();
            //     // 创建一个点击响应区域，是否加入异常序列
            //     svg.append('rect')
            //         .attr('class', 'set2-region')
            //         .attr('x', x0)
            //         .attr('y', y0)
            //         .attr('width', x1 - x0)
            //         .attr('height', y1 - y0)
            //         .style('fill', 'none')
            //         .style('pointer-events', 'all')
            //         .on('click', () => {
            //             Swal.fire({
            //                 title: '确认操作',
            //                 text: "是否将选中的序列加入eventSet2？",
            //                 icon: 'warning',
            //                 showCancelButton: true,
            //                 confirmButtonColor: '#3085d6',
            //                 cancelButtonColor: '#d4605e',
            //                 confirmButtonText: '是',
            //                 cancelButtonText: '否'
            //             }).then((result) => {
            //                 if (result.isConfirmed) {
            //                     // Event2Input.value=selectedData;
            //                     eventSet2 = selectedData
            //                 }
            //             })
            //         })
            //         .on('contextmenu',function(event){
            //             event.preventDefault();
            //             svg.selectAll('.set2-region').remove();
            //             svg.select(".set2Brush").call(set2Brush.move, null);
            //             svg.select(".set2Brush").selectAll("*").remove();
            //             svg.select(".set2Brush").on(".set2Brush", null);
            //             svg.selectAll(".event-selected").classed("event-selected", false);
            //         });
            // }

            // 监听选中的异常事件
            store.watch(() => store.state.selectedSeq, (newValue, oldValue) => {
                const matchingSequences = findSequencesContainingSubsequence(data, newValue,seqView,true);
                highlightSequences(matchingSequences);
            });

            function showConfirmationDialog(data) {
                Swal.fire({
                    title: '确认操作',
                    text: "是否将选中的序列加入异常序列？",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d4605e',
                    confirmButtonText: '是',
                    cancelButtonText: '否'
                }).then((result) => {
                    if (result.isConfirmed) {
                        store.commit('setUnusualSeq', data);
                        Swal.fire(
                            '已添加!',
                            '选中的序列已加入异常序列。',
                            'success'
                        )
                    }
                })
            }

            // 添加框选到 SVG 容器
            svg.append("g")
                .attr("class", "brush")
            svg.append("g")
                .attr("class", "set1Brush")
            // svg.append("g")
            //     .attr("class", "set2Brush")

            startButton.addEventListener('click', function() {
                svg.select(".brush").call(brush);
            });

            set1Button.addEventListener('click', function() {
                svg.select(".set1Brush").call(set1Brush);
            });

            // set2Button.addEventListener('click', function() {
            //     svg.select(".set2Brush").call(set2Brush);
            // });
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

    createAggTimeLine(containerId, data, seqView) {
        let sankeyNodesData=[]
        let sankeyLinksData=[]
        let sankeyLinks;
        let sankeyNodes;
        let sankeyHeads;
        let sankeyTails
        let aggSankeyChart
        // 检查数据的有效性
        if (!data || Object.keys(data).length === 0) {
            return;
        }
        const container = document.getElementById(containerId);
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerRect = document.getElementById(containerId).getBoundingClientRect();

        const colorMap = generateColorMap(data,seqView);
        const userColorMap = generateUserColorMap(data);

        // 创建 SVG 容器
        let margin = { top: 0.05*containerHeight, left: 0.04*containerWidth, right: 0.02*containerWidth };
        // 找到最长的事件序列的长度
        let maxLength = 0;
        let eventCount= 0
        // 计算圆形的半径
        const scaleFactor = 0.025;
        let circleRadius =  Math.max(10,Math.min(containerWidth, containerHeight) * scaleFactor / 2);
        let circleSpacing = circleRadius/2

        Object.values(data).forEach(user => {
            eventCount = user[seqView].length
            if (eventCount > maxLength) {
                maxLength = eventCount;
            }
        })

        // 计算 SVG 的宽度
        let svgWidth = margin.left + (maxLength+2) * (circleRadius * 2 + circleSpacing) + margin.right;
        if (svgWidth < containerWidth){
            svgWidth = containerWidth
        }
        const svg = d3.select(container)
            .append('svg')
            .attr('class', 'svgContainer'+containerId)
            .attr('width', svgWidth)
            .attr('height', '100%')
            .attr('overflow','auto')

        // 桑基图高亮样式
        function highlightSankeyChart(relatedLinks, relatedNodes) {
            relatedNodes = relatedNodes.map(item => item.name);
            sankeyLinks.attr('stroke-opacity', link => (relatedLinks.includes(link) ? 0.8 : 0.1));
            sankeyLinks.attr('stroke', link => (relatedLinks.includes(link) ? `url(#line-gradient-${link.index})` : '#C0C0C0'));
            sankeyHeads.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
            sankeyTails.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
            // 设置不在 namesArray 中的节点的颜色
            aggSankeyChart.selectAll('.sunburst-node')
                .filter(function () {
                    return !relatedNodes.includes(d3.select(this).attr('nodeText'));
                })
                .style("fill", '#DCDCDC')
        }
        function resetSankeyChart() {
            aggSankeyChart.selectAll(`.sunburst-node`).attr('fill-opacity', 1);
            aggSankeyChart.selectAll(`.sunburst-node`).style("fill", function(d) {
                if(d.depth === 0){return  colorMap[parseAction(d3.select(this).attr('nodeText').split("*")[0])]}
                else{return sunburstColor(d.data.name);}
            })
            sankeyLinks.attr('stroke-opacity', 0.5);
            sankeyLinks.attr('stroke', link => (`url(#line-gradient-${link.index})`));
            sankeyHeads.attr('fill-opacity', 1);
            sankeyTails.attr('fill-opacity', 1);
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

                let rectWidth = 30
                let rectHeight = 18
                let hasHead = true
                if(sankeyLinksData&&sankeyLinksData[0].head.name ===""){
                    rectWidth = 0
                    hasHead=false
                }
                const  sankeyWidth  = estimateSankeySize(sankeyNodesData,180);
                const sankeyHeight = Object.keys(data).length*35

                const sankey = d3Sankey.sankey()
                    .nodePadding(25)
                    .nodeAlign(d3Sankey.sankeyLeft)
                    .iterations(8)
                    .size([sankeyWidth*0.9, sankeyHeight])
                    ({nodes:sankeyNodesData, links:sankeyLinksData});

                // 更新 SVG 的宽度
                svg.style("width", sankeyWidth+margin.left + "px");
                svg.style("height", sankeyHeight+margin.top*5+circleRadius*2 + "px");
                // 创建桑基图
                aggSankeyChart = svg.append('g')
                    .attr('class', 'aggSankeyChart')
                    .attr('transform', `translate(${margin.left}, ${margin.top*2})`)

                const sankeyTooltip = d3.select(container)
                    .append("div")
                    .attr("class", "sankeyTooltip")
                // 添加节点和链接
                sankeyLinks = aggSankeyChart.append("g")
                    .selectAll('g')
                    .data(sankeyLinksData.filter(d => d.target.name !== 'unknown'))
                    .enter().append('g')
                    .attr('fill', 'none')
                    .attr('stroke-opacity', 0.5)
                    .style('cursor','pointer')
                    .attr('stroke', d => `url(#line-gradient-${d.index})`)
                    .on('mouseover', function (e, d) {
                        // aggSankeyChart.selectAll('path.highlight-line').remove();
                        const relatedNodes = [d.source, d.target];
                        const relatedLinks = [d];
                        // highlightSankeyChart(relatedLinks, relatedNodes)
                        // 显示tooltip
                        sankeyTooltip.transition()
                            .duration(200)
                            .style("opacity", .9)
                        sankeyTooltip.html(`<p>${d.source.name.split("*")[0]} -- ${d.target.name.split("*")[0]} <strong>${d.value}</strong></p>`) // 设置提示框的内容
                            .style("left", (e.pageX)- containerRect.left + container.scrollLeft + "px")
                            .style("top", (e.pageY - containerRect.top + 10) + "px")
                            .style("width", "auto")
                            .style("white-space", "nowrap");
                    })
                    .on('mouseout', function () {
                        sankeyTooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
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
                    .attr('stop-color', (d) => colorMap[parseAction(d.source.name.split("*")[0])]); // 起始节点颜色
                gradient.append('stop')
                    .attr('offset', '100%')
                    .attr('stop-color', (d) => colorMap[parseAction(d.source.name.split("*")[0])]); // 终止节点颜色
                sankeyLinks.append('path')
                    .attr('d', d => d3Sankey.sankeyLinkHorizontal(rectWidth,hasHead)(d))
                    .attr('stroke-width', d => Math.max(1, d.width/2));

                // 绘制head
                sankeyHeads = aggSankeyChart.append("g")
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

                const headText = aggSankeyChart.append("g")
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
                sankeyTails = aggSankeyChart.append("g")
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

                const tailText = aggSankeyChart.append("g")
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

                createNodes(false,containerId,container,containerRect,aggSankeyChart,sankeyNodesData,sankeyLinksData,sankeyNodes,sankeyHeads,sankeyTails,sankeyTooltip,seqView,colorMap,sunburstColor,2)

                const svgElement = d3.select('.aggSankeyChart');
                const svgRect = svgElement.node().getBoundingClientRect();
                const newWidth = svgRect.width;
                svg.style("width",newWidth+margin.left+margin.right)

                const legend = svg.append('g')
                    .attr('class', 'legend')
                    .attr('transform', `translate(30, ${svgRect.height+margin.top*3})`); // 控制图例位置

                // 添加图例矩形和文字
                const legendItems = Object.keys(colorMap);

                let totalLegendWidth = 0; // 用于存储总宽度
                let legendY = 0;
                // 点击图例变色
                const highlightColor = "#C0C0C0"; // 高亮颜色，比如灰色
                legendItems.forEach((item, index) => {
                    const rectSize = circleRadius*2;

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
                        .attr('x', legendX+rectSize*1.2+legendTextWidth/2).attr('y', legendY+ rectSize*0.6)
                        .attr('class', 'sankeyLegendText')
                        .attr('text',item)
                        .attr('text-anchor', 'middle').attr('alignment-baseline', 'middle')
                        .style('fill', colorMap[item]) // 根据操作类型选择颜色
                        .style('font-weight', 'bold')
                        .style('cursor', 'pointer') // 设置鼠标悬浮时显示手指样式
                        .on('click', function() {
                            changeGlobalHighlight(item, containerId)
                        })
                        .on('mouseover', function() {
                            changeGlobalMouseover(item, containerId)
                        })
                        .on('mouseout', function() {
                            changeGlobalMouseover(item, containerId)
                        });

                    // 添加图例矩形
                    legend.append('rect')
                        .attr('x', legendX)
                        .attr('y', legendY)
                        .attr('width', rectSize)
                        .attr('height', rectSize)
                        .style('fill', colorMap[item]);
                });
            })
            .catch(error => {
                console.error(error);
            });

        function highlightUser(nodesDictionary, relatedLinks, relatedNodes) {
            // aggSankeyChart.selectAll('.sunburst-node')
            //     .style('fill-opacity', function () {
            //         const nodeText = d3.select(this).attr('nodeText');
            //         return relatedNodes.includes(nodeText) ? 1 : 0.1;
            //     });
            aggSankeyChart.selectAll(`.sunburst-node`).style("fill", function(d) {
                if(d.depth === 0){return  colorMap[parseAction(d3.select(this).attr('nodeText').split("*")[0])]}
                else{return sunburstColor(d.data.name);}
            })
            aggSankeyChart.selectAll('.sunburst-node')
                .filter(function () {
                    return !relatedNodes.includes(d3.select(this).attr('nodeText'));
                })
                .style("fill", '#DCDCDC')

            const filteredDictionary = Object.fromEntries(
                Object.entries(nodesDictionary)
                    .filter(([key]) => store.state.globalHighlight.includes(key))
            );
            sankeyLinks.attr('stroke-opacity', link => (relatedLinks.includes(link) ? 0.8 : 0.2))
            aggSankeyChart.selectAll('path.highlight-line').remove();
            relatedLinks.forEach(link => {
                const users = getKeysByValue(nodesDictionary, link.source.name, link.target.name);
                if (users.length >= 1) {
                    const userColors = getKeysByValue(filteredDictionary, link.source.name, link.target.name)
                        .map(username => userColorMap[username]);
                    const linkWidth = link.width/2

                    if(userColors.length<link.value){
                        const fillCount = link.value - userColors.length;
                        userColors.splice(userColors.length, 0, ...Array(fillCount).fill("transparent"));
                    }
                    // 画突出线段
                    const userWidth = linkWidth / link.value;
                    const pathCoordinates = d3Sankey.sankeyLinkHorizontal(30,false)(link);
                    users.forEach((user, userIndex) => {
                        const userLink = aggSankeyChart.append("path")
                            .attr("d", pathCoordinates)
                            .attr("fill", "none")
                            .attr('class', 'highlight-line')
                            .attr("stroke", userColorMap[user])
                            .attr("stroke-opacity", 0.8)
                            .attr("stroke-width", userWidth)
                            .attr("transform", `translate(0, ${(userIndex+1) * userWidth - linkWidth / 2})`)
                            .lower()
                    });
                }
            });

            sankeyLinks.attr('stroke', link => {
                if (!relatedLinks.includes(link)) {
                    return '#DCDCDC';
                }
            });

            sankeyHeads.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
            sankeyTails.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
        }
        function mouseoverUser(relatedLinks, relatedNodes) {
            aggSankeyChart.selectAll('.sunburst-node').each(function(d) {
                let circle = d3.select(this);
                if (relatedNodes.includes(circle.attr('nodeText'))) {
                    circle.classed('mouseover-path', true); // 添加类名
                }
            });

            sankeyLinks.classed('mouseover-path', link => {
                return relatedLinks.includes(link);
            });

            sankeyHeads.classed('mouseover-path', link => (relatedLinks.includes(link)));
            sankeyTails.classed('mouseover-path', link => (relatedLinks.includes(link)));
        }

        // 监听选中的需要高亮的路径信息
        // store.watch(() => store.state.globalHighlight, (newValue) => {
            // 测试后端
            // const requestData = {
            //     data:data,
            //     selectedNames:store.state.globalHighlight,
            //     seqView:seqView
            // };
            // axios.post('http://127.0.0.1:5000/get_highlight_data', requestData)
            //     .then(response => {
            //         const nodesArray = response.data['nodesArray'];
            //         // 获取与已选中用户相关的连线
            //         const linksArray = getRelatedLinks(nodesArray, sankeyLinksData);
            //     })
            //     .catch(error => {
            //         console.error('Error:', error);
            //     });
        // }, { deep: true });

        store.watch(() => store.state.globalHighlight, (newValue) => {
            const code=container.getAttribute("codeContext")
            const filterParameters = store.state.filterRules
            const [dataKey] = code.split(".");
            const originalData = store.state.originalTableData[dataKey]
            const foundKey = findKeyByValue(originalData, Object.keys(data)[0]);
            const foundDataKey = findKeyByValue(originalData, data[Object.keys(data)[0]][seqView][0]);
            // 当筛选规则里面包含现有的键的时候才需要高亮分组条件
            if(Object.keys(filterParameters).includes(foundKey)){
                // 获取所有已选中用户的事件序列
                const allNodesArray = filterParameters[foundKey].flatMap(username => {
                    if(data[username][seqView]){
                        const userEvents = data[username][seqView];
                        return Object.entries(userEvents).map(([key, value]) => `${value}:${key}`);
                    }
                    else{return ["error"]}
                });
                // 获取所有已选中用户的事件序列，存储在字典中
                if(allNodesArray!==["error"]){
                    const nodesDictionary = {};
                    filterParameters[foundKey].forEach(username => {
                        const userEvents = data[username][seqView];
                        const userEventsArray = Object.entries(userEvents).map(([key, value]) => `${value}:${key}`);
                        nodesDictionary[username] = userEventsArray;
                    });
                    const linksArray = getRelatedLinks(allNodesArray, sankeyLinksData);
                    highlightUser(nodesDictionary, linksArray, allNodesArray)
                }
            }
            else{
                aggSankeyChart.selectAll('path.highlight-line').remove();
                resetSankeyChart()
            }
            //高亮数据项
            if(Object.keys(filterParameters).includes(foundDataKey)){
                const keys = filterParameters[foundDataKey]
                const circles = svg.selectAll('.sunburst-node');
                circles.style('visibility', d => {
                    return keys.includes(parseAction(d.data.name.split("*")[0])) ? 'visible': 'hidden'});
                // 切换颜色
                const highlightColor = "#C0C0C0";
                svg.selectAll(".sankeyLegendText")
                    .style('fill', function() {
                        const textContent = d3.select(this).text(); // 获取当前元素的文本内容
                        return keys.includes(parseAction(textContent)) ? colorMap[textContent]: highlightColor
                    });
            }
            else{
                svg.selectAll('.sunburst-node').style('visibility', 'visible');
                aggSankeyChart.selectAll(`.sunburst-node`).attr('fill-opacity', 1);
                svg.selectAll(".sankeyLegendText")
                    .style('fill', function() {
                        const textContent = d3.select(this).text(); // 获取当前元素的文本内容
                        return colorMap[textContent]
                    });
            }
        }, { deep: true });

        store.watch(() => store.state.globalMouseover, (newValue) => {
            const code=container.getAttribute("codeContext")
            const filterParameters = store.state.mouseoverRules
            const [dataKey] = code.split(".");
            const originalData = store.state.originalTableData[dataKey]
            const foundKey = findKeyByValue(originalData, Object.keys(data)[0]);
            const foundDataKey = findKeyByValue(originalData, data[Object.keys(data)[0]][seqView][0]);
            const circles = svg.selectAll('.sunburst-node');
            // 当筛选规则里面包含现有的键的时候才需要高亮分组条件
            if(Object.keys(filterParameters).includes(foundKey)){
                // 获取所有已选中用户的事件序列
                const allNodesArray = filterParameters[foundKey].flatMap(username => {
                    if(data[username][seqView]){
                        const userEvents = data[username][seqView];
                        return Object.entries(userEvents).map(([key, value]) => `${value}:${key}`);
                    }
                    else{return ["error"]}
                });
                if(allNodesArray!==["error"]){
                    const linksArray = getRelatedLinks(allNodesArray, sankeyLinksData);
                    mouseoverUser(linksArray, allNodesArray)
                }
            }
            else{
                svg.selectAll(".mouseover-path").classed("mouseover-path", false);
            }
            //高亮数据项
            if(Object.keys(filterParameters).includes(foundDataKey)){
                const keys = filterParameters[foundDataKey]
                svg.selectAll(".mouseover-circle").classed("mouseover-circle", false);
                circles.each(function(d) {
                    let circle = d3.select(this);
                    if (keys.includes(parseAction(d.data.name.split("*")[0]))) {
                        circle.classed('mouseover-circle', true); // 添加类名
                    }
                });

                svg.selectAll(".sankeyLegendText")
                    .each(function() {
                        const node = d3.select(this);
                        const textContent = d3.select(this).text();
                        if(keys.includes(parseAction(textContent))){
                            node.classed('mouseover-circle', true); // 根据条件添加或移除类名
                        }
                    });
            }
            else{
                svg.selectAll(".mouseover-circle").classed("mouseover-circle", false);
            }
        }, { deep: true });
    },

    createHeatmap(containerId, data, seqView) {
        // 检查数据的有效性
        if (!data || Object.keys(data).length === 0) {
            return;
        }

        const container = document.getElementById(containerId);
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // 创建 SVG 容器
        let margin = { top: 0.08*containerHeight, left: 0.15*containerWidth, right: 0.15*containerWidth,bottom: 0.1*containerHeight};
        let width = containerWidth - margin.left - margin.right
        let height = containerHeight - margin.top - margin.bottom;

        const extractedAccounts = Object.keys(data).reduce((acc, key) => {
            acc[key] = data[key][seqView];
            return acc;
        }, {});

        // 初始化一个对象来存储每个用户转换到另一个用户的次数
        const transitions = {};
        // 计算转换次数
        Object.values(extractedAccounts).forEach(users => {
            for (let i = 0; i < users.length - 1; i++) {
                const pair = `${users[i]}->${users[i + 1]}`;
                transitions[pair] = (transitions[pair] || 0) + 1;
            }
        });
        // 输出转换次数
        const users = Array.from(new Set([...Object.values(extractedAccounts).flat()]));
        const colorScale = d3.scaleSequential(d3.interpolateGnBu)
            .domain([0, d3.max(Object.values(transitions))]);
        // 创建比例尺映射用户到坐标轴位置
        const xScale = d3.scaleBand().domain(users).range([0, width]).padding(0.1); // 添加一些padding以避免方块之间紧挨;
        const yScale = d3.scaleBand().domain(users).range([0, height]).padding(0.1); // 添加一些padding以避免方块之间紧挨; // 假设每个格子的高度是20px

        // 解析转换次数数据，创建热力图需要的数据结构
        const heatmapData = Object.entries(transitions).map(([key, value]) => {
            const [from, to] = key.split('->');
            return { from, to, value };
        });

        const svg = d3.select(container)
            .append('svg')
            .attr('class', 'svgContainer'+containerId)
            .attr('width', containerWidth)
            .attr('height', '100%')
            .attr('overflow','auto')

        const graph = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip') // 可以在CSS中定义样式
            .style('opacity', 0);

        // 绘制热力图格子
        graph.selectAll('rect')
            .data(heatmapData)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.from))
            .attr('y', d => yScale(d.to))
            .attr("rx", 6)
            .attr("ry", 6)
            .attr('width', xScale.bandwidth()) // 这里bandwidth()根据比例尺的范围和用户数量动态计算
            .attr('height', yScale.bandwidth()) // 同上
            .attr('fill', d => colorScale(d.value))
            .on('mouseover', function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(d.from + '--' + d.to + " " +  " <strong>" + d.value + "</strong>")
                    .style('left', (event.pageX) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function(d) {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
        // 添加轴标签
        const xAxis = d3.axisTop(xScale).tickSize(0);
        const yAxis = d3.axisLeft(yScale).tickSize(0);

        graph.append('g')
            .attr('class', 'heatmapX-axis')
            .call(xAxis)
            .selectAll('text')

        graph.selectAll('.heatmapX-axis .domain, .heatmapX-axis line')
            .style('stroke', 'none'); // 将轴线和刻度线的颜色设置为透明

        graph.append('g')
            .attr('class', 'heatmapY-axis')
            .call(yAxis);

        graph.selectAll('.heatmapY-axis .domain, .heatmapY-axis line')
            .style('stroke', 'none'); // 将轴线和刻度线的颜色设置为透明

        // 图例尺寸和位置参数
        let legendWidth = 0.9*margin.left, legendHeight = 0.02*containerHeight
        const colorScaleDomain = colorScale.domain();
        // 创建图例容器
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${containerWidth - margin.right-margin.left}, ${containerHeight - 0.8*margin.bottom})`);
        // 创建图例的颜色条 - 使用渐变
        const linearGradient = legend.append("defs")
            .append("linearGradient")
            .attr("id", "linear-gradient");

        colorScale.ticks().forEach((t, i, n) => {
            linearGradient.append("stop")
                .attr("offset", `${(100 * i) / n.length}%`)
                .attr("stop-color", colorScale(t));
        });
        // 添加颜色条矩形
        legend.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#linear-gradient)");
        // 创建图例的比例尺，用于定位标签
        const legendScale = d3.scaleLinear()
            .domain([colorScaleDomain[0], colorScaleDomain[colorScaleDomain.length - 1]]) // 假设是连续比例尺
            .range([0, legendWidth]);

        // 创建一个只有两个刻度的轴（最小值和最大值）
        const legendAxis = d3.axisBottom(legendScale)
            .tickValues([colorScaleDomain[0], colorScaleDomain[colorScaleDomain.length - 1]]) // 只显示最小值和最大值
        // 添加到图例
        legend.append("g")
            .attr("class", "legend-axis")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(legendAxis);
        legend.selectAll(".domain, .tick line").style("stroke", "none"); // 方法 1
        legend.selectAll(".tick text")
            .style("stroke", "gray") // 设置刻度线颜色为灰色
            .style("fill", "gray"); // 设置刻度文本颜色为灰色

        let lastWidth = 0;
        let lastHeight = 0;
        const sizeChangeThreshold = 20; // 容器尺寸变化超过10px才重绘

        function updateHeatmapSize(container) {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;

            // 检查尺寸变化是否足够大，需要重绘
            if (Math.abs(newWidth - lastWidth) > sizeChangeThreshold || Math.abs(newHeight - lastHeight) > sizeChangeThreshold) {
                // 更新边距、宽度和高度
                margin = { top: 0.1 * newHeight, left: 0.15 * newWidth, right: 0.15 * newWidth, bottom: 0.1 * newHeight };
                width = newWidth - margin.left - margin.right;
                height = newHeight - margin.top - margin.bottom;

                // 更新比例尺的范围
                xScale.range([0, width]);
                yScale.range([0, height]);

                // 更新SVG容器尺寸
                d3.select('.svgContainer' + containerId)
                    .attr('width', newWidth)
                    .attr('height', newHeight);

                legendWidth = 0.9*margin.left
                legendHeight = 0.02*newHeight
                legend.attr("transform", `translate(${newWidth - margin.right-margin.left}, ${newHeight - 0.8*margin.bottom})`);

                legend.selectAll('rect')
                    .attr('width', legendWidth)
                    .attr('height', legendHeight);
                legend.select("legend-axis").call(legendAxis);

                redrawHeatmap();
                // 更新存储的尺寸值
                lastWidth = newWidth;
                lastHeight = newHeight;
            }
        }

        function redrawHeatmap() {
            graph.attr('transform', `translate(${margin.left}, ${margin.top})`)
            // 重绘热力图的格子
            graph.selectAll('rect')
                .attr('x', d => xScale(d.from))
                .attr('y', d => yScale(d.to))
                .attr('width', xScale.bandwidth())
                .attr('height', yScale.bandwidth());

            // 可能还需要更新轴线和其他视觉元素的位置
            graph.select('.heatmapX-axis').call(xAxis);
            graph.select('.heatmapY-axis').call(yAxis);

        }

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const {width, height} = entry.contentRect;
                updateHeatmapSize(container);
            }
        });

        resizeObserver.observe(container);
    },
};
