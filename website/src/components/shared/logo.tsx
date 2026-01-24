/**
 * =============================================================================
 * TODO: REPLACE THIS EXAMPLE LOGO WITH YOUR OWN
 * =============================================================================
 * This is a sample logo component. You should replace it with your own design.
 *
 * Options:
 * 1. Replace the SVG below with your own SVG logo
 * 2. Use an image: <Image src="/logo.png" alt="Logo" width={32} height={32} />
 * 3. Use text only: just remove the <svg> and keep the <span>
 *
 * The logo appears in:
 * - Navigation bar (via [locale]/layout.tsx)
 * - You can also use it in footer, about page, etc.
 * =============================================================================
 */
import React from "react";
import { siteConfig } from "~/lib/site-info";

export function Logo({
  width = 32,
  height = 32,
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={width}
        height={height}
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        <rect width="256" height="256" fill="none" />
        <defs>
          <linearGradient
            id="logo-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#D946EF" /> {/* Fuchsia */}
            <stop offset="100%" stopColor="#22D3EE" /> {/* Cyan */}
          </linearGradient>
        </defs>

        {/* Rotating sync circle */}
        <path
          d="M216,128A88,88,0,1,1,128,40,88,88,0,0,1,216,128Z"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray="40 20"
          className="animate-[spin_10s_linear_infinite]"
          style={{ transformOrigin: "center" }}
        />

        {/* Sync arrows forming a V shape */}
        <path
          d="M80,100 L128,160 L176,100"
          fill="none"
          stroke="url(#logo-gradient)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="24"
        />

        {/* Top connection nodes */}
        <circle cx="80" cy="100" r="12" fill="url(#logo-gradient)" />
        <circle cx="176" cy="100" r="12" fill="url(#logo-gradient)" />

        {/* Bottom sync node */}
        <circle cx="128" cy="160" r="14" fill="url(#logo-gradient)" />
      </svg>
      <span className="font-bold text-xl tracking-tight hidden sm:inline-block">
        {siteConfig.name}
      </span>
    </div>
  );
}
