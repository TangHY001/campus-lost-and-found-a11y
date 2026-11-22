# 校园失物招领系统

三人软件工程课程项目，计划使用 Java 21、Spring Boot、MySQL 和 Vue 3。

请从 [开发实施手册](docs/开发实施手册.md) 开始：它包含已确认需求、三人分工、基础框架搭建、模块开发、联调验收和个人课程材料安排。

配套文件：

- [三人开发任务清单](docs/三人开发任务清单.csv)
- [技术配置基线](docs/技术配置基线.md)
- [接口文档](docs/接口文档.md) 与 [OpenAPI](docs/openapi.yaml)
- [数据库设计](docs/数据库设计.md) 与 [迁移说明](database/README.md)

当前为开发准备阶段：接口与数据库设计已形成，数据库脚本在隔离实例验证过；backend 基础框架已建立（统一响应与错误、requestId、Session + CSRF、配置校验），尚无业务接口；frontend 基础框架已建立（统一请求与 CSRF、错误提示、登录状态、路由守卫、学生端/管理端布局），尚无业务页面。运行命令、环境配置和完成标准见手册，不能将本目录的文档校验结果当成已运行的应用。

## 拉代码后在自己电脑上跑起来

每个人用自己电脑上的数据库，按下面 6 步操作一次即可。命令以 Windows PowerShell 为例。

### 1. 准备软件

- JDK 21（不能用 17；电脑默认是别的版本也没关系，见第 4 步）
- MySQL 8.0
- Node.js 24（24.12 以上；或 22.18 以上），自带 npm
- Git
- 编辑器二选一：IntelliJ IDEA，或 VS Code + “Extension Pack for Java”和“Vue - Official”两个扩展。VS Code 里不要同时装 Oracle 的 Java 扩展，会和这套冲突

### 2. 下载代码

```powershell
git clone https://github.com/Huang-yu-xin/campus-lost-and-found.git
cd campus-lost-and-found
```

### 3. 建本地数据库

在**仓库根目录**登录 MySQL，按提示输入 root 密码（把路径换成你的 MySQL 安装位置）：

```powershell
& 'D:\MySQL\mysql-8.0.34-winx64\bin\mysql.exe' -u root -p --default-character-set=utf8mb4
```

进入 `mysql>` 后先执行：

```sql
SHOW DATABASES LIKE 'campus_lost_found';
```

如果有结果，说明电脑上已经有同名的旧库，**先停下来**在群里问，不要继续执行，否则新旧表会混在一起。没有结果就接着执行（`你的密码` 换成你自己想设的，后面第 4 步要用）：

```sql
SOURCE database/000_create_database.sql;
USE campus_lost_found;
SOURCE database/migrations/V001__core_schema.sql;
SOURCE database/migrations/V003__item_submission_key.sql;
SOURCE database/seeds/S001__mock_students.sql;

CREATE USER 'lostfound_app'@'localhost' IDENTIFIED BY '你的密码';
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_lost_found.* TO 'lostfound_app'@'localhost';
CREATE USER 'lostfound_app'@'127.0.0.1' IDENTIFIED BY '你的密码';
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_lost_found.* TO 'lostfound_app'@'127.0.0.1';

SHOW TABLES;
```

最后应看到 13 张表。中途任何一步报错就停下来，不要重复执行。`lostfound_app` 是后端专用账号，只能读写数据，不能改表结构；表结构要改时写新的迁移文件，详见 [迁移说明](database/README.md)。

### 4. 写本机配置

把 `backend/config/application.yml.example` 复制一份，改名为 `backend/config/application.yml`，然后改三处：

- `datasource` 下的 `password`：第 3 步设的密码
- `hmac-key`：在 PowerShell 运行下面这行，把输出的 64 位字符串粘进去
- `admin` 下的 `password`：自己定一个管理员密码（8 位以上，含字母和数字）。后端第一次启动时自动创建账号 `admin`，用它就能登录管理后台

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString('x2') })
```

`application.yml` 已被 Git 忽略，不会上传；不要把它发到群里。

### 5. 启动并确认

**VS Code**：打开仓库文件夹，等右下角 Java 项目加载完，按 F5 选“启动后端”。如果电脑默认 JDK 不是 21，在 VS Code 设置里搜 `java.configuration.runtimes`，添加 JDK 21 的路径。

**IDEA**：打开 `backend` 目录，Project SDK 选 JDK 21，运行 `CampusLostFoundApplication`。

**命令行**：先让当前终端使用 JDK 21，再在 `backend` 目录运行（路径换成你的 JDK 21 位置）：

```powershell
$env:JAVA_HOME = 'C:\你的\jdk-21'; $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

`mvnw test` 全部通过，且 `DatabaseConnectivityTest` 没有被跳过，说明数据库和配置都没问题。

启动后在浏览器打开 http://localhost:8080/api/v1/auth/csrf ，看到 `"code":"OK"` 就成功了。接口文档页面在 http://localhost:8080/swagger-ui.html 。

### 6. 启动前端

后端保持运行，另开一个终端：

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

`npm ci` 按 `package-lock.json` 安装和大家完全一样的依赖版本，第一次需要几分钟；以后只有 package-lock.json 变了才需要再运行。不要用 `npm install` 随手升级依赖，要加新依赖先在群里说。

浏览器打开 http://localhost:5173 （固定用 localhost，不要换成 127.0.0.1，否则登录状态对不上）。首页显示“后端连接正常”就说明前后端都通了。

提交前端代码前运行一遍检查，全部通过再提交：

```powershell
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --run
npm.cmd run build
```

常见问题：

| 现象 | 原因 |
| --- | --- |
| 启动报 `Could not bind properties to 'AppProperties'` | `backend/config/application.yml` 不存在，或者 hmac-key 不足 32 位；也可能不是从 backend 目录启动的 |
| `Access denied for user 'lostfound_app'` | application.yml 里的密码和第 3 步设的不一致 |
| `Unknown database 'campus_lost_found'` | 第 3 步没做完 |
| 提示 8080 或 5173 端口被占用 | 后端或前端已经在运行了，先停掉旧的 |
| 前端首页显示“后端连接失败” | 后端没有启动，或启动失败；先看后端终端的报错 |
| 编译报 `Fatal error compiling`，后面跟“不支持发行版本 21”（中文系统上可能是乱码） | 当前终端用的不是 JDK 21 |
