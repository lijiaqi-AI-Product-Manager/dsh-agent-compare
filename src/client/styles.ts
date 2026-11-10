/**
 * Visual layer: DeepSeek-like blue in liquid glass. A slow aurora and fine
 * star dust behind the workspace, glass surfaces with a bright top rim and a
 * faint chromatic fringe, a glass lens that slides between options, liquid
 * progress, light that follows the pointer, and a burst of light when a pick
 * lands. Blue does the talking; warm amber only marks work in progress. Text
 * keeps WCAG AA contrast on every surface; reduced motion stops all movement
 * and reduced transparency drops the blur.
 */
const VISUAL = `
@property --ac-turn{syntax:'<angle>';inherits:false;initial-value:0deg}
.ac-root{--ac-v-brand:#3657f5;--ac-v-brand-2:#4d6bfe;--ac-v-sky:#38b6ff;--ac-v-ice:#8fe3ff;--ac-v-ink:#2443d6;--ac-v-deep:#0b1b4f;--ac-v-soft:#eef3ff;--ac-v-accent:#8fe3ff;--ac-v-doing:#ffa51f;
--ac-brand:var(--ac-v-brand);--ac-v-tint:color-mix(in srgb,var(--ac-v-brand) 7%,var(--ac-bg));--ac-v-tint-2:color-mix(in srgb,var(--ac-v-brand) 13%,var(--ac-bg));
--ac-v-edge:color-mix(in srgb,var(--ac-v-brand) 14%,transparent);
--ac-v-grad:linear-gradient(135deg,#2443d6 0%,#3053f0 48%,#3a5ef8 100%);
--ac-v-flow:linear-gradient(90deg,#3657f5,#38b6ff,#7b93ff,#3657f5);
--ac-v-glass:linear-gradient(180deg,color-mix(in srgb,var(--ac-bg) 72%,transparent),color-mix(in srgb,var(--ac-bg) 94%,transparent));
--ac-v-rim:inset 0 1px 0 rgba(255,255,255,.92),inset 0 0 0 1px rgba(255,255,255,.38);
--ac-v-fringe:inset 1px 0 0 color-mix(in srgb,#8fe3ff 60%,transparent),inset -1px 0 0 color-mix(in srgb,#7b6cff 42%,transparent);
--ac-v-shadow:0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 9%,transparent),0 1px 2px rgba(11,27,79,.06),0 16px 40px -18px color-mix(in srgb,var(--ac-v-brand) 38%,transparent);
--ac-v-lift:0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 16%,transparent),0 2px 4px rgba(11,27,79,.06),0 26px 56px -22px color-mix(in srgb,var(--ac-v-brand) 52%,transparent);
--ac-v-glow:radial-gradient(110% 70% at 8% 0%,color-mix(in srgb,#4d6bfe 17%,transparent),transparent 62%),radial-gradient(70% 50% at 100% 0%,color-mix(in srgb,#38b6ff 15%,transparent),transparent 58%);
--ac-v-spring:cubic-bezier(.34,1.56,.64,1);--ac-v-out:cubic-bezier(.22,1,.36,1);--ac-v-expo:cubic-bezier(.16,1,.3,1);--ac-r-lg:18px;--ac-r-md:14px;--ac-r-sm:10px}
/* the workspace: a slow blue aurora and fine star dust behind everything */
.ac-sheet{isolation:isolate;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-v-brand) 6%,var(--ac-bg)),var(--ac-bg) 42%);border-color:var(--ac-v-edge);border-radius:26px;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 40px 90px -36px color-mix(in srgb,var(--ac-v-brand) 48%,transparent),0 12px 32px -16px rgba(11,27,79,.22)}
.ac-sheet::before{content:"";position:absolute;inset:8%;z-index:-1;pointer-events:none;background:linear-gradient(118deg,transparent 38%,rgba(255,255,255,.55) 47%,transparent 56%) 0 0/100% 60% no-repeat,radial-gradient(26% 26% at 16% 16%,color-mix(in srgb,#4d6bfe 46%,transparent),transparent 70%),radial-gradient(24% 24% at 80% 10%,color-mix(in srgb,#38b6ff 38%,transparent),transparent 70%),radial-gradient(22% 22% at 50% 34%,color-mix(in srgb,#7b93ff 24%,transparent),transparent 72%),radial-gradient(30% 26% at 92% 88%,color-mix(in srgb,#38b6ff 16%,transparent),transparent 72%),radial-gradient(26% 24% at 6% 80%,color-mix(in srgb,#4d6bfe 12%,transparent),transparent 72%);filter:blur(30px);opacity:.9;animation:ac-v-aurora 18s ease-in-out infinite alternate}
.ac-sheet::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:radial-gradient(circle,color-mix(in srgb,#4d6bfe 70%,transparent) 0 1.1px,transparent 1.8px),radial-gradient(circle,color-mix(in srgb,#38b6ff 65%,transparent) 0 .8px,transparent 1.5px),radial-gradient(circle,rgba(255,255,255,.95) 0 1.4px,color-mix(in srgb,#8fe3ff 60%,transparent) 2px,transparent 3.4px);background-size:52px 52px,31px 31px,173px 149px;background-position:0 0,14px 19px,40px 30px;-webkit-mask:radial-gradient(90% 60% at 50% 0%,#000,transparent 80%);mask:radial-gradient(90% 60% at 50% 0%,#000,transparent 80%);opacity:.7;animation:ac-v-dust 7s ease-in-out infinite alternate}
@keyframes ac-v-aurora{0%{transform:translate3d(-3%,-2%,0) scale(1)}50%{transform:translate3d(3%,2%,0) scale(1.05)}100%{transform:translate3d(-2%,3%,0) scale(1.03)}}
@keyframes ac-v-dust{0%{opacity:.45}100%{opacity:.85}}
/* glass edges: bright where light falls, a faint blue-cyan fringe where it bends */
:is(.ac-composer-settings,.ac-card:not(.ac-card-excluded):not(.picked))::before,:is(.ac-inline:not(.ac-conversation-run .ac-inline),.ac-conversation-run)::after{content:"";position:absolute;inset:0;z-index:4;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(165deg,rgba(255,255,255,.98),color-mix(in srgb,#8fe3ff 50%,transparent) 26%,color-mix(in srgb,#4d6bfe 20%,transparent) 60%,rgba(255,255,255,.7));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.ac-card-head{background:linear-gradient(180deg,color-mix(in srgb,var(--ac-v-brand) 5%,transparent),transparent)}
.ac-head{border-bottom-color:var(--ac-v-edge);background:transparent}
.ac-action-dock{background:color-mix(in srgb,var(--ac-bg) 74%,transparent);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);box-shadow:inset 0 -1px 0 var(--ac-v-edge),0 10px 24px -20px color-mix(in srgb,var(--ac-v-brand) 50%,transparent)}.ac-bar{border-bottom-color:transparent}
/* glass surfaces in the conversation: light from above, a bright rim instead of hairlines */
.ac-inline,.ac-conversation-run,.ac-composer-settings{position:relative;isolation:isolate;border-color:transparent;border-radius:20px;background:var(--ac-v-glow),var(--ac-v-glass),var(--ac-bg);box-shadow:var(--ac-v-rim),var(--ac-v-shadow)}
.ac-composer-settings{background:radial-gradient(120% 90% at 0% 0%,color-mix(in srgb,#4d6bfe 16%,transparent),transparent 58%),radial-gradient(60% 80% at 100% 0%,color-mix(in srgb,#38b6ff 14%,transparent),transparent 60%),color-mix(in srgb,var(--ac-bg) 80%,transparent);backdrop-filter:blur(18px) saturate(170%);-webkit-backdrop-filter:blur(18px) saturate(170%)}
.ac-composer-settings::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;background:radial-gradient(220px 120px at var(--ac-mx,12%) var(--ac-my,0%),rgba(255,255,255,.55),transparent 70%)}
/* a running comparison: light travels around the edge */
:is(.ac-inline:not(.ac-conversation-run .ac-inline)[data-state=running],.ac-conversation-run:has(.ac-inline[data-state=running]))::before{content:"";position:absolute;inset:0;z-index:4;border-radius:inherit;padding:1.5px;pointer-events:none;background:conic-gradient(from var(--ac-turn),transparent 0 58%,color-mix(in srgb,#38b6ff 75%,transparent) 70%,#fff 75%,color-mix(in srgb,#4d6bfe 80%,transparent) 80%,transparent 92%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:ac-v-turn 4.8s linear infinite}
@keyframes ac-v-turn{to{--ac-turn:360deg}}
.ac-inline-head{background:transparent;border-bottom-color:var(--ac-v-edge)}
/* candidate cards: thick glass, so text stays readable; light follows the pointer */
.ac-card{position:relative;isolation:isolate;border-color:transparent;border-radius:20px;background:radial-gradient(200px 140px at var(--ac-mx,50%) var(--ac-my,-30%),rgba(255,255,255,.6),transparent 70%),var(--ac-v-glass),var(--ac-bg);box-shadow:var(--ac-v-rim),var(--ac-v-shadow);transition:box-shadow .3s var(--ac-v-out)}
.ac-card-head{border-bottom-color:var(--ac-v-edge)}.ac-card-evidence{border-top-color:var(--ac-v-edge)}
.ac-card.picked{box-shadow:var(--ac-v-rim),0 0 0 2px var(--ac-v-brand),0 0 0 6px color-mix(in srgb,var(--ac-v-brand) 13%,transparent),0 26px 60px -22px color-mix(in srgb,var(--ac-v-brand) 62%,transparent)}
.ac-card.picked::before{content:"";position:absolute;inset:-1px;z-index:4;border-radius:inherit;padding:2px;pointer-events:none;background:conic-gradient(from var(--ac-turn),transparent 0 60%,#8fe3ff 72%,#fff 76%,#4d6bfe 82%,transparent 94%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:ac-v-turn 6s linear infinite}
.ac-card.ac-revealing::after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;border-radius:inherit;background:linear-gradient(105deg,transparent 28%,rgba(255,255,255,.78) 45%,color-mix(in srgb,#8fe3ff 70%,transparent) 50%,color-mix(in srgb,#7b93ff 40%,transparent) 54%,transparent 68%);transform:translateX(-110%);animation:ac-v-reveal 1.15s var(--ac-v-expo) forwards}
@keyframes ac-v-reveal{to{transform:translateX(110%)}}
.ac-grid>.ac-card{animation:ac-v-rise .62s var(--ac-v-expo) both}.ac-grid>.ac-card:nth-child(2){animation-delay:60ms}.ac-grid>.ac-card:nth-child(3){animation-delay:120ms}.ac-grid>.ac-card:nth-child(4){animation-delay:180ms}
@keyframes ac-v-rise{from{opacity:0;transform:translateY(14px) scale(.97)}}
.ac-preview-stage,.ac-browser,.ac-shot,.ac-shotwrap{background:linear-gradient(180deg,color-mix(in srgb,var(--ac-v-brand) 5%,var(--ac-l1)),color-mix(in srgb,var(--ac-v-sky) 4%,var(--ac-l1)))}.ac-preview-surface{border-radius:12px;box-shadow:0 0 0 1px var(--ac-v-edge),0 12px 32px -14px rgba(11,27,79,.3)}
.ac-banner,.ac-copy-space,.ac-next,.ac-review{border-radius:var(--ac-r-md);border-color:var(--ac-v-edge);background:var(--ac-v-glow),var(--ac-v-tint);box-shadow:var(--ac-v-rim)}
.ac-banner.warn{background:color-mix(in srgb,var(--ac-warn) 9%,var(--ac-bg))}.ac-banner.err{background:color-mix(in srgb,var(--ac-err) 7%,var(--ac-bg))}
.ac-review{border-color:color-mix(in srgb,var(--ac-v-brand) 40%,transparent);box-shadow:var(--ac-v-rim),var(--ac-v-shadow)}
.ac-hrow{position:relative;border-color:transparent;border-radius:16px;background:radial-gradient(180px 90px at var(--ac-mx,0%) var(--ac-my,0%),color-mix(in srgb,#fff 60%,transparent),transparent 70%),var(--ac-v-glass),var(--ac-bg);box-shadow:var(--ac-v-rim),0 0 0 1px var(--ac-v-edge),0 10px 26px -20px color-mix(in srgb,var(--ac-v-brand) 45%,transparent);transition:transform .24s var(--ac-v-spring),box-shadow .24s var(--ac-v-out)}
.ac-hrow:not(.legacy):hover{transform:translateY(-2px);background:radial-gradient(180px 90px at var(--ac-mx,0%) var(--ac-my,0%),color-mix(in srgb,#fff 70%,transparent),transparent 70%),var(--ac-v-tint);box-shadow:var(--ac-v-rim),var(--ac-v-lift)}
.ac-hrow:not(.legacy):active{transform:scale(.99)}
.ac-history>.ac-hrow{animation:ac-v-rise .46s var(--ac-v-expo) both}.ac-history>.ac-hrow:nth-of-type(2){animation-delay:40ms}.ac-history>.ac-hrow:nth-of-type(3){animation-delay:80ms}.ac-history>.ac-hrow:nth-of-type(4){animation-delay:120ms}.ac-history>.ac-hrow:nth-of-type(5){animation-delay:160ms}
/* the mark: a drop of blue glass with a spark of light */
.ac-logo{position:relative;color:#fff;border-radius:10px;background:radial-gradient(70% 60% at 28% 16%,rgba(255,255,255,.55),transparent 62%),linear-gradient(140deg,#1d38c9,#3053f0 52%,#2a7de8);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -3px 6px rgba(4,16,64,.32),0 6px 16px -6px color-mix(in srgb,var(--ac-v-brand) 85%,transparent);text-shadow:0 1px 1px rgba(4,16,64,.35)}
.ac-logo::after{content:"";position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:radial-gradient(circle,#fff 30%,#8fe3ff 70%);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 3px #38b6ff);animation:ac-v-twinkle 2.8s ease-in-out infinite}
@keyframes ac-v-twinkle{50%{transform:scale(.68) rotate(22deg);opacity:.7}}
.ac-label{position:relative;overflow:hidden;color:#fff;border-radius:9px;background:#2443d6 linear-gradient(135deg,#2443d6,#3657f5);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -2px 4px rgba(4,16,64,.3),0 4px 12px -4px color-mix(in srgb,var(--ac-v-brand) 70%,transparent)}
.ac-label::after{content:"";position:absolute;left:3px;right:3px;top:2px;height:45%;border-radius:7px 7px 10px 10px;background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0));pointer-events:none}
[data-label=B] .ac-label{background:#0a5bc4 linear-gradient(135deg,#0a5bc4,#1272dc)}[data-label=C] .ac-label{background:#3b33c9 linear-gradient(135deg,#3b33c9,#5148e6)}[data-label=D] .ac-label{background:#066a84 linear-gradient(135deg,#066a84,#0a7f99)}
/* controls: glass pills; the primary is solid blue glass with a soft blue shadow */
.ac-btn{border-radius:999px;border-color:transparent;background:color-mix(in srgb,var(--ac-v-brand) 8%,var(--ac-bg));color:var(--ac-v-ink);font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 12%,transparent);transition:transform .16s var(--ac-v-spring),background .16s,box-shadow .2s}
.ac-btn:hover:not(:disabled){background:var(--ac-v-tint-2)}
.ac-btn:active:not(:disabled){transform:scale(.97)}
.ac-btn.primary{position:relative;isolation:isolate;overflow:hidden;background:#2f4fe8 var(--ac-v-grad);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.38),inset 0 -1px 0 rgba(4,16,64,.28),0 10px 22px -10px color-mix(in srgb,var(--ac-v-brand) 95%,transparent)}
.ac-btn.primary::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.4) 48%,transparent 62%);transform:translateX(-120%);transition:transform .7s var(--ac-v-expo)}
.ac-btn.primary::after{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(90px 46px at var(--ac-mx,50%) var(--ac-my,0%),rgba(255,255,255,.32),transparent 70%);opacity:0;transition:opacity .2s}
.ac-btn.primary:hover:not(:disabled){background:#2f4fe8 var(--ac-v-grad);filter:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.42),inset 0 -1px 0 rgba(4,16,64,.28),0 14px 28px -10px color-mix(in srgb,var(--ac-v-brand) 100%,transparent)}
.ac-btn.primary:hover:not(:disabled)::before{transform:translateX(120%)}.ac-btn.primary:hover:not(:disabled)::after{opacity:1}
.ac-btn.danger{background:color-mix(in srgb,var(--ac-err) 8%,var(--ac-bg));color:var(--ac-err);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),inset 0 0 0 1px color-mix(in srgb,var(--ac-err) 16%,transparent)}
.ac-text-btn{color:var(--ac-v-ink);font-weight:600;border-radius:8px}.ac-text-btn:hover{background:var(--ac-v-tint)}
.ac-icon-btn{border-radius:999px}.ac-icon-btn:hover{background:var(--ac-v-tint);color:var(--ac-v-ink)}
.ac-chip{border-color:transparent;background:color-mix(in srgb,var(--ac-v-brand) 7%,var(--ac-bg));color:var(--ac-fg);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 13%,transparent);transition:transform .16s var(--ac-v-spring),background .16s,color .16s}
.ac-chip:hover:not(:disabled):not(.on){background:var(--ac-v-tint-2);color:var(--ac-fg)}.ac-chip.on:hover:not(:disabled){filter:brightness(1.06)}.ac-chip:active:not(:disabled){transform:scale(.96)}.ac-chip:disabled{opacity:.55;cursor:default}
.ac-chip.on{background:#2a49e0 linear-gradient(135deg,#2443d6,#3053f0);color:#fff;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 6px 14px -6px color-mix(in srgb,var(--ac-v-brand) 80%,transparent);animation:ac-v-pop .36s var(--ac-v-spring)}
/* segmented controls: a glass lens slides to the chosen option */
.ac-seg{position:relative;isolation:isolate;background:color-mix(in srgb,var(--ac-v-brand) 8%,var(--ac-bg));border-radius:999px;padding:3px;box-shadow:inset 0 1px 2px rgba(11,27,79,.08),inset 0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 9%,transparent)}
.ac-seg button{position:relative;z-index:1;border-radius:999px;color:var(--ac-fg2);transition:color .22s var(--ac-v-out),transform .2s var(--ac-v-spring)}
.ac-seg button:hover:not(:disabled):not(.on){color:var(--ac-fg)}.ac-seg button:active:not(:disabled){transform:scale(.96)}
.ac-seg button.on{background:var(--ac-bg);color:var(--ac-v-ink);font-weight:600;box-shadow:inset 0 1px 0 #fff,0 0 0 1px var(--ac-v-edge),0 4px 12px -6px color-mix(in srgb,var(--ac-v-brand) 50%,transparent)}
.ac-seg.ac-lensed button.on{background:transparent;box-shadow:none}
.ac-seg::before{content:"";position:absolute;z-index:0;left:0;top:0;width:var(--ac-lens-w,0);height:var(--ac-lens-h,0);transform:translate(var(--ac-lens-x,0),var(--ac-lens-y,0));border-radius:999px;opacity:0;pointer-events:none;background:radial-gradient(120% 150% at 30% -10%,#fff 40%,color-mix(in srgb,#fff 78%,#8fe3ff));box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 color-mix(in srgb,var(--ac-v-brand) 16%,transparent),var(--ac-v-fringe),0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 16%,transparent),0 6px 16px -6px color-mix(in srgb,var(--ac-v-brand) 60%,transparent);transition:transform .46s var(--ac-v-spring),width .46s var(--ac-v-spring),height .3s var(--ac-v-out),opacity .2s}
.ac-seg.ac-lensed::before{opacity:1}.ac-seg.ac-lens-snap::before{transition:none}.ac-seg:has(>button:disabled)::before{opacity:.6}
@keyframes ac-v-pop{0%{transform:scale(.94)}60%{transform:scale(1.04)}}
.ac-tab{border-radius:999px}.ac-tab.on{background:var(--ac-v-tint);color:var(--ac-v-ink);font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 0 0 1px var(--ac-v-edge)}
.ac-budget select,.ac-models select,.ac-language select,.ac-history-controls select,.ac-history-controls input,.ac-limit select{border-radius:10px;border-color:var(--ac-v-edge);background:color-mix(in srgb,var(--ac-bg) 86%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
.ac-field{border-color:var(--ac-v-edge);border-radius:18px;background:color-mix(in srgb,var(--ac-bg) 88%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),var(--ac-v-shadow)}.ac-field:focus-within{border-color:var(--ac-v-brand);box-shadow:0 0 0 4px color-mix(in srgb,var(--ac-v-brand) 16%,transparent),var(--ac-v-shadow)}
.ac-mode-btn{border-radius:999px;transition:transform .2s var(--ac-v-spring),box-shadow .2s}
.ac-mode-btn.on{position:relative;background:#2f4fe8 linear-gradient(135deg,#2443d6,#3053f0 55%,#2f72ea);color:#fff;border-color:transparent;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 3px color-mix(in srgb,#4d6bfe 18%,transparent),0 6px 16px -6px #3657f5;animation:ac-v-pop .38s var(--ac-v-spring)}
/* status: work in progress is warm, done is calm, live progress flows like liquid */
.ac-pill{border-radius:999px}
.ac-pill.brand{background:color-mix(in srgb,var(--ac-v-doing) 12%,var(--ac-bg));color:var(--ac-fg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac-v-doing) 60%,transparent)}
.ac-pill.brand .ac-dot,.ac-pill.brand .ac-spin{color:#c46f00}
.ac-pill.ok{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac-ok) 26%,transparent)}
.ac-track{gap:5px}.ac-track i{height:6px;border-radius:999px;background:color-mix(in srgb,var(--ac-v-brand) 10%,var(--ac-l2));box-shadow:inset 0 1px 1px rgba(11,27,79,.08)}
.ac-track i.done{background:linear-gradient(90deg,#3657f5,#38b6ff)}
.ac-track i.now{position:relative;overflow:hidden;background:var(--ac-v-flow);background-size:300% 100%;animation:ac-v-flow 2.6s linear infinite;box-shadow:0 0 10px -2px color-mix(in srgb,#38b6ff 80%,transparent)}
.ac-track i.now::after{content:"";position:absolute;top:0;bottom:0;width:30%;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);transform:translateX(-120%);animation:ac-v-drop 1.7s var(--ac-v-out) infinite}
@keyframes ac-v-flow{to{background-position:-300% 0}}@keyframes ac-v-drop{to{transform:translateX(380%)}}
.ac-skel i{background:linear-gradient(90deg,var(--ac-v-tint),var(--ac-v-tint-2),var(--ac-v-tint));background-size:200% 100%;animation:ac-v-shimmer 1.4s linear infinite}
@keyframes ac-v-shimmer{to{background-position:-200% 0}}
.ac-check{border-color:transparent;border-radius:999px;background:var(--ac-l1)}.ac-check.passed{background:color-mix(in srgb,var(--ac-ok) 10%,var(--ac-bg))}.ac-check.failed,.ac-check.timeout{background:color-mix(in srgb,var(--ac-err) 9%,var(--ac-bg))}
.ac-fail{border-radius:var(--ac-r-md)}.ac-salvage{border-color:var(--ac-v-edge);border-radius:12px}
.ac-guide-steps li:before{background:#2f4fe8 var(--ac-v-grad);color:#fff;border-radius:10px;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 6px 14px -6px color-mix(in srgb,var(--ac-v-brand) 80%,transparent)}
.ac-case{border:0;border-radius:20px;background:var(--ac-v-glow),var(--ac-v-tint);box-shadow:var(--ac-v-rim),var(--ac-v-shadow)}
.ac-h1{background:linear-gradient(transparent 62%,color-mix(in srgb,#8fe3ff 62%,transparent) 62%,color-mix(in srgb,#8fe3ff 62%,transparent) 92%,transparent 92%) no-repeat;background-size:100% 100%;display:inline}
:is(.ac-btn,.ac-chip,.ac-icon-btn,.ac-tab,.ac-seg button,.ac-text-btn,.ac-mode-btn):focus-visible{outline:2px solid var(--ac-v-brand);outline-offset:2px;box-shadow:0 0 0 5px color-mix(in srgb,var(--ac-v-brand) 18%,transparent)}
/* how a comparison is tied to the main conversation */
.ac-link-strip{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:12px 20px 0;font-size:12px;color:var(--ac-fg2)}
.ac-inline .ac-link-strip{margin:10px 12px 0}
.ac-link-item{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:100%}.ac-link-item>summary{cursor:pointer;display:inline-flex;align-items:center;gap:6px}.ac-link-item.ok{color:var(--ac-fg)}
.ac-link-dot{width:8px;height:8px;border-radius:50%;background:var(--ac-l2);flex:none}.ac-link-dot.in{background:var(--ac-v-brand)}.ac-link-dot.ok{background:var(--ac-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-ok) 18%,transparent)}.ac-link-dot.wait{background:var(--ac-v-doing);animation:ac-pulse 1.6s ease-in-out infinite}
.ac-context-text{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0;padding:10px 12px;border-radius:12px;background:var(--ac-v-tint);font:12px/1.6 var(--dsw-font-family,inherit);color:var(--ac-fg)}
/* main-conversation context in the settings */
.ac-context{display:flex;flex-direction:column;gap:6px}
.ac-context-label{font-size:12px;font-weight:600;color:var(--ac-fg)}
.ac-context .ac-seg button{font-size:12px;height:28px;padding:0 12px}
.ac-context-summary{font-size:12px;color:var(--ac-fg2)}.ac-context-summary>details{margin-top:4px}.ac-context-summary summary{cursor:pointer;color:var(--ac-v-ink);font-weight:600}
.ac-context-picker{border-radius:14px;background:var(--ac-v-tint);padding:8px 10px;max-height:260px;overflow:auto}
.ac-context-picker ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.ac-context-picker li label{display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:10px;cursor:pointer;transition:background .16s}
.ac-context-picker li label:hover{background:var(--ac-bg)}.ac-context-picker li.on label{background:var(--ac-bg);box-shadow:0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 35%,transparent)}
.ac-context-picker input{accent-color:var(--ac-v-brand);margin-top:2px;flex:none;width:16px;height:16px}
.ac-context-role{flex:none;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:var(--ac-l2);color:var(--ac-fg)}
.ac-context-role.user{background:color-mix(in srgb,var(--ac-v-brand) 14%,var(--ac-bg))}.ac-context-role.note{background:color-mix(in srgb,var(--ac-v-accent) 55%,var(--ac-bg))}.ac-context-role.assistant{background:color-mix(in srgb,#3496ff 14%,var(--ac-bg))}
.ac-context-preview{flex:1;min-width:0;font-size:12px;line-height:1.5;color:var(--ac-fg);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ac-rerun{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.ac-result{display:flex;flex-direction:column;gap:8px;padding:12px 14px;min-height:220px;max-height:560px;flex:1}
.ac-result-head{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap}
.ac-result-head>.ac-copy{margin-left:auto}
.ac-grid:has(.ac-result){align-items:stretch}
.ac-answer{flex:1;overflow:auto;overflow-wrap:anywhere;font-size:14px;line-height:1.7;color:var(--ac-fg);background:var(--ac-v-tint);border-radius:14px;padding:12px 16px}
.ac-md>:first-child{margin-top:0}.ac-md>:last-child{margin-bottom:0}
.ac-md p{margin:0 0 .7em}
.ac-md :is(h3,h4,h5,h6){margin:1em 0 .4em;line-height:1.35;color:var(--ac-fg);font-weight:700}
.ac-md h3{font-size:16px}.ac-md h4{font-size:15px}.ac-md :is(h5,h6){font-size:14px}
.ac-md :is(ul,ol){margin:0 0 .7em;padding-left:1.4em}.ac-md li{margin:.2em 0}.ac-md li>p{margin:0}.ac-md li>:is(ul,ol){margin:.2em 0 0}
.ac-md li::marker{color:var(--ac-v-ink)}
.ac-md code{font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:color-mix(in srgb,var(--ac-fg) 8%,transparent);border-radius:5px;padding:1px 5px}
.ac-md blockquote{margin:0 0 .7em;padding:2px 0 2px 12px;border-left:3px solid color-mix(in srgb,var(--ac-v-brand) 45%,transparent);color:var(--ac-fg2)}
.ac-md hr{border:0;border-top:1px solid color-mix(in srgb,var(--ac-fg) 14%,transparent);margin:1em 0}
.ac-md a{color:var(--ac-v-ink);text-decoration:underline;text-underline-offset:2px}
.ac-md-code{margin:0 0 .8em;border-radius:12px;overflow:hidden;background:var(--ac-bg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac-fg) 12%,transparent)}
.ac-md-code-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px 2px 12px;font-size:11.5px;color:var(--ac-fg2);border-bottom:1px solid color-mix(in srgb,var(--ac-fg) 10%,transparent)}
.ac-md-code pre{margin:0;padding:10px 12px;overflow:auto;white-space:pre;font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ac-md-code pre code{background:none;padding:0;border-radius:0}
.ac-md-table{overflow:auto;margin:0 0 .8em;border-radius:10px;background:var(--ac-bg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac-fg) 12%,transparent)}
.ac-md table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.5}
.ac-md :is(th,td){padding:6px 10px;border-bottom:1px solid color-mix(in srgb,var(--ac-fg) 10%,transparent);text-align:left;vertical-align:top}
.ac-md th{font-weight:600;background:color-mix(in srgb,var(--ac-v-brand) 7%,var(--ac-bg))}.ac-md tr:last-child td{border-bottom:0}
.ac-md-table:focus-visible,.ac-md-code pre:focus-visible,.ac-answer:focus-visible{outline:2px solid var(--ac-v-brand);outline-offset:2px}
.ac-copy.done{color:var(--ac-ok)}
.ac-pill.ac-picked{flex:none;background:var(--ac-v-brand);color:#fff;box-shadow:none;font-weight:700}
.ac-style-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
.ac-style-row-label{font-size:12px;color:var(--ac-fg2);font-weight:600;margin-right:2px}
.ac-style-slot{display:inline-flex;align-items:center;gap:4px;padding:2px;border-radius:999px;background:var(--ac-v-tint)}
.ac-style-slot select,.ac-style-note{height:28px;border:0;border-radius:999px;background:var(--ac-bg);color:var(--ac-fg);font:inherit;font-size:12px;padding:0 10px;box-shadow:0 0 0 1px var(--ac-v-edge)}
.ac-style-slot select:focus-visible,.ac-style-note:focus-visible{outline:2px solid var(--ac-v-brand);outline-offset:1px}
.ac-style-note{min-width:180px;max-width:min(320px,70vw)}
.ac-style-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:999px;background:var(--ac-fg);color:var(--ac-bg);font-size:11px;font-weight:700}
.ac-composer-settings .ac-models{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
.ac-composer-settings .ac-models label{display:inline-flex;flex-direction:row;align-items:center;gap:4px;padding:2px;border-radius:999px;background:var(--ac-v-tint)}
.ac-composer-settings .ac-models select{width:auto;min-width:150px;max-width:240px;height:28px;border-radius:999px;font-size:12px}
.ac-settings-facts{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 14px}
.ac-usage-hint{color:var(--ac-warn);font-weight:600}
.ac-style-habit{color:var(--ac-v-ink);font-weight:600}
.ac-exclude{font-size:12px}
.ac-grid.count-1{grid-template-columns:minmax(0,1fr)}
.ac-sheet .ac-grid.count-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ac-grid>.ac-card-excluded{grid-column:1/-1;order:9;min-height:0;padding:8px 12px;opacity:.9;animation:none}
.ac-card-excluded .ac-label{width:22px;height:22px;font-size:12px}
@media(max-width:900px){.ac-sheet .ac-grid.count-3{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media(max-width:600px){.ac-sheet .ac-grid.count-3,.ac-grid.count-4{grid-template-columns:minmax(0,1fr)}.ac-style-note{min-width:0;flex:1}}
.ac-path-chip{display:block;width:fit-content;max-width:100%;margin:4px 0;padding:3px 8px;border-radius:8px;background:var(--ac-v-tint);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ac-fg);overflow-wrap:anywhere}
.ac-files{display:grid;grid-template-columns:minmax(120px,34%) 1fr;gap:10px;min-height:0;flex:1}
.ac-file-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;overflow:auto;max-height:420px}
.ac-file{all:unset;box-sizing:border-box;display:block;width:100%;padding:6px 9px;border-radius:9px;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ac-fg);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-file:hover{background:var(--ac-v-tint)}.ac-file.on{background:var(--ac-v-tint);box-shadow:inset 3px 0 0 var(--ac-v-brand);color:var(--ac-v-ink);font-weight:600}
.ac-file:focus-visible{outline:2px solid var(--ac-v-brand);outline-offset:1px}
.ac-file-view{min-width:0;overflow:auto;max-height:420px}
.ac-file-text{margin:0;white-space:pre;overflow:auto;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--ac-v-tint);border-radius:12px;padding:10px 12px;color:var(--ac-fg)}
.ac-project-notes{display:flex;flex-direction:column;gap:6px}
.ac-info{margin:0;font-size:12.5px;line-height:1.55;color:var(--ac-fg);background:color-mix(in srgb,var(--ac-v-brand) 8%,var(--ac-bg));border-radius:12px;padding:8px 12px}
.ac-enable-git{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;font-size:12.5px;color:var(--ac-fg2);padding:0 4px}
.ac-enable-git>.ac-text-btn{flex:none;font-size:12.5px}
.ac-enable-git>p{flex-basis:100%}
.ac-enable-git.confirm{flex-direction:column;align-items:stretch;gap:8px;padding:10px 12px;border-radius:12px;background:var(--ac-v-tint)}
.ac-enable-git p{margin:0;color:var(--ac-fg);line-height:1.55}
@media(max-width:600px){.ac-files{grid-template-columns:1fr}.ac-file-list{max-height:140px}}
.ac-pill.ac-picked{background:#2a49e0 linear-gradient(135deg,#2443d6,#3053f0);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 4px 12px -4px color-mix(in srgb,var(--ac-v-brand) 80%,transparent)}
.ac-style-slot{box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 10%,transparent)}
.ac-style-badge{background:#2a49e0 linear-gradient(135deg,#2443d6,#3053f0);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}
.ac-combos{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
.ac-combo{display:inline-flex;align-items:baseline;gap:5px}.ac-combo small{font-size:11px;font-weight:500;color:var(--ac-fg2)}.ac-combo.on small{color:#fff;opacity:.85}
/* progress as liquid in a glass sphere */
.ac-liquid{position:relative;width:96px;height:96px;flex:none;border-radius:50%;overflow:hidden;isolation:isolate;background:radial-gradient(60% 50% at 30% 22%,rgba(255,255,255,.95),rgba(255,255,255,0) 62%),color-mix(in srgb,var(--ac-v-brand) 6%,var(--ac-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac-v-brand) 18%,transparent),inset 0 -10px 20px -8px color-mix(in srgb,var(--ac-v-brand) 26%,transparent),inset 0 6px 12px -6px rgba(255,255,255,.95),0 16px 32px -14px color-mix(in srgb,var(--ac-v-brand) 60%,transparent)}
.ac-liquid-wave{position:absolute;left:-55%;width:210%;aspect-ratio:1;top:calc(100% - var(--ac-level,30%));z-index:0;border-radius:43%;background:linear-gradient(180deg,#4d6bfe,#2443d6 70%);opacity:.92;animation:ac-v-wave 7s linear infinite;transition:top 1s var(--ac-v-expo)}
.ac-liquid-wave.back{top:calc(100% - var(--ac-level,30%) - 5px);border-radius:39%;background:linear-gradient(180deg,#38b6ff,#3657f5 70%);opacity:.5;animation-duration:11s;animation-direction:reverse}
@keyframes ac-v-wave{to{transform:rotate(360deg)}}
.ac-liquid b{position:absolute;bottom:-8px;z-index:1;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.75);box-shadow:0 0 6px rgba(143,227,255,.9);opacity:0;animation:ac-v-bubble 3.4s ease-in infinite}
.ac-liquid b:nth-of-type(1){left:26%}.ac-liquid b:nth-of-type(2){left:48%;width:4px;height:4px;animation-delay:.9s}.ac-liquid b:nth-of-type(3){left:64%;animation-delay:1.7s}.ac-liquid b:nth-of-type(4){left:38%;width:3px;height:3px;animation-delay:2.5s}
@keyframes ac-v-bubble{0%{transform:translateY(0) scale(.6);opacity:0}18%{opacity:.95}100%{transform:translateY(-78px) scale(1.1);opacity:0}}
.ac-liquid em{position:absolute;inset:0;z-index:2;border-radius:50%;pointer-events:none;background:radial-gradient(34% 26% at 32% 24%,rgba(255,255,255,.85),transparent 70%),conic-gradient(from 210deg,transparent 0 20%,color-mix(in srgb,#8fe3ff 30%,transparent) 32%,transparent 44%);box-shadow:inset 1px 0 0 color-mix(in srgb,#8fe3ff 55%,transparent),inset -1px 0 0 color-mix(in srgb,#7b6cff 40%,transparent)}
.ac-liquid:not(.busy) :is(.ac-liquid-wave,b){animation-play-state:paused}
.ac-empty{gap:14px}
/* the pick lands: a ring and sparks of light */
.ac-burst{position:absolute;width:0;height:0;z-index:40;pointer-events:none}
.ac-burst i{position:absolute;left:0;top:0;border-radius:50%;box-shadow:0 0 8px rgba(56,182,255,.9)}
.ac-burst i.star{border-radius:0;width:10px!important;height:10px!important;clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)}
.ac-burst b{position:absolute;left:0;top:0;width:46px;height:46px;border-radius:50%;border:2px solid #38b6ff;box-shadow:0 0 18px rgba(56,182,255,.8),inset 0 0 12px rgba(143,227,255,.6)}
/* why the pick won */
.ac-why{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:12px 20px 0;padding:10px 14px;border-radius:16px;background:var(--ac-v-glow),color-mix(in srgb,var(--ac-v-brand) 5%,var(--ac-bg));box-shadow:var(--ac-v-rim),0 0 0 1px var(--ac-v-edge)}
.ac-inline .ac-why{margin:10px 12px 0}
.ac-why-q{font-weight:700;font-size:13px;color:var(--ac-fg)}
.ac-why-chips{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.ac-why-note{height:28px;min-width:200px;max-width:min(320px,100%);border:0;border-radius:999px;padding:0 12px;background:var(--ac-bg);color:var(--ac-fg);font:inherit;font-size:12px;box-shadow:inset 0 1px 2px rgba(11,27,79,.08),0 0 0 1px var(--ac-v-edge)}
.ac-why-note:focus-visible{outline:2px solid var(--ac-v-brand);outline-offset:1px}
.ac-why>.ac-meta{flex-basis:100%}.ac-why.said>.ac-meta{color:var(--ac-v-ink)}
@media(max-width:600px){.ac-why{margin:10px 12px 0}.ac-why-note{min-width:0;flex:1 1 160px}.ac-why-link{display:none}}
@media(prefers-color-scheme:dark){.ac-root{--ac-v-brand:#6f86ff;--ac-v-brand-2:#8fa2ff;--ac-v-ink:#aebcff;--ac-v-doing:#ffb547;--ac-brand:var(--ac-v-brand);
--ac-v-glass:linear-gradient(180deg,color-mix(in srgb,#1e2442 60%,var(--ac-bg)),color-mix(in srgb,#151a2c 34%,var(--ac-bg)));
--ac-v-rim:inset 0 1px 0 rgba(255,255,255,.1),inset 0 0 0 1px rgba(255,255,255,.04);
--ac-v-fringe:inset 1px 0 0 color-mix(in srgb,#8fe3ff 35%,transparent),inset -1px 0 0 color-mix(in srgb,#7b6cff 30%,transparent);
--ac-v-shadow:0 0 0 1px color-mix(in srgb,#7b93ff 16%,transparent),0 18px 44px -20px rgba(0,0,0,.75);
--ac-v-lift:0 0 0 1px color-mix(in srgb,#7b93ff 26%,transparent),0 24px 52px -20px rgba(0,0,0,.8),0 0 28px -10px color-mix(in srgb,#4d6bfe 50%,transparent);
--ac-v-glow:radial-gradient(110% 70% at 8% 0%,color-mix(in srgb,#4d6bfe 24%,transparent),transparent 62%),radial-gradient(70% 50% at 100% 0%,color-mix(in srgb,#38b6ff 13%,transparent),transparent 58%)}
.ac-sheet{background:linear-gradient(180deg,color-mix(in srgb,#2a3a8f 22%,var(--ac-bg)),var(--ac-bg) 46%);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 40px 90px -30px rgba(0,0,0,.8),0 0 0 1px color-mix(in srgb,#7b93ff 14%,transparent)}
.ac-sheet::before{opacity:.7}.ac-sheet::after{opacity:.65}
:is(.ac-composer-settings,.ac-card:not(.ac-card-excluded):not(.picked))::before,:is(.ac-inline:not(.ac-conversation-run .ac-inline),.ac-conversation-run)::after{background:linear-gradient(165deg,rgba(255,255,255,.24),color-mix(in srgb,#8fe3ff 22%,transparent) 28%,color-mix(in srgb,#4d6bfe 30%,transparent) 64%,rgba(255,255,255,.06))}
.ac-composer-settings{background:radial-gradient(120% 90% at 0% 0%,color-mix(in srgb,#4d6bfe 22%,transparent),transparent 58%),radial-gradient(60% 80% at 100% 0%,color-mix(in srgb,#38b6ff 12%,transparent),transparent 60%),color-mix(in srgb,var(--ac-bg) 82%,transparent)}
.ac-composer-settings::after{background:radial-gradient(220px 120px at var(--ac-mx,12%) var(--ac-my,0%),rgba(143,163,255,.12),transparent 70%)}
.ac-card{background:radial-gradient(200px 140px at var(--ac-mx,50%) var(--ac-my,-30%),rgba(143,163,255,.12),transparent 70%),var(--ac-v-glass),var(--ac-bg)}
.ac-hrow{background:radial-gradient(180px 90px at var(--ac-mx,0%) var(--ac-my,0%),rgba(143,163,255,.1),transparent 70%),var(--ac-v-glass),var(--ac-bg)}
.ac-hrow:not(.legacy):hover{background:radial-gradient(180px 90px at var(--ac-mx,0%) var(--ac-my,0%),rgba(143,163,255,.16),transparent 70%),var(--ac-v-tint)}
.ac-btn,.ac-chip,.ac-style-slot{box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 0 0 1px color-mix(in srgb,#7b93ff 20%,transparent)}
.ac-btn.primary,.ac-btn.primary:hover:not(:disabled){box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.3),0 10px 24px -10px rgba(77,107,254,.75)}
.ac-chip.on{box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 6px 16px -6px rgba(77,107,254,.7)}
.ac-seg{background:color-mix(in srgb,#7b93ff 10%,var(--ac-bg));box-shadow:inset 0 1px 2px rgba(0,0,0,.35),inset 0 0 0 1px color-mix(in srgb,#7b93ff 14%,transparent)}
.ac-seg button.on{background:color-mix(in srgb,#7b93ff 22%,var(--ac-bg));box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.ac-seg::before{background:radial-gradient(120% 150% at 30% -10%,color-mix(in srgb,#8fa2ff 34%,var(--ac-bg)),color-mix(in srgb,#4d6bfe 22%,var(--ac-bg)));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),var(--ac-v-fringe),0 0 0 1px color-mix(in srgb,#8fa2ff 30%,transparent),0 6px 18px -6px rgba(77,107,254,.6)}
.ac-tab.on{box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 0 0 1px var(--ac-v-edge)}
.ac-field{box-shadow:inset 0 1px 0 rgba(255,255,255,.05),var(--ac-v-shadow)}
.ac-budget select,.ac-models select,.ac-language select,.ac-history-controls select,.ac-history-controls input,.ac-limit select{box-shadow:none}
.ac-card.picked{box-shadow:var(--ac-v-rim),0 0 0 2px #6f86ff,0 0 0 6px color-mix(in srgb,#6f86ff 18%,transparent),0 0 40px -8px color-mix(in srgb,#4d6bfe 55%,transparent)}
.ac-pill.brand .ac-dot,.ac-pill.brand .ac-spin{color:var(--ac-v-doing)}
.ac-liquid{background:radial-gradient(60% 50% at 30% 22%,rgba(255,255,255,.22),rgba(255,255,255,0) 62%),color-mix(in srgb,#4d6bfe 10%,var(--ac-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,#7b93ff 26%,transparent),inset 0 -10px 20px -8px rgba(77,107,254,.35),0 0 30px -8px rgba(77,107,254,.5)}
.ac-liquid em{background:radial-gradient(34% 26% at 32% 24%,rgba(255,255,255,.35),transparent 70%)}
.ac-h1{background:linear-gradient(transparent 62%,color-mix(in srgb,#3657f5 55%,transparent) 62%,color-mix(in srgb,#3657f5 55%,transparent) 92%,transparent 92%) no-repeat}
.ac-why-note{box-shadow:inset 0 1px 2px rgba(0,0,0,.3),0 0 0 1px var(--ac-v-edge)}}
@media(prefers-reduced-transparency:reduce){.ac-action-dock,.ac-root.ac-composer-settings{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--ac-bg)}.ac-sheet::before,.ac-sheet::after{display:none}}
@media(forced-colors:active){.ac-seg::before,.ac-sheet::before,.ac-sheet::after,.ac-burst{display:none}.ac-seg.ac-lensed button.on,.ac-chip.on{forced-color-adjust:none;background:Highlight;color:HighlightText}.ac-card,.ac-inline,.ac-composer-settings,.ac-conversation-run{border:1px solid CanvasText}}
`

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
.ac-fail{flex:1;margin:12px;padding:12px;border-radius:var(--ac-r-md);background:color-mix(in srgb,var(--ac-err) 7%,transparent);color:var(--ac-fg);overflow:auto;font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.ac-fail b{display:block;color:var(--ac-err);margin-bottom:6px}
.ac-fail.interrupted{background:color-mix(in srgb,var(--ac-warn) 8%,transparent)}
.ac-fail.interrupted b{color:var(--ac-warn)}
.ac-install-log{max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px}
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
.ac-settings-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.ac-settings-row>.ac-seg button{font-size:12px;height:28px;padding:0 10px}.ac-settings-row>.ac-btn{margin-left:auto}.ac-settings-foot{font-size:11px;color:var(--ac-fg2);display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 14px}.ac-settings-foot>.ac-details{font-size:11px}.ac-settings-foot>.ac-details[open]{flex-basis:100%}.ac-settings-project{overflow-wrap:anywhere}.ac-composer-settings .ac-models{max-width:100%}.ac-composer-settings .ac-models select{min-width:0;width:100%}.ac-composer-settings .ac-feedback{padding:8px;font-size:12px}
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
${VISUAL}
@media(max-width:600px){.ac-language select{max-width:72px}.ac-header-tools{gap:4px}.ac-header-tools .ac-header-btn{width:28px;min-width:28px;padding:0;justify-content:center}.ac-header-label{display:none}.ac-header-glyph{display:block}.ac-settings-row>.ac-budget{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;flex:1 1 220px}.ac-settings-row>.ac-budget select{min-width:0;flex:1;max-width:100%}.ac-settings-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:8px}.ac-settings-head>div{display:contents}.ac-settings-head .ac-logo{grid-column:1;grid-row:1}.ac-settings-head b{grid-column:2;grid-row:1}.ac-settings-head>div>span{grid-column:1/-1;grid-row:2;margin:0}.ac-settings-head>button{grid-row:1}.ac-root[lang=en] .ac-bar .ac-btn{min-width:100px}.ac-root[lang=en] .ac-settings-row>.ac-seg{flex-wrap:wrap;max-width:100%}}
`
