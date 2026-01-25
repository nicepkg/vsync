<div align="center">

<img src="website/public/icon.svg" width="120" height="120" />

# vibe-sync

### **一处配置,多个 AI 工具同步,不再折腾**

[![GitHub stars](https://img.shields.io/github/stars/nicepkg/vibe-sync?style=social)](https://github.com/nicepkg/vibe-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/nicepkg/vibe-sync/pulls)

简体中文 | [English](./README.md)

<img src="https://img.shields.io/badge/Claude_Code-已支持-blueviolet?style=for-the-badge&logo=anthropic" />
<img src="https://img.shields.io/badge/Cursor-已支持-blue?style=for-the-badge" />
<img src="https://img.shields.io/badge/OpenCode-已支持-green?style=for-the-badge" />
<img src="https://img.shields.io/badge/Codex-即将支持-orange?style=for-the-badge" />

---

**AI 编程工具的多格式配置编译器与差异计划系统**

一条命令,同步 Skills 和 MCP servers 到所有 AI 工具。

[立即开始](#-快速开始) · [功能特性](#-功能特性) · [文档](https://vibe-sync.xiaominglab.com)

</div>

---

## ✨ 为什么选择 vibe-sync?

> **厌倦了在 Claude Code、Cursor 和 OpenCode 之间手动复制 Skills 和 MCP 配置?**
>
> vibe-sync 不只是文件复制工具,而是一个**多格式配置编译器**,配备差异计划系统,让你的 AI 编程工具保持完美和谐。

### 我们解决的痛点

| 😫 没有 vibe-sync | 🎉 有了 vibe-sync |
|:------------------|:-----------------|
| 📋 在工具之间手动复制粘贴配置 | ⚡ 一条命令自动同步所有内容 |
| 🔥 迁移时环境变量总是出错 | 🛡️ 所有格式下安全保留变量 |
| 🤷 不知道哪些配置已过期 | 📊 差异计划准确显示将要发生的变更 |
| ⚠️ 删除有风险,没有预览 | ✅ 默认安全模式,需要时可用 Prune 模式 |
| 🔧 不同工具,不同 JSON 格式 | 🎯 格式转换透明处理 |

### 核心优势

```
📚  单一配置源      → 所有工具保持同步
🎯  差异计划系统    → 应用前预览变更
⚡  Safe & Prune 模式 → 选择你的同步策略
🔒  MCP 安全检查    → 新服务器首次确认
🌈  多工具支持      → Claude Code、Cursor、OpenCode、Codex (v1.1)
```

---

## 🎯 功能特性

| 功能 | 说明 | 状态 |
|:-----|:-----|:-----|
| **Skills 同步** | 跨工具同步 Agent Skills | ✅ MVP |
| **MCP 同步** | 带安全检查的 MCP 服务器同步 | ✅ MVP |
| **差异计划** | 应用前预览变更 | ✅ MVP |
| **Safe 模式** | 仅添加和更新,不删除 | ✅ MVP |
| **Prune 模式** | 严格镜像,包含删除 | ✅ MVP |
| **原子写入** | 全有或全无的文件操作 | ✅ MVP |
| **Manifest 追踪** | 基于哈希的变更检测 | ✅ MVP |
| **User 层** | 全局配置 (~/.vibe-sync.json) | 🔜 v1.1 |
| **Agents 同步** | 自定义 AI 代理 | 🔜 v1.1 |
| **Commands 同步** | 快捷命令 | 🔜 v1.1 |
| **Codex 支持** | 完整 Codex 集成 | 🔜 v1.1 |

---

## ⚡ 快速开始

### 安装

```bash
# 使用 npm (即将推出)
npm install -g vibe-sync

# 使用 pnpm
pnpm add -g vibe-sync

# 使用 yarn
yarn global add vibe-sync
```

### 初始化

```bash
# 项目级配置
vibe-sync init

# 用户级(全局)配置
vibe-sync init --user
```

**交互式提示:**
```
🚀 欢迎使用 vibe-sync!

? 你使用哪些 AI 编程工具?
  ◉ Claude Code (推荐作为配置源)
  ◉ Cursor
  ◉ OpenCode

? 选择配置源工具?
  ❯ Claude Code

? 要同步什么内容?
  ◉ Skills
  ◉ MCP Servers

✓ 配置已保存到 .vibe-sync.json
```

### 同步配置

```bash
# Safe 模式 (默认: 不删除)
vibe-sync sync

# 预览变更但不应用
vibe-sync sync --dry-run

# 严格镜像 (删除目标中的多余项)
vibe-sync sync --prune
```

**示例输出:**
```
📖 读取源配置 (claude-code)...
  ✓ 找到 3 个 skills
  ✓ 找到 2 个 MCP servers

📊 分析差异...

📋 同步计划 (Safe 模式)

cursor:
  CREATE:
    • skill/deploy-prod
  UPDATE:
    • skill/git-release
    • mcp/github

? 继续同步? (Y/n) y

✓ 同步完成,耗时 1.2s
```

---

## 🛠 CLI 命令

### 核心命令

```bash
# 初始化配置
vibe-sync init [--user]

# 同步配置
vibe-sync sync [--user] [--dry-run] [--prune]

# 查看同步计划但不执行
vibe-sync plan [--user]

# 检查同步状态
vibe-sync status [--user]

# 列出配置
vibe-sync list [skills|mcp] [--user]

# 从目标清理配置
vibe-sync clean [name] [--user] [--from-source]

# 从其他项目导入
vibe-sync import <path> [--user]
```

### 示例工作流

**1. 更新 Skills 后的日常同步:**
```bash
# 在 Claude Code 中编辑你的 Skills
vim ~/.claude/skills/my-skill/SKILL.md

# 同步到所有目标工具
vibe-sync sync
```

**2. 应用前预览变更:**
```bash
vibe-sync plan
# 查看计划
vibe-sync sync
```

**3. 严格镜像模式 (删除过期配置):**
```bash
vibe-sync sync --prune
```

**4. 清理一个 skill:**
```bash
# 仅从目标清理 (源不变)
vibe-sync clean skill/old-skill

# 从源和所有目标删除 (危险!)
vibe-sync clean skill/old-skill --from-source
```

**5. 从其他项目导入配置:**
```bash
vibe-sync import ../other-project
```

---

## 📋 配置文件

### .vibe-sync.json

**项目级:** `<project>/.vibe-sync.json`
**用户级:** `~/.vibe-sync.json`

```json
{
  "$schema": "https://vibe-sync.xiaominglab.com/schema.json",
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
    "allowed_domains": ["https://api.linear.app"]
  },
  "language": "zh"
}
```

**语言配置** (仅用户级配置):
```json
{
  "language": "zh"  // 选项: "en" (英文) 或 "zh" (中文)
}
```

首次运行时，vibe-sync 会提示您选择首选语言。此偏好设置将保存到 `~/.vibe-sync.json` 并应用于所有 CLI 输出。

### 支持的工具和路径

| 工具 | Skills 路径 | MCP 配置路径 |
|:-----|:-----------|:------------|
| **Claude Code** | `.claude/skills/` | `.mcp.json` |
| **Cursor** | `.cursor/skills/` | `.cursor/mcp.json` |
| **OpenCode** | `.opencode/skills/` | `opencode.json` |
| **Codex** | `.codex/skills/` | `.codex/config.json` (v1.1) |

---

## 🔒 MCP 安全机制

**首次 MCP 同步需要确认:**

```bash
$ vibe-sync sync

🔒 检测到新的 MCP Server

名称:         postgres
类型:         stdio
命令:         npx -y @modelcontextprotocol/server-postgres
环境变量:     DATABASE_URL=${env:DATABASE_URL}

⚠️  此 MCP server 将在你的系统上执行命令。

? 允许将此 MCP server 同步到 cursor、opencode? (y/N)
```

**安全特性:**
- ✅ 首次确认必需
- ✅ 命令白名单支持
- ✅ HTTP 服务器域名白名单
- ✅ 环境变量保留 (从不展开)

---

## 🎨 同步模式

### Safe 模式 (默认)

**功能:**
- ✅ 创建新项
- ✅ 更新现有项
- ❌ **从不删除**

```bash
vibe-sync sync
```

### Prune 模式

**功能:**
- ✅ 创建新项
- ✅ 更新现有项
- ⚠️ **删除源中没有的项**

```bash
vibe-sync sync --prune
```

**使用场景:** 需要严格镜像时 (例如清理旧配置)

---

## 🏗 架构设计

### 核心流程

```
源工具 (例如 Claude Code)
       ↓
  读取 & 标准化
       ↓
  计算差异
       ↓
  生成计划
       ↓
  用户确认
       ↓
  编译为目标格式
       ↓
  原子写入
       ↓
  更新 Manifest
```

### 关键技术特性

- **多格式编译器**: 每个工具都有自己的序列化器
- **环境变量保留**: 从不展开 `${env:VAR}`
- **原子写入**: 临时文件 + fsync + rename
- **差异计划**: 三方比较 (源、目标、manifest)
- **基于哈希的追踪**: 快速变更检测

---

## 🧪 技术栈

- **TypeScript** - 类型安全
- **Commander.js** - CLI 框架
- **Inquirer.js** - 交互式提示
- **chalk** - 终端颜色
- **ora** - 加载动画
- **jsonc-parser** - JSONC 支持 (用于 OpenCode)
- **gray-matter** - Frontmatter 解析 (用于 Skills)

---

## 🤝 贡献

欢迎贡献! 你可以这样帮助我们:

- ⭐ **Star 本仓库** - 帮助他人发现这个项目
- 🐛 **报告 bug** - 如果有问题请提 issue
- 💡 **建议功能** - 什么能让它变得更好?
- 🔧 **提交 PR** - 改进代码、文档或添加功能

查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献指南。

### 开发

```bash
# 克隆仓库
git clone https://github.com/nicepkg/vibe-sync.git
cd vibe-sync

# 安装依赖
pnpm install

# 开发模式运行
pnpm dev

# 构建
pnpm build

# 测试
pnpm test
```

### 贡献者

<a href="https://github.com/nicepkg/vibe-sync/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nicepkg/vibe-sync" />
</a>

---

## 📚 路线图

### v1.0 (MVP) ✅ 当前版本
- [x] Skills 同步
- [x] MCP 同步
- [x] Safe & Prune 模式
- [x] 差异计划
- [x] Claude Code、Cursor、OpenCode 支持

### v1.1 🔜 下一步
- [ ] User 层配置
- [ ] Agents 同步
- [ ] Commands 同步
- [ ] Codex 支持
- [ ] 导入/导出增强

### v2.0 🚀 未来
- [ ] Web UI 控制面板
- [ ] 团队共享
- [ ] 云同步
- [ ] 配置模板

---

## 📄 许可证

MIT © [nicepkg](https://github.com/nicepkg)

---

<div align="center">

**如果这个项目对你有帮助,请考虑给它一个 ⭐**

<a href="https://github.com/nicepkg/vibe-sync">
  <img src="https://img.shields.io/github/stars/nicepkg/vibe-sync?style=for-the-badge&logo=github&color=yellow" alt="GitHub stars" />
</a>

用 ❤️ 制作 by [nicepkg](https://github.com/nicepkg)

</div>
