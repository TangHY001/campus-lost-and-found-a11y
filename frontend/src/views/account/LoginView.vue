<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'

import { describeError } from '@/api/feedback'
import { useAuthStore } from '@/stores/auth'
import { safeRedirect } from '@/utils/redirect'

// FR-02 登录：学号、校园卡号或管理员账号均可登录，邮箱不能作为账号

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const formRef = ref<FormInstance>()
// 从注册页跳过来时带上刚注册的学号
const form = reactive({
  account: typeof route.query.account === 'string' ? route.query.account : '',
  password: '',
})
const submitting = ref(false)
const errorMessage = ref('')

const rules: FormRules<typeof form> = {
  account: [{ required: true, message: '请输入学号、校园卡号或管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submit() {
  if (submitting.value || !(await formRef.value?.validate().catch(() => false))) {
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    await auth.login({ account: form.account.trim(), password: form.password })
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    errorMessage.value = describeError(error)
    form.password = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="login-page">
    <el-card shadow="never" class="login-card">
      <h1>登录</h1>
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
        class="error"
      />
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        hide-required-asterisk
        @submit.prevent="submit"
      >
        <el-form-item prop="account">
          <template #label>账号<span class="required-mark" aria-hidden="true">*</span></template>
          <el-input
            v-model="form.account"
            placeholder="学号 / 校园卡号"
            autocomplete="username"
            aria-required="true"
            maxlength="32"
          />
        </el-form-item>
        <el-form-item prop="password">
          <template #label>密码<span class="required-mark" aria-hidden="true">*</span></template>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
            aria-required="true"
            maxlength="64"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="submitting" class="submit">
          登录
        </el-button>
      </el-form>
      <p class="switch">还没有账号？<RouterLink :to="{ name: 'register' }">去注册</RouterLink></p>
    </el-card>
  </section>
</template>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

h1 {
  margin: 0 0 20px;
  font-size: 22px;
}

.error {
  margin-bottom: 16px;
}

.submit {
  width: 100%;
  height: 40px;
}

.switch {
  margin: 16px 0 0;
  text-align: center;
  color: var(--app-text-secondary);
}

.switch a {
  color: var(--el-color-primary);
}

@media (max-width: 640px) {
  .login-page {
    padding-top: 8px;
  }
}
</style>
