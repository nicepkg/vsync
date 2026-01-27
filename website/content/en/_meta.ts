import type { MetaRecord } from "nextra";
import packageJson from "../../../cli/package.json";

export default {
  index: {
    title: "Home",
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
    title: "Documentation",
    type: "page",
  },
  commands: {
    title: "Commands",
    type: "page",
    href: "/en/docs/cli-commands",
  },
  [packageJson.version]: {
    title: `v${packageJson.version}`,
    type: "menu",
    items: {
      contributing: {
        title: "Contributing",
        href: "/en/contributing",
      },
      changelog: {
        title: "Changelog",
        href: "https://github.com/nicepkg/vsync/blob/main/cli/CHANGELOG.md",
      },
      release: {
        title: "Release",
        href: `https://github.com/nicepkg/vsync/releases`,
      },
    },
  },
} satisfies MetaRecord;
