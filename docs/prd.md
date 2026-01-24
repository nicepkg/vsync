# vibe-sync - AI 编程工具配置同步器

**版本**: 3.0.0 (最终可实施版本)
**日期**: 2026-01-24
**理念**: 单一配置源 → 多格式配置编译器 + 差异计划执行器

---

## 目录

1. [核心定位](#1-核心定位)
2. [配置格式精确映射表](#2-配置格式精确映射表)
3. [层级系统](#3-层级系统)
4. [CLI 命令设计](#4-cli-命令设计)
5. [同步模式与安全机制](#5-同步模式与安全机制)
6. [Adapter 架构](#6-adapter-架构)
7. [差异计划系统](#7-差异计划系统)
8. [MVP 实施路线](#8-mvp-实施路线)

---

## 1. 核心定位

### 1.1 我们在做什么

**不是**: 简单的文件拷贝工具
**而是**: 多格式配置编译器 + 差异计划执行器

```
单一配置源 (Source Tool)
       ↓
   读取配置
       ↓
   标准化数据模型 (Normalize)
       ↓
   计算差异 (Diff)
       ↓
   生成执行计划 (Plan)
       ↓
   用户确认 / Dry Run
       ↓
   按目标工具格式编译 (Compile)
       ↓
   原子化写入 (Apply)
       ↓
   更新 Manifest
```

### 1.2 管理的配置类型

| 配置类型     | MVP | v1.1 | 说明                         |
| ------------ | --- | ---- | ---------------------------- |
| **Skills**   | ✅  | ✅   | 可复用指令模板               |
| **MCP**      | ✅  | ✅   | 外部工具集成（**安全敏感**） |
| **Agents**   | ❌  | ✅   | 自定义 AI 代理               |
| **Commands** | ❌  | ✅   | 快捷命令                     |

### 1.3 支持的工具

| 工具            | MVP       | v1.1 | 说明                       |
| --------------- | --------- | ---- | -------------------------- |
| **Claude Code** | ✅ Source | ✅   | 功能最完整，推荐作为配置源 |
| **Cursor**      | ✅ Target | ✅   | 变量插值最强               |
| **OpenCode**    | ✅ Target | ✅   | 开源，配置格式独特         |
| **Codex**       | ❌        | ✅   | v1.1 支持                  |

---

## 2. 配置格式精确映射表

### 2.1 Skills 配置

所有工具都使用相同的 Agent Skills 标准：`<skill-name>/SKILL.md`

| 工具        | User 层                      | Project 层          |
| ----------- | ---------------------------- | ------------------- |
| Claude Code | `~/.claude/skills/`          | `.claude/skills/`   |
| Codex       | `~/.codex/skills/`           | `.codex/skills/`    |
| Cursor      | `~/.cursor/skills/`          | `.cursor/skills/`   |
| OpenCode    | `~/.config/opencode/skills/` | `.opencode/skills/` |

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

- 项目级: `.mcp.json`（**只支持项目级**）

**格式**: JSON

**结构**:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${env:DATABASE_URL}"
      }
    }
  }
}
```

**环境变量格式**: `${env:NAME}` 或 `${NAME}`

**关键特性**:

- ✅ 仅支持 stdio 传输
- ✅ 支持环境变量展开（**必须原样保留**）
- ⚠️ 写入时禁止 JSON 格式化破坏变量

---

#### Codex

**位置**:

- 全局: `~/.config/codex/config.json`
- 项目: `.codex/config.json`

**格式**: JSON

**结构**:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "mcp-server-postgres",
      "args": ["postgresql://localhost/mydb"]
    },
    "github": {
      "command": "mcp-server-github",
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

**环境变量格式**: **不支持插值**，直接写值

**关键特性**:

- ✅ 仅支持 stdio 传输
- ❌ 不支持变量插值
- ⚠️ 写入时只修改 `mcpServers` 字段，保留其他配置

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
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "PGPASSWORD": "${env:PGPASSWORD}",
        "DATA_DIR": "${workspaceFolder}/data"
      }
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
      }
    }
  }
}
```

**支持的变量插值**:

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

- 全局: `~/.config/opencode/opencode.json`
- 项目: `opencode.json` 或 `opencode.jsonc`

**格式**: JSON 或 JSONC（**支持注释**）

**结构**:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sqlite": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite"],
      "env": {
        "DATABASE_PATH": "${workspaceFolder}/data/app.db"
      }
    },
    "jira": {
      "type": "remote",
      "url": "https://jira.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${JIRA_TOKEN}"
      }
    }
  }
}
```

**环境变量格式**: `${NAME}`（无 `env:` 前缀）

**关键特性**:

- ⚠️ **根字段名是 `mcp` 而非 `mcpServers`**
- ✅ 必须指定 `type` 字段：`"stdio"` 或 `"remote"`
- ✅ 支持 JSONC 格式（**必须保留注释**）
- ⚠️ 写入时只修改 `mcp` 字段，保留其他配置

---

### 2.3 MCP 配置对比总结表

| 特性             | Claude Code         | Codex         | Cursor            | OpenCode           |
| ---------------- | ------------------- | ------------- | ----------------- | ------------------ |
| **配置文件**     | `.mcp.json`         | `config.json` | `mcp.json`        | `opencode.json(c)` |
| **MCP 字段名**   | `mcpServers`        | `mcpServers`  | `mcpServers`      | `mcp` ⚠️           |
| **User 层支持**  | ❌                  | ✅            | ✅                | ✅                 |
| **HTTP 传输**    | ❌                  | ❌            | ✅                | ✅                 |
| **环境变量格式** | `${env:X}` / `${X}` | ❌ 不支持     | `${env:X}` + 5 种 | `${X}`             |
| **注释支持**     | ❌                  | ❌            | ❌                | ✅ JSONC           |
| **type 字段**    | ❌ 隐式             | ❌ 隐式       | ❌ 隐式           | ✅ 必填            |

---

## 3. 层级系统

### 3.1 层级定义

```bash
# Project 层（默认）
vibe-sync sync          # 操作当前项目 .vibe-sync.json

# User 层（全局）
vibe-sync sync --user   # 操作 ~/.vibe-sync.json
```

### 3.2 配置文件结构

**Project 层**: `<project>/.vibe-sync.json`
**User 层**: `~/.vibe-sync.json`

```json
{
  "$schema": "https://vibe-sync.dev/schema.json",
  "version": "3.0.0",
  "level": "project",
  "source_tool": "claude-code",
  "target_tools": ["cursor", "opencode"],
  "sync_config": {
    "skills": true,
    "mcp": true
  },
  "mcp_security": {
    "require_confirmation": true,
    "allowed_commands": ["npx @modelcontextprotocol/*"],
    "allowed_domains": ["https://api.linear.app", "https://api.notion.com"]
  },
  "last_sync": "2026-01-24T10:30:00Z"
}
```

### 3.3 Manifest 文件（新增）

**位置**: `.vibe-sync-cache/manifest.json`

**作用**: 记录每个配置项的 hash，用于快速判定是否需要同步

```json
{
  "version": "1.0.0",
  "last_sync": "2026-01-24T10:30:00Z",
  "items": {
    "skill/git-release": {
      "hash": "sha256:abc123...",
      "last_synced": "2026-01-24T10:30:00Z",
      "targets": {
        "cursor": "sha256:abc123...",
        "opencode": "sha256:abc123..."
      }
    },
    "mcp/sqlite": {
      "hash": "sha256:def456...",
      "last_synced": "2026-01-24T10:30:00Z",
      "targets": {
        "cursor": "sha256:def456...",
        "opencode": "sha256:def456..."
      }
    }
  }
}
```

---

## 4. CLI 命令设计

### 4.1 命令概览

```bash
vibe-sync init [--user]                    # 初始化配置
vibe-sync sync [--user] [--dry-run] [--prune]  # 同步配置
vibe-sync import <path> [--user]           # 从其他项目导入
vibe-sync clean [name] [--user]            # 清理目标工具配置
vibe-sync status [--user]                  # 查看同步状态
vibe-sync list [type] [--user]             # 列出配置
vibe-sync plan [--user]                    # 查看同步计划（不执行）
```

### 4.2 `vibe-sync init` - 初始化

**触发时机**: 任何命令找不到 `.vibe-sync.json` 时自动触发

**交互流程**:

```bash
$ vibe-sync init

🚀 Welcome to vibe-sync!

? Which AI coding tools do you use? (Space to select, Enter to confirm)
  ◉ Claude Code (Recommended as source)
  ◉ Cursor
  ◉ OpenCode
  ◯ Codex (v1.1 support)

? Which tool should be the configuration source?
  ❯ Claude Code (Most features, recommended)
    Cursor (Best variable interpolation)
    OpenCode (Open source)

? What do you want to sync? (MVP: Skills + MCP only)
  ◉ Skills
  ◉ MCP Servers

✓ Configuration saved to .vibe-sync.json
✓ Run `vibe-sync sync` to start syncing
```

### 4.3 `vibe-sync sync` - 同步配置

**核心功能**: 从配置源读取 → 计算差异 → 生成计划 → 执行同步

#### 基础用法

```bash
# Project 层同步（默认 safe 模式）
vibe-sync sync

# Prune 模式（严格镜像，会删除目标多余项）
vibe-sync sync --prune

# Dry Run（仅显示计划，不执行）
vibe-sync sync --dry-run

# User 层同步
vibe-sync sync --user
```

#### 输出示例（Safe 模式）

```bash
$ vibe-sync sync

📖 Reading source (claude-code)...
  ✓ Found 3 skills
  ✓ Found 2 MCP servers

📊 Analyzing differences...
  Skills:
    • git-release: source hash changed (will update)
    • api-conventions: unchanged (skip)
    • deploy-prod: new in source (will create)

  MCP Servers:
    • sqlite: unchanged (skip)
    • github: source hash changed (will update)

🔒 Security check for MCP changes...
  ⚠️  New MCP server detected: Will show details for confirmation

──────────────────────────────────────────────────────────

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
$ vibe-sync sync --prune

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

#### MCP 安全确认示例

```bash
$ vibe-sync sync

📖 Reading source...
  ✓ Found 1 NEW MCP server: postgres

──────────────────────────────────────────────────────────

🔒 New MCP Server Detected

Name:         postgres
Type:         stdio
Command:      npx -y @modelcontextprotocol/server-postgres
Environment:  DATABASE_URL=${env:DATABASE_URL}

⚠️  This MCP server will execute commands on your system.

? Allow syncing this MCP server to cursor, opencode? (y/N) y

✓ MCP server whitelisted
```

### 4.4 `vibe-sync clean` - 清理目标配置

**功能**: 从目标工具移除配置（**不动配置源**）

**基础用法**:

```bash
# 删除单个配置
vibe-sync clean skill/old-skill

# 交互式批量选择
vibe-sync clean

# 从配置源和所有目标删除（危险！）
vibe-sync clean skill/old-skill --from-source

# User 层清理
vibe-sync clean --user
```

#### 单个删除示例

```bash
$ vibe-sync clean skill/old-skill

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
$ vibe-sync clean skill/old-skill --from-source

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
$ vibe-sync clean

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

### 4.5 `vibe-sync import` - 导入配置

```bash
$ vibe-sync import ../other-project

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

### 4.6 `vibe-sync plan` - 查看同步计划

**功能**: 显示详细的同步计划（相当于 `sync --dry-run`）

```bash
$ vibe-sync plan

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

Run `vibe-sync sync` to apply this plan
```

### 4.7 `vibe-sync status` - 查看状态

```bash
$ vibe-sync status

Configuration Status (Project)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source Tool:       claude-code
Target Tools:      cursor, opencode
Last Sync:         2026-01-24 10:30:00 (2 hours ago)
Configuration:     .vibe-sync.json
Manifest:          .vibe-sync-cache/manifest.json

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

Run `vibe-sync plan` to see sync plan
```

### 4.8 `vibe-sync list` - 列出配置

```bash
$ vibe-sync list skills

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

| 模式      | 命令                     | CREATE | UPDATE | DELETE | 适用场景         |
| --------- | ------------------------ | ------ | ------ | ------ | ---------------- |
| **Safe**  | `vibe-sync sync`         | ✅     | ✅     | ❌     | 日常同步（默认） |
| **Prune** | `vibe-sync sync --prune` | ✅     | ✅     | ✅     | 严格镜像         |

### 5.2 MCP 安全机制

#### 首次同步 MCP Server 必须确认

```json
{
  "mcp_security": {
    "require_confirmation": true,
    "allowed_commands": [
      "npx @modelcontextprotocol/*",
      "npx -y @modelcontextprotocol/*"
    ],
    "allowed_domains": [
      "https://api.linear.app",
      "https://api.notion.com",
      "https://mcp.*.com"
    ],
    "denied_commands": ["rm", "curl", "wget"]
  }
}
```

#### 安全检查流程

```
检测到新 MCP Server
       ↓
检查 command 是否在 allowed_commands
       ↓ No
显示详情并要求用户确认
       ↓
用户批准
       ↓
添加到白名单并继续同步
```

### 5.3 原子化写入

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

### 5.4 环境变量保留

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
    ".vibe-sync-cache/manifest.json",
    JSON.stringify(manifest, null, 2),
  );
}
```

---

## 8. MVP 实施路线

### 8.1 MVP 范围

**目标**: 打通核心流程，验证价值

**包含**:

- ✅ Project 层（User 层 v1.1）
- ✅ Claude Code 作为配置源
- ✅ Cursor 和 OpenCode 作为目标
- ✅ 只同步 Skills 和 MCP
- ✅ Safe 模式同步
- ✅ Prune 模式同步
- ✅ MCP 安全确认
- ✅ 差异计划系统
- ✅ Manifest 管理
- ✅ 原子化写入

**不包含**:

- ❌ Agents 和 Commands（v1.1）
- ❌ Codex 支持（v1.1）
- ❌ User 层（v1.1）
- ❌ import 命令（v1.1）

### 8.2 开发阶段

#### Phase 1: 基础架构（1-2 天）

- [ ] 项目初始化（TypeScript + Commander.js）
- [ ] 统一数据模型定义
- [ ] ToolAdapter 接口定义
- [ ] 配置文件结构定义

#### Phase 2: Adapter 实现（3-5 天）

- [ ] ClaudeCodeAdapter (Skills + MCP 读取)
- [ ] CursorAdapter (Skills + MCP 写入)
- [ ] OpenCodeAdapter (Skills + MCP 写入)
- [ ] 单元测试（mock-fs）

#### Phase 3: 差异计划系统（2-3 天）

- [ ] Hash 计算
- [ ] 差异计算逻辑
- [ ] 计划生成器
- [ ] Manifest 管理

#### Phase 4: CLI 命令（2-3 天）

- [ ] `init` 命令
- [ ] `sync` 命令（safe + prune）
- [ ] `plan` 命令
- [ ] `status` 命令
- [ ] `list` 命令
- [ ] `clean` 命令

#### Phase 5: 安全机制（1-2 天）

- [ ] MCP 安全确认
- [ ] 原子化写入
- [ ] 环境变量保留

#### Phase 6: 测试与优化（2-3 天）

- [ ] 集成测试
- [ ] 端到端测试
- [ ] 错误处理优化
- [ ] 用户体验优化

**总计**: 11-18 天

### 8.3 v1.1 路线图

- User 层支持
- Agents 同步
- Commands 同步
- Codex 支持
- import 命令
- 性能优化

---

## 总结

### 核心理念

**我们不是在做文件同步器，而是在做：**

- 多格式配置编译器
- 差异计划执行器
- 安全敏感配置管理器

### 关键技术点

1. **按工具格式编译**: 每个工具有自己的序列化器
2. **环境变量保留**: 不展开变量
3. **原子化写入**: 避免半写入状态
4. **差异计划系统**: read → normalize → diff → plan → apply
5. **Manifest 管理**: 快速判定是否需要同步
6. **MCP 安全机制**: 首次确认 + 白名单

### 技术栈

- **TypeScript** (类型安全)
- **Commander.js** (CLI 框架)
- **Inquirer.js** (交互式提示)
- **chalk** (终端颜色)
- **ora** (加载动画)
- **jsonc-parser** (JSONC 支持)
- **gray-matter** (frontmatter 解析)
- **Vitest + mock-fs** (测试)

---

**准备开干了吗？** 🚀
