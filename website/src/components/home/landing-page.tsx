/**
 * =============================================================================
 * TODO: CUSTOMIZE THIS LANDING PAGE FOR YOUR PROJECT
 * =============================================================================
 * This is a feature-rich landing page template. Customize or simplify as needed.
 *
 * STRUCTURE OVERVIEW:
 * 1. Hero Section     - Main headline, subtitle, CTA buttons, demo command
 * 2. Problem Section  - Before/After comparison cards (edit `problems` array)
 * 3. Workflows Grid   - Feature cards linking to docs (edit `workflows` array)
 * 4. CTA Section      - Final call-to-action
 *
 * QUICK CUSTOMIZATION:
 * - Edit translations in the `t` object inside LandingPage component
 * - Edit `workflows` array to change feature cards
 * - Edit `problems` array to change comparison cards
 * - Change the demo command in Hero section (search "npx your-cli-command")
 * - Remove sections you don't need
 * =============================================================================
 */
"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Github,
  Zap,
  BookOpen,
  TrendingUp,
  BarChart2,
  Presentation,
  CheckCircle,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { githubConfig } from "~/lib/site-info";
import { cn } from "~/lib/utils";

const Hero3D = dynamic(() => import("./hero-3d").then((mod) => mod.Hero3D), {
  ssr: false,
});

// =============================================================================
// vsync Features - Core capabilities of the configuration sync tool
// =============================================================================
const workflows = [
  {
    icon: Zap,
    title: { en: "One-Way Sync", zh: "单向同步" },
    desc: {
      en: "Source → Targets, Safe by Default",
      zh: "源 → 目标，默认安全",
    },
    link: "/docs/getting-started",
    color: "text-fuchsia-500",
    bg: "bg-fuchsia-500/10",
  },
  {
    icon: BookOpen,
    title: { en: "Skills Sync", zh: "Skills 同步" },
    desc: {
      en: "Symlinks + Full Content Sync",
      zh: "符号链接 + 完整内容同步",
    },
    link: "/docs/getting-started",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: TrendingUp,
    title: { en: "MCP Servers", zh: "MCP Servers" },
    desc: {
      en: "Auto Format Conversion (JSON/TOML/JSONC)",
      zh: "自动格式转换 (JSON/TOML/JSONC)",
    },
    link: "/docs/getting-started",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: BarChart2,
    title: { en: "Agents & Commands", zh: "Agents 和 Commands" },
    desc: {
      en: "Sync Custom Agents & Slash Commands",
      zh: "同步自定义 Agent 和斜杠命令",
    },
    link: "/docs/getting-started",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: CheckCircle,
    title: { en: "Safe & Prune Modes", zh: "Safe & Prune 模式" },
    desc: {
      en: "Safe (No Deletions) or Prune (Strict Mirror)",
      zh: "Safe (不删除) 或 Prune (严格镜像)",
    },
    link: "/docs/getting-started",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: Presentation,
    title: { en: "Multi-Language", zh: "多语言支持" },
    desc: {
      en: "English + 中文 Interactive CLI",
      zh: "English + 中文交互式命令行",
    },
    link: "/docs/getting-started",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
];

// =============================================================================
// vsync Pain Points - Before/After comparison showing the value proposition
// =============================================================================
const problems = [
  {
    role: { en: "Multi-Tool User", zh: "多工具用户" },
    pain: {
      en: "Managing configs across multiple vibe coding tools - different directories, different formats, endless manual copying",
      zh: "在多个氛围编程工具间管理配置 - 不同目录、不同格式、无尽的手动复制",
    },
    gain: {
      en: "One command syncs everything. vsync handles all format conversions automatically.",
      zh: "一条命令同步所有内容。vsync 自动处理所有格式转换。",
    },
  },
  {
    role: { en: "Environment Variable Hell", zh: "环境变量噩梦" },
    pain: {
      en: "Claude Code uses ${VAR}, Cursor needs ${env:VAR}, OpenCode requires {env:VAR}. MCP servers break after migration.",
      zh: "Claude Code 用 ${VAR}，Cursor 需要 ${env:VAR}，OpenCode 要求 {env:VAR}。迁移后 MCP servers 就崩了。",
    },
    gain: {
      en: "vsync automatically converts env var syntax for each tool. No more broken MCP servers.",
      zh: "vsync 为每个工具自动转换环境变量语法。不再有坏掉的 MCP servers。",
    },
  },
  {
    role: { en: "Safety First", zh: "安全第一" },
    pain: {
      en: "Scared to delete outdated configs. No way to preview changes. One wrong move and everything breaks.",
      zh: "害怕删除过时的配置。无法预览变更。一步走错，全盘皆输。",
    },
    gain: {
      en: "Safe mode (never deletes) + Prune mode (strict mirror). Always see exactly what will change before applying.",
      zh: "Safe 模式（永不删除）+ Prune 模式（严格镜像）。应用前总能准确看到将要发生的变更。",
    },
  },
];

type Translation = {
  hero: {
    title: string;
    subtitle: string;
    desc: string;
    getStarted: string;
    viewGithub: string;
  };
  problem: {
    title: string;
    without: string;
    with: string;
  };
  workflows: {
    title: string;
    subtitle: string;
  };
  cta: {
    title: string;
    desc: string;
    button: string;
  };
};

export function LandingPage({ lang }: { lang: "en" | "zh" }) {
  const t: Translation = {
    hero: {
      title: lang === "en" ? "Vsync" : "Vsync",
      subtitle:
        lang === "en"
          ? "One config. Many AI tools. Zero pain."
          : "一处配置，多个 AI 工具同步，不再折腾。",
      desc:
        lang === "en"
          ? "Each vibe coding tool (Claude Code, Cursor, OpenCode, Codex) has its own directories and formats. Skills, MCP servers, Agents, Commands - they're all different. vsync keeps everything in sync automatically. No more manual copying, no more broken configs."
          : "每个氛围编程工具（Claude Code、Cursor、OpenCode、Codex）都有自己的目录和格式。Skills、MCP servers、Agents、Commands - 都不一样。vsync 自动保持所有内容同步。不再手动复制，不再有坏掉的配置。",
      getStarted: lang === "en" ? "Get Started" : "开始使用",
      viewGithub: lang === "en" ? "Star on GitHub" : "Star on GitHub",
    },
    problem: {
      title: lang === "en" ? "Before & After vsync" : "使用 vsync 前后对比",
      without: lang === "en" ? "Without vsync" : "没有 vsync",
      with: lang === "en" ? "With vsync" : "有了 vsync",
    },
    workflows: {
      title: lang === "en" ? "Core Features" : "核心特性",
      subtitle:
        lang === "en"
          ? "Skills, MCP, Agents, Commands - all synced automatically"
          : "Skills、MCP、Agents、Commands - 全部自动同步",
    },
    cta: {
      title:
        lang === "en" ? "Stop Managing Configs Manually" : "不再手动管理配置",
      desc:
        lang === "en"
          ? "One command to sync everything across all your vibe coding tools."
          : "一条命令同步所有氛围编程工具的配置。",
      button: lang === "en" ? "Get Started Now" : "立即开始",
    },
  };

  return (
    <div className="homepage relative flex min-h-screen flex-col font-sans">
      {/* Hero Section */}
      <section className="relative z-10 overflow-hidden pt-24 pb-56">
        <Hero3D />
        <div className="relative z-10 container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="mb-8 text-5xl leading-tight font-extrabold tracking-tight md:text-7xl">
                <span className="from-primary animate-gradient-x bg-gradient-to-r via-purple-500 to-blue-500 bg-clip-text text-transparent">
                  {t.hero.title}
                </span>
              </h1>
              <p className="text-foreground mb-6 text-2xl font-semibold md:text-3xl">
                {t.hero.subtitle}
              </p>
              <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-lg leading-relaxed md:text-xl">
                {t.hero.desc}
              </p>
              <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href={`/${lang}/docs/getting-started`}>
                  <Button
                    size="lg"
                    className="shadow-primary/25 hover:shadow-primary/40 h-14 rounded-full px-8 text-lg font-semibold shadow-lg transition-shadow"
                  >
                    {t.hero.getStarted} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href={githubConfig.url} target="_blank">
                  <Button
                    variant="outline"
                    size="lg"
                    className="bg-background/50 hover:bg-muted/50 border-primary/20 hover:border-primary/50 h-14 rounded-full px-8 text-lg backdrop-blur-sm"
                  >
                    <Github className="mr-2 h-5 w-5" /> {t.hero.viewGithub}
                  </Button>
                </Link>
              </div>

              {/* Demo command - Quick Start */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mx-auto mt-12 max-w-3xl"
              >
                <p className="mb-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                  {lang === "en" ? "Try it now" : "立即体验"}
                </p>
                <div className="via-primary/20 rounded-2xl bg-gradient-to-r from-transparent to-transparent p-1">
                  <div className="bg-card/80 border-primary/10 rounded-xl border p-6 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center overflow-x-auto text-left font-mono text-sm whitespace-nowrap md:text-base">
                      <span className="text-primary mr-3 select-none">$</span>
                      <span className="text-foreground">
                        npx @nicepkg/vsync sync
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Background gradients - Removed old static blobs */}
      </section>

      {/* Comparison Section */}
      <section className="relative overflow-hidden pt-0 pb-32">
        <div className="relative z-10 container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-24 text-center"
          >
            <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-5xl">
              {t.problem.title}
            </h2>
          </motion.div>

          <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
            {problems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="group relative h-full"
              >
                {/* Card Container */}
                <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-black/5 bg-white/80 shadow-2xl shadow-zinc-200/50 backdrop-blur-xl transition-all duration-500 hover:border-primary/20 hover:shadow-primary/5 dark:border-white/10 dark:bg-zinc-900/60 dark:shadow-black/50">
                  {/* Header: Role */}
                  <div className="px-8 pt-8 pb-4 text-center">
                    <h3 className="bg-gradient-to-br from-zinc-900 to-zinc-600 bg-clip-text text-2xl font-bold text-transparent transition-all duration-300 group-hover:from-primary group-hover:to-purple-600 dark:from-white dark:to-zinc-400">
                      {item.role[lang]}
                    </h3>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-4">
                    {/* The 'Pain' State */}
                    <div className="relative flex-1 rounded-2xl bg-zinc-50 p-6 transition-colors group-hover:bg-red-50/50 dark:bg-white/5 dark:group-hover:bg-red-950/20">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
                          BEFORE
                        </span>
                        <XCircle className="h-5 w-5 text-zinc-300 transition-colors group-hover:text-red-400 dark:text-zinc-600" />
                      </div>
                      <p className="font-mono text-sm leading-relaxed text-zinc-500 transition-all decoration-red-400/50 group-hover:text-zinc-400 group-hover:line-through dark:text-zinc-400">
                        {item.pain[lang]}
                      </p>
                    </div>

                    {/* The Transformation Node */}
                    <div className="relative z-10 -my-5 flex justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white bg-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:border-primary/20 group-hover:shadow-primary/20 dark:border-zinc-800 dark:bg-zinc-900">
                        <Zap className="h-5 w-5 text-zinc-300 transition-colors group-hover:fill-primary group-hover:text-primary dark:text-zinc-600" />
                      </div>
                    </div>

                    {/* The 'Gain' State */}
                    <div className="relative flex-1 rounded-2xl bg-gradient-to-b from-blue-50/50 to-purple-50/50 p-6 pt-8 transition-colors group-hover:from-blue-50/80 group-hover:to-purple-50/80 dark:from-blue-900/10 dark:to-purple-900/10">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold tracking-widest text-primary/80 uppercase">
                          AFTER
                        </span>
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-base font-semibold leading-relaxed text-zinc-800 dark:text-zinc-100">
                        {item.gain[lang]}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflows Grid */}
      <section className="relative py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mb-24 text-center">
            <h2 className="mb-6 text-3xl font-bold md:text-5xl">
              {t.workflows.title}
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              {t.workflows.subtitle}
            </p>
          </div>

          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf, i) => (
              <Link
                href={`/${lang}${wf.link}`}
                key={i}
                className="group block h-full"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  viewport={{ once: true }}
                  className="relative h-full overflow-hidden rounded-[2rem] border border-border/50 bg-background/50 p-1 transition-all duration-500 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5"
                >
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[1.8rem] bg-card/50 p-8 backdrop-blur-xl transition-colors duration-500 group-hover:bg-card/80">
                    {/* Background Glow */}
                    <div
                      className={cn(
                        "absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-0 blur-[80px] transition-all duration-700 group-hover:opacity-20",
                        wf.bg.replace("/10", ""), // Remove opacity modifier if present to get pure color
                        wf.color.replace("text-", "bg-"), // Convert text color class to bg color class
                      )}
                    />

                    {/* Icon Box */}
                    <div className="mb-8 flex items-start justify-between">
                      <div
                        className={cn(
                          "flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                          wf.bg,
                          wf.color,
                        )}
                      >
                        <wf.icon className="h-8 w-8" />
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/50 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:shadow-sm">
                        <ArrowRight className="h-4 w-4 -rotate-45 text-foreground transition-transform duration-300 group-hover:rotate-0" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-1 flex-col">
                      <h3 className="mb-3 text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {wf.title[lang]}
                      </h3>
                      <p className="flex-1 text-lg leading-relaxed text-muted-foreground/80 transition-colors group-hover:text-muted-foreground">
                        {wf.desc[lang]}
                      </p>
                    </div>

                    {/* Bottom Decoration */}
                    <div className="mt-8 h-1 w-12 rounded-full bg-border transition-all duration-500 group-hover:w-full group-hover:bg-primary/20" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden pt-24 pb-16 text-center">
        <div className="to-primary/5 absolute inset-0 -z-10 bg-gradient-to-b from-transparent" />
        <div className="relative container mx-auto px-4">
          <div className="bg-primary/10 absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />

          <h2 className="mb-8 text-4xl font-bold tracking-tight md:text-6xl">
            {t.cta.title}
          </h2>
          <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-xl leading-relaxed md:text-2xl">
            {t.cta.desc}
          </p>
          <Link href={`/${lang}/docs/getting-started`}>
            <Button
              size="lg"
              className="shadow-primary/30 hover:shadow-primary/50 h-16 rounded-full px-12 text-xl shadow-2xl transition-all hover:scale-105"
            >
              {t.cta.button}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
