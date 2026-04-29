# v2 版实施计划：管理后台 + 题库系统

> 在 v1 稳定版基础上新增完整的管理后台系统和题库管理功能

## 架构设计

```
server.js（修改）
├── 现有竞赛系统逻辑（不变）
├── 新增：管理员认证（admin/Zsjs@2026）
├── 新增：题库 CRUD API
│   ├── GET /api/admin/banks        — 获取所有题库
│   ├── POST /api/admin/banks       — 创建题库
│   ├── PUT /api/admin/banks/:id    — 更新题库（含启用/禁用）
│   ├── DELETE /api/admin/banks/:id — 删除题库
│   └── GET /api/admin/banks/:id    — 获取单个题库详情
├── 新增：题目 CRUD API
│   ├── GET /api/admin/banks/:id/questions      — 获取题目列表
│   ├── POST /api/admin/banks/:id/questions     — 添加题目
│   ├── PUT /api/admin/questions/:id            — 修改题目
│   └── DELETE /api/admin/questions/:id         — 删除题目
├── 新增：竞赛系统改造
│   ├── 创建房间时读取已启用的题库
│   ├── 支持单选/多选/判断三种题型
│   └── 计分逻辑区分题型

public/admin.html（新建）
├── 管理员登录页面
├── 题库管理面板（增删改查题库）
├── 题目管理面板（增删改查题目）
└── 支持三种题型设置

public/contest.html（修改）
├── 单选题 → radio / 点击选择（现行逻辑）
├── 多选题 → checkbox（新增）
└── 判断题 → 对/错 两个按钮（新增）

public/index.html（修改）
└── 增加"管理后台"入口
```

## 数据模型

```javascript
// 题库
questionBanks = Map<string, {
  id: string,           // uuid
  name: string,         // 题库名称（竞赛名称）
  enabled: boolean,     // 是否启用
  questions: [          // 题目列表
    {
      id: string,       // uuid
      type: 'single' | 'multi' | 'judge',  // 题型
      q: string,        // 题目内容
      options: [string],// 选项数组（判断题固定为 ["对", "错"]）
      answer: number | number[],  // 答案：单选/判断为数字索引，多选为数组
      createdAt: timestamp
    }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}]
```

## API 设计

### 管理员认证（Session-based，简单token）
```
POST /api/admin/login
  Body: { username, password }
  Response: { success, token }  // token 存内存，简单验证
```

### 题库 CRUD（所有管理API需带 token 参数）
```
GET /api/admin/banks?token=xxx
POST /api/admin/banks?token=xxx  { name, enabled }
PUT /api/admin/banks/:id?token=xxx  { name, enabled }
DELETE /api/admin/banks/:id?token=xxx

GET /api/admin/banks/:id/questions?token=xxx
POST /api/admin/banks/:id/questions?token=xxx  { type, q, options, answer }
PUT /api/admin/questions/:id?token=xxx  { type, q, options, answer }
DELETE /api/admin/questions/:id?token=xxx
```

### 竞赛接口改造
```
GET /api/room/:roomId/questions
  → 返回题目时携带 type 字段，多选题 options 不做特殊处理
  → 判断题固定 options: ["对", "错"]
```

## 任务分解

### Task 1: 管理后台 API — 认证 + 题库 CRUD
修改 server.js，新增管理员认证和题库的增删改查接口

### Task 2: 管理后台 API — 题目 CRUD
修改 server.js，新增题目的增删改查接口，支持三种题型

### Task 3: 管理后台前端页面
新建 public/admin.html，从登录到题库/题目管理完整功能

### Task 4: 竞赛系统集成题库
修改 server.js 创建房间逻辑，从已启用的题库中出题

### Task 5: 答题前端支持多选/判断
修改 public/contest.html，支持三种题型的展示和作答

### Task 6: 首页增加管理入口 + 计分改造
修改 public/index.html 和 server.js 的计分逻辑
