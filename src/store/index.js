import { createStore } from 'vuex';

const store = createStore({
    state() {
        return {
            responseData: null,
            visualType :null,
            isSelectVisualType:false,
            seqView :null,
            unusualSeq: [],
            selectedSeq: [],
            selectedData: "",
            selectedParameter: "",
            selectedOperator: "",
            curExpression:"",
            isDrag:false,
            isSelectData:false,
            isSelectNode:false,
            selectContainer: "",
            selectBox: "",
            isSelectContainer: "",
            isSelectParameter:false,
            globalHighlight: [],
            globalMouseover: [],
            curHighlightContainer: "",
            curMouseoverContainer: "",
            originalTableData:{},
            filterRules:{},
            mouseoverRules:{},
            dateRange: [],
            selectedViewType: "",
            isSelectedViewType: false,
            isSelectHistory: "",
            sheetName: "",
            sheetData: [],
            filterParam: [],
            // 用于存放brush临时数据
            interactionData: {},
            // 当前点击的节点id
            nodeId: "",
            // 筛选事件对的起始时间
            eventPairStartNum: "",
            // 筛选事件对的终止时间
            eventPairEndNum: "",
            // 事件对分析类别
            eventAnalyse: "",
            // 是否对事件对进行分析
            isAnalyseEvent: false,
            isClickBrush: false,
            isClickReset: false,
            isClickCancelFilter: false,
            isClickCancelBrush: false,
            // 存放所有时间轴视图的id对应的数据
            timeLineData: {}
        };
    },
    mutations: {
        setResponseData(state, data) {
            state.responseData = data;
        },
        setVisualType(state, option) {
            state.visualType = option;
        },
        setIsSelectVisualType(state) {
            state.isSelectVisualType = !state.isSelectVisualType;
        },
        setSeqView(state, option) {
            state.seqView = option;
        },
        setUnusualSeq(state, option) {
            state.unusualSeq.push(option);
        },
        setSelectedSeq(state, option) {
            state.selectedSeq = option;
        },
        setSelectedData(state, option) {
            state.selectedData = option;
        },
        setSelectedParameter(state, option) {
            state.selectedParameter = option;
        },
        clearSelectedParameter(state) {
            state.selectedParameter = ""; // 将 selectedParameter 清空
        },
        setSelectedOperator(state, option) {
            state.selectedOperator = option;
        },
        setCurExpression(state, option) {
            state.curExpression = option;
        },
        clearCurExpression(state) {
            state.curExpression = ""
        },
        setIsDrag(state) {
            state.isDrag = !state.isDrag;
        },
        setIsSelectData(state) {
            state.isSelectData = !state.isSelectData;
        },
        setIsSelectNode(state) {
            state.isSelectNode = !state.isSelectNode;
        },
        setSelectContainer(state, option) {
            state.selectContainer = option;
        },
        setSelectBox(state, option) {
            state.selectBox = option;
        },
        setIsSelectContainer(state) {
            state.isSelectContainer = !state.isSelectContainer;
        },
        setIsSelectParameter(state) {
            state.isSelectParameter = !state.isSelectParameter;
        },
        setGlobalHighlight(state,option) {
            state.globalHighlight.push(option);
        },
        clearGlobalHighlight(state) {
            state.globalHighlight = []
        },
        setGlobalMouseover(state,option) {
            state.globalMouseover.push(option);
        },
        setCurHighlightContainer(state, option) {
            state.curHighlightContainer = option;
        },
        setCurMouseoverContainer(state, option) {
            state.curMouseoverContainer = option;
        },
        setOriginalTableData(state, { key, value }) {
            if (!(key in state.originalTableData)) {
                state.originalTableData[key] = value;
            }
        },
        setFilterRules(state, option) {
            state.filterRules = option;
        },
        setMouseoverRules(state, option) {
            state.mouseoverRules = option;
        },
        setDateRange(state, option) {
            state.dateRange = option;
        },
        setSelectedViewType(state, option) {
            state.selectedViewType = option;
        },
        setIsSelectedViewType(state) {
            state.isSelectedViewType = !state;
        },
        setIsSelectHistory(state) {
            state.isSelectHistory = !state.isSelectHistory;
        },
        setSheetName(state, option) {
            state.sheetName = option;
        },
        setSheetData(state, option) {
            state.sheetData = option;
        },
        setFilterParam(state, option) {
            state.filterParam = option;
        },
        setInteractionData(state, {key, value}) {
            if (!(key in state.interactionData)) {
                state.interactionData[key] = value;
            }
            else{
                const obj1=state.interactionData
                const obj2={}
                obj2[key]= value
                const nodeId = Object.keys(obj1)[0]
                // 创建一个新的结果对象，其中包含合并后的expression数组和data数组
                const merged = {
                    [nodeId]: {
                        expression: [],
                        data: []
                    }
                };
                // 合并expression数组
                merged[nodeId]["expression"] = [...obj1[nodeId]["expression"], ...obj2[nodeId]["expression"]];
                // 合并data数组
                merged[nodeId]["data"] = [...obj1[nodeId]["data"], ...obj2[nodeId]["data"]];
                // 返回新的合并后的数据对象
                state.interactionData = merged
            }
        },
        setNodeId(state, option) {
            state.nodeId = option;
        },
        setEventPairStartNum(state, option) {
            state.eventPairStartNum = option;
        },
        setEventPairEndNum(state, option) {
            state.eventPairEndNum = option;
        },
        setEventAnalyse(state, option) {
            state.eventAnalyse = option;
        },
        setIsAnalyseEvent(state) {
            state.isAnalyseEvent = !state.isAnalyseEvent;
        },
        setIsClickBrush(state) {
            state.isClickBrush = !state.isClickBrush;
        },
        setIsClickReset(state) {
            state.isClickReset = !state.isClickReset;
        },
        setIsClickCancelFilter(state) {
            state.isClickCancelFilter = !state.isClickCancelFilter;
        },
        setIsClickCancelBrush(state) {
            state.isClickCancelBrush = !state.isClickCancelBrush;
        },
        setTimeLineData(state, { key, value }) {
            state.timeLineData[key] = value;
        },
    },
    actions: {
        saveResponseData({ commit }, data) {
            commit('setResponseData', data);
        },
        saveVisualType({ commit }, option) {
            commit('setVisualType', option);
        },
        saveIsSelectVisualType({ commit }) {
            commit('setIsSelectVisualType');
        },
        saveSeqView({ commit }, option) {
            commit('setSeqView', option);
        },
        saveUnusualSeq({ commit }, option) {
            commit('setUnusualSeq', option);
        },
        saveSelectedSeq({ commit }, option) {
            commit('setSelectedSeq', option);
        },
        saveSelectedData({ commit }, option) {
            commit('setSelectedData', option);
        },
        saveSelectedParameter({ commit }, option) {
            commit('setSelectedParameter', option);
        },
        clearSelectedParameter({ commit }) {
            commit('clearSelectedParameter'); // 调用 mutation 来清空 selectedParameter
        },
        saveSelectedOperator({ commit }, option) {
            commit('setSelectedOperator', option);
        },
        saveCurExpression({ commit }, option) {
            commit('setCurExpression', option);
        },
        clearCurExpression({ commit }) {
            commit('clearCurExpression');
        },
        saveIsDrag({ commit }, option) {
            commit('setIsDrag', option);
        },
        saveIsSelectData({ commit }) {
            commit('setIsSelectData');
        },
        saveIsSelectNode({ commit }) {
            commit('setIsSelectNode');
        },
        saveSelectContainer({ commit }, option) {
            commit('setSelectContainer', option);
        },
        saveSelectBox({ commit }, option) {
            commit('setSelectBox', option);
        },
        saveIsSelectContainer({ commit }) {
            commit('setIsSelectContainer');
        },
        saveIsSelectParameter({ commit }) {
            commit('setIsSelectParameter');
        },
        saveGlobalHighlight({ commit }, option) {
            commit('setGlobalHighlight', option);
        },
        clearGlobalHighlight({ commit }) {
            commit('clearGlobalHighlight');
        },
        saveGlobalMouseover({ commit }, option) {
            commit('setGlobalMouseover', option);
        },
        saveCurHighlightContainer({ commit }, option) {
            commit('setCurHighlightContainer',option);
        },
        saveCurMouseoverContainer({ commit }, option) {
            commit('setCurMouseoverContainer',option);
        },
        saveOriginalTableData({ commit }, { key, value }) {
            commit('setOriginalTableData',{ key, value });
        },
        saveFilterRules({ commit }, option) {
            commit('setFilterRules', option);
        },
        saveMouseoverRules({ commit }, option) {
            commit('setMouseoverRules', option);
        },
        saveDateRange({ commit }, option) {
            commit('setDateRange', option);
        },
        saveSelectedViewType({ commit }, option) {
            commit('setSelectedViewType', option);
        },
        saveIsSelectedViewType({ commit }) {
            commit('setIsSelectedViewType');
        },
        saveIsSelectHistory({ commit }) {
            commit('setIsSelectHistory');
        },
        saveSheetName({ commit }, option) {
            commit('setSheetName', option);
        },
        saveSheetData({ commit }, option) {
            commit('setSheetData',option);
        },
        saveFilterParam({ commit }, option) {
            commit('setFilterParam',option);
        },
        saveInteractionData({ commit }, {key, value}) {
            commit('setInteractionData', {key, value});
        },
        saveNodeId({ commit }, option) {
            commit('setNodeId',option);
        },
        saveEventPairStartNum({ commit }, option) {
            commit('setEventPairStartNum',option);
        },
        saveEventPairEndNum({ commit }, option) {
            commit('setEventPairEndNum',option);
        },
        saveEventAnalyse({ commit }, option) {
            commit('setEventAnalyse',option);
        },
        saveIsAnalyseEvent({ commit }) {
            commit('setIsAnalyseEvent');
        },
        saveIsClickBrush({ commit }) {
            commit('setIsClickBrush');
        },
        saveIsClickReset({ commit }) {
            commit('setIsClickReset');
        },
        saveIsClickCancelFilter({ commit }) {
            commit('setIsClickCancelFilter');
        },
        saveIsClickCancelBrush({ commit }) {
            commit('setIsClickCancelBrush');
        },
        saveTimeLineData({ commit }, {key, value}) {
            commit('setTimeLineData', {key, value});
        },
    }
});

export default store;