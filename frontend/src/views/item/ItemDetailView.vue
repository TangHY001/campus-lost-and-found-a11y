<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { describeError } from '@/api/feedback'
import { getItem, type PublicItem } from '@/api/items'
import { CATEGORY_LABELS, ITEM_TYPE_LABELS } from '@/types/domain'

const route = useRoute()
const item = ref<PublicItem>()
const errorMessage = ref('')
watch(
  () => route.params.itemId,
  async (id, _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    item.value = undefined
    errorMessage.value = ''
    try {
      const result = await getItem(String(id))
      if (active) item.value = result
    } catch (error) {
      if (active) errorMessage.value = describeError(error)
    }
  },
  { immediate: true },
)
</script>

<template>
  <section>
    <RouterLink :to="{ name: 'items' }">返回物品列表</RouterLink>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <article v-else-if="item">
      <h1>{{ item.title }}</h1>
      <dl>
        <dt>类型</dt>
        <dd>{{ ITEM_TYPE_LABELS[item.type] }}</dd>
        <dt>类别</dt>
        <dd>{{ CATEGORY_LABELS[item.category] }}</dd>
        <dt>发生地点</dt>
        <dd>{{ item.location }}</dd>
        <dt>发生日期</dt>
        <dd>{{ item.occurredDate }}</dd>
        <dt>发布人</dt>
        <dd>{{ item.publisher.nickname }}</dd>
      </dl>
      <h2>物品描述</h2>
      <p class="description">{{ item.description }}</p>
      <div class="images">
        <img
          v-for="(image, index) in item.images"
          :key="image.id"
          :src="image.url"
          :alt="`${item.title} 的物品图片 ${index + 1}`"
        />
      </div>
    </article>
    <p v-else role="status">正在加载详情…</p>
  </section>
</template>

<style scoped>
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 16px;
}
dd {
  margin: 0;
}
.description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
img {
  max-width: 100%;
  width: 320px;
  max-height: 320px;
  object-fit: contain;
}
</style>
