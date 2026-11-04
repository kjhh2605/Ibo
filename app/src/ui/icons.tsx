// Line icons for Ibo (24 grid, 1.75 stroke, currentColor). Passed to Astryx <Icon icon={...}/>,
// which owns size and color. Only glyphs Astryx does not ship as semantic names live here.
import type {SVGProps} from 'react';

function Glyph({children,...props}:SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;
}
export const CameraIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/></Glyph>;
export const BagIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M5 8h14l-1 12H6z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></Glyph>;
export const PinIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></Glyph>;
export const HangerIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M12 8.5V7.6a1.9 1.9 0 1 0-1.9-1.9"/><path d="M12 8.5 3.5 15a1.2 1.2 0 0 0 .7 2.1h15.6a1.2 1.2 0 0 0 .7-2.1z"/></Glyph>;
export const SparkleIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15a2 2 0 0 0-1.2-1.2L3.5 12 9 10.2A2 2 0 0 0 10.2 9z"/></Glyph>;
export const ShieldIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M12 3.5 5 6v5.5c0 4.4 3 7.8 7 9 4-1.2 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/></Glyph>;
export const StoreIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5V20h13v-8.5"/><path d="M10 20v-4.5h4V20"/></Glyph>;
export const RouteIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16"/></Glyph>;
export const NoteIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M6 4h9l4 4v12H6z"/><path d="M14.5 4v4.5H19"/><path d="M9 13h6M9 16.5h4"/></Glyph>;
export const TrashIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></Glyph>;
export const PencilIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M5 19l1-4L15.5 5.5a2 2 0 0 1 3 3L9 18z"/></Glyph>;
export const PlusIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M12 5v14M5 12h14"/></Glyph>;
export const ImageIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20 16-4.5-4.5L7 19"/></Glyph>;
export const WifiOffIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.2-2.4M12 9.5a10 10 0 0 1 7 3.5M2 9.5a15 15 0 0 1 4-2.6M10.5 5.6A15 15 0 0 1 22 9.5"/><circle cx="12" cy="19.5" r="0.6"/></Glyph>;
export const ArrowBackIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M15 5l-7 7 7 7"/></Glyph>;
export const FlagIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M6 21V4M6 4h11l-2 4 2 4H6"/></Glyph>;
export const LockIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></Glyph>;
export const SendIcon=(props:SVGProps<SVGSVGElement>)=><Glyph {...props}><path d="M4 12 20 4l-5 16-3-7z"/><path d="m12 13 8-9"/></Glyph>;
