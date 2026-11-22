<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { describeError } from '@/api/feedback'
import { listItems, type ItemFilters, type PublicItem } from '@/api/items'
import { CATEGORY_LABELS, ITEM_TYPE_LABELS } from '@/types/domain'

const emptyFilters: ItemFilters = {
  keyword: '',
  type: '',
  category: '',
  location: '',
  dateFrom: '',
  dateTo: '',
}
const filters = reactive<ItemFilters>({ ...emptyFilters })
let appliedFilters: ItemFilters = {}
const items = ref<PublicItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const errorMessage = ref('')

async function load(nextPage: number) {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await listItems(nextPage, appliedFilters)
    items.value = result.items
    total.value = result.total
    page.value = result.page
  } catch (error) {
    errorMessage.value = describeError(error)
  } finally {
    loading.value = false
  }
}

function search() {
  if (loading.value) return
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    errorMessage.value = '结束日期不能早于起始日期，请调整日期后再搜索。'
    return
  }
  appliedFilters = { ...filters }
  void load(1)
}

function resetFilters() {
  if (loading.value) return
  Object.assign(filters, emptyFilters)
  appliedFilters = {}
  void load(1)
}

/** 搜索结果摘要：列表异步刷新，读屏用户需要一句话知道“搜到了多少条”。 */
const resultSummary = computed(() => {
  if (loading.value || errorMessage.value) return ''
  if (!items.value.length) return '没有符合条件的物品'
  return `第 ${page.value} 页，共 ${total.value} 条物品，本页 ${items.value.length} 条`
})

onMounted(() => load(1))
</script>

<template>
  <section>
    <h1>浏览物品</h1>
    <p class="list-hint">这里只展示审核通过的物品。刚发布的信息可在「我的发布」中查看。</p>
    <form class="filters" @submit.prevent="search">
      <label>
        关键词
        <el-input v-model="filters.keyword" aria-label="关键词" placeholder="搜索标题或描述" />
      </label>
      <label>
        类型
        <el-select v-model="filters.type" aria-label="类型">
          <el-option label="全部" value="" />
          <el-option
            v-for="(label, value) in ITEM_TYPE_LABELS"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
      </label>
      <label>
        类别
        <el-select v-model="filters.category" aria-label="类别">
          <el-option label="全部" value="" />
          <el-option
            v-for="(label, value) in CATEGORY_LABELS"
            :key="value"
            :label="label"
            :value="value"
          />
        </el-select>
      </label>
      <label>地点 <el-input v-model="filters.location" aria-label="地点" /></label>
      <label>起始日期 <input v-model="filters.dateFrom" type="date" /></label>
      <label>结束日期 <input v-model="filters.dateTo" type="date" /></label>
      <el-button native-type="submit" type="primary" :loading="loading">搜索</el-button>
      <el-button native-type="button" :disabled="loading" @click="resetFilters">重置筛选</el-button>
    </form>
    <!-- 结果摘要播报：搜索、重置、翻页后告诉读屏用户结果数量变了。
         必须放在 v-if/v-else-if 链之前，否则会打断 v-else-if 的相邻关系 -->
    <p class="visually-hidden" role="status" aria-live="polite">{{ resultSummary }}</p>
    <p v-if="loading" role="status">正在加载物品…</p>
    <el-alert v-else-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
    <el-empty v-else-if="items.length === 0" description="没有符合条件的公开物品" />
    <template v-else>
      <ul class="items">
        <li v-for="item in items" :key="item.id">
          <RouterLink :to="{ name: 'item-detail', params: { itemId: item.id } }">{{
            item.title
          }}</RouterLink>
          <p>
            {{ ITEM_TYPE_LABELS[item.type] }} · {{ CATEGORY_LABELS[item.category] }} ·
            {{ item.location }} · {{ item.occurredDate }}
          </p>
        </li>
      </ul>
      <nav v-if="total > 10" aria-label="物品列表分页">
        <el-pagination
          :current-page="page"
          :total="total"
          :page-size="10"
          layout="prev, pager, next"
          @current-change="load"
        />
      </nav>
    </template>
  </section>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
}
.filters label {
  display: grid;
  gap: 4px;
  width: min(100%, 160px);
}
.filters input[type='date'] {
  width: 100%;
  min-width: 0;
  min-height: 32px;
  font: inherit;
}
.list-hint {
  margin-top: 0;
}
.items {
  padding: 0;
  list-style: none;
}
.items li {
  overflow-wrap: anywhere;
  padding: 12px 0;
  border-bottom: 1px solid var(--app-border);
}
.items li p {
  margin-bottom: 0;
  color: var(--app-text-secondary);
}
@media (max-width: 480px) {
  .filters label {
    width: calc((100% - 12px) / 2);
    min-width: 0;
  }
}
</style>
