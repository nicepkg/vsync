## User Level 配置示例

### 用户目录结构

```
~/ (用户主目录)
│
├── .opencode/                    # OpenCode 全局配置
│   ├── opencode.json             # 全局配置
│   ├── agents/                   # 全局代理
│   │   ├── code-reviewer.md
│   │   └── doc-generator.md
│   ├── commands/                 # 全局命令
│   │   ├── quick-commit.md
│   │   └── sync-fork.md
│   ├── skills/                   # 全局技能
│   │   ├── commit-message/
│   │   │   └── SKILL.md
│   │   ├── pr-template/
│   │   │   └── SKILL.md
│   │   └── code-review/
│   │       └── SKILL.md
│   └── plugins/                  # 插件
│       └── custom-plugin/
│
├── .cursor/                      # Cursor 全局配置
│   ├── rules/                    # 全局规则
│   │   ├── typescript-strict.mdc
│   │   └── security-best-practices.md
│   ├── skills/                   # 全局技能
│   │   ├── git-workflow/
│   │   │   └── SKILL.md
│   │   └── documentation/
│   │       └── SKILL.md
│   ├── commands/                 # 全局命令
│   │   ├── commit-with-emoji.md
│   │   └── generate-changelog.md
│   └── mcp.json                  # 全局 MCP 配置
│
├── .codex/                       # Codex 全局配置
│   ├── config.toml               # 全局配置 (TOML 格式)
│   ├── skills/                   # 全局技能
│   │   ├── testing/
│   │   │   └── SKILL.md
│   │   └── refactoring/
│   │       └── SKILL.md
│   └── AGENTS.md                 # 全局项目指令
│
├── .claude/                      # Claude Code 全局配置
│   ├── settings.json             # 全局权限、钩子配置
│   ├── agents/                   # 全局子代理
│   │   ├── code-reviewer.md
│   │   ├── doc-writer.md
│   │   └── performance-analyzer.md
│   ├── skills/                   # 全局技能
│   │   ├── commit/
│   │   │   ├── SKILL.md
│   │   │   ├── template.md
│   │   │   └── examples/
│   │   │       ├── good.md
│   │   │       └── bad.md
│   │   ├── pr-description/
│   │   │   └── SKILL.md
│   │   └── changelog/
│   │       └── SKILL.md
│   ├── commands/                 # 全局命令
│   │   └── quick-review.md
│   └── AGENTS.md                 # 全局编码偏好
│   └── .claude.json             # claude code 全局 mcp
│
└── .config/
    └── (其他应用配置...)
```

## Project Level 配置示例

### 项目目录结构

```
my-fullstack-project/
│
├── AGENTS.md                    # 通用项目指令 (OpenCode/Cursor/Codex 共用)
├── CLAUDE.md                    # Claude Code 专用项目记忆文件
│
├── .opencode/                   # OpenCode 配置目录
│   ├── agents/                  # 自定义代理
│   │   ├── security-auditor.md
│   │   └── code-reviewer.md
│   ├── commands/                # 自定义命令
│   │   ├── deploy.md
│   │   └── review.md
│   └── skills/                  # 技能 (Agent Skills 标准)
│       ├── testing/
│       │   └── SKILL.md
│       └── git-release/
│           └── SKILL.md
│
├── .cursor/                     # Cursor 配置目录
│   ├── rules/                   # 项目规则
│   │   ├── react-patterns.mdc  # 带 frontmatter
│   │   ├── api-guidelines.md
│   │   └── frontend/
│   │       └── components.md
│   ├── skills/                  # Agent Skills
│   │   ├── deploy-app/
│   │   │   ├── SKILL.md
│   │   │   └── scripts/
│   │   │       └── deploy.sh
│   │   └── api-docs/
│   │       └── SKILL.md
│   ├── commands/                # 自定义命令
│   │   ├── review-code.md
│   │   └── create-pr.md
│   ├── plans/                   # Plan 模式保存的计划
│   │   └── auth-migration-plan.md
│   └── mcp.json                 # Cursor MCP 配置
│
├── .codex/                      # Codex 配置目录
│   ├── skills/                  # 技能
│   │   ├── testing/
│   │   │   └── SKILL.md
│   │   └── deploy/
│   │       └── SKILL.md
│   └── config.toml              # 项目配置 (TOML 格式)
│
├── .claude/                     # Claude Code 配置目录
│   ├── agents/                  # 子代理
│   │   ├── security-auditor.md
│   │   └── performance-analyzer.md
│   ├── skills/                  # 技能
│   │   ├── commit/
│   │   │   ├── SKILL.md
│   │   │   ├── template.md
│   │   │   └── examples/
│   │   │       └── good.md
│   │   ├── deploy/
│   │   │   └── SKILL.md
│   │   └── api-conventions/
│   │       └── SKILL.md
│   ├── commands/                # 遗留命令 (兼容旧版)
│   │   └── review.md
│   └── settings.json            # 权限、沙箱、钩子配置
│
├── .vscode/                     # VS Code/Cursor 项目配置
│   └── settings.json            # 项目设置
│
├── .mcp.json                    # Claude Code MCP 服务器配置
├── opencode.json                # OpenCode 项目配置
└── .gitignore                   # 忽略敏感配置
```

### 配置文件对比表

| 特性                   | OpenCode        | Cursor               | Codex         | Claude Code     |
| ---------------------- | --------------- | -------------------- | ------------- | --------------- |
| **User Level 配置**    | `~/.opencode/`  | `~/.cursor/`         | `~/.codex/`   | `~/.claude/`    |
| **Project Level 配置** | `.opencode/`    | `.cursor/`           | `.codex/`     | `.claude/`      |
| **项目指令文件**       | `AGENTS.md`     | `AGENTS.md`          | `AGENTS.md`   | `CLAUDE.md`     |
| **代理/规则**          | `agents/`       | `rules/` + `agents/` | ❌            | `agents/`       |
| **技能**               | `skills/`       | `skills/`            | `skills/`     | `skills/`       |
| **命令**               | `commands/`     | `commands/`          | ❌            | `commands/`     |
| **MCP 配置**           | `opencode.json` | `mcp.json`           | `.mcp.json`   | `.mcp.json`     |
| **权限管理**           | `opencode.json` | `settings.json`      | `config.toml` | `settings.json` |
| **钩子系统**           | ❌              | ❌                   | ❌            | `settings.json` |
| **配置格式**           | JSON            | JSON                 | **TOML**      | JSON            |
