<template>
  <!-- 这个页面不在学生端/管理端布局里，自己提供 main 地标，跳过导航链接才有落点 -->
  <main id="main-content" tabindex="-1" class="not-found">
    <h1>页面不存在</h1>
    <el-result icon="warning" sub-title="链接可能有误，或内容已不再公开">
      <template #extra>
        <RouterLink to="/">
          <el-button type="primary">返回首页</el-button>
        </RouterLink>
      </template>
    </el-result>
  </main>
</template>

<style scoped>
.not-found h1 {
  margin: 24px 0 0;
  font-size: 22px;
}
</style>
