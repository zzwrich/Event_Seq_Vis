import * as echarts from 'echarts';
import * as d3 from 'd3';
import store from '@/store'

let usernameTextWidth = {}

function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleString(); // 使用默认的本地化格式
}
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
}
// 解析操作类型 暂时默认取首字母!!!
function parseAction(action) {
    // return action.split(' ')[0]
    return  action
}
// 筛选出来包含指定子序列的序列
function containsSubsequence(sequence, subsequence) {
    const sequenceArray = Object.values(sequence);
    for (let i = 0; i <= sequenceArray.length - subsequence.length; i++) {
        let match = true;
        for (let j = 0; j < subsequence.length; j++) {
            if (sequenceArray[i + j] !== subsequence[j]) {
                match = false;
                break;
            }
        }
        if (match) {return true;}
    }
    return false;
}
function containsPattern(sequence, pattern) {
    const sequenceArray = Object.values(sequence);
    let patternIndex = 0;

    for (let i = 0; i < sequenceArray.length; i++) {
        if (sequenceArray[i] === pattern[patternIndex]) {
            patternIndex++;
            if (patternIndex === pattern.length) {
                return true; // 找到完整模式
            }
        } else if (patternIndex > 0 && sequenceArray[i] !== pattern[patternIndex]) {
            // 如果当前元素不匹配，并且已经开始匹配模式，则重置
            i -= patternIndex;
            patternIndex = 0;
        }
    }
    return false;
}
function findSequencesContainingSubsequence(data, subsequence, seqView,isFuzzy) {
    const matchingSequences = {};

    Object.keys(data).forEach(user => {
        // const keys = Object.keys(data[user]);
        // const numberOfKeys = keys.length;
        // let userEvents
        // if (numberOfKeys === 2) {
        //     if(keys[1].includes("时间")){
        //         userEvents = data[user][keys[0]];
        //     }
        //     else {
        //         userEvents = data[user][keys[1]];
        //     }
        // }
        // else if (numberOfKeys === 1){
        //     userEvents = data[user][keys[0]];
        // }
        // else {
        //     userEvents = data[user]['执行语句']
        // }
        const userEvents = data[user][seqView];
        let parsedUserEvents = {}
        for (let key in userEvents) {
            parsedUserEvents[key] = parseAction(userEvents[key])
        }
        if(!isFuzzy){
            if (containsSubsequence(parsedUserEvents, subsequence)) {
                matchingSequences[user] = parsedUserEvents;
            }
        }
        else{
            if (containsPattern(parsedUserEvents, subsequence)) {
                matchingSequences[user] = parsedUserEvents;
            }
        }
    });
    return matchingSequences;
}

// 从数据中提取操作类型并为每种类型分配颜色
function generateColorMap(data,seqView) {
    const uniqueActionTypes = new Set();
    // 遍历数据，提取所有不同的操作类型
    Object.values(data).forEach(userEvents => {
        const events = userEvents[seqView];
        events.forEach(action => {
            // 提取操作类型，这里假设操作类型位于空格前的字符串
            const actionType = parseAction(action);
            uniqueActionTypes.add(actionType);
        })
    });

    // 为每种操作类型分配颜色
    const colorMap = {};
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10); // 使用内置的颜色方案

    uniqueActionTypes.forEach((actionType, index) => {
        colorMap[actionType] = colorScale(index);
    });

    return colorMap;
}
function convertToTreeData(data,seqView) {
    // 初始化树结构
    const root = { name: "root", children: [] };
    function buildTree(node, path, statements) {
        if (statements.length === 0) return;
        const statement = statements[0];
        const currentPath = path + ' > ' + statement;
        let childNode = node.children.find(child => child.path === currentPath);
        if (!childNode) {
            childNode = { name: statement, path: currentPath, children: [], value: 0 };
            node.children.push(childNode);
        }
        childNode.value += 1;

        buildTree(childNode, currentPath, statements.slice(1));
    }

    // 遍历每个用户的执行语句
    Object.values(data).forEach(user => {
        buildTree(root, "root", user[seqView]);
    });

    return root;
}
function toggleVisibility(element, button) {
    if (element.style.display === 'none') {
        element.style.display = '';
        button.textContent = '隐藏';
    } else {
        element.style.display = 'none';
        button.textContent = '展开';
    }
}
//柱状图
function getBarChartOption(data) {
    const outerKeys = Object.keys(data);

    return {
        title: {
            text: '计数结果',
        },
        tooltip: {
            trigger: 'axis',
        },
        toolbox: {
            show: true,
            feature: {
                mark: { show: true },
                dataView: { show: true, readOnly: false },
                magicType: { show: true, type: ['line', 'bar'] },
                restore: { show: true },
                saveAsImage: { show: true }
            }
        },
        legend: {
            data: outerKeys,
        },
        xAxis: {
            type: 'category',
            data: Object.keys(data[outerKeys[0]]),
        },
        yAxis: {
            type: 'value',
        },
        series: outerKeys.map(key => ({
            name: key,
            type: 'bar',
            data: Object.keys(data[key]).map(innerKey => data[key][innerKey])
        }))
    };
}
// 饼状图
function getPieChartOption(data) {
    const seriesData = [];
    for (const outerKey in data) {
        for (const innerKey in data[outerKey]) {
            seriesData.push({
                name: innerKey,
                value: data[outerKey][innerKey]
            });
        }
    }

    return {
        title: {
            text: '计数结果',
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        toolbox: {
            show: true,
            feature: {
                mark: { show: true },
                dataView: { show: true, readOnly: false },
                restore: { show: true },
                saveAsImage: { show: true }
            }
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            data: seriesData.map(item => item.name),
        },
        series: [
            {
                name: '事件个数',
                type: 'pie',
                radius: '55%',
                data: seriesData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ]
    };
}

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

        const colorMap = generateColorMap(data,seqView);
        // 创建 SVG 容器
        let margin = { top: 0.02*containerWidth, left: 0.01*containerHeight, right: 0.02*containerWidth };
        // 找到最长的事件序列的长度
        let maxLength = 0;
        let eventCount= 0
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
        // 筛选事件的函数
        function filterEvents(data, startTime, endTime, event1, event2, seqView) {
            let filteredEventsByUser = {};
            let time_key
            Object.keys(data).forEach(username => {
                const keys = Object.keys(data[username]);
                for(let i = 0; i < keys.length; i++) {
                    if(keys[i].includes("时间")){
                        time_key = keys[i]
                    }
                }
                // 对每个用户初始化一个空列表来存储事件对
                filteredEventsByUser[username] = [];
                const times = data[username][time_key]
                const events = data[username][seqView];
                for (let i = 0; i < events.length; i++) {
                    for (let j = i+1; j < events.length; j++) {
                        const timeDiff = (Date.parse(times[j]) - Date.parse(times[i])) / (1000 * 60); // 将时间差转换为分钟
                        // 检查时间差是否在指定范围内
                        const isTimeInRange = Math.abs(timeDiff)<= endTime
                        if (isTimeInRange) {
                            if (!event1 && !event2) {
                                // 如果没有指定事件类型，直接添加
                                filteredEventsByUser[username].push({ event1: i, event2: j });
                            } else if ((events[i] === event1 && events[j] === event2) || (events[i] === event2 && events[j] === event1)) {
                                if ((startTime >= 0 || isNaN(startTime)) && (events[i] === event1 && events[j] === event2)) {
                                    // 正时间范围：事件2 在事件1 之后
                                    filteredEventsByUser[username].push({ event1: i, event2: j });
                                } else if (startTime < 0) {
                                    // 负时间范围：事件2 在事件1 之前或之后都可
                                    filteredEventsByUser[username].push({ event1: i, event2: j });
                                }
                            }
                        }
                    }
                }
            });
            return filteredEventsByUser;
        }

        let isChangeUsername = false
        function displayFilteredEvents(filteredEvents) {
            const svg = d3.select(".svgContainer"+containerId); // 选择 SVG 容器
            // 首先移除所有旧的线条
            svg.selectAll('.event-pairs').remove();
            // 先将所有事件圆形颜色设置为灰色
            svg.selectAll('circle').style('fill', 'grey');
            Object.keys(filteredEvents).forEach(username => {
                filteredEvents[username].forEach(eventPair => {
                    if (username.includes('.')) {
                        username = username.replaceAll(".", "_");
                        isChangeUsername = true;
                    }
                    // 为属于eventPair的事件圆形添加特定类名
                    svg.selectAll(`.circle-${username}`).filter((d, i) => i === eventPair.event1 || i === eventPair.event2)
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
                isChangeUsername = false;
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
            svg.selectAll('circle')
                .style('fill', d => colorMap[parseAction(d)])
                .classed('paired-event', false); // 如果使用了特定类名进行高亮显示，移除该类名
        });
        //获取事件坐标
        function getCircleCoordinates(username, index, data, containerWidth, containerHeight) {
            if (username.includes('_') && isChangeUsername === true) {
                username = username.replaceAll("_", ".");
            }
            const scaleFactor = 0.025;
            let circleRadius = Math.min(containerWidth, containerHeight) * scaleFactor / 2;
            let circleSpacing = circleRadius / 2;
            const yPos = (Object.keys(data).indexOf(username) + 1) * (circleRadius * 2.5 + circleSpacing);
            const xPos = (index + 1) * (circleRadius * 2 + circleSpacing) + usernameTextWidth["username"+containerId];
            return { x: xPos, y: yPos };
        }

        // 计算圆形的半径
        const scaleFactor = 0.025;
        let circleRadius = Math.min(containerWidth, containerHeight) * scaleFactor / 2;
        let circleSpacing = circleRadius/2

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
            const circles = svg.selectAll('circle');
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

        // 遍历数据，创建事件符号
        Object.keys(data).forEach((username, index) => {
            const events = data[username][seqView];
            const yPos = (index+1) * (circleRadius * 2.5 + circleSpacing); // 控制圆形的垂直位置
            let newUsername= ""
            if (username.includes('.')) {
                newUsername = username.replaceAll(".", "_");
            }
            else{newUsername = username}
            // 显示用户名
            const usernameText = svg.append('text')
                .attr('x', 10) // 控制用户名的水平位置
                .attr('y', yPos+circleRadius/2)
                .text(username)
                .attr("class",`username-${newUsername}`)
                .style('fill', "#909399")
                .style('font-weight', 'bold');
            // 获取用户名文本的宽度
            usernameTextWidth["username"+containerId] = usernameText.node().getBBox().width;

            // 在 SVG 容器外部创建一个提示框元素
            const tooltip = d3.select(container)
                .append("div")
                .attr("class", "tooltip")
                .style("opacity", 0)
                .style("position", "absolute")
                .style("padding", "10px")
                .style("background", "white")
                .style("border", "1px solid #000")
                .style("border-radius", "5px")
                .style("pointer-events", "none"); // 确保提示框不会干扰鼠标事件

            const containerRect = document.getElementById(containerId).getBoundingClientRect();

            // 创建事件符号
            const circles = svg.append('g').selectAll(`.circle-${newUsername}`)
                .data(events)
                .enter()
                .append('circle')
                .attr('class', `circle-${newUsername}`)
                .attr('id', (d, i) =>i)
                .attr('cx', (d, i) => (i+1) * (circleRadius * 2 + circleSpacing) + usernameTextWidth["username"+containerId]) // 控制圆形的水平位置
                .attr('cy', yPos)
                .attr('r', circleRadius)
                .style('fill', d => colorMap[parseAction(d)]) // 根据操作类型选择颜色
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
                        .style("left", (event.pageX)-containerRect.left + "px")
                        .style("top", (event.pageY - containerRect.top) + "px");
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
                if (username.includes('.')) {
                    username = username.replaceAll(".", "_");
                    isChangeUsername = true;
                }
                svg.select(`.username-${username}`)
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
            svg.selectAll("circle")
                .classed("event-selected", function(d) {
                    const cx = d3.select(this).attr("cx");
                    const cy = d3.select(this).attr("cy");
                    const isSelected = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
                    if (isSelected) {
                        selectedData.push(parseAction(d));  // 将选中的数据添加到数组中
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
        const link = g.selectAll(".link")
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
