# S01: Set Up Automated Code Quality Checks

## TL;DR

> **Quick Summary**: Install Biome@1.9.4 + Lefthook, create configuration files, auto-fix existing issues, and document the workflow.
> 
> **Deliverables**:
> - biome.json with linting/formatting rules
> - lefthook.yml with pre-commit/pre-push hooks
> - VS Code settings for auto-format
> - Package.json scripts (lint, check, prepare)
> - AGENTS.md documentation update
> 
> **Estimated Effort**: Short (~20 min execution)
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Task 1 → Task 2 → Task 4 → Task 5 → Task 6

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Install Biome@1.9.4 + Lefthook dependencies
└── Task 3: Create VS Code settings files

Wave 2 (After Task 1):
└── Task 2: Create biome.json configuration

Wave 3 (After Task 2):
└── Task 4: Run check:fix to auto-fix all issues

Wave 4 (After Task 4):
└── Task 5: Create lefthook.yml + install git hooks

Wave 5 (After Task 5):
└── Task 6: Update AGENTS.md with linting documentation

Critical Path: Task 1 → Task 2 → Task 4 → Task 5 → Task 6
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 4, 5 | 3 |
| 2 | 1 | 4 | None |
| 3 | None | None | 1 |
| 4 | 1, 2 | 5, 6 | None |
| 5 | 4 | 6 | None |
| 6 | 5 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 3 | Two parallel `quick` category agents |
| 2 | 2 | One `quick` category agent |
| 3 | 4 | One `unspecified-low` category agent |
| 4 | 5 | One `quick` category agent with `git-master` skill |
| 5 | 6 | One `writing` category agent |

---

## Context

### Original Request
Set up automated code quality checks using Biome linter and Lefthook git hooks for the Echo monorepo (S01 from sprint backlog).

### Key Decisions
- **Biome version**: Pinned to 1.9.4 (matches PRD schema URL for reproducibility)
- **Package manager**: Bun with `-E` flag for exact version pinning
- **Hook timing**: Pre-commit (staged files) + Pre-push (full validation)

### Current State
- No existing linting/formatting configs (clean slate)
- No git hooks setup
- Has `check-types` script via Turbo
- Monorepo: apps/web, apps/fumadocs, apps/marketing, packages/*

---

## Work Objectives

### Core Objective
Establish automated code quality gates via Biome linting/formatting with git hooks to prevent quality regressions.

### Concrete Deliverables
- `biome.json` - Linting/formatting configuration
- `lefthook.yml` - Git hooks configuration
- `.vscode/settings.json` - Editor auto-format on save
- `.vscode/extensions.json` - Recommended Biome extension
- Updated `package.json` with lint/check/prepare scripts
- Updated `AGENTS.md` with linting workflow documentation

### Definition of Done
- [ ] `bun run check` exits with code 0
- [ ] `bun run check-types` exits with code 0
- [ ] Pre-commit hook runs successfully on staged files
- [ ] Pre-push hook validates full build
- [ ] VS Code auto-formats on save for TS/TSX/JSON files

### Must Have
- Biome@1.9.4 with exact PRD configuration
- Lefthook with pre-commit and pre-push hooks
- VS Code auto-format on save
- All auto-fixable issues resolved

### Must NOT Have (Guardrails)
- ESLint or Prettier (using Biome instead)
- npm or yarn commands (must use Bun)
- Skipping or bypassing hooks
- Manual linting workflows

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (no test framework)
- **User wants tests**: Manual verification via commands
- **QA approach**: Automated command verification

### Verification Approach
All acceptance criteria verified via bash commands - no user intervention required.

---

## TODOs

---

- [ ] 1. Install Biome and Lefthook Dependencies

  **What to do**:
  1. Run `bun add -E -D @biomejs/biome@1.9.4 lefthook`
  2. Edit root `package.json` to add these scripts:
     ```json
     "lint": "biome lint .",
     "lint:fix": "biome lint --write .",
     "check": "biome check .",
     "check:fix": "biome check --write .",
     "prepare": "lefthook install"
     ```

  **Must NOT do**:
  - Use npm or yarn
  - Install without `-E` (exact) flag
  - Install different version than 1.9.4
  - Modify workspace package.json files (root only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple dependency installation + JSON script addition
  - **Skills**: None required
    - Reason: Basic package installation, no domain expertise needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 2, 4, 5
  - **Blocked By**: None

  **References**:
  - `package.json:19-29` - Existing scripts section to extend

  **Acceptance Criteria**:
  ```bash
  # Verify dependencies installed
  bun pm ls 2>/dev/null | grep -E "@biomejs/biome|lefthook"
  # Assert: Both packages listed with exact versions

  # Verify biome version is 1.9.4
  bunx biome --version
  # Assert: Output contains "1.9.4"

  # Verify all 5 scripts exist in package.json
  cat package.json | grep -c -E '"lint"|"lint:fix"|"check"|"check:fix"|"prepare"'
  # Assert: Returns 5
  ```

  **Commit**: NO (groups with Task 2)

---

- [ ] 2. Create biome.json Configuration

  **What to do**:
  1. Create `biome.json` in repository root with this exact content:
     ```json
     {
       "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
       "vcs": {
         "enabled": true,
         "clientKind": "git",
         "useIgnoreFile": true,
         "defaultBranch": "main"
       },
       "files": {
         "ignore": [
           "node_modules",
           "dist",
           ".turbo",
           ".convex",
           "apps/web/.vinxi",
           "apps/web/.output",
           "packages/backend/.convex"
         ]
       },
       "formatter": {
         "enabled": true,
         "indentStyle": "tab",
         "lineWidth": 100
       },
       "organizeImports": {
         "enabled": true
       },
       "linter": {
         "enabled": true,
         "rules": {
           "recommended": true,
           "correctness": {
             "useExhaustiveDependencies": "info",
             "noUnusedVariables": "error",
             "noUnusedImports": "error"
           },
           "nursery": {
             "useSortedClasses": {
               "level": "warn",
               "fix": "safe",
               "options": {
                 "functions": ["clsx", "cva", "cn"]
               }
             }
           },
           "style": {
             "noParameterAssign": "error",
             "useAsConstAssertion": "error",
             "useImportType": "error"
           },
           "suspicious": {
             "noExplicitAny": "warn",
             "noConsoleLog": "warn"
           }
         }
       }
     }
     ```

  **Must NOT do**:
  - Modify the configuration from PRD specification
  - Create in workspace subdirectories
  - Add rules not specified

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with provided content
  - **Skills**: None required

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - PRD biome.json content (exact content provided above)

  **Acceptance Criteria**:
  ```bash
  # Verify file exists
  test -f biome.json && echo "exists"
  # Assert: "exists"

  # Verify biome can parse the config
  bunx biome check biome.json
  # Assert: Exit code 0 (config is valid)

  # Verify key settings
  grep -q '"indentStyle": "tab"' biome.json && grep -q '"lineWidth": 100' biome.json && echo "settings correct"
  # Assert: "settings correct"
  ```

  **Commit**: YES
  - Message: `chore(tooling): add biome@1.9.4 linter configuration`
  - Files: `biome.json`, `package.json`
  - Pre-commit: N/A (hooks not installed yet)

---

- [ ] 3. Create VS Code Configuration Files

  **What to do**:
  1. Create `.vscode/` directory
  2. Create `.vscode/settings.json` with this exact content:
     ```json
     {
       "[javascript]": {
         "editor.defaultFormatter": "biomejs.biome",
         "editor.formatOnSave": true
       },
       "[javascriptreact]": {
         "editor.defaultFormatter": "biomejs.biome",
         "editor.formatOnSave": true
       },
       "[typescript]": {
         "editor.defaultFormatter": "biomejs.biome",
         "editor.formatOnSave": true
       },
       "[typescriptreact]": {
         "editor.defaultFormatter": "biomejs.biome",
         "editor.formatOnSave": true
       },
       "[json]": {
         "editor.defaultFormatter": "biomejs.biome",
         "editor.formatOnSave": true
       },
       "[jsonc]": {
         "editor.defaultFormatter": "biomejs.biome",
         "editor.formatOnSave": true
       },
       "editor.codeActionsOnSave": {
         "quickfix.biome": "explicit",
         "source.organizeImports.biome": "explicit"
       },
       "biome.enabled": true
     }
     ```
  3. Create `.vscode/extensions.json` with this exact content:
     ```json
     {
       "recommendations": ["biomejs.biome"]
     }
     ```

  **Must NOT do**:
  - Add settings beyond PRD specification
  - Add non-Biome related extensions
  - Create user-specific settings

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two small JSON files with provided content
  - **Skills**: None required

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - PRD content (exact content provided above)

  **Acceptance Criteria**:
  ```bash
  # Verify files exist
  test -f .vscode/settings.json && test -f .vscode/extensions.json && echo "both exist"
  # Assert: "both exist"

  # Verify settings.json is valid JSON
  cat .vscode/settings.json | bun -e "JSON.parse(await Bun.stdin.text()); console.log('valid')"
  # Assert: "valid"

  # Verify Biome is set as formatter
  grep -c "biomejs.biome" .vscode/settings.json
  # Assert: Returns 6 or more (one per language setting)

  # Verify extension recommendation
  grep -q "biomejs.biome" .vscode/extensions.json && echo "recommended"
  # Assert: "recommended"
  ```

  **Commit**: YES
  - Message: `chore(vscode): add biome formatter settings`
  - Files: `.vscode/settings.json`, `.vscode/extensions.json`
  - Pre-commit: N/A (hooks not installed yet)

---

- [ ] 4. Run Biome Auto-Fix on Entire Codebase

  **What to do**:
  1. Run `bun run check:fix` to auto-fix all fixable issues
  2. If any errors remain that can't be auto-fixed, manually address them
  3. Verify `bun run check` passes with 0 errors
  4. Verify `bun run check-types` still passes (formatting shouldn't break types)

  **Must NOT do**:
  - Ignore unfixable errors (must resolve all)
  - Disable rules to make checks pass
  - Break existing functionality

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: May need judgment for unfixable errors
  - **Skills**: [`typescript-programmer`]
    - Reason: May need to understand TypeScript errors if manual fixes needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `apps/*/src/**/*.{ts,tsx}` - Source files to check
  - `packages/*/src/**/*.ts` - Package source files
  - `biome.json` - Rules being applied

  **Acceptance Criteria**:
  ```bash
  # Run auto-fix (may modify files)
  bun run check:fix
  # Assert: Command completes

  # Verify all checks pass
  bun run check
  # Assert: Exit code 0

  # Verify TypeScript still passes
  bun run check-types
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `style: apply biome auto-formatting to codebase`
  - Files: All modified source files (*.ts, *.tsx, *.json)
  - Pre-commit: N/A (hooks not installed yet)

---

- [ ] 5. Create Lefthook Configuration and Install Hooks

  **What to do**:
  1. Create `lefthook.yml` in repository root with this exact content:
     ```yaml
     pre-commit:
       parallel: true
       commands:
         lint:
           glob: "*.{ts,tsx,js,jsx,json}"
           run: bunx biome check --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
         
         typecheck:
           glob: "*.{ts,tsx}"
           run: bun run check-types

     pre-push:
       parallel: true
       commands:
         lint:
           run: bun run check
         
         typecheck:
           run: bun run check-types
         
         build:
           run: bun run build
     ```
  2. Run `bun run prepare` to install git hooks
  3. Verify hooks are installed in `.git/hooks/`

  **Must NOT do**:
  - Modify hook configuration from PRD
  - Skip hook installation verification
  - Add hooks that bypass validation

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File creation + one command
  - **Skills**: [`git-master`]
    - Reason: Understands git hooks and can verify installation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential)
  - **Blocks**: Task 6
  - **Blocked By**: Task 4

  **References**:
  - PRD lefthook.yml content (exact content provided above)
  - `.git/hooks/` - Git hooks directory

  **Acceptance Criteria**:
  ```bash
  # Verify lefthook.yml exists
  test -f lefthook.yml && echo "exists"
  # Assert: "exists"

  # Install hooks
  bun run prepare
  # Assert: Outputs "SERVED" or similar success message

  # Verify hooks are installed
  test -f .git/hooks/pre-commit && test -f .git/hooks/pre-push && echo "hooks installed"
  # Assert: "hooks installed"

  # Test pre-commit hook works (dry run)
  bunx lefthook run pre-commit
  # Assert: Exit code 0 (all checks pass)
  ```

  **Commit**: YES
  - Message: `chore(tooling): add lefthook git hooks for code quality`
  - Files: `lefthook.yml`
  - Pre-commit: Hooks run automatically

---

- [ ] 6. Update AGENTS.md with Linting Workflow Documentation

  **What to do**:
  1. Add new "Linting & Formatting" section after "Build & Validation" section (~line 114)
  2. Document all new commands with descriptions
  3. Document git hooks behavior
  4. Update Quick Reference table with new commands

  **Content to add after line 114** (after Build & Validation section):
  ```markdown
  ### Linting & Formatting
  ```bash
  bun run lint            # Run Biome linter
  bun run lint:fix        # Fix auto-fixable lint issues
  bun run check           # Run Biome linter + formatter check
  bun run check:fix       # Fix all auto-fixable issues (lint + format)
  ```

  ### Git Hooks (via Lefthook)
  - **Pre-commit**: Runs `biome check` on staged files + `check-types`
  - **Pre-push**: Runs full `check`, `check-types`, and `build`

  To skip hooks in emergencies: `git commit --no-verify` (use sparingly)
  ```

  **Update Quick Reference table** to add:
  ```
  | Lint code | `bun run check` |
  | Fix lint issues | `bun run check:fix` |
  ```

  **Must NOT do**:
  - Remove existing AGENTS.md content
  - Document features not implemented
  - Add incorrect command information

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation writing task
  - **Skills**: None required

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5

  **References**:
  - `AGENTS.md:110-114` - Build & Validation section (insert after this)
  - `AGENTS.md:316-325` - Quick Reference table to update

  **Acceptance Criteria**:
  ```bash
  # Verify Linting section exists
  grep -q "### Linting & Formatting" AGENTS.md && echo "section exists"
  # Assert: "section exists"

  # Verify Git Hooks section exists
  grep -q "### Git Hooks" AGENTS.md && echo "hooks documented"
  # Assert: "hooks documented"

  # Verify Quick Reference updated
  grep -A20 "Quick Reference" AGENTS.md | grep -q "bun run check"
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `docs: add linting workflow to AGENTS.md`
  - Files: `AGENTS.md`
  - Pre-commit: Standard hooks run

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 2 | `chore(tooling): add biome@1.9.4 linter configuration` | biome.json, package.json |
| 3 | `chore(vscode): add biome formatter settings` | .vscode/* |
| 4 | `style: apply biome auto-formatting to codebase` | *.ts, *.tsx, *.json (modified) |
| 5 | `chore(tooling): add lefthook git hooks for code quality` | lefthook.yml |
| 6 | `docs: add linting workflow to AGENTS.md` | AGENTS.md |

---

## Success Criteria

### Final Verification Commands
```bash
bun run check        # Expected: exit 0, no errors
bun run check-types  # Expected: exit 0
bunx lefthook run pre-commit  # Expected: exit 0
ls .git/hooks/pre-commit      # Expected: file exists
```

### Acceptance Criteria Checklist
- [ ] biome.json exists with exact PRD content
- [ ] lefthook.yml exists with exact PRD content
- [ ] .vscode/settings.json enables auto-format on save
- [ ] .vscode/extensions.json recommends Biome extension
- [ ] package.json has lint/lint:fix/check/check:fix/prepare scripts
- [ ] `bun run check` passes with 0 errors
- [ ] `bun run check-types` passes
- [ ] Git hooks installed (.git/hooks/pre-commit exists)
- [ ] Pre-commit hook runs successfully
- [ ] AGENTS.md documents linting workflow
