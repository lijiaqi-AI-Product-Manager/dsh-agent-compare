# Windows process compatibility

[简体中文](windows-process-compat.md)

This feature is on unreleased main. The public npm 1.1.0 interface does not include this control.

Expand **Advanced Windows settings** in the A|B composer settings and choose **Automatic (recommended)** or **Turn compatibility off**. The preference is saved for the conversation and frozen into shared acceptance when a comparison starts. Later preference changes do not alter existing candidates, adoption rehearsal or retained previews.

Automatic mode adapts esbuild service pipes, version probes and Vite's optional network-drive probe for the current host's confined Windows processes. Off mode does not inject these preloads or inherit their activation switches. Host confinement, frozen installation, lifecycle permissions and project checks remain required. No alternative permission, manager version or installation mode is selected automatically. Some toolchains may fail with compatibility disabled; retained candidates remain inspectable.

After reveal, **Check evidence and usage** shows configured mode separately from observed hooks. These are process-reported diagnostics, not proof of confinement. **None observed** does not establish that a hook could never execute. Blind responses withhold these implementation fingerprints. Older records without the field do not acquire inferred evidence.

If a conflict is suspected, retain the current result and change the setting before a new comparison. Reverification and adoption keep the admitted conditions.

This control does not resolve pnpm 12's Windows system operation-lock requirement or establish TypeScript 7 support for Yarn PnP. See the [distribution and compatibility notes](distribution.en.md).
