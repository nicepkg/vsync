/**
 * FAQ Schema component for SEO rich snippets
 * Generates JSON-LD FAQPage structured data
 */

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSchemaProps {
  faqs: FaqItem[];
}

export function FaqSchema({ faqs }: FaqSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Pre-defined FAQ items for vsync (English)
export const vsyncFaqsEn: FaqItem[] = [
  {
    question: "Which tool should I use as the source?",
    answer:
      "We recommend Claude Code because it has the most complete feature set (Skills, MCP, Agents, Commands), clean JSON format, and is well-documented. However, you can use any supported tool as your source.",
  },
  {
    question: "Will vsync overwrite my existing configs?",
    answer:
      "By default, Safe Mode only creates and updates—it never deletes. Your existing configs in target tools will be updated to match the source, but nothing is removed unless you use --prune mode.",
  },
  {
    question: "What happens if I edit configs directly in target tools?",
    answer:
      "Changes in target tools will be overwritten on the next sync. vsync uses a unidirectional sync model: Source → Targets. Always edit in your source tool.",
  },
  {
    question: "Does vsync work with monorepos?",
    answer:
      "Yes! Each project can have its own .vsync.json. User-level configs (~/.vsync.json) work globally across all projects.",
  },
  {
    question: "Is it safe to commit .vsync.json to git?",
    answer:
      "Yes! The config file contains only tool names and sync preferences—no secrets or credentials. MCP configs with secrets should use environment variables like ${API_KEY}.",
  },
  {
    question: "Can I sync in both directions?",
    answer:
      "No, vsync is unidirectional (source → targets). This is intentional to maintain a clear source of truth. To switch directions, run vsync init and choose a different source tool.",
  },
  {
    question: "What's the difference between project-level and user-level?",
    answer:
      "Project-Level (.vsync.json) contains team configs shared via git, scoped to one project. User-Level (~/.vsync.json) contains personal global configs that work across all projects and are not shared.",
  },
  {
    question: "Will vsync expose my secrets?",
    answer:
      "No! vsync never expands environment variables, preserves variable references as-is, only converts syntax between formats, and doesn't read actual environment values.",
  },
];

// Pre-defined FAQ items for vsync (Chinese)
export const vsyncFaqsZh: FaqItem[] = [
  {
    question: "我应该使用哪个工具作为源？",
    answer:
      "我们推荐 Claude Code，因为它功能最完整（Skills、MCP、Agents、Commands），JSON 格式简洁，文档完善。不过你可以使用任何支持的工具作为源。",
  },
  {
    question: "vsync 会覆盖我现有的配置吗？",
    answer:
      "默认情况下，安全模式只创建和更新，从不删除。目标工具中的现有配置会更新以匹配源，但除非使用 --prune 模式，否则不会删除任何内容。",
  },
  {
    question: "如果我直接在目标工具中编辑配置会怎样？",
    answer:
      "目标工具中的更改将在下次同步时被覆盖。vsync 使用单向同步模式：源 → 目标。请始终在源工具中编辑。",
  },
  {
    question: "vsync 支持 monorepo 吗？",
    answer:
      "支持！每个项目可以有自己的 .vsync.json。用户级配置（~/.vsync.json）在所有项目中全局生效。",
  },
  {
    question: "将 .vsync.json 提交到 git 安全吗？",
    answer:
      "安全！配置文件只包含工具名称和同步偏好，没有密钥或凭证。包含密钥的 MCP 配置应使用环境变量如 ${API_KEY}。",
  },
  {
    question: "可以双向同步吗？",
    answer:
      "不可以，vsync 是单向的（源 → 目标）。这是为了维护一个清晰的真实来源。要切换方向，运行 vsync init 并选择不同的源工具。",
  },
  {
    question: "项目级和用户级有什么区别？",
    answer:
      "项目级（.vsync.json）包含通过 git 共享的团队配置，作用域为单个项目。用户级（~/.vsync.json）包含个人全局配置，在所有项目中生效，不共享。",
  },
  {
    question: "vsync 会泄露我的密钥吗？",
    answer:
      "不会！vsync 从不展开环境变量，保持变量引用原样，只转换格式之间的语法，不读取实际的环境值。",
  },
];

// Alias for backward compatibility
export const vsyncFaqs = vsyncFaqsEn;
