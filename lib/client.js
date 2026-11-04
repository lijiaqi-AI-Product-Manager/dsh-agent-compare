window.__ModuleLoader__.load({
  id: "dsh-agent-compare",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);

// src/client/tool-result.ts
function runIdFromToolResult(block, phase) {
  if (phase !== "result" || !block || typeof block !== "object") return void 0;
  const result = block;
  if (result.isError === true || !Array.isArray(result.content)) return void 0;
  for (const item of result.content) {
    if (item?.type !== "text" || typeof item.text !== "string") continue;
    try {
      const value = JSON.parse(item.text);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const id = value.runId;
        if (typeof id === "string" && /^[0-9a-f]{8}$/.test(id)) return id;
      }
    } catch {
    }
  }
  return void 0;
}

// src/client/capabilities.ts
function clientCapabilities(shell, scope, commands) {
  const input = shell;
  const context = scope;
  const executor = commands;
  const missing = [];
  if (typeof input?.beginCommand !== "function") missing.push("input.beginCommand");
  if (typeof input?.state?.subscribe !== "function") missing.push("input.state.subscribe");
  if (typeof context?.bail !== "function") missing.push("session.bail");
  const canExecute = typeof executor?.execute === "function";
  if (!canExecute) missing.push("commands.execute");
  try {
    const state = typeof input?.state?.getSnapshot === "function" ? input.state.getSnapshot() : void 0;
    if (!state || typeof state.draft !== "string" || !Number.isSafeInteger(state.draftRev) || typeof state.phase !== "string") missing.push("input.state.getSnapshot");
  } catch {
    missing.push("input.state.getSnapshot");
  }
  return { ok: missing.length === 0, canExecute, missing };
}

// src/client/index.tsx
var name = "agent-compare-client";
var inject = ["slots", "remote", "remote.commands"];
async function call(method, body, signal) {
  const url = new URL(`agent-compare/api/${method}`, document.baseURI.replace(/[?#].*$/, "").replace(/[^/]*$/, ""));
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), ...signal ? { signal } : {} });
  const env = await res.json();
  if (!env.ok) throw new Error(env.error ?? `HTTP ${res.status}`);
  return env.value;
}
var openSession;
var focusComposerOnClose;
var listeners = /* @__PURE__ */ new Set();
function setOpen(sessionId, runId, tab) {
  openSession = sessionId === void 0 ? void 0 : { sessionId, ...runId ? { runId } : {}, ...tab ? { tab } : {} };
  for (const l of listeners) l();
}
function useOpen() {
  const [, force] = (0, import_react.useState)(0);
  (0, import_react.useEffect)(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return openSession;
}
var clientCtx;
function sessionScope(sessionId) {
  try {
    const sessions = clientCtx?.get?.("sessions");
    return typeof sessions?.scope === "function" ? sessions.scope(sessionId) : void 0;
  } catch {
    return void 0;
  }
}
function inputShell(sessionId) {
  try {
    const actx = sessionScope(sessionId);
    const conversation = actx?.get?.("conversation");
    return conversation?.input?.for?.(actx);
  } catch {
    return void 0;
  }
}
function inputSnapshot(sessionId) {
  try {
    return inputShell(sessionId)?.state?.getSnapshot?.();
  } catch {
    return void 0;
  }
}
function clientSupport(sessionId) {
  return clientCapabilities(inputShell(sessionId), sessionScope(sessionId), clientCtx?.remote?.commands);
}
function clientSupportMessage(sessionId) {
  const support = clientSupport(sessionId);
  return support.ok ? void 0 : "\u5F53\u524D DSH \u8F93\u5165\u63A5\u53E3\u4E0D\u517C\u5BB9\uFF1A" + support.missing.join("\u3001") + "\u3002\u8BF7\u5347\u7EA7\u6216\u56DE\u9000\u81F3\u5DF2\u9A8C\u8BC1\u7684 DSH \u7248\u672C\uFF1B\u8349\u7A3F\u548C\u6BD4\u8F83\u8BB0\u5F55\u4FDD\u7559\u3002";
}
function returnToComposer(sessionId) {
  if (openSession) {
    focusComposerOnClose = sessionId;
    setOpen(void 0);
  } else inputShell(sessionId)?.focus?.();
}
var modes = /* @__PURE__ */ new Map();
var registeredShells = /* @__PURE__ */ new WeakSet();
function modeFor(sessionId) {
  let mode = modes.get(sessionId);
  if (!mode) {
    mode = { preferences: { enabled: false, mode: "same-model", generationMinutes: 30, models: [{}, {}] }, loaded: false, loading: false, collapsed: false, saving: 0, pending: Promise.resolve(), listeners: /* @__PURE__ */ new Set() };
    modes.set(sessionId, mode);
  }
  return mode;
}
function publishMode(mode) {
  for (const update of mode.listeners) update();
}
async function loadMode(sessionId) {
  const mode = modeFor(sessionId);
  if (mode.loading) return;
  mode.loading = true;
  delete mode.error;
  publishMode(mode);
  try {
    mode.preferences = await call("preferences", { sessionId });
    mode.loaded = true;
  } catch (e) {
    mode.error = e.message;
  } finally {
    mode.loading = false;
    publishMode(mode);
  }
}
function saveMode(sessionId, next) {
  const mode = modeFor(sessionId);
  mode.preferences = next;
  mode.saving++;
  delete mode.error;
  publishMode(mode);
  mode.pending = mode.pending.catch(() => {
  }).then(async () => {
    await call("preferences", { sessionId, value: next });
  }).catch((e) => {
    mode.error = `\u8BBE\u7F6E\u672A\u4FDD\u5B58\uFF1A${e.message}`;
    throw e;
  }).finally(() => {
    mode.saving--;
    publishMode(mode);
  });
  void mode.pending.catch(() => {
  });
}
function useAbMode(sessionId) {
  const [, force] = (0, import_react.useState)(0);
  const mode = modeFor(sessionId);
  (0, import_react.useEffect)(() => {
    const update = () => force((n) => n + 1);
    mode.listeners.add(update);
    const state = inputShell(sessionId)?.state;
    const unsubscribe = typeof state?.subscribe === "function" ? state.subscribe(update) : void 0;
    if (!mode.loaded && !mode.loading) void loadMode(sessionId);
    return () => {
      mode.listeners.delete(update);
      unsubscribe?.();
    };
  }, [mode, sessionId]);
  return mode;
}
async function executeComparison(sessionId, task, example = false) {
  const mode = modeFor(sessionId);
  const preferences = mode.preferences;
  if (!mode.loaded) return { kind: "error", text: "\u6BD4\u8F83\u8BBE\u7F6E\u5C1A\u672A\u8BFB\u53D6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
  await mode.pending;
  const support = clientSupport(sessionId);
  if (!support.canExecute || !example && !support.ok) return { kind: "error", text: clientSupportMessage(sessionId) ?? "\u4F1A\u8BDD\u547D\u4EE4\u6267\u884C\u63A5\u53E3\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5 DSH \u7248\u672C\u3002" };
  const setup = await call("setup", { sessionId });
  if (setup.capabilities?.ok === false) return { kind: "error", text: "\u5F53\u524D DSH " + (setup.dshVersion ?? "\uFF08\u7248\u672C\u672A\u77E5\uFF09") + " \u7F3A\u5C11\u6BD4\u8F83\u6240\u9700\u63A5\u53E3\uFF1A" + setup.capabilities.missing.join("\u3001") + "\u3002\u8BF7\u5347\u7EA7\u6216\u56DE\u9000\u81F3\u5DF2\u9A8C\u8BC1\u7684\u7248\u672C\uFF1B\u8349\u7A3F\u4FDD\u7559\u3002" };
  if (!example && setup.project?.supported === false) return { kind: "error", text: "\u5F53\u524D\u9879\u76EE\u4E0D\u53D7\u652F\u6301\uFF1A" + (setup.project.reason ?? "\u8BF7\u4F7F\u7528\u4ED3\u5E93\u6839\u76EE\u5F55\u7684 Vite \u9879\u76EE\u3002") + " \u8349\u7A3F\u4FDD\u7559\uFF0C\u4E5F\u53EF\u4EE5\u8BD5\u8DD1\u5185\u7F6E\u793A\u4F8B\u3002" };
  const remote = clientCtx?.remote?.commands;
  if (!remote) throw new Error("\u4F1A\u8BDD\u547D\u4EE4\u6267\u884C\u5668\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u5BF9\u8BDD");
  const result = await remote.execute(sessionId, `/ab @ui ${JSON.stringify({ version: 1, task, example, preferences })}`, []);
  if (!result.ok) throw new Error(result.error?.message ?? "\u6BD4\u8F83\u672A\u80FD\u8FDB\u5165\u4F1A\u8BDD");
  if (!result.value) throw new Error("\u6BD4\u8F83\u547D\u4EE4\u672A\u6CE8\u518C\uFF0C\u8BF7\u68C0\u67E5\u63D2\u4EF6\u662F\u5426\u5DF2\u52A0\u8F7D");
  const outcome = result.value.result;
  const args = ["command/executed", sessionId, "ab", outcome];
  try {
    if (typeof clientCtx?.events?.dispatch === "function") for (const listener of clientCtx.events.dispatch("emit", args)) {
      try {
        const returned = listener(sessionId, "ab", outcome);
        if (returned && typeof returned.then === "function") void Promise.resolve(returned).catch(() => {
        });
      } catch {
      }
    }
  } catch {
  }
  if (outcome.kind === "success") {
    mode.runId = /运行 ([0-9a-f]{8})/.exec(outcome.text ?? "")?.[1];
    mode.collapsed = true;
    publishMode(mode);
    return { kind: "success" };
  }
  return outcome;
}
function enterMode(sessionId) {
  const shell = inputShell(sessionId), state = inputSnapshot(sessionId);
  if (typeof shell?.beginCommand !== "function" || !state || !["plain", "claimed"].includes(state.phase) || state.claim && state.claim.name !== "ab") return false;
  const applied = shell.beginCommand({ name: "ab", token: "/ab ", hint: "\u53EA\u9700\u5199\u9700\u6C42\uFF1B\u6A21\u578B\u4E0E\u65F6\u957F\u5728\u4E0A\u65B9\u9009\u62E9", submit: (task) => executeComparison(sessionId, task) }, { start: 0, end: state.claim?.name === "ab" ? 1 : 0, draftRev: state.draftRev });
  if (applied) registeredShells.add(shell);
  return applied;
}
function leaveMode(sessionId) {
  const scope = sessionScope(sessionId), state = inputSnapshot(sessionId);
  if (!state || !["plain", "claimed"].includes(state.phase)) return false;
  if (state.claim?.name !== "ab") return true;
  return scope?.bail?.(scope, "slash/input-consume-token", { guard: { kind: "span", span: { start: 0, end: 1, draftRev: state.draftRev } } }) === true;
}
function useTick(on) {
  const [, set] = (0, import_react.useState)(0);
  (0, import_react.useEffect)(() => {
    if (!on) return;
    const t = setInterval(() => set((n) => n + 1), 1e3);
    return () => clearInterval(t);
  }, [on]);
}
var PIPELINE = [
  { stage: "preparing", label: "\u9694\u79BB\u526F\u672C" },
  { stage: "generating", label: "Agent \u5B9E\u73B0" },
  { stage: "sealing", label: "\u5C01\u5B58\u6539\u52A8" },
  { stage: "installing", label: "\u51BB\u7ED3\u5B89\u88C5" },
  { stage: "verifying", label: "\u68C0\u67E5\u4E0E\u6784\u5EFA" },
  { stage: "previewing", label: "\u8FD0\u884C\u6784\u5EFA\u4EA7\u7269" }
];
var STAGE_TEXT = {
  queued: "\u6392\u961F\u4E2D",
  preparing: "\u51C6\u5907\u9694\u79BB\u526F\u672C",
  generating: "Agent \u6B63\u5728\u5B9E\u73B0",
  sealing: "\u5C01\u5B58\u6539\u52A8",
  installing: "\u5B89\u88C5\u4F9D\u8D56",
  verifying: "\u68C0\u67E5\u4E0E\u6784\u5EFA",
  previewing: "\u542F\u52A8\u5E76\u9A8C\u6536\u9875\u9762",
  ready: "\u53EF\u4EE5\u4F53\u9A8C",
  failed: "\u5931\u8D25",
  stopping: "\u6B63\u5728\u505C\u6B62",
  cancelled: "\u5DF2\u505C\u6B62",
  interrupted: "\u5DF2\u4E2D\u65AD"
};
var CHECK_TEXT = { typecheck: "\u7C7B\u578B\u68C0\u67E5", lint: "Lint", build: "\u6784\u5EFA", test: "\u6D4B\u8BD5", browser: "\u9875\u9762\u9A8C\u6536" };
var ERROR_STAGE = { preparing: "\u51C6\u5907\u526F\u672C", generating: "\u5B9E\u73B0", sealing: "\u5C01\u5B58\u6539\u52A8", installing: "\u5B89\u88C5\u4F9D\u8D56", verifying: "\u68C0\u67E5\u4E0E\u6784\u5EFA", previewing: "\u542F\u52A8\u4E0E\u9A8C\u6536\u9875\u9762" };
var STATE_TEXT = {
  running: "\u8FDB\u884C\u4E2D",
  judging: "\u5F85\u9009\u62E9",
  revealed: "\u5DF2\u63ED\u6653",
  adopting: "\u91C7\u7528\u4E2D",
  adopted: "\u5DF2\u91C7\u7528",
  recovery: "\u9700\u8981\u5904\u7406",
  abandoned: "\u5DF2\u7ED3\u675F",
  interrupted: "\u5DF2\u4E2D\u65AD"
};
var ACTIVE = /* @__PURE__ */ new Set(["running", "judging", "revealed", "adopting", "recovery"]);
var LIVE_POLL = /* @__PURE__ */ new Set(["running", "adopting"]);
var REVEALED = /* @__PURE__ */ new Set(["revealed", "adopting", "adopted", "recovery"]);
function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1e3));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}
function elapsed(c) {
  if (c.verificationHistory?.length) return Object.entries(c.timings).filter(([stage]) => ["installing", "verifying", "previewing"].includes(stage)).reduce((sum, [, timing]) => sum + (timing ? Math.max(0, (timing.endedAt ?? (busyStage(c.stage) ? Date.now() : timing.startedAt)) - timing.startedAt) : 0), 0);
  const timings = Object.entries(c.timings).filter(([s]) => s !== "ready");
  const starts = timings.map(([, t]) => t?.startedAt ?? Infinity);
  const ends = timings.map(([, t]) => t?.endedAt ?? (busyStage(c.stage) ? Date.now() : t?.startedAt ?? 0));
  const first = Math.min(...starts);
  return Number.isFinite(first) ? Math.max(...ends) - first : 0;
}
function busyStage(s) {
  return !["ready", "failed", "cancelled", "interrupted", "queued"].includes(s);
}
function routeText(r) {
  return r?.model ? `${r.model}${r.provider ? ` \xB7 ${r.provider}` : ""}` : "";
}
function when(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
var CSS = `
.ac-root{--ac-bg:var(--dsw-alias-bg-base,#fff);--ac-l1:var(--dsw-alias-bg-layer-1,#f7f8fa);--ac-l2:var(--dsw-alias-bg-layer-2,#f0f2f5);
--ac-fg:var(--dsw-alias-label-primary,#0f1115);--ac-fg2:var(--dsw-alias-label-secondary,#4b5260);--ac-fg3:var(--dsw-alias-label-secondary,#596475);
--ac-border:var(--dsw-alias-border-l2,rgba(15,17,21,.10));--ac-border-strong:var(--dsw-alias-border-l3,rgba(15,17,21,.16));
--ac-brand:var(--dsw-alias-brand-primary,#4056d9);--ac-brand-fg:var(--dsw-alias-label-primary-foreground,#fff);
--ac-ok:var(--dsw-alias-state-success-primary,#157847);--ac-err:var(--dsw-alias-state-error-primary,#a91e2e);--ac-warn:var(--dsw-alias-state-warn-primary,#926200);
--ac-hover:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05));
--ac-r-sm:var(--dsw-radius-sm,8px);--ac-r-md:var(--dsw-radius-md,10px);--ac-r-lg:var(--dsw-radius-lg,14px);
font-family:var(--dsw-font-family,inherit);color:var(--ac-fg);font-size:13px;line-height:1.5}
.ac-root *{box-sizing:border-box}
.ac-mask{position:fixed;inset:0;z-index:1000;background:var(--dsw-alias-bg-mask-1,rgba(15,17,21,.28));animation:ac-fade .15s ease-out}
.ac-sheet{position:fixed;z-index:1001;top:max(52px,calc(env(titlebar-area-height,0px) + 12px));left:16px;right:16px;bottom:16px;
background:var(--ac-bg);border:1px solid var(--ac-border);border-radius:var(--dsw-radius-panel,16px);box-shadow:var(--dsw-shadow-lv3,0 24px 64px rgba(15,17,21,.18));
display:flex;flex-direction:column;overflow:hidden;animation:ac-rise .18s ease-out}
@keyframes ac-fade{from{opacity:0}}@keyframes ac-rise{from{opacity:0;transform:translateY(8px)}}
@keyframes ac-spin{to{transform:rotate(360deg)}}@keyframes ac-pulse{50%{opacity:.45}}
.ac-head{display:flex;align-items:center;gap:12px;padding:12px 16px 12px 20px;border-bottom:1px solid var(--ac-border)}
.ac-logo{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 7px;border-radius:7px;background:var(--ac-brand);color:var(--ac-brand-fg);font-weight:700;font-size:12px;letter-spacing:.02em}
.ac-title{font-weight:600;font-size:14px}
.ac-task{flex:1;min-width:0;color:var(--ac-fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-spacer{flex:1}
.ac-tabs{display:flex;gap:2px;padding:2px;border-radius:9px;background:var(--ac-l2)}
.ac-tab{border:none;background:transparent;color:var(--ac-fg2);font:inherit;font-size:12px;font-weight:500;height:26px;padding:0 10px;border-radius:7px;cursor:pointer}
.ac-tab.on{background:var(--ac-bg);color:var(--ac-fg);box-shadow:0 1px 2px rgba(15,17,21,.08)}
.ac-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--ac-r-sm);border:none;background:transparent;color:var(--ac-fg2);cursor:pointer}
.ac-icon-btn:hover{background:var(--ac-hover);color:var(--ac-fg)}
.ac-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:var(--ac-r-sm);border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);font:inherit;font-weight:500;cursor:pointer;white-space:nowrap}
.ac-btn:hover:not(:disabled){background:var(--ac-hover)}
.ac-btn:disabled{opacity:.5;cursor:default}
.ac-btn.primary{background:var(--dsw-alias-button-primary-fill,var(--ac-brand));border-color:transparent;color:var(--ac-brand-fg)}
.ac-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--ac-brand));filter:brightness(1.06)}
.ac-btn.lg{height:38px;padding:0 18px;font-size:14px}
.ac-btn.sm{height:26px;padding:0 10px;font-size:12px}
.ac-btn.danger{color:var(--ac-err)}
.ac-btn:focus-visible,.ac-icon-btn:focus-visible,.ac-chip:focus-visible,.ac-tab:focus-visible,.ac-seg button:focus-visible{outline:2px solid var(--ac-brand);outline-offset:2px}
.ac-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.ac-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;background:var(--ac-l2);color:var(--ac-fg2);white-space:nowrap}
.ac-pill.ok{background:color-mix(in srgb,var(--ac-ok) 14%,transparent);color:var(--ac-ok)}
.ac-pill.err{background:color-mix(in srgb,var(--ac-err) 12%,transparent);color:var(--ac-err)}
.ac-pill.warn{background:color-mix(in srgb,var(--ac-warn) 14%,transparent);color:var(--ac-warn)}
.ac-pill.ok,.ac-pill.err,.ac-pill.warn{color:var(--ac-fg)}
.ac-pill.ok .ac-dot{background:var(--ac-ok)}.ac-pill.err .ac-dot{background:var(--ac-err)}.ac-pill.warn .ac-dot{background:var(--ac-warn)}
.ac-pill.brand{background:color-mix(in srgb,var(--ac-brand) 12%,transparent);color:var(--ac-brand)}
.ac-spin{width:11px;height:11px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:ac-spin .8s linear infinite}
.ac-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
/* start */
.ac-start{max-width:780px;margin:auto;width:100%;padding:36px 24px 32px;display:flex;flex-direction:column;gap:20px}
.ac-h1{font-size:22px;font-weight:650;letter-spacing:-.01em;margin:0}
.ac-lead{color:var(--ac-fg2);margin:6px 0 0;font-size:14px}
.ac-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:var(--ac-l2);align-self:flex-start}
.ac-seg button{border:none;background:transparent;color:var(--ac-fg2);font:inherit;font-weight:500;height:30px;padding:0 14px;border-radius:8px;cursor:pointer}
.ac-seg button.on{background:var(--ac-bg);color:var(--ac-fg);box-shadow:0 1px 2px rgba(15,17,21,.08)}
.ac-models{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ac-models label{display:flex;flex-direction:column;gap:4px;color:var(--ac-fg3);font-size:12px}
.ac-models select{height:34px;border-radius:var(--ac-r-sm);border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);font:inherit;padding:0 8px}
.ac-field{border:1px solid var(--ac-border-strong);border-radius:var(--ac-r-lg);background:var(--ac-bg);transition:border-color .12s,box-shadow .12s}
.ac-field:focus-within{border-color:var(--ac-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-brand) 16%,transparent)}
.ac-field textarea{display:block;width:100%;min-height:104px;resize:vertical;border:none;outline:none;background:transparent;color:var(--ac-fg);font:inherit;font-size:14px;padding:14px 16px 6px}
.ac-field textarea::placeholder{color:var(--ac-fg3)}
.ac-field-foot{display:flex;align-items:center;gap:8px;padding:8px 10px 10px 16px}
.ac-chips{flex:1;min-width:0;display:flex;gap:6px;flex-wrap:wrap}
.ac-chip{border:1px solid var(--ac-border);background:var(--ac-l1);color:var(--ac-fg2);border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}
.ac-chip:hover{color:var(--ac-fg);background:var(--ac-hover)}
.ac-case{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:var(--ac-r-lg);border:1px dashed var(--ac-border-strong);background:var(--ac-l1)}
.ac-case div{flex:1;min-width:0}
.ac-case b{display:block;font-size:13px}
.ac-case span{color:var(--ac-fg3);font-size:12px}
.ac-note{color:var(--ac-fg3);font-size:12px;display:flex;gap:14px;flex-wrap:wrap}
.ac-kbd{font-size:11px;color:var(--ac-fg3);margin-right:4px}
.ac-error{margin:0 16px;padding:8px 12px;border-radius:var(--ac-r-sm);background:color-mix(in srgb,var(--ac-err) 10%,transparent);color:var(--ac-err);white-space:pre-wrap}
/* compare */
.ac-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;min-height:540px}
.ac-card{display:flex;flex-direction:column;min-height:0;border:1px solid var(--ac-border);border-radius:var(--ac-r-lg);background:var(--ac-bg);overflow:hidden;transition:box-shadow .15s,border-color .15s}
.ac-card.picked{border-color:var(--ac-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-brand) 16%,transparent)}
.ac-card-head{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-bottom:1px solid var(--ac-border)}
.ac-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.ac-label{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--ac-fg);color:var(--ac-bg);font-weight:700;font-size:14px}
.ac-meta{color:var(--ac-fg3);font-size:12px}
.ac-track{display:flex;gap:4px}
.ac-track i{flex:1;height:4px;border-radius:2px;background:var(--ac-l2)}
.ac-track i.done{background:var(--ac-ok)}
.ac-track i.now{background:var(--ac-brand);animation:ac-pulse 1.2s ease-in-out infinite}
.ac-track i.bad{background:var(--ac-err)}
.ac-checks{display:flex;flex-wrap:wrap;gap:6px}
.ac-check{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:6px;font-size:12px;background:var(--ac-l1);color:var(--ac-fg2);border:1px solid var(--ac-border)}
.ac-check.passed{color:var(--ac-ok)}.ac-check.failed,.ac-check.timeout{color:var(--ac-err)}.ac-check.skipped{color:var(--ac-fg3)}
.ac-verdict{font-size:12px;padding:6px 10px;border-radius:var(--ac-r-sm)}
.ac-verdict.ok{background:color-mix(in srgb,var(--ac-ok) 9%,transparent);color:var(--ac-ok)}
.ac-verdict.bad{background:color-mix(in srgb,var(--ac-err) 8%,transparent);color:var(--ac-err)}
.ac-verdict small{display:block;color:var(--ac-fg3)}
.ac-steps-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:2px;font-size:12px}
.ac-steps-list li.ok{color:var(--ac-fg2)}.ac-steps-list li.bad{color:var(--ac-err)}
.ac-details summary{cursor:pointer;color:var(--ac-fg3);font-size:12px}
.ac-strategy{margin-left:auto;font-weight:600;font-size:12px}
.ac-summary{color:var(--ac-fg2);font-size:12px;white-space:pre-wrap;max-height:84px;overflow:auto}
.ac-browser{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--ac-l1)}
.ac-chrome{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-bottom:1px solid var(--ac-border);background:var(--ac-l1)}
.ac-lights{display:flex;gap:5px}.ac-lights i{width:9px;height:9px;border-radius:50%;background:var(--ac-border-strong)}
.ac-url{flex:1;min-width:0;height:24px;display:flex;align-items:center;padding:0 10px;border-radius:6px;background:var(--ac-bg);color:var(--ac-fg3);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ac-frame{flex:1;width:100%;min-height:0;border:none;background:#fff}
.ac-shot{flex:1;min-height:0;min-width:0;overflow:auto;padding:12px;background:var(--ac-l1)}
.ac-shot img{display:block;width:100%;max-width:1280px;height:auto;margin:0 auto;border-radius:8px;border:1px solid var(--ac-border);box-sizing:border-box}
.ac-shot img.m{max-width:390px}
.ac-shot.natural img{width:auto;max-width:none;margin:0}
.ac-shot:focus-visible{outline:2px solid var(--ac-brand);outline-offset:-3px}
.ac-shottools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--ac-border);color:var(--ac-fg2);font-size:12px}
.ac-shottools span{flex:1}
.ac-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--ac-fg3);padding:24px;text-align:center}
.ac-skel{width:min(320px,70%);display:flex;flex-direction:column;gap:8px}.ac-skel i{height:10px;border-radius:5px;background:var(--ac-l2);animation:ac-pulse 1.4s ease-in-out infinite}
.ac-fail{flex:1;margin:12px;padding:12px;border-radius:var(--ac-r-md);background:color-mix(in srgb,var(--ac-err) 7%,transparent);color:var(--ac-fg);overflow:auto;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;white-space:pre-wrap}
.ac-fail b{display:block;color:var(--ac-err);font-family:var(--dsw-font-family,inherit);margin-bottom:6px}
.ac-fail.interrupted{background:color-mix(in srgb,var(--ac-warn) 8%,transparent)}
.ac-fail.interrupted b{color:var(--ac-warn)}
.ac-install-log{max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.ac-salvage{display:flex;align-items:center;gap:12px;margin-top:14px;padding:10px 12px;border-radius:var(--ac-r-sm);background:var(--ac-bg);border:1px solid var(--ac-border);font-family:var(--dsw-font-family,inherit);white-space:normal;color:var(--ac-fg2)}
.ac-salvage span{flex:1}
.ac-activity code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px;color:var(--ac-fg2)}
.ac-slow{color:var(--ac-warn)}
.ac-budget{display:inline-flex;align-items:center;gap:6px;color:var(--ac-fg3);font-size:12px;white-space:nowrap}
.ac-budget select{height:28px;border-radius:7px;border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);font:inherit;font-size:12px}
.ac-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--ac-border);background:var(--ac-bg);flex-wrap:wrap}
.ac-bar-text{flex:1;min-width:200px;color:var(--ac-fg2)}
.ac-bar-text strong{color:var(--ac-fg)}
.ac-banner{flex:none;margin:16px 16px 0;padding:12px 14px;border-radius:var(--ac-r-md);background:var(--ac-l1);border:1px solid var(--ac-border);display:flex;flex-direction:column;gap:6px}
.ac-banner.warn{background:color-mix(in srgb,var(--ac-warn) 10%,transparent);border-color:color-mix(in srgb,var(--ac-warn) 30%,transparent)}
.ac-banner.err{background:color-mix(in srgb,var(--ac-err) 8%,transparent);border-color:color-mix(in srgb,var(--ac-err) 25%,transparent)}
.ac-banner code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px}
.ac-banner .disclaimer{color:var(--ac-fg3);font-size:12px}
.ac-next{flex:none;margin:16px;padding:16px;border-radius:var(--ac-r-lg);border:1px solid var(--ac-border);display:flex;flex-direction:column;gap:10px}
.ac-next b{font-size:14px}
.ac-link{color:var(--dsw-alias-link,var(--ac-brand));text-decoration:underline;text-underline-offset:2px}
.ac-history{max-width:860px;width:100%;margin:0 auto;padding:20px 24px;display:flex;flex-direction:column;gap:8px}
.ac-hrow{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--ac-r-md);border:1px solid var(--ac-border);background:var(--ac-bg);text-align:left;font:inherit;color:inherit;cursor:pointer}
.ac-hrow:hover{background:var(--ac-hover)}
.ac-hrow.legacy,.ac-hrow.legacy:hover{cursor:default;background:var(--ac-l1)}
.ac-hrow.ac-hrow-unavailable{border-color:var(--ac-warn)}.ac-history-issue-filter{display:flex;align-items:center;gap:8px;color:var(--ac-fg2);font-size:12px}.ac-history-issue-filter input{width:16px;height:16px;accent-color:var(--ac-brand)}.ac-history-problem{font-size:12px;line-height:1.6;color:var(--ac-fg2);overflow-wrap:anywhere}
.ac-hrow span.t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-history-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--ac-border)}
.ac-history-controls label{display:flex;flex-direction:column;gap:6px;color:var(--ac-fg2);font-size:12px}.ac-history-controls select,.ac-history-controls input{height:36px;box-sizing:border-box;border:1px solid var(--ac-border-strong);border-radius:8px;background:var(--ac-bg);color:var(--ac-fg);font:inherit;padding:0 10px;min-width:0}
.ac-history-search{display:flex;align-items:end;gap:8px;flex:1;min-width:200px}.ac-history-search label{flex:1;min-width:0}.ac-history-search input{width:100%}.ac-history-status,.ac-history-pages{display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--ac-fg2);font-size:12px}.ac-history-status{min-height:24px}.ac-history-pages{justify-content:space-between;padding-top:12px;border-top:1px solid var(--ac-border)}.ac-hrow-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}.ac-hrow-copy .ac-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-history .ac-empty{height:auto;min-height:180px;padding:24px;text-align:center}
@media(max-width:600px){.ac-history{padding:16px 12px}.ac-history-controls>label,.ac-history-search{width:100%}.ac-history-search{min-width:0;flex-basis:100%}.ac-hrow{padding:12px;gap:8px;flex-wrap:wrap}.ac-hrow>.ac-meta{margin-left:auto}.ac-history-pages>.ac-row{width:100%;justify-content:space-between}}
.ac-header-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 7px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));background:transparent;color:var(--dsw-alias-label-secondary,#4b5260);font:600 11px/1 var(--dsw-font-family,inherit);letter-spacing:.03em;cursor:pointer}
.ac-header-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05));color:var(--dsw-alias-label-primary,#0f1115)}
.ac-header-tools{display:flex;align-items:center;gap:6px;-webkit-app-region:no-drag}.ac-header-tools-hero{position:fixed;top:var(--ac-header-top,max(6px,env(titlebar-area-height,0px)));right:var(--ac-header-right,56px);z-index:20;max-width:calc(100vw - 80px)}
@media (max-width:900px){.ac-grid{grid-template-columns:1fr;height:auto}.ac-card{min-height:460px}.ac-models{grid-template-columns:1fr}}
/* in the conversation */
.ac-inline{margin:4px 0 8px;border:1px solid var(--ac-border);border-radius:var(--ac-r-lg);background:var(--ac-bg);overflow:hidden}
.ac-inline-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--ac-border);background:var(--ac-l1)}
.ac-inline-head .ac-task{font-size:13px}
.ac-inline .ac-grid{min-height:0;padding:12px;gap:12px}
.ac-inline .ac-card{min-height:0}
.ac-inline .ac-browser,.ac-inline .ac-shotwrap,.ac-inline .ac-fail,.ac-inline .ac-empty{height:300px;flex:none}
.ac-inline .ac-banner{margin:12px 12px 0}
.ac-inline .ac-bar{padding:10px 12px}
.ac-inline-note{padding:10px 14px;color:var(--ac-fg2)}
.ac-shotwrap{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--ac-l1)}
.ac-shotbar{display:flex;align-items:center;gap:10px;padding:8px 12px;color:var(--ac-fg3);font-size:12px;border-bottom:1px solid var(--ac-border)}
.ac-shotbar span{flex:1}
.ac-mode-btn{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));background:transparent;color:var(--dsw-alias-label-secondary,#4b5260);font:600 12px/1 var(--dsw-font-family,inherit);letter-spacing:.03em;cursor:pointer}
.ac-mode-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05))}
.ac-mode-btn.on{background:var(--dsw-alias-brand-primary,#4d6bfe);border-color:transparent;color:#fff}
.ac-guide{max-width:820px;width:100%;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:18px}
.ac-guide h3{margin:0;font-size:15px}
.ac-guide ol,.ac-guide ul{margin:6px 0 0;padding-left:20px;color:var(--ac-fg2);display:flex;flex-direction:column;gap:4px}
.ac-guide code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;background:var(--ac-l2);padding:1px 5px;border-radius:5px}
.ac-back{margin:12px 16px 0;align-self:flex-start}
/* Workspace layout */
.ac-sheet{top:max(48px,calc(env(titlebar-area-height,0px) + 8px));left:12px;right:12px;bottom:12px;outline:none}
.ac-head{min-height:64px;padding:14px 24px;gap:12px}
.ac-logo{height:30px;padding:0 9px;border-radius:9px;background:var(--ac-fg);color:var(--ac-bg)}
.ac-header-caption{color:var(--ac-fg3);font-size:12px;border-left:1px solid var(--ac-border);padding-left:12px}
.ac-tabs{background:transparent;gap:4px}.ac-tab{height:34px;padding:0 14px;font-size:13px}.ac-tab.on{background:var(--ac-l2);box-shadow:none;color:var(--ac-fg)}
.ac-root button,.ac-root select,.ac-root textarea{font-family:inherit}
.ac-root :is(input,select,textarea,a,summary):focus-visible{outline:2px solid var(--ac-brand);outline-offset:3px}
.ac-sr{position:absolute!important;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ac-start{max-width:920px;margin:0 auto;padding:30px 36px 0;gap:22px}
.ac-eyebrow{display:block;color:var(--ac-fg3);font-size:12px;letter-spacing:.08em;margin-bottom:8px}
.ac-h1{font-size:30px;font-weight:650;letter-spacing:-.03em;line-height:1.35}.ac-lead{font-size:13px;margin-top:8px;line-height:1.7}
.ac-form-group{border:0;padding:0;margin:0;min-width:0;display:flex;flex-direction:column;gap:10px}
.ac-form-group legend{float:left;display:flex;align-items:center;gap:8px;width:100%;font-size:13px;font-weight:600;padding:0;margin-bottom:10px}
.ac-step-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:var(--ac-l2);color:var(--ac-fg2);border-radius:7px;font-size:11px}
.ac-options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;clear:both}
.ac-option{display:flex;align-items:flex-start;gap:10px;padding:13px 14px;border:1px solid var(--ac-border-strong);border-radius:12px;cursor:pointer;background:var(--ac-bg);min-width:0;transition:border-color .15s,background .15s}
.ac-option.selected{border-color:var(--ac-brand);background:color-mix(in srgb,var(--ac-brand) 4%,var(--ac-bg))}
.ac-option input{accent-color:var(--ac-brand);margin:3px 0 0;flex:none}
.ac-option>span{min-width:0;display:flex;flex-direction:column;gap:4px}.ac-option b{font-size:13px;font-weight:600}.ac-option small{font-size:12px;color:var(--ac-fg2);overflow-wrap:anywhere;line-height:1.5}
.ac-option em{font-style:normal;margin-left:5px;font-size:10px;font-weight:500;background:var(--ac-l2);color:var(--ac-fg2);padding:2px 5px;border-radius:4px}
.ac-field textarea{min-height:94px;padding:13px 15px 4px;line-height:1.65;font-size:14px}.ac-field-foot{padding:4px 12px 10px;gap:8px}
.ac-field textarea:focus-visible{outline:none}
.ac-field-note{margin:0;font-size:12px;color:var(--ac-fg2);line-height:1.6}.ac-field-note.warn{color:var(--ac-warn)}
.ac-limit{display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--ac-fg2);font-size:12px;padding-top:4px}
.ac-limit label{color:var(--ac-fg);font-weight:500}.ac-limit select{height:32px;padding:0 26px 0 10px;border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);border-radius:8px}.ac-limit>span{flex:1;min-width:180px}
.ac-start-foot{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 0 20px;border-top:1px solid var(--ac-border);background:var(--ac-bg);z-index:2}
.ac-start-foot>div{display:flex;flex-direction:column;gap:4px}.ac-start-foot b{font-size:13px}.ac-start-foot span{font-size:12px;color:var(--ac-fg2)}.ac-start-foot .ac-btn{height:42px;min-width:155px;justify-content:center}
.ac-text-btn{border:0;background:transparent;color:var(--ac-brand);font:inherit;font-size:12px;padding:4px;cursor:pointer;white-space:nowrap}
.ac-feedback{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px;border:1px solid color-mix(in srgb,var(--ac-err) 35%,transparent);background:color-mix(in srgb,var(--ac-err) 6%,var(--ac-bg));border-radius:10px;white-space:pre-wrap}
.ac-prerequisite{display:block;overflow-wrap:anywhere}.ac-prerequisite-actions{display:flex;flex-wrap:wrap;gap:16px;margin-top:8px}
.ac-run-heading{display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--ac-border)}
.ac-action-dock{position:sticky;top:0;z-index:3;background:var(--ac-bg)}.ac-bar{border-top:0;border-bottom:1px solid var(--ac-border);padding:12px 20px;min-height:60px}
.ac-review{display:flex;justify-content:space-between;gap:20px;margin:16px 20px 0;padding:16px;border:1px solid var(--ac-brand);border-radius:12px;background:color-mix(in srgb,var(--ac-brand) 5%,var(--ac-bg))}.ac-review p{margin:6px 0;font-size:12px;color:var(--ac-fg2)}.ac-review .ac-row{align-self:flex-start;flex:none}.ac-project-path{overflow-wrap:anywhere}
.ac-compare-tools{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 20px 0}.ac-compare-tools .ac-seg button{font-size:12px;height:28px;padding:0 12px}
.ac-preview-limits{margin:8px 20px 0;font-size:12px;color:var(--ac-fg2);flex:none}.ac-preview-limits summary{cursor:pointer}.ac-preview-limits p{max-width:900px;line-height:1.6;margin:6px 0 0}
.ac-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;min-height:0;flex:none;padding:16px 20px 20px;gap:16px}.ac-grid.focus{grid-template-columns:minmax(0,1fr)}
.ac-card{min-width:0;min-height:360px}.ac-card[hidden]{display:none}.ac-card-head{gap:6px;padding:12px}.ac-card .ac-empty,.ac-card .ac-fail{min-height:240px}.ac-card-head .ac-preview-open{margin-left:auto;flex:none}
.ac-evidence>summary,.ac-patch>summary{font-size:12px;color:var(--ac-fg2)}.ac-evidence[open]{display:flex;flex-direction:column;gap:8px}.ac-evidence .ac-verdict{margin-top:8px}
.ac-patch pre{max-height:340px;max-width:100%;overflow:auto;white-space:pre;font:11px/1.6 ui-monospace,monospace;background:var(--ac-l1);border:1px solid var(--ac-border);border-radius:8px;padding:12px}
.ac-patch .ac-meta{overflow-wrap:anywhere;margin-top:8px}.ac-checks{min-height:22px}.ac-strategy{margin-left:0;flex-basis:100%;overflow-wrap:anywhere;font-weight:500;color:var(--ac-fg2)}
.ac-preview-stage{padding:12px;background:var(--ac-l1);overflow:hidden;min-height:100px;display:flex;justify-content:center}
.ac-preview-surface{position:relative;flex:none;background:white;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px var(--ac-border)}
.ac-frame{position:absolute;left:0;top:0;transform-origin:top left;display:block;max-width:none;min-height:0;border:0;background:white}
.ac-guide{max-width:800px;padding:36px;gap:24px}.ac-guide-steps{counter-reset:step;list-style:none!important;padding:0!important;gap:22px!important}.ac-guide-steps li{padding-left:38px;position:relative;counter-increment:step}.ac-guide-steps li:before{content:counter(step);position:absolute;left:0;top:0;width:24px;height:24px;display:grid;place-items:center;background:var(--ac-l2);border-radius:8px;color:var(--ac-fg2);font-size:12px}.ac-guide-steps b{font-size:14px;color:var(--ac-fg)}.ac-guide-steps p{margin:6px 0 0;line-height:1.8;font-size:13px}
.ac-inline .ac-compare-tools{display:flex;padding:12px 12px 0}.ac-inline .ac-preview-stage{display:flex;min-height:0}.ac-inline .ac-browser{height:auto;min-height:0}.ac-inline .ac-card-head{padding:10px 12px;gap:6px}.ac-inline .ac-card{min-height:0}.ac-inline .ac-action-dock{position:static}
.ac-composer-settings{flex:none;border:1px solid var(--ac-border-strong);border-radius:12px;padding:12px 14px;background:var(--ac-bg);display:flex;flex-direction:column;gap:10px;margin:0 0 8px}
.ac-conversation-run{flex:none;width:100%;border:1px solid var(--ac-border-strong);background:var(--ac-bg);border-radius:12px;margin:0 0 10px;overflow:hidden}
.ac-conversation-run-head{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--ac-border);font-size:12px}.ac-conversation-run-scroll{max-height:min(760px,60vh);max-height:clamp(170px,calc(100dvh - 360px),760px);overflow:auto;overscroll-behavior:contain}.ac-conversation-run .ac-inline{margin:0;border:0;border-radius:0;overflow:visible}.ac-conversation-run .ac-action-dock{position:sticky;top:0}.ac-preview-label{font-weight:700;color:var(--ac-fg);font-size:12px}
.ac-settings-head{display:flex;align-items:center;gap:10px}.ac-settings-head>div{display:flex;flex:1;flex-wrap:wrap;gap:4px 12px;align-items:center}.ac-settings-head b{font-size:13px}.ac-settings-head span:not(.ac-logo){color:var(--ac-fg2);font-size:12px}
.ac-settings-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.ac-settings-row>.ac-seg button{font-size:12px;height:28px;padding:0 10px}.ac-settings-row>.ac-btn{margin-left:auto}.ac-settings-foot{font-size:11px;color:var(--ac-fg2)}.ac-settings-project{overflow-wrap:anywhere}.ac-composer-settings .ac-models{max-width:100%}.ac-composer-settings .ac-models select{min-width:0;width:100%}.ac-composer-settings .ac-feedback{padding:8px;font-size:12px}
@media(max-width:600px){.ac-composer-settings{padding:10px}.ac-settings-head>div{display:block}.ac-settings-head>div>span{display:block;margin-top:3px}.ac-settings-row{gap:8px}.ac-settings-row>.ac-seg{flex-basis:100%;width:100%}.ac-settings-row>.ac-seg button{flex:1;min-height:36px}.ac-settings-row>.ac-btn{height:36px}.ac-composer-settings .ac-models{grid-template-columns:minmax(0,1fr)}.ac-inline .ac-inline-head{flex-wrap:wrap}.ac-inline .ac-inline-head .ac-task{min-width:50%}}
@media(max-width:900px){.ac-sheet{left:6px;right:6px;bottom:6px}.ac-head{padding:12px 14px;gap:8px}.ac-header-caption{display:none}.ac-start{padding:24px 20px 0}.ac-grid{grid-template-columns:minmax(0,1fr)}.ac-card{min-height:0}.ac-models{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media(max-width:600px){.ac-sheet{top:max(40px,env(titlebar-area-height,0px));left:0;right:0;bottom:0;border-radius:0}.ac-head{flex-wrap:wrap;gap:6px}.ac-title{font-size:13px}.ac-tabs{order:2;flex-basis:100%;justify-content:center}.ac-tab{flex:1}.ac-h1{font-size:25px}.ac-start{padding:22px 16px 0;gap:20px}.ac-options,.ac-models{grid-template-columns:minmax(0,1fr)}.ac-start-foot{align-items:stretch;flex-direction:column;gap:10px;padding:12px 0}.ac-start-foot>div>span{display:none}.ac-start-foot .ac-btn{width:100%}.ac-bar{padding:10px 12px;gap:8px}.ac-bar-text{min-width:100%;font-size:12px}.ac-bar .ac-btn{flex:1;justify-content:center;min-height:40px}.ac-grid{padding:12px;gap:12px}.ac-compare-tools{padding:12px 12px 0;gap:8px}.ac-compare-tools>.ac-meta{display:none}.ac-seg button{min-height:36px}.ac-review{margin:12px;flex-direction:column}.ac-run-heading{padding:10px 12px}.ac-run-heading>.ac-meta{display:none}.ac-guide{padding:24px 18px}.ac-hrow{flex-wrap:wrap}.ac-hrow .t{min-width:150px}.ac-header-caption{display:none}.ac-field-foot>.ac-meta{font-size:11px}.ac-field-foot{gap:4px}}
@media(prefers-color-scheme:dark){.ac-root{--ac-brand:var(--dsw-alias-brand-primary,#a1b0ff);--ac-brand-fg:var(--dsw-alias-label-primary-foreground,#111827);--ac-ok:var(--dsw-alias-state-success-primary,#65d89f);--ac-err:var(--dsw-alias-state-error-primary,#ff98a3);--ac-warn:var(--dsw-alias-state-warn-primary,#edc575)}}
@media(prefers-reduced-motion:reduce){.ac-root *{animation:none!important;transition:none!important}}
`;
function Styles() {
  return /* @__PURE__ */ import_react.default.createElement("style", null, CSS);
}
var IconClose = () => /* @__PURE__ */ import_react.default.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", "aria-hidden": "true" }, /* @__PURE__ */ import_react.default.createElement("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }));
var IconExternal = () => /* @__PURE__ */ import_react.default.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true" }, /* @__PURE__ */ import_react.default.createElement("path", { d: "M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h2.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }));
function StagePill({ c }) {
  const complete = Boolean(c.checks?.length && c.checks.every((check) => check.outcome === "passed"));
  const kind = c.stage === "ready" ? c.verdict?.eligible ? complete ? "ok" : "" : c.verdict ? "err" : "" : c.stage === "failed" ? "err" : c.stage === "interrupted" ? "warn" : busyStage(c.stage) ? "brand" : "";
  const availability = c.previewUrl ? "\u53EF\u9884\u89C8" : c.hasScreenshot || c.hasMobileScreenshot ? "\u622A\u56FE\u8BB0\u5F55" : "\u9A8C\u6536\u5B8C\u6210";
  const title = c.stage === "ready" ? `${availability} \xB7 ${c.verdict ? c.verdict.eligible ? complete ? "\u68C0\u67E5\u901A\u8FC7" : "\u90E8\u5206\u68C0\u67E5\u672A\u8FD0\u884C" : "\u672A\u901A\u8FC7\u68C0\u67E5" : "\u68C0\u67E5\u72B6\u6001\u672A\u77E5"}` : STAGE_TEXT[c.stage];
  return /* @__PURE__ */ import_react.default.createElement("span", { className: `ac-pill ${kind}` }, busyStage(c.stage) ? /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spin" }) : /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-dot" }), title);
}
function Track({ c }) {
  const failedAt = c.stage === "failed" || c.stage === "interrupted" ? c.error?.stage : void 0;
  const current = PIPELINE.findIndex((p) => p.stage === (failedAt ?? c.stage));
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-track", "aria-label": "\u8FDB\u5EA6" }, PIPELINE.map((p, i) => {
    const cls = c.stage === "ready" || i < current ? "done" : i === current ? failedAt ? "bad" : busyStage(c.stage) ? "now" : "" : "";
    return /* @__PURE__ */ import_react.default.createElement("i", { key: p.stage, className: cls, title: p.label });
  }));
}
function Checks({ checks }) {
  if (!checks?.length) return null;
  const icon = { passed: "\u2713", failed: "\u2715", skipped: "\u2013", timeout: "\u23F1" };
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-checks" }, checks.map((k) => /* @__PURE__ */ import_react.default.createElement("span", { key: k.name, className: `ac-check ${k.outcome}`, title: k.reason ?? `${fmt(k.durationMs)}` }, icon[k.outcome], " ", CHECK_TEXT[k.name] ?? k.name, k.outcome === "skipped" ? " \u672A\u8FD0\u884C" : "")));
}
function Verdict({ c }) {
  const v = c.verdict;
  if (v === void 0) return null;
  const steps = c.checks?.find((k) => k.name === "browser")?.steps;
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: `ac-verdict ${v.eligible ? "ok" : "bad"}` }, v.eligible ? "\u2713 \u5DF2\u901A\u8FC7\u5DF2\u914D\u7F6E\u7684\u68C0\u67E5\uFF1B\u91C7\u7528\u524D\u4ECD\u9700\u5BA1\u67E5\u4E0E\u76EE\u6807\u6838\u9A8C" : `\u2715 \u5F53\u524D\u4E0D\u80FD\u91C7\u7528\uFF1A${v.reasons.join("\uFF1B")}`, v.warnings.length > 0 && /* @__PURE__ */ import_react.default.createElement("small", null, v.warnings.join("\uFF1B"))), steps && steps.length > 0 && /* @__PURE__ */ import_react.default.createElement("details", { className: "ac-details" }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u9700\u6C42\u9A8C\u6536 ", steps.filter((s) => s.ok).length, "/", steps.length, " \u6B65\u901A\u8FC7"), /* @__PURE__ */ import_react.default.createElement("ul", { className: "ac-steps-list" }, steps.map((s, i) => /* @__PURE__ */ import_react.default.createElement("li", { key: i, className: s.ok ? "ok" : "bad" }, s.ok ? "\u2713" : "\u2715", " ", s.label, s.detail ? `\uFF08${s.detail}\uFF09` : "")))));
}
function Screenshots({ runId, c, busy, act, device }) {
  const mobile = device === "phone", key = `${runId}/${c.label}/${mobile ? "phone" : "desktop"}`;
  const available = mobile ? c.hasMobileScreenshot : c.hasScreenshot;
  const description = `\u5019\u9009 ${c.label} ${mobile ? "\u624B\u673A" : "\u684C\u9762"}\u9A8C\u6536\u622A\u56FE`;
  const [image, setImage] = (0, import_react.useState)({ key, loading: !!available });
  const [retry, setRetry] = (0, import_react.useState)(0);
  const [original, setOriginal] = (0, import_react.useState)({ key, value: false });
  const natural = original.key === key && original.value;
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    let active = true;
    setImage({ key, loading: !!available });
    if (available) call("shot", { runId, label: c.label, ...mobile ? { mobile: true } : {} }, controller.signal).then((r) => {
      if (active) setImage({ key, loading: false, url: r.dataUrl });
    }, (error) => {
      if (active) setImage({ key, loading: false, error: error.message });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, runId, c.label, mobile, available, retry]);
  const current = image.key === key ? image : { key, loading: !!available };
  const reopen = c.canReopenPreview ? /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary sm", disabled: busy, onClick: () => act("reopenPreview", { label: c.label }) }, "\u91CD\u65B0\u6253\u5F00\u9884\u89C8") : null;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-shotwrap" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-shotbar" }, /* @__PURE__ */ import_react.default.createElement("span", null, c.canReopenPreview ? "\u9884\u89C8\u5DF2\u505C\u6B62\uFF08DSH \u91CD\u542F\u6216\u5DF2\u7ED3\u675F\uFF09\uFF0C\u53EF\u4EE5\u91CD\u65B0\u6253\u5F00\u3002\u4E0B\u9762\u662F\u9A8C\u6536\u65F6\u7684\u622A\u56FE\uFF1A" : "\u526F\u672C\u5DF2\u6E05\u7406\uFF0C\u4E0B\u9762\u662F\u9A8C\u6536\u65F6\u7684\u622A\u56FE\uFF1A"), reopen), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-shottools" }, /* @__PURE__ */ import_react.default.createElement("span", null, mobile ? "\u624B\u673A" : "\u684C\u9762", "\u9A8C\u6536\u622A\u56FE \xB7 \u9759\u6001\u8BB0\u5F55"), current.url && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", "aria-pressed": natural, onClick: () => setOriginal({ key, value: !natural }) }, natural ? "\u9002\u5E94\u5BBD\u5EA6" : "\u539F\u59CB\u5C3A\u5BF8")), current.loading ? /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-empty", role: "status" }, "\u6B63\u5728\u8BFB\u53D6", description, "\u2026") : current.error ? /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-empty", role: "alert" }, "\u622A\u56FE\u8BFB\u53D6\u5931\u8D25\uFF1A", current.error, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn sm", onClick: () => setRetry((n) => n + 1) }, "\u91CD\u8BD5\u8BFB\u53D6\u622A\u56FE")) : current.url ? /* @__PURE__ */ import_react.default.createElement("div", { className: `ac-shot${natural ? " natural" : ""}`, tabIndex: 0, role: "region", "aria-label": description }, /* @__PURE__ */ import_react.default.createElement("img", { className: mobile ? "m" : "", src: current.url, alt: description, onError: () => setImage({ key, loading: false, error: "\u56FE\u7247\u65E0\u6CD5\u663E\u793A\uFF0C\u8BF7\u91CD\u8BD5\u8BFB\u53D6\u3002" }) })) : /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-empty" }, "\u6B64\u8BB0\u5F55\u6CA1\u6709", mobile ? "\u624B\u673A" : "\u684C\u9762", "\u9A8C\u6536\u622A\u56FE\u3002"));
}
function Activity({ p }) {
  const idle = Date.now() - p.lastActivityAt;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta ac-activity" }, "\u5DF2\u8FDB\u884C ", p.steps, " \u8F6E", p.lastAction ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, " \xB7 \u6700\u8FD1\uFF1A", /* @__PURE__ */ import_react.default.createElement("code", null, p.lastAction)) : null, p.tokens ? ` \xB7 ${p.tokens.toLocaleString()} tokens` : "", idle > 9e4 ? /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-slow" }, " \xB7 ", fmt(idle), " \u6CA1\u6709\u65B0\u52A8\u4F5C\uFF08\u5728\u7B49\u6A21\u578B\u6216\u5DE5\u5177\uFF09") : null);
}
function LivePreview({ c, device, compact }) {
  const holder = (0, import_react.useRef)(null);
  const [width, setWidth] = (0, import_react.useState)(0);
  const size = device === "adaptive" ? { width: Math.max(240, width - 24), height: compact ? 320 : 480 } : device === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  (0, import_react.useEffect)(() => {
    const el = holder.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, Math.max(1, width - 24) / size.width);
  return /* @__PURE__ */ import_react.default.createElement("div", { ref: holder, className: "ac-preview-stage" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-preview-surface", style: { width: size.width * scale, height: size.height * scale } }, /* @__PURE__ */ import_react.default.createElement("iframe", { className: "ac-frame", title: `\u5019\u9009 ${c.label} \u7684\u8FD0\u884C\u9875\u9762`, src: c.previewUrl, sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads", style: { width: size.width, height: size.height, transform: `scale(${scale})` } })));
}
function PatchReview({ runId, label }) {
  const [patch, setPatch] = (0, import_react.useState)();
  const [error, setError] = (0, import_react.useState)();
  const read = () => {
    setError(void 0);
    call("patch", { runId, label }).then(setPatch, (e) => setError(e.message));
  };
  return /* @__PURE__ */ import_react.default.createElement("details", { className: "ac-details ac-patch", onToggle: (e) => {
    if (e.currentTarget.open && !patch) read();
  } }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u67E5\u770B ", label, " \u7684\u4EE3\u7801\u6539\u52A8"), error ? /* @__PURE__ */ import_react.default.createElement("div", { role: "alert" }, error, " ", /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: read }, "\u91CD\u8BD5")) : !patch ? /* @__PURE__ */ import_react.default.createElement("p", { className: "ac-meta" }, "\u6B63\u5728\u8BFB\u53D6\u8865\u4E01\u2026") : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, "SHA-256 ", patch.sha256 ?? "\u672A\u77E5", patch.truncated ? " \xB7 \u8865\u4E01\u8F83\u5927\uFF0C\u5F53\u524D\u4EC5\u663E\u793A\u524D 400,000 \u4E2A\u5B57\u7B26\uFF0C\u8BF7\u53E6\u5B58\u5206\u652F\u8FDB\u884C\u5B8C\u6574\u5BA1\u67E5\u3002" : ""), /* @__PURE__ */ import_react.default.createElement("pre", { tabIndex: 0, "aria-label": `\u5019\u9009 ${label} \u7684\u8865\u4E01` }, patch.text || "\u6CA1\u6709\u6587\u672C\u6539\u52A8")));
}
function CandidateCard({ run, c, revealed, picked, busy, act, device, compact, hidden }) {
  const usage = !revealed ? void 0 : c.usage?.kind !== "reported" ? "\u7528\u91CF\u672A\u77E5" : [
    c.usage.totalTokens === void 0 ? "\u603B\u7528\u91CF\u672A\u77E5" : `${c.usage.totalTokens.toLocaleString()} tokens`,
    ...[["inputTokens", "\u672A\u7F13\u5B58\u8F93\u5165"], ["outputTokens", "\u8F93\u51FA"], ["cacheReadTokens", "\u7F13\u5B58\u8BFB\u53D6"], ["cacheWriteTokens", "\u7F13\u5B58\u5199\u5165"]].flatMap(([key, label]) => c.usage?.kind === "reported" && c.usage[key] !== void 0 ? [`${label} ${c.usage[key].toLocaleString()}`] : [])
  ].join(" \xB7 ");
  const live = c.previewUrl !== void 0 && !["failed", "cancelled", "interrupted"].includes(c.stage);
  const step = busyStage(c.stage) && c.stage !== "stopping" ? PIPELINE.findIndex((p) => p.stage === c.stage) + 1 : 0;
  const model = revealed ? routeText(c.actualRoute ?? c.route) : "";
  return /* @__PURE__ */ import_react.default.createElement("section", { className: `ac-card${picked ? " picked" : ""}`, "aria-label": `\u5019\u9009 ${c.label}`, hidden }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-card-head" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-row" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-label" }, c.label), /* @__PURE__ */ import_react.default.createElement(StagePill, { c }), c.previewKind === "dev" && live && /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-pill warn", title: "\u6784\u5EFA\u6CA1\u6709\u901A\u8FC7\uFF0C\u8FD9\u662F\u5F00\u53D1\u6A21\u5F0F\uFF0C\u53EA\u4F9B\u89C2\u5BDF" }, "\u5F00\u53D1\u6A21\u5F0F"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, c.verificationHistory?.length ? "\u672C\u6B21\u9A8C\u6536 " : "", fmt(elapsed(c))), run.state === "running" && busyStage(c.stage) && c.stage !== "stopping" && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn sm", disabled: busy, onClick: () => act("cancel", { label: c.label }) }, "\u505C\u6B62\u8FD9\u4E00\u7248"), live && /* @__PURE__ */ import_react.default.createElement("a", { className: "ac-icon-btn ac-preview-open", href: c.previewUrl, target: "_blank", rel: "noreferrer", title: `\u5728\u6D4F\u89C8\u5668\u6807\u7B7E\u9875\u4E2D\u6253\u5F00 ${c.previewUrl}\uFF1BCookie \u4E0E\u5B58\u50A8\u4E0A\u4E0B\u6587\u53EF\u80FD\u548C\u5D4C\u5165\u9884\u89C8\u4E0D\u540C`, "aria-label": `\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00 ${c.label}` }, /* @__PURE__ */ import_react.default.createElement(IconExternal, null)), revealed && c.strategy && /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-strategy" }, c.strategy.title, model ? ` \xB7 ${model}` : "")), busyStage(c.stage) && /* @__PURE__ */ import_react.default.createElement(Track, { c }), step > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, "\u7B2C ", step, "/", PIPELINE.length, " \u6B65 \xB7 ", STAGE_TEXT[c.stage]), c.stage === "generating" && c.progress && /* @__PURE__ */ import_react.default.createElement(Activity, { p: revealed ? c.progress : { steps: c.progress.steps, lastActivityAt: c.progress.lastActivityAt, ...c.progress.lastAction ? { lastAction: "\u6B63\u5728\u5904\u7406\u9879\u76EE" } : {} } }), /* @__PURE__ */ import_react.default.createElement(Checks, { checks: c.checks }), /* @__PURE__ */ import_react.default.createElement("details", { className: "ac-details ac-evidence" }, /* @__PURE__ */ import_react.default.createElement("summary", null, revealed ? "\u68C0\u67E5\u4F9D\u636E\u4E0E\u7528\u91CF" : "\u68C0\u67E5\u4F9D\u636E \xB7 \u76F2\u9009\u4E2D", c.verdict ? c.verdict.eligible ? " \xB7 \u5DF2\u901A\u8FC7\u914D\u7F6E\u68C0\u67E5" : " \xB7 \u5B58\u5728\u91C7\u7528\u963B\u788D" : ""), /* @__PURE__ */ import_react.default.createElement(Verdict, { c }), !revealed && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, "\u6A21\u578B\u3001\u7B56\u7565\u3001\u7528\u91CF\u3001\u6539\u52A8\u89C4\u6A21\u548C\u8BE6\u7EC6\u65E5\u5FD7\u5728\u9009\u62E9\u540E\u663E\u793A\u3002"), c.execution && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, "\u9879\u76EE\u547D\u4EE4\uFF1A", c.execution.enforcement === "full" ? "\u5BBF\u4E3B\u62A5\u544A\u5B8C\u6574\u6587\u4EF6\u5199\u5165\u7EA6\u675F" : c.execution.enforcement === "partial" ? "\u5BBF\u4E3B\u62A5\u544A\u90E8\u5206\u6587\u4EF6\u5199\u5165\u7EA6\u675F" : "\u7EA6\u675F\u5B8C\u6574\u6027\u672A\u77E5", "\u3002\u4E0D\u5305\u542B\u6587\u4EF6\u8BFB\u53D6\u4E0E\u7F51\u7EDC\u9694\u79BB\u3002"), c.install?.runtime && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, "\u9A8C\u6536\u5BBF\u4E3B Node ", c.install.runtime.hostNode, " \xB7 ", c.install.runtime.platform, " \xB7 ", c.install.runtime.packageManager, " ", c.install.runtime.packageManagerVersion ?? "\u7248\u672C\u672A\u8BB0\u5F55"), revealed && (c.patchStats || usage) && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, c.patchStats ? `${c.patchStats.files} \u4E2A\u6587\u4EF6 \xB7 +${c.patchStats.insertions} \u2212${c.patchStats.deletions}${c.patchStats.binary ? ` \xB7 ${c.patchStats.binary} \u4E2A\u4E8C\u8FDB\u5236` : ""}` : "", c.patchStats && usage ? " \xB7 " : "", usage), revealed && c.summary && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-summary" }, c.summary)), !!c.verificationHistory?.length && /* @__PURE__ */ import_react.default.createElement("details", { className: "ac-details" }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u5148\u524D\u9A8C\u6536\u8BB0\u5F55 \xB7 ", c.verificationHistory.length, " \u6B21"), /* @__PURE__ */ import_react.default.createElement("ol", null, c.verificationHistory.map((attempt, index) => /* @__PURE__ */ import_react.default.createElement("li", { key: index }, /* @__PURE__ */ import_react.default.createElement("b", null, attempt.install?.failure?.summary ?? attempt.error?.message.split("\n")[0] ?? "\u5148\u524D\u9A8C\u6536\u672A\u5B8C\u6210"), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, "\u91CD\u8BD5\u524D\u5F52\u6863\u4E8E ", when(attempt.recordedAt), " \xB7 ", attempt.durationMs === void 0 ? "\u8017\u65F6\u672A\u77E5" : fmt(attempt.durationMs), attempt.install?.failure?.code ? ` \xB7 ${attempt.install.failure.code}` : ""), /* @__PURE__ */ import_react.default.createElement(Checks, { checks: attempt.checks }))))), revealed && c.patchStats && /* @__PURE__ */ import_react.default.createElement(PatchReview, { runId: run.runId, label: c.label })), live ? /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-browser" }, /* @__PURE__ */ import_react.default.createElement(LivePreview, { c, device, compact })) : c.error || c.canRetryVerification ? /* @__PURE__ */ import_react.default.createElement("div", { className: `ac-fail${c.stage === "interrupted" ? " interrupted" : ""}` }, /* @__PURE__ */ import_react.default.createElement("b", null, c.install?.failure?.summary ?? (c.error ? `${ERROR_STAGE[c.error.stage] ?? STAGE_TEXT[c.error.stage] ?? c.error.stage}${c.stage === "interrupted" ? "\u65F6\u4E2D\u65AD" : c.stage === "cancelled" ? "\u5DF2\u505C\u6B62" : "\u5931\u8D25"}` : "\u9A8C\u6536\u5DF2\u505C\u6B62")), c.install?.failure ? /* @__PURE__ */ import_react.default.createElement("p", null, c.install.failure.hint, c.install.failure.code ? `\uFF08${c.install.failure.code}\uFF09` : "") : c.error?.message, c.canRetryVerification && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-salvage" }, /* @__PURE__ */ import_react.default.createElement("span", null, "\u4FDD\u7559\u5DF2\u5C01\u5B58\u4EE3\u7801\u4E0E\u5171\u540C\u9A8C\u6536\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u3002"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary sm", disabled: busy, onClick: () => act("retryVerification", { label: c.label }) }, "\u91CD\u65B0\u9A8C\u6536 ", c.label)), revealed && c.install?.failure?.diagnostic && /* @__PURE__ */ import_react.default.createElement("details", { className: "ac-details" }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u67E5\u770B\u5B89\u88C5\u65E5\u5FD7"), /* @__PURE__ */ import_react.default.createElement("pre", { className: "ac-install-log", tabIndex: 0 }, c.install.failure.diagnostic)), c.salvageable && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-salvage" }, /* @__PURE__ */ import_react.default.createElement("span", null, "\u526F\u672C\u91CC\u8FD8\u4FDD\u7559\u7740\u5B83\u5DF2\u7ECF\u5199\u7684\u6539\u52A8\uFF0C\u53EF\u4EE5\u7167\u6837\u5C01\u5B58\u5E76\u8DD1\u5B8C\u6574\u9A8C\u6536\uFF0C\u7531\u9A8C\u6536\u7ED3\u679C\u51B3\u5B9A\u80FD\u5426\u91C7\u7528\u3002"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary sm", disabled: busy, onClick: () => act("salvage", { label: c.label }) }, "\u9A8C\u6536\u5DF2\u5199\u7684\u6539\u52A8"))) : c.stage === "ready" ? /* @__PURE__ */ import_react.default.createElement(Screenshots, { runId: run.runId, c, busy, act, device }) : /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-empty" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-skel" }, /* @__PURE__ */ import_react.default.createElement("i", { style: { width: "60%" } }), /* @__PURE__ */ import_react.default.createElement("i", null), /* @__PURE__ */ import_react.default.createElement("i", { style: { width: "80%" } })), /* @__PURE__ */ import_react.default.createElement("div", null, c.stage === "cancelled" ? "\u5DF2\u505C\u6B62" : c.stage === "stopping" ? "\u6B63\u5728\u505C\u6B62\u5E76\u56DE\u6536\u8D44\u6E90\u2026" : `${STAGE_TEXT[c.stage]}\u2026\u6784\u5EFA\u4EA7\u7269\u542F\u52A8\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u771F\u5B9E\u9875\u9762`)));
}
function ComposerSettings({ sessionId, session }) {
  const mode = useAbMode(sessionId), p = mode.preferences;
  const [models, setModels] = (0, import_react.useState)([]);
  const [modelError, setModelError] = (0, import_react.useState)();
  const [loading, setLoading] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [setup, setSetup] = (0, import_react.useState)();
  const [setupError, setSetupError] = (0, import_react.useState)();
  const [setupRetry, setSetupRetry] = (0, import_react.useState)(0);
  const [error, setError] = (0, import_react.useState)();
  const state = inputSnapshot(sessionId);
  const enabled = p.enabled || state?.claim?.name === "ab";
  const loadModels = (0, import_react.useCallback)(async () => {
    setLoading(true);
    setModelError(void 0);
    try {
      setModels((await call("models", { sessionId })).models);
    } catch (e) {
      setModelError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);
  (0, import_react.useEffect)(() => {
    if (!enabled || mode.collapsed) return;
    let active = true, request = 0, applied = 0;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      const version = ++request;
      call("setup", { sessionId }).then((value) => {
        if (active && version >= applied) {
          applied = version;
          setSetup(value);
          setSetupError(void 0);
        }
      }, (error2) => {
        if (active && version >= applied) {
          applied = version;
          setSetup(void 0);
          setSetupError(error2.message);
        }
      });
    };
    refresh();
    const timer = setInterval(refresh, 1e4);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, mode.collapsed, session, sessionId, setupRetry]);
  (0, import_react.useEffect)(() => {
    if (enabled && p.mode === "cross-model") void loadModels();
  }, [enabled, p.mode, loadModels]);
  (0, import_react.useEffect)(() => {
    if (!p.enabled || !mode.loaded || !state || !clientSupport(sessionId).ok || !["plain", "claimed"].includes(state.phase)) return;
    if (!state.claim || state.claim.name === "ab" && !registeredShells.has(inputShell(sessionId))) {
      if (!enterMode(sessionId)) setError(clientSupportMessage(sessionId) ?? "\u5F53\u524D\u8F93\u5165\u6846\u6682\u65F6\u65E0\u6CD5\u8FDB\u5165\u6BD4\u8F83\u6A21\u5F0F\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002\u8349\u7A3F\u672A\u6539\u52A8\u3002");
    }
  }, [p.enabled, mode.loaded, state?.phase, state?.draftRev, sessionId]);
  const close = () => {
    if (!leaveMode(sessionId)) {
      setError("\u5F53\u524D\u6D88\u606F\u6B63\u5728\u63D0\u4EA4\uFF0C\u8BF7\u7B49\u5B83\u7ED3\u675F\u540E\u9000\u51FA\u6BD4\u8F83\u6A21\u5F0F");
      return;
    }
    saveMode(sessionId, { ...p, enabled: false });
    inputShell(sessionId)?.focus?.();
  };
  const example = async () => {
    setBusy(true);
    setError(void 0);
    try {
      const result = await executeComparison(sessionId, "", true);
      if (result.kind === "error") setError(result.text ?? "\u793A\u4F8B\u672A\u80FD\u5F00\u59CB");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const validPair = p.models.every((m) => m.provider && m.model) && JSON.stringify(p.models[0]) !== JSON.stringify(p.models[1]);
  if (!enabled && !mode.error) return null;
  return /* @__PURE__ */ import_react.default.createElement("section", { className: "ac-root ac-composer-settings", "aria-label": "A|B \u6BD4\u8F83\u8BBE\u7F6E" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-settings-head" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-logo" }, "A|B"), /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("b", null, "\u5BF9\u6BD4\u6A21\u5F0F"), /* @__PURE__ */ import_react.default.createElement("span", null, mode.collapsed ? `${p.mode === "same-model" ? "\u540C\u4E00\u6A21\u578B \xB7 \u4E24\u79CD\u7B56\u7565" : "\u4E24\u4E2A\u6A21\u578B \xB7 \u540C\u4E00\u8981\u6C42"} \xB7 \u6BCF\u7248 ${p.generationMinutes} \u5206\u949F` : "\u5728\u4E0B\u65B9\u5199\u9700\u6C42\uFF0C\u53D1\u9001\u540E\u5728\u8FD9\u6761\u5BF9\u8BDD\u91CC\u8FD0\u884C\u4E24\u7248\u3002")), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => {
    mode.collapsed = !mode.collapsed;
    publishMode(mode);
  } }, mode.collapsed ? "\u5C55\u5F00\u8BBE\u7F6E" : "\u6536\u8D77"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-icon-btn", onClick: close, disabled: busy, "aria-label": "\u9000\u51FA A|B \u6A21\u5F0F" }, /* @__PURE__ */ import_react.default.createElement(IconClose, null))), setup?.capabilities?.ok === false && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "alert" }, "\u5F53\u524D DSH ", setup.dshVersion ?? "\uFF08\u7248\u672C\u672A\u77E5\uFF09", " \u7F3A\u5C11\u6BD4\u8F83\u6240\u9700\u63A5\u53E3\uFF1A", setup.capabilities.missing.join("\u3001"), "\u3002\u8BF7\u5347\u7EA7\u6216\u56DE\u9000\u81F3\u5DF2\u9A8C\u8BC1\u7248\u672C\uFF1B\u6BD4\u8F83\u8BB0\u5F55\u548C\u8349\u7A3F\u4FDD\u7559\u3002"), setup?.capabilities?.warnings.includes("sessionController.resolveAgent") && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "status" }, "\u5F53\u524D DSH \u7F3A\u5C11\u4F1A\u8BDD\u6062\u590D\u63A5\u53E3\uFF1AsessionController.resolveAgent\u3002\u5DF2\u6253\u5F00\u7684\u5BF9\u8BDD\u4ECD\u53EF\u4F7F\u7528\uFF1B\u5386\u53F2\u5BF9\u8BDD\u8BF7\u5148\u5728 DSH \u4E2D\u91CD\u65B0\u6253\u5F00\u3002"), setup?.project?.supported === false && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "status" }, "\u5F53\u524D\u9879\u76EE\u4E0D\u53D7\u652F\u6301\uFF1A", setup.project.reason ?? "\u8BF7\u4F7F\u7528\u4ED3\u5E93\u6839\u76EE\u5F55\u7684 Vite \u9879\u76EE\u3002", " \u8349\u7A3F\u4FDD\u7559\uFF0C\u53EF\u8BD5\u8DD1\u5185\u7F6E\u793A\u4F8B\u3002"), !mode.collapsed && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-settings-row" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-seg", role: "group", "aria-label": "\u6BD4\u8F83\u65B9\u5F0F" }, /* @__PURE__ */ import_react.default.createElement("button", { className: p.mode === "same-model" ? "on" : "", "aria-pressed": p.mode === "same-model", onClick: () => saveMode(sessionId, { ...p, mode: "same-model" }) }, "\u540C\u4E00\u6A21\u578B \xB7 \u4E24\u79CD\u7B56\u7565"), /* @__PURE__ */ import_react.default.createElement("button", { className: p.mode === "cross-model" ? "on" : "", "aria-pressed": p.mode === "cross-model", onClick: () => saveMode(sessionId, { ...p, mode: "cross-model" }) }, "\u4E24\u4E2A\u6A21\u578B \xB7 \u540C\u4E00\u8981\u6C42")), /* @__PURE__ */ import_react.default.createElement("label", { className: "ac-budget" }, "\u6BCF\u7248\u4E0A\u9650 ", /* @__PURE__ */ import_react.default.createElement("select", { "aria-label": "\u6BCF\u7248\u751F\u6210\u4E0A\u9650", value: p.generationMinutes, onChange: (e) => saveMode(sessionId, { ...p, generationMinutes: Number(e.target.value) }) }, [.../* @__PURE__ */ new Set([5, 15, 30, 60, 90, 120, p.generationMinutes])].sort((a, b) => a - b).map((m) => /* @__PURE__ */ import_react.default.createElement("option", { key: m, value: m }, m, " \u5206\u949F")))), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn sm", disabled: busy || !mode.loaded || setup?.capabilities?.ok === false || !clientSupport(sessionId).canExecute || (p.mode === "cross-model" ? !validPair : !setup?.current.model), onClick: () => {
    void example();
  } }, busy ? "\u6B63\u5728\u521B\u5EFA\u793A\u4F8B\u2026" : "\u8BD5\u8DD1\u5185\u7F6E\u793A\u4F8B")), p.mode === "cross-model" ? /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-models" }, [0, 1].map((i) => /* @__PURE__ */ import_react.default.createElement("label", { key: i }, i === 0 ? "\u6A21\u578B\u4E00" : "\u6A21\u578B\u4E8C", /* @__PURE__ */ import_react.default.createElement("select", { disabled: loading || busy, value: p.models[i]?.model ? `${p.models[i]?.provider}/${p.models[i]?.model}` : "", onChange: (e) => {
    const item = models.find((m) => `${m.provider}/${m.id}` === e.target.value);
    const pair = [...p.models];
    pair[i] = item ? { provider: item.provider, model: item.id } : {};
    saveMode(sessionId, { ...p, models: pair });
  } }, /* @__PURE__ */ import_react.default.createElement("option", { value: "" }, "\u9009\u62E9\u5DF2\u914D\u7F6E\u7684\u6A21\u578B"), models.map((m) => /* @__PURE__ */ import_react.default.createElement("option", { key: `${m.provider}/${m.id}`, value: `${m.provider}/${m.id}`, disabled: p.models[1 - i]?.provider === m.provider && p.models[1 - i]?.model === m.id }, m.name, " \xB7 ", m.providerName))))), loading ? /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta", role: "status" }, "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u2026") : modelError ? /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta", role: "alert" }, modelError, " ", /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => {
    void loadModels();
  } }, "\u91CD\u8BD5\u6A21\u578B\u5217\u8868")) : models.length < 2 ? /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, "\u5F53\u524D\u53EF\u8BFB\u53D6\u7684\u6A21\u578B\u4E0D\u8DB3\u4E24\u4E2A\uFF0C\u53EF\u5148\u4F7F\u7528\u540C\u4E00\u6A21\u578B\u7684\u4E24\u79CD\u7B56\u7565\u3002") : null) : /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-meta" }, "\u5F53\u524D\u6A21\u578B\uFF1A", routeText(setup?.current) || (setup ? "\u8BF7\u5148\u5728\u8F93\u5165\u6846\u53F3\u4E0B\u89D2\u9009\u62E9\u6A21\u578B" : "\u6B63\u5728\u8BFB\u53D6\u2026"), setup?.project?.path ? /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-settings-project", title: setup.project.path }, " \xB7 \u9879\u76EE\uFF1A", setup.project.path) : ""), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-settings-foot" }, "\u5230\u65F6\u9A8C\u6536\u5DF2\u5199\u7684\u6539\u52A8 \xB7 \u4E24\u7248\u5206\u522B\u6D88\u8017\u7528\u91CF \xB7 ", mode.saving ? "\u6B63\u5728\u4FDD\u5B58\u8BBE\u7F6E\u2026" : "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u5728\u6B64\u5BF9\u8BDD")), setupError && !mode.collapsed && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "alert" }, "\u65E0\u6CD5\u8BFB\u53D6\u5F53\u524D\u6A21\u578B\u4E0E\u9879\u76EE\uFF1A", setupError, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => {
    setSetupError(void 0);
    setSetupRetry((value) => value + 1);
  } }, "\u91CD\u65B0\u8BFB\u53D6\u6A21\u578B\u4E0E\u9879\u76EE")), (error || mode.error) && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "alert" }, error ?? mode.error, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => {
    void loadMode(sessionId);
    setError(void 0);
  } }, "\u91CD\u65B0\u8BFB\u53D6\u8BBE\u7F6E")));
}
function ComposerDock({ sessionId, session }) {
  return /* @__PURE__ */ import_react.default.createElement(ComposerDockState, { key: sessionId, sessionId, ...session ? { session } : {} });
}
function ComposerDockState({ sessionId, session }) {
  const mode = useAbMode(sessionId);
  const capabilityError = clientSupportMessage(sessionId);
  const [latest, setLatest] = (0, import_react.useState)();
  const [collapsed, setCollapsed] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)();
  const blank = session?.blank === true;
  (0, import_react.useEffect)(() => {
    if (!blank) return;
    let active = true, request = 0, applied = 0;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      const version = ++request;
      call("list", { sessionId }).then((value) => {
        if (active && version >= applied) {
          applied = version;
          setLatest(value.runs[0]);
          setError(void 0);
        }
      }, (e) => {
        if (active && version >= applied) {
          applied = version;
          setError(e.message);
        }
      });
    };
    refresh();
    const timer = setInterval(refresh, mode.runId ? 6e3 : 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [blank, sessionId, mode.runId]);
  const runId = mode.runId ?? latest?.runId;
  (0, import_react.useEffect)(() => {
    setCollapsed(false);
  }, [runId]);
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, capabilityError && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback ac-prerequisite", role: "alert" }, /* @__PURE__ */ import_react.default.createElement("span", null, capabilityError), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-prerequisite-actions" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => {
    void loadMode(sessionId);
  } }, "\u91CD\u65B0\u68C0\u67E5\u63A5\u53E3"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => setOpen(sessionId) }, "\u6BD4\u8F83\u8BB0\u5F55")))), blank && runId && /* @__PURE__ */ import_react.default.createElement("section", { className: "ac-root ac-conversation-run", "aria-label": "\u672C\u5BF9\u8BDD\u7684 A|B \u7ED3\u679C" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), collapsed && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-conversation-run-head" }, /* @__PURE__ */ import_react.default.createElement("b", null, "\u672C\u6B21\u6BD4\u8F83"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, runId), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spacer" }), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => setOpen(sessionId) }, "\u8BB0\u5F55\u4E0E\u4F7F\u7528\u6307\u5357"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => setCollapsed(false) }, "\u5C55\u5F00\u7ED3\u679C")), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-conversation-run-scroll", hidden: collapsed }, /* @__PURE__ */ import_react.default.createElement(RunView, { key: runId, runId, sessionId, compact: true, ...latest?.runId === runId ? { initial: latest } : {}, onExpand: () => setOpen(sessionId, runId), onCollapse: () => setCollapsed(true) }))), blank && error && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "alert" }, "\u8BFB\u53D6\u6BD4\u8F83\u8BB0\u5F55\u5931\u8D25\uFF1A", error)), /* @__PURE__ */ import_react.default.createElement(ComposerSettings, { sessionId, session }));
}
function StarNudge() {
  const key = "agent-compare.star-nudge";
  const [hidden, setHidden] = (0, import_react.useState)(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const hide = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
    }
    setHidden(true);
  };
  return /* @__PURE__ */ import_react.default.createElement("span", null, "\u89C9\u5F97\u6709\u7528\uFF1F", /* @__PURE__ */ import_react.default.createElement("a", { className: "ac-link", href: "https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare", target: "_blank", rel: "noreferrer", onClick: hide }, "\u7ED9\u9879\u76EE\u70B9\u4E2A Star"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-icon-btn", style: { width: 22, height: 22, verticalAlign: "middle" }, onClick: hide, "aria-label": "\u4E0D\u518D\u663E\u793A" }, /* @__PURE__ */ import_react.default.createElement(IconClose, null)));
}
function ActionBar({ run, busy, pending, act, onDone, onContinue }) {
  if (run.control?.allowed === false) return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar", role: "status", "aria-label": "\u6BD4\u8F83\u64CD\u4F5C\u6743\u9650" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u5F53\u524D\u4EC5\u53EF\u67E5\u770B\u3002"), run.control.reason));
  const pick = run.choice?.pick;
  const picked = run.candidates.find((c) => c.label === pick);
  const retrying = run.candidates.filter((c) => c.verificationHistory?.length && busyStage(c.stage));
  const total = Math.max(...(retrying.length ? retrying : run.candidates).map(elapsed));
  const ready = run.candidates.filter((c) => c.stage === "ready").length;
  switch (run.state) {
    case "running":
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, retrying.length ? `\u6B63\u5728\u91CD\u65B0\u9A8C\u6536 ${retrying.map((c) => c.label).join("\u3001")} \xB7 \u672C\u6B21\u5DF2\u7528 ` : "\u4E24\u4E2A\u5019\u9009\u5E76\u884C\u8FDB\u884C\u4E2D \xB7 \u5DF2\u7528 ", /* @__PURE__ */ import_react.default.createElement("strong", null, fmt(total)), ready ? ` \xB7 ${ready} \u4E2A\u5DF2\u53EF\u4F53\u9A8C` : ""), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn danger", disabled: busy, onClick: () => act("cancel") }, retrying.length ? "\u505C\u6B62\u9A8C\u6536" : "\u5168\u90E8\u505C\u6B62"));
    case "judging":
      if (ready === 0) {
        const salvageable = run.candidates.some((c) => c.salvageable || c.canRetryVerification);
        return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u4E24\u8FB9\u90FD\u6CA1\u6709\u53EF\u4F53\u9A8C\u7684\u7ED3\u679C\u3002"), salvageable ? "\u6539\u52A8\u4ECD\u4FDD\u7559\u3002\u53EF\u4EE5\u5728\u5361\u7247\u91CC\u67E5\u770B\u539F\u56E0\u5E76\u9A8C\u6536\uFF0C\u6216\u7ED3\u675F\u8FD9\u6B21\u6BD4\u8F83\u3002" : "\u53EF\u4EE5\u7ED3\u675F\u8FD9\u6B21\u6BD4\u8F83\uFF0C\u8C03\u6574\u63CF\u8FF0\u6216\u65F6\u95F4\u4E0A\u9650\u540E\u518D\u6765\u3002"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("choose", { pick: "none" }) }, "\u4E24\u7248\u90FD\u4E0D\u91C7\u7528\u5E76\u63ED\u6653"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("cleanup") }, "\u7ED3\u675F\u5E76\u6E05\u7406"));
      }
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, ready === 2 ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u4E24\u8FB9\u90FD\u8BD5\u4E00\u4E0B"), "\uFF0C\u9009\u51FA\u4F60\u66F4\u613F\u610F\u91C7\u7528\u7684\u90A3\u4E00\u7248\uFF1B\u9009\u5B8C\u7ACB\u5373\u63ED\u6653") : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u4EC5 ", run.candidates.find((c) => c.stage === "ready")?.label, " \u5DF2\u53EF\u4F53\u9A8C\u3002"), "\u5148\u64CD\u4F5C\u8FD9\u4E00\u7248\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u9009\u62E9\uFF1B\u9009\u5B8C\u7ACB\u5373\u63ED\u6653\u3002")), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("choose", { pick: "none" }) }, "\u90FD\u4E0D\u6EE1\u610F"), run.candidates.filter((c) => c.stage === "ready").map((c) => /* @__PURE__ */ import_react.default.createElement("button", { key: c.label, className: "ac-btn primary", disabled: busy, onClick: () => act("choose", { pick: c.label }) }, "\u9009 ", c.label)));
    case "revealed": {
      const eligible = picked?.verdict?.eligible === true;
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, pick === "none" || picked === void 0 ? "\u8FD9\u6B21\u4E24\u7248\u90FD\u6CA1\u9009\u3002\u53EF\u4EE5\u6362\u4E2A\u63CF\u8FF0\u518D\u6765\u4E00\u6B21\u3002" : eligible ? "\u5148\u6838\u5BF9\u76EE\u6807\u4E0E\u6539\u52A8\uFF0C\u5FC5\u8981\u65F6\u5728\u526F\u672C\u4E2D\u9884\u6F14\uFF1B\u786E\u8BA4\u540E\u624D\u5199\u5165\u3002" : "\u8FD9\u4E00\u7248\u6CA1\u6709\u901A\u8FC7\u5171\u540C\u9A8C\u6536\uFF0C\u4E0D\u80FD\u5199\u5165\u5DE5\u4F5C\u533A\uFF0C\u53EF\u4EE5\u53E6\u5B58\u4E3A\u5206\u652F\u67E5\u770B\u3002"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("cleanup") }, "\u7ED3\u675F\u5E76\u6E05\u7406"), picked !== void 0 && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("adopt", { mode: "branch" }), title: "\u53EA\u65B0\u5EFA\u5206\u652F\uFF08\u542B\u4E00\u4E2A\u63D0\u4EA4\uFF09\uFF0C\u4E0D\u5207\u6362\u3001\u4E0D\u6539\u5F53\u524D\u6587\u4EF6" }, "\u53E6\u5B58\u4E3A\u5206\u652F"), picked !== void 0 && eligible && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary", disabled: busy, onClick: () => act("reviewAdoption") }, "\u5BA1\u67E5\u5E76\u91C7\u7528 ", pick));
    }
    case "adopting":
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spin", style: { display: "inline-block", marginRight: 8 } }), run.adoption?.state === "reverting" ? "\u6B63\u5728\u6062\u590D\u6587\u4EF6\u5E76\u6838\u5BF9\uFF0C\u539F\u59CB\u5185\u5BB9\u7EE7\u7EED\u4FDD\u7559\u2026" : run.adoption?.state === "writing" ? "\u6B63\u5728\u4FDD\u7559\u539F\u59CB\u5185\u5BB9\u3001\u5199\u5165\u5E76\u6838\u5BF9\u2026" : "\u6B63\u5728\u4F60\u5F53\u524D\u9879\u76EE\u7684\u526F\u672C\u91CC\u9884\u6F14\u5E76\u9A8C\u6536\u2026"));
    case "recovery":
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, run.adoption?.transferDirection === "undo" ? "\u4E0A\u6B21\u6062\u590D\u64CD\u4F5C\u6CA1\u6709\u5B8C\u6574\u7ED3\u675F\u3002\u53EF\u4EE5\u56DE\u9000\u5230\u8BE5\u64CD\u4F5C\u5F00\u59CB\u524D\uFF0C\u6216\u4FDD\u7559\u73B0\u5728\u7684\u6587\u4EF6\u3002" : "\u91C7\u7528\u6CA1\u6709\u5B8C\u6574\u7ED3\u675F\u3002\u53EF\u4EE5\u6062\u590D\u4FDD\u7559\u7684\u539F\u59CB\u5185\u5BB9\uFF0C\u6216\u4FDD\u7559\u73B0\u5728\u7684\u6587\u4EF6\u3002", "\u9047\u5230\u65B0\u7F16\u8F91\u4F1A\u505C\u4E0B\u5E76\u4FDD\u7559\u53CC\u65B9\u5185\u5BB9\u3002"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("recover", { action: "keep" }) }, "\u4FDD\u7559\u5F53\u524D\u6587\u4EF6"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary", disabled: busy, onClick: () => act("recover", { action: "restore" }) }, run.adoption?.transferDirection === "undo" ? "\u56DE\u9000\u672A\u5B8C\u6210\u64CD\u4F5C" : "\u6062\u590D\u5230\u91C7\u7528\u524D"));
    case "adopted":
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar", ...busy && pending ? { role: "status", "aria-label": "\u91C7\u7528\u64CD\u4F5C\u72B6\u6001" } : {} }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, busy && pending ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spin", style: { display: "inline-block", marginRight: 8 } }), pending === "adopt" ? "\u6539\u52A8\u5DF2\u5199\u5165\uFF0C\u6B63\u5728\u6574\u7406\u8BB0\u5F55\u3001\u9884\u89C8\u4E0E\u526F\u672C\uFF1B\u5B8C\u6210\u540E\u53EF\u64A4\u9500\u6216\u7EE7\u7EED\u3002" : pending === "revert" ? "\u6B63\u5728\u64A4\u9500\u91C7\u7528\u5E76\u6838\u5BF9\u9879\u76EE\uFF0C\u8BF7\u7A0D\u5019\u2026" : "\u6B63\u5728\u5904\u7406\u8FD9\u6B21\u6BD4\u8F83\uFF0C\u8BF7\u7A0D\u5019\u2026") : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, "\u91C7\u7528\u8BB0\u5F55\u5DF2\u4FDD\u5B58\u3002", /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-project-path" }, "\u76EE\u6807\uFF1A", run.baseline.repoRoot ?? "\u672C\u6B21\u6BD4\u8F83\u7684\u4ED3\u5E93"), " ", /* @__PURE__ */ import_react.default.createElement(StarNudge, null))), run.adoption?.mode === "worktree" && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("revert") }, "\u64A4\u9500\u91C7\u7528"), onContinue && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary", disabled: busy, onClick: onContinue, title: "\u9000\u51FA\u6BD4\u8F83\u6A21\u5F0F\uFF0C\u5728\u539F\u8F93\u5165\u6846\u4E2D\u7EE7\u7EED\u3002\u6BD4\u8F83\u8BB0\u5F55\u4ECD\u7136\u4FDD\u7559\u3002" }, "\u7EE7\u7EED\u4E3B\u5BF9\u8BDD"), onDone && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: onDone }, "\u5B8C\u6210"));
    default:
      return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-bar" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-bar-text" }, run.state === "interrupted" ? "\u8FD9\u6B21\u6BD4\u8F83\u5728\u5BBF\u4E3B\u505C\u6B62\u65F6\u4E2D\u65AD\uFF0C\u53EF\u9A8C\u6536\u526F\u672C\u91CC\u5DF2\u7ECF\u5199\u51FA\u7684\u6539\u52A8\u3002" : "\u8FD9\u6B21\u6BD4\u8F83\u5DF2\u7ED3\u675F\u3002"), run.state === "interrupted" && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy, onClick: () => act("cleanup") }, "\u6E05\u7406"));
  }
}
function Banners({ run }) {
  const pick = run.choice?.pick;
  const fav = run.checksFavoured;
  const revealed = REVEALED.has(run.state) || run.choice !== void 0;
  const pickedTitle = run.candidates.find((c) => c.label === pick)?.strategy?.title;
  const a = run.adoption;
  const bad = a && ["blocked", "rolled-back", "needs-recovery"].includes(a.state);
  const comparison = revealed && pick !== void 0 ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", null, run.mode === "same-model" ? "\u540C\u4E00\u6A21\u578B\u3001\u4E24\u79CD\u7B56\u7565\u3002" : "\u4E24\u4E2A\u6A21\u578B\u3001\u540C\u4E00\u8981\u6C42\u3002", "\u4F60\u9009\u4E86 ", /* @__PURE__ */ import_react.default.createElement("strong", null, pick === "none" ? "\u90FD\u4E0D\u6EE1\u610F" : `${pick}${pickedTitle ? `\uFF08${pickedTitle}\uFF09` : ""}`), "\uFF1B\u7A0B\u5E8F\u9A8C\u6536\u503E\u5411 ", /* @__PURE__ */ import_react.default.createElement("strong", null, fav === "tie" ? "\u6301\u5E73" : fav === "none" || fav === void 0 ? "\u65E0" : fav), pick !== "none" && fav !== void 0 && fav !== "tie" && fav !== "none" && fav !== pick ? "\u3002\u4F60\u7684\u9009\u62E9\u548C\u9A8C\u6536\u7ED3\u8BBA\u4E0D\u540C\u3002" : "\u3002"), /* @__PURE__ */ import_react.default.createElement("div", { className: "disclaimer" }, "\u5355\u6B21\u4EFB\u52A1\u7684\u7ED3\u679C\u4E0D\u4EE3\u8868\u6A21\u578B\u6216\u7B56\u7565\u7684\u6574\u4F53\u4F18\u52A3\u3002")) : null;
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, run.outsideChanges && run.outsideChanges.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-banner warn", role: "alert" }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("strong", null, "\u751F\u6210\u671F\u95F4\uFF0C\u4F60\u7684\u9879\u76EE\u91CC\u8FD9\u4E9B\u6587\u4EF6\u548C\u5F00\u59CB\u65F6\u4E0D\u4E00\u6837\u4E86"), "\uFF1A", /* @__PURE__ */ import_react.default.createElement("code", null, run.outsideChanges.slice(0, 8).join("\u3001"), run.outsideChanges.length > 8 ? ` \u7B49 ${run.outsideChanges.length} \u4E2A` : "")), /* @__PURE__ */ import_react.default.createElement("div", { className: "disclaimer" }, "\u8FD9\u4E9B\u53D8\u5316\u7684\u6765\u6E90\u5C1A\u672A\u6838\u5B9E\u3002\u91C7\u7528\u524D\u4F1A\u68C0\u67E5\u662F\u5426\u4E0E\u5019\u9009\u6539\u52A8\u91CD\u53E0\uFF1B\u8BF7\u5148\u67E5\u770B\u8FD9\u4E9B\u6587\u4EF6\u3002")), comparison && (run.state === "adopted" ? /* @__PURE__ */ import_react.default.createElement("details", { className: "ac-banner" }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u5DF2\u9009 ", pick, " \xB7 \u67E5\u770B\u6BD4\u8F83\u4E0E\u9009\u62E9\u8BB0\u5F55"), comparison) : /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-banner" }, comparison)), a && /* @__PURE__ */ import_react.default.createElement("div", { className: `ac-banner${bad ? " err" : a.state === "needs-attention" ? " warn" : ""}` }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("span", { className: `ac-pill ${a.state === "adopted" ? "ok" : bad ? "err" : a.state === "needs-attention" ? "warn" : ""}` }, { rehearsing: "\u9884\u6F14\u4E2D", blocked: "\u672A\u5199\u5165", writing: "\u5199\u5165\u4E2D", reverting: "\u6062\u590D\u4E2D", adopted: a.mode === "branch" ? "\u5DF2\u5EFA\u5206\u652F" : "\u5DF2\u91C7\u7528", "needs-attention": "\u5DF2\u91C7\u7528 \xB7 \u8BF7\u67E5\u770B", "rolled-back": "\u5DF2\u6062\u590D", "needs-recovery": "\u9700\u8981\u5904\u7406", reverted: "\u5DF2\u64A4\u9500" }[a.state] ?? a.state), " ", /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "var(--ac-fg2)" } }, a.message)), a.rehearsalChecks && /* @__PURE__ */ import_react.default.createElement(Checks, { checks: a.rehearsalChecks }), a.attention && a.attention.length > 0 && /* @__PURE__ */ import_react.default.createElement("code", null, a.attention.slice(0, 12).join("\u3001")), a.retainedDirectory || a.retainedDirectories?.length ? /* @__PURE__ */ import_react.default.createElement("details", null, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u67E5\u770B\u4FDD\u7559\u5185\u5BB9\u7684\u4F4D\u7F6E"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u539F\u59CB\u6587\u4EF6\u4E0E\u4EA4\u63A5\u8BB0\u5F55\u4FDD\u5B58\u5728\u4E0B\u9762\u7684\u76EE\u5F55\u4E2D\uFF0C\u4E0D\u968F\u9884\u89C8\u6E05\u7406\u3002\u53D1\u751F\u51B2\u7A81\u65F6\uFF0C\u8BF7\u5148\u6838\u5BF9\u5F53\u524D\u6587\u4EF6\u548C\u4FDD\u7559\u5185\u5BB9\uFF0C\u518D\u51B3\u5B9A\u5982\u4F55\u5408\u5E76\u3002"), [a.retainedDirectory, ...a.retainedDirectories ?? []].filter(Boolean).map((directory) => /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-project-path", key: directory }, /* @__PURE__ */ import_react.default.createElement("code", null, directory)))) : null));
}
function RunView({ runId, sessionId, initial, compact, onDone, onExpand, onCollapse }) {
  const [run, setRun] = (0, import_react.useState)(initial);
  const [err, setErr] = (0, import_react.useState)();
  const [readErr, setReadErr] = (0, import_react.useState)();
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [pending, setPending] = (0, import_react.useState)();
  const activeId = (0, import_react.useRef)(runId);
  activeId.current = runId;
  const mounted = (0, import_react.useRef)(true);
  const reads = (0, import_react.useRef)({ version: 0, pending: false });
  const action = (0, import_react.useRef)({ version: 0, pending: false });
  const [device, setDevice] = (0, import_react.useState)("adaptive");
  const [layout, setLayout] = (0, import_react.useState)("side");
  const [preflight, setPreflight] = (0, import_react.useState)();
  const publish = (0, import_react.useCallback)((next, expectedId) => {
    if (!mounted.current || activeId.current !== expectedId || next.runId !== expectedId) return;
    setRun((previous) => previous?.runId === next.runId && typeof previous.rev === "number" && typeof next.rev === "number" && Number.isSafeInteger(previous.rev) && Number.isSafeInteger(next.rev) && previous.rev > next.rev ? previous : next);
  }, []);
  const refresh = (0, import_react.useCallback)(async (force = false) => {
    if (!force && reads.current.pending && !reads.current.controller?.signal.aborted) return;
    const version = ++reads.current.version, controller = new AbortController();
    reads.current.controller?.abort();
    reads.current.controller = controller;
    reads.current.pending = true;
    const current = () => mounted.current && activeId.current === runId && version === reads.current.version && !controller.signal.aborted;
    try {
      const next = await call("get", { runId }, controller.signal);
      if (!current()) return;
      if (!next || next.runId !== runId) throw new Error("\u6536\u5230\u7684\u8BB0\u5F55\u4E0E\u5F53\u524D\u6BD4\u8F83\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5");
      publish(next, runId);
      setReadErr(void 0);
    } catch (error) {
      if (current()) setReadErr(error.message);
    } finally {
      if (version === reads.current.version) reads.current.pending = false;
    }
  }, [runId, publish]);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    action.current.version++;
    action.current.pending = false;
    setBusy(false);
    setPending(void 0);
    setErr(void 0);
    setReadErr(void 0);
    setPreflight(void 0);
    setRun((previous) => previous?.runId === runId ? previous : initial?.runId === runId ? initial : void 0);
    void refresh(true);
    return () => {
      mounted.current = false;
      reads.current.version++;
      reads.current.controller?.abort();
      action.current.version++;
    };
  }, [runId, refresh]);
  const live = run !== void 0 && (busy || run.control?.retryable === true || LIVE_POLL.has(run.state) || run.candidates.some((c) => busyStage(c.stage)));
  (0, import_react.useEffect)(() => {
    const t = setInterval(() => {
      void refresh();
    }, live ? 1500 : 6e3);
    return () => clearInterval(t);
  }, [live, refresh]);
  useTick(run?.state === "running");
  const act = (method, extra = {}) => {
    if (!run || run.runId !== runId || action.current.pending) return;
    if (run?.control?.allowed === false) {
      setErr(run.control.reason ?? "\u5F53\u524D\u4EC5\u53EF\u67E5\u770B\u8FD9\u6B21\u6BD4\u8F83");
      return;
    }
    const version = ++action.current.version, targetId = runId;
    action.current.pending = true;
    reads.current.version++;
    reads.current.controller?.abort();
    const current = () => mounted.current && activeId.current === targetId && action.current.version === version;
    const failed = (error) => {
      if (current()) setErr(error.message);
    };
    const finished = () => {
      if (current()) {
        action.current.pending = false;
        setBusy(false);
        setPending(void 0);
        void refresh(true);
      }
    };
    setBusy(true);
    setPending(method);
    setErr(void 0);
    if (method === "reviewAdoption") {
      call("preflight", { runId }).then((value) => {
        if (current()) setPreflight(value.protectedWorktreeApply === true ? value : { ...value, ok: false, reasons: ["\u63D2\u4EF6\u670D\u52A1\u5C1A\u672A\u542F\u7528\u6587\u4EF6\u4EA4\u63A5\u4FDD\u62A4\u3002\u8BF7\u91CD\u542F DSH \u540E\u91CD\u65B0\u5BA1\u67E5\uFF1B\u4E5F\u53EF\u4EE5\u5148\u53E6\u5B58\u4E3A\u5206\u652F\u3002"] });
      }, failed).finally(finished);
      return;
    }
    setPreflight(void 0);
    call(method, { runId, ...extra }).then((r) => {
      if (current() && r && typeof r === "object" && "runId" in r) publish(r, targetId);
    }, failed).finally(finished);
  };
  if (run === void 0 || run.runId !== runId) return /* @__PURE__ */ import_react.default.createElement("div", { className: compact ? "ac-inline-note" : "ac-empty" }, err ?? readErr ?? "\u6B63\u5728\u8BFB\u53D6\u8FD9\u6B21\u6BD4\u8F83\u2026");
  const blocked = busy || run.control?.allowed === false;
  const revealed = REVEALED.has(run.state) || run.choice !== void 0;
  const continueConversation = sessionId ? () => {
    if (!leaveMode(sessionId)) {
      setErr("\u6D88\u606F\u6B63\u5728\u63D0\u4EA4\uFF0C\u8BF7\u7B49\u5B83\u7ED3\u675F\u540E\u7EE7\u7EED\u5BF9\u8BDD\u3002");
      return;
    }
    const mode = modeFor(sessionId);
    saveMode(sessionId, { ...mode.preferences, enabled: false });
    returnToComposer(sessionId);
  } : void 0;
  const previewHosts = run.candidates.filter((c) => c.previewUrl).map((c) => {
    try {
      return new URL(c.previewUrl).hostname;
    } catch {
      return "";
    }
  });
  const independentHosts = previewHosts.length > 0 && previewHosts.every((host) => /^ac-[0-9a-f]{32}\.localhost$/.test(host)) && new Set(previewHosts).size === previewHosts.length;
  const body = /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, (err || readErr) && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-error", role: "alert", style: { marginTop: 12 } }, err ?? readErr), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-action-dock" }, /* @__PURE__ */ import_react.default.createElement(ActionBar, { run, busy, pending, act, ...onDone ? { onDone } : {}, ...continueConversation ? { onContinue: continueConversation } : {} })), !!run.leftovers?.length && /* @__PURE__ */ import_react.default.createElement("section", { className: "ac-banner warn", role: "status", "aria-label": "\u8D44\u6E90\u6E05\u7406\u72B6\u6001" }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("b", null, run.state === "adopted" ? "\u91C7\u7528\u5DF2\u5B8C\u6210\uFF0C\u4ECD\u6709\u8D44\u6E90\u7B49\u5F85\u6E05\u7406" : "\u4ECD\u6709\u8D44\u6E90\u7B49\u5F85\u6E05\u7406"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u53EF\u4EE5\u91CD\u8BD5\u6E05\u7406\u3002\u6E05\u7406\u53EA\u5904\u7406\u672C\u6B21\u6BD4\u8F83\u62E5\u6709\u7684\u8D44\u6E90\u3002"), /* @__PURE__ */ import_react.default.createElement("ul", null, run.leftovers.map((detail, index) => /* @__PURE__ */ import_react.default.createElement("li", { key: index }, detail))), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: blocked, onClick: () => act("cleanup") }, "\u91CD\u8BD5\u6E05\u7406"))), preflight && /* @__PURE__ */ import_react.default.createElement("section", { className: "ac-review", "aria-label": "\u91C7\u7528\u524D\u5BA1\u67E5", role: "region" }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("b", null, preflight.ok ? "\u76EE\u6807\u6838\u9A8C\u901A\u8FC7\uFF0C\u8BF7\u786E\u8BA4\u91C7\u7528" : "\u5F53\u524D\u65E0\u6CD5\u91C7\u7528"), /* @__PURE__ */ import_react.default.createElement("p", { className: "ac-project-path" }, "\u76EE\u6807\uFF1A", run.baseline.repoRoot ?? "\u672C\u6B21\u6BD4\u8F83\u7684\u9879\u76EE"), /* @__PURE__ */ import_react.default.createElement("p", null, preflight.ok ? preflight.rehearsal ? "\u9879\u76EE\u6709\u65B0\u6539\u52A8\uFF0C\u5C06\u5148\u5408\u5E76\u5230\u4E34\u65F6\u526F\u672C\u4E2D\u91CD\u65B0\u9A8C\u6536\u3002" : "\u5C06\u5199\u5165\u9009\u4E2D\u7248\u672C\uFF1B\u4E0D\u81EA\u52A8\u63D0\u4EA4\uFF0C\u4FDD\u7559\u6682\u5B58\u72B6\u6001\u3002" : preflight.reasons.join("\uFF1B")), preflight.ok && /* @__PURE__ */ import_react.default.createElement("p", null, "\u5148\u4FDD\u7559\u539F\u59CB\u6587\u4EF6\uFF0C\u518D\u4EA4\u63A5\u5019\u9009\u3002\u4EA4\u63A5\u65F6\u51FA\u73B0\u65B0\u7F16\u8F91\u4F1A\u505C\u6B62\u5E76\u4FDD\u7559\u53CC\u65B9\u5185\u5BB9\uFF1B\u8BF7\u7B49\u64CD\u4F5C\u5B8C\u6210\u540E\u518D\u7EE7\u7EED\u7F16\u8F91\u6D89\u53CA\u7684\u6587\u4EF6\u3002"), preflight.overlapping?.length ? /* @__PURE__ */ import_react.default.createElement("code", null, preflight.overlapping.join("\u3001")) : null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-row" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", onClick: () => setPreflight(void 0) }, "\u8FD4\u56DE\u5BA1\u67E5"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary", disabled: blocked || !preflight.ok, onClick: () => act("adopt", { mode: "worktree" }) }, "\u786E\u8BA4\u91C7\u7528 ", run.choice?.pick))), /* @__PURE__ */ import_react.default.createElement(Banners, { run }), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-compare-tools" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-seg", "aria-label": "\u6BD4\u8F83\u5E03\u5C40" }, ["side", "A", "B"].map((v) => /* @__PURE__ */ import_react.default.createElement("button", { key: v, className: layout === v ? "on" : "", "aria-pressed": layout === v, onClick: () => setLayout(v) }, { side: "\u5E76\u6392\u6BD4\u8F83", A: "\u4E13\u6CE8 A", B: "\u4E13\u6CE8 B" }[v]))), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-seg", "aria-label": "\u9884\u89C8\u5C3A\u5BF8" }, /* @__PURE__ */ import_react.default.createElement("button", { className: device === "adaptive" ? "on" : "", "aria-pressed": device === "adaptive", onClick: () => setDevice("adaptive") }, "\u9002\u5E94\u7A97\u53E3"), /* @__PURE__ */ import_react.default.createElement("button", { className: device === "desktop" ? "on" : "", "aria-pressed": device === "desktop", onClick: () => setDevice("desktop") }, "\u684C\u9762 1280"), /* @__PURE__ */ import_react.default.createElement("button", { className: device === "phone" ? "on" : "", "aria-pressed": device === "phone", onClick: () => setDevice("phone") }, "\u624B\u673A 390")), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, device === "adaptive" ? "\u76F4\u63A5\u5728\u5BF9\u8BDD\u4E2D\u64CD\u4F5C\u771F\u5B9E\u9875\u9762" : "\u76F8\u540C\u89C6\u53E3 \xB7 \u6309\u53EF\u7528\u5BBD\u5EA6\u7F29\u653E")), previewHosts.length > 0 && /* @__PURE__ */ import_react.default.createElement("details", { className: "ac-preview-limits" }, /* @__PURE__ */ import_react.default.createElement("summary", null, "\u9884\u89C8\u73AF\u5883\u4E0E\u9650\u5236"), /* @__PURE__ */ import_react.default.createElement("p", null, independentHosts ? "\u5019\u9009\u4F7F\u7528\u72EC\u7ACB\u672C\u5730\u5730\u5740\uFF0C\u907F\u514D\u540C\u540D Cookie \u76F8\u4E92\u5F71\u54CD\u3002" : "\u8FD9\u6761\u65E7\u8BB0\u5F55\u7684\u9884\u89C8\u6CA1\u6709\u72EC\u7ACB\u672C\u5730\u57DF\u540D\uFF0C\u4E24\u4E2A\u7AEF\u53E3\u7684 Cookie \u53EF\u80FD\u76F8\u4E92\u5F71\u54CD\uFF1B\u5EFA\u8BAE\u4F7F\u7528\u5F53\u524D\u7248\u672C\u91CD\u65B0\u5F00\u59CB\u6BD4\u8F83\u3002", "\u5D4C\u5165\u9875\u9762\u4ECD\u53D7\u6D4F\u89C8\u5668\u7684 Cookie \u4E0E\u5B58\u50A8\u7B56\u7565\u9650\u5236\uFF1B\u767B\u5F55\u3001\u5916\u90E8\u540E\u7AEF\u548C\u5171\u4EAB\u6570\u636E\u5E93\u6682\u4E0D\u5728\u652F\u6301\u8303\u56F4\u5185\u3002\u91CD\u65B0\u542F\u52A8\u9884\u89C8\u4F1A\u66F4\u6362\u6D4F\u89C8\u5668\u5730\u5740\uFF0C\u9875\u9762\u5185\u4E34\u65F6\u6570\u636E\u4E0D\u4FDD\u7559\uFF1B\u6BD4\u8F83\u8BB0\u5F55\u548C\u9A8C\u6536\u622A\u56FE\u4ECD\u4FDD\u7559\u3002\u5916\u90E8\u6807\u7B7E\u9875\u53EF\u80FD\u4F7F\u7528\u4E0D\u540C\u7684\u5B58\u50A8\u4E0A\u4E0B\u6587\u3002")), /* @__PURE__ */ import_react.default.createElement("div", { className: `ac-grid${layout !== "side" ? " focus" : ""}` }, run.candidates.map((c) => /* @__PURE__ */ import_react.default.createElement(CandidateCard, { key: c.label, run, c, revealed, picked: revealed && run.choice?.pick === c.label, busy: blocked, act, device, compact: compact === true, hidden: layout !== "side" && layout !== c.label }))));
  if (!compact) return body;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root ac-inline", "aria-label": `A|B \u6BD4\u8F83 ${run.runId}` }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-inline-head" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-logo" }, "A|B"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-task", title: run.task }, run.task), /* @__PURE__ */ import_react.default.createElement("span", { className: `ac-pill ${run.state === "adopted" ? "ok" : ACTIVE.has(run.state) ? "brand" : ""}` }, STATE_TEXT[run.state] ?? run.state), onExpand && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn sm", onClick: onExpand }, "\u5927\u7A97\u53E3\u67E5\u770B"), onCollapse && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: onCollapse }, "\u6536\u8D77\u7ED3\u679C")), body);
}
var runIdIn = (text) => /运行 ([0-9a-f]{8})/.exec(text ?? "")?.[1] ?? /"runId"\s*:\s*"([0-9a-f]{8})"/.exec(text ?? "")?.[1];
function CommandView({ node, sessionId }) {
  const runId = runIdIn(node.outcome?.text);
  let task = node.args?.trim() ?? "";
  if (task.startsWith("@ui ")) {
    try {
      task = JSON.parse(task.slice(4)).task ?? "\u793A\u4F8B\u4EFB\u52A1";
    } catch {
      task = "";
    }
  }
  if (node.outcome === null) return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root ac-inline" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-inline-note" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spin", style: { display: "inline-block", marginRight: 8 } }), "\u6B63\u5728\u51C6\u5907 A|B \u6BD4\u8F83\uFF1A", task.slice(0, 400)));
  if (node.outcome.kind !== "success" || runId === void 0) {
    return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root ac-inline" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-fail", style: { height: "auto" } }, /* @__PURE__ */ import_react.default.createElement("b", null, "A|B \u6BD4\u8F83\u6CA1\u6709\u5F00\u59CB"), node.outcome.text ?? ""));
  }
  return /* @__PURE__ */ import_react.default.createElement(RunView, { runId, compact: true, ...sessionId ? { sessionId, onExpand: () => setOpen(sessionId, runId) } : {} });
}
function ToolView(props) {
  const fromResult = runIdFromToolResult(props.block, props.phase);
  const key = JSON.stringify([props.sessionId, props.callId]);
  const [binding, setBinding] = (0, import_react.useState)();
  (0, import_react.useEffect)(() => {
    if (fromResult !== void 0 || !props.sessionId || !props.callId || props.phase === "result") return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      call("list", { sessionId: props.sessionId }).then((list) => {
        const run = list.runs.find((record) => record.origin?.kind === "tool" && record.origin.id === props.callId);
        if (active && run) setBinding({ key, runId: run.runId });
      }, () => {
      });
    };
    refresh();
    const timer = setInterval(refresh, 5e3);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fromResult, props.sessionId, props.callId, props.phase, key]);
  const found = fromResult ?? (binding?.key === key ? binding.runId : void 0);
  if (found === void 0) return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root ac-inline" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-inline-note" }, props.phase === "result" ? "A|B \u6BD4\u8F83\u672A\u53D6\u5F97\u8FD0\u884C\u7F16\u53F7\uFF0C\u8BF7\u67E5\u770B\u6B64\u5DE5\u5177\u7684\u8FD4\u56DE\u7ED3\u679C\u3002" : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spin", style: { display: "inline-block", marginRight: 8 } }), "\u6B63\u5728\u51C6\u5907 A|B \u6BD4\u8F83\u2026")));
  const sid = props.sessionId;
  return /* @__PURE__ */ import_react.default.createElement(RunView, { key: found, runId: found, compact: true, ...sid ? { sessionId: sid, onExpand: () => setOpen(sid, found) } : {} });
}
function AbModeButton({ sessionId }) {
  const mode = useAbMode(sessionId);
  const state = inputSnapshot(sessionId);
  const enabled = mode.preferences.enabled || state?.claim?.name === "ab";
  const capabilityError = clientSupportMessage(sessionId);
  const toggle = () => {
    if (!mode.loaded) {
      void loadMode(sessionId);
      return;
    }
    const applied = enabled ? leaveMode(sessionId) : enterMode(sessionId);
    if (!applied) {
      mode.error = clientSupportMessage(sessionId) ?? "\u8F93\u5165\u6846\u6B63\u5728\u63D0\u4EA4\u6216\u5DF2\u6709\u5176\u4ED6\u547D\u4EE4\u6A21\u5F0F\uFF0C\u8BF7\u7B49\u5B83\u7ED3\u675F\u540E\u518D\u5207\u6362\u3002";
      publishMode(mode);
      return;
    }
    mode.collapsed = false;
    saveMode(sessionId, { ...mode.preferences, enabled: !enabled });
    inputShell(sessionId)?.focus?.();
  };
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("button", { className: `ac-mode-btn${enabled ? " on" : ""}`, onClick: toggle, disabled: mode.loading || !!capabilityError, "aria-pressed": enabled, title: capabilityError ?? (enabled ? "A|B \u5BF9\u6BD4\u6A21\u5F0F\u5DF2\u5F00\u542F\uFF0C\u70B9\u6B64\u9000\u51FA" : "\u5F00\u542F A|B \u5BF9\u6BD4\u6A21\u5F0F\uFF0C\u5728\u4E3B\u5BF9\u8BDD\u91CC\u8FD0\u884C\u4E24\u7248"), "aria-label": "A|B \u5BF9\u6BD4\u6A21\u5F0F" }, "A|B"));
}
function History({ data, open, busy, failed, scope, query, onScope, onSearch, onPage, onlyUnavailable, problemSupported, onUnavailable }) {
  const [draft, setDraft] = (0, import_react.useState)(query);
  const region = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => setDraft(query), [query]);
  const meta = data?.history, outdated = data !== void 0 && meta?.version !== 1;
  const rows = [...data?.runs ?? [], ...data?.legacy ?? []].sort((a, b) => b.createdAt - a.createdAt || (a.runId === b.runId ? 0 : a.runId < b.runId ? 1 : -1));
  return /* @__PURE__ */ import_react.default.createElement("section", { ref: region, className: "ac-history", "aria-label": "\u6BD4\u8F83\u8BB0\u5F55\u5217\u8868", "aria-busy": busy, tabIndex: -1 }, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-history-controls" }, /* @__PURE__ */ import_react.default.createElement("label", null, "\u8BB0\u5F55\u8303\u56F4", /* @__PURE__ */ import_react.default.createElement("select", { "aria-label": "\u8BB0\u5F55\u8303\u56F4", value: scope, disabled: outdated, onChange: (event) => onScope(event.target.value) }, /* @__PURE__ */ import_react.default.createElement("option", { value: "all" }, "\u5168\u90E8\u5BF9\u8BDD"), /* @__PURE__ */ import_react.default.createElement("option", { value: "session" }, "\u5F53\u524D\u5BF9\u8BDD"))), /* @__PURE__ */ import_react.default.createElement("form", { className: "ac-history-search", role: "search", onSubmit: (event) => {
    event.preventDefault();
    onSearch(draft);
  } }, /* @__PURE__ */ import_react.default.createElement("label", null, "\u67E5\u627E\u8BB0\u5F55", /* @__PURE__ */ import_react.default.createElement("input", { type: "search", "aria-label": "\u641C\u7D22\u6BD4\u8F83\u8BB0\u5F55", placeholder: "\u9700\u6C42\u3001\u9879\u76EE\u6216\u8FD0\u884C\u7F16\u53F7", maxLength: 200, value: draft, disabled: outdated, onChange: (event) => setDraft(event.target.value) })), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", type: "submit", disabled: outdated }, "\u641C\u7D22"), (query || draft) && /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", type: "button", disabled: outdated, onClick: () => {
    setDraft("");
    onSearch("");
  } }, "\u6E05\u7A7A\u641C\u7D22"))), problemSupported && /* @__PURE__ */ import_react.default.createElement("label", { className: "ac-history-issue-filter" }, /* @__PURE__ */ import_react.default.createElement("input", { type: "checkbox", checked: onlyUnavailable, onChange: (event) => onUnavailable(event.target.checked) }), "\u53EA\u770B\u9700\u5904\u7406"), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-history-status", role: "status" }, busy ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spin" }), "\u6B63\u5728\u8BFB\u53D6\u8BB0\u5F55\u2026") : failed ? "\u8BB0\u5F55\u8BFB\u53D6\u5931\u8D25\uFF0C\u539F\u59CB\u6587\u4EF6\u4ECD\u4FDD\u7559\u3002" : meta ? `${scope === "all" ? "\u5168\u90E8\u5BF9\u8BDD" : "\u5F53\u524D\u5BF9\u8BDD"} \xB7 ${meta.total} \u6761${meta.query ? ` \xB7 \u641C\u7D22\u201C${meta.query}\u201D` : ""}` : "\u5DF2\u8BFB\u53D6\u5F53\u524D\u670D\u52A1\u7AEF\u63D0\u4F9B\u7684\u8BB0\u5F55"), outdated && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "alert" }, "\u670D\u52A1\u7AEF\u5C1A\u672A\u66F4\u65B0\u3002\u8BF7\u91CD\u542F DSH \u540E\u4F7F\u7528\u5168\u90E8\u5BF9\u8BDD\u3001\u641C\u7D22\u4E0E\u7FFB\u9875\uFF1B\u4EE5\u4E0B\u4ECD\u662F\u65E7\u670D\u52A1\u7AEF\u8FD4\u56DE\u7684\u8BB0\u5F55\u3002"), !!meta?.unavailable && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "alert" }, "\u6709 ", meta.unavailable, " \u6761\u8BB0\u5F55\u65E0\u6CD5\u5B89\u5168\u8F7D\u5165\u3002\u8FD9\u4E9B\u8BB0\u5F55\u4FDD\u6301\u53EA\u8BFB\uFF0C\u539F\u59CB\u6587\u4EF6\u5DF2\u4FDD\u7559\uFF1B\u53EF\u52FE\u9009\u201C\u53EA\u770B\u9700\u5904\u7406\u201D\u67E5\u770B\u539F\u56E0\u3002"), !busy && !failed && rows.length === 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-empty" }, query ? "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5F55\u3002\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u6E05\u7A7A\u641C\u7D22\u67E5\u770B\u5DF2\u6709\u6BD4\u8F83\u3002" : onlyUnavailable ? "\u6CA1\u6709\u9700\u5904\u7406\u7684\u8BB0\u5F55\u3002\u53D6\u6D88\u7B5B\u9009\u53EF\u4EE5\u67E5\u770B\u5176\u5B83\u6BD4\u8F83\u3002" : scope === "session" ? "\u5F53\u524D\u5BF9\u8BDD\u8FD8\u6CA1\u6709\u6BD4\u8F83\u3002\u5207\u6362\u5230\u201C\u5168\u90E8\u5BF9\u8BDD\u201D\u53EF\u4EE5\u67E5\u770B\u4EE5\u524D\u7684\u7ED3\u679C\u3002" : "\u8FD8\u6CA1\u6709\u6BD4\u8F83\u8BB0\u5F55\u3002\u70B9\u8F93\u5165\u6846\u5DE6\u4E0B\u89D2\u7684 A|B\uFF0C\u5728\u4E3B\u5BF9\u8BDD\u91CC\u5F00\u59CB\u7B2C\u4E00\u6B21\u771F\u5B9E\u6BD4\u8F83\u3002"), rows.map((r) => "legacy" in r ? /* @__PURE__ */ import_react.default.createElement("div", { key: r.runId, className: `ac-hrow legacy${r.unavailable ? " ac-hrow-unavailable" : ""}`, title: r.unavailable ? "\u65E0\u6CD5\u5B89\u5168\u8F7D\u5165\uFF0C\u539F\u59CB\u8BB0\u5F55\u4FDD\u7559" : "\u65E7\u7248\u672C\u8BB0\u5F55\u53EA\u8BFB\uFF0C\u539F\u59CB\u6587\u4EF6\u4FDD\u7559" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-pill" }, r.unavailable ? "\u9700\u5904\u7406" : "\u65E7\u7248"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-hrow-copy" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "t" }, r.task), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, r.runId, " \xB7 \u53EA\u8BFB"), r.reason && /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-history-problem" }, r.reason)), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, r.createdAt > 0 ? when(r.createdAt) : "\u65F6\u95F4\u672A\u77E5")) : /* @__PURE__ */ import_react.default.createElement("button", { key: r.runId, className: "ac-hrow", onClick: () => open(r) }, /* @__PURE__ */ import_react.default.createElement("span", { className: `ac-pill ${r.state === "adopted" ? "ok" : ACTIVE.has(r.state) ? "brand" : ""}` }, STATE_TEXT[r.state] ?? r.state), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-hrow-copy" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "t", title: r.task }, r.task), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta", title: r.baseline.repoRoot }, r.baseline.repoRoot?.split(/[\\/]/).filter(Boolean).at(-1) ?? "\u9879\u76EE\u672A\u77E5", " \xB7 ", r.runId)), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, r.choice?.pick && r.choice.pick !== "none" ? `\u9009\u4E86 ${r.choice.pick} \xB7 ` : "", when(r.createdAt)))), meta && meta.total > 0 && /* @__PURE__ */ import_react.default.createElement("nav", { className: "ac-history-pages", "aria-label": "\u8BB0\u5F55\u7FFB\u9875" }, /* @__PURE__ */ import_react.default.createElement("span", null, meta.offset + 1, "\u2013", Math.min(meta.offset + meta.limit, meta.total), " / ", meta.total, " \u6761"), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-row" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy || meta.offset === 0, onClick: () => {
    region.current?.focus();
    region.current?.scrollIntoView({ block: "start" });
    onPage(Math.max(0, meta.offset - meta.limit));
  } }, "\u4E0A\u4E00\u9875"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", disabled: busy || !meta.hasNext, onClick: () => {
    region.current?.focus();
    region.current?.scrollIntoView({ block: "start" });
    onPage(meta.offset + meta.limit);
  } }, "\u4E0B\u4E00\u9875"))));
}
function Guide({ sessionId }) {
  const mode = useAbMode(sessionId);
  const [error, setError] = (0, import_react.useState)();
  const [busy, setBusy] = (0, import_react.useState)(false);
  const example = async () => {
    setBusy(true);
    setError(void 0);
    try {
      const result = await executeComparison(sessionId, "", true);
      if (result.kind === "success") setOpen(void 0);
      else setError(result.text ?? "\u793A\u4F8B\u672A\u80FD\u5F00\u59CB");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-guide" }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-eyebrow" }, "\u4ECE\u6BD4\u8F83\u5230\u4EA4\u4ED8"), /* @__PURE__ */ import_react.default.createElement("h2", { className: "ac-h1" }, "\u4F53\u9A8C\u771F\u5B9E\u7ED3\u679C\uFF0C\u505A\u51FA\u5F00\u53D1\u51B3\u7B56\u3002"), /* @__PURE__ */ import_react.default.createElement("p", { className: "ac-lead" }, "\u9002\u5408\u5B58\u5728\u591A\u79CD\u53EF\u884C\u65B9\u6848\u7684\u754C\u9762\u3001\u5E03\u5C40\u4E0E\u4EA4\u4E92\u4EFB\u52A1\u3002\u5DF2\u6709\u660E\u786E\u7B54\u6848\u7684\u5C0F\u4FEE\u590D\u901A\u5E38\u7528\u4E00\u4E2A Agent \u66F4\u76F4\u63A5\u3002")), /* @__PURE__ */ import_react.default.createElement("ol", { className: "ac-guide-steps" }, /* @__PURE__ */ import_react.default.createElement("li", null, /* @__PURE__ */ import_react.default.createElement("b", null, "\u5728\u4E3B\u5BF9\u8BDD\u91CC\u5F00\u542F A|B"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u70B9\u8F93\u5165\u6846\u5DE6\u4E0B\u89D2\u7684 A|B\uFF0C\u4E0A\u65B9\u5373\u51FA\u73B0\u8BBE\u7F6E\u6761\u3002\u76F4\u63A5\u9009\u62E9\u6BD4\u8F83\u65B9\u5F0F\u3001\u6A21\u578B\u548C\u6BCF\u7248\u65F6\u957F\uFF1B\u5728\u539F\u8F93\u5165\u6846\u91CC\u5199\u9700\u6C42\u5E76\u53D1\u9001\uFF0C\u4E0D\u7528\u586B\u5199\u53C2\u6570\u3002")), /* @__PURE__ */ import_react.default.createElement("li", null, /* @__PURE__ */ import_react.default.createElement("b", null, "\u4F53\u9A8C\u4E24\u7248"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u72EC\u7ACB\u751F\u6210\u540E\u8FD0\u884C\u5B89\u88C5\u3001\u68C0\u67E5\u4E0E\u6784\u5EFA\u3002\u684C\u9762\u548C\u624B\u673A\u9884\u89C8\u4F7F\u7528\u7EDF\u4E00\u5C3A\u5BF8\uFF0C\u53EF\u4EE5\u5E76\u6392\u89C2\u5BDF\u6216\u4E13\u6CE8\u4F53\u9A8C\u5176\u4E2D\u4E00\u7248\u3002")), /* @__PURE__ */ import_react.default.createElement("li", null, /* @__PURE__ */ import_react.default.createElement("b", null, "\u9009\u62E9\u5E76\u5BA1\u67E5"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u9009\u62E9\u540E\u63ED\u6653\u6A21\u578B\u548C\u7B56\u7565\u3002\u67E5\u770B\u4EE3\u7801\u6539\u52A8\u3001\u7A0B\u5E8F\u68C0\u67E5\u4E0E\u672A\u9A8C\u8BC1\u7684\u90E8\u5206\uFF1B\u4E00\u6B21\u504F\u597D\u9009\u62E9\u4E0D\u4EE3\u8868\u6A21\u578B\u7684\u6574\u4F53\u6392\u540D\u3002")), /* @__PURE__ */ import_react.default.createElement("li", null, /* @__PURE__ */ import_react.default.createElement("b", null, "\u91C7\u7528\u7ED3\u679C"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u91C7\u7528\u524D\u68C0\u67E5\u76EE\u6807\u662F\u5426\u53D8\u5316\uFF1B\u5FC5\u8981\u65F6\u5728\u4E34\u65F6\u526F\u672C\u4E2D\u9884\u6F14\u3002\u5DE5\u4F5C\u533A\u91C7\u7528\u4E0D\u81EA\u52A8\u63D0\u4EA4\uFF1B\u53E6\u5B58\u5206\u652F\u4F1A\u660E\u786E\u521B\u5EFA\u4E00\u4E2A\u63D0\u4EA4\u3002"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-case" }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("b", null, "\u8BD5\u8DD1\u771F\u5B9E\u7684\u793A\u4F8B\u5546\u5E97"), /* @__PURE__ */ import_react.default.createElement("span", null, "\u65B0\u5EFA\u72EC\u7ACB\u4ED3\u5E93\uFF0C\u5B9E\u9645\u5B9E\u73B0\u641C\u7D22\u3001\u7EC4\u5408\u7B5B\u9009\u3001\u6E05\u7A7A\u548C\u624B\u673A\u9002\u914D\u3002\u4EFB\u52A1\u3001\u7ED3\u679C\u548C\u9009\u62E9\u90FD\u663E\u793A\u5728\u4E3B\u5BF9\u8BDD\u91CC\u3002")), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn primary", disabled: busy || !mode.loaded, onClick: () => {
    void example();
  } }, busy ? "\u6B63\u5728\u521B\u5EFA\u2026" : "\u8BD5\u8DD1\u5185\u7F6E\u793A\u4F8B")), error && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-feedback", role: "alert" }, error), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-btn", onClick: () => {
    mode.collapsed = false;
    if (enterMode(sessionId)) saveMode(sessionId, { ...modeFor(sessionId).preferences, enabled: true });
    returnToComposer(sessionId);
  } }, "\u56DE\u5230\u8F93\u5165\u6846\uFF0C\u5F00\u542F A|B"), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-note" }, "\u652F\u6301\u8303\u56F4\uFF1A\u4ED3\u5E93\u6839\u76EE\u5F55\u4E2D\u7684\u672C\u5730 Vite \u524D\u7AEF\u3002\u9875\u9762\u68C0\u67E5\u901A\u8FC7\u53EA\u4EE3\u8868\u914D\u7F6E\u7684\u6B65\u9AA4\u901A\u8FC7\uFF0C\u4ECD\u9700\u5B9E\u9645\u4F53\u9A8C\u9700\u6C42\u548C\u8FB9\u754C\u60C5\u51B5\u3002"));
}
function Sheet({ sessionId, runId, tab }) {
  const [view, setView] = (0, import_react.useState)(runId ? "history" : tab ?? "history");
  const [selected, setSelected] = (0, import_react.useState)(runId);
  const [list, setList] = (0, import_react.useState)();
  const [err, setErr] = (0, import_react.useState)();
  const [historyScope, setHistoryScope] = (0, import_react.useState)("all");
  const [historyQuery, setHistoryQuery] = (0, import_react.useState)("");
  const [historyOffset, setHistoryOffset] = (0, import_react.useState)(0);
  const [historyBusy, setHistoryBusy] = (0, import_react.useState)(true);
  const [onlyUnavailable, setOnlyUnavailable] = (0, import_react.useState)(false);
  const [problemSupported, setProblemSupported] = (0, import_react.useState)(false);
  const historyRequest = (0, import_react.useRef)(0);
  const historyAbort = (0, import_react.useRef)(void 0);
  const sheet = (0, import_react.useRef)(null);
  const refreshList = (0, import_react.useCallback)(async (signal) => {
    const request = ++historyRequest.current;
    historyAbort.current?.abort();
    const controller = new AbortController();
    historyAbort.current = controller;
    const active = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    setHistoryBusy(true);
    setErr(void 0);
    setList(void 0);
    try {
      const data = await call("list", { sessionId, scope: historyScope, search: historyQuery, offset: historyOffset, onlyUnavailable }, active);
      if (!active.aborted && request === historyRequest.current) {
        setList(data);
        setProblemSupported(typeof data.history?.onlyUnavailable === "boolean");
      }
    } catch (e) {
      if (!active.aborted && request === historyRequest.current) setErr(e.message);
    } finally {
      if (!active.aborted && request === historyRequest.current) setHistoryBusy(false);
    }
  }, [sessionId, historyScope, historyQuery, historyOffset, onlyUnavailable]);
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    void refreshList(controller.signal);
    return () => controller.abort();
  }, [refreshList]);
  (0, import_react.useEffect)(() => () => {
    historyAbort.current?.abort();
  }, []);
  (0, import_react.useEffect)(() => {
    setSelected(runId);
    setView(runId ? "history" : tab ?? "history");
  }, [runId, tab]);
  (0, import_react.useEffect)(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const element = sheet.current;
    if (!element) return;
    const siblings = [];
    let node = element.parentElement;
    while (node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          siblings.push({ el: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      node = node.parentElement;
      if (node === document.body) break;
    }
    element.focus();
    const focusables = () => Array.from(element.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,iframe,[tabindex="0"]')).filter((el) => el.getClientRects().length > 0 && !el.closest("[hidden]"));
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(void 0);
      }
      if (e.key === "Tab") {
        const items = focusables(), first = items[0], last = items.at(-1);
        if (!first) {
          e.preventDefault();
          element.focus();
        } else if (e.shiftKey && (document.activeElement === first || document.activeElement === element)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onFocus = (e) => {
      if (e.target instanceof Node && !element.contains(e.target)) element.focus();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      for (const item of siblings) item.el.inert = item.inert;
      document.body.style.overflow = previousOverflow;
      const composer = focusComposerOnClose;
      focusComposerOnClose = void 0;
      if (composer) inputShell(composer)?.focus?.();
      else if (previous?.isConnected) previous.focus();
      else (document.querySelector('[aria-label="\u6253\u5F00 AgentCompare \u6BD4\u8F83\u8BB0\u5F55"]') ?? document.querySelector(".ac-mode-btn:not(:disabled)"))?.focus();
    };
  }, []);
  const current = list?.runs.find((r) => r.runId === selected);
  const navigate = (next) => {
    setView(next);
    setSelected(void 0);
    if (next === "history") void refreshList();
  };
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-mask", onClick: () => setOpen(void 0) }), /* @__PURE__ */ import_react.default.createElement("div", { ref: sheet, className: "ac-sheet", role: "dialog", "aria-modal": "true", "aria-label": "AgentCompare", tabIndex: -1 }, /* @__PURE__ */ import_react.default.createElement("header", { className: "ac-head" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-logo" }, "A|B"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-title" }, "AgentCompare"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-header-caption" }, "\u8DD1\u8FC7\u518D\u9009"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-spacer" }), /* @__PURE__ */ import_react.default.createElement("nav", { className: "ac-tabs", "aria-label": "\u6BD4\u8F83\u5DE5\u4F5C\u533A" }, ["history", "guide"].map((item) => /* @__PURE__ */ import_react.default.createElement("button", { key: item, className: `ac-tab${view === item && !selected ? " on" : ""}`, "aria-current": view === item && !selected ? "page" : void 0, onClick: () => navigate(item) }, { history: "\u5386\u53F2\u8BB0\u5F55", guide: "\u4F7F\u7528\u6307\u5357\u4E0E\u6F14\u793A" }[item]))), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-icon-btn", onClick: () => setOpen(void 0), "aria-label": "\u5173\u95ED\uFF08Esc\uFF09", title: "\u5173\u95ED\uFF08Esc\uFF09" }, /* @__PURE__ */ import_react.default.createElement(IconClose, null))), err && /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-error", role: "alert" }, err, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => {
    void refreshList();
  } }, "\u91CD\u8BD5")), /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-body" }, selected ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-run-heading" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-text-btn", onClick: () => navigate("history") }, "\u2190 \u6BD4\u8F83\u8BB0\u5F55"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-task", title: current?.task }, current?.task ?? "\u6BD4\u8F83\u7ED3\u679C"), /* @__PURE__ */ import_react.default.createElement("span", { className: "ac-meta" }, selected)), /* @__PURE__ */ import_react.default.createElement(RunView, { key: selected, runId: selected, sessionId, ...current ? { initial: current } : {}, onDone: () => navigate("history") })) : view === "guide" ? /* @__PURE__ */ import_react.default.createElement(Guide, { sessionId }) : /* @__PURE__ */ import_react.default.createElement(History, { data: list, open: (r) => setSelected(r.runId), busy: historyBusy, failed: err, scope: historyScope, query: historyQuery, onScope: (scope) => {
    setHistoryScope(scope);
    setHistoryOffset(0);
  }, onSearch: (query) => {
    const trimmed = query.trim();
    if (trimmed === historyQuery && historyOffset === 0) void refreshList();
    else {
      setHistoryQuery(trimmed);
      setHistoryOffset(0);
    }
  }, onPage: setHistoryOffset, onlyUnavailable, problemSupported, onUnavailable: (only) => {
    setOnlyUnavailable(only);
    setHistoryOffset(0);
  } }))));
}
function HeaderButton({ sessionId }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "ac-root ac-header-tools", role: "group", "aria-label": "AgentCompare \u5BFC\u822A" }, /* @__PURE__ */ import_react.default.createElement(Styles, null), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-header-btn", title: "AgentCompare\uFF1A\u6BD4\u8F83\u8BB0\u5F55", "aria-label": "\u6253\u5F00 AgentCompare \u6BD4\u8F83\u8BB0\u5F55", onClick: () => setOpen(sessionId) }, "\u6BD4\u8F83\u8BB0\u5F55"), /* @__PURE__ */ import_react.default.createElement("button", { className: "ac-header-btn", title: "AgentCompare\uFF1A\u4F7F\u7528\u6559\u7A0B\u4E0E\u6F14\u793A", "aria-label": "\u6253\u5F00 AgentCompare \u4F7F\u7528\u6559\u7A0B", onClick: () => setOpen(sessionId, void 0, "guide") }, "\u4F7F\u7528\u6559\u7A0B"));
}
function HeroHeader({ sessionId }) {
  const ref = (0, import_react.useRef)(null);
  const [anchored, setAnchored] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    const corner = document.querySelector("[data-conversation-header-corner]");
    const element = ref.current;
    if (!corner || !element) return;
    setAnchored(true);
    const align = () => {
      const rect = corner.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      element.style.setProperty("--ac-header-top", `${Math.max(4, rect.top + (rect.height - 26) / 2)}px`);
      element.style.setProperty("--ac-header-right", `${Math.max(12, innerWidth - rect.left + 8)}px`);
    };
    align();
    const observer = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(align);
    observer?.observe(corner);
    const header = corner.closest("header");
    if (header) observer?.observe(header);
    window.addEventListener("resize", align);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", align);
    };
  }, []);
  return /* @__PURE__ */ import_react.default.createElement("div", { ref, className: "ac-header-tools-hero", hidden: !anchored }, anchored && /* @__PURE__ */ import_react.default.createElement(HeaderButton, { sessionId }));
}
function Overlay() {
  const open = useOpen();
  return open === void 0 ? null : /* @__PURE__ */ import_react.default.createElement(Sheet, { key: open.sessionId, sessionId: open.sessionId, ...open.runId ? { runId: open.runId } : {}, ...open.tab ? { tab: open.tab } : {} });
}
function apply(ctx) {
  clientCtx = ctx;
  const disposers = [];
  const safely = (label, fn) => {
    try {
      disposers.push(fn());
    } catch (error) {
      console.warn(`[dsh-agent-compare] ${label} unavailable:`, error);
    }
  };
  const withSession = (sessionId) => ({ sessionId });
  safely("header button", () => ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "agent-compare",
    order: 30,
    registrant: "dsh-agent-compare",
    inject: withSession
  }, HeaderButton)));
  safely("new conversation navigation", () => ctx.slots.inject("conversation.hero.options", () => ctx.slots.register({
    name: "conversation.hero.options",
    id: "agent-compare-navigation",
    order: 30,
    registrant: "dsh-agent-compare",
    inject: withSession
  }, HeroHeader)));
  safely("composer A|B button", () => ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
    name: "conversation.input.left",
    id: "agent-compare",
    order: 50,
    registrant: "dsh-agent-compare",
    inject: withSession
  }, AbModeButton)));
  safely("composer settings", () => ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
    name: "conversation.input.dock",
    id: "agent-compare-settings",
    order: 10,
    registrant: "dsh-agent-compare",
    inject: withSession
  }, ComposerDock)));
  safely("/ab command view", () => ctx.slots.inject("conversation.chat.commandview", () => ctx.slots.register({
    name: "conversation.chat.commandview",
    key: "ab",
    registrant: "dsh-agent-compare",
    inject: withSession
  }, CommandView)));
  safely("tool view", () => ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
    name: "tool.call.toolview",
    key: "agent_compare_start",
    registrant: "dsh-agent-compare",
    inject: withSession
  }, ToolView)));
  safely("overlay", () => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "agent-compare",
    order: 30,
    registrant: "dsh-agent-compare",
    inject: () => ({})
  }, Overlay)));
  try {
    ctx.effect?.(() => () => {
      for (const d of disposers.reverse()) d();
    });
  } catch (error) {
    console.warn("[dsh-agent-compare] cleanup hook unavailable:", error);
  }
}

    return module.exports;
  },
});
