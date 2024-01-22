import * as d3 from 'd3';
import * as d3Sankey from './d3-sankey/index.js';
import store from '@/store'
import {
    exportTableToCSV,
    addHierarchyInfo,
    changeGlobalHighlight,
    convertToTreeData,
    createSunburstData,
    estimateSankeySize,
    filterEvents,
    findKeyByValue,
    findSequencesContainingSubsequence,
    formatDateTime,
    generateColorMap,
    generateUserColorMap,
    getKeysByValue,
    getRelatedNodes,
    hexToRgb,
    parseAction,
    processSankeyData,
    toggleVisibility,
    getRelatedLinks,
    fillData
} from './tool.js'
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

        if (["filter", "original", "difference_set", "intersection_set", 'filterTimeRange'].includes(operation)) {
            this.createTable(containerId, data);
        }
        if(operation === "unique_attr"){
            this.createList(containerId, data);
        }
        if(operation === "view_type"){
            if(visualType==null || visualType==="barChart"){
                this.createBarChart(containerId, data);
            }
            else{
                this.createPieChart(containerId, data);
            }
        }
        if(operation === "seq_view"){
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
        if(operation === "agg_view"){
            this.createAggTimeLine(containerId, data, seqView);
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

        // store.watch(() => store.state.globalHighlight, (newValue) => {
        //     const filteredCodeContext = container.getAttribute("filteredCodeContext");
        //     if(container.firstChild){
        //         while (container.firstChild) {
        //             container.removeChild(container.firstChild);
        //         }
        //     }
        //     if (filteredCodeContext !== null && filteredCodeContext !== "") {
        //         const code=container.getAttribute("filteredCodeContext")
        //         const [dataKey] = code.split(".");
        //         axios.post('http://127.0.0.1:5000/executeCode', { code: code, startTime:"", endTime:"" })
        //             .then(response => {
        //                 const newData = response.data['result']
        //                 createTableHTML(containerId, newData);
        //             })
        //             .catch(error => {
        //                 console.error(error);
        //             });
        //     }
        //     else{
        //         createTableHTML(containerId, data);
        //     }
        // }, { deep: true });

        function createTableHTML(containerId, data) {
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
            const chartWidth = 0.9 * containerWidth;
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
                        .attr('height', d => chartHeight - yScale(filledData[key][d]));
                });

                const bbox = chartGroup.node().getBBox();
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

        const containerRect = document.getElementById(containerId).getBoundingClientRect();
        const chartWidth = 0.9 * containerWidth;
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
                changeGlobalHighlight(d, containerId)}); // 绑定点击事件

        chartGroup.selectAll('.x-axis text')
            .style('font-size', function(d) {
                const fontSize = fontSizeScale(containerWidth); // 根据宽度计算字体大小
                return fontSize + 'px';
            });

        chartGroup.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

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
                const [dataKey] = code.split(".");
                const originalData = store.state.originalTableData[dataKey]
                const foundKey = findKeyByValue(originalData, Object.keys(data[outerKeys[0]])[0]);
                axios.post('http://127.0.0.1:5000/executeCode', { code: code, startTime:"", endTime:"" })
                    .then(response => {
                        const newData = response.data['result']
                        keysInNewData =  Object.keys(newData[Object.keys(newData)[0]]);
                        const filterParameters = store.state.filterRules

                        // 高亮柱状图
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
                                        console.log("hehe", yScale(filledData[key][d]))
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
                    .style('font-weight', 'normal')
                    .style('fill', '#606266');
                chartGroup.selectAll('.x-axis text')
                    .style('font-weight', axisText => store.state.globalHighlight.includes(axisText) ? 'bold' : 'normal')
                    .style('fill', axisText => store.state.globalHighlight.includes(axisText) ? '#F56C6C' : '#606266');
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
                svg.selectAll('.legend-text').style('fill', d => store.state.globalHighlight.includes(d) ? '#F56C6C' : '#606266')
                    .style('font-weight', d => store.state.globalHighlight.includes(d) ? 'bold' : 'normal')
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
            .text(d => d);
        store.watch(() => store.state.globalHighlight, () => {
            svg.selectAll('.legend-text').style('fill', d => store.state.globalHighlight.includes(d) ? '#F56C6C' : '#606266')
                .style('font-weight', d => store.state.globalHighlight.includes(d) ? 'bold' : 'normal')
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
            svg.selectAll('.paired-event').style('fill', (d) => colorMap[parseAction(d.name)]);
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

        let svgHeight = (Object.keys(data).length+1) * (circleRadius * 2.5 + circleSpacing)+circleRadius * 2.5

        const svg = d3.select(container)
            .append('svg')
            .attr('class', 'svgContainer'+containerId)
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .attr('overflow','auto')
            .attr('transform', `translate(${margin.left},${margin.top})`)

        const seqContainer = svg.append('g')

        // 创建图例
        const legend = seqContainer.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(15, ${(Object.keys(data).length+1) * (circleRadius * 2.5 + circleSpacing)})`); // 控制图例位置

        // 添加图例矩形和文字
        const legendItems = Object.keys(colorMap);

        function toggleCirclesVisibility(item) {
            const circles = svg.selectAll('.event-circle');
            const isVisible = circles.filter(d => parseAction(d.name.replace(/\s\d+$/, '')) === item).style('visibility') === 'visible';
            circles.filter(d => parseAction(d.name.replace(/\s\d+$/, '')) === item)
                .style('visibility', isVisible ? 'hidden' : 'visible');
        }
        let totalLegendWidth = 0; // 用于存储总宽度
        let legendY = 0;
        // 点击图例变色
        const highlightColor = "#909399"; // 高亮颜色，比如灰色
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
                .attr('x', legendX+rectSize*1.5+legendTextWidth/2).attr('y', legendY+ rectSize*0.6)
                .attr('text-anchor', 'middle').attr('alignment-baseline', 'middle')
                .attr('class', 'sankeyLegendText')
                .attr('text',item)
                .style('fill', colorMap[item]) // 根据操作类型选择颜色
                .style('font-weight', 'bold')
                .style('cursor', 'pointer') // 设置鼠标悬浮时显示手指样式
                .on('click', function() {
                    event.stopPropagation();
                    changeGlobalHighlight(item, containerId)
                    // 切换与此图例项相关的事件圆形的可见性
                    toggleCirclesVisibility(item);
                });

            // 添加图例矩形
            legend.append('rect')
                .attr('x', legendX)
                .attr('y', legendY)
                .attr('width', rectSize)
                .attr('height', rectSize)
                .style('fill', colorMap[item]);
        });

        // 监听选中的需要高亮的路径信息
        store.watch(() => store.state.globalHighlight, (newValue) => {
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
                const keys = filterParameters[foundDataKey]
                const circles = svg.selectAll('.event-circle');
                circles.style('visibility', d => keys.includes(parseAction(d.name.replace(/\s\d+$/, ''))) ? 'visible': 'hidden');
                svg.selectAll(".sankeyLegendText")
                    .style('fill', function() {
                        const textContent = d3.select(this).text(); // 获取当前元素的文本内容
                        return keys.includes(parseAction(textContent)) ? colorMap[textContent]: highlightColor
                    });
            }
            else{
                svg.selectAll('.event-circle').style('visibility', 'visible');
            }
        }, { deep: true });

        // 遍历数据，创建事件符号
        Object.keys(data).forEach((username, index) => {
            const events = data[username][seqView];
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
                .attr('x', 10-usernameTextforWidth.node().getBBox().width*0.1) // 控制矩形框的水平位置，与用户名文本的位置一致
                .attr('y', yPos-circleRadius)
                .attr('width', usernameTextforWidth.node().getBBox().width*1.2)
                .attr('height',  Math.max(20,usernameTextforWidth.node().getBBox().height))
                .style('fill',  userColorMap[username])
                .style('opacity', 1)
                .style('cursor', 'pointer')

            const usernameText = seqContainer.append('text')
                .attr('x', 10) // 控制用户名的水平位置
                .attr('y', yPos+circleRadius/2)
                .text(username)
                .attr("username", `username-${username}`)
                .style('fill','#808080')
                .style('font-weight', 'bold')
                .style('cursor','pointer')
                .on('click', function () {
                    event.stopPropagation(); // 阻止事件传播
                    const selectedUsername = d3.select(this).text();
                    changeGlobalHighlight(selectedUsername, containerId)
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
            const eventChart = seqContainer.append('g')
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
        // window.addEventListener('resize', updateCircleSizes);
        // 创建 ResizeObserver 实例并观察容器尺寸变化
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                updateCircleSizes();
            }
        });
        resizeObserver.observe(container);
        function updateCircleSizes() {
            const circleRadius = Math.max(10,Math.min(container.clientWidth, container.clientHeight) * scaleFactor / 2);
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
    },

    createAggTimeLine(containerId, data, seqView) {
        // 检查数据的有效性
        if (!data || Object.keys(data).length === 0) {
            return;
        }
        const container = document.getElementById(containerId);
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const containerRect = document.getElementById(containerId).getBoundingClientRect();

        const colorMap = generateColorMap(data,seqView);
        // 创建颜色比例尺
        const sunburstColor = d3.scaleOrdinal(d3.schemePastel1);
        const userColorMap = generateUserColorMap(data);
        // 创建 SVG 容器
        let margin = { top: 0.01*containerHeight, left: 0.02*containerWidth, right: 0.02*containerWidth };
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

        // 桑基图高亮样式
        function highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes) {
            relatedNodes = relatedNodes.map(item => item.name);
            sankeyLinks.attr('stroke-opacity', link => (relatedLinks.includes(link) ? 0.8 : 0.1));
            sankeyLinks.attr('stroke', link => (relatedLinks.includes(link) ? `url(#line-gradient-${link.index})` : '#C0C0C0'));
            sankeyHeads.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
            sankeyTails.attr('fill-opacity', link => (relatedLinks.includes(link) ? 1 : 0.1));
            // 设置不在 namesArray 中的节点的颜色
            sankeyChart.selectAll('.sunburst-node')
                .filter(function () {
                    return !relatedNodes.includes(d3.select(this).attr('nodeText'));
                })
                .style("fill", '#DCDCDC')
        }
        function resetSankeyChart(sankeyChart,sankeyLinksData, sankeyHeads, sankeyTails, sankeyTooltip) {
            sankeyChart.selectAll(`.sunburst-node`).attr('fill-opacity', 1);
            sankeyChart.selectAll(`.sunburst-node`).style("fill", function(d) {
                if(d.depth === 0){return  colorMap[parseAction(d3.select(this).attr('nodeText').replace(/\s\d+$/, ''))]}
                else{return sunburstColor(d.data.name);}
            })
            sankeyLinks.attr('stroke-opacity', 0.5);
            sankeyLinks.attr('stroke', link => (`url(#line-gradient-${link.index})`));
            sankeyHeads.attr('fill-opacity', 1);
            sankeyTails.attr('fill-opacity', 1);
            if(sankeyTooltip){
                sankeyTooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            }
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
                const  sankeyWidth  = estimateSankeySize(sankeyNodesData,200);
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
                sankeyChart = svg.append('g')
                    .attr('class', 'sankeyChart')
                    .attr('transform', `translate(${margin.left}, ${margin.top})`)

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
                    // .attr('stroke','#D3D3D3')
                    .on('mouseover', function (e, d) {
                        sankeyChart.selectAll('path.highlight-line').remove();
                        const relatedNodes = [d.source, d.target];
                        const relatedLinks = [d];
                        // highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes)
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
                        // resetSankeyChart(sankeyChart, sankeyLinksData, sankeyHeads, sankeyTails, sankeyTooltip)
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
                    .attr('stop-color', (d) => colorMap[parseAction(d.source.name.replace(/\s\d+$/, ''))]); // 终止节点颜色
                sankeyLinks.append('path')
                    .attr('d', d => d3Sankey.sankeyLinkHorizontal(rectWidth,hasHead)(d))
                    .attr('stroke-width', d => Math.max(1, d.width/2));

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
                        // 计算每个旭日图的圆心位置和半径
                        const centerX = (nodeData.x0 + nodeData.x1) / 2
                        const centerY = (nodeData.y0 + nodeData.y1) / 2
                        const radius = Math.max((nodeData.x1 - nodeData.x0),(nodeData.y1 - nodeData.y0))/2
                        // 绘制旭日图
                        const root = d3.hierarchy(hierarchyData).sum((d) => d.value).sort((a, b) => b.value - a.value)
                        const sunburstData = partition(root)
                        // 添加路径元素
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
                                sankeyChart.selectAll('path.highlight-line').remove();
                                // 获取与当前节点相关的所有连线
                                const relatedLinks = sankeyLinksData.filter(link => link.source === nodeData || link.target === nodeData);
                                const relatedNodes = getRelatedNodes(nodeData,sankeyLinksData);
                                // highlightSankeyChart(sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes)
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
                                // resetSankeyChart(sankeyChart, sankeyLinksData, sankeyHeads, sankeyTails, sankeyTooltip)
                            });
                    }
                });
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

                const svgElement = d3.select('.sankeyChart');
                const svgRect = svgElement.node().getBoundingClientRect();
                const newWidth = svgRect.width;
                svg.style("width",newWidth+margin.left+margin.right)
            })
            .catch(error => {
                console.error(error);
            });

        function highlightUser(nodesDictionary, sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, relatedLinks, relatedNodes) {
            // sankeyChart.selectAll('.sunburst-node')
            //     .style('fill-opacity', function () {
            //         const nodeText = d3.select(this).attr('nodeText');
            //         return relatedNodes.includes(nodeText) ? 1 : 0.1;
            //     });
            sankeyChart.selectAll(`.sunburst-node`).style("fill", function(d) {
                if(d.depth === 0){return  colorMap[parseAction(d3.select(this).attr('nodeText').replace(/\s\d+$/, ''))]}
                else{return sunburstColor(d.data.name);}
            })
            sankeyChart.selectAll('.sunburst-node')
                .filter(function () {
                    return !relatedNodes.includes(d3.select(this).attr('nodeText'));
                })
                .style("fill", '#DCDCDC')

            const filteredDictionary = Object.fromEntries(
                Object.entries(nodesDictionary)
                    .filter(([key]) => store.state.globalHighlight.includes(key))
            );
            sankeyLinks.attr('stroke-opacity', link => (relatedLinks.includes(link) ? 0.8 : 0.2))
            sankeyChart.selectAll('path.highlight-line').remove();
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
                        const userLink = sankeyChart.append("path")
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
                        return Object.entries(userEvents).map(([key, value]) => `${value} ${key}`);
                    }
                    else{return ["error"]}
                });
                // 获取所有已选中用户的事件序列，存储在字典中
                if(allNodesArray!==["error"]){
                    const nodesDictionary = {};
                    filterParameters[foundKey].forEach(username => {
                        const userEvents = data[username][seqView];
                        const userEventsArray = Object.entries(userEvents).map(([key, value]) => `${value} ${key}`);
                        nodesDictionary[username] = userEventsArray;
                    });
                    const linksArray = getRelatedLinks(allNodesArray, sankeyLinksData);
                    highlightUser(nodesDictionary, sankeyChart, sankeyNodes, sankeyHeads, sankeyTails, linksArray, allNodesArray)
                }
            }
            else{
                sankeyChart.selectAll('path.highlight-line').remove();
                resetSankeyChart(sankeyChart, sankeyLinksData, sankeyNodes, sankeyHeads, sankeyTails)
            }
            //高亮数据项
            if(Object.keys(filterParameters).includes(foundDataKey)){
                const keys = filterParameters[foundDataKey]
                console.log("keys",keys)
                const circles = svg.selectAll('.sunburst-node');
                circles.style('visibility', d => {
                    return keys.includes(parseAction(d.data.name)) ? 'visible': 'hidden'});
                // 切换颜色
                const highlightColor = "#909399"; // 高亮颜色，比如灰色
                svg.selectAll(".sankeyLegendText")
                    .style('fill', function() {
                        const textContent = d3.select(this).text(); // 获取当前元素的文本内容
                        return keys.includes(parseAction(textContent)) ? colorMap[textContent]: highlightColor
                    });
            }
            else{
                svg.selectAll('.sunburst-node').style('visibility', 'visible');
                sankeyChart.selectAll(`.sunburst-node`).attr('fill-opacity', 1);
            }
        }, { deep: true });
        // 创建图例
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(30, ${Object.keys(data).length*35+margin.top*4})`); // 控制图例位置

        // 添加图例矩形和文字
        const legendItems = Object.keys(colorMap);
        function toggleCirclesVisibility(item) {
            event.stopPropagation();
            const circles = svg.selectAll('.sunburst-node');
            const isVisible = circles.filter(d => {
                return (parseAction(d.data.name) === item)}).style('visibility') === 'visible';
            circles.filter(d => parseAction(d.data.name) === item)
                .style('visibility', isVisible ? 'hidden' : 'visible');
        }

        let totalLegendWidth = 0; // 用于存储总宽度
        let legendY = 0;
        // 点击图例变色
        const highlightColor = "#909399"; // 高亮颜色，比如灰色
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
                .attr('x', legendX+rectSize*1.5+legendTextWidth/2).attr('y', legendY+ rectSize*0.6)
                .attr('class', 'sankeyLegendText')
                .attr('text',item)
                .attr('text-anchor', 'middle').attr('alignment-baseline', 'middle')
                .style('fill', colorMap[item]) // 根据操作类型选择颜色
                .style('font-weight', 'bold')
                .style('cursor', 'pointer') // 设置鼠标悬浮时显示手指样式
                .on('click', function() {
                    // 切换与此图例项相关的事件圆形的可见性
                    toggleCirclesVisibility(item);
                    changeGlobalHighlight(item, containerId)
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
};
