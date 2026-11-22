<script setup lang="ts">
import { ref } from 'vue'
import { describeError } from '@/api/feedback'
import { uploadImage, type ItemImage } from '@/api/items'

const images = defineModel<ItemImage[]>({ required: true })
const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const uploading = ref(false)
const errorMessage = ref('')

async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (props.disabled || uploading.value || !files.length) return
  errorMessage.value = ''
  if (images.value.length + files.length > 3) {
    errorMessage.value = '每条信息最多三张图片，请减少选择的数量'
    return
  }
  if (files.some((file) => file.size > 2097152 || file.size === 0)) {
    errorMessage.value = '图片不能为空，且每张不能超过 2 MB'
    return
  }
  uploading.value = true
  emit('busy', true)
  try {
    // 逐张上传，成功的图片保留；失败时可以重选，不清空表单。
    for (const file of files) images.value = [...images.value, await uploadImage(file)]
  } catch (error) {
    errorMessage.value = describeError(error)
  } finally {
    uploading.value = false
    emit('busy', false)
  }
}
</script>

<template>
  <div class="image-picker">
    <label for="item-images">图片（可选，最多三张 JPG/PNG，每张不超过 2 MB）</label>
    <p class="hint">请遮挡姓名、卡号等隐私信息，图片与文字一起等待审核。</p>
    <div class="previews">
      <div v-for="(image, index) in images" :key="image.id">
        <img :src="image.url" :alt="`物品图片 ${index + 1}`" />
        <el-button
          :disabled="disabled || uploading"
          @click="images = images.filter((item) => item.id !== image.id)"
          >移除</el-button
        >
      </div>
    </div>
    <input
      id="item-images"
      type="file"
      accept="image/jpeg,image/png"
      multiple
      aria-label="选择物品图片"
      :disabled="disabled || uploading || images.length >= 3"
      @change="choose"
    />
    <p v-if="uploading" role="status">正在上传图片，请稍候…</p>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" />
  </div>
</template>

<style scoped>
.previews {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.previews > div {
  display: grid;
  gap: 6px;
  max-width: 100%;
}
img {
  width: 140px;
  max-width: 100%;
  height: 110px;
  object-fit: contain;
  border: 1px solid var(--app-border);
}
input[type='file'] {
  max-width: 100%;
}
.hint {
  color: var(--app-text-secondary);
  font-size: 14px;
}
</style>
