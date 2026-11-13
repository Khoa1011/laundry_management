/** Numbers here only scale visual meters. Exact decimal strings remain the displayed source of truth. */
export function QuantityFlowChart({ rows, incomingLabel, outgoingLabel, format }: {
  rows: Array<{ day: string; baseUnitId: number; baseUnit: string; incomingQuantity: string; outgoingQuantity: string }>
  incomingLabel: string; outgoingLabel: string; format: (value: string) => string
}) {
  const units = [...new Set(rows.map((r) => r.baseUnitId))]
  return <div className="quantity-flow-chart">{units.map((unit) => {
    const values = rows.filter((r) => r.baseUnitId === unit)
    const max = Math.max(1, ...values.flatMap((r) => [Number(r.incomingQuantity), Number(r.outgoingQuantity)]))
    return <section key={unit}><h3>{values[0].baseUnit}</h3>{values.map((r) => <div className="quantity-flow-chart__row" key={r.day}>
      <time dateTime={r.day}>{r.day.split('-').reverse().join('/')}</time>
      <label><span>{incomingLabel}: {format(r.incomingQuantity)}</span><meter min={0} max={max} value={Number(r.incomingQuantity)}>{format(r.incomingQuantity)}</meter></label>
      <label><span>{outgoingLabel}: {format(r.outgoingQuantity)}</span><meter className="quantity-flow-chart__out" min={0} max={max} value={Number(r.outgoingQuantity)}>{format(r.outgoingQuantity)}</meter></label>
    </div>)}</section>
  })}</div>
}
