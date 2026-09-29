# React External App

An external React starter template for customer-facing apps on the Salesforce platform. Includes authentication, global search, and an Experience Cloud site container. Built with React, Vite, TypeScript, and Tailwind/shadcn.

## What's included

```
force-app/main/default/
├── classes/                      # Apex Auth Logic
│   ├── UIBundleAuthUtils.cls
│   ├── UIBundleChangePassword.cls
│   ├── UIBundleForgotPassword.cls
│   ├── UIBundleLogin.cls
│   └── UIBundleRegistration.cls
├── digitalExperienceConfigs/     # Site configuration
├── digitalExperiences/           # Site definition & branding
├── networks/                     # Experience Cloud network setup
├── sites/                        # Salesforce Site metadata
└── uiBundles/
    └── frontend/         # React UI Bundle (source, config, tests)
```

## Getting started

Install project dependencies and start the local dev server:

```bash
npm install
npm run sf-project-setup
```

This installs the UI Bundle dependencies, builds the app, and opens the dev server at http://localhost:5173. For manual build and test instructions, see the [UI Bundle README](force-app/main/default/uiBundles/frontend/README.md).

## Add features

Use the features CLI to install additional UI features into the UI Bundle.

List all available features:

```bash
npx @salesforce/ui-bundle-features-experimental list
```

Get details about a specific feature (description, dependencies, files, and integration examples):

```bash
npx @salesforce/ui-bundle-features-experimental describe <feature-name>
```

Install a feature:

```bash
npx @salesforce/ui-bundle-features-experimental install <feature-name> --ui-bundle-dir frontend
```

After installation, the CLI will list any `__example__` files that need manual integration. Read each example file to see the integration pattern, apply it to the target file, then delete the example file.

## Deploy

### Deploy everything (metadata + Experience Cloud site + UI Bundle)

```bash
cd force-app/main/default/uiBundles/frontend && npm install && npm run build && cd -
sf project deploy start --source-dir force-app --target-org <alias>
```

### Deploy the UI Bundle only

```bash
cd force-app/main/default/uiBundles/frontend && npm install && npm run build && cd -
sf project deploy start --source-dir force-app/main/default/uiBundles --target-org <alias>
```

### Deploy Experience Cloud site only

```bash
sf project deploy start \
  --source-dir force-app/main/default/digitalExperienceConfigs \
  --source-dir force-app/main/default/digitalExperiences \
  --source-dir force-app/main/default/networks \
  --source-dir force-app/main/default/sites \
  --target-org <alias>
```

### Deploy authentication classes only

```bash
sf project deploy start --source-dir force-app/main/default/classes --target-org <alias>
```

Replace `<alias>` with your target org alias.

## Setup scripts

Two npm scripts at the project root streamline getting started and deployment.

**`npm run sf-project-setup`** — installs the UI Bundle dependencies, builds the app, and starts the dev server (see [Getting started](#getting-started)).

**`npm run setup`** — runs the full deployment setup in one command: org login (a required precondition, auto-skipped if already connected), UI Bundle build, deploy metadata, fetch GraphQL schema, and run codegen. It no longer starts the dev server — run `npm run dev:preview` for that:

> **Guest and Portal GraphQL API Access requires an org preference** Starting with org release 264, unauthenticated (guest) sessions can only call the GraphQL API — the endpoint this app's data layer uses — if the **Enable GraphQL API for Guest Users** org preference is enabled. It is off by default. This is a security-sensitive, org-wide setting, so enable it through **Setup > Security > API Access Controls > Enable GraphQL API for Guest Users**. Enable it before configuring a guest user profile for this site. Without it, guest GraphQL calls fail with `403 GUEST_INSUFFICIENT_ACCESS`. This applies to any b2b/b2c (external) app whose site allows guest browsing.

```bash
# Install project dependencies first (required before running setup)
npm install

npm run setup -- --target-org <alias>
```

Running without flags presents an interactive step picker. Pass `--yes` to skip it and run all steps immediately:

```bash
npm run setup -- --target-org <alias> --yes
```

Common options:

| Option                    | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `--target-org <alias>`    | Target org. If omitted, uses default org/prompt |
| `--skip-deploy`           | Do not deploy metadata                          |
| `--skip-graphql`          | Skip GraphQL schema fetch and codegen           |
| `--skip-ui-bundle-build`  | Skip `npm install` and UI Bundle build          |
| `--ui-bundle-name <name>` | UI Bundle folder name when multiple exist       |
| `-y, --yes`               | Skip interactive step picker; run all steps     |

> Login is a required precondition (no `--skip-login`), and the dev server is no longer part of setup (no `--skip-dev`); both flags are accepted but ignored. To start the dev server after setup, run `npm run dev:preview`.

For all options: `npm run setup -- --help`.

## Configure Your Salesforce DX Project

The `sfdx-project.json` file contains useful configuration information for your project. See [Salesforce DX Project Configuration](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm) in the _Salesforce DX Developer Guide_ for details about this file.

## Read All About It

- [Salesforce Extensions Documentation](https://developer.salesforce.com/tools/vscode/)
- [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro.htm)
- [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference.htm)
