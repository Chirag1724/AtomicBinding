# Contributing to AtomicBinding

Thank you for your interest in contributing to AtomicBinding. We welcome contributions from the community to improve the platform, documentation, and tooling.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand the expectations for participating in our community.

---

## Getting Started

### Prerequisites

Ensure your development environment meets the following minimum requirements:

- **Node.js**: Version `22.5.0` or higher (`node -v`)
- **npm**: Version `10.0.0` or higher (`npm -v`)
- **Git**: Version `2.30.0` or higher (`git -v`)

### Setting Up Your Local Environment

1. **Fork the Repository**:
   Fork the repository on GitHub to your personal account.

2. **Clone Your Fork**:
   ```bash
   git clone https://github.com/<your-username>/AtomicBinding.git
   ```

3. **Configure Upstream Remote**:
   ```bash
   git remote add upstream https://github.com/SrishtiSonam/AtomicBinding.git
   git fetch --all
   ```

4. **Install Dependencies**:
   ```bash
   npm install
   ```

5. **Configure Environment Variables**:
   Copy the example environment configuration file to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and set `IMPRINT_TOKEN` to your preferred local development secret.

6. **Initialize and Seed the Database**:
   ```bash
   npm run seed -- --reset --legacy
   ```

7. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3100`.

---

## Branch Naming Conventions

Always create a new branch from an up-to-date `main` branch before starting work:

```bash
git checkout main
git pull upstream main
git checkout -b <prefix>/<short-description>
```

Use the following standard prefixes:

- `feat/`: A new feature or capability
- `fix/`: A bug fix
- `docs/`: Documentation additions or revisions
- `refactor/`: Code restructuring without functional changes
- `test/`: Adding or modifying test suites
- `chore/`: Tooling, dependency, or configuration updates

Examples:
- `fix/cms-adapter-unregistered-types`
- `feat/postgres-store-driver`
- `docs/api-reference-guide`

---

## Commit Message Conventions

We adhere to the Conventional Commits specification. Commit messages should be structured as follows:

```text
<type>(<scope>): <subject>
```

### Allowed Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Formatting changes that do not affect code logic
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `chore`: Maintenance tasks and dependency updates

### Examples

- `fix(graph): preserve rows with unregistered document types for Gate 4 validation (#2)`
- `docs(readme): add troubleshooting section and environment table`
- `feat(store): add postgres storage adapter`

---

## Verification and Quality Standards

Before submitting a Pull Request, verify that all checks pass cleanly:

```bash
# 1. Run TypeScript strict typecheck across all packages
npm run typecheck

# 2. Run all deterministic build gates
npm run gates

# 3. Run the Vitest test suite
npm test

# 4. Verify system diagnostics
npm run doctor
```

### Architectural Principles

1. **Single Source of Truth**: All document and block types must be declared in `schema/`. Do not duplicate schemas in multiple places.
2. **Deterministic Build Gates**: Never bypass build gate invariants. If a gate fails, fix the underlying graph violation.
3. **Lossless Bindings**: Any changes to the binding compiler must maintain the round-trip invariant: `compile(decompile(rows)) === rows`.
4. **Type Safety**: Maintain strict TypeScript typing. Avoid `any` assertions.

---

## Pull Request Guidelines

1. **Keep Changes Focused**: Each pull request should resolve a single issue or implement a single feature.
2. **Include Tests**: Add unit or integration tests for new functionality or bug fixes.
3. **Reference Issues**: Link the corresponding issue in the description using GitHub keywords (for example, `Closes #123`).
4. **Follow the Template**: Complete the required sections in the Pull Request template.
5. **Self-Review**: Review your own diff before submitting to ensure no unnecessary changes or files are included.
