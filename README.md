# 申论素材工作台

一个把申论素材交给 AI 自动整理成 Markdown 的纯前端应用：粘贴素材 -> AI 分析归类 -> 手动微调 -> 导出 `.md` 或存入本地素材库。

## 功能

- 录入申论素材（政策文件、讲话节选、案例等）
- 调用 OpenAI 兼容接口（OpenAI、DeepSeek、其他中转或本地服务均可）自动生成标题、摘要、维度/主题/方向分类、关键词、论据类型与核心价值
- 分析结果支持手动编辑
- 素材库支持搜索与按维度筛选
- 一键导出标准 Markdown 模板
- 数据只保存在浏览器（`localStorage` / `sessionStorage`），无后端、无数据库

## 技术栈

- React 19 + TypeScript + Vite 7
- Tailwind CSS 4 + Radix UI 组件
- pnpm workspace monorepo
- wouter 路由

## 目录

- `artifacts/shenlun-materials`：申论素材工作台（本应用）
- `artifacts/api-server`：仓库内另一个项目的 API 服务，本应用运行时不依赖它
- `lib/*`：共享库；本应用只复用其中导出的类型定义

## 本地开发

环境要求：Node.js 22+、pnpm 11+。

```powershell
pnpm install
pnpm --filter @workspace/shenlun-materials dev
```

默认使用 `PORT=3000`、`BASE_PATH=/`，也可显式指定：

```powershell
$env:PORT = 5173
$env:BASE_PATH = "/"
pnpm --filter @workspace/shenlun-materials dev
```

然后打开 <http://localhost:3000>。

构建：

```powershell
pnpm --filter @workspace/shenlun-materials build
```

产物目录为 `artifacts/shenlun-materials/dist/public`。

## 部署到 Cloudflare Pages

这是一个纯静态 SPA，不依赖 `api-server`，也不需要数据库，Cloudflare Pages 可以直接托管。

### 方式一：连接 Git 仓库（推荐）

1. 将仓库推送到 GitHub / GitLab。
2. 打开 Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git，授权并选择仓库。
3. 按以下配置创建项目：

   - Framework preset：`None`
   - Build command：`pnpm --filter @workspace/shenlun-materials build`
   - Build output directory：`artifacts/shenlun-materials/dist/public`
   - Root directory：留空（使用仓库根目录）

4. 环境变量（都有默认值，建议至少设置 `NODE_VERSION`）：

   | 变量 | 值 | 说明 |
   | --- | --- | --- |
   | `NODE_VERSION` | `22` | 指定构建用 Node 版本 |
   | `PORT` | `3000` | Vite 端口，可选 |
   | `BASE_PATH` | `/` | 站点根路径，可选 |
   | `PNPM_VERSION` | `11.9.0` | 锁定 pnpm 版本，可选 |

5. 点击 Save and Deploy。之后每次 push 都会自动构建发布，预览分支也会生成独立预览地址。

### 方式二：直接上传 / Wrangler CLI

本地构建完成后，把 `artifacts/shenlun-materials/dist/public` 整个目录拖入 Cloudflare Pages 的 Direct Upload 页面，或使用 CLI：

```powershell
npx wrangler pages deploy artifacts/shenlun-materials/dist/public --project-name shenlun-materials
```

## 部署说明

- `artifacts/shenlun-materials/public/_redirects` 已内置 SPA 回退规则 `/* /index.html 200`，未知路径会回到应用首页。
- API Key 由每个用户在自己的浏览器中填写，保存在 `sessionStorage`，不会被写入仓库或 Cloudflare 环境变量；但它在浏览器里是可见的，公共站点请自行评估风险。若不想把 Key 暴露给浏览器，可在 Pages Functions 中加一个转发接口来代理 AI 请求。
- 部分 OpenAI 兼容服务不允许浏览器跨域请求，页面会提示请求失败；此时换用支持 CORS 的接口，或通过 Pages Functions 代理。

## 常见问题

- 构建报 `PORT environment variable is required` / `BASE_PATH environment variable is required`：旧版配置必须显式提供环境变量；当前版本已为两者提供默认值。若仍报错，在构建环境中设置 `PORT` 和 `BASE_PATH` 即可。
- Windows 本地构建报 `Cannot find module @rollup/rollup-win32-x64-msvc`：这是依赖安装缺少 win32 原生包导致的。workspace 已通过 `supportedArchitectures` 同时解析 linux-x64 与 win32-x64 依赖；更新代码后重新执行 `pnpm install`，必要时先删除 `node_modules`。
- `pnpm install` 触发 supply-chain policy 报错：根目录 `.npmrc` 设置了 `minimumReleaseAge: 1440`，会拒绝发布不足 1 天的包。保持 `pnpm-lock.yaml` 不变时一般不会触发；确需安装新包时再临时放行，不建议长期关闭。
