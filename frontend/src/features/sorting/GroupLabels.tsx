import { renderToStaticMarkup } from 'react-dom/server'
import { GroupLabel } from './GroupLabel'
import type { ProcessingGroup } from './types'

export function openGroupLabelSession() {
  const target = window.open('', '_blank', 'width=480,height=680')
  if (!target) return null
  return {
    close: () => target.close(),
    submit: (groups: ProcessingGroup[]) => {
      const labels = groups.map(group => renderToStaticMarkup(<GroupLabel group={group} />)).join('')
      target.document.open()
      target.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Tem nhóm đồ</title><style>
        @page{size:80mm 80mm;margin:3mm}body{font:14px Arial,sans-serif;color:#111;margin:0}
        .order-bag-label{box-sizing:border-box;width:74mm;padding:3mm;break-after:page;text-align:center}
        .order-bag-label p{margin:0 0 3mm}.order-bag-label h3{font-size:18px;margin:0 0 3mm;overflow-wrap:anywhere}
        .order-bag-label strong{display:block;margin:2mm 0;overflow-wrap:anywhere}
        .order-bag-barcode{display:block;width:100%;height:20mm}
        .order-bag-label__payload{display:block;margin:1mm 0;font-size:12px}
        .order-bag-label dl{margin:3mm 0 0;border-top:1px solid #111;text-align:left}
        .order-bag-label dl div{display:flex;justify-content:space-between;gap:3mm;padding-top:2mm}
        .order-bag-label dd{margin:0;font-weight:bold;overflow-wrap:anywhere;text-align:right}
      </style></head><body>${labels}</body></html>`)
      target.document.close()
      target.focus()
      target.print()
    },
  }
}
