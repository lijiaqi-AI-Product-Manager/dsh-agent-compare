/** Scoped styles shared by the conversation, composer and history sheet. */
export const CSS = `
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
margin:0;padding:0;width:auto;height:auto;max-width:none;max-height:none;color:var(--ac-fg);
background:var(--ac-bg);border:1px solid var(--ac-border);border-radius:var(--dsw-radius-panel,16px);box-shadow:var(--dsw-shadow-lv3,0 24px 64px rgba(15,17,21,.18));
display:flex;flex-direction:column;overflow:hidden;animation:ac-rise .18s ease-out}
.ac-sheet::backdrop{background:var(--dsw-alias-bg-mask-1,rgba(15,17,21,.28))}.ac-root:has(>.ac-sheet:modal)>.ac-mask{display:none}
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
.ac-copy-space{margin:16px;padding:14px;border:1px solid var(--ac-border);border-radius:var(--ac-r-md);background:var(--ac-l1);font-size:13px}.ac-copy-space .ac-note{margin:5px 0}.ac-copy-plan{margin-top:12px;border-top:1px solid var(--ac-border);padding-top:8px}.ac-copy-plan p{line-height:1.7}.ac-copy-plan ul{padding-left:20px}.ac-copy-plan li{margin:10px 0}.ac-copy-plan code{overflow-wrap:anywhere}.ac-copy-plan .ac-row{flex-wrap:wrap}.ac-inline .ac-copy-space{margin:12px}
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
@media(max-width:600px){.ac-sheet{top:max(40px,env(titlebar-area-height,0px));left:0;right:0;bottom:0;border-radius:0}.ac-head{flex-wrap:wrap;gap:6px}.ac-title{font-size:13px}.ac-tabs{order:2;flex-basis:100%;justify-content:center}.ac-tab{flex:1}.ac-h1{font-size:25px}.ac-start{padding:22px 16px 0;gap:20px}.ac-options,.ac-models{grid-template-columns:minmax(0,1fr)}.ac-start-foot{align-items:stretch;flex-direction:column;gap:10px;padding:12px 0}.ac-start-foot>div>span{display:none}.ac-start-foot .ac-btn{width:100%}.ac-bar{padding:10px 12px;gap:8px}.ac-bar-text{min-width:100%;font-size:12px}.ac-bar .ac-btn{flex:1;justify-content:center;min-height:40px}.ac-grid{padding:12px;gap:12px}.ac-compare-tools{padding:12px 12px 0;gap:8px}.ac-compare-tools>.ac-meta{display:block;flex-basis:100%;line-height:1.5;overflow-wrap:anywhere}.ac-seg button{min-height:36px}.ac-review{margin:12px;flex-direction:column}.ac-run-heading{padding:10px 12px}.ac-run-heading>.ac-meta{display:none}.ac-guide{padding:24px 18px}.ac-hrow{flex-wrap:wrap}.ac-hrow .t{min-width:150px}.ac-header-caption{display:none}.ac-field-foot>.ac-meta{font-size:11px}.ac-field-foot{gap:4px}}
@media(prefers-color-scheme:dark){.ac-root{--ac-brand:var(--dsw-alias-brand-primary,#a1b0ff);--ac-brand-fg:var(--dsw-alias-label-primary-foreground,#111827);--ac-ok:var(--dsw-alias-state-success-primary,#65d89f);--ac-err:var(--dsw-alias-state-error-primary,#ff98a3);--ac-warn:var(--dsw-alias-state-warn-primary,#edc575)}}
@media(prefers-reduced-motion:reduce){.ac-root *{animation:none!important;transition:none!important}}

.ac-header-glyph{display:none;flex:none}
.ac-language{display:inline-flex;align-items:center;gap:6px;min-width:0;color:var(--ac-fg2);font-size:12px}
.ac-language select{font:inherit;color:var(--ac-fg);background:var(--ac-bg);border:1px solid var(--ac-border-strong);border-radius:8px;min-height:30px;max-width:128px;padding:3px 7px;cursor:pointer}
.ac-language.compact select{max-width:104px}
.ac-original-diagnostic{display:block;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:6px;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px}
.ac-original-diagnostic[hidden]{display:none}
.ac-feedback,.ac-verdict,.ac-summary,.ac-meta{overflow-wrap:anywhere}
.ac-root[lang=en] .ac-btn{white-space:normal;height:auto;min-height:32px;line-height:1.35;padding-top:5px;padding-bottom:5px;max-width:100%;text-align:center}
@media(max-width:600px){.ac-process-control{display:flex;flex-wrap:wrap;white-space:normal;max-width:100%}.ac-process-control select{min-width:0;max-width:100%;min-height:36px;flex:1 1 180px}}
@media(max-width:600px){.ac-language select{max-width:72px}.ac-header-tools{gap:4px}.ac-header-tools .ac-header-btn{width:28px;min-width:28px;padding:0;justify-content:center}.ac-header-label{display:none}.ac-header-glyph{display:block}.ac-settings-row>.ac-budget{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;flex:1 1 220px}.ac-settings-row>.ac-budget select{min-width:0;flex:1;max-width:100%}.ac-settings-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:8px}.ac-settings-head>div{display:contents}.ac-settings-head .ac-logo{grid-column:1;grid-row:1}.ac-settings-head b{grid-column:2;grid-row:1}.ac-settings-head>div>span{grid-column:1/-1;grid-row:2;margin:0}.ac-settings-head>button{grid-row:1}.ac-root[lang=en] .ac-bar .ac-btn{min-width:100px}.ac-root[lang=en] .ac-settings-row>.ac-seg{flex-wrap:wrap;max-width:100%}}
`
