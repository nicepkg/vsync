import { siteConfig, authorConfig, githubConfig } from "~/lib/site-info";

interface JsonLdProps {
  type?: "website" | "software" | "article" | "faq";
  title?: string;
  description?: string;
  url?: string;
  datePublished?: string;
  dateModified?: string;
  faqItems?: Array<{ question: string; answer: string }>;
}

export function JsonLd({
  type = "website",
  title,
  description,
  url,
  datePublished,
  dateModified,
  faqItems,
}: JsonLdProps) {
  const baseUrl = siteConfig.url;

  const organizationSchema = {
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: githubConfig.username,
    url: `https://github.com/${githubConfig.username}`,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/icon.svg`,
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: siteConfig.name,
    description: siteConfig.description,
    url: baseUrl,
    inLanguage: ["en-US", "zh-CN"],
    publisher: organizationSchema,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/en/docs?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    description: siteConfig.description,
    url: baseUrl,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cross-platform",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: authorConfig.name,
      url: authorConfig.website,
    },
    maintainer: organizationSchema,
    programmingLanguage: "TypeScript",
    codeRepository: githubConfig.url,
    license: "https://opensource.org/licenses/MIT",
    keywords: siteConfig.keywords.join(", "),
    softwareVersion: "1.2.0",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: "10",
      bestRating: "5",
      worstRating: "1",
    },
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title || siteConfig.name,
    description: description || siteConfig.description,
    url: url || baseUrl,
    datePublished: datePublished || new Date().toISOString(),
    dateModified: dateModified || new Date().toISOString(),
    author: {
      "@type": "Person",
      name: authorConfig.name,
      url: authorConfig.website,
    },
    publisher: organizationSchema,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url || baseUrl,
    },
    image: `${baseUrl}${siteConfig.ogImage}`,
    inLanguage: "en-US",
  };

  const faqSchema = faqItems
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Documentation",
        item: `${baseUrl}/en/docs`,
      },
    ],
  };

  let schemas: object[] = [];

  switch (type) {
    case "website":
      schemas = [websiteSchema, softwareSchema, breadcrumbSchema];
      break;
    case "software":
      schemas = [softwareSchema];
      break;
    case "article":
      schemas = [articleSchema, breadcrumbSchema];
      break;
    case "faq":
      schemas = faqSchema ? [faqSchema, breadcrumbSchema] : [breadcrumbSchema];
      break;
    default:
      schemas = [websiteSchema];
  }

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

export function WebsiteJsonLd() {
  return <JsonLd type="website" />;
}

export function SoftwareJsonLd() {
  return <JsonLd type="software" />;
}

export function ArticleJsonLd(props: Omit<JsonLdProps, "type">) {
  return <JsonLd type="article" {...props} />;
}

export function FaqJsonLd(props: {
  faqItems: Array<{ question: string; answer: string }>;
}) {
  return <JsonLd type="faq" {...props} />;
}
