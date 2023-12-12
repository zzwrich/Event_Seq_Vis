<template>
  <h1>可视分析系统</h1>
  <div>
    {{ msg }}
  </div>

</template>

<script>
import axios from 'axios'
export default {
  name: 'Hello',
  data () {
    return {
      msg: '初始化'
    }
  },
  methods: {
    getMessage () {
      const path = 'http://127.0.0.1:5000/hello'

      axios.get(path)
          .then(res => {
            this.msg = res.data['test']
          }).catch(error => {
        console.error(error)
      })
    }
  },
  created () {
    // this.getMessage()
  }
}
</script>

<style scoped>

</style>

