<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'

import { describeError } from '@/api/feedback'
import {
  createItem,
  editItem,
  getOwnItem,
  type CreateItemRequest,
  type ItemImage,
} from '@/api/items'
import ItemImagePicker from '@/components/ItemImagePicker.vue'
import {
  CATEGORY_LABELS,
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  type ItemStatus,
} from '@/types/domain'
import { textLength } from '@/utils/text'

const initialForm: CreateItemRequest = {
  type: 'LOST',
  category: 'DOCUMENT',
  title: '',
  location: '',
  occurredDate: '',
  description: '',
}
const form = reactive({ ...initialForm })
const route = useRoute()
const editing = computed(() => route.name === 'item-edit')
const loading = ref(false)
const loadFailed = ref(false)
const expectedVersion = ref(1)
const pictures = ref<ItemImage[]>([])
const uploading = ref(false)
const submitting = ref(false)
const publishedId = ref('')
const publishedStatus = ref<ItemStatus>('PENDING_REVIEW')
const errorMessage = ref('')
let attempt: { body: string; key: string } | undefined

watch(
  () => route.fullPath,
  async (_, __, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    Object.assign(form, initialForm)
    pictures.value = []
    publishedId.value = ''
    errorMessage.value = ''
    loadFailed.value = false
    loading.value = false
    attempt = undefined
    if (!editing.value) return
    loading.value = true
    try {
      const item = await getOwnItem(String(route.params.itemId))
      if (!active) return
      Object.assign(form, {
        type: item.type,
        category: item.category,
        title: item.title,
        location: item.location,
        occurredDate: item.occurredDate,
        description: item.description,
      })
      expectedVersion.value = item.version
      pictures.value = item.images
      if (!['PENDING_REVIEW', 'RETURNED', 'PUBLISHED'].includes(item.status)) {
        loadFailed.value = true
        errorMessage.value = '这条信息已经下架或归档，不能修改'
      }
    } catch (error) {
      if (active) {
        errorMessage.value = describeError(error)
        loadFailed.value = true
      }
    } finally {
      if (active) loading.value = false
    }
  },
  { immediate: true },
)

async function submit() {
  if (submitting.value || uploading.value || loading.value || loadFailed.value || publishedId.value)
    return
  errorMessage.value = ''

  if (textLength(form.title) < 1 || textLength(form.title) > 50) {
    errorMessage.value = '标题需填写 1～50 字'
    return
  }
  if (textLength(form.location) < 1 || textLength(form.location) > 50) {
    errorMessage.value = '地点需填写 1～50 字'
    return
  }
  if (textLength(form.description) < 10 || textLength(form.description) > 500) {
    errorMessage.value = '描述需填写 10～500 字'
    return
  }

  submitting.value = true
  try {
    const changes = {
      category: form.category,
      occurredDate: form.occurredDate,
      title: form.title.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      imageIds: pictures.value.map((image) => image.id),
    }
    const payload = { type: form.type, ...changes }
    const body = JSON.stringify(payload)
    if (attempt?.body !== body) attempt = { body, key: crypto.randomUUID() }
    const item = editing.value
      ? await editItem(String(route.params.itemId), {
          ...changes,
          expectedVersion: expectedVersion.value,
        })
      : await createItem(payload, attempt.key)
    publishedId.value = item.id
    publishedStatus.value = item.status
    const message = item.status === 'PENDING_REVIEW' ? '已提交，等待审核' : '已提交'
    void ElMessageBox.alert(message, '提交成功', { confirmButtonText: '知道了' }).catch(() => {})
  } catch (error) {
    errorMessage.value = describeError(error)
  } finally {
    submitting.value = false
  }
}

function startNewItem() {
  Object.assign(form, initialForm)
  attempt = undefined
  pictures.value = []
  publishedId.value = ''
}
</script>

<template>
  <section class="publish-page">
    <h1>{{ editing ? '修改物品信息' : '发布物品信息' }}</h1>
    <p v-if="loading" role="status">正在加载原信息…</p>
    <el-alert v-if="loadFailed" :title="errorMessage" type="error" :closable="false" />
    <el-alert
      v-if="publishedId"
      :title="publishedStatus === 'PENDING_REVIEW' ? '已提交，等待审核' : '已提交'"
      type="success"
      :closable="false"
    >
      <p>物品编号 {{ publishedId }} · {{ ITEM_STATUS_LABELS[publishedStatus] }}</p>
      <div class="success-actions">
        <el-button type="primary" disabled>已提交</el-button>
        <RouterLink class="published-link" :to="{ name: 'my-items' }">查看我的发布</RouterLink>
        <el-button v-if="!editing" @click="startNewItem">发布另一条</el-button>
      </div>
    </el-alert>
    <form v-else-if="!loading && !loadFailed" @submit.prevent="submit">
      <fieldset :disabled="submitting || uploading">
        <p class="form-hint">文字和日期为必填，图片可选。请勿填写手机号、邮箱或社交账号。</p>
        <label>
          信息类型
          <el-select
            v-model="form.type"
            aria-label="信息类型"
            aria-required="true"
            :disabled="editing || submitting || uploading"
          >
            <el-option
              v-for="(label, value) in ITEM_TYPE_LABELS"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </label>
        <label>
          物品类别
          <el-select v-model="form.category" aria-label="物品类别" aria-required="true">
            <el-option
              v-for="(label, value) in CATEGORY_LABELS"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </label>
        <label for="item-title">标题（1～50 字）</label>
        <el-input id="item-title" v-model="form.title" aria-required="true" />
        <label for="item-location">发生地点（1～50 字）</label>
        <el-input id="item-location" v-model="form.location" aria-required="true" />
        <label for="item-date">发生日期</label>
        <input id="item-date" v-model="form.occurredDate" type="date" required />
        <label for="item-description">物品描述（10～500 字）</label>
        <el-input
          id="item-description"
          v-model="form.description"
          type="textarea"
          :rows="5"
          aria-required="true"
        />
        <ItemImagePicker v-model="pictures" :disabled="submitting" @busy="uploading = $event" />
      </fieldset>
      <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
      <el-button
        native-type="submit"
        type="primary"
        :loading="submitting"
        :disabled="submitting || uploading"
      >
        提交审核
      </el-button>
    </form>
  </section>
</template>

<style scoped>
.publish-page {
  max-width: 640px;
}
form,
fieldset {
  display: grid;
  gap: 12px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
form label {
  font-weight: 600;
}
form label .el-select {
  display: block;
  margin-top: 8px;
}
form .el-button {
  justify-self: start;
}
.form-hint {
  margin: 0;
}
.success-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.published-link {
  color: var(--el-color-primary);
  text-decoration: underline;
}
input[type='date'] {
  min-height: 32px;
  min-width: 0;
  padding: 4px 8px;
  font: inherit;
}
</style>
