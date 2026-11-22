import { createRouter, createWebHistory } from 'vue-router'

import StudentLayout from '@/layouts/StudentLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { announce, focusMainContent } from '@/utils/a11y'

declare module 'vue-router' {
  interface RouteMeta {
    /** 需要登录才能访问。 */
    requiresAuth?: boolean
    /** 需要管理员角色。 */
    requiresAdmin?: boolean
    /** 页面名：用于 document.title，也是路由变化时朗读给屏幕阅读器的内容。 */
    title?: string
  }
}

// 页面路由清单见 docs/开发实施手册.md 9.1；各负责人在对应布局的 children 中添加自己的页面
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: StudentLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '首页' },
        },
        {
          path: 'items',
          name: 'items',
          component: () => import('@/views/item/ItemListView.vue'),
          meta: { title: '浏览物品' },
        },
        {
          path: 'items/new',
          name: 'item-publish',
          component: () => import('@/views/item/ItemPublishView.vue'),
          meta: { requiresAuth: true, title: '发布物品信息' },
        },
        {
          path: 'me/items',
          name: 'my-items',
          component: () => import('@/views/item/MyItemsView.vue'),
          meta: { requiresAuth: true, title: '我的发布' },
        },
        {
          path: 'me/items/:itemId/edit',
          name: 'item-edit',
          component: () => import('@/views/item/ItemPublishView.vue'),
          meta: { requiresAuth: true, title: '修改物品信息' },
        },
        {
          path: 'items/:itemId',
          name: 'item-detail',
          component: () => import('@/views/item/ItemDetailView.vue'),
          meta: { title: '物品详情' },
        },
        {
          path: 'login',
          name: 'login',
          component: () => import('@/views/account/LoginView.vue'),
          meta: { title: '登录' },
        },
        {
          path: 'register',
          name: 'register',
          component: () => import('@/views/account/RegisterView.vue'),
          meta: { title: '注册' },
        },
        {
          path: 'me/profile',
          name: 'profile',
          component: () => import('@/views/personal/ProfileView.vue'),
          meta: { requiresAuth: true, title: '个人资料' },
        },
      ],
    },
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          name: 'admin-home',
          component: () => import('@/views/admin/AdminHomeView.vue'),
          meta: { title: '管理后台' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
})

// 路由守卫只改善体验，真正的权限检查在后端
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  try {
    await auth.ensureLoaded()
  } catch {
    // 后端暂时连不上时按未登录处理，由页面自己展示错误
  }
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if ((to.name === 'login' || to.name === 'register') && auth.isLoggedIn) {
    return { name: 'home' }
  }
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'home' }
  }
})

/**
 * 单页应用换页时浏览器不会自动更新标题、也不会移动焦点：
 * 屏幕阅读器用户听不到“换页了”，键盘用户还得从头 Tab 一遍导航。
 * 这里统一补上：改标题 → 播报页面名 → 把焦点交给主内容区。
 */
router.afterEach((to) => {
  const pageName = to.meta.title ?? '校园失物招领'
  document.title = pageName ? `${pageName} · 校园失物招领` : '校园失物招领'
  announce(`${pageName}页面已加载`)
  // 等新页面渲染完再移焦点，否则焦点会落在旧节点上
  requestAnimationFrame(() => focusMainContent())
})

export default router
