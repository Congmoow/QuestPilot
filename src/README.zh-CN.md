[English](./README.md) | **中文**

# 前端源码说明

React 18 + TypeScript + Vite 前端，运行于 Tauri WebView 中。

---

## 目录结构

```
src/
├── main.tsx              # 应用入口，挂载 React 根节点
├── App.tsx               # 路由配置，使用 HashRouter + lazy 页面
├── index.css             # 全局样式（Tailwind 基础样式 + 自定义 token）
│
├── pages/                # 路由级页面（薄装配层，不含业务逻辑）
│   ├── Dashboard.tsx
│   ├── ManualEntry.tsx
│   ├── CsvImport.tsx
│   ├── AiImport.tsx
│   ├── Practice.tsx
│   ├── WrongBook.tsx
│   ├── QuestionPreview.tsx
│   ├── Settings.tsx
│   └── AiChat.tsx
│
├── features/             # 按功能域拆分的业务逻辑
│   ├── ai-chat/          # AI 问答
│   ├── ai-import/        # AI / JSON 批量导入
│   ├── csv-import/       # CSV 批量导入
│   ├── dashboard/        # 数据看板
│   ├── practice/         # 随机练题
│   ├── question-preview/ # 题库 & 题目浏览
│   ├── questions/        # 手动录入
│   ├── settings/         # 系统设置
│   └── wrong-book/       # 错题本
│
├── components/           # 通用 UI 组件
│   ├── ui/               # 设计系统基础组件（base、forms、question、dashboard、ai）
│   ├── Layout.tsx        # 侧边栏 + 主区域布局，持有主题 Context
│   ├── TitleBar.tsx      # 自定义标题栏（Tauri 窗口控件）
│   ├── Dialog.tsx        # 通用模态对话框
│   ├── ConfirmDialog.tsx # 确认对话框
│   ├── CodeAwareText.tsx # 自动识别代码并切换 <pre> / <span> 渲染
│   ├── QuestionBankDialog.tsx  # 题库创建/编辑弹窗
│   ├── QuestionEditDialog.tsx  # 题目编辑弹窗
│   └── SidebarIcons.tsx  # 侧边栏自定义 SVG 图标
│
├── contexts/             # React Context
│   ├── QuestionBankContext.tsx  # 题库列表与操作
│   └── QuestionContext.tsx      # 当前题库的题目列表、搜索、分页
│
├── api/                  # Tauri 后端调用封装
│   ├── index.ts          # 所有 invoke 调用的统一出口
│   ├── types.ts          # 共享数据类型（Question、QuestionBank 等）
│   ├── runtimeAdapters.ts  # 规范化 Tauri 对话框返回值
│   └── index.test.ts     # API 层单元测试
│
├── lib/                  # 纯工具函数（无副作用）
│   ├── utils.ts          # cn()：Tailwind class 合并
│   ├── fillBlank.ts      # 填空题空栏识别与计数
│   ├── assets.ts         # 静态资源路径适配（dev / prod）
│   ├── practiceHelpers.ts  # 练题共享逻辑（shuffle、normalize）
│   ├── questionLabels.ts   # TYPE_LABELS 共享常量
│   └── desktopRuntime.ts   # 窗口控制抽象（Tauri invoke）
│
└── types/
    └── viewModels.ts     # 前端视图层类型（PracticeQuestion、AnswerMap 等）
```

---

## Feature 内部结构

每个 `features/<domain>/` 目录遵循统一三层结构：

```
features/<domain>/
├── components/   # 该功能的展示组件（接收 props，不直接调用 API）
├── hooks/        # 自定义 Hook（封装全部状态、副作用、API 调用）
└── utils/        # 纯函数、常量（无 React 依赖）
```

**页面文件只负责组装**：从对应 feature 导入 hook 和组件，不包含业务逻辑。

---

## 关键技术

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架，使用 functional + hooks |
| TypeScript | 5 | 全量类型覆盖 |
| Vite | 5 | 构建与开发服务器 |
| Tailwind CSS | 3 | 原子化样式 |
| React Router | 6 | HashRouter 路由（兼容 Tauri WebView） |
| Framer Motion | — | 过渡动画 |
| Recharts | — | 统计图表 |
| react-markdown | — | AI 对话 Markdown 渲染 |

---

## 设计系统（`components/ui/`）

基础组件分为 5 个子模块，全部为命名导出，统一通过 `index.ts` 汇总：

| 文件 | 包含组件 |
|------|---------|
| `base.tsx` | `PageHeader`、`SurfaceCard`、`ToolbarCard`、`ActionButton`、`IconButton`、`StatusBadge`、`AlertBanner`、`EmptyState`、`SegmentedTabs` |
| `forms.tsx` | `Field`、`TextInput`、`TextareaInput`、`SelectInput`、`PasswordInput`、`SearchInput` |
| `question.tsx` | `QuestionBankCard`、`PracticeCard`、`QuizShell`、`AnswerOptionCard`、`ResultSummary`、`Pagination`、`TypeBadge` |
| `dashboard.tsx` | `StatCard`、`ChartCard`、`TimelineLog` |
| `ai.tsx` | `JsonEditorPanel`、`ParsedQuestionItem`、`AIChatWelcome`、`ChatMessageBubble`、`ChatComposer`、`ParseEmptyState` |

用法：

```tsx
import { ActionButton, SurfaceCard, AlertBanner } from '../components/ui';
```

---

## 与 Tauri 后端通信

所有后端调用通过 `src/api/index.ts` 封装，禁止在组件或 hook 中直接调用 `invoke`。

```tsx
import api from '../api';

// 示例
const banks = await api.questionBank.getAll();
const result = await api.ai.parseQuestions(text);
```

后端命令按域分组：`questionBank`、`question`、`settings`、`ai`、`migration`、`practice`、`wrongBook`、`draft`、`prompt`、`chatHistory`、`csv`。

---

## 开发命令

```bash
npm run dev          # 启动 Vite 开发服务器（仅前端预览）
npm run build        # 构建前端产物到 dist/
npm test             # 运行单元测试（Vitest）
npx tsc --noEmit     # TypeScript 全量类型检查
```

完整桌面应用开发请在项目根目录运行 `npm run tauri dev`。
