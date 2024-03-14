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
            filterParam: []
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
    }
});

export default store;