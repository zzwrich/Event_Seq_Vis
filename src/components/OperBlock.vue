<template>
    <div class="draggable-square-container" ref="container"></div>
</template>

<script>
import * as d3 from 'd3';

export default {
  name: 'DraggableSquare',
  data() {
    return {
      rectWidth: "5%",
      rectHeight: "5%",
      rectSpacing: 50,
    };
  },
  mounted() {
    this.createDraggableSquare();
    window.addEventListener('resize', this.handleResize);
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
  },

  methods: {
    handleResize() {
      // 当窗口大小变化时重新计算矩形块的位置和尺寸
      d3.select(this.$refs.container).select('svg').remove();
      this.createDraggableSquare();
    },

    createDraggableSquare() {
      const svg = d3.select(this.$refs.container)
          .append('svg')
          .attr('class', 'draggable-square')
          .attr('width', '100%')
          .attr('height', '100%');

      const rootElement = document.getElementsByClassName('grid-container')[0]
      const rootRect = rootElement.getBoundingClientRect();
      const rootWidth=rootRect.width
      const rootHeight=rootRect.height

      const block5Element = document.getElementsByClassName('grid-item block5')[0]
      const block5Rect = block5Element.getBoundingClientRect();
      const offsetX = block5Rect.left;
      const offsetY = block5Rect.top;

      //判断是否被拖动至于指定位置
      const blockElement = document.getElementsByClassName('item block2')[0];
      const blockRect = blockElement.getBoundingClientRect();
      const blockLeft = blockRect.left;
      const blockRight = blockRect.right;
      const blockTop = blockRect.top;
      const blockBottom = blockRect.bottom;
      const block5Width = block5Rect.width;
      const block5Height = block5Rect.height;

      //矩形块的初始坐标
      const rectCoordinates = []; // 存储矩形块的坐标

      // 计算文本大小
      function calculateFontSize(rectWidth, rectHeight) {
        return Math.min(rectWidth, rectHeight) / 10 + "px";
      }

      for (let i = 0; i <= 8; i++) {
        const rectWidth= parseFloat(this.rectWidth.replace('%', ''))/100;
        const rectHeight= parseFloat(this.rectHeight.replace('%', ''))/100;
        const rectX = offsetX+((block5Width-rectWidth*rootWidth) /2); // 矩形块的x坐标
        const rectY = offsetY+((i + 1) * (rectHeight*rootHeight + this.rectSpacing)) // 矩形块的y坐标
        const textX=rectX+rectWidth*rootWidth/2
        const textY=rectY+rectHeight*rootHeight/2

        //添加矩形块
        const rect = svg.append('rect')
            .attr('width', this.rectWidth)
            .attr('class', 'draggable-rect')
            .attr('height', this.rectHeight)
            .attr('fill', '#f0f0f0')
            .attr('stroke', '#ddd')
            .attr('x', rectX)
            .attr('y', rectY)
            .attr('id', 'myRect'+i)
            .attr('cursor','move')
            .attr('rx', 10) // 圆角的 x 半径
            .attr('ry', 10) // 圆角的 y 半径
            .on('mouseover', function() {
              d3.select(this)
                  .attr('fill','#C0C4CC'); // 鼠标悬停时的填充颜色
            })
            .on('mouseout', function() {
              d3.select(this)
                  .attr('fill', '#f0f0f0'); // 鼠标离开时恢复原始填充颜色
            });

        // 创建 filter
        const shadowFilter = svg.append('defs')
            .append('filter')
            .attr('id', 'drop-shadow')
            .attr('height', '130%');

        shadowFilter.append('feDropShadow')
            .attr('dx', 5)
            .attr('dy', 5)
            .attr('stdDeviation', 2)
            .attr('flood-color', 'rgba(0, 0, 0, 0.5)');
        // 应用阴影 filter 到矩形
        rect.style('filter', 'url(#drop-shadow)');


        // 添加文本
        const text = svg.append('text')
            .text('Text ' + i) // 文本内容
            .attr('x', textX) // 根据需要调整位置
            .attr('y', textY)
            .attr('id','myText'+i)
            .style('font-size', calculateFontSize(rect.attr('width'), rect.attr('height')))
            .attr('dominant-baseline', 'middle') // 垂直居中
            .attr('text-anchor', 'middle') // 水平居中

        rectCoordinates.push({ x: rectX, y: rectY }); // 将坐标添加到数组中

        const drag = d3.drag()
            .on('start', function () {
              d3.select(this)
                  // .style('stroke', 'red');
            })
            .on('drag', function () {
              const pt = d3.pointer(event);

              //矩形和文字同时移动
              const dragTarget=d3.select(this);
              const id=dragTarget.attr('id')
              const rect=d3.select('#myRect'+id.substring(id.length-1))
              const text=d3.select('#myText'+id.substring(id.length-1))

              rect.attr('x', pt[0] - rectWidth*rootWidth/2)
                  .attr('y', pt[1] - rectHeight*rootHeight/2)
              text.attr('x', pt[0])
                  .attr('y', pt[1])
            })
            .on('end', function () {
              const curX = parseFloat(d3.select(this).attr('x'));
              const curY = parseFloat(d3.select(this).attr('y'));
              const originX=rectCoordinates[i].x
              const originY=rectCoordinates[i].y

              if ((curX+rectWidth*rootWidth) < blockLeft || curX > blockRight || (curY+rectHeight*rootHeight) < blockTop || curY > blockBottom) {
                // 位置不匹配，恢复至初始位置
                rect.attr('x', originX)
                    .attr('y', originY)
                    // .style('stroke', 'blue');
                text.attr('x', textX)
                    .attr('y', textY);
              } else {
                d3.select(this)
                    // .style('stroke', 'blue')
              }
            });

        rect.call(drag);
      }
    },
  },
};
</script>

<style scoped>
.draggable-square-container {
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: -1;
  top: 0;
  left: 0;
  pointer-events: none;
}

/deep/.draggable-rect {
  pointer-events: auto; /* 矩形块接收鼠标事件 */
}

</style>

