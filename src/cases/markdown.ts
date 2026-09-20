function escapeHtml(src: string): string {
  return src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Tiny markdown preview for local case notes. HTML is escaped first — never a renderer for untrusted intel. */
export function renderNotesPreview(src: string): string {
  if (!src.trim()) return '<p class="muted">No notes yet.</p>'
  const escaped = escapeHtml(src)
  const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>')
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const withLinks = withBold.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  const blocks = withLinks.split(/\n{2,}/)
  return blocks
    .map((block) => {
      const lines = block.split('\n')
      if (lines[0].startsWith('# ')) return `<h3>${lines[0].slice(2)}</h3>${lines.slice(1).join('<br />')}`
      if (lines[0].startsWith('## ')) return `<h4>${lines[0].slice(3)}</h4>${lines.slice(1).join('<br />')}`
      return `<p>${lines.join('<br />')}</p>`
    })
    .join('')
}
