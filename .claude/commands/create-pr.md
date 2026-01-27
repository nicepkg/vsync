---
description: Create GitHub Pull Request following Angular commit convention
argument-hint: [optional description]
---

# Create Pull Request (Semantic-release Friendly)

Create a GitHub Pull Request that works with semantic-release.
This repo defaults to **Squash and merge**, so the **PR title becomes the release commit**.
Therefore the PR title MUST follow Conventional Commits _exactly_:

```
<type>(<scope>): <subject>
```

**Hard rules (must pass CI):**

- Subject must be lowercase
- Subject must NOT end with a period
- Header length must be <= 100 characters
- Scope is optional, but if used must be one of: `website`, `docs`, `deps`, `cli`

## Context

- Current branch: !`git branch --show-current`
- Base branch: main
- Git status: !`git status --short`
- Changed files: !`git diff --name-only origin/main`
- Diff stat: !`git diff --stat origin/main`
- Recent commits on branch: !`git log origin/main..HEAD --oneline`

## Prerequisites

1. Ensure `gh` CLI is available and authenticated:

   ```bash
   gh auth status
   ```

2. Ensure all changes are committed and branch is pushed:
   ```bash
   git status
   git push -u origin HEAD
   ```

## PR Title Format (Angular Convention)

**IMPORTANT**: PR title MUST follow Angular/Conventional Commit format because squash uses it as the release commit.

```
<type>(<scope>): <subject>
```

### Types

| Type       | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `feat`     | A new feature                                                 |
| `fix`      | A bug fix                                                     |
| `docs`     | Documentation only changes                                    |
| `style`    | Changes that do not affect the meaning of the code            |
| `refactor` | A code change that neither fixes a bug nor adds a feature     |
| `perf`     | A code change that improves performance                       |
| `test`     | Adding missing tests or correcting existing tests             |
| `build`    | Changes that affect the build system or external dependencies |
| `ci`       | Changes to CI configuration files and scripts                 |
| `chore`    | Other changes that don't modify src or test files             |
| `revert`   | Reverts a previous commit                                     |

### Scopes (optional)

- `website` - Changes to the website package
- `docs` - Documentation changes
- `deps` - Dependency updates

### Examples

```
feat(website): add dark mode toggle
fix(website): resolve hydration mismatch on mobile
docs: update README with installation steps
chore(deps): update dependencies
refactor: simplify authentication logic
```

### Rules

- Subject must NOT be empty
- Subject must NOT end with a period
- Subject should NOT start with uppercase
- Header (type + scope + subject) max 100 characters

## Creating a Pull Request

### Fill the PR Template

Use `.github/PULL_REQUEST_TEMPLATE.md` as the base. Fill in the summary, fixes, and type.

### Recommended Command (template-based)

```bash
gh pr create \
  --title "feat(scope): short, lowercase summary" \
  --body "$(cat <<'EOF'
## Description

Brief summary of the change and why it matters.

Fixes #123

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published

## Screenshots (if applicable)

N/A
EOF
)" \
  --base main
```

### Draft PR (WIP)

```bash
gh pr create --title "feat(scope): wip summary" --body "WIP" --base main --draft
```

## Useful Commands

```bash
# List your open PRs
gh pr list --author "@me"

# Check PR status
gh pr status

# View a specific PR
gh pr view <PR-NUMBER>

# Convert draft to ready for review
gh pr ready <PR-NUMBER>

# Add reviewers
gh pr edit <PR-NUMBER> --add-reviewer username1,username2

# Merge PR (squash recommended)
gh pr merge <PR-NUMBER> --squash --delete-branch
```

## Common Mistakes to Avoid

1. **Wrong title format**: Always use `type(scope): subject` format
2. **Starting subject with uppercase**: Use lowercase (e.g., `add` not `Add`)
3. **Ending with period**: No period at the end of subject
4. **Missing type**: Always include type prefix
5. **Using emoji in title**: No emoji in PR titles (Angular convention)

## Related Documentation

- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Commit convention details
- [PR Template](../../.github/PULL_REQUEST_TEMPLATE.example.md) - PR description template
- [Angular Commit Convention](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [GitHub CLI Manual](https://cli.github.com/manual/)
