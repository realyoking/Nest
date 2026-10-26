// Run 26: small inline SVG marks for the AI models (no hotlinking). Brand-like colours where the brand has one; the Auto,
// Agnes and GLM marks use currentColor so they follow Nest's black-and-white theme in light and dark mode.
import { useId } from 'react';
import { modelInfo } from '../lib/ai-models.js';

const SPARK = 'M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z';

function Gemini({ size }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`g${id}`} x1="3" y1="20" x2="21" y2="4" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#1C7DFF" /><stop offset=".52" stopColor="#7A7CF7" /><stop offset="1" stopColor="#C6A3F5" /></linearGradient></defs>
      <path d={SPARK} fill={`url(#g${id})`} />
    </svg>
  );
}
function Gemma({ size }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`m${id}`} x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#3F6FE0" /><stop offset="1" stopColor="#5CB3F9" /></linearGradient></defs>
      <path d={SPARK} fill="none" stroke={`url(#m${id})`} strokeWidth="2.1" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.4" fill={`url(#m${id})`} />
    </svg>
  );
}
const Auto = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
    <path d="M10 3c.45 4.2 3.3 7.05 7.5 7.5-4.2.45-7.05 3.3-7.5 7.5-.45-4.2-3.3-7.05-7.5-7.5C6.7 10.05 9.55 7.2 10 3Z" />
    <path d="M18.5 13.5c.22 1.95 1.55 3.28 3.5 3.5-1.95.22-3.28 1.55-3.5 3.5-.22-1.95-1.55-3.28-3.5-3.5 1.95-.22 3.28-1.55 3.5-3.5Z" opacity=".75" />
  </svg>
);
const Agnes = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M7.6 17 12 6.8 16.4 17M9.3 13.3h5.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DeepSeek = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4D6BFE" d="M21.6 6.3c-.25-.12-.36.11-.5.23l-.14.15c-.4.43-.86.7-1.46.67-.88-.05-1.63.23-2.3.9-.14-.83-.6-1.32-1.32-1.64-.37-.16-.75-.33-1.01-.69-.18-.26-.23-.54-.32-.82-.06-.17-.11-.34-.31-.37-.21-.03-.3.15-.38.3-.33.6-.46 1.27-.45 1.94.03 1.52.67 2.73 1.94 3.59.15.1.18.2.14.35-.09.3-.19.58-.28.88-.06.19-.15.23-.35.15a5.9 5.9 0 0 1-1.86-1.26c-.92-.89-1.75-1.87-2.79-2.64l-.73-.5c-1.06-1.03.14-1.88.42-1.98.29-.1.1-.47-.84-.46-.94 0-1.8.32-2.89.74l-.48.14a10 10 0 0 0-3-.1C2.9 4.03 1.2 5 .17 6.79c-1.23 2.14-1.1 4.57-.65 6.98.47 2.54 1.85 4.65 3.97 6.3 2.2 1.71 4.73 2.55 7.62 2.38 1.76-.1 3.71-.34 5.92-2.2.56.27 1.14.38 2.11.47.75.07 1.47-.04 2.03-.15.88-.19.82-1 .5-1.15-2.57-1.2-2-.71-2.52-1.1 1.3-1.55 3.27-3.16 4.04-8.38.06-.42 0-.68 0-1.02 0-.2.04-.29.28-.31.64-.07 1.26-.25 1.83-.56 1.65-.9 2.31-2.38 2.47-4.15.02-.27 0-.55-.29-.69ZM11.2 18.96c-2.47-1.94-3.67-2.58-4.16-2.55-.46.03-.38.56-.28.9.11.35.25.58.44.88.14.2.23.5-.13.72-.79.49-2.17-.16-2.23-.2-1.6-.94-2.94-2.19-3.88-3.9a11.8 11.8 0 0 1-1.53-5.24c-.02-.45.11-.61.56-.69a5.5 5.5 0 0 1 1.79-.05c2.5.37 4.64 1.49 6.43 3.27 1.02 1.01 1.8 2.22 2.6 3.4.84 1.26 1.75 2.46 2.9 3.44.4.34.73.6 1.03.79-.94.1-2.51.13-3.54-.77Zm1.12-7.25a.35.35 0 1 1 .7 0 .35.35 0 0 1-.7 0Zm3.5 1.8c-.22.09-.45.17-.67.18a1.4 1.4 0 0 1-.9-.29c-.31-.26-.53-.4-.62-.86a2 2 0 0 1 .02-.68c.08-.37-.01-.6-.27-.82-.21-.17-.48-.22-.77-.22a.62.62 0 0 1-.29-.09c-.12-.06-.22-.21-.13-.4.03-.06.17-.2.2-.22.4-.23.86-.16 1.28.01.39.16.69.45 1.11.87.43.5.51.64.76 1.01.19.3.37.6.49.94.07.21-.02.38-.27.48l.06.09Z" transform="translate(1.2 1.4) scale(.9)" />
  </svg>
);
const Hunyuan = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10.5" fill="#0052D9" />
    <path d="M12 1.5a10.5 10.5 0 0 1 0 21 5.25 5.25 0 0 1 0-10.5 5.25 5.25 0 0 0 0-10.5Z" fill="#2AA7FF" />
    <circle cx="12" cy="6.75" r="1.7" fill="#0052D9" /><circle cx="12" cy="17.25" r="1.7" fill="#fff" />
  </svg>
);
const Glm = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="1.5" y="1.5" width="21" height="21" rx="5.5" fill="currentColor" />
    <path d="M7.5 7.6h9l-9 8.8h9" fill="none" stroke="var(--model-ic-inv, #fff)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
// Mistral: the pixel "M" in its warm stripes (yellow → red).
const MIS_ROWS = ['#FFD800', '#FFAF00', '#FF8205', '#FA500F', '#E10500'];
const MIS_CELLS = ['10001', '11011', '11111', '10101', '10001'];
const Mistral = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    {MIS_CELLS.flatMap((row, r) => [...row].map((on, c) => (on === '1' ? <rect key={`${r}-${c}`} x={1 + c * 4.4} y={2 + r * 4} width="4.4" height="4" fill={MIS_ROWS[r]} /> : null)))}
  </svg>
);
const MARKS = { mistral: Mistral, gemini: Gemini, gemma: Gemma, auto: Auto, agnes: Agnes, deepseek: DeepSeek, hunyuan: Hunyuan, glm: Glm };
export const iconKey = (id) => (id === 'auto' ? 'auto' : modelInfo(id)?.icon || 'auto');
export default function ModelIcon({ id, size = 16, className = '' }) {
  const M = MARKS[iconKey(id)] || Auto;
  return <span className={`model-ic${className ? ` ${className}` : ''}`} data-icon={iconKey(id)} aria-hidden="true"><M size={size} /></span>;
}
