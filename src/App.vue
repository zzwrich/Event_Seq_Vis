<script setup>
  import operBlock from "./components/OperBlock.vue"
  import operArea from "./components/OperArea/OperArea.vue"
  import filterArea from "./components/MainArea/FilterArea.vue"
  import resultArea from "./components/ResultAtea/ResultArea.vue"

</script>

<template>
	<div class="grid-container">
		<div class="grid-item block1">
      <filter-area />
		</div>
		<div class="grid-item block3">
      <oper-area />
		</div>
		<div class="grid-item block4">
      <result-area />
		</div>
<!--		<div class="grid-item block5">-->
<!--      <oper-block />-->
<!--		</div>-->
	</div>
</template>

<style scoped>

</style>