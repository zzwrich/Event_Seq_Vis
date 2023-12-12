let nextId = 1;

export function boxClass(box) {
    return {
        [`box-${box.id}`]: true,
        'selected': box.isSelected
    };
}

export function boxStyle(box) {
    return {
        width: box.width,
        height: box.height,
        position: 'absolute',
        top: box.y + '%',
        left: box.x + '%',
        background: '#f0f0f0',
        'box-sizing': 'border-box',
    };
}
export function handleIncrement(boxes, boxIndex, rootWidth, rootHeight) {
    let box = boxes[boxIndex]
    if (!box) return;
    const gap = 1; // 间隙大小，单位为百分比
    const boxWidth= parseFloat(box.width.replace('%', ''))/100;
    const boxHeight= parseFloat(box.height.replace('%', ''))/100;
    if (boxWidth * rootWidth >boxHeight * rootHeight) {
        const newWidth = boxWidth / 2;
        const newBox1 = { id: nextId++,parentId:box.id, width: (newWidth*100-gap/2)+"%", height: boxHeight*100+"%", x:box.x, y:box.y, children: [],parent:[] };
        newBox1.parent.push(box)
        const newBox2 = { id: nextId++,parentId:box.id, width: (newWidth*100-gap/2)+"%", height: boxHeight*100+"%", x:box.x+newWidth*100+gap/2, y:box.y, children: [],parent:[] };
        newBox2.parent.push(box)
        // 移除当前box
        boxes.splice(boxIndex, 1);
        boxes.push(newBox1)
        boxes.push(newBox2)
        box.children=[ newBox1, newBox2 ]
    } else {
        const newHeight = boxHeight / 2;
        const newBox1 = { id: nextId++,parentId:box.id, width: boxWidth*100+"%", height: (newHeight*100-gap/2)+"%", x:box.x, y:box.y, children: [],parent:[] };
        newBox1.parent.push(box)
        const newBox2 = { id: nextId++,parentId:box.id, width: boxWidth*100+"%", height: (newHeight*100-gap/2)+"%", x:box.x, y:box.y+newHeight*100+gap/2, children: [],parent:[] };
        newBox2.parent.push(box)
        boxes.splice(boxIndex, 1);
        boxes.push(newBox1)
        boxes.push(newBox2)
        box.children=[ newBox1, newBox2 ]
    }
}

export function handleDecrement(boxes,boxIndex) {
    let box = boxes[boxIndex];
    if (!box || !box.parent) return;
    //将当前box的父box加入boxes
    boxes.push(box.parent[0])
    // 找到父级 box 的索引
    const parentIndex = box.parentId
    if (parentIndex !== -1) {
        // 删除所有具有相同 parent 的 box
        const siblings = boxes.filter(b => b.parentId === box.parentId);
        siblings.forEach(sibling => {
            const index = boxes.indexOf(sibling);
            if (index !== -1) {
                boxes.splice(index, 1);
            }
        });
    }
}
