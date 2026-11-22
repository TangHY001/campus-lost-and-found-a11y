# 校园失物招领系统 · 视障友好适配版

> 软件工程课程项目 + 「揭榜任务二：视障友好适配」成果仓库
>
> 在原有课程项目上**只做无障碍适配，不新增任何业务功能**：接口、数据库、页面流程均未改变。

![Vue](https://img.shields.io/badge/Vue-3.5-42b883)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6db33f)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479a1)
![WCAG](https://img.shields.io/badge/WCAG-2.2%20AA-blue)
![Vitest](https://img.shields.io/badge/vitest-35%20passed-success)

---

## 一、这是什么

三人课程项目《校园失物招领系统》的无障碍适配版本。学生可以发布、检索失物招领信息；管理员可以审核信息。维护者负责学生端与管理端的页面导航、表单、列表与弹窗。

本仓库在原项目上做了两类事：

1. **无障碍适配**：控件名称/角色/状态、全键盘操作与焦点顺序、Windows 高对比度（强制颜色）、原有功能不中断。
2. **验证与记录**：无障碍树前后对比、全键盘端到端走查、35 项自动化测试、可复跑的采集脚本。

完整的适配说明与测试记录见 [`docs/无障碍适配说明与测试记录.md`](docs/无障碍适配说明与测试记录.md)，验收证据在 [`docs/a11y-evidence/`](docs/a11y-evidence/)。

## 二、功能概览

### 学生端

| 功能 | 说明 |
|---|---|
| 注册 / 登录 / 退出 | 学号、姓名、校园卡号须与虚拟名册一致；邮箱验证码为模拟发送 |
| 浏览与检索 | 按关键词、类型、类别、地点、日期区间筛选，分页浏览 |
| 物品详情 | 类型、类别、地点、日期、发布人、描述与图片 |
| 发布 / 修改 | 文字与日期必填、图片可选（最多三张）；修改后需重新审核 |
| 我的发布 | 查看审核状态与审核反馈，可下架 |
| 个人资料 | 修改昵称、手机号、邮箱、密码 |

### 管理端

| 功能 | 说明 |
|---|---|
| 登录与鉴权 | 管理员账号登录，路由与接口双重校验 |
| 管理后台 | 侧边栏布局与管理概览（业务页面由管理模块负责人继续扩展） |

## 三、无障碍适配（本仓库重点）

### 1. 平台口径

项目是 Vue 3 + Element Plus 的 Web 应用，既不是 Windows 桌面程序，也不是 Android 应用。适配按 **WCAG 2.2 AA / WAI-ARIA 1.2** 实施，在 **Windows + Edge** 上用屏幕阅读器同源的无障碍树验证，与任务书四条要求逐条对应：

| 任务书要求 | 本项目对应做法 | 依据 |
|---|---|---|
| ① 名称 / 角色 / 状态 | ARIA 名称、角色、状态 + 表单必填状态 | WAI-ARIA 1.2、WCAG 2.2 SC 4.1.2 |
| ② 全键盘可操作、焦点可感知 | 跳过导航、焦点可见、换页焦点落点、`aria-current` | WCAG 2.2 SC 2.1.1 / 2.4.3 / 2.4.7 |
| ③ 系统高对比度 | `@media (forced-colors: active)` 补边框与下划线 | WCAG 2.2 SC 1.4.11 |
| ④ 原有功能不中断 | 29 项既有单测 + 6 项语义断言 + 全键盘端到端走查 | 回归验证 |

### 2. 具体改动

- **跳过导航**：全站第一个可聚焦元素是「跳到主内容」，按回车把焦点交给 `<main tabindex="-1">`，不必每页 Tab 过 4~5 个导航链接。
- **换页可感知**：`document.title` 按路由更新为「浏览物品 · 校园失物招领」等；`role="status"` 播报「XX页面已加载」；焦点移到主内容区。
- **当前页可识别**：导航链接带 `aria-current="page"`，导航地标有名称（`主导航` / `管理导航`）。
- **表单**：必填星号改用 `aria-hidden` 的 span，不再进入控件名称（改前读屏念「星号 账号」）；必填字段暴露 `aria-required`；错误提示用 `role="alert"` 自动朗读。
- **列表**：搜索结果条数与页码通过 `role="status"` 播报；分页包在 `<nav aria-label="物品列表分页">` 内。
- **图片**：替代文字从「物品图片 1」改为「校园卡（测试数据）的物品图片 1」，带物品标题上下文。
- **弹窗**：下架确认框暴露 `dialog` 角色，Esc 可关闭，关闭后焦点回到触发按钮（物品已下架时交给主内容区）。
- **高对比度**：强制颜色下为卡片、输入框、下拉框、文本域、按钮、分页补 `1px solid ButtonText` 边框，链接加下划线，当前导航加 `Highlight` 描边。

### 3. 演示辅助：朗读本页按钮

用于录制演示视频：右下角「朗读本页」按钮或快捷键 `Alt+R`，从页面标题开始逐段朗读并高亮当前段落，`Esc` 停止。

- 只在 `npm run dev` 或地址带 `?read=1` 时挂载，**`npm run build` 的产物里没有它**，不构成新增业务功能。
- 它是 Web Speech API 的页面自朗读，**不是屏幕阅读器**；屏幕阅读器读取的是浏览器无障碍树，两者不混用。

## 四、目录结构

```
campus-lost-and-found/
├── backend/                 Spring Boot 4 + MyBatis，统一响应、Session+CSRF、配置校验
│   ├── config/              本机私有配置（application.yml 已忽略，示例见 .example）
│   └── src/main/java/...    分模块：account / item / admin / common
├── frontend/                Vue 3 + Vite + Element Plus
│   └── src/
│       ├── components/      StatusTag、ItemImagePicker、ReadAloudButton（演示用）
│       ├── layouts/         学生端 / 管理端布局（跳转链接、导航地标、aria-current）
│       ├── router/          路由表、标题与焦点、权限守卫
│       ├── utils/a11y.ts    路由播报与焦点落点
│       ├── views/           登录、注册、列表、详情、发布、我的发布、资料、管理
│       └── __tests__/       vitest：含 a11y.spec.ts 无障碍语义断言
├── database/                建库、迁移、虚拟名册种子数据
├── docs/                    开发实施手册、接口文档、无障碍适配说明与证据
└── runtime/                 本地运行产物（上传文件、模拟收件箱），不入库
```

## 五、本地运行

前置：JDK 21、MySQL 8.0、Node.js 22.18+/24.12+。完整步骤见 [`docs/开发实施手册.md`](docs/开发实施手册.md)，最短路径：

```powershell
# 1. 建库并导入结构（密码换成自己的）
mysql -u root -p --default-character-set=utf8mb4
SOURCE database/000_create_database.sql;
USE campus_lost_found;
SOURCE database/migrations/V001__core_schema.sql;
SOURCE database/migrations/V003__item_submission_key.sql;
SOURCE database/seeds/S001__mock_students.sql;

# 2. 后端配置
Copy-Item backend/config/application.yml.example backend/config/application.yml
#    改 datasource.password、app.storage 的 hmac-key、app.admin.password

# 3. 启动
cd backend;  .\mvnw.cmd spring-boot:run      # http://localhost:8080
cd frontend; npm install; npm run dev        # http://localhost:5173
```

演示账号：虚拟名册 `20260001`~`20260005`（校园卡号 `90000001`~`90000005`），管理员账号在 `application.yml` 的 `app.admin` 里配置。

## 六、测试与验证

```powershell
cd frontend
npx vue-tsc --build     # 类型检查
npx vitest run          # 8 个测试文件、35 项用例，全部通过
```

无障碍证据（需本地起服务后复跑）：

```powershell
node docs/a11y-evidence/cdp.mjs after all    # 无障碍树 + 键盘路径 + 截图（含强制颜色）
node docs/a11y-evidence/cdp.mjs after skip   # 跳过导航验证
node docs/a11y-evidence/e2e.mjs              # 全键盘端到端：登录→发布→我的发布→下架弹窗
```

已验证的关键结果：

- 键盘第一个 Tab 停在「跳到主内容」，回车后焦点落在 `MAIN#main-content`，h1 为当前页标题；
- 登录输入框无障碍名称为「账号」，`required=true`（改前为「账号 *」、`required=false`）；
- 强制颜色下输入框/下拉框边框由「消失」变为清晰可辨；
- 全键盘完成登录、发布、下架确认全流程，弹窗 Esc 关闭后焦点回到触发按钮。

## 七、已知限制

- 原生 `<input type="date">` 被 Chromium 拆成「年/月/日」三个数值输入框且名称重复，属浏览器内置控件行为，页面层无法改写；键盘可正常填写。
- 管理端审核/举报等业务页面尚未实现（占位页），本次只适配已存在的页面。
- 未使用 NVDA/Playwright/axe-core：证据以 Edge 无障碍树、键盘走查与强制颜色截图为主。

## 八、提交材料

| 材料 | 位置 |
|---|---|
| 适配说明与测试记录 | [`docs/无障碍适配说明与测试记录.md`](docs/无障碍适配说明与测试记录.md) |
| 证据（截图、无障碍树、键盘日志、脚本） | [`docs/a11y-evidence/`](docs/a11y-evidence/) |
| 揭榜主贴正文 | [`docs/揭榜主贴_视障友好适配.md`](docs/揭榜主贴_视障友好适配.md) |

## 九、团队与致谢

三人课程项目：成员甲（账号与权限）、成员乙（信息发布与检索、无障碍适配）、成员丙（审核与举报）。原始项目仓库：[Huang-yu-xin/campus-lost-and-found](https://github.com/Huang-yu-xin/campus-lost-and-found)。

本项目仅用于课程学习与展示，不含真实个人信息；虚拟名册与邮箱验证码均为模拟数据。
