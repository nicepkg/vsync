import type { MetaRecord } from "nextra";
import packageJson from "../../../cli/package.json";

export default {
  index: {
    title: "首页",
    type: "page",
    display: "hidden",
    theme: {
      layout: "full",
      breadcrumb: false,
      sidebar: false,
      toc: false,
      pagination: false,
      copyPage: false,
      timestamp: false,
    },
  },
  docs: {
    title: "文档",
    type: "page",
  },
  commands: {
    title: "CLI 命令",
    type: "page",
    href: "/zh/docs/cli-commands",
  },
  [packageJson.version]: {
    title: `v${packageJson.version}`,
    type: "menu",
    items: {
      contributing: {
        title: "贡献指南",
        href: "/zh/contributing",
      },
      changelog: {
        title: "更新日志",
        href: "https://github.com/nicepkg/vsync/blob/main/cli/CHANGELOG.md",
      },
      release: {
        title: "发布",
        href: `https://github.com/nicepkg/vsync/releases`,
      },
    },
  },
} satisfies MetaRecord;
