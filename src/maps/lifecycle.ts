/** Keep a MapLibre map the size of its container after layout swaps. */
export function observeMapSize(map: { resize: () => void }, el: HTMLElement): () => void {
  const resize = () => {
    try {
      map.resize()
    } catch {
      /* context already gone */
    }
  }
  resize()
  const raf = window.requestAnimationFrame(resize)
  const ro = new ResizeObserver(resize)
  ro.observe(el)
  return () => {
    window.cancelAnimationFrame(raf)
    ro.disconnect()
  }
}
