# Cyan v1.0.1

Cyan is a CLI preprocessor for GitLab CI YAML. It lets you write `@annotations` inside `script:` blocks of .gitlab-ci.cyan.yml files, which Cyan expands into pre-built or custom, parameterized snippets. This produces an ordinary .gitlab-ci.yml that GitLab CI understands natively. Cyan v1.0.1 currently has no runtime component - it only runs at build time, before your pipeline executes.

Cyan is GitLab CI–only and CLI-only. It does not support GitHub Actions, Azure Pipelines, or other CI platforms, and there's no editor plugin or live/runtime expansion yet; annotations are only ever expanded by explicitly running `cyan build` or `cyan expand`. Snippets support simple `{{param}}` string parameters with defaults; there's no conditional or loop logic inside snippets, by design. This keeps expanded output fully predictable and easy to audit.
<br><br>

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Annotation Syntax](#annotation-syntax)
- [Commands](#commands)
- [Bundled Snippets](#bundled-snippets)
- [Local Snippet Overrides](#local-snippet-overrides)
- [Why Trust This?](#why-trust-this)
- [License](#license)

<br>

## Installation

Install globally from npm:

```bash
npm install -g cyan-cli
```

Verify with:

```bash
cyan --help
```

To work on Cyan:

```bash
git clone <repo-url>
cd cyan
npm install
npm run build
npm link
```

This builds the CLI to `dist/cli.js` and links the `cyan` command globally. Verify with:

```bash
cyan --help
```

For development (editing Cyan itself), you can skip the build step and run the CLI directly against source:

```bash
npx tsx src/cli.ts <command>
```

<br>

## Quick Start

```bash
cyan init
```

This creates `.gitlab-ci.cyan.yml` and an empty `cyan-snippets`/ folder in the current directory:

```bash
Created .gitlab-ci.cyan.yml and cyan-snippets/
```

The starter file looks like this:

```yaml
# This is a Cyan source file. Cyan expands @annotations inside script:
# blocks into real CI commands and writes a plain .gitlab-ci.yml file
# that GitLab CI understands natively.
#
# Run `cyan build .gitlab-ci.cyan.yml` to generate .gitlab-ci.yml.
# Run `cyan expand --explain .gitlab-ci.cyan.yml` to preview the expansion
# without writing anything.
# Run `cyan lint .gitlab-ci.cyan.yml` to validate annotations only.

stages:
  - build

build-image:
  stage: build
  script:
    - '@docker-build-push(dockerfile: "Dockerfile", context: ".")'
```

Edit it as needed, then validate your annotations before building:

```bash
cyan lint .gitlab-ci.cyan.yml
```

Preview exactly what each annotation will expand to, without writing any file:

```bash
cyan expand --explain .gitlab-ci.cyan.yml
```

When you're satisfied, generate the real `.gitlab-ci.yml`:

```bash
cyan build .gitlab-ci.cyan.yml
```

If `.gitlab-ci.cyan.yml` already exists, cyan init will refuse to overwrite it:

```bash
Error: .gitlab-ci.cyan.yml already exist. Pass --force to overwrite it.
```

Pass `--force` to overwrite the starter file specifically:

```bash
cyan init --force
```

Note that `--force` only applies to the starter file. If `cyan-snippets/` already exists as a non-directory or non-empty directory, `cyan init` always fails - `--force` does not override this:

```bash
Error: cyan-snippets already exists and is not a directory.
Error: cyan-snippets already exists and is not empty.
```

<br>

## Annotation Syntax

An annotation must be the **entire trimmed scalar value** of a sequence item inside a `script:` block. Cyan detects annotations by matching the whole (trimmed) string of each script list item. Annotations embedded mid-string or used as mapping values are not recognized and are left untouched.

```yaml
script:
  - '@docker-build-push(dockerfile: "Dockerfile", context: ".")' # recognized
  - echo "@docker-build-push(...)" # NOT recognized - left as-is
```

**Call syntax:**

```
@namespace-name(param: "value", param2: "value2")
```

- The namespace/name split happens on the first hyphen only. `docker-build-push` splits into namespace `docker`, name `build-push` - so a snippet named `build-push` under namespace `docker` is called as `@docker-build-push(...)`, not `@docker-build-push-push(...)` or similar ambiguity.
- Parameters are `key: "value"` pairs, comma-separated, always double-quoted strings. There are no number or boolean parameter types in v1.
- Unknown parameters are rejected - passing a param the snippet doesn't define is a hard error, not a silent ignore.
- Optional parameters have a default; if omitted, the default is used. If a parameter has no default and no value is supplied, that's a hard build error (since Cyan has no conditionals, an unfilled `{{param}}` would otherwise produce broken output).

`{{param}}` **vs** `$VAR` **- never blur these:**

- `{{param}}` is a **Cyan parameter** - resolved and substituted at build time, before GitLab ever sees the file.
- `$VAR` (e.g. `$CI_COMMIT_SHA`, `$CI_REGISTRY`) is a **native GitLab CI variable** - left completely untouched by Cyan, resolved by GitLab itself when the pipeline runs.

Example from the `docker-build-push` snippet, showing both in the same expanded block:

```yaml
script:
  - docker build -f {{dockerfile}} -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA {{context}}
  - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

Here `{{dockerfile}}` and `{{context}}` come from the annotation call's params; `$CI_REGISTRY_IMAGE` and `$CI_COMMIT_SHA` are GitLab's own predefined variables, untouched.

<br>

## Commands

### **`cyan init [--force]`**

Scaffolds a starter `.gitlab-ci.cyan.yml` and an empty `cyan-snippets/` folder in the current directory. Works fully offline. Checks both the starter file and the cyan-snippets/ folder for collisions before writing anything. If either check fails, nothing is written.

- `--force` - overwrite an existing `.gitlab-ci.cyan.yml`. Does not apply to `cyan-snippets/`: a pre-existing non-directory or non-empty `cyan-snippets` is always a hard error, regardless of `--force`.

Success:

```bash
$ cyan init
Created .gitlab-ci.cyan.yml and cyan-snippets/
```

Exit code `0`.

Failure (starter file exists, no `--force`):

```bash
$ cyan init
Error: .gitlab-ci.cyan.yml already exists. Pass --force to overwrite it.
```

Exit code `1`. Same pattern (`Error: <message>`, exit `1`) applies to the two `cyan-snippets/` collision cases.

<br>

### **`cyan build <source> [-o|--output <path>]`**

Expands all annotations in `<source>` and writes plain GitLab CI YAML. All-or-nothing: if any annotation fails to resolve, no file is written and the build is aborted before anything touches disk.

- `<source>` - required, path to the `.cyan.yml` source file
- `-o, --output <path>` - output file path. Defaults to `<source>` with `.cyan.yml` stripped and `.yml` appended in the same directory - e.g. `.gitlab-ci.cyan.yml` → `.gitlab-ci.yml`. If the source filename doesn't follow the `.cyan.yml` convention, Cyan falls back to stripping whatever extension is present and appending `.yml`.

Success:

```bash
$ cyan build .gitlab-ci.cyan.yml
Build succeeded: 1 annotation(s) expanded. Wrote .gitlab-ci.yml.
```

Exit code `0`. (A source file with zero annotations still succeeds, writing the file unchanged: `No annotations found. Wrote .gitlab-ci.yml unchanged.`)

Failure (e.g. unknown snippet, missing required parameter):

```bash
$ cyan build .gitlab-ci.cyan.yml
<formatted error block(s) - location, snippet, reason>

Build aborted: 1 annotation(s) failed. No file written.
```

Exit code `1`.

<br>

### **`cyan expand --explain <source>`**

Dry run: for every annotation in `<source>`, prints its location, which snippet resolved (namespace/name, version, and whether it came from `local` or `bundled`), and the exact lines it would expand to, without writing any file.

- `<source>` - required, path to the `.cyan.yml` source file
- `--explain` - required in v1. Running `cyan expand <source>` without `--explain` does not perform a bare dry run; it prints an error telling you to add the flag:

```bash
expand: only --explain is currently implemented. Run `cyan expand --explain <source>`.
```

and exits with code `1`.

Example, all annotations resolved:

```bash
$ cyan expand --explain .gitlab-ci.cyan.yml
Line 8, col 5 - build-image.script[0]
RESOLVED: docker/build-push (v1, bundled)
expands to:
  - docker build -f Dockerfile -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
  - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

2 annotation(s) checked, all resolved.
```

Exit code `0`.

If any annotation fails to parse or resolve, each failure is reported inline (same location-sorted output), and the summary and exit code reflect it:

```bash
1 annotation(s) checked, 0 failed.
```

becomes

```bash
2 annotation(s) checked, 1 failed.
```

Exit code `1`.

A source file with no annotations at all:

```bash
No annotations found. Nothing to explain.
```

Exit code `0`.

<br>

### **`cyan lint <source>`**

Validates that every annotation in `<source>` resolves to a known snippet with all required parameters present, without writing any output. Suitable for a pre-commit hook.

- `<source>` - required, path to the `.cyan.yml` source file

If everything is valid, the output is a single summary line:

```bash
$ cyan lint .gitlab-ci.cyan.yml
2 annotation(s) checked, all valid.
```

Exit code `0`.

If anything fails, each annotation is listed individually (passing ones marked `OK:`, failing ones marked `FAILED:` with the specific error), followed by a summary:

```bash
$ cyan lint .gitlab-ci.cyan.yml
Line 8, col 5 - build-image.script[0]
OK: docker/build-push

Line 12, col 5 - deploy.script[0]
FAILED: kubectl/apply
 - missing required parameter "namespace"

2 annotation(s) checked, 1 failed.
```

Exit code `1`.

A source file with no annotations:

```bash
No annotations found. Nothing to lint.
```

Exit code `0`.

<br>

## Bundled Snippets

Cyan ships with five bundled snippets, versioned with the CLI itself. A local snippet in `cyan-snippets/` with the same namespace/name overrides the bundled one (see Local Snippet Overrides).

### `aws-login` (namespace `aws`, name `login`)

Configures the AWS CLI using static credentials from `$AWS_ACCESS_KEY_ID` / `$AWS_SECRET_ACCESS_KEY`, and verifies the login with `sts get-caller-identity`.

> ⚠️ This snippet uses static, long-lived AWS credentials. For OIDC role assumption (short-lived credentials, no long-lived secrets stored), use `aws-login-oidc` instead.

| **Parameter** | **Required** | **Default** |
| ------------- | ------------ | ----------- |
| `region`      | yes          | -           |
| `profile`     | no           | `default`   |

```yaml
- '@aws-login(region: "us-east-1")'
```

<br>

### `aws-login-oidc` (namespace `aws`, name `login-oidc`)

Configures AWS credentials via OIDC federation by exchanging GitLab's ID token for temporary credentials via `sts assume-role-with-web-identity`, then verifies the login with `sts get-caller-identity`. Exports `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` as environment variables for subsequent script lines - no long-lived AWS credentials are stored anywhere.

> ⚠️ Requires a manually-configured job-level `id_tokens:` block. Cyan cannot write this for you - it's a job-level YAML field, not a script sequence item. Add this as a sibling of `script:` in your job:
>
> ```yaml
> id_tokens:
>   AWS_ID_TOKEN:
>     aud: https://gitlab.com # match whatever audience your AWS IAM OIDC provider trust policy expects
> ```
>
> The `id_tokens:` key name above must match this snippet's `token_var` parameter (default `AWS_ID_TOKEN`) - override `token_var` if you name your token key something else. If `id_tokens:` is missing or the name doesn't match, the snippet fails at runtime with an undefined-variable or `AccessDenied` error; Cyan cannot detect this at build time.

| **Parameter**       | **Required** | **Default**                                       |
| ------------------- | ------------ | ------------------------------------------------- |
| `role_arn`          | yes          | -                                                 |
| `region`            | yes          | -                                                 |
| `role_session_name` | no           | `GitLabRunner-${CI_PROJECT_ID}-${CI_PIPELINE_ID}` |
| `duration_seconds`  | no           | `3600`                                            |
| `token_var`         | no           | `AWS_ID_TOKEN`                                    |

```yaml
- '@aws-login-oidc(role_arn: "arn:aws:iam::123456789012:role/gitlab-ci", region: "us-east-1")'
```

<br>

### `azure-login` (namespace `azure`, name `login`)

Logs in to the Azure CLI using a service principal, via `$AZURE_CLIENT_ID` / `$AZURE_CLIENT_SECRET` / `$AZURE_TENANT_ID`, sets the active subscription, and verifies with `account show`.

| **Parameter**  | **Required** | **Default** |
| -------------- | ------------ | ----------- |
| `subscription` | yes          | -           |

```yaml
- '@azure-login(subscription: "my-subscription-id")'
```

<br>

### `docker-build-push` (namespace `docker`, name `build-push`)

Builds a Docker image tagged with the GitLab commit SHA and pushes it to the project's container registry, using GitLab's own `$CI_REGISTRY_IMAGE` and `$CI_COMMIT_SHA`. Does not perform `docker login` - assumes the pipeline has already authenticated to the registry separately.

| **Parameter** | **Required** | **Default**  |
| ------------- | ------------ | ------------ |
| `dockerfile`  | no           | `Dockerfile` |
| `context`     | no           | `.`          |

```yaml
- '@docker-build-push(dockerfile: "Dockerfile", context: ".")'
```

<br>

### `kubectl-apply` (namespace `kubectl`, name `apply`)

Selects a kubectl context and applies a manifest to a namespace. Assumes a working kubeconfig already exists in the environment (typically injected via a GitLab CI/CD file-type variable or a separate auth step). It does not set up kubeconfig itself.

| **Parameter** | **Required** | **Default** |
| ------------- | ------------ | ----------- |
| `context`     | yes          | -           |
| `manifest`    | yes          | -           |
| `namespace`   | no           | `default`   |

```yaml
- '@kubectl-apply(context: "prod-cluster", manifest: "k8s/deploy.yaml", namespace: "production")'
```

<br>

## Local Snippet Overrides

Cyan resolves every annotation against two possible sources: a local `cyan-snippets/` folder in your project, and the snippets bundled with the CLI itself.

Resolution order: local first, then bundled. If `cyan-snippets/` contains a snippet with the same namespace and name as a bundled one, the local version is used instead - the bundled snippet is never silently mixed in or merged with it. There's no partial override; whichever version resolves is used in full.

This is the only override mechanism. There's no remote registry, no network fetch, and no other way to customize or replace a snippet's behavior. This keeps Cyan fully offline and means the full set of snippets available to a build is always just two folders you can inspect directly; the CLI's own `snippets/bundled/`, and the project's `cyan-snippets/`.

To override a bundled snippet, create a file in `cyan-snippets/` following the same snippet file format (`name`, `namespace`, `version`, `description`, `parameters`, `script`) with the matching `namespace`/`name`. For example, to override the bundled `docker-build-push` snippet with a version that adds registry cache flags, you'd place a snippet with `namespace: docker`, `name: build-push` in `cyan-snippets/`.

`cyan expand --explain` reports which source each annotation resolved from, `local` or `bundled`, so it's always visible which version of a snippet is actually in effect for a given build.

<br>

## Why Trust This?

Cyan touches credential and deployment logic; AWS keys, Azure service principals, container registry pushes, kubectl context switches. A tool that expands hidden CI logic in that space needs to earn trust, not ask for it. A few concrete design choices reflect that:

- **Every expansion is inspectable before it happens.** `cyan expand --explain` shows exactly what each annotation will produce; the resolved snippet, its version, whether it came from `local` or `bundled`, and the literal expanded lines, without writing anything. Nothing is expanded silently; you can always see the real output before it lands in `.gitlab-ci.yml`.
- **No partial writes.** `cyan build` is all-or-nothing: if any annotation fails to resolve, no file is written at all. There's no scenario where a build partially succeeds and leaves a `.gitlab-ci.yml` that's half-expanded or silently missing a step.
- **Your YAML stays your YAML.** Cyan uses a round-trip-preserving parser, so comments, formatting, and blank lines outside of expanded annotations are never mangled or reformatted. The diff between your source and the generated output should only ever show the annotation lines actually being expanded.
- **Errors are explicit, not guessed.** Unknown parameters in an annotation call are rejected rather than ignored. A required parameter with no value and no default is a hard build error. Cyan has no conditional logic, so there's no such thing as a parameter that's "sometimes" needed; if it's required, it's required, and a missing value never silently produces broken output.
- **Result types, not exceptions.** Internally, Cyan represents success and failure as explicit discriminated unions (`{ ok: true }` / `{ ok: false }`) rather than throwing. This isn't visible to you as a user, but it means failure paths are handled deliberately throughout the codebase rather than falling through to an uncaught exception.

None of this makes Cyan clever. That's deliberate choice for a tool sitting in front of deploy and login steps - boring and inspectable beats convenient and opaque.

<br>

## License

MIT
