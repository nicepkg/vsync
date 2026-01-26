# vsync - AI 氛围编程工具配置同步器

**版本**: 1.0.0 (当前实施版本: v1.2)
**日期**: 2026-01-25
**理念**: 单一配置源 → 一键同步 → 所有工具保持和谐

---

## 📌 重要说明

**本文档已根据实际代码和项目方向更新 (2026-01-25)**:

- ✅ 版本号更新为 1.0.0 (对应 v1.2 实现)
- ✅ 定位从 "编译器" 改为 "一键同步工具"
- ✅ 配置示例使用最新格式 (含 use_symlinks_for_skills, language)
- ✅ 工具描述使用 "AI 氛围编程工具" (vibe coding tools)
- ✅ 交互流程基于实际代码更新
- ✅ v1.0, v1.1, v1.2 状态标记为已完成
- ✅ 去掉过时的 mcp_security 配置示例

---

## 目录

1. [核心定位](#1-核心定位) - 问题、解决方案、核心价值
2. [配置格式精确映射表](#2-配置格式精确映射表) - 各工具格式详解
3. [层级系统](#3-层级系统) - Project/User 层、配置结构、Manifest
4. [CLI 命令设计](#4-cli-命令设计) - 所有命令详细说明
5. [同步模式与安全机制](#5-同步模式与安全机制) - Safe/Prune 模式、原子写入
6. [Adapter 架构](#6-adapter-架构) - Adapter 模式、数据模型
7. [差异计划系统](#7-差异计划系统) - 3-way diff、计划生成
8. [实施路线与版本状态](#8-实施路线与版本状态) - v1.0~v1.3 完成状态
9. [总结](#9-总结) - 核心价值、技术特性、架构

---

## 1. 核心定位

### 1.1 我们在做什么

**问题**: 多个 AI 氛围编程工具 (Claude Code、Cursor、OpenCode、Codex) 各有各的目录结构和配置格式，跨工具管理 Skills、MCP、Agents、Commands 成为噩梦。

**解决方案**: vsync 提供一条命令同步一切。选一个工具作为源 (source of truth)，其他工具自动保持同步。

**核心价值**:

- 不是简单的文件复制工具
- 而是智能的配置转换与同步工具
- 支持多种格式 (JSON ↔ TOML ↔ JSONC)
- 保留环境变量语法
- 可选 symlink 支持 (Skills)

```
1. 选择源工具 (Source Tool)
   ↓
2. 读取源配置 (Skills, MCP, Agents, Commands)
   ↓
3. 标准化数据模型
   ↓
4. 读取目标工具配置
   ↓
5. 读取 Manifest (上次同步状态)
   ↓
6. 计算差异 (3-way diff)
   ↓
7. 生成同步计划
   ↓
8. 显示计划并请求用户确认
   ↓
9. 转换为目标格式 (JSON/TOML/JSONC)
   ↓
10. 原子写入 (crash-safe)
    ↓
11. 更新 Manifest

支持特性:
- Safe Mode: 只创建和更新，不删除
- Prune Mode: 严格镜像，删除源中没有的项
- Symlinks: Skills 可选符号链接 (v1.2+)
- i18n: 多语言 CLI (v1.2+)
```

### 1.2 管理的配置类型

| 配置类型     | v1.0 | v1.1 | v1.2 | 说明                |
| ------------ | ---- | ---- | ---- | ------------------- |
| **Skills**   | ✅   | ✅   | ✅   | 可复用指令模板      |
| **MCP**      | ✅   | ✅   | ✅   | 外部工具集成        |
| **Agents**   | ❌   | ✅   | ✅   | 自定义 AI 代理      |
| **Commands** | ❌   | ✅   | ✅   | 快捷命令            |
| **Symlinks** | ❌   | ❌   | ✅   | Skills 符号链接支持 |
| **i18n**     | ❌   | ❌   | ✅   | 多语言 CLI (en/zh)  |

### 1.3 支持的工具

| 工具            | v1.0      | v1.1 | v1.2 | 说明                            |
| --------------- | --------- | ---- | ---- | ------------------------------- |
| **Claude Code** | ✅ Source | ✅   | ✅   | 功能最完整，推荐作为配置源      |
| **Cursor**      | ✅ Target | ✅   | ✅   | 变量插值最强                    |
| **OpenCode**    | ✅ Target | ✅   | ✅   | 开源，配置格式独特 (JSONC 注释) |
| **Codex**       | ❌        | ✅   | ✅   | TOML 格式支持                   |

---

## 2. 配置格式精确映射表

### 2.1 Skills 配置

所有工具都使用相同的 Agent Skills 标准：`<skill-name>/SKILL.md`

| 工具        | User 层               | Project 层          |
| ----------- | --------------------- | ------------------- |
| Claude Code | `~/.claude/skills/`   | `.claude/skills/`   |
| Codex       | `~/.codex/skills/`    | `.codex/skills/`    |
| Cursor      | `~/.cursor/skills/`   | `.cursor/skills/`   |
| OpenCode    | `~/.opencode/skills/` | `.opencode/skills/` |

**文件结构**:

```
<skill-name>/
├── SKILL.md           # frontmatter + 正文
├── template.md        # 可选支持文件
└── scripts/           # 可选脚本
    └── helper.sh
```

### 2.2 MCP 配置（重点！）

#### Claude Code

**位置**:

- 全局: `~/.claude.json`
- 项目: `.mcp.json`

**格式**: JSON

**结构**:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "PASSWORD": "${LOCAL_PASSWORD:-12345}"
      }
    },
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

**环境变量格式**: `${NAME}`, `${NAME:-default}`

**关键特性**:

- ✅ 支持环境变量展开（**必须原样保留**）
- ⚠️ 写入时禁止 JSON 格式化破坏变量

---

#### Codex

**位置**:

- 全局: `~/.codex/config.toml`
- 项目: `.codex/config.toml`

**格式**: TOML

**结构**:

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"] # optional
cwd = "xxxx" # optional
env_vars = ["CONTEXT7_API_KEY"] #optional, use system vars

[mcp_servers.context7.env] # optional
MY_ENV_VAR = "MY_ENV_VALUE"

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN" # optional
http_headers = { "X-Figma-Region" = "us-east-1" } # optional
env_http_headers = {} # optional


[mcp_servers.chrome_devtools]
url = "http://localhost:3000/mcp"
enabled_tools = ["open", "screenshot"] # optional
disabled_tools = ["screenshot"] # optional, applied after enabled_tools
startup_timeout_sec = 20 # optional
tool_timeout_sec = 45 # optional
enabled = true # optional
```

**环境变量格式**: **不支持插值**，直接写值

**关键特性**:

- ✅ 仅支持 stdio 传输
- ❌ 不支持变量插值
- ⚠️ 写入时只修改 `mcp_Servers` 字段，保留其他配置

---

#### Cursor

**位置**:

- 全局: `~/.cursor/mcp.json`
- 项目: `.cursor/mcp.json`

**格式**: JSON

**结构** (stdio):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"], // optional
      "env": {
        "PGPASSWORD": "${env:PGPASSWORD}",
        "DATA_DIR": "${workspaceFolder}/data"
      }, // optional
      "envFile": ".env" // optional
    }
  }
}
```

**结构** (HTTP):

```json
{
  "mcpServers": {
    "remote": {
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:TOKEN}"
      }, // optional
      "auth": {
        "CLIENT_ID": "your-oauth-client-id",
        "CLIENT_SECRET": "your-client-secret",
        "scopes": ["read", "write"]
      } // optional
    }
  }
}
```

**Cursor 支持的变量插值**:

- `${env:NAME}`: 环境变量
- `${userHome}`: 用户主目录
- `${workspaceFolder}`: 项目根目录
- `${workspaceFolderBasename}`: 项目名称
- `${pathSeparator}` 或 `${/}`: 路径分隔符

**关键特性**:

- ✅ 支持 stdio、HTTP、OAuth 三种传输
- ✅ **最完整的变量插值**
- ⚠️ 写入时必须保留所有变量

---

#### OpenCode

**位置**:

- 全局: `~/.opencode/opencode.json`
- 项目: `opencode.json` 或 `opencode.jsonc`

**格式**: JSON 或 JSONC（**支持注释**）

**结构**:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sqlite": {
      "type": "local",
      "enabled": true, // optional
      "command": ["npx", "-y", "@modelcontextprotocol/server-sqlite"],
      "environment": {
        "PASSWORD": "{env:LOCAL_PASSWORD}"
      }, // optional
      "timeout": 5000 // optional
    },
    "jira": {
      "type": "remote",
      "enabled": true, // optional
      "url": "https://jira.example.com/mcp",
      "headers": {
        "Authorization": "Bearer {JIRA_TOKEN}"
      }, // optional
      "oauth": {
        "clientId": "{env:MY_MCP_CLIENT_ID}",
        "clientSecret": "{env:MY_MCP_CLIENT_SECRET}",
        "scope": "tools:read tools:execute"
      } // optional
    }
  }
}
```

**环境变量格式**: `{env:NAME}`

**OpenCode 关键特性**:

- ⚠️ **根字段名是 `mcp` 而非 `mcpServers`**
- ✅ 必须指定 `type` 字段：`"local"` 或 `"remote"`
- ✅ 支持 JSONC 格式（**必须保留注释**）
- ⚠️ 写入时只修改 `mcp` 字段，保留其他配置

---

### 2.3 MCP 配置对比总结表

| 特性             | Claude Code  | Codex         | Cursor                  | OpenCode           |
| ---------------- | ------------ | ------------- | ----------------------- | ------------------ |
| **配置文件**     | `.mcp.json`  | `config.toml` | `mcp.json`              | `opencode.json(c)` |
| **MCP 字段名**   | `mcpServers` | `mcp_Servers` | `mcpServers`            | `mcp` ⚠️           |
| **User 层支持**  | ✅           | ✅            | ✅                      | ✅                 |
| **HTTP 传输**    | ✅           | ✅            | ✅                      | ✅                 |
| **环境变量格式** | `${X}`       | ❌ 不支持     | `${env:X}` + 5 个固定的 | `{env:X}`          |

**关键差异**:

- OpenCode 的 MCP 字段名是 `mcp` 而不是 `mcpServers` (最容易出错!)
- OpenCode 必须指定 `type` 字段 (`"local"` 或 `"remote"`)
- Codex 使用 TOML 格式，字段名是 `mcp_servers` (下划线)
- 环境变量语法各不相同，vsync 自动转换：
  - Claude Code: `${VAR}` → Cursor: `${env:VAR}` → OpenCode: `{env:VAR}`
  - Codex 不支持插值，直接写值

---

## 3. 层级系统

### 3.1 层级定义

```bash
# Project 层（默认）
vsync sync          # 操作当前项目 .vsync.json

# User 层（全局）
vsync sync --user   # 操作 ~/.vsync.json
```

### 3.2 配置文件结构

**Project 层**: `<project>/.vsync.json`
**User 层**: `~/.vsync.json`

```json
{
  "version": "1.0.0",
  "level": "project",
  "source_tool": "claude-code",
  "target_tools": ["cursor", "opencode", "codex"],
  "sync_config": {
    "skills": true,
    "mcp": true
  },
  "use_symlinks_for_skills": false,
  "language": "en",
  "last_sync": "2026-01-25T10:30:00Z"
}
```

**字段说明**:

- `version`: 配置版本 (当前 1.0.0)
- `level`: "project" 或 "user"
- `source_tool`: 源工具 (标准参考)
- `target_tools`: 目标工具列表 (从源同步)
- `sync_config.skills`: 是否同步 Skills
- `sync_config.mcp`: 是否同步 MCP servers
- `sync_config.agents` (可选): 是否同步 Agents (v1.1+)
- `sync_config.commands` (可选): 是否同步 Commands (v1.1+)
- `use_symlinks_for_skills` (可选, v1.2+): 使用符号链接而非复制
- `language` (可选, v1.2+, 仅 user 层): CLI 语言 ("en" 或 "zh")
- `last_sync` (自动生成): 最后同步时间

### 3.3 Manifest 文件

**位置**: `.vsync-cache/manifest.json`

**作用**:

- 记录每个配置项的 hash
- 用于快速判定是否需要同步
- 跟踪每个目标工具的同步状态
- 支持增量同步

```json
{
  "version": "1.0.0",
  "last_sync": "2026-01-25T10:30:00Z",
  "items": {
    "skill/git-release": {
      "type": "skill",
      "hash": "abc123...",
      "last_synced": "2026-01-25T10:30:00Z",
      "targets": {
        "cursor": "abc123...",
        "opencode": "abc123..."
      }
    },
    "mcp/sqlite": {
      "type": "mcp",
      "hash": "def456...",
      "last_synced": "2026-01-25T10:30:00Z",
      "targets": {
        "cursor": "def456...",
        "opencode": "def456..."
      }
    }
  }
}
```

**字段说明**:

- `type`: 配置类型 ("skill", "mcp", "agent", "command")
- `hash`: 源配置的 SHA256 hash
- `last_synced`: 最后同步时间
- `targets`: 各目标工具的 hash (用于检测目标是否被手动修改)

---

## 4. CLI 命令设计

### 4.1 命令概览

```bash
vsync init [--user]                    # 初始化配置
vsync sync [--user] [--dry-run] [--prune]  # 同步配置
vsync import <path> [--user]           # 从其他项目导入
vsync clean [name] [--user]            # 清理目标工具配置
vsync status [--user]                  # 查看同步状态
vsync list [type] [--user]             # 列出配置
vsync plan [--user]                    # 查看同步计划（不执行）
```

### 4.2 `vsync init` - 初始化

**触发时机**: 用户主动运行或任何命令找不到 `.vsync.json` 时

**交互流程** (基于实际代码):

```bash
$ vsync init

🚀 Welcome to vsync!

✔ Detecting existing tools...
✔ Detected: claude-code, cursor

? Which AI coding tools do you use?
  ◉ claude-code (detected)
  ◉ cursor (detected)
  ◯ opencode
  ◯ codex

? Which tool is your source of truth?
  ❯ claude-code

? What do you want to sync?
  ◉ Skills
  ◉ MCP

✔ Configuration created
✔ Cache directory created
✔ Manifest initialized

✅ Setup complete! Run vsync sync to start syncing
```

**关键特性**:

- 自动检测现有工具目录
- 提示用户选择工具
- 选择源工具 (source of truth)
- 选择要同步的配置类型
- 创建配置文件、缓存目录、manifest

### 4.3 `vsync sync` - 同步配置

**核心功能**: 从配置源读取 → 计算差异 → 生成计划 → 执行同步

#### 基础用法

```bash
# Project 层同步（默认 safe 模式）
vsync sync

# Prune 模式（严格镜像，会删除目标多余项）
vsync sync --prune

# Dry Run（仅显示计划，不执行）
vsync sync --dry-run

# User 层同步
vsync sync --user
```

#### 输出示例（Safe 模式）

```bash
$ vsync sync

📖 Reading source (claude-code)...
  ✓ Found 3 skills
  ✓ Found 2 MCP servers

📊 Analyzing differences...

📋 Sync Plan (Safe Mode)

cursor:
  CREATE:
    • skill/deploy-prod
  UPDATE:
    • skill/git-release
    • mcp/github
  SKIP:
    • skill/api-conventions (unchanged)
    • mcp/sqlite (unchanged)

opencode:
  CREATE:
    • skill/deploy-prod
  UPDATE:
    • skill/git-release
    • mcp/github
  SKIP:
    • skill/api-conventions (unchanged)
    • mcp/sqlite (unchanged)

──────────────────────────────────────────────────────────

? Proceed with sync? (Y/n) y

🔧 Syncing to cursor...
  ✓ skill/deploy-prod created
  ✓ skill/git-release updated
  ✓ mcp/github updated

🔧 Syncing to opencode...
  ✓ skill/deploy-prod created
  ✓ skill/git-release updated
  ✓ mcp/github updated

✓ Sync completed in 1.2s
✓ Manifest updated
```

#### 输出示例（Prune 模式）

```bash
$ vsync sync --prune

📖 Reading source (claude-code)...
  ✓ Found 2 skills
  ✓ Found 1 MCP server

📊 Analyzing differences...
  Skills in source: git-release, api-conventions
  Skills in cursor: git-release, api-conventions, old-skill ⚠️
  Skills in opencode: git-release, api-conventions, old-skill ⚠️

──────────────────────────────────────────────────────────

📋 Sync Plan (Prune Mode)

cursor:
  UPDATE:
    • skill/git-release
  DELETE:
    • skill/old-skill (not in source)

opencode:
  UPDATE:
    • skill/git-release
  DELETE:
    • skill/old-skill (not in source)

──────────────────────────────────────────────────────────

⚠️  Warning: Prune mode will DELETE items not in source

? Proceed with sync? (y/N) y

🔧 Syncing to cursor...
  ✓ skill/git-release updated
  🗑️  skill/old-skill deleted

🔧 Syncing to opencode...
  ✓ skill/git-release updated
  🗑️  skill/old-skill deleted

✓ Sync completed in 0.8s
```

### 4.4 `vsync clean` - 清理目标配置

**功能**: 从目标工具移除配置（**不动配置源**）

**基础用法**:

```bash
# 删除单个配置
vsync clean skill/old-skill

# 交互式批量选择
vsync clean

# 从配置源和所有目标删除（危险！）
vsync clean skill/old-skill --from-source

# User 层清理
vsync clean --user
```

#### 单个删除示例

```bash
$ vsync clean skill/old-skill

⚠️  This will remove from target tools only (source unchanged)

Will remove from:
  • cursor (.cursor/skills/old-skill/)
  • opencode (.opencode/skills/old-skill/)

Source (claude-code) will NOT be affected.

? Confirm removal from targets? (y/N) y

🔧 Removing from targets...
  ✓ cursor: skill/old-skill removed
  ✓ opencode: skill/old-skill removed

✓ Cleanup completed
```

#### 从配置源删除示例（危险操作）

```bash
$ vsync clean skill/old-skill --from-source

⚠️⚠️⚠️  DANGER ZONE  ⚠️⚠️⚠️

This will delete from the SOURCE tool (claude-code) AND all targets.
This action CANNOT be undone.

Will delete from:
  • claude-code (.claude/skills/old-skill/) ← SOURCE
  • cursor (.cursor/skills/old-skill/)
  • opencode (.opencode/skills/old-skill/)

? Type the name to confirm: old-skill
? Are you absolutely sure? (yes/no) yes

🔧 Deleting from source and targets...
  🗑️  claude-code: skill/old-skill deleted
  🗑️  cursor: skill/old-skill deleted
  🗑️  opencode: skill/old-skill deleted

✓ Deletion completed
✓ Manifest updated
```

#### 批量删除示例

```bash
$ vsync clean

? What type do you want to clean?
  ❯ Skills
    MCP Servers

? Select items to remove from targets: (default: none)
  ◯ git-release
  ◯ api-conventions
  ◯ old-skill

# [用户选择 old-skill]

Selected items (1):
  • skill/old-skill

⚠️  This will remove from target tools only (source unchanged)

? Confirm removal from targets? (y/N) y

🔧 Removing from targets...
  ✓ cursor: skill/old-skill removed
  ✓ opencode: skill/old-skill removed

✓ Cleanup completed
```

### 4.5 `vsync import` - 导入配置

```bash
$ vsync import ../other-project

Scanning ../other-project...

? This directory uses:
  ❯ Claude Code (.claude/ found)
    Cursor (.cursor/ found)

? Import from which tool?
  ❯ Claude Code

Reading claude-code configuration...
  ✓ Found 5 skills
  ✓ Found 3 MCP servers

? What do you want to import? (default: all selected)
  ◉ Skills (5 items)
    • git-release
    • api-conventions
    • deploy-prod
    • test-generator
    • code-reviewer

  ◉ MCP Servers (3 items)
    • sqlite
    • github
    • postgres

? How to handle conflicts?
  ❯ Skip (keep existing)
    Overwrite (replace existing)
    Rename (add suffix)

Processing:
  ✓ Skills: 5 imported (0 skipped)
  ✓ MCP: 3 imported (1 skipped: sqlite already exists)

✓ Import completed

? Sync to target tools now? (Y/n) y

# 进入正常 sync 流程...
```

### 4.6 `vsync plan` - 查看同步计划

**功能**: 显示详细的同步计划（相当于 `sync --dry-run`）

```bash
$ vsync plan

📖 Reading source (claude-code)...
  ✓ Found 3 skills
  ✓ Found 2 MCP servers

📊 Analyzing differences...

──────────────────────────────────────────────────────────

📋 Sync Plan (Safe Mode)

cursor:
  CREATE:
    • skill/deploy-prod
      Reason: New in source
      Hash: sha256:abc123...

  UPDATE:
    • skill/git-release
      Reason: Source hash changed
      Old: sha256:old111...
      New: sha256:new222...

    • mcp/github
      Reason: Source env changed
      Diff:
        - "GITHUB_TOKEN": "ghp_old..."
        + "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"

  SKIP:
    • skill/api-conventions
      Reason: Hash unchanged (sha256:xyz789...)

──────────────────────────────────────────────────────────

Run `vsync sync` to apply this plan
```

### 4.7 `vsync status` - 查看状态

```bash
$ vsync status

Configuration Status (Project)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source Tool:       claude-code
Target Tools:      cursor, opencode
Last Sync:         2026-01-24 10:30:00 (2 hours ago)
Configuration:     .vsync.json
Manifest:          .vsync-cache/manifest.json

Synced Items:
  Skills:          3 items
  MCP Servers:     2 items

Tool Status:
  ✓ claude-code    (source)
  ✓ cursor         (synced, up-to-date)
  ✓ opencode       (synced, up-to-date)

Health:
  ✓ All targets up-to-date
  ✓ No pending changes

Run `vsync plan` to see sync plan
```

### 4.8 `vsync list` - 列出配置

```bash
$ vsync list skills

Skills (3 items) - Source: claude-code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────┬────────────────────────────────┬──────────────┬────────────┐
│ Name             │ Description                    │ Synced To    │ Hash       │
├──────────────────┼────────────────────────────────┼──────────────┼────────────┤
│ git-release      │ Create releases and changelogs │ cursor, open…│ abc123...  │
│ api-conventions  │ API design patterns            │ cursor, open…│ def456...  │
│ deploy-prod      │ Deploy to production           │ cursor, open…│ ghi789...  │
└──────────────────┴────────────────────────────────┴──────────────┴────────────┘
```

---

## 5. 同步模式与安全机制

### 5.1 两种同步模式

| 模式      | 命令                 | CREATE | UPDATE | DELETE | 适用场景         |
| --------- | -------------------- | ------ | ------ | ------ | ---------------- |
| **Safe**  | `vsync sync`         | ✅     | ✅     | ❌     | 日常同步（默认） |
| **Prune** | `vsync sync --prune` | ✅     | ✅     | ✅     | 严格镜像         |

### 5.2 原子化写入

所有配置文件写入都必须原子化：

```typescript
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    // 1. 写入临时文件
    await fs.writeFile(tempPath, content, "utf-8");

    // 2. fsync 确保落盘
    const fd = await fs.open(tempPath, "r+");
    await fd.sync();
    await fd.close();

    // 3. 原子化 rename
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // 清理临时文件
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}
```

### 5.3 环境变量保留

写入 MCP 配置时，必须保留环境变量不被展开：

```typescript
// ❌ 错误：JSON.stringify 会破坏变量
const config = {
  env: {
    TOKEN: "${env:GITHUB_TOKEN}",
  },
};
JSON.stringify(config); // "TOKEN": "${env:GITHUB_TOKEN}" ✓ 这个 OK

// ⚠️ 但要注意：不能先 parse 环境变量再 stringify
const expanded = expandEnv(config); // ❌ 会展开变量
JSON.stringify(expanded); // "TOKEN": "ghp_abc123..." ✗ 变量丢失
```

**解决方案**: 使用字符串直接替换，不经过环境变量展开：

```typescript
function preserveEnvVars(content: string): string {
  // 保留所有 ${...} 格式的变量
  return content; // 不做任何展开
}
```

---

## 6. Adapter 架构

### 6.1 核心接口

```typescript
interface ToolAdapter {
  readonly name: string;
  readonly supportedFeatures: FeatureSet;

  // 初始化
  init(config: ToolConfig): Promise<void>;

  // 读取配置（标准化）
  readSkills(): Promise<Skill[]>;
  readMCPServers(): Promise<MCPServer[]>;

  // 写入配置（编译）
  writeSkills(skills: Skill[]): Promise<WriteResult>;
  writeMCPServers(servers: MCPServer[]): Promise<WriteResult>;

  // 删除配置
  deleteSkill(name: string): Promise<void>;
  deleteMCPServer(name: string): Promise<void>;

  // 验证
  validate(): Promise<ValidationResult>;
}
```

### 6.2 统一数据模型

```typescript
interface Skill {
  name: string;
  description: string;
  content: string; // SKILL.md 正文
  metadata: Record<string, any>; // frontmatter
  files?: Record<string, string>; // 支持文件
  hash?: string; // 用于差异检测
}

interface MCPServer {
  name: string;
  type: "stdio" | "http" | "oauth";

  // stdio
  command?: string;
  args?: string[];

  // http / oauth
  url?: string;
  headers?: Record<string, string>;

  // oauth
  auth?: {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    scopes: string[];
  };

  env?: Record<string, string>;
  hash?: string;
}
```

### 6.3 MCP 编译器示例

#### Claude Code 编译器

```typescript
async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
  const mcpConfig: any = { mcpServers: {} };

  for (const server of servers) {
    const serverConfig: any = {
      command: server.command,
      args: server.args,
    };

    if (server.env) {
      // 保留环境变量格式不变
      serverConfig.env = server.env;
    }

    mcpConfig.mcpServers[server.name] = serverConfig;
  }

  // 原子化写入
  await atomicWrite('.mcp.json', JSON.stringify(mcpConfig, null, 2));

  return { success: true, count: servers.length };
}
```

#### OpenCode 编译器

```typescript
async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
  // 1. 读取现有配置（保留其他字段和注释）
  let existingConfig = {};
  try {
    const content = await fs.readFile('opencode.jsonc', 'utf-8');
    existingConfig = jsonc.parse(content);  // 使用 JSONC 解析器
  } catch {
    // 文件不存在
  }

  // 2. 只更新 mcp 字段
  const mcpConfig: any = {};

  for (const server of servers) {
    const serverConfig: any = {
      type: server.type,
    };

    if (server.type === 'stdio') {
      serverConfig.command = server.command;
      serverConfig.args = server.args;
      if (server.env) {
        // OpenCode 格式：${VAR} (无 env: 前缀)
        serverConfig.env = this.normalizeEnvVars(server.env);
      }
    } else if (server.type === 'remote') {
      serverConfig.url = server.url;
      if (server.headers) {
        serverConfig.headers = server.headers;
      }
    }

    mcpConfig[server.name] = serverConfig;
  }

  // 3. 合并配置
  const finalConfig = {
    ...existingConfig,
    mcp: mcpConfig,
  };

  // 4. 使用 JSONC 序列化器（保留注释）
  const content = jsonc.stringify(finalConfig, null, 2);

  // 5. 原子化写入
  await atomicWrite('opencode.jsonc', content);

  return { success: true, count: servers.length };
}

private normalizeEnvVars(env: Record<string, string>): Record<string, string> {
  // 将 ${env:VAR} 转换为 ${VAR}
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    normalized[key] = value.replace(/\$\{env:(\w+)\}/g, '${$1}');
  }
  return normalized;
}
```

#### Cursor 编译器

```typescript
async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
  const mcpConfig: any = { mcpServers: {} };

  for (const server of servers) {
    const serverConfig: any = {};

    if (server.type === 'stdio') {
      serverConfig.command = server.command;
      serverConfig.args = server.args;
      if (server.env) {
        // Cursor 支持完整变量插值，原样保留
        serverConfig.env = server.env;
      }
    } else if (server.type === 'http') {
      serverConfig.url = server.url;
      if (server.headers) {
        serverConfig.headers = server.headers;
      }
    } else if (server.type === 'oauth') {
      serverConfig.url = server.url;
      if (server.auth) {
        serverConfig.auth = server.auth;
      }
    }

    mcpConfig.mcpServers[server.name] = serverConfig;
  }

  // 原子化写入
  await atomicWrite('.cursor/mcp.json', JSON.stringify(mcpConfig, null, 2));

  return { success: true, count: servers.length };
}
```

---

## 7. 差异计划系统

### 7.1 差异计算流程

```
读取源配置 (Source)
       ↓
读取目标配置 (Target)
       ↓
读取 Manifest (Last Synced)
       ↓
计算三方差异
       ↓
生成操作计划 (Plan)
       ↓
显示计划并请求确认
       ↓
执行计划 (Apply)
       ↓
更新 Manifest
```

### 7.2 差异判定逻辑

```typescript
interface DiffResult {
  toCreate: string[]; // 源有，目标无
  toUpdate: string[]; // 源和目标都有，但 hash 不同
  toDelete: string[]; // 目标有，源无（仅 prune 模式）
  toSkip: string[]; // hash 相同，跳过
}

function calculateDiff(
  source: ConfigItem[],
  target: ConfigItem[],
  manifest: Manifest,
  mode: "safe" | "prune",
): DiffResult {
  const result: DiffResult = {
    toCreate: [],
    toUpdate: [],
    toDelete: [],
    toSkip: [],
  };

  const sourceMap = new Map(source.map((s) => [s.name, s]));
  const targetMap = new Map(target.map((t) => [t.name, t]));

  // 检查源中的每一项
  for (const [name, sourceItem] of sourceMap) {
    const targetItem = targetMap.get(name);
    const manifestItem = manifest.items[name];

    if (!targetItem) {
      // 目标没有，需要创建
      result.toCreate.push(name);
    } else if (sourceItem.hash !== targetItem.hash) {
      // hash 不同，需要更新
      result.toUpdate.push(name);
    } else if (sourceItem.hash === manifestItem?.targets[targetName]) {
      // hash 相同且与 manifest 一致，跳过
      result.toSkip.push(name);
    } else {
      // hash 相同但与 manifest 不一致，需要更新
      result.toUpdate.push(name);
    }
  }

  // 检查目标中多余的项（仅 prune 模式）
  if (mode === "prune") {
    for (const name of targetMap.keys()) {
      if (!sourceMap.has(name)) {
        result.toDelete.push(name);
      }
    }
  }

  return result;
}
```

### 7.3 计划输出格式

```typescript
interface SyncPlan {
  tool: string;
  operations: {
    create: Array<{
      type: "skill" | "mcp";
      name: string;
      reason: string;
      hash: string;
    }>;
    update: Array<{
      type: "skill" | "mcp";
      name: string;
      reason: string;
      oldHash: string;
      newHash: string;
      diff?: string; // 可选的详细差异
    }>;
    delete: Array<{
      type: "skill" | "mcp";
      name: string;
      reason: string;
    }>;
    skip: Array<{
      type: "skill" | "mcp";
      name: string;
      reason: string;
    }>;
  };
}
```

### 7.4 Manifest 更新

```typescript
async function updateManifest(
  manifest: Manifest,
  plan: SyncPlan,
  results: WriteResult[],
): Promise<void> {
  const now = new Date().toISOString();

  for (const op of plan.operations.create) {
    manifest.items[`${op.type}/${op.name}`] = {
      hash: op.hash,
      last_synced: now,
      targets: {
        [plan.tool]: op.hash,
      },
    };
  }

  for (const op of plan.operations.update) {
    const key = `${op.type}/${op.name}`;
    if (!manifest.items[key]) {
      manifest.items[key] = {
        hash: op.newHash,
        last_synced: now,
        targets: {},
      };
    }
    manifest.items[key].hash = op.newHash;
    manifest.items[key].last_synced = now;
    manifest.items[key].targets[plan.tool] = op.newHash;
  }

  for (const op of plan.operations.delete) {
    const key = `${op.type}/${op.name}`;
    if (manifest.items[key]?.targets) {
      delete manifest.items[key].targets[plan.tool];
    }
  }

  manifest.last_sync = now;

  await atomicWrite(
    ".vsync-cache/manifest.json",
    JSON.stringify(manifest, null, 2),
  );
}
```

---

## 8. 实施路线与版本状态

### 8.1 v1.0 (MVP) ✅ 已完成

**目标**: 打通核心流程，验证价值

**包含功能**:

- ✅ Project 层配置
- ✅ Claude Code、Cursor、OpenCode 支持
- ✅ Skills 和 MCP 同步
- ✅ Safe 模式 (不删除)
- ✅ Prune 模式 (严格镜像)
- ✅ 智能差异计划系统
- ✅ Manifest 管理 (hash-based)
- ✅ 原子写入 (crash-safe)
- ✅ 612 个测试通过

### 8.2 v1.1 ✅ 已完成

**目标**: 扩展功能，支持更多配置类型和工具

**新增功能**:

- ✅ User 层配置 (~/.vsync.json)
- ✅ Agents 同步
- ✅ Commands 同步
- ✅ Codex 支持 (TOML 格式)
- ✅ Import 命令
- ✅ Clean 命令增强

### 8.3 v1.2 ✅ 当前版本

**目标**: 性能优化与用户体验改进

**新增功能**:

- ✅ 多语言支持 (English & 中文)
- ✅ Symlinks 支持 (Skills 可选符号链接)
- ✅ 性能优化 (并行操作、智能缓存)
- ✅ 更友好的错误提示
- ✅ 生产级稳定性

### 8.4 v1.3 🔜 计划中

**目标**: 自动化与集成

**计划功能**:

- [ ] Watch 模式 (文件变更自动同步)
- [ ] GitHub Actions 集成
- [ ] Pre-commit hooks
- [ ] 验证功能改进

### 8.5 开发总结 (已完成)

#### 核心架构

- ✅ TypeScript 5 严格模式
- ✅ pnpm Monorepo 结构
- ✅ Commander.js CLI 框架
- ✅ Adapter 模式 (可扩展)
- ✅ 统一数据模型

#### Adapter 实现

- ✅ ClaudeCodeAdapter
- ✅ CursorAdapter
- ✅ OpenCodeAdapter
- ✅ CodexAdapter (TOML)

#### 核心功能

- ✅ 差异计划系统
- ✅ Manifest 管理
- ✅ 原子写入
- ✅ Symlink 支持
- ✅ i18n 支持

#### CLI 命令

- ✅ `init` - 初始化配置
- ✅ `sync` - 同步配置
- ✅ `plan` - 查看计划
- ✅ `status` - 查看状态
- ✅ `list` - 列出配置
- ✅ `clean` - 清理配置
- ✅ `import` - 导入配置

#### 测试

- ✅ 612 个测试通过
- ✅ 45 个测试文件
- ✅ 单元测试 + 集成测试 + E2E 测试
- ✅ mock-fs 文件系统模拟

---

## 9. 总结

### 9.1 核心价值

**vsync 解决的核心问题**:

多个 AI 氛围编程工具 (Claude Code, Cursor, OpenCode, Codex) 各有各的配置目录和文件格式，导致：

- 手动复制配置繁琐易错
- 环境变量在不同格式间容易破坏
- 团队协作时配置不一致
- 管理多个工具成本高

**vsync 的解决方案**:

一条命令同步所有工具：

- 选一个工具作为源 (source of truth)
- 其他工具自动保持同步
- 智能格式转换 (JSON ↔ TOML ↔ JSONC)
- 环境变量语法自动适配
- 可选 symlink 节省磁盘空间

### 9.2 关键技术特性

1. **智能差异计划**: 3-way diff (源 vs 目标 vs manifest)
2. **多格式转换**: 每个工具有专门的 adapter
3. **环境变量保护**: 从不展开变量，保留原始语法
4. **原子写入**: temp → fsync → rename (crash-safe)
5. **Hash-based 追踪**: 快速判定是否需要同步
6. **Symlink 支持**: Skills 可选符号链接 (v1.2+)
7. **多语言 CLI**: 英文/中文自动适配 (v1.2+)

### 9.3 架构特点

- **Adapter 模式**: 易于扩展新工具
- **Type-safe**: TypeScript 严格模式
- **Well-tested**: 612 测试保证质量
- **Monorepo**: pnpm workspace 管理
- **CLI-first**: 专注命令行体验

### 9.4 技术栈

**核心**:

- TypeScript 5 (strict mode)
- Node.js >= 18 (用户) / >= 24 (开发)
- pnpm Monorepo

**CLI**:

- Commander.js - CLI 框架
- Inquirer.js - 交互提示
- chalk - 终端颜色
- ora - 加载动画

**解析**:

- jsonc-parser - JSONC 支持
- @iarna/toml - TOML 支持
- gray-matter - Frontmatter 解析

**测试**:

- Vitest - 测试框架
- mock-fs - 文件系统模拟
