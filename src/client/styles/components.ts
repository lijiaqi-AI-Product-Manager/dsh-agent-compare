export const BASE = `
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
@media(max-width:600px){.ac-root .ac-details>summary{min-block-size:24px;box-sizing:border-box}}
.ac-strategy{margin-left:auto;font-weight:600;font-size:12px}
.ac-summary{color:var(--ac-fg2);font-size:12px;white-space:pre-wrap;max-height:84px;overflow:auto}
.ac-browser{flex:none;display:flex;flex-direction:column;min-height:0;background:var(--ac-l1)}
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
.ac-fail{flex:1;margin:12px;padding:12px;border-radius:var(--ac-r-md);background:color-mix(in srgb,var(--ac-err) 7%,transparent);color:var(--ac-fg);overflow:auto;font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.ac-fail b{display:block;color:var(--ac-err);margin-bottom:6px}
.ac-fail.interrupted{background:color-mix(in srgb,var(--ac-warn) 8%,transparent)}
.ac-fail.interrupted b{color:var(--ac-warn)}
.ac-install-log{max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px}
.ac-salvage{display:flex;align-items:center;gap:12px;margin-top:14px;padding:10px 12px;border-radius:var(--ac-r-sm);background:var(--ac-bg);border:1px solid var(--ac-border);font-family:var(--dsw-font-family,inherit);white-space:normal;color:var(--ac-fg2)}
.ac-salvage span{flex:1}
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
.ac-card-evidence{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-top:1px solid var(--ac-border)}.ac-adoption-record{margin-top:8px;padding:8px 12px}.ac-adoption-record>summary{cursor:pointer}
@media(max-width:600px){.ac-card-head .ac-label+.ac-pill{flex:1 1 120px;min-width:0;height:auto;min-height:22px;white-space:normal;line-height:1.4;padding:3px 9px}.ac-card-head .ac-label+.ac-pill>:is(.ac-dot,.ac-spin){flex:none}}
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
.ac-settings-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.ac-settings-row>.ac-seg button{font-size:12px;height:28px;padding:0 10px}.ac-settings-row>.ac-btn{margin-left:auto}.ac-settings-foot{font-size:11px;color:var(--ac-fg2);display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 14px}.ac-settings-foot>.ac-details{font-size:11px}.ac-settings-foot>.ac-details[open]{flex-basis:100%}.ac-settings-project{overflow-wrap:anywhere}.ac-project-disclosure{min-width:0;max-width:100%}.ac-project-disclosure>summary{cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-project-disclosure>div{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;padding-block:4px}.ac-project-disclosure>div>bdi{min-width:0;user-select:all}.ac-composer-settings .ac-models{max-width:100%}.ac-composer-settings .ac-models select{min-width:0;width:100%}.ac-composer-settings .ac-feedback{padding:8px;font-size:12px}
@media(max-width:600px){.ac-composer-settings{padding:10px}.ac-settings-head>div{display:block}.ac-settings-head>div>span{display:block;margin-top:3px}.ac-settings-row{gap:8px}.ac-settings-row>.ac-seg{flex-basis:100%;width:100%}.ac-settings-row>.ac-seg button{flex:1;min-height:36px}.ac-settings-row>.ac-btn{height:36px}.ac-composer-settings .ac-models{grid-template-columns:minmax(0,1fr)}.ac-inline .ac-inline-head{flex-wrap:wrap}.ac-inline .ac-inline-head .ac-task{min-width:50%}}
@media(max-width:900px){.ac-sheet{left:6px;right:6px;bottom:6px}.ac-head{padding:12px 14px;gap:8px}.ac-header-caption{display:none}.ac-start{padding:24px 20px 0}.ac-grid{grid-template-columns:minmax(0,1fr)}.ac-card{min-height:0}.ac-models{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media(max-width:600px){.ac-sheet{top:max(40px,env(titlebar-area-height,0px));left:0;right:0;bottom:0;border-radius:0}.ac-head{flex-wrap:wrap;gap:6px}.ac-title{font-size:13px}.ac-tabs{order:2;flex-basis:100%;justify-content:center}.ac-tab{flex:1}.ac-h1{font-size:25px}.ac-start{padding:22px 16px 0;gap:20px}.ac-options,.ac-models{grid-template-columns:minmax(0,1fr)}.ac-start-foot{align-items:stretch;flex-direction:column;gap:10px;padding:12px 0}.ac-start-foot>div>span{display:none}.ac-start-foot .ac-btn{width:100%}.ac-bar{padding:10px 12px;gap:8px}.ac-bar-text{min-width:100%;font-size:12px}.ac-bar .ac-btn{flex:1;justify-content:center;min-height:40px}.ac-grid{padding:12px;gap:12px}.ac-compare-tools{padding:12px 12px 0;gap:8px}.ac-compare-tools>.ac-meta{display:block;flex-basis:100%;line-height:1.5;overflow-wrap:anywhere}.ac-seg button{min-height:36px}.ac-review{margin:12px;flex-direction:column}.ac-run-heading{padding:10px 12px}.ac-run-heading>.ac-meta{display:none}.ac-guide{padding:24px 18px}.ac-hrow{flex-wrap:wrap}.ac-hrow .t{min-width:150px}.ac-header-caption{display:none}.ac-field-foot>.ac-meta{font-size:11px}.ac-field-foot{gap:4px}}
@media(prefers-color-scheme:dark){.ac-root{--ac-brand:var(--dsw-alias-brand-primary,#a1b0ff);--ac-brand-fg:var(--dsw-alias-label-primary-foreground,#111827);--ac-ok:var(--dsw-alias-state-success-primary,#65d89f);--ac-err:var(--dsw-alias-state-error-primary,#ff98a3);--ac-warn:var(--dsw-alias-state-warn-primary,#edc575)}}
@media(prefers-reduced-motion:reduce){.ac-root,.ac-root::before,.ac-root::after,.ac-root *,.ac-root *::before,.ac-root *::after,.ac-mode-btn,.ac-mode-btn::before,.ac-mode-btn::after{animation:none!important;transition:none!important}}

.ac-header-glyph{display:none;flex:none}
.ac-language{display:inline-flex;align-items:center;gap:6px;min-width:0;color:var(--ac-fg2);font-size:12px}
.ac-language select{font:inherit;color:var(--ac-fg);background:var(--ac-bg);border:1px solid var(--ac-border-strong);border-radius:8px;min-height:30px;max-width:128px;padding:3px 7px;cursor:pointer}
.ac-language.compact select{max-width:104px}
.ac-original-diagnostic{display:block;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:6px;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px}
.ac-original-diagnostic[hidden]{display:none}
.ac-feedback,.ac-verdict,.ac-summary,.ac-meta{overflow-wrap:anywhere}
.ac-root[lang=en] .ac-btn{white-space:normal;height:auto;min-height:32px;line-height:1.35;padding-top:5px;padding-bottom:5px;max-width:100%;text-align:center}
@media(max-width:600px){.ac-process-control{display:flex;flex-wrap:wrap;white-space:normal;max-width:100%}.ac-process-control select{min-width:0;max-width:100%;min-height:36px;flex:1 1 180px}}
`

export const CANDIDATES = `
.ac-steps-bar{display:flex;align-items:center;gap:10px;min-height:28px;margin:-6px 0 0;padding:0 12px 4px 6px;flex-wrap:wrap}.ac-steps-bar:empty{display:none}
.ac-steps-toggle{display:inline-flex;align-items:center;gap:7px;min-width:0;max-width:100%;height:30px;padding:0 11px 0 10px;border:0;border-radius:999px;background:rgba(77,107,254,.08);box-shadow:inset 0 0 0 1px rgba(77,107,254,.2);color:#2a43c4;font:inherit;font-size:12.5px;cursor:pointer;transition:background .16s,box-shadow .16s,transform .16s var(--ac-v-spring)}
.ac-steps-toggle:hover{background:rgba(77,107,254,.14);box-shadow:inset 0 0 0 1px rgba(77,107,254,.34)}.ac-steps-toggle:active{transform:scale(.97)}
.ac-steps-toggle.open{background:rgba(77,107,254,.16);box-shadow:inset 0 0 0 1px rgba(77,107,254,.4)}
.ac-steps-icon{flex:none;fill:currentColor}
.ac-steps-toggle.live .ac-steps-icon circle:last-of-type{animation:ac-step-blink 1.2s ease-in-out infinite}
.ac-steps-chevron{flex:none;color:currentColor;opacity:.75;transition:transform .22s var(--ac-v-out)}.ac-steps-toggle.open .ac-steps-chevron{transform:rotate(90deg)}
.ac-steps-title{flex:none;white-space:nowrap;font-weight:600}
.ac-steps-now{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ac-fg)}
.ac-steps-count{flex:none;color:var(--ac-fg2);font-variant-numeric:tabular-nums;white-space:nowrap}
.ac-steps-empty{margin:0;padding:10px 12px;font-size:12.5px;color:var(--ac-fg2)}
@keyframes ac-step-blink{50%{opacity:.25}}
/* the newest steps, live under the whale */
.ac-live-steps{display:grid;gap:4px;width:min(100%,520px);margin:2px auto 0;padding:8px 10px;border:0;border-radius:12px;background:rgba(255,255,255,.62);box-shadow:inset 0 0 0 1px rgba(77,107,254,.12);color:var(--ac-fg2);font:inherit;font-size:12px;text-align:left;cursor:pointer;transition:background .16s,box-shadow .16s}
.ac-live-steps:hover{background:rgba(255,255,255,.85);box-shadow:inset 0 0 0 1px rgba(77,107,254,.3)}
.ac-live-step{display:flex;align-items:center;gap:7px;min-width:0;opacity:.62;animation:ac-live-in .4s var(--ac-v-out) both}
.ac-live-step.newest{opacity:1;color:var(--ac-fg)}
.ac-live-step b{flex:none;font-weight:600;color:var(--ac-v-ink)}
.ac-live-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ac-live-step .ac-step-dot{flex:none}
.ac-live-step.newest.think .ac-step-dot{animation:ac-step-blink 1.2s ease-in-out infinite}
@keyframes ac-live-in{from{opacity:0;transform:translateY(4px)}}
/* a newer interface on an older backend */
.ac-stale-backend{display:grid;gap:3px;margin:8px 0;padding:10px 14px;border-radius:12px;background:#fff6e5;box-shadow:inset 0 0 0 1px #f3c97a;color:#5c3b00;font-size:13px;line-height:1.55}
.ac-stale-backend b{font-weight:700}
.ac-sheet>.ac-stale-backend{margin:0 18px 8px}
.ac-notice-root:not(:has(.ac-stale-backend)){display:none}
.ac-shimmer{background:linear-gradient(90deg,var(--ac-fg2) 0 38%,var(--ac-v-brand) 50%,var(--ac-fg2) 62% 100%) 0 0/260% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:ac-shimmer-text 2s linear infinite}
@keyframes ac-shimmer-text{from{background-position:110% 0}to{background-position:-160% 0}}
.ac-steps{margin:0 10px 8px;border-radius:14px;background:rgba(255,255,255,.62);box-shadow:inset 0 0 0 1px rgba(52,84,180,.09)}
.ac-steps ol{list-style:none;margin:0;padding:6px;max-height:min(440px,50vh);overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:1px}
.ac-steps-note{margin:0;padding:8px 14px 0;font-size:11.5px;color:var(--ac-fg3)}
.ac-step summary{display:flex;align-items:center;gap:8px;min-width:0;padding:6px 8px;border-radius:8px;list-style:none;cursor:pointer;font-size:12.5px;line-height:1.5;color:var(--ac-fg2)}
.ac-step summary::-webkit-details-marker{display:none}
.ac-step summary:hover{background:rgba(77,107,254,.06)}
.ac-step summary b{flex:none;font-weight:600;color:var(--ac-fg)}
.ac-step.error summary b{color:var(--ac-err)}
.ac-step-target{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 6px;border-radius:5px;background:rgba(77,107,254,.07);color:var(--ac-fg2);font:11.5px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ac-step-peek{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ac-fg3)}.ac-step details[open] .ac-step-peek{visibility:hidden}
.ac-step-time{flex:none;margin-left:auto;padding-left:8px;font-size:11.5px;color:var(--ac-fg3);font-variant-numeric:tabular-nums}
.ac-step-dot{flex:none;width:7px;height:7px;border-radius:50%;background:#a0abc8}
.ac-step-dot.done{background:var(--ac-v-brand)}.ac-step-dot.error{background:var(--ac-err)}.ac-step-dot.think{background:#6cc0ff}.ac-step-dot.text{background:#2340b8}
.ac-step-dot.running{width:10px;height:10px;background:transparent;border:2px solid rgba(77,107,254,.22);border-top-color:var(--ac-v-brand);animation:ac-spin .8s linear infinite}
.ac-step-thinking{margin:0 8px 8px 23px;padding:2px 0 2px 12px;border-left:2px solid rgba(77,107,254,.16);max-height:320px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.7;color:var(--ac-fg2)}
.ac-step-io{display:grid;gap:6px;margin:0 8px 8px 23px}
.ac-step-io small{display:block;margin:0 0 2px;font-size:11px;color:var(--ac-fg3)}
.ac-step-io pre{margin:0;max-height:220px;overflow:auto;padding:8px 10px;border-radius:8px;background:rgba(20,32,80,.045);white-space:pre-wrap;overflow-wrap:anywhere;font:11.5px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ac-fg)}
.ac-step.text{display:flex;align-items:flex-start;gap:8px;padding:6px 8px}.ac-step.text .ac-step-dot{margin-top:8px}
.ac-step-words{min-width:0;font-size:13px;line-height:1.65;color:var(--ac-fg)}
.ac-step-gap{padding:6px 8px 6px 23px;font-size:11.5px;color:var(--ac-fg3)}
.ac-reply{margin:2px 10px 10px;padding:12px 14px 10px;border-radius:14px;background:rgba(255,255,255,.78);box-shadow:inset 0 1px 0 #fff,0 0 0 1px rgba(52,84,180,.09)}
.ac-reply-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:var(--ac-fg3)}.ac-reply-head b{font-size:12.5px;color:var(--ac-fg)}
.ac-reply-body{font-size:13.5px;line-height:1.7;color:var(--ac-fg);overflow-wrap:anywhere}
.ac-reply.folded .ac-reply-body{max-height:10.5em;overflow:hidden;-webkit-mask:linear-gradient(#000 55%,transparent);mask:linear-gradient(#000 55%,transparent)}
.ac-reply-more{margin-top:2px}
/* in the conversation, space is short: the reply opens at two lines so the page stays in view */
.ac-inline .ac-reply{margin:6px 10px 8px;padding:8px 12px 4px}.ac-inline .ac-reply.folded .ac-reply-body{max-height:1.75em}.ac-inline .ac-reply-head{margin-bottom:0}.ac-inline .ac-reply-more{min-height:0;padding:2px 4px}
/* on a phone the page comes first, then the reply, so the first screen shows what was built */
@media(max-width:600px){.ac-card>.ac-reply{order:1}.ac-card>.ac-card-evidence{order:2}.ac-card:has(>:is(.ac-browser,.ac-shotwrap,.ac-result))>:is(.ac-steps-bar,.ac-steps){order:1}.ac-card:has(>:is(.ac-browser,.ac-shotwrap,.ac-result))>.ac-steps-bar{margin-top:4px}}
/* one version in focus on a wide window: what it said on the left, what it built on the right, with equal standing */
@media(min-width:1100px){
.ac-sheet .ac-grid.focus>.ac-card:not([hidden]):has(>.ac-reply):has(>:is(.ac-browser,.ac-shotwrap,.ac-result)){display:grid;grid-template-columns:minmax(300px,.4fr) minmax(0,1fr);grid-template-rows:auto auto auto 1fr auto;align-items:start}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>.ac-card-head{grid-column:1/-1;grid-row:1}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>.ac-steps-bar{grid-column:1;grid-row:2;margin-top:4px}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>.ac-steps{grid-column:1;grid-row:3}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>.ac-reply{grid-column:1;grid-row:4;margin-top:6px}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>:is(.ac-browser,.ac-shotwrap,.ac-result){grid-column:2;grid-row:2/5;align-self:stretch;margin-top:6px;border-radius:14px 0 0 14px;overflow:hidden}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>.ac-card-evidence{grid-column:1/-1;grid-row:5}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>.ac-reply.folded .ac-reply-body{max-height:none;-webkit-mask:none;mask:none}
.ac-sheet .ac-grid.focus>.ac-card:has(>.ac-reply)>.ac-reply .ac-reply-more{display:none}
}
.ac-page-note{display:flex;align-items:center;gap:8px;padding:8px 14px 0;font-size:12px;color:var(--ac-fg2)}.ac-page-note .ac-spin{color:var(--ac-v-brand)}
.ac-empty.compact{flex:none;min-height:0;padding:4px 10px 12px}
.ac-empty:has(>.ac-whale-stage){justify-content:flex-start}
.ac-whale-stage{position:relative;isolation:isolate;display:grid;justify-items:center;gap:8px;width:100%;min-height:236px;padding:44px 12px 18px;overflow:hidden;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(233,241,255,.55))}
.ac-empty.compact .ac-whale-stage{min-height:160px;padding:38px 12px 12px}.ac-empty.compact .ac-whale svg{width:112px}
.ac-whale{position:relative;border:0;padding:0;background:none;cursor:pointer;transform-origin:50% 70%;animation:ac-whale-bob 3.6s ease-in-out infinite}
.ac-whale:focus-visible{outline:2px solid var(--ac-v-ink);outline-offset:6px;border-radius:24px}
.ac-whale-lean{display:block;transition:transform .5s var(--ac-v-out)}
.ac-whale svg{display:block;width:150px;height:auto;overflow:visible;filter:drop-shadow(0 10px 14px rgba(54,87,245,.2))}
.ac-whale-holes{fill:#fff}
.ac-whale-glass{fill:rgba(77,107,254,.16)}
.ac-whale-line{fill:none;stroke:#4d6bfe;stroke-width:.3;stroke-linejoin:round}
.ac-whale-water{transition:transform 1.3s var(--ac-v-expo)}
.ac-whale-wave{transform-box:view-box}
.ac-whale-wave.back{fill:#7d95ff;opacity:.5;--ac-p:5.2px;animation:ac-whale-drift 3.4s linear infinite}
.ac-whale-wave.front{--ac-p:-6.4px;animation:ac-whale-drift 2.6s linear infinite}
.ac-whale-rise circle{fill:#fff;opacity:0;transform-box:fill-box;animation:ac-whale-rise 3.2s ease-in infinite}
.ac-whale-rise circle:nth-child(2){animation-delay:.9s}.ac-whale-rise circle:nth-child(3){animation-delay:1.7s}.ac-whale-rise circle:nth-child(4){animation-delay:2.4s}
.ac-whale-trail,.ac-whale-head,.ac-whale-flash{fill:none;stroke-linecap:round;stroke-linejoin:round}
.ac-whale-trail{stroke:#4d6bfe;stroke-width:.62;stroke-dasharray:22 78;animation:ac-whale-trace 2.8s linear infinite}
.ac-whale-head{stroke:#5fd4ff;stroke-width:.85;stroke-dasharray:2.2 97.8;stroke-dashoffset:-19.8;filter:drop-shadow(0 0 .6px #7fe0ff);animation:ac-whale-trace-head 2.8s linear infinite}
.ac-whale-stage .two{animation-delay:-1.4s}
.ac-whale-flash{stroke:#7fd0ff;stroke-width:.9;opacity:0;animation:ac-whale-flash 1.1s var(--ac-v-out)}
.ac-whale-spout circle{fill:#7fd0ff;opacity:0;transform-box:fill-box;transform-origin:50% 100%;animation:ac-whale-puff 1.2s var(--ac-v-out)}
.ac-whale-spout circle:nth-child(2){animation-delay:.07s}.ac-whale-spout circle:nth-child(3){animation-delay:.14s}
.ac-whale-stage.poked .ac-whale-lean{animation:ac-whale-jiggle .9s var(--ac-v-out)}
.ac-whale-stage.poked .ac-whale-wave.front{animation-duration:.8s}
.ac-whale-stage.full .ac-whale-line{stroke-width:0}.ac-whale-stage.full :is(.ac-whale-trail,.ac-whale-head,.ac-whale-rise){display:none}
.ac-whale-stage.asleep .ac-whale{animation-duration:6s}.ac-whale-stage.asleep :is(.ac-whale-trail,.ac-whale-head){display:none}.ac-whale-stage.asleep .ac-whale-wave{animation-duration:9s}
/* bubbles over the whale: a thought cloud on its own, a speech bubble when poked */
.ac-whale-bubble{position:absolute;top:8px;z-index:2;max-width:min(64%,260px);padding:4px 11px;font-size:12px;line-height:1.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.ac-whale-bubble.think{right:calc(50% - 6px);border-radius:14px;background:rgba(255,255,255,.94);color:var(--ac-fg2);box-shadow:0 0 0 1px rgba(77,107,254,.14),0 8px 18px -10px rgba(28,48,120,.4);overflow:visible;animation:ac-whale-think 3.6s var(--ac-v-out) both}
.ac-whale-bubble.think::before,.ac-whale-bubble.think::after{content:"";position:absolute;border-radius:50%;background:inherit;box-shadow:0 0 0 1px rgba(77,107,254,.14)}
.ac-whale-bubble.think::before{right:14px;bottom:-8px;width:8px;height:8px}.ac-whale-bubble.think::after{right:6px;bottom:-15px;width:5px;height:5px}
.ac-whale-bubble.say{left:calc(50% + 8px);border-radius:12px 12px 12px 4px;background:#3d5cf0;color:#fff;font-weight:600;box-shadow:0 8px 18px -8px rgba(61,92,240,.75);animation:ac-whale-say 2.2s var(--ac-v-spring) both}
.ac-whale:hover svg{filter:drop-shadow(0 10px 14px rgba(54,87,245,.28)) brightness(1.04)}
.ac-whale-ripple{position:absolute;left:50%;top:150px;width:130px;height:26px;margin-left:-65px;border-radius:50%;border:2px solid rgba(77,107,254,.45);pointer-events:none;animation:ac-whale-ripple .9s var(--ac-v-out) forwards}
.ac-empty.compact .ac-whale-ripple{top:118px;width:96px;margin-left:-48px}
.ac-whale-stage.spin .ac-whale-lean{animation:ac-whale-spin 1s var(--ac-v-out)}
.ac-whale-stage.dizzy .ac-whale-lean{animation:ac-whale-dizzy .9s ease-in-out}
.ac-whale-stage.splash .ac-whale-lean{animation:ac-whale-jiggle .9s var(--ac-v-out)}.ac-whale-stage.splash .ac-whale-wave.front{animation-duration:.5s}
.ac-whale-pops{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none}
.ac-whale-pops i{position:absolute;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,rgba(169,232,255,.5) 60%,rgba(77,107,254,.2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.8);animation:ac-whale-pop 1.2s var(--ac-v-out) forwards}
.ac-whale-pops i:nth-child(1){--x:-46px}.ac-whale-pops i:nth-child(2){--x:-18px;animation-delay:.06s}.ac-whale-pops i:nth-child(3){--x:8px;width:6px;height:6px;animation-delay:.12s}.ac-whale-pops i:nth-child(4){--x:30px;animation-delay:.04s}.ac-whale-pops i:nth-child(5){--x:52px;width:5px;height:5px;animation-delay:.18s}
.ac-whale-pops i:nth-child(6){--x:-74px;width:7px;height:7px;animation-delay:.1s}.ac-whale-pops i:nth-child(7){--x:76px;animation-delay:.14s}.ac-whale-pops i:nth-child(8){--x:-30px;width:12px;height:12px;animation-delay:.2s}.ac-whale-pops i:nth-child(9){--x:40px;width:11px;height:11px;animation-delay:.24s}
.ac-whale-caption{position:relative;max-width:min(92%,460px);text-align:center;font-size:12.5px;line-height:1.6;color:var(--ac-fg2);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
`

export const READABILITY = `
.ac-root{font-size:14px;line-height:1.6}
.ac-head{flex:none}
.ac-title{font-size:16px;font-weight:650;letter-spacing:-.2px}
.ac-root .ac-btn{font-size:13px;min-height:34px}
.ac-root .ac-btn.sm{font-size:12px;min-height:28px}
.ac-card-head{padding:13px 14px;gap:7px}
.ac-card-head .ac-meta,.ac-card-evidence summary{font-size:12px;line-height:1.6}
.ac-settings-head b{font-size:14px}
.ac-settings-head span:not(.ac-logo),.ac-settings-facts,.ac-context-label,.ac-context-summary{font-size:12px;line-height:1.65}
.ac-root :is(.ac-btn,.ac-chip,.ac-tab,.ac-seg button,.ac-icon-btn,.ac-text-btn):focus-visible{outline:2px solid var(--ac-v-ink);outline-offset:3px}
.ac-root[lang=en] .ac-btn{line-height:1.4}
@media(max-width:600px){.ac-title{font-size:14px}.ac-head{gap:6px}.ac-card-head{padding:11px 12px}.ac-card-head .ac-meta,.ac-card-evidence summary{font-size:11px}.ac-root .ac-bar .ac-btn{min-height:42px}.ac-settings-row>.ac-seg button{min-height:36px}}
`

export const LAYOUT = `
@media(max-width:600px){.ac-language select{max-width:72px}.ac-header-tools{gap:4px}.ac-header-tools .ac-header-btn{width:28px;min-width:28px;padding:0;justify-content:center}.ac-header-label{display:none}.ac-header-glyph{display:block}.ac-settings-row>.ac-budget{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;flex:1 1 220px}.ac-settings-row>.ac-budget select{min-width:0;flex:1;max-width:100%}.ac-settings-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:8px}.ac-settings-head>div{display:contents}.ac-settings-head .ac-logo{grid-column:1;grid-row:1}.ac-settings-head b{grid-column:2;grid-row:1}.ac-settings-head>div>span{grid-column:1/-1;grid-row:2;margin:0}.ac-settings-head>button{grid-row:1}.ac-root[lang=en] .ac-bar .ac-btn{min-width:100px}.ac-root[lang=en] .ac-settings-row>.ac-seg{flex-wrap:wrap;max-width:100%}}
@media(max-width:600px){
.ac-root[lang=en] .ac-bar .ac-btn{flex:1 1 88px;min-width:88px}
.ac-root[lang=en] .ac-bar .ac-btn.primary{flex-grow:1.35;flex-basis:112px;min-width:112px}
}

.ac-composer-settings .ac-more-settings,.ac-compare-tools .ac-align-pages{display:none}
.ac-advanced-settings{display:contents}
@media(max-width:600px),(max-height:740px){
  .ac-composer-settings .ac-more-settings{display:inline-flex;align-self:flex-start;align-items:center;gap:6px;min-height:32px}
  .ac-advanced-settings[data-open=false]{display:none}
  .ac-advanced-settings[data-open=false][data-project-blocked=true]{display:contents}
  .ac-advanced-settings[data-open=false][data-project-blocked=true]>:not(.ac-example-row,.ac-settings-foot){display:none}
}
/* Leave space for the host's draft and Send, including when extra settings are open. */
@media(max-height:740px){
  .ac-composer-settings{box-sizing:border-box;max-block-size:clamp(5rem,calc(100dvh - 19rem),26rem);overflow-y:auto;overscroll-behavior-y:contain;scroll-padding-block:8px}
  .ac-composer-settings>*{flex-shrink:0}
}
@supports (grid-template-rows:subgrid){
  @media(min-width:901px){
    .ac-compare-tools .ac-align-pages{display:inline-flex}
    /* Shared tracks align the actual frames, including when only one page has a progress note. */
    .ac-grid[data-align-pages=true]>.ac-card:not(.ac-card-excluded){display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:subgrid;grid-row:span 7;row-gap:0;align-self:stretch;align-items:start}
    .ac-grid[data-align-pages=true]>.ac-card>.ac-card-head{grid-row:1}
    .ac-grid[data-align-pages=true]>.ac-card>.ac-steps-bar{grid-row:2}
    .ac-grid[data-align-pages=true]>.ac-card>.ac-steps{grid-row:3}
    .ac-grid[data-align-pages=true]>.ac-card>.ac-reply{grid-row:4}
    .ac-grid[data-align-pages=true]>.ac-card>.ac-browser{grid-row:5/span 2;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:subgrid;align-self:stretch;row-gap:0}
    .ac-grid[data-align-pages=true] .ac-page-note{grid-row:1}
    .ac-grid[data-align-pages=true] .ac-preview-stage{grid-row:2}
    .ac-grid[data-align-pages=true]>.ac-card>.ac-card-evidence{grid-row:7}
  }
}
`

export const UI_COMPONENTS = `
.ac-mode-btn .ac-mode-letters {display:inline-flex;align-items:center;gap:1px}
.ac-mode-btn:not(.on) .ac-mode-letters b:first-child{color:#3b5af2}
.ac-mode-btn:not(.on) .ac-mode-letters b:last-child{color:#1468a5}
.ac-mode-btn.on:active{transform:scale(.96)}
.ac-root .ac-mini-pod,.ac-root .ac-recipe-strip{display:inline-flex;align-items:center;gap:1px;vertical-align:middle}
.ac-root .ac-mini-pod svg{width:12px;height:12px;fill:transparent;stroke:currentColor;stroke-width:1}
.ac-root .ac-seg .on .ac-mini-pod svg{fill:currentColor}
.ac-root .ac-eye-icon{width:15px;height:15px;vertical-align:middle;margin-inline-end:3px}
.ac-root .ac-style-slot{flex-wrap:wrap;min-width:0}
.ac-root .ac-style-slot:has(.ac-palette){flex-basis:100%}
.ac-root .ac-swatch-trigger{padding:3px;border:1px solid var(--ac-glass-edge);border-radius:7px;background:var(--ac-glass-thick);cursor:pointer;color:var(--ac-v-ink)}
.ac-root .ac-swatch{position:relative;display:inline-block;overflow:hidden;vertical-align:middle;width:32px;height:22px;border-radius:4px;background:linear-gradient(145deg,#e7efff,#bbd4f0);color:#36598c}
.ac-root .ac-swatch i{position:absolute;display:block;background:currentColor;left:15%;top:23%;width:70%;height:12%;border-radius:2px}
.ac-root .ac-swatch i:nth-child(2){top:48%;width:48%}.ac-root .ac-swatch i:nth-child(3){top:72%;width:58%}
.ac-root .ac-swatch[data-style=bold] i{width:45%;height:52%;transform:rotate(-16deg);box-shadow:2px 2px #aac8ff}.ac-root .ac-swatch[data-style=bold] i:nth-child(2){left:46%;top:28%;background:#5e75ce}.ac-root .ac-swatch[data-style=bold] i:last-child{display:none}
.ac-root .ac-swatch[data-style=minimal] i{display:none}.ac-root .ac-swatch[data-style=minimal] i:first-child{display:block;top:60%;width:5px;height:5px;border-radius:50%}
.ac-root .ac-swatch[data-style=polished] i{width:58%;height:32%;left:21%;background:#f2f5ff;box-shadow:0 2px 4px #5e75ad}
.ac-root .ac-swatch[data-style=vibrant] i{width:28%;height:43%;border-radius:50%;top:28%;background:#3861c3}.ac-root .ac-swatch[data-style=vibrant] i:nth-child(2){left:37%;background:#ca6f59}.ac-root .ac-swatch[data-style=vibrant] i:last-child{left:60%;background:#378b91}
.ac-root .ac-swatch[data-style=friendly] i:first-child{top:32%;height:42%;border-radius:9px}.ac-root .ac-swatch[data-style=friendly] i:not(:first-child){display:none}
.ac-root .ac-swatch[data-style=rigorous] i{border-left:3px solid #317d67;box-sizing:border-box;background:#6981a2}
.ac-root .ac-swatch[data-style=lean] i{left:22%;top:50%;height:16%;transform:rotate(-29deg);border-radius:100%}.ac-root .ac-swatch[data-style=lean] i:not(:first-child){display:none}
.ac-root .ac-palette{flex:1 0 100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:6px;background:var(--ac-glass-thick);border-radius:12px}
.ac-root .ac-palette button{display:flex;align-items:center;gap:6px;min-height:36px;padding:5px 7px;background:var(--ac-glass-solid);border:1px solid var(--ac-glass-edge);border-radius:8px;color:var(--ac-reading-ink);cursor:pointer}
.ac-root .ac-palette button[aria-pressed=true]{border:2px solid var(--ac-v-ink)}
.ac-root :is(.ac-custom-card,.ac-palette-note){grid-column:1/-1}.ac-root .ac-palette-note{color:var(--ac-reading-soft);font-size:12px}
.ac-root .ac-char-count,.ac-root .ac-budget-slider output{font-variant-numeric:tabular-nums;color:var(--ac-reading-soft)}
.ac-root .ac-recipe-strip .ac-swatch{width:10px;height:10px;border-radius:3px}
.ac-root .ac-habit-item{position:relative;padding-bottom:4px;margin-inline-end:7px}
.ac-root .ac-habit-item i{position:absolute;inset-inline-start:0;bottom:0;height:2px;background:var(--ac-ver-a);border-radius:5px}
.ac-root .ac-budget-slider{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ac-root .ac-budget-slider input{width:clamp(88px,16vw,190px);min-width:0;accent-color:var(--ac-ver-a)}
.ac-root .ac-budget-slider output{font-weight:700;white-space:nowrap}
@media(max-width:600px){
 .ac-root .ac-mini-pod{display:none}.ac-root .ac-palette{grid-template-columns:repeat(2,minmax(0,1fr))}
 .ac-root .ac-palette button,.ac-root .ac-swatch-trigger{min-height:40px}
}
@media(prefers-color-scheme:dark){.ac-mode-btn:not(.on) .ac-mode-letters b{color:#b3cdff}}
@media(forced-colors:active){.ac-root .ac-swatch{forced-color-adjust:auto;border:1px solid CanvasText}}
.ac-root .ac-elapsed{font:650 clamp(12px,1.3vw,17px)/1.25 ui-monospace,monospace;font-variant-numeric:tabular-nums;margin-inline-start:auto;color:var(--ac-reading-soft)}
.ac-root .ac-check-summary{margin-block-start:3px;color:var(--ac-reading-soft);font-size:12px}
.ac-root .ac-check-summary summary{cursor:pointer;width:fit-content;padding:1px 3px;border-radius:4px}
.ac-root .ac-check-summary:not([open])>.ac-checks{display:none}
.ac-root .ac-card-head .ac-live-steps{max-width:100%;margin:3px 0 0;display:block}
.ac-root .ac-card-head .ac-live-step:not(:last-child){display:none}
.ac-root .ac-whale-face{flex:none;display:inline-block;width:20px;height:20px;color:var(--ac-version,var(--ac-ver-a))}
.ac-root .ac-card-head .ac-label{position:relative;overflow:visible}
.ac-root .ac-card-head .ac-label>.ac-whale-face{position:absolute;right:-3px;bottom:-3px;width:13px;height:13px;padding:1px;box-sizing:border-box;border-radius:50%;background:var(--ac-glass-thick);color:var(--ac-reading-ink)}
.ac-root .ac-whale-lean>.ac-whale-face{position:absolute;z-index:2;top:5%;right:-6%;width:24px;height:24px;padding:3px;box-sizing:content-box;border-radius:50%;background:var(--ac-glass-thick);box-shadow:var(--ac-thick-shadow)}
.ac-root .ac-stage-dots{display:inline-flex;gap:2px;align-items:center}
.ac-root .ac-stage-dots i{width:3px;height:3px;border-radius:50%;background:currentColor}
.ac-root .ac-step{position:relative}.ac-root .ac-step-duration{position:absolute;left:0;bottom:0;height:2px;max-width:100%;background:var(--ac-version,var(--ac-ver-a));opacity:.35;pointer-events:none}
.ac-root .ac-step-io pre{max-height:240px;overflow:auto;overflow-wrap:anywhere;white-space:pre-wrap}
.ac-root .ac-pick-options{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;overflow-x:auto;padding:4px;scrollbar-width:thin}
.ac-root .ac-pick-options .ac-btn{flex:0 0 auto;white-space:nowrap}
.ac-root .ac-pick-options .ac-pick-option{background:var(--ac-version);color:var(--ac-ver-on);border:1px solid transparent;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.ac-root .ac-pick-none{background:transparent;color:var(--ac-reading-soft);box-shadow:none;border:1px solid var(--ac-glass-edge)}
.ac-root .ac-card .ac-seal{font-weight:750;transform:rotate(-9deg);color:var(--ac-v-ink);border:1.5px solid currentColor;background:var(--ac-glass-thick)}
.ac-root .ac-alternative:not(:hover):not(:focus-within){box-shadow:inset 0 0 0 1px var(--ac-glass-edge);background:var(--ac-glass-mid)}
.ac-root .ac-reason-check{width:14px;height:14px;vertical-align:middle;margin-inline-end:3px}
.ac-root .ac-view-controls{display:contents}
.ac-root .ac-view-trigger{display:none}
.ac-root .ac-seg [data-shortcut]:is(:hover,:focus-visible)::after{content:attr(data-shortcut);position:absolute;inset:0 0 auto auto;padding:0 2px;font:9px/1.2 monospace;color:var(--ac-reading-soft);background:var(--ac-glass-solid);border:1px solid var(--ac-glass-edge);border-radius:3px}
.ac-root .ac-decision-result strong{padding:1px 5px;border-radius:5px;background:var(--ac-glass-solid);color:var(--ac-reading-ink)}
@media(max-width:600px){
 .ac-root .ac-view-trigger{display:inline-flex;align-items:center;min-height:40px;gap:6px;border:1px solid var(--ac-glass-edge);border-radius:12px;padding:0 12px;background:var(--ac-glass-thick);color:var(--ac-reading-ink)}
 .ac-root .ac-view-controls{display:flex;flex-wrap:wrap;gap:4px;order:3;flex:1 0 100%;min-width:0}
 .ac-root .ac-view-controls[data-open=false]{display:none}
 .ac-root .ac-pick-options{width:100%;box-sizing:border-box;flex-wrap:wrap}.ac-root .ac-pick-options .ac-btn{min-width:68px;height:40px}
}
.ac-root .ac-change-summary{display:flex;flex-wrap:wrap;gap:clamp(10px,3vw,26px);padding:9px 0;color:var(--ac-reading-soft)}
.ac-root .ac-change-summary span{display:grid;gap:3px;font-size:12px}
.ac-root .ac-change-summary b{font:var(--ac-num);font-variant-numeric:tabular-nums;color:var(--ac-reading-ink)}
.ac-root .ac-diff-browser{display:flex;gap:6px;min-width:0;align-items:flex-start}
.ac-root .ac-diff-body{flex:1;min-width:0}.ac-root .ac-diff-files{display:grid;max-width:34%;gap:4px;max-height:240px;overflow:auto}
.ac-root .ac-diff-files button{overflow-wrap:anywhere;text-align:start;cursor:pointer;background:var(--ac-glass-thick);border:1px solid var(--ac-glass-edge);border-radius:6px;color:var(--ac-reading-ink)}
.ac-root .ac-diff-body pre{max-height:340px;overflow:auto;background:var(--ac-glass-solid);color:var(--ac-reading-ink);white-space:pre;margin:0}
.ac-root .ac-diff-line{display:flex;align-items:baseline;min-width:max-content;font:12px/1.6 ui-monospace,monospace}
.ac-root .ac-diff-line i{flex:0 0 4ch;text-align:end;padding-inline-end:1ch;font-style:normal;color:var(--ac-reading-soft);user-select:none}
.ac-root .ac-diff-line[data-kind=add]{background:#dcf1e6;color:#22573c}.ac-root .ac-diff-line[data-kind=del]{background:#f9e5e7;color:#753441}
.ac-root .ac-review{background:var(--ac-glass-thick);color:var(--ac-reading-ink);box-shadow:var(--ac-thick-shadow)}
.ac-root .ac-review-files ul{margin:4px 0;padding-inline-start:18px;overflow-wrap:anywhere}
.ac-root .ac-failure-mark{display:block;width:23px;height:23px;margin:0 0 5px}
.ac-root .ac-unified-banner{border-inline-start:3px solid var(--ac-ver-b);background:var(--ac-glass-thick)}
.ac-root .ac-unified-banner[data-tone=warn]{border-inline-start-color:#8a673a}.ac-root .ac-unified-banner[data-tone=error]{border-inline-start-color:#ad4860}
.ac-root .ac-adoption-splash{pointer-events:none;position:absolute;left:50%;top:50%;z-index:2;color:var(--ac-ver-b)}
.ac-root .ac-adoption-splash>*{position:absolute;inset:-7px auto auto -7px}
.ac-root .ac-confetti{width:4px;height:6px;background:currentColor;border-radius:2px;animation:ac-success-bit 700ms ease-out both}
.ac-root .ac-success-ring{border:1.5px solid currentColor;width:14px;height:14px;border-radius:50%;animation:ac-success-wave 620ms ease-out both}
@media(prefers-color-scheme:dark){.ac-root .ac-diff-line[data-kind=add]{background:#193b32;color:#c1f3d8}.ac-root .ac-diff-line[data-kind=del]{background:#472b36;color:#ffd4df}}
@media(max-width:600px){.ac-root .ac-diff-browser{flex-direction:column}.ac-root .ac-diff-files{max-width:100%;max-height:90px}.ac-root .ac-diff-body{width:100%}}
@media(forced-colors:active){.ac-root .ac-diff-line{color:CanvasText;background:Canvas}}
.ac-root .ac-history-totals{display:flex;gap:26px;align-items:baseline;margin:4px 0 12px;color:var(--ac-reading-soft)}
.ac-root .ac-history-totals span{display:flex;align-items:baseline;gap:5px}
.ac-root .ac-history-totals b{font:var(--ac-num);color:var(--ac-reading-ink);font-variant-numeric:tabular-nums}
.ac-root .ac-history-day{margin:15px 0 4px;padding-inline-start:9px;border-inline-start:2px solid var(--ac-ver-b);font-size:12px;color:var(--ac-reading-soft);font-weight:650}
.ac-root .ac-history-dots{display:inline-flex;gap:2px;align-items:center}.ac-root .ac-history-dots i{border:1px solid var(--ac-version);width:6px;height:6px;border-radius:50%}
.ac-root .ac-history-dots i[data-picked=true]{background:var(--ac-version)}.ac-root .ac-history-dots[data-none=true] i{border-color:var(--ac-reading-soft)}
.ac-root .ac-history-dots:not(:empty){margin-inline-end:2px}
.ac-root .ac-hrow-copy .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal;overflow:hidden}
.ac-root .ac-history-skeleton{display:grid;gap:7px}.ac-root .ac-history-skeleton i{height:32px;border-radius:8px;background:linear-gradient(100deg,transparent,color-mix(in srgb,var(--ac-ver-b) 13%,transparent),transparent)}
.ac-root .ac-guide-mini,.ac-root .ac-guide-styles>div{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ac-root .ac-guide-mini{min-height:32px;margin-bottom:5px}.ac-root .ac-guide-letter,.ac-root .ac-guide-diff{font:700 14px/1.3 ui-monospace,monospace;padding:3px 7px;border-radius:6px;color:var(--ac-ver-on);background:var(--ac-version,var(--ac-ver-a))}
.ac-root .ac-guide-styles>div span{display:inline-flex;align-items:center;gap:5px}
.ac-root .ac-guide-styles:not([open])>div{display:none}
.ac-root .ac-guide-tasks>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ac-root .ac-guide-tasks article{padding:10px;border:1px solid var(--ac-glass-edge);border-radius:12px;background:var(--ac-glass-thick)}
.ac-root .ac-guide-tasks p{margin:3px 0;color:var(--ac-reading-soft)}
.ac-root .ac-guide-styles,.ac-root .ac-guide-faq{padding:7px 0}
.ac-root .ac-sleeping{display:block;margin-block:6px}.ac-root .ac-sleeping .ac-whale-face{width:32px;height:32px}
@media(max-width:600px){
 .ac-root .ac-sheet{inset:env(titlebar-area-height,0px) 0 0;margin:0;width:100%;max-width:100%;height:calc(100dvh - env(titlebar-area-height,0px));max-height:100dvh;border-radius:0;box-sizing:border-box}
 .ac-root .ac-sheet .ac-head{padding-top:max(6px,env(safe-area-inset-top))}
 .ac-root .ac-head .ac-icon-btn{min-width:40px;min-height:40px}
 .ac-root .ac-guide-tasks>div{grid-template-columns:1fr}
}
.ac-root .ac-copy{display:inline-flex;align-items:center;justify-content:center;gap:5px}
.ac-root .ac-file-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:2px}
.ac-root .ac-file-list .ac-file{display:flex;align-items:center;gap:5px;min-width:0;min-height:32px}
.ac-root .ac-file>span{min-width:0;overflow-wrap:anywhere}.ac-root .ac-file>svg{flex:none;color:var(--ac-reading-soft)}
.ac-root .ac-file small{font:600 10px/1.4 ui-monospace,monospace;color:var(--ac-reading-soft)}
.ac-root .ac-file-copy{min-width:32px;min-height:32px;border:0;border-radius:8px;background:transparent;color:var(--ac-reading-ink);cursor:pointer}
.ac-root .ac-file-copy span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.ac-root .ac-preview-stage{flex-direction:column;align-items:center;justify-content:flex-start}
.ac-root .ac-browser-bar{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:1px 8px;background:var(--ac-glass-thick);border-bottom:1px solid var(--ac-glass-edge);color:var(--ac-reading-soft);font-size:11px}
.ac-root .ac-browser-bar>span:nth-child(2){flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}
.ac-root .ac-browser-lights{display:flex;gap:3px}.ac-root .ac-browser-lights i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.6}
.ac-root .ac-browser-bar button{color:var(--ac-reading-ink);border:1px solid var(--ac-glass-edge);background:var(--ac-glass-solid);border-radius:6px;padding:2px 8px;cursor:pointer}
.ac-root .ac-preview-surface[hidden]{display:none}.ac-root .ac-preview-stage>.ac-result{width:100%;box-sizing:border-box}
.ac-root .ac-style-sample{display:inline-flex}.ac-root .ac-reply-body{font-size:14px;line-height:1.7}
@media(forced-colors:active){.ac-root :is(.ac-browser-bar,.ac-file-copy,.ac-swatch-trigger,.ac-pick-option,.ac-view-trigger){border:1px solid ButtonText}.ac-root .ac-style-sample{outline:1px solid CanvasText}}
@media(min-width:900px) and (min-height:850px){
 .ac-root .ac-conversation-run-scroll{max-height:clamp(170px,calc(100dvh - 312px),808px)}
}
`
