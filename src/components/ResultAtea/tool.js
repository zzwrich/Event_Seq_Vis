import * as d3 from "d3";
import store from '@/store'

export function exportTableToCSV(containerId, filename) {
    console.log("con",containerId)
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

export function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleString(); // 使用默认的本地化格式
}
export function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
}
// 解析操作类型 暂时默认取首字母!!!
export function parseAction(action) {
    return action.split(' ')[0]
    // return action
}

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
export function findSequencesContainingSubsequence(data, subsequence, seqView,isFuzzy) {
    const matchingSequences = {};
    Object.keys(data).forEach(user => {
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
export function generateColorMap(data,seqView) {
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

export function generateUserColorMap(data) {
    const uniqueActionTypes = new Set();
    // 遍历数据，提取所有不同的操作类型
    Object.keys(data).forEach(user => {
        uniqueActionTypes.add(user);
    });
    // 为每种操作类型分配颜色
    const colorMap = {};
    const colorScale = d3.scaleOrdinal(d3.schemeSet3); // 使用内置的颜色方案
    uniqueActionTypes.forEach((actionType, index) => {
        colorMap[actionType] = colorScale(index);
    });
    return colorMap;
}

export function toggleVisibility(element, button) {
    if (element.style.display === 'none') {
        element.style.display = '';
        button.textContent = '隐藏';
    } else {
        element.style.display = 'none';
        button.textContent = '展开';
    }
}

//柱状图
export function getBarChartOption(data) {
    const outerKeys = Object.keys(data);
    return {
        title: {
            text: 'Count Result',
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
            data: Object.keys(data[key]).map(innerKey => data[key][innerKey]),
            emphasis: {
                itemStyle: {
                    opacity: 0.8,
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)',
                },
            },
            cursor: 'pointer',
        }))
    };
}
// 饼状图
export function getPieChartOption(data) {
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
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        toolbox: {
            show: true,
            feature: {
                dataView: { show: true, readOnly: false },
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
                name: 'Count Result',
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

export function convertToTreeData(data,seqView) {
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
// 筛选事件的函数
export function filterEvents(data, startTime, endTime, event1, event2, seqView) {
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

export function getRelatedNodes(currentNode, links) {
    const relatedNodes = [];
    // 遍历所有连线，找到与当前节点相关的节点
    links.forEach(link => {
        if (link.source === currentNode) {
            relatedNodes.push(link.target);
        } else if (link.target === currentNode) {
            relatedNodes.push(link.source);
        }
    });
    relatedNodes.push(currentNode);
    return relatedNodes;
}

export function getRelatedLinks(nodes, links) {
    const allRelatedLinks = [];
    // 遍历所有节点
    nodes.forEach((node, index) => {
        // 获取与当前节点相关的连线
        const relatedLinks = links.filter(link => link.source.name === node || link.target.name === node);
        // 过滤出与当前节点相邻的两个节点的连线
        const adjacentLinks = relatedLinks.filter(link => {
            const sourceIndex = nodes.indexOf(link.source.name);
            const targetIndex = nodes.indexOf(link.target.name);
            return index - sourceIndex === 1 || targetIndex - index === 1;
        });
        // 将相关连线添加到总数组中
        allRelatedLinks.push(...adjacentLinks);
    });
    return allRelatedLinks;
}
export function estimateSankeySize(nodes, nodeSpacing) {
    // 提取数字部分并获取最大值
    let maxDepth = Math.max(...nodes
        .filter(node => node.name !== "unknown")
        .map(node => {
        const numbers = node.name.split(' ').map(str => parseInt(str, 10));
        return numbers[numbers.length - 1];
    }));
    if(nodes.some(node => node.name === "unknown")){
        if(maxDepth===0){
            maxDepth=1
        }
    }
    // 计算宽度和高度
    return  maxDepth * nodeSpacing ;
}

// 给数据添加层级信息
export function addHierarchyInfo(data, seqView) {
    // 创建一个新的对象来存储带有层级信息的数据
    let newData = {};
    const events = data[seqView];
    // 为每个事件添加层级信息，并将新数据存储在新的对象中
    newData = {
        ...data,  // 复制原始数据的其他属性
        [seqView]: events.map((event, index) => `${event} ${index}`)
    };
    return newData;
}

//桑基图数据
export function processSankeyData(data, seqView) {
    const nodes = [];
    const links = [];
    const events = data[seqView];
    // 如果事件只有一个元素，直接添加节点
    if (events.length === 1) {
        // 查找或添加节点
        const sourceNode = nodes.find(node => node.name === events[0]) || { name:events[0]};
        const targetNode = nodes.find(node => node.name === "unknown") || { name: "unknown" };
        if (!nodes.find(node => node.name === sourceNode.name)) {
            nodes.push(sourceNode);
        }
        if (!nodes.find(node => node.name === targetNode.name)) {
            nodes.push(targetNode);
        }
        links.push({ head: { name: "head" }, tail: { name: "tail" }, source: sourceNode, target: targetNode, value: 1 });
    } else {
        // 遍历事件，构建节点和链接
        for (let i = 0; i < events.length - 1; i++) {
            const source = events[i];
            const target = events[i + 1];
            // 查找或添加节点
            const sourceNode = nodes.find(node => node.name === source) || { name: source };
            const targetNode = nodes.find(node => node.name === target) || { name: target };
            if (!nodes.find(node => node.name === sourceNode.name)) {
                nodes.push(sourceNode);
            }
            if (!nodes.find(node => node.name === targetNode.name)) {
                nodes.push(targetNode);
            }
            // 添加链接
            links.push({ head: { name: "head" }, tail: { name: "tail" }, source: sourceNode, target: targetNode, value: 1 });
        }
    }
    return { nodes, links };
}

export function createSunburstData(data, seqView) {
    if (data[seqView]) {
        return {
            name: data[seqView].replace(/\s\d+$/, ''),
            children: Object.entries(data).filter(([key, value]) => key !== seqView)
                .map(([key, value]) => ({ name: value,value:1 }))
        };
    } else {
        return {
            name: "root",
            children: Object.entries(data).filter(([key, value]) => key !== seqView)
                .map(([key, value]) => ({ name: value,value:1 }))
        };
    }
}

export function getKeysByValue(dictionary, sourceValue, targetValue) {
    const result = [];
    for (const [key, values] of Object.entries(dictionary)) {
        if (values.includes(sourceValue)&&values.includes(targetValue)) {
            result.push(key);
        }
    }
    return result;
}

export function findKeyByValue(data, searchValue) {
    for (const key in data) {
        if (data[key].includes(searchValue)) {
            return key;
        }
    }
    return null;
}

export function changeGlobalHighlight(d, containerId){
    store.commit('setCurHighlightContainer',containerId);

    const index = store.state.globalHighlight.indexOf(d);
    if (index !== -1) {
        store.state.globalHighlight.splice(index, 1);
    }
    else {
        store.commit('setGlobalHighlight', d);
    }

    let filterRules={}
    const myDiv =  document.getElementById(containerId)
    let codeContext =myDiv.getAttribute("codeContext");
    const [dataKey] = codeContext.split(".");
    const originalData = store.state.originalTableData[dataKey]

    const parentDiv = document.getElementsByClassName('grid-item block4')[0];
    const childDivs = parentDiv.querySelectorAll('div');
    const allChildDivs = {};
    // 遍历 children 数组
    for (let i = 0; i < childDivs.length; i++) {
        // 获取当前子元素的所有子 div 元素
        const currentChildDivs = childDivs[i].querySelectorAll('div');
        // 在当前子元素的子 div 中查找类名为 'chart-container' 的元素
        for (let j = 0; j < currentChildDivs.length; j++) {
            const currentDiv = currentChildDivs[j];
            if (currentDiv.classList.contains('chart-container')) {
                // 将 'chart-container' 元素的 id 添加到数组中
                const curDivId = currentDiv.id
                allChildDivs[curDivId] = document.getElementById(curDivId).getAttribute("codeContext");
            }
        }
    }
    if(store.state.globalHighlight.length===0){
        Object.entries(allChildDivs).forEach(([key, value]) => {
            const myDiv = document.getElementById(key);
            // 将字符串信息绑定到div的自定义属性上
            myDiv.setAttribute("filteredCodeContext", "");
        });
        filterRules={}
        store.commit('setFilterRules', filterRules);
    }
    else{
        for(let i=0;i<store.state.globalHighlight.length;i++){
            const curd = store.state.globalHighlight[i]
            // 当前点击的数据项在数据中的键 为了后面加上filter语句
            const foundKey = findKeyByValue(originalData, curd);
            if(foundKey!==null){
                if (!(foundKey in filterRules)) {
                    filterRules[foundKey] = []
                    filterRules[foundKey].push(curd)
                }
                else{
                    filterRules[foundKey].push(curd)
                }
            }
            const filtersArray = [];

            for (const key in filterRules) {
                if (filterRules.hasOwnProperty(key)) {
                    const values = filterRules[key];
                    const filterString = `filter('${key}', 'in', ${JSON.stringify(values)})`;
                    filtersArray.push(filterString);
                }
            }
            store.commit('setFilterRules', filterRules);

            Object.entries(allChildDivs).forEach(([key, value]) => {
                const hasDot = value.includes('.');
                // 根据是否包含 '.' 进行不同的处理
                let modifiedString;
                if(filtersArray.length!==0){
                    if (hasDot) {
                        const parts = value.split('.');
                        modifiedString = `${parts[0]}.${filtersArray.join('.')}.${parts.slice(1).join('.')}`;
                    } else {
                        modifiedString = `${value}.${filtersArray.join('.')}`;
                    }
                }
                else{
                    modifiedString = ""
                }
                const myDiv = document.getElementById(key);
                // 将字符串信息绑定到div的自定义属性上
                myDiv.setAttribute("filteredCodeContext", modifiedString);
            });
        }
    }
}

// 填充数据的函数
export function fillData(originalData, newData) {
    const result = {};
    // 遍历原始数据的键
    for (const outerKey in originalData) {
        if (originalData.hasOwnProperty(outerKey)) {
            result[outerKey] = {}; // 创建一个新对象来存放填充后的数据

            // 遍历原始数据中的内部键
            for (const innerKey in originalData[outerKey]) {
                if (originalData[outerKey].hasOwnProperty(innerKey)) {
                    if (newData[outerKey] && newData[outerKey][innerKey] !== undefined) {
                        // 如果新数据中包含相同的键，将原始数据的值复制到结果中
                        result[outerKey][innerKey] = newData[outerKey][innerKey];
                    } else {
                        // 如果新数据中没有相同的键，将值设置为0
                        result[outerKey][innerKey] = 0;
                    }
                }
            }
        }
    }
    return result;
}