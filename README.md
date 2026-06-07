# 灵感发散器

输入一个词汇，AI 帮你无限发散灵感。基于 Canvas 的交互式词汇联想思维导图，双击节点即可递归展开，探索词语之间的无限联想链路。

## 功能

- **AI 驱动联想**：输入任意词汇，AI 自动生成 6 个不同维度的相关词汇
- **无限递归展开**：双击任意节点，继续发散联想，探索灵感的无限可能
- **交互式思维导图**：Canvas 渲染 + d3-force 力导向布局，支持拖拽、平移
- **智能去重**：自动排除已存在的词汇，避免重复联想
- **上下文感知**：联想路径作为上下文传给 AI，越深层联想越精准

## 技术栈

- [Next.js](https://nextjs.org/) 16（App Router）
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) v4
- [d3-force](https://github.com/d3/d3-force) — 力导向图布局

## 快速开始

### 环境要求

- Node.js 18+
- 任意兼容 OpenAI 接口的 AI 服务 API Key（小米 MiMo、DeepSeek 等）

### 安装

```bash
git clone https://github.com/Chen-DongFnag/word-inspiration.git
cd word-inspiration
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local`，填入你的 API Key：

```bash
cp .env.example .env.local
```

### 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 即可使用。

## 配置 AI 服务

本项目兼容所有遵循 OpenAI 接口规范的 AI 服务。在 `.env.local` 中修改以下三项即可切换：

### 小米 MiMo（默认）

```env
AI_API_KEY=你的API密钥
AI_API_BASE_URL=https://api.xiaomimimo.com/v1
AI_MODEL=mimo-v2.5
```

### DeepSeek

1. 前往 [DeepSeek 平台](https://platform.deepseek.com/) 注册账号并创建 API Key
2. 在 `.env.local` 中配置：

```env
AI_API_KEY=你的DeepSeek API密钥
AI_API_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

> 也可使用 `deepseek-reasoner` 模型，联想质量更高但响应较慢。

### 其他兼容服务

只要服务提供 OpenAI 兼容的 `/chat/completions` 接口，修改以下三个变量即可：

| 变量 | 说明 |
|------|------|
| `AI_API_KEY` | API 密钥 |
| `AI_API_BASE_URL` | 接口地址，需包含 `/chat/completions` 路径 |
| `AI_MODEL` | 模型名称 |

## 使用方法

1. 在顶部输入框输入一个词汇（如「海洋」「时间」「孤独」）
2. 点击「发散」或按回车，AI 自动生成 6 个联想词汇
3. **双击**任意节点，继续展开下一层联想
4. **拖拽**节点调整布局，**拖拽空白区域**平移画布
5. 再次**双击**已展开的节点可折叠

## 项目结构

```
src/
├── app/
│   ├── api/expand/route.ts   # AI 联想 API 端点
│   ├── layout.tsx            # 根布局
│   ├── page.tsx              # 首页
│   └── globals.css           # 全局样式
├── components/
│   ├── MindMap.tsx           # Canvas 思维导图（主界面）
│   └── WordTree.tsx          # 树形视图（备用）
└── types/
    └── index.ts              # 共享类型定义
```

## 部署

项目已配置 Vercel 部署，直接连接 GitHub 仓库即可自动部署。

手动部署：

```bash
npm run build
npm run start
```

## 开源协议

MIT
