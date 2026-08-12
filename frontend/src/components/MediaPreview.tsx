export function MediaPreview({ source, contentType, name, compact = false }: {
  source: string
  contentType: string
  name: string
  compact?: boolean
}) {
  if (contentType === 'application/pdf') {
    return <iframe className="media-preview__pdf" src={source} title={name} />
  }
  return <img className={`media-preview__image${compact ? ' media-preview__image--compact' : ''}`} src={source} alt={compact ? '' : name} />
}
