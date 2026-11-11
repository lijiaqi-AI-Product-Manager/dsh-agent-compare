/**
 * Light, flow and particles over the plain interface: a glass lens that slides
 * between the options of a segmented control, light that follows the pointer
 * on glass surfaces, a liquid meter for progress and a short burst of light
 * when a pick lands. Nothing here carries information the text does not, the
 * interface works without it, and reduced motion keeps everything still.
 */
import React from 'react'

const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const attached = new WeakSet<Element>()
const owns = (root: Element, element: Element): boolean => element.closest('.ac-root') === root

/** Follow the selected option of each segmented control and the pointer over glass inside `root`. */
export function attachFx(root: HTMLElement): () => void {
  if (attached.has(root) || typeof window === 'undefined') return () => {}
  attached.add(root)
  let frame = 0
  let pointer: PointerEvent | undefined
  const placeLenses = (): void => {
    for (const seg of root.querySelectorAll<HTMLElement>('.ac-seg')) {
      if (!owns(root, seg)) continue
      const on = seg.querySelector<HTMLElement>(':scope > button.on')
      if (!on || on.offsetParent !== seg) {
        if (seg.dataset.lens !== undefined) { delete seg.dataset.lens; seg.classList.remove('ac-lensed') }
        continue
      }
      const box = `${on.offsetLeft},${on.offsetTop},${on.offsetWidth},${on.offsetHeight}`
      if (seg.dataset.lens === box) continue
      // The first placement appears in place; later ones slide.
      const first = seg.dataset.lens === undefined
      seg.dataset.lens = box
      if (first) seg.classList.add('ac-lens-snap')
      seg.style.setProperty('--ac-lens-x', `${on.offsetLeft}px`)
      seg.style.setProperty('--ac-lens-y', `${on.offsetTop}px`)
      seg.style.setProperty('--ac-lens-w', `${on.offsetWidth}px`)
      seg.style.setProperty('--ac-lens-h', `${on.offsetHeight}px`)
      seg.classList.add('ac-lensed')
      if (first) requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.remove('ac-lens-snap')))
    }
  }
  const light = (event: PointerEvent): void => {
    const target = (event.target as Element | null)?.closest?.('.ac-card, .ac-composer-settings, .ac-hrow, .ac-btn.primary, .ac-logo')
    if (!(target instanceof HTMLElement) || !owns(root, target)) return
    const box = target.getBoundingClientRect()
    if (!box.width || !box.height) return
    target.style.setProperty('--ac-mx', `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)}%`)
    target.style.setProperty('--ac-my', `${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}%`)
  }
  const tick = (): void => {
    frame = 0
    placeLenses()
    if (pointer) { light(pointer); pointer = undefined }
  }
  const schedule = (): void => { if (!frame) frame = requestAnimationFrame(tick) }
  const move = (event: PointerEvent): void => { if (event.pointerType === 'mouse' && !reduced()) { pointer = event; schedule() } }
  const mutations = new MutationObserver(schedule)
  mutations.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'hidden', 'open'] })
  const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined
  sizes?.observe(root)
  root.addEventListener('pointermove', move, { passive: true })
  void document.fonts?.ready.then(schedule, () => {})
  schedule()
  return () => {
    attached.delete(root)
    mutations.disconnect()
    sizes?.disconnect()
    root.removeEventListener('pointermove', move)
    if (frame) cancelAnimationFrame(frame)
  }
}

const SPARKS = ['var(--ac-v-brand-2)', 'var(--ac-v-sky)', 'var(--ac-v-ice)', 'var(--ac-v-soft)', 'var(--ac-v-accent)', '#ffb547']

/** A short burst of light from `from`: the moment a pick lands. */
export function burst(from: Element): void {
  if (reduced() || typeof document === 'undefined' || typeof Element.prototype.animate !== 'function') return
  const host = from.closest('dialog, .ac-root')
  if (!(host instanceof HTMLElement)) return
  const anchor = from.getBoundingClientRect(), frame = host.getBoundingClientRect()
  const layer = document.createElement('span')
  layer.className = 'ac-burst'
  layer.setAttribute('aria-hidden', 'true')
  layer.style.left = `${anchor.left - frame.left + anchor.width / 2}px`
  layer.style.top = `${anchor.top - frame.top + anchor.height / 2}px`
  const ring = document.createElement('b')
  layer.appendChild(ring)
  ring.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0 }], { duration: 720, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
  const count = 16
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('i')
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35
    const distance = 28 + Math.random() * 38
    const size = 3 + Math.random() * 4
    spark.style.width = spark.style.height = `${size.toFixed(1)}px`
    spark.style.background = SPARKS[i % SPARKS.length]!
    if (i % 4 === 0) spark.classList.add('star')
    layer.appendChild(spark)
    const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance
    spark.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px)) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${(x * 1.3).toFixed(1)}px), calc(-50% + ${(y * 1.3 + 10).toFixed(1)}px)) scale(.2)`, opacity: 0 },
    ], { duration: 760 + Math.random() * 260, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
  }
  host.appendChild(layer)
  setTimeout(() => layer.remove(), 1200)
}

/** Progress as a liquid level in a glass sphere; the waves keep moving while work goes on. */
export function LiquidMeter({ level, busy }: { level: number; busy: boolean }): React.ReactElement {
  const percent = Math.round(Math.max(0.12, Math.min(1, level)) * 100)
  return <div className={`ac-liquid${busy ? ' busy' : ''}`} style={{ '--ac-level': `${percent}%` } as React.CSSProperties} aria-hidden="true">
    <i className="ac-liquid-wave back" /><i className="ac-liquid-wave" /><b /><b /><b /><b /><em />
  </div>
}
