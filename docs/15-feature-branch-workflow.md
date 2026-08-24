# Feature Branch Workflow

## Non-Negotiable Rule

Every feature or independent fix gets its own branch.

The AI is not allowed to commit or push.

## Main Branches

Use the repository's default branch as the stable integration branch.

Do not implement features directly on the default branch.

## Naming

```text
feature/<name>
fix/<name>
refactor/<name>
docs/<name>
test/<name>
```

## Planned Feature Branches

Suggested sequence:

```text
feature/project-foundation
feature/database-schema
feature/authentication
feature/customer-management
feature/ticket-management
feature/ticket-conversation
feature/agent-dashboard
feature/customer-portal
feature/sla
feature/knowledge-base
feature/reports
feature/i18n-responsive
feature/ai-assistant
test/core-flows
docs/final-documentation
```

Small tightly coupled work may remain in the same feature branch. Unrelated work may not.

## AI Workflow

Before implementation, AI must:

1. inspect current branch
2. inspect working tree status
3. read relevant docs
4. confirm requested feature scope from documentation

If branch creation is requested, the AI may create a local branch.

During implementation AI must:
- limit changes to the feature
- avoid unrelated refactors
- update tests
- update documentation when behavior/contracts change

At completion AI must:
- run relevant checks
- show `git diff` summary
- list changed files
- provide a suggested commit message
- STOP

The developer manually reviews, stages, commits, merges, and pushes.

## Forbidden AI Git Commands

```text
git commit
git push
git push --force
git merge
git rebase
git reset --hard
git branch -D
git tag
```

The AI should not use equivalent destructive/history-changing commands through another tool.
