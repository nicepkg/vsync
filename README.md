<div align="center">

<img src="website/public/icon.svg" width="120" height="120" />

# vibe-sync

### **One config. Many AI tools. Zero pain.**

[![GitHub stars](https://img.shields.io/github/stars/nicepkg/vibe-sync?style=social)](https://github.com/nicepkg/vibe-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/nicepkg/vibe-sync/pulls)

[简体中文](./README_cn.md) | English

<img src="https://img.shields.io/badge/Claude_Code-Supported-blueviolet?style=for-the-badge&logo=anthropic" />
<img src="https://img.shields.io/badge/Cursor-Supported-blue?style=for-the-badge" />
<img src="https://img.shields.io/badge/OpenCode-Supported-green?style=for-the-badge" />
<img src="https://img.shields.io/badge/Codex-Coming_Soon-orange?style=for-the-badge" />

---

**A multi-format configuration compiler and diff planner for AI coding tools**

One command. Sync Skills and MCP servers across all your AI tools.

[Get Started](#-quick-start) · [Features](#-features) · [Documentation](https://vibe-sync.xiaominglab.com)

</div>

---

## ✨ Why vibe-sync?

> **Tired of manually copying Skills and MCP configs between Claude Code, Cursor, and OpenCode?**
>
> vibe-sync is not just a file copier—it's a **multi-format configuration compiler** with diff planning that keeps your AI coding tools in perfect harmony.

### The Problem We Solve

| 😫 Without vibe-sync | 🎉 With vibe-sync |
|:---------------------|:------------------|
| 📋 Copy-paste configs manually between tools | ⚡ One command syncs everything automatically |
| 🔥 Environment variables break during migration | 🛡️ Variables preserved safely across all formats |
| 🤷 No idea which configs are outdated | 📊 Diff planning shows exactly what will change |
| ⚠️ Risky deletions, no preview | ✅ Safe mode by default, Prune mode when needed |
| 🔧 Different tools, different JSON formats | 🎯 Format conversion handled transparently |

### Key Benefits

```
📚  Single Source of Truth → All tools stay in sync
🎯  Diff Planning System  → Preview changes before applying
⚡  Safe & Prune Modes    → Choose your sync strategy
🔒  MCP Security Checks  → First-time confirmation for new servers
🌈  Multi-Tool Support   → Claude Code, Cursor, OpenCode, Codex (v1.1)
```

---

## 🎯 Features

| Feature | Description | Status |
|:--------|:------------|:-------|
| **Skills Sync** | Sync Agent Skills across all tools | ✅ MVP |
| **MCP Sync** | Sync MCP servers with security checks | ✅ MVP |
| **Diff Planning** | Preview changes before applying | ✅ MVP |
| **Safe Mode** | Add & update only, no deletions | ✅ MVP |
| **Prune Mode** | Strict mirroring with deletions | ✅ MVP |
| **Atomic Writes** | All-or-nothing file operations | ✅ MVP |
| **Manifest Tracking** | Hash-based change detection | ✅ MVP |
| **User Layer** | Global configs (~/.vibe-sync.json) | 🔜 v1.1 |
| **Agents Sync** | Custom AI agents | 🔜 v1.1 |
| **Commands Sync** | Quick commands | 🔜 v1.1 |
| **Codex Support** | Full Codex integration | 🔜 v1.1 |

---

## ⚡ Quick Start

### Installation

```bash
# Using npm (coming soon)
npm install -g vibe-sync

# Using pnpm
pnpm add -g vibe-sync

# Using yarn
yarn global add vibe-sync
```

### Initialize

```bash
# Project-level configuration
vibe-sync init

# User-level (global) configuration
vibe-sync init --user
```

**Interactive prompts:**
```
🚀 Welcome to vibe-sync!

? Which AI coding tools do you use?
  ◉ Claude Code (Recommended as source)
  ◉ Cursor
  ◉ OpenCode

? Which tool should be the configuration source?
  ❯ Claude Code

? What do you want to sync?
  ◉ Skills
  ◉ MCP Servers

✓ Configuration saved to .vibe-sync.json
```

### Sync Your Configs

```bash
# Safe mode (default: no deletions)
vibe-sync sync

# Preview changes without applying
vibe-sync sync --dry-run

# Strict mirroring (deletes extra items in targets)
vibe-sync sync --prune
```

**Example output:**
```
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

? Proceed with sync? (Y/n) y

✓ Sync completed in 1.2s
```

---

## 🛠 CLI Commands

### Core Commands

```bash
# Initialize configuration
vibe-sync init [--user]

# Sync configurations
vibe-sync sync [--user] [--dry-run] [--prune]

# View sync plan without executing
vibe-sync plan [--user]

# Check sync status
vibe-sync status [--user]

# List configurations
vibe-sync list [skills|mcp] [--user]

# Clean configs from targets
vibe-sync clean [name] [--user] [--from-source]

# Import from another project
vibe-sync import <path> [--user]
```

### Example Workflows

**1. Daily sync after updating Skills:**
```bash
# Edit your Skills in Claude Code
vim ~/.claude/skills/my-skill/SKILL.md

# Sync to all target tools
vibe-sync sync
```

**2. Preview changes before applying:**
```bash
vibe-sync plan
# Review the plan
vibe-sync sync
```

**3. Strict mirror mode (delete outdated configs):**
```bash
vibe-sync sync --prune
```

**4. Clean up a skill from all targets:**
```bash
# From targets only (source unchanged)
vibe-sync clean skill/old-skill

# From source AND all targets (dangerous!)
vibe-sync clean skill/old-skill --from-source
```

**5. Import configs from another project:**
```bash
vibe-sync import ../other-project
```

---

## 📋 Configuration

### .vibe-sync.json

**Project-level:** `<project>/.vibe-sync.json`
**User-level:** `~/.vibe-sync.json`

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
  }
}
```

### Supported Tools & Paths

| Tool | Skills Path | MCP Config Path |
|:-----|:-----------|:---------------|
| **Claude Code** | `.claude/skills/` | `.mcp.json` |
| **Cursor** | `.cursor/skills/` | `.cursor/mcp.json` |
| **OpenCode** | `.opencode/skills/` | `opencode.json` |
| **Codex** | `.codex/skills/` | `.codex/config.json` (v1.1) |

---

## 🔒 MCP Security

**First-time MCP sync requires confirmation:**

```bash
$ vibe-sync sync

🔒 New MCP Server Detected

Name:         postgres
Type:         stdio
Command:      npx -y @modelcontextprotocol/server-postgres
Environment:  DATABASE_URL=${env:DATABASE_URL}

⚠️  This MCP server will execute commands on your system.

? Allow syncing this MCP server to cursor, opencode? (y/N)
```

**Security features:**
- ✅ First-time confirmation required
- ✅ Command whitelist support
- ✅ Domain whitelist for HTTP servers
- ✅ Environment variables preserved (never expanded)

---

## 🎨 Sync Modes

### Safe Mode (Default)

**What it does:**
- ✅ Create new items
- ✅ Update existing items
- ❌ **Never deletes**

```bash
vibe-sync sync
```

### Prune Mode

**What it does:**
- ✅ Create new items
- ✅ Update existing items
- ⚠️ **Deletes items not in source**

```bash
vibe-sync sync --prune
```

**Use when:** You want strict mirroring (e.g., cleaning up old configs)

---

## 🏗 Architecture

### Core Concepts

```
Source Tool (e.g., Claude Code)
       ↓
  Read & Normalize
       ↓
  Calculate Diff
       ↓
  Generate Plan
       ↓
  User Confirmation
       ↓
  Compile to Target Formats
       ↓
  Atomic Write
       ↓
  Update Manifest
```

### Key Technical Features

- **Multi-Format Compiler**: Each tool has its own serializer
- **Environment Variable Preservation**: Never expands `${env:VAR}`
- **Atomic Writes**: Temp file + fsync + rename
- **Diff Planning**: 3-way comparison (source, target, manifest)
- **Hash-Based Tracking**: Fast change detection

---

## 🧪 Tech Stack

- **TypeScript** - Type safety
- **Commander.js** - CLI framework
- **Inquirer.js** - Interactive prompts
- **chalk** - Terminal colors
- **ora** - Loading spinners
- **jsonc-parser** - JSONC support (for OpenCode)
- **gray-matter** - Frontmatter parsing (for Skills)

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

- ⭐ **Star this repo** - Help others discover this project
- 🐛 **Report bugs** - Open an issue if something isn't working
- 💡 **Suggest features** - What would make this better for you?
- 🔧 **Submit PRs** - Improve code, docs, or add features

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development

```bash
# Clone the repo
git clone https://github.com/nicepkg/vibe-sync.git
cd vibe-sync

# Install dependencies
pnpm install

# Run in development
pnpm dev

# Build
pnpm build

# Test
pnpm test
```

### Contributors

<a href="https://github.com/nicepkg/vibe-sync/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nicepkg/vibe-sync" />
</a>

---

## 📚 Roadmap

### v1.0 (MVP) ✅ Current
- [x] Skills sync
- [x] MCP sync
- [x] Safe & Prune modes
- [x] Diff planning
- [x] Claude Code, Cursor, OpenCode support

### v1.1 🔜 Next
- [ ] User-level configs
- [ ] Agents sync
- [ ] Commands sync
- [ ] Codex support
- [ ] Import/export enhancements

### v2.0 🚀 Future
- [ ] Web UI dashboard
- [ ] Team sharing
- [ ] Cloud sync
- [ ] Configuration templates

---

## 📄 License

MIT © [nicepkg](https://github.com/nicepkg)

---

<div align="center">

**If this project helped you, please consider giving it a ⭐**

<a href="https://github.com/nicepkg/vibe-sync">
  <img src="https://img.shields.io/github/stars/nicepkg/vibe-sync?style=for-the-badge&logo=github&color=yellow" alt="GitHub stars" />
</a>

Made with ❤️ by [nicepkg](https://github.com/nicepkg)

</div>
