# Local Modifications (相对于上游 multica-ai/multica)

> 记录于 2026-04-12，合并 upstream/main (5bae3368) 之后

## 本地独有的 5 个 Commit

| Commit | 描述 |
|--------|------|
| `8ae9e180` | feat: add password auth, register page, and container deployment |
| `dd21994d` | fix(auth): move submit button inside form and fix rewrite port |
| `9a52bd35` | fix(auth): use onClick instead of form submit for base-ui Button |
| `d1d4c2fe` | fix(auth): replace base-ui components with native HTML on auth pages |
| `621d508c` | fix(api): fallback for crypto.randomUUID in insecure contexts |

---

## 一、密码认证功能（Password Auth）

### 新增文件

- `apps/web/app/(auth)/register/page.tsx` — 注册页面，支持 name/email/password/confirm-password 表单
- `server/migrations/031_password_hash.up.sql` — 添加 `password_hash` 列到 `user` 表
- `server/migrations/031_password_hash.down.sql` — 回滚迁移

### 修改文件

- **`server/internal/handler/auth.go`** — 添加 `register` handler（POST /auth/register），支持邮箱+密码注册和登录
- **`apps/web/features/auth/store.ts`** — 添加 `register(name, email, password)` action
- **`server/pkg/db/queries/user.sql`** — 添加 `GetUserByEmail`、`CreateUserWithEmail`、`UpdateUserPassword` 查询
- **`server/pkg/db/generated/user.sql.go`** — sqlc 生成的对应 Go 代码
- **`server/pkg/db/generated/models.go`** — `User` model 添加 `PasswordHash` 字段

---

## 二、容器化部署（Container Deployment）

### 新增文件

- **`DEPLOY_CONTAINER.md`** — 容器部署指南（端口、环境变量、故障排除）
- **`apps/web/Dockerfile`** — 前端多阶段构建（node:22-alpine builder + standalone runtime）
- **`scripts/deploy-container.sh`** — 一键部署脚本（检查端口、构建镜像、迁移、健康检查）

### 修改文件

- **`docker-compose.yml`** — 完整的 3 服务编排：
  - `postgres`：添加 healthcheck、container_name、networks
  - `backend`：新增服务，Go 后端容器
  - `frontend`：新增服务，Next.js 前端容器
  - `migrate`：新增 profile，数据库迁移
  - 添加 `multica-network` bridge 网络
- **`Dockerfile`**（根目录）：添加 backend 容器构建支持
- **`apps/web/next.config.ts`** — 添加 `BACKEND_REWRITE_URL` 环境变量，支持 Docker 内部 rewrite
- **`apps/web/package.json`** — 添加 `@radix-ui/react-slot` 依赖

---

## 三、Auth 页面重构

- **`apps/web/app/(auth)/login/page.tsx`** — 用原生 HTML 替换 base-ui 组件，修复 form submit 问题
- **`apps/web/app/(auth)/login/page.test.tsx`** — 对应测试更新

---

## 四、API 兼容性修复

- **`apps/web/shared/api/client.ts`** — `crypto.randomUUID` 在非安全上下文（HTTP）中的 fallback 处理

---

## 五、其他修改

- **`server/cmd/server/router.go`** — 添加 `/auth/register` 路由
- **`server/go.mod` / `server/go.sum`** — 添加 `golang.org/x/crypto` 依赖（密码哈希）
- **`server/cmd/server/integration_test.go`** — 测试适配
- **`server/internal/handler/handler_test.go`** — 测试适配
- **`server/internal/handler/skill.go`** — 小改动
- **`apps/web/app/(landing)/layout.tsx`** — 布局调整
- **`apps/web/app/(landing)/page.tsx`** — Landing 页面调整
- **`apps/web/features/skills/components/skills-page.tsx`** — 小改动

---

## 同步上游时的注意事项

1. **密码认证**：上游使用 Google OAuth，本地添加了密码认证。如果上游也添加了类似功能，需要合并两者的认证逻辑
2. **容器部署**：上游 v0.1.24 也有了大量自部署优化（#724 一键部署），本地版本的端口范围（2200X）可能与上游不同
3. **`pnpm-lock.yaml`**：下次同步时如果有冲突，建议用上游版本重新 `pnpm install --no-frozen-lockfile`
4. **CLAUDE.md**：本地版本包含容器部署文档，已被 stash 保护
