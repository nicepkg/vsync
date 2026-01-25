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
import LogoIcon from "public/icon.svg";
import { siteConfig } from "~/lib/site-info";

export function Logo({
  width = 32,
  height = 32,
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <div className="flex items-center gap-2">
      <LogoIcon
        width={width}
        height={height}
        className={className}
        {...props}
      />
      <span className="font-bold text-xl tracking-tight hidden sm:inline-block">
        {siteConfig.name}
      </span>
    </div>
  );
}
