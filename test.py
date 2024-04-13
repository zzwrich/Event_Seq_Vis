import subprocess
import tempfile
from pathlib import Path
#
sequences = [
    [
        "10.10.1.1",
        "10.10.1.1",
        "10.80.1.1",
        "10.50.1.1",
        "10.60.1.2",
        "10.50.1.1",
        "10.40.2.1",
        "10.30.2.1",
        "10.10.1.1",
        "10.70.1.1",
        "10.50.2.2"
    ],
    [
        "10.50.2.2",
        "10.50.1.1",
        "10.60.1.2",
        "10.50.1.1",
        "10.30.2.1",
        "10.70.1.1",
        "10.10.2.1",
        "10.40.1.1",
        "10.50.2.2",
        "10.30.2.1",
        "10.10.1.1",
        "10.70.1.1",
        "10.40.1.1",
        "10.10.1.1"
    ],
    [
        "10.40.2.1",
        "10.10.2.1",
        "10.70.1.1",
        "10.30.2.1",
        "10.40.1.1",
        "10.70.1.1",
        "10.70.1.1",
        "10.70.1.1",
        "10.50.2.2",
        "10.60.1.2",
        "10.70.1.1",
        "10.10.2.1",
        "10.40.1.1",
        "10.80.1.1",
        "10.50.1.1",
        "10.40.2.1",
        "10.60.1.2"
    ],
    [
        "10.30.2.1",
        "10.30.2.1",
        "10.30.2.1",
        "10.30.2.1",
        "10.50.1.1",
        "10.80.1.1",
        "10.70.1.1",
        "10.40.2.1",
        "10.10.2.1",
        "10.50.2.2",
        "10.80.1.1"
    ],
    [
        "10.70.1.1",
        "10.50.1.1",
        "10.30.2.1",
        "10.60.1.2",
        "10.40.1.1",
        "10.40.1.1",
        "10.10.2.1",
        "10.80.1.1",
        "10.10.2.1",
        "10.80.1.1",
        "10.10.1.1",
        "10.40.1.1",
        "10.30.2.1",
        "10.30.2.1",
        "10.60.1.2",
        "10.70.1.1",
        "10.30.2.1"
    ],
    [
        "10.50.2.2",
        "10.50.2.2",
        "10.40.2.1",
        "10.60.1.2",
        "10.10.2.1",
        "10.70.1.1",
        "10.40.1.1",
        "10.10.2.1",
        "10.50.2.2",
        "10.60.1.2",
        "10.60.1.2",
        "10.50.1.1",
        "10.10.2.1"
    ],
    [
        "10.30.2.1",
        "10.70.1.1",
        "10.40.1.1",
        "10.40.2.1",
        "10.70.1.1",
        "10.60.1.2",
        "10.30.2.1",
        "10.40.2.1"
    ],
    [
        "10.60.1.2",
        "10.40.1.1",
        "10.30.2.1",
        "10.40.2.1",
        "10.30.2.1",
        "10.10.2.1",
        "10.10.2.1",
        "10.10.1.1",
        "10.70.1.1",
        "10.40.1.1",
        "10.70.1.1",
        "10.30.2.1",
        "10.30.2.1",
        "10.40.1.1"
    ],
    [
        "10.10.1.1",
        "10.50.1.1",
        "10.10.2.1",
        "10.30.2.1",
        "10.50.1.1",
        "10.30.2.1",
        "10.30.2.1",
        "10.50.2.2"
    ],
    [
        "10.50.2.2",
        "10.70.1.1",
        "10.10.2.1",
        "10.10.1.1",
        "10.70.1.1",
        "10.10.2.1",
        "10.80.1.1",
        "10.50.2.2",
        "10.10.1.1",
        "10.30.2.1",
        "10.50.1.1"
    ]
]

def find_frequent_pattern(sequences):
    # 生成项到ID和ID到项的映射
    item_to_id = {}
    id_to_item = {}
    current_id = 1
    for seq in sequences:
        for item in seq:
            if item not in item_to_id:
                item_to_id[item] = current_id
                id_to_item[current_id] = item
                current_id += 1

    # 准备数据并写入临时输入文件
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_input:
        input_file_path = temp_input.name
        for seq in sequences:
            # 对每个项后面都加上 -1，序列结束后加上 -2
            temp_input.write(' '.join(f"{item_to_id[item]} -1" for item in seq) + ' -2\n')

    with open(input_file_path, 'r') as f:
        lines = f.readlines()
    for i in lines:
        print(i)

    # 临时输出文件
    temp_output = tempfile.NamedTemporaryFile(delete=False)
    output_file_path = temp_output.name
    temp_output.close()

    # SPMF的路径，修改为你的实际路径
    spmf_jar_path = 'spmf.jar'
    # 最小支持度，根据需要调整
    min_support = "50%"
    # 构建Java命令
    command = f"java -jar {spmf_jar_path} run VMSP {input_file_path} {output_file_path} {min_support}"

    subprocess.run(command, shell=True)

    with open(output_file_path, 'r') as f:
        lines = f.readlines()

    # 解析结果并映射回原始项
    pattern_list = []
    for result in lines:
        print(result)
        # 移除字符串末尾的支持度信息（例如 "#SUP: 3"）
        pattern_str = result.split(" #")[0]
        # 分割模式字符串，移除分隔符'-1'后转换为整数ID列表
        pattern_ids = [int(id) for id in pattern_str.split(" -1")[:-1]]  # 切片[:-1]用于去除最后的空字符串
        # 将整数ID映射回原始项
        pattern_items = [id_to_item[id] for id in pattern_ids]
        pattern_list.append(pattern_items)

    # 清理临时文件
    Path(input_file_path).unlink()
    Path(output_file_path).unlink()

    return pattern_list


find_frequent_pattern(sequences)

 # 构建Java命令
# spmf_jar_path = 'spmf.jar'
# input_file_path="input.txt"
# output_file_path ="output.txt"
# min_support = '20%'
# # 构建Java命令
# command = f"java -jar {spmf_jar_path} run VMSP {input_file_path} {output_file_path} {min_support}"
# # 执行命令
# subprocess.run(command, shell=True)
#
# # 读取并打印输出文件的内容
# with open(output_file_path, 'r') as f:
#     print(f.read())

    
