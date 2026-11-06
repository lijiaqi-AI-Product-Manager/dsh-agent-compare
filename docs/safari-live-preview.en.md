# Safari live comparison

[简体中文](safari-live-preview.md)

For local DSH Web and Safari on macOS. Desktop continues to use its own browser environment. Remote servers, shared backends, authentication and databases are outside the current front-end comparison scope.

## First use

1. Select A|B in the conversation, expand settings and select **Enable Safari live comparison**. Your draft and existing records are retained; no application generation starts.
2. Review the explanation and select **Continue and request system authorization**. Administrator verification occurs in the macOS system dialog. The plugin neither reads nor stores passwords. You can cancel.
3. Once ready, explicitly send your task or start the built-in example. Both applications run at separate addresses and remain interactive. Use the open button at the top right of a candidate to continue in an actual tab when first-party cookies or storage are needed.

Safari may restrict cookies in embedded pages. A direct tab can also have a different storage context from an embedded page. The comparison page explains this distinction; browser-blocked storage writes are never reported as passing.

## System changes

Each setup adds a batch of 64 random, dedicated IPv4 loopback addresses for local previews. The system releases them on reboot. Once exhausted or after reboot, the interface asks for another explicit setup. DNS, certificates, firewall rules, startup items and existing addresses remain unchanged.

The private address journal is written before system changes. Assignment requires both a command receipt and an observed system address. Partial setup, cancellation or lost receipts retain unconfirmed entries without assuming ownership. Used addresses are never assigned to another preview, including a reopened candidate, so a new preview does not inherit an earlier application's state.

## History and recovery

Safari does not embed an old localhost preview. After setup, select **Open A/B at a dedicated address** to run the retained candidate without generating again. Its source must still match the sealed version. The previous process is stopped only when its ownership can be proved; the peer remains running. Reopening changes the browser address and does not preserve temporary in-page state. Tasks, choices, checks, patches and screenshots remain available.

Canceling system authorization does not start comparison or automatically repeat the prompt. Recheck the environment and explicitly retry. Damaged journals or uncertain process ownership retain their original data instead of resetting records or expanding permissions.

## Acceptance evidence

[CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml) checks current native Safari, Playwright WebKit and the actual DSH SDK separately. Native Safari records the application's version rather than treating a WebKit engine version as the browser version. Checks cover independent input, language changes without document reloads, first-party cookie/storage separation, parent-cookie boundaries, exact-address binding, restart ownership and cleanup.

System-address tests use the explicit administrator grant of a disposable macOS runner. They do not automate a maintainer's authorization dialog. Fixed applications and controlled runtime checks do not establish external-model generation quality or timing.
