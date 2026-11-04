// Ibo logo mark (design/logo/logo-10-return-bag-pin-*.svg): a map pin holding a shopping bag with a return arrow.
// Colors are theme tokens: pin = hanji, bag cut-out = hero indigo.
const HANJI='var(--color-hanok-hanji)';
const INDIGO='var(--color-hero)';

export function IboMark({size=128,animated=false}:{size?:number;animated?:boolean}) {
  return <svg viewBox="0 0 512 512" width={size} height={size} role="img" aria-label="Ibo">
    <path d="M256 56C168 56 100 124 100 210C100 300 200 390 256 456C312 390 412 300 412 210C412 124 344 56 256 56Z" fill={HANJI}/>
    <path d="M226 182V166C226 136 286 136 286 166V182" fill="none" stroke={INDIGO} strokeWidth={14} strokeLinecap="round"/>
    <rect x={190} y={176} width={132} height={112} rx={16} fill={INDIGO}/>
    <g>
      <path d="M264.2 217.4A24 24 0 0 1 266.1 261.8A24 24 0 0 1 233.4 231.8" fill="none" stroke={HANJI} strokeWidth={9} strokeLinecap="round"/>
      <path d="M236.5 223.3L241 239.9L222.4 233.1Z" fill={HANJI} stroke={HANJI} strokeWidth={5} strokeLinejoin="round"/>
      {animated&&<animateTransform attributeName="transform" type="rotate" from="0 256 240" to="360 256 240" dur="1s" begin="0.2s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1"/>}
    </g>
  </svg>;
}
