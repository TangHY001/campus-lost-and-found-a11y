<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { describeError } from '@/api/feedback'
import { ApiError, http } from '@/api/http'
import { changeEmail, changePassword, sendChangeEmailCode, updateProfile } from '@/api/me'
import { useAuthStore } from '@/stores/auth'
import type { Me } from '@/types/domain'
import { textLength } from '@/utils/text'

// FR-03 修改密码、FR-06 本人资料。学号、姓名、校园卡号不可修改；改手机号或邮箱会撤回已给出的对应授权

const auth = useAuthStore()
const router = useRouter()
const me = computed(() => auth.me as Me)

/** 版本冲突说明资料已在别处被改过：重新读取最新资料，再提示用户。 */
async function handleError(error: unknown, setMessage: (message: string) => void) {
  if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
    await auth.reload().catch(() => undefined)
    setMessage('资料已在其他地方被修改，已刷新为最新内容，请确认后重试')
    return
  }
  setMessage(describeError(error))
}

// ---------- 基本资料 ----------
const profileFormRef = ref<FormInstance>()
const profileForm = reactive({ nickname: '', phone: '' })
const profileSaving = ref(false)
const profileError = ref('')

watch(
  me,
  (value) => {
    if (value) {
      profileForm.nickname = value.nickname
      profileForm.phone = value.phone ?? ''
    }
  },
  { immediate: true },
)

const profileRules: FormRules<typeof profileForm> = {
  nickname: [
    {
      validator: (_rule, value: string, callback) => {
        const length = textLength(value)
        return length >= 1 && length <= 30 ? callback() : callback(new Error('昵称为 1～30 个字符'))
      },
      trigger: 'blur',
    },
  ],
  phone: [
    {
      pattern: /^\+?[0-9 -]{6,20}$/,
      message: '手机号格式不正确',
      trigger: 'blur',
    },
  ],
}

async function saveProfile() {
  if (profileSaving.value || !(await profileFormRef.value?.validate().catch(() => false))) {
    return
  }
  const nickname = profileForm.nickname.trim()
  const phone = profileForm.phone.trim() || null
  const patch: { expectedVersion: number; nickname?: string; phone?: string | null } = {
    expectedVersion: me.value.version,
  }
  if (nickname !== me.value.nickname) {
    patch.nickname = nickname
  }
  if (phone !== me.value.phone) {
    patch.phone = phone
  }
  if (patch.nickname === undefined && patch.phone === undefined) {
    ElMessage.info('没有需要保存的修改')
    return
  }
  profileSaving.value = true
  profileError.value = ''
  try {
    auth.setMe(await updateProfile(patch))
    ElMessage.success('资料已保存')
  } catch (error) {
    await handleError(error, (message) => (profileError.value = message))
  } finally {
    profileSaving.value = false
  }
}

// ---------- 修改邮箱 ----------
const emailFormRef = ref<FormInstance>()
const emailForm = reactive({ email: '', emailCode: '' })
const emailSending = ref(false)
const emailSaving = ref(false)
const emailError = ref('')
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const emailRules: FormRules<typeof emailForm> = {
  email: [
    { required: true, message: '请输入新邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  emailCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^[0-9]{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
}

function startCountdown(seconds: number) {
  countdown.value = seconds
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

async function sendEmailCode() {
  if (emailSending.value || countdown.value > 0) {
    return
  }
  const valid = await emailFormRef.value
    ?.validateField('email')
    .then(() => true)
    .catch(() => false)
  if (!valid) {
    return
  }
  emailSending.value = true
  emailError.value = ''
  try {
    const result = await sendChangeEmailCode(emailForm.email.trim())
    startCountdown(result.retryAfterSeconds)
    ElMessage.success('验证码已发送到新邮箱（模拟发送）')
  } catch (error) {
    emailError.value = describeError(error)
  } finally {
    emailSending.value = false
  }
}

async function saveEmail() {
  if (emailSaving.value || !(await emailFormRef.value?.validate().catch(() => false))) {
    return
  }
  emailSaving.value = true
  emailError.value = ''
  try {
    auth.setMe(
      await changeEmail({
        expectedVersion: me.value.version,
        email: emailForm.email.trim(),
        emailCode: emailForm.emailCode.trim(),
      }),
    )
    emailFormRef.value?.resetFields()
    ElMessage.success('邮箱已修改')
  } catch (error) {
    await handleError(error, (message) => (emailError.value = message))
  } finally {
    emailSaving.value = false
  }
}

// ---------- 修改密码 ----------
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordSaving = ref(false)
const passwordError = ref('')

const passwordRules: FormRules<typeof passwordForm> = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*[0-9]).{8,64}$/,
      message: '新密码为 8～64 位，且同时包含字母和数字',
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) =>
        value === passwordForm.newPassword
          ? callback()
          : callback(new Error('两次输入的新密码不一致')),
      trigger: 'blur',
    },
  ],
}

async function savePassword() {
  if (passwordSaving.value || !(await passwordFormRef.value?.validate().catch(() => false))) {
    return
  }
  passwordSaving.value = true
  passwordError.value = ''
  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })
    // 后端已让所有会话失效并退出当前会话
    auth.clear()
    await http.refreshCsrfToken().catch(() => undefined)
    ElMessage.success('密码已修改，请用新密码重新登录')
    await router.push({ name: 'login' })
  } catch (error) {
    passwordError.value = describeError(error)
  } finally {
    passwordSaving.value = false
  }
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <!-- 改密成功后登录状态立即清空，页面在跳转前不再渲染私有资料 -->
  <section v-if="auth.me" class="profile-page">
    <h1>个人资料</h1>

    <el-card shadow="never" class="card">
      <template #header>身份信息</template>
      <el-descriptions :column="1" border>
        <template v-if="me.role === 'STUDENT'">
          <el-descriptions-item label="学号">{{ me.studentId }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ me.realName }}</el-descriptions-item>
          <el-descriptions-item label="校园卡号">{{ me.campusCardNo }}</el-descriptions-item>
        </template>
        <el-descriptions-item v-else label="账号类型">管理员</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ me.email }}</el-descriptions-item>
      </el-descriptions>
      <p class="hint">学号、姓名和校园卡号绑定后不能修改。</p>
    </el-card>

    <el-card shadow="never" class="card">
      <template #header>基本资料</template>
      <el-alert
        v-if="profileError"
        :title="profileError"
        type="error"
        show-icon
        :closable="false"
        class="error"
      />
      <el-form
        ref="profileFormRef"
        :model="profileForm"
        :rules="profileRules"
        label-position="top"
        hide-required-asterisk
        @submit.prevent="saveProfile"
      >
        <el-form-item label="昵称（公开显示）" prop="nickname">
          <el-input v-model="profileForm.nickname" />
        </el-form-item>
        <el-form-item label="手机号（选填，不公开）" prop="phone">
          <el-input v-model="profileForm.phone" maxlength="20" placeholder="不填则清空" />
        </el-form-item>
        <p class="hint">
          修改手机号后，之前授权给认领对方查看的手机号会自动撤回，需要时请重新授权。
        </p>
        <el-button type="primary" native-type="submit" :loading="profileSaving">保存</el-button>
      </el-form>
    </el-card>

    <el-card shadow="never" class="card">
      <template #header>修改邮箱</template>
      <el-alert
        v-if="emailError"
        :title="emailError"
        type="error"
        show-icon
        :closable="false"
        class="error"
      />
      <el-form
        ref="emailFormRef"
        :model="emailForm"
        :rules="emailRules"
        label-position="top"
        hide-required-asterisk
        @submit.prevent="saveEmail"
      >
        <el-form-item prop="email">
          <template #label>新邮箱<span class="required-mark" aria-hidden="true">*</span></template>
          <el-input
            v-model="emailForm.email"
            maxlength="254"
            autocomplete="email"
            aria-required="true"
          />
        </el-form-item>
        <el-form-item prop="emailCode">
          <template #label>验证码<span class="required-mark" aria-hidden="true">*</span></template>
          <div class="code-row">
            <el-input
              v-model="emailForm.emailCode"
              maxlength="6"
              inputmode="numeric"
              aria-required="true"
            />
            <el-button :loading="emailSending" :disabled="countdown > 0" @click="sendEmailCode">
              {{ countdown > 0 ? `${countdown} 秒后重发` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <p class="hint">
          验证码发到新邮箱（演示环境为模拟发送，见
          runtime/dev-mail）。修改后，之前授权的邮箱会自动撤回。
        </p>
        <el-button type="primary" native-type="submit" :loading="emailSaving">确认修改</el-button>
      </el-form>
    </el-card>

    <el-card shadow="never" class="card">
      <template #header>修改密码</template>
      <el-alert
        v-if="passwordError"
        :title="passwordError"
        type="error"
        show-icon
        :closable="false"
        class="error"
      />
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-position="top"
        hide-required-asterisk
        @submit.prevent="savePassword"
      >
        <el-form-item prop="oldPassword">
          <template #label>原密码<span class="required-mark" aria-hidden="true">*</span></template>
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            show-password
            maxlength="64"
            autocomplete="current-password"
            aria-required="true"
          />
        </el-form-item>
        <el-form-item prop="newPassword">
          <template #label>新密码<span class="required-mark" aria-hidden="true">*</span></template>
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            maxlength="64"
            autocomplete="new-password"
            aria-required="true"
          />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <template #label
            >确认新密码<span class="required-mark" aria-hidden="true">*</span></template
          >
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            maxlength="64"
            autocomplete="new-password"
            aria-required="true"
          />
        </el-form-item>
        <p class="hint">修改成功后，所有设备上的登录都会失效，需要用新密码重新登录。</p>
        <el-button type="primary" native-type="submit" :loading="passwordSaving">
          修改密码
        </el-button>
      </el-form>
    </el-card>
  </section>
</template>

<style scoped>
.profile-page {
  max-width: 640px;
}

h1 {
  margin: 0 0 16px;
  font-size: 22px;
}

.card {
  margin-bottom: 16px;
}

.error {
  margin-bottom: 16px;
}

.hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-row .el-button {
  flex-shrink: 0;
  width: 112px;
}
</style>
