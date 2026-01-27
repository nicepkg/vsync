/**
 * Generate sitemap.xml for SEO
 * Run after build: npx tsx scripts/generate-sitemap.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { siteConfig } from "../src/lib/site-info";

const SITE_URL = siteConfig.url;
const OUTPUT_DIR = path.join(process.cwd(), "out");
const CONTENT_DIR = path.join(process.cwd(), "content");

interface PageInfo {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  alternates?: { locale: string; href: string }[];
}

const PRIORITY_MAP: Record<string, string> = {
  "": "1.0", // homepage
  docs: "0.9",
  "docs/getting-started": "0.9",
  "docs/cli-commands": "0.8",
  "docs/configuration": "0.8",
  "docs/core-concepts": "0.8",
  "docs/quick-reference": "0.7",
  "docs/advanced-features": "0.7",
  "docs/faq": "0.6",
  contributing: "0.5",
};

const CHANGEFREQ_MAP: Record<string, string> = {
  "": "weekly",
  docs: "weekly",
  contributing: "monthly",
};

function getFilesRecursively(dir: string, basePath = ""): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!entry.name.startsWith("_") && !entry.name.startsWith(".")) {
        files.push(
          ...getFilesRecursively(path.join(dir, entry.name), relativePath),
        );
      }
    } else if (entry.name.endsWith(".mdx") && !entry.name.startsWith("_")) {
      const pagePath = relativePath
        .replace(/\.mdx$/, "")
        .replace(/\/index$/, "");
      files.push(pagePath);
    }
  }

  return files;
}

function getLastModified(filePath: string): string {
  try {
    const stats = fs.statSync(filePath);
    const dateStr = stats.mtime.toISOString().split("T")[0];
    return dateStr ?? new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function generatePages(): PageInfo[] {
  const pages: PageInfo[] = [];
  const locales = ["en", "zh"];
  const enContentDir = path.join(CONTENT_DIR, "en");

  const enPages = getFilesRecursively(enContentDir);

  for (const pagePath of enPages) {
    const normalizedPath = pagePath === "index" ? "" : pagePath;
    const enFilePath = path.join(enContentDir, `${pagePath}.mdx`);
    const lastmod = getLastModified(
      fs.existsSync(enFilePath)
        ? enFilePath
        : path.join(enContentDir, pagePath, "index.mdx"),
    );

    const priority = PRIORITY_MAP[normalizedPath] || "0.5";
    const changefreq =
      CHANGEFREQ_MAP[normalizedPath] ||
      (normalizedPath.startsWith("docs") ? "weekly" : "monthly");

    const alternates = locales.map((locale) => ({
      locale,
      href: `${SITE_URL}/${locale}${normalizedPath ? `/${normalizedPath}` : ""}/`,
    }));

    for (const locale of locales) {
      const loc = `${SITE_URL}/${locale}${normalizedPath ? `/${normalizedPath}` : ""}/`;

      pages.push({
        loc,
        lastmod,
        changefreq,
        priority,
        alternates,
      });
    }
  }

  return pages;
}

function generateSitemapXml(pages: PageInfo[]): string {
  const urlEntries = pages
    .map((page) => {
      const alternateLinks = page.alternates
        ? page.alternates
            .map(
              (alt) =>
                `    <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${alt.href}" />`,
            )
            .join("\n")
        : "";

      return `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
${alternateLinks}
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`;
}

function generateSitemapIndex(): string {
  const today = new Date().toISOString().slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-en.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-zh.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;
}

function main() {
  const pages = generatePages();

  // Generate locale-specific sitemaps
  const enPages = pages.filter((p) => p.loc.includes("/en/"));
  const zhPages = pages.filter((p) => p.loc.includes("/zh/"));

  const enSitemapXml = generateSitemapXml(enPages);
  const zhSitemapXml = generateSitemapXml(zhPages);

  // Generate sitemap index
  const sitemapIndex = generateSitemapIndex();

  // Write to public directory (for dev) and out directory (for build)
  const publicDir = path.join(process.cwd(), "public");

  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemapIndex);
  fs.writeFileSync(path.join(publicDir, "sitemap-en.xml"), enSitemapXml);
  fs.writeFileSync(path.join(publicDir, "sitemap-zh.xml"), zhSitemapXml);

  console.log(`Generated sitemap.xml with ${pages.length} URLs`);
  console.log(`  - English: ${enPages.length} pages`);
  console.log(`  - Chinese: ${zhPages.length} pages`);

  // Also write to out directory if it exists (after build)
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.writeFileSync(path.join(OUTPUT_DIR, "sitemap.xml"), sitemapIndex);
    fs.writeFileSync(path.join(OUTPUT_DIR, "sitemap-en.xml"), enSitemapXml);
    fs.writeFileSync(path.join(OUTPUT_DIR, "sitemap-zh.xml"), zhSitemapXml);
    console.log("Also copied to out/ directory");
  }
}

main();
