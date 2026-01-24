# Project Configuration

> Copy this to `config.md` and fill in your values.

## Basic Info

- **Project Name**: vibe-sync
- **Repo Name**: vibe-sync
- **Slogan (EN)**: One config. Many AI tools. Zero pain.
- **Slogan (ZH)**: 一处配置，多个 AI 工具同步，不再折腾。
- **Domain**: vibe-sync.xiaominglab.com

## GitHub

- **Username**: nicepkg
- **Repo**: https://github.com/nicepkg/vibe-sync

## Author

- **Name**: Jinming Yang
- **Website**: https://github.com/2214962083
- **Email**: 2214962083@qq.com

## Social Links (leave empty to hide)

- **Twitter**: jinmingyang666
- **Bilibili UID**: 83540912
- **Douyin UID**: 79841360454
- **Douyin Nickname**: 葬爱非主流小明

## Theme Colors

- **Primary Color**: Fuchsia (#D946EF) / hsl(292.19, 84.08%, 60.59%) / oklch(0.6668 0.2591 322.15)
- **Secondary Color**: Cyan (#22D3EE) / hsl(187.94, 85.71%, 53.33%) / oklch(0.7971 0.1339 211.53)

## Notes

vibe-sync syncs AI coding tool configs using a single source of truth.

Core objects:

- Skills
- Agents
- MCP Servers
- Commands

Default behavior:

- Sync is one-way (source → targets)
- Safe mode by default (no deletes), optional prune mode
- MCP sync requires confirmation on first-time additions
