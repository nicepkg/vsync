# Project Setup Checklist

> **For AI**: This checklist tracks items that need to be completed or reviewed.
> Mark items as done by changing `[ ]` to `[x]` after completion.
> Delete this file when the project is fully set up.

---

## 🔖 Checkpoint System

Each phase has a **checkpoint command** to verify completion before moving on.
If verification fails, fix issues before proceeding to the next phase.

| Phase | Checkpoint Command | Success Criteria |
|-------|-------------------|------------------|
| Phase 1 | `pnpm --filter website typecheck` | No TypeScript errors |
| Phase 2 | Manual review | All visual assets customized |
| Phase 3 | `grep -r "\[project-name\]" README.md` | No placeholders found |
| Phase 4 | `./scripts/validate-setup.sh` | All checks pass |

**If you need to pause:**
- Update this file with current progress
- Add notes in the "Notes" section at the bottom
- Mark current task as `[~]` (in progress)

---

## Phase 1: Core Configuration

> **Checkpoint**: Run `pnpm --filter website typecheck` after completing this phase.

### Required

- [x] Replace placeholders in `website/src/lib/site-info.ts`
- [x] Update theme colors in `website/src/styles/globals.css`
- [x] Replace placeholders in `package.json`
- [x] Update `LICENSE` with correct copyright holder
- [x] Update `.github/workflows/deploy-website.yml`

### Content Files

- [x] Update `website/content/en/index.mdx` frontmatter
- [x] Update `website/content/zh/index.mdx` frontmatter

### ✅ Phase 1 Checkpoint

- [x] Run `pnpm --filter website typecheck` - PASSED

## Phase 2: Visual Assets

> **Checkpoint**: Visual review - preview site and confirm all visual elements are customized.

- [~] Replace `website/public/icon.svg` with project favicon (using default, can customize later)
- [x] Customize or replace logo in `website/src/components/shared/logo.tsx`
- [x] Customize `website/src/components/home/hero-3d.tsx` colors (or remove if not needed)
- [x] Update `website/src/components/home/landing-page.tsx`:
  - [x] Customize `workflows` array
  - [x] Customize `problems` array
  - [x] Update hero section translations
  - [x] Update demo command

### ✅ Phase 2 Checkpoint

- [~] Run `pnpm dev:website` and visually verify landing page (ready to preview)
- [~] Confirm favicon appears correctly in browser tab

## Phase 3: Documentation

> **Checkpoint**: Run `grep -r "\[project-name\]\|\[repo-name\]\|\[github-username\]" *.md` - should return nothing.

### README Files

> **Note**: The existing `README.md` and `README_cn.md` are template introduction files.
> They must be deleted and replaced with project-specific READMEs.

- [x] **Delete** existing `README.md` (template intro)
- [x] **Delete** existing `README_cn.md` (template intro)
- [x] Copy `README.example.md` → `README.md`
- [x] Copy `README_cn.example.md` → `README_cn.md`
- [x] Replace all placeholders in both README files
- [x] Write compelling project description (based on PRD)
- [~] Add actual screenshots/demos (can add later)
- [x] Update badges with correct URLs
- [x] Remove template notices (⚠️ blocks) from README files

### GitHub Templates

- [x] Copy `.github/ISSUE_TEMPLATE/bug_report.example.md` → `bug_report.md`, customize
- [x] Copy `.github/ISSUE_TEMPLATE/feature_request.example.md` → `feature_request.md`, customize
- [x] Copy `.github/ISSUE_TEMPLATE/config.example.yml` → `config.yml`, update URLs
- [x] Copy `.github/ISSUE_TEMPLATE/feedback.example.md` → `feedback.md`, customize
- [x] Copy `.github/PULL_REQUEST_TEMPLATE.example.md` → `PULL_REQUEST_TEMPLATE.md`, customize
- [x] Update `CONTRIBUTING.md` with project-specific guidelines
- [x] Remove template notices (⚠️ blocks) from all files

### ✅ Phase 3 Checkpoint

- [x] No `[placeholder]` values found in README.md
- [x] No `[placeholder]` values found in README_cn.md
- [x] No `⚠️ TEMPLATE NOTICE` blocks remaining

## Phase 4: Final Review

> **Checkpoint**: Run `./scripts/validate-setup.sh` - all checks must pass.

### Verification

- [x] Run `pnpm typecheck` - no errors
- [x] Run `pnpm lint` - no critical errors (minor warnings in UI components only)
- [~] Run `pnpm dev:website` - site loads correctly (ready for preview)
- [~] Run `./scripts/validate-setup.sh` - all checks pass (if script exists)
- [~] Test all links work correctly (manual testing needed)
- [~] Review site on mobile devices (manual testing needed)

### Deployment

- [ ] Set up Cloudflare Pages / deployment
- [ ] Configure custom domain

### Cleanup (Only after everything works!)

- [~] Delete `docs/config.example.md` and `docs/prd.example.md` (keep for reference)
- [~] Delete `README.example.md` and `README_cn.example.md` (can delete now)
- [~] Delete `.github/ISSUE_TEMPLATE/*.example.*` files (can delete now)
- [~] Delete `.github/PULL_REQUEST_TEMPLATE.example.md` (can delete now)
- [~] Delete this `CHECKLIST.md` file (after final review)

### ✅ Phase 4 Checkpoint

- [x] TypeScript and lint checks passed
- [~] Site ready for preview and deployment

---

## 🔄 Recovery Guide

If setup was interrupted or needs to be resumed:

| Situation | How to Recover |
|-----------|---------------|
| Phase 1 incomplete | Check `site-info.ts` for unfilled `[placeholder]` values |
| Phase 2 incomplete | Visual assets are independent, fix individually |
| Phase 3 incomplete | Re-copy from `.example.md` files and fill again |
| Unknown state | Run `./scripts/validate-setup.sh` to diagnose |

**To find all remaining placeholders:**
```bash
grep -r "\[project-name\]\|\[repo-name\]\|\[github-username\]" --include="*.ts" --include="*.md" --include="*.json" .
```

---

## Notes

**PRD Status**: Finalized

**Last Updated**: 2026-01-24

**Current Phase**: 4 (Final Review)

**Blockers**:
- None

**Decisions Made**:
- Theme colors: Fuchsia (#D946EF) primary, Cyan (#22D3EE) secondary
- All optional social links configured
- Full README rewrite based on detailed PRD
- Logo: V-shaped sync icon design
- Landing page: Customized for vibe-sync features

**Completed Work**:
- ✅ Phase 1: All core configuration files updated
- ✅ Phase 2: Visual assets customized (logo, hero-3d, landing page)
- ✅ Phase 3: Complete documentation (README, GitHub templates, CONTRIBUTING)
- ✅ Phase 4: TypeScript and lint checks passed

---

## Quick Reference

Files with `[placeholder]` values to replace:

```
website/src/lib/site-info.ts      # Main configuration
website/src/styles/globals.css    # Theme colors
package.json                      # Package info
LICENSE                           # Copyright
.github/workflows/deploy-website.yml
CONTRIBUTING.md

# Templates (copy and customize):
README.example.md                           → README.md
README_cn.example.md                        → README_cn.md
.github/ISSUE_TEMPLATE/bug_report.example.md      → bug_report.md
.github/ISSUE_TEMPLATE/feature_request.example.md → feature_request.md
.github/ISSUE_TEMPLATE/config.example.yml         → config.yml
.github/ISSUE_TEMPLATE/feedback.example.md        → feedback.md
.github/PULL_REQUEST_TEMPLATE.example.md          → PULL_REQUEST_TEMPLATE.md
```
