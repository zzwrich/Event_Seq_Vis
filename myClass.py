import pandas as pd
from tool import find_frequent_pattern


def get_grouped_data_by_attribute(processed_data, originalData, attribute):
    def recursive_get_grouped_data_by_attribute(data):
        if isinstance(data, dict):
            grouped_data = {}
            for group_key, group_value in data.items():
                grouped_data[group_key] = recursive_get_grouped_data_by_attribute(group_value)
            return grouped_data
        elif isinstance(data, list):
            # 检查属性是否存在于原始数据中
            if attribute in originalData:
                return [originalData[attribute][i] for i in data]
            else:
                # 如果属性不存在，返回空列表
                return []
        else:
            return []

    return recursive_get_grouped_data_by_attribute(processed_data)


def extract_sequences(nested_dict):
    sequences = []

    def recurse(items):
        # 检查当前项目是不是字典
        if isinstance(items, dict):
            # 如果是字典，递归每个子项
            for item in items.values():
                recurse(item)
        elif isinstance(items, list):
            # 如果找到列表，将其包装在一个新列表中并添加到结果列表
            sequences.append(items)

    # 从最顶层字典开始递归
    recurse(nested_dict)
    return sequences


def is_subsequence(sub, full):
    # 检查子序列是否存在
    it = iter(full)
    return all(item in it for item in sub)


def find_patterns_in_nested_data(nested_data, patterns):
    # 检查数据类型
    if isinstance(nested_data, list):
        # 如果是列表，检查其中是否包含任何模式
        return [pattern for pattern in patterns if is_subsequence(pattern, nested_data)]
    elif isinstance(nested_data, dict):
        # 如果是字典，递归处理每个键值
        return {key: find_patterns_in_nested_data(value, patterns) for key, value in nested_data.items()}
    else:
        # 其他类型的数据不处理
        return nested_data


class Table:
    def __init__(self, file_path, sheet_name):
        self.file_path = file_path
        self.sheet_name = sheet_name
        # 读取Excel文件的特定sheet
        df = pd.read_excel(file_path, sheet_name)
        # 删除包含任何空白单元格的行
        self.data = df.dropna().to_dict(orient='records')
        # self.data = pd.read_excel(file_path, sheet_name).to_dict(orient='records')

    def get_data(self):
        # 返回数据的字典表示，每个键对应一列
        return {key: [item[key] for item in self.data] for key in {k for d in self.data for k in d}}


class ItemSet:
    def __init__(self, table):
        self.table = table
        # 通过table访问data
        self.data = table.get_data()
        key = next(iter(self.data))
        self.processed_data = list(range(len(self.data[key])))
        # 按照时间排序
        has_time_values = False
        time_key = ""
        for key in self.data:
            if any(isinstance(value, pd.Timestamp) for value in self.data[key]):
                has_time_values = True
                time_key = key
                break
        if has_time_values:
            self.processed_data = sorted(self.processed_data, key=lambda i: self.data[time_key][i])

    def copy(self):
        # 创建一个新的 ItemSet 实例，复制当前实例的状态
        new_instance = ItemSet(self.table)
        new_instance.processed_data = self.processed_data.copy()
        return new_instance

    def filter(self, attribute=None, operator=None, rule=None):
        if attribute is None and operator is None and rule is None:
            return self

        if attribute not in self.data:
            return self
        # 规则是数字
        if isinstance(rule, (int, float)):
            # 定义操作符和比较函数的映射
            operator_functions = {
                '<': lambda x, y: x < y,
                '=': lambda x, y: x == y,
                '>': lambda x, y: x > y,
                '>=': lambda x, y: x >= y,
                '<=': lambda x, y: x <= y,
            }
            # 数字比较
            if operator in operator_functions:
                compare_function = operator_functions[operator]
                result = [i for i in self.processed_data if compare_function(self.data[attribute][i], rule)]
        elif isinstance(rule, list):
            if self.data.get(attribute) and (isinstance(self.data[attribute][0], str) or "id" in attribute.lower()):
                result = [i for i in self.processed_data if self.data[attribute][i] in rule]
            elif self.data[attribute] and isinstance(self.data[attribute][0], (int, float)):
                lower_bound = float(rule[0])
                upper_bound = float(rule[1])
                # 检查 rule 是否有至少两个元素
                if len(rule) == 2:
                    result = [i for i in self.processed_data if lower_bound <= self.data[attribute][i] <= upper_bound]
                else:
                    raise ValueError("Rule must contain at least two elements.")

        else:
            # 字符串比较
            operator_functions = {
                '<': lambda x, y: x in y,
                '<=': lambda x, y: x in y,
                '=': lambda x, y: x == y,
            }
            if operator in operator_functions:
                compare_function = operator_functions[operator]
                result = [i for i in self.processed_data if compare_function(rule, self.data[attribute][i])]
        new_instance = self.copy()
        new_instance.processed_data = result
        return new_instance

    def filterTimeRange(self, startTime, endTime):
        # 查找包含"时间"的属性名
        time_attribute = [attr for attr in self.data if "时间" in attr]
        if not time_attribute:
            return self  # 没有找到包含"时间"的属性名，返回原始数据
        # 将时间字符串转换为 datetime 对象
        startTime = pd.to_datetime(startTime)
        endTime = pd.to_datetime(endTime)
        # 过滤时间范围
        result = []
        for i in self.processed_data:
            for attr in time_attribute:
                if startTime <= self.data[attr][i] <= endTime:
                    result.append(i)
                    break
        new_instance = self.copy()
        new_instance.processed_data = result
        return new_instance

    def _groupby(self, data, attribute, indices):
        """给定数据、属性和索引列表，按属性进行分组"""
        grouped = {}
        for index in indices:
            attr_value = data[attribute][index]
            if attr_value not in grouped:
                grouped[attr_value] = []
            grouped[attr_value].append(index)
        return grouped

    def group_by(self, attribute):
        if attribute not in self.data:
            return self
        new_instance = self.copy()
        if isinstance(new_instance.processed_data, list):
            # 直接对列表进行分组
            new_instance.processed_data = self._groupby(new_instance.data, attribute, new_instance.processed_data)
        elif isinstance(new_instance.processed_data, dict):
            # 迭代处理嵌套字典
            stack = [(None, new_instance.processed_data)]
            while stack:
                parent_key, current_data = stack.pop()
                for key, value in current_data.items():
                    if isinstance(value, list):
                        # 对列表进行分组
                        current_data[key] = self._groupby(new_instance.data, attribute, value)
                    elif isinstance(value, dict):
                        # 如果是字典，加入堆栈以便后续处理
                        stack.append((key, value))
        return new_instance

    # pattern函数用在多次分组之后
    def pattern(self, attribute, support="50%"):
        if attribute not in self.data:
            return self
        new_instance = self.copy()
        grouped_data_by_attribute = get_grouped_data_by_attribute(self.processed_data, self.data, attribute)
        sequences = extract_sequences(grouped_data_by_attribute)
        patternList = find_frequent_pattern(sequences, support)
        pattern_in_seq = find_patterns_in_nested_data(grouped_data_by_attribute, patternList)
        new_instance.processed_data = pattern_in_seq
        return new_instance

    # def flatten(self):
    #     new_instance = self.copy()
    #
    #     def recursive_flatten(data, prefix=''):
    #         flattened = {}
    #         if isinstance(data, dict):
    #             for key, value in data.items():
    #                 flattened.update(recursive_flatten(value, prefix=f"{prefix}{key}✖"))
    #         elif isinstance(data, list):
    #             flattened[prefix[:-1]] = data
    #         return flattened
    #
    #     if isinstance(new_instance.processed_data, dict):
    #         new_instance.processed_data = recursive_flatten(new_instance.processed_data)
    #         return new_instance
    #     else:
    #         return {}

    def flatten(self):
        new_instance = self.copy()

        def recursive_flatten(data):
            flattened = {}
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, dict):
                        for inner_key, inner_value in value.items():
                            # Concatenate the keys with '✖'
                            new_key = f"{key}✖{inner_key}"
                            flattened[new_key] = inner_value
                    else:
                        flattened[key] = value
            return flattened

        if isinstance(new_instance.processed_data, dict):
            new_instance.processed_data = recursive_flatten(new_instance.processed_data)
            return new_instance
        else:
            return {}

    def view_type(self, type):
        return self

    def aggregate(self):
        return self

    def unique_attr(self, *attributes):
        unique_values_result = {}

        for attribute in attributes:
            if attribute not in self.data:
                continue

            def process_data(data):
                if isinstance(data, list):
                    # 如果是列表，提取该属性的唯一值
                    return list(set(self.data[attribute][i] for i in data))
                elif isinstance(data, dict):
                    # 如果是字典，递归处理每个值
                    return {key: process_data(value) for key, value in data.items()}
                else:
                    return []

            unique_values_result[attribute] = process_data(self.processed_data)

        return unique_values_result

    def count(self, attribute=None, operator=None, myvalue=None):
        if attribute and attribute not in self.data:
            return {attribute: 0}

        def process_data(data):
            if isinstance(data, list):
                if operator:
                    if operator in ["<=", "<"]:
                        return sum(1 for i in data if myvalue in self.data[attribute][i])
                    else:
                        return sum(1 for i in data if self.data[attribute][i] == myvalue)
                else:
                    return sum(1 for i in data)
            elif isinstance(data, dict):
                # 如果是字典，递归处理每个值
                return {key: process_data(value) for key, value in data.items()}
            else:
                return 0

        # 检查是否使用了 group_by
        if isinstance(self.processed_data, dict):
            if attribute:
                return {attribute: process_data(self.processed_data)}
            else:
                return {"": process_data(self.processed_data)}
        else:
            result = {attribute: process_data(self.processed_data)}
            return {"": result}

    def unique_count(self, *attributes):
        unique_count_result = {}
        attr_string = "*".join(attributes)

        def process_data(data):
            if isinstance(data, list):
                combinations = set(tuple(self.data[attr][item] for attr in attributes) for item in data)
                return len(combinations)
            elif isinstance(data, dict):
                # 如果数据是字典，递归处理每个键
                return {key: process_data(value) for key, value in data.items()}
            else:
                return 0

        if isinstance(self.processed_data, dict):
            if not attributes or not self.processed_data:
                return {}
            unique_count_result[attr_string] = process_data(self.processed_data)

        else:
            unique_combinations = set()
            for index in self.processed_data:
                if all(attribute in self.data for attribute in attributes):
                    # 创建当前记录的属性组合
                    combination = tuple(self.data[attribute][index] for attribute in attributes)
                    unique_combinations.add(combination)
            unique_combination_count = len(unique_combinations)
            unique_count_result[""] = {attr_string: unique_combination_count}

        return unique_count_result

    # 求交集函数
    def intersection_set(self, another_set, feature=None):
        new_instance = self.copy()
        if self.processed_data and another_set.processed_data:
            set1 = self.processed_data
            set2 = another_set.processed_data
        if feature is None:
            # 如果没有提供特征，则直接返回两个集合的交集
            new_instance.processed_data = list(set(set1).intersection(set2))
        elif feature in self.data:
            # 如果提供了特征，求特征值的交集
            set1_values = set(self.data[feature][i] for i in set1)
            set2_values = set(self.data[feature][i] for i in set2)
            # 找出在这两个特征集合中共有的值
            common_values = set1_values.intersection(set2_values)
            # 找出具有共有特征值的索引
            new_instance.processed_data = [i for i in range(len(self.data[feature])) if
                                           self.data[feature][i] in common_values]
        else:
            new_instance.processed_data = []
        return new_instance

    # 求差集函数
    def difference_set(self, another_set, feature=None):
        new_instance = self.copy()
        if self.processed_data and another_set.processed_data:
            set1 = self.processed_data
            set2 = another_set.processed_data
        if feature is None:
            # 如果没有提供特征，则直接返回两个集合的差集
            new_instance.processed_data = list(set(set1) - set(set2))
        elif feature in self.data:
            # 如果提供了特征，求特征值的交集
            set1_values = set(self.data[feature][i] for i in set1)
            set2_values = set(self.data[feature][i] for i in set2)
            # 求差集
            difference_values = set1_values - set2_values
            # 找出具有差集特征值的索引
            new_instance.processed_data = [i for i in range(len(new_instance.data[feature])) if
                                           new_instance.data[feature][i] in difference_values]
        else:
            new_instance.processed_data = []
        return new_instance

    def get_list_data(self):
        # 从每个属性中选择与 processed_data 索引相匹配的元素
        return {key: [self.data[key][i] for i in self.processed_data] for key in self.data}

    def get_grouped_data(self):
        def recursive_get_grouped_data(data):
            if isinstance(data, dict):
                grouped_data = {}
                for group_key, group_value in data.items():
                    grouped_data[group_key] = recursive_get_grouped_data(group_value)
                return grouped_data
            elif isinstance(data, list):
                group_data = {}
                for key in self.data:
                    group_data[key] = [self.data[key][i] for i in data]
                return group_data
            else:
                return {}

        return recursive_get_grouped_data(self.processed_data)

    def get_result(self):
        # 返回当前数据处理的结果
        return self.processed_data
