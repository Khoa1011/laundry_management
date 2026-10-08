// Safe labels carry only a resource prefix and numeric ID.
const code39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', B: 'nnwnnwnnw', G: 'nnnnnwwnw', '*': 'nwnnwnwnn',
}

export function Barcode39({ payload, label }: { payload: string; label: string }) {
  let position = 8
  const bars: Array<{ x: number; width: number }> = []
  for (const character of `*${payload}*`) {
    const pattern = code39[character]
    if (!pattern) throw new Error('Unsupported barcode character')
    for (const [index, kind] of [...pattern].entries()) {
      const width = kind === 'w' ? 5 : 2
      if (index % 2 === 0) bars.push({ x: position, width })
      position += width
    }
    position += 2
  }
  return <><svg className="order-bag-barcode" viewBox={`0 0 ${position + 8} 56`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
    <rect width={position + 8} height="56" fill="white" />
    {bars.map((bar, index) => <rect key={index} x={bar.x} y="2" width={bar.width} height="48" fill="black" />)}
  </svg><small className="order-bag-label__payload">{payload}</small></>
}
