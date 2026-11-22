<script setup lang="ts">
import { routeAnnouncement } from '@/utils/a11y'
</script>

<template>
  <!-- 键盘用户的第一个可聚焦元素：直接跳到主内容，不必逐页 Tab 过导航 -->
  <a class="skip-link" href="#main-content">跳到主内容</a>
  <RouterView />
  <!-- 路由切换播报：视觉隐藏，屏幕阅读器会朗读“某页已加载” -->
  <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
    {{ routeAnnouncement }}
  </p>
</template>
