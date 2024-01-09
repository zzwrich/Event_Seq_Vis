import * as d3 from "d3";

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
    // return action.split(' ')[0]
    return  action
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


function processData(inputData,seqView) {

}
