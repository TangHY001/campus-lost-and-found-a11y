<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import { showError } from '@/api/feedback'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

async function logout() {
  try {
    await auth.logout()
  } catch (error) {
    showError(error)
  }
  await router.push({ name: 'home' })
}
</script>

<template>
  <div class="admin-layout">
    <aside class="sidebar" aria-label="管理侧栏">
      <RouterLink to="/admin" class="brand">管理后台</RouterLink>
      <nav class="menu" aria-label="管理导航">
        <RouterLink to="/admin" :aria-current="route.name === 'admin-home' ? 'page' : undefined"
          >概览</RouterLink
        >
        <!-- 管理模块负责人在这里加入口，例如 /admin/items 待审核列表 -->
      </nav>
      <div class="sidebar-footer">
        <span>{{ auth.me?.nickname }}</span>
        <RouterLink to="/">返回学生端</RouterLink>
        <el-button link @click="logout">退出</el-button>
      </div>
    </aside>
    <main id="main-content" tabindex="-1" class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 200px;
  flex-shrink: 0;
  padding: 20px 16px;
  background: var(--app-surface);
  border-right: 1px solid var(--app-border);
}

.brand {
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.menu a {
  padding: 8px 12px;
  border-radius: 6px;
}

.menu a.router-link-exact-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--app-text-secondary);
}

/* 管理端以表格为主，内容区留出横向空间；表格过宽时由表格自身横向滚动 */
.content {
  flex: 1;
  min-width: 0;
  padding: 24px;
}

/* 手机窄屏：侧边栏改为顶部栏 */
@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
  }

  .sidebar {
    width: auto;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-right: none;
    border-bottom: 1px solid var(--app-border);
    padding: 12px 16px;
  }

  .menu {
    flex-direction: row;
    flex-basis: 100%;
    order: 3;
  }

  .sidebar-footer {
    flex-direction: row;
    gap: 12px;
    margin-left: auto;
  }

  .content {
    padding: 16px;
  }
}
</style>
