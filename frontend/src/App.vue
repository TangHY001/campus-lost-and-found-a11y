<script setup lang="ts">
import { computed } from 'vue'

import ReadAloudButton from '@/components/ReadAloudButton.vue'
import { routeAnnouncement } from '@/utils/a11y'

/**
 * 朗读按钮只在开发服务器或地址带 ?read=1 时出现：
 * 它是录制演示视频的辅助工具（页面自朗读），不属于产品功能，构建产物里不会加载。
 */
const showReadAloud = computed(
  () => import.meta.env.DEV || new URLSearchParams(window.location.search).has('read'),
)
</script>

<template>
  <!-- 键盘用户的第一个可聚焦元素：直接跳到主内容，不必逐页 Tab 过导航 -->
  <a class="skip-link" href="#main-content">跳到主内容</a>
  <RouterView />
  <!-- 路由切换播报：视觉隐藏，屏幕阅读器会朗读“某页已加载” -->
  <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
    {{ routeAnnouncement }}
  </p>
  <!-- 演示用：一键朗读本页并高亮当前段落，方便录屏对照 -->
  <ReadAloudButton v-if="showReadAloud" />
</template>
