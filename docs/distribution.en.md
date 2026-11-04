# Plugin directories and installation

[中文](distribution.md)

The repository and npm package are both named `dsh-agent-compare`. AgentCompare ships a standard `dsh.bundle.patch` layer and a Web client through `dsh.client`. Markets can install the npm package or the GitHub source with its committed `lib/` runtime. Another market plugin is not a runtime dependency.

## Installation

In the official Desktop app, use **Plugins → Add plugin**. For a self-managed Web profile, follow the commands in the [README](../README.en.md#install). Desktop manages its own profile; installing into a separate Web profile does not install into Desktop.

Search terms include AgentCompare, dsh-agent-compare, A|B, live previews, blind selection and reviewed adoption. The package retains bilingual descriptions and relevant `dsh`, `dsh-plugin` and `deepseek-harness` keywords.

## Host compatibility

`engines.dsh` is `>=0.2.1-rc.3 <0.3.0-0`. DSH's `@deepseek-ai/dsh-app-boot` evaluates it with `includePrerelease: true`, so 0.2.2 alpha/rc versions participate. Default npm semver options do not establish a DSH installation rejection. The `-0` upper boundary excludes 0.3.0 prereleases.

Admission is separate from executed acceptance. Required Windows/Linux native runtime checks pin DSH 0.2.1-rc.5. Separately named, non-blocking `next host canary` jobs track the next channel. Each run prints the resolved host version and exercises that host's actual compatibility evaluator at the boundaries. Canary failures require investigation and are not passes; these jobs do not establish external-model or final Desktop-shell acceptance. See [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml) for the latest results.

## Directory sources

These are the services' published submission mechanisms, checked on 2026-11-04. They are independent community services. Each service owns its listing and recommendation decisions.

| Entry point | Integration |
|---|---|
| [Awesome DSH Plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) | One YAML entry, maintainer review, and automatic npm mapping back to the same repository. |
| [dsh-market](https://github.com/dsh-market/dsh-market#submit-your-plugin) | Consumes the Awesome DSH Plugin catalog. |
| [Open Plugin Market](https://github.com/polang233/dsh-plugin-index/blob/main/.github/CONTRIBUTING.md) | A submission Issue; review and growth labels follow its published rules. |
| [1024 Store](https://github.com/imsai-sh/awesome-deepseek-harness-plugins/blob/main/CONTRIBUTING.md) | One JSON entry; installation requires a published npm bundle. |
| [DSH Plugins Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace/blob/main/STANDARD.md) | Discovers the `dsh-plugin` topic and detects bundles and installation routes. |
| [DSH Market · dsh.market](https://github.com/2BingLing/dsh-market/blob/master/CONTRIBUTING.md) | Topic discovery or a submission Issue, with an optional author description. |
| [dsh-recommend](https://github.com/zp-home/dsh-recommend/blob/main/.github/ISSUE_TEMPLATE/submit-plugin.yml) | Topic discovery; curated certification requires an application and maintainer approval. |
| [DSH Get](https://github.com/bobby-sheng/dshget-data) | Aggregates public catalogs and GitHub topics; accepts correction and missing-entry Issues. |
| [DSH Plugin Registry](https://dshplugin.app/submit) | Submit a public repository for review. |
| [Harness Registry · dshdesk](https://github.com/majiayu000/dsh-plugin-registry/blob/main/docs/registry-governance.md) | Topic discovery and manifest checks, with a listing Issue for review requests. |
| [DSH Plugin Hub](https://dshpluginhub.ai/en/docs/plugin-not-found) | npm discovery and manual package submission; account authorization is required to claim and edit a listing. |
| [DeepseekPlugin](https://deepseekplugin.org/en/docs/submit-plugin) | Submit a public repository URL; recognition publishes a listing with repository details and installation instructions. |
| [dshmarketplace.dev](https://github.com/DshMarketPlace/dshmarketplace#contributing) | Submit a repository and use case through its website for manual review. |
| [DSH Learn](https://dshlearn.com/submit) | Resource submissions require a public repository, the problem solved and maintainer contact information. |
| [dsh.fish](https://dsh.fish/docs/publish/bundle) | Submit an npm bundle or repository; reads the actual manifest. |
| [dsh.pub](https://dsh.pub/zh/submit/) | Submit through the directory, with a pinned public source. |

DSH's native Discover surface reads third-party plugin indexes. Each index supplies its own versions, categories and labels; listing does not change the plugin's execution interface. See the [DSH index contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.md).

## Storefront images

- Icon: [`assets/icon.png`](../assets/icon.png), a 512 × 512 PNG, with [`SVG source`](../assets/icon.svg).
- Ordered screenshots: [`screenshots.json`](../screenshots.json) at the repository root, using relative paths.
- Capture facts: [`manifest.json`](media/screenshots/manifest.json) records the source package, host and image hashes.

The screenshots use fixed candidates and real applications, shared checks, interactions and adoption. Local paths are hidden. The current captures use the published npm package 0.2.0-alpha.18 on DSH 0.2.1-rc.5. Consult individual model-run records for generation timing.

## Data and permissions

The task and relevant project context go to the DSH model selected by the user. Provider endpoints and credentials come from the host configuration. Dependency installation contacts sources selected by the project's package manager and lockfile. Preview servers use local loopback addresses. The plugin has no separate telemetry or automatic upload feature.

Records, patches, screenshots and logs stay locally and can contain project content. Working-copy cleanup checks ownership. Adoption recovery directories retain original files for recovery. Export and sharing require user action; inspect the content before publishing it. Execution boundaries come from the host, and the interface reports the observed enforcement.

## Maintenance

After source changes, run `npm run build` and commit `lib/` together with the source. `npm run check:distribution` checks the manifest, images and repository mapping. CI runs `npm run check:prebuilt` to detect stale runtime files. Update the capture manifest when screenshots change, and update `screenshots.json` when paths change.
