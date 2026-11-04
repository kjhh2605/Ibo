import {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {markNavigation} from './easing';
import type {ReactNode} from 'react';
import {Network} from '@capacitor/network';
import {config} from '../config';
import {verificationSnapshot} from '../verification';
import type {EntityMap, SessionState} from '../native/contracts';
import type {Services} from './services';
import {deepLink, popRoute, pruneDeleted, pushRoute, returnTo} from './navigation';
import type {Route} from './navigation';

/** `form`: the sheet holds text fields, so a stray swipe or outside tap must not throw away what was typed. */
type Sheet = {title:string; content:ReactNode; form?:boolean};
type State = {services:Services; stack:Route[]; route:Route; push(route:Route):void; back():void; popTo(name:Route['name'], next?:Route):void; deleted(entity:'Trip'|'Photo'|'Piece'|'Result',id:string):void; sheet:Sheet|null; showSheet(sheet:Sheet|null):void; toast:string|null; say(text:string):void; session:SessionState|null; online:boolean; revision:number};
const Context = createContext<State|null>(null);
export function UiProvider({services, children}:{services:Services; children:ReactNode}) {
  const [stack,setStack] = useState<Route[]>([{name:'home'}]);
  const [sheet,setSheet] = useState<Sheet|null>(null);
  const [toast,setToast] = useState<string|null>(null);
  const [session,setSession] = useState<SessionState|null>(null);
  const [online,setOnline] = useState(navigator.onLine);
  const [revision,setRevision] = useState(0);
  const lastBack = useRef(0);
  useEffect(()=>{if (!toast) return; const timer=window.setTimeout(()=>setToast(null),2600); return ()=>window.clearTimeout(timer);},[toast]);
  useEffect(()=>{
    let live=true;
    const sessionState=()=>services.shopping.getState().then(value=>{if(live)setSession(value);}).catch(()=>{if(live)setToast('Couldn’t check shopping mode. Go back to Home and try again.');});
    void sessionState();
    const handles=[
      services.shopping.addListener('state',value=>{if(live)setSession(value);}),
      services.store.addListener('changed',()=>{if(live){setRevision(value=>value+1);void sessionState();}}),
      services.shopping.addListener('notice',()=>{if(live)setToast('Shopping mode is on. Allow notifications to see it in your status bar.');}),
      services.shopping.addListener('error',({code})=>{if(live)setToast(code==='service_unavailable'?'Location isn’t available right now. Try again in a moment.':'Ibo can’t get your location. Check location access in Settings.');}),
      services.shopping.addListener('open',({url})=>{void services.shopping.getState().then(value=>{if(live){setSheet(null);setStack(current=>deepLink(current,url,value.phase==='recording'));}}).catch(()=>{if(live)setToast('Couldn’t open that notification.');});}),
      Network.addListener('networkStatusChange',status=>{if(live)setOnline(status.connected);}),
    ];
    void Network.getStatus().then(status=>{if(live)setOnline(status.connected);}).catch(()=>{});
    const connection=()=>setOnline(navigator.onLine);
    window.addEventListener('online',connection);window.addEventListener('offline',connection);
    return ()=>{live=false;for(const handle of handles)void handle.then(value=>value.remove()).catch(()=>{});window.removeEventListener('online',connection);window.removeEventListener('offline',connection);};
  },[services]);
  useEffect(()=>{
    if(!verificationSnapshot())return;
    const inspect=async()=>{
      const [trips,photos,pieces,results,jobs]=await Promise.all([listAll(services,'Trip'),listAll(services,'Photo'),listAll(services,'Piece'),listAll(services,'Result'),listAll(services,'QueueJob')]);
      const fitting=services.fitting.getSnapshot(),agent=services.agent.getState();
      return {mode:config.relayMode,relayBaseUrl:config.relayBaseUrl,resultDownload:config.resultDownload,route:stack.at(-1)?.name,stack:stack.map(entry=>entry.name),sheet:sheet?.title??null,online,
        session:{phase:session?.phase??null,tripId:session?.trip?.id??null,shopId:session?.shop?.id??null},
        ids:{trips:trips.map(row=>row.id),photos:photos.map(row=>row.id),pieces:pieces.map(row=>row.id),results:results.map(row=>row.id)},
        queue:jobs.map(({id,kind,refId,attempts})=>({id,kind,refId,attempts})),
        fitting:{draft:fitting.draft,phase:fitting.phase,selfState:fitting.selfState,resultId:fitting.result?.id??null},
        agent:{status:agent.status,stage:agent.stage,events:agent.events,photoIds:agent.photos.map(row=>row.id),candidateIds:agent.candidates.map(row=>row.id),candidates:agent.candidates,visibleCandidates:agent.visibleCandidates},
        walk:services.walk.getState(),transport:verificationSnapshot()};
    };
    const host=window as Window & {__sfVerification?:{inspect:typeof inspect}};
    host.__sfVerification=Object.freeze({inspect});
    return()=>{delete host.__sfVerification;};
  },[services,stack,sheet,session,online]);
  const value=useMemo<State>(()=>({services,stack,route:stack[stack.length-1],sheet,toast,session,online,revision,
    // A second tap on the same target while the screen is changing must not stack a duplicate page.
    push:route=>{setSheet(null);markNavigation(route.name==='home'?'back':'push');setStack(current=>sameRoute(current[current.length-1],route)?current:pushRoute(current,route));},
    // Back closes an open sheet first; a fast double tap pops one page, not two.
    back:()=>{if(sheet){setSheet(null);return;}const now=performance.now();if(now-lastBack.current<250)return;lastBack.current=now;markNavigation('back');setStack(popRoute);},
    popTo:(name,next)=>{setSheet(null);markNavigation(next?'push':'back');setStack(current=>returnTo(current,name,next));},
    deleted:(entity,id)=>{setSheet(null);setStack(current=>pruneDeleted(current,entity,id));},
    showSheet:next=>{setToast(null);setSheet(next);},say:setToast}),[services,stack,sheet,toast,session,online,revision]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function sameRoute(left:Route|undefined,right:Route):boolean {
  if(!left||left.name!==right.name)return false;
  try {return JSON.stringify(left)===JSON.stringify(right);} catch {return false;}
}
export function useUi():State {const value=useContext(Context);if(!value)throw new Error('UI provider missing');return value;}
export function useData<T>(read:()=>Promise<T>,keys:readonly unknown[]) {
  const {revision}=useUi();
  const [state,setState]=useState<{data:T|null;error:string|null;loading:boolean}>({data:null,error:null,loading:true});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setState(current=>({...current,error:null,loading:true}));void read().then(data=>{if(live)setState({data,error:null,loading:false});}).catch(()=>{if(live)setState({data:null,error:'Couldn’t load your saved items.',loading:false});});return()=>{live=false;};},[...keys,revision,retry]);
  return {...state,retry:()=>setRetry(value=>value+1)};
}
export async function listAll<K extends keyof EntityMap>(services:Services, entity:K, filter:{tripId?:string;shopId?:string;origin?:'shop'|'wardrobe'}={}):Promise<EntityMap[K][]> {
  const items:EntityMap[K][]=[];let cursor:string|undefined;
  do {const page=await services.store.list({entity,...filter,limit:200,cursor});items.push(...page.items);cursor=page.nextCursor??undefined;}while(cursor);
  return items;
}
