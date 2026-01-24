// ============================================================================
// AI VIBE CODING STARTER - SITE CONFIGURATION
// ============================================================================
// Replace the following placeholders with your actual values:
//
// REQUIRED:
// - [project-name]: Display name, can include spaces (e.g., "My Awesome Project")
// - [repo-name]: Repository name, no spaces allowed (e.g., "my-awesome-project")
// - [project-slogan]: Your project slogan (e.g., "Build faster with AI")
// - [project-domain]: Your domain name without https:// (e.g., "myproject.com")
// - [github-username]: Your GitHub username (e.g., "nicepkg")
//
// OPTIONAL (set to empty string "" to hide):
// - [support-email]: Your support email (e.g., "support@example.com")
// - [author-name]: Your display name (e.g., "John Doe")
// - [author-website]: Your personal website with https:// (e.g., "https://johndoe.com")
// - [twitter-handle]: Your Twitter/X handle without @ (e.g., "johndoe")
// - [bilibili-uid]: Your Bilibili UID (e.g., "12345678")
// - [douyin-uid]: Your Douyin UID (e.g., "MS4wLjABAAAAxxxxxx")
// - [douyin-nickname]: Your Douyin nickname (e.g., "小明")
//
// THEME COLORS:
// Primary and secondary colors are defined in: website/src/styles/globals.css
// Look for --primary and --secondary CSS variables in :root and .dark sections
// Use oklch() format, e.g.: oklch(0.6 0.2 260) for purple
// Recommended: Use https://oklch.com to pick colors
// ============================================================================

// ---------- Basic Site Config ----------
export const siteConfig = {
  name: "vibe-sync",
  description: "One config. Many AI tools. Zero pain.",
  url: "https://vibe-sync.xiaominglab.com",
  locale: "en_US",
};

// ---------- GitHub Config ----------
export const githubConfig = {
  username: "nicepkg",
  repo: "vibe-sync",
  get url() {
    return `https://github.com/${this.username}/${this.repo}`;
  },
  get docsBase() {
    return `${this.url}/tree/main/website`;
  },
  get issuesUrl() {
    return `${this.url}/issues/new?labels=feedback,documentation&template=feedback.md`;
  },
};

// ---------- Author Config ----------
export const authorConfig = {
  name: "Jinming Yang",
  website: "https://github.com/2214962083",
  email: "2214962083@qq.com",
  github: `https://github.com/${githubConfig.username}`,
};

// ---------- Social Links Config ----------
// Set href to empty string "" to hide a social link
export const socialLinksConfig = {
  github: {
    label: "GitHub",
    href: `https://github.com/${githubConfig.username}`,
  },
  bilibili: {
    label: "Bilibili",
    href: "https://space.bilibili.com/83540912",
  },
  douyin: {
    label: "Douyin",
    href: "https://www.douyin.com/user/79841360454",
    handle: "葬爱非主流小明",
  },
  twitter: {
    label: "X (Twitter)",
    href: "https://x.com/jinmingyang666",
  },
};

// ---------- Footer Config ----------
export const footerConfig = {
  description: {
    en: "Sync your AI coding tool configurations with a single command. Keep Skills and MCP servers in perfect harmony across Claude Code, Cursor, OpenCode, and Codex.",
    zh: "一条命令同步你的 AI 编程工具配置。让 Skills 和 MCP servers 在 Claude Code、Cursor、OpenCode 和 Codex 之间保持完美和谐。",
  },
  links: [
    {
      label: "Jinming Yang",
      href: authorConfig.website,
    },
    {
      label: githubConfig.username,
      href: authorConfig.github,
    },
    {
      label: "About Author",
      href: authorConfig.github,
    },
  ],
  copyright: {
    holder: siteConfig.name,
    license: "MIT",
  },
};

// ---------- Banner Config ----------
export const bannerConfig = {
  storageKey: `${siteConfig.name.toLowerCase().replace(/\s+/g, "-")}-banner`,
  text: {
    en: `🚀 ${siteConfig.name} v1.0 is here! Sync your AI tools effortlessly.`,
    zh: `🚀 ${siteConfig.name} v1.0 发布！轻松同步你的 AI 工具。`,
  },
  linkText: {
    en: "Star us on GitHub",
    zh: "在 GitHub 上 Star 我们",
  },
};

// ---------- Legacy Exports (for backward compatibility) ----------
export const supportEmail = authorConfig.email;
