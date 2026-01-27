import Link from "next/link";
import { siteConfig, githubConfig } from "~/lib/site-info";

export default function NotFound() {
  return (
    <html lang="en">
      <head>
        <title>404 - Page Not Found | {siteConfig.name}</title>
        <meta
          name="description"
          content="The page you're looking for doesn't exist. Return to vsync documentation."
        />
        <meta name="robots" content="noindex" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                max-width: 600px;
              }
              .code {
                font-size: 8rem;
                font-weight: 700;
                background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                line-height: 1;
                margin-bottom: 1rem;
              }
              .title {
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: rgba(255,255,255,0.9);
              }
              .description {
                color: rgba(255,255,255,0.6);
                margin-bottom: 2rem;
                line-height: 1.6;
              }
              .links {
                display: flex;
                gap: 1rem;
                justify-content: center;
                flex-wrap: wrap;
              }
              .link {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                text-decoration: none;
                font-weight: 500;
                transition: all 0.2s;
              }
              .link-primary {
                background: linear-gradient(135deg, #D946EF 0%, #22D3EE 100%);
                color: white;
              }
              .link-primary:hover {
                opacity: 0.9;
                transform: translateY(-2px);
              }
              .link-secondary {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.9);
                border: 1px solid rgba(255,255,255,0.2);
              }
              .link-secondary:hover {
                background: rgba(255,255,255,0.15);
                transform: translateY(-2px);
              }
              .suggestions {
                margin-top: 3rem;
                padding-top: 2rem;
                border-top: 1px solid rgba(255,255,255,0.1);
              }
              .suggestions-title {
                font-size: 0.875rem;
                color: rgba(255,255,255,0.5);
                margin-bottom: 1rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .suggestions-links {
                display: flex;
                gap: 1.5rem;
                justify-content: center;
                flex-wrap: wrap;
              }
              .suggestions-links a {
                color: rgba(255,255,255,0.7);
                text-decoration: none;
                font-size: 0.875rem;
              }
              .suggestions-links a:hover {
                color: #D946EF;
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="container">
          <div className="code">404</div>
          <h1 className="title">Page Not Found</h1>
          <p className="description">
            Oops! The page you&apos;re looking for doesn&apos;t exist or has
            been moved. Let&apos;s get you back on track.
          </p>

          <div className="links">
            <Link href="/en" className="link link-primary">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9,22 9,12 15,12 15,22" />
              </svg>
              Go Home
            </Link>
            <Link href="/en/docs" className="link link-secondary">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Documentation
            </Link>
          </div>

          <div className="suggestions">
            <div className="suggestions-title">Popular Pages</div>
            <div className="suggestions-links">
              <Link href="/en/docs/getting-started">Getting Started</Link>
              <Link href="/en/docs/cli-commands">CLI Commands</Link>
              <Link href="/en/docs/configuration">Configuration</Link>
              <Link href="/en/docs/faq">FAQ</Link>
              <a
                href={githubConfig.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
