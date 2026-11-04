import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {Capacitor} from '@capacitor/core';
import type {EntityMap, SessionState} from '../native/contracts';
import type {Services} from './services';
import {deepLink, popRoute, pruneDeleted, pushRoute, returnTo} from './navigation';
import type {Route} from './navigation';

type Sheet = {title:string; content:ReactNode};
type State = {services:Services; stack:Route[]; route:Route; push(route:Route):void; back():void; popTo(name:Route['name'], next?:Route):void; deleted(entity:'Trip'|'Photo'|'Piece'|'Result',id:string):void; sheet:Sheet|null; showSheet(sheet:Sheet|null):void; toast:string|null; say(text:string):void; session:SessionState|null; online:boolean; revision:number};
const Context = createContext<State|null>(null);
export function UiProvider({services, children}:{services:Services; children:ReactNode}) {
  const [stack,setStack] = useState<Route[]>([{name:'home'}]);
  const [sheet,setSheet] = useState<Sheet|null>(null);
  const [toast,setToast] = useState<string|null>(null);
  const [session,setSession] = useState<SessionState|null>(null);
  const [online,setOnline] = useState(navigator.onLine);
  const [revision,setRevision] = useState(0);
  useEffect(()=>{if (!toast) return; const timer=window.setTimeout(()=>setToast(null),2600); return ()=>window.clearTimeout(timer);},[toast]);
  useEffect(()=>{
    if(Capacitor.isNativePlatform()||import.meta.env.VITE_SF_UI_ADAPTER!=='1')return;
    const visit=(event:Event)=>{const route=(event as CustomEvent<Route>).detail;setSheet(null);setStack(pushRoute([{name:'home'}],route));};
    const reset=()=>{setSheet(null);setToast(null);setStack([{name:'home'}]);setRevision(value=>value+1);};
    window.addEventListener('sf-ui-visit',visit);window.addEventListener('sf-ui-reset',reset);
    return()=>{window.removeEventListener('sf-ui-visit',visit);window.removeEventListener('sf-ui-reset',reset);};
  },[]);
  useEffect(()=>{
    let live=true;
    void services.shopping.getState().then(value=>{if(live)setSession(value);}).catch(()=>{});
    const handles=[services.shopping.addListener('state',setSession), services.store.addListener('changed',()=>setRevision(value=>value+1)), services.shopping.addListener('notice',()=>setToast('Notifications are off. Shopping mode is still recording.')), services.shopping.addListener('open',({url})=>{void services.shopping.getState().then(value=>{if(live){setSheet(null);setStack(current=>deepLink(current,url,value.phase==='recording'));}});})];
    const connection=()=>setOnline(navigator.onLine);
    window.addEventListener('online',connection);window.addEventListener('offline',connection);
    return ()=>{live=false;for(const handle of handles)void handle.then(value=>value.remove());window.removeEventListener('online',connection);window.removeEventListener('offline',connection);};
  },[services]);
  const value=useMemo<State>(()=>({services,stack,route:stack[stack.length-1],sheet,toast,session,online,revision,
    push:route=>{setSheet(null);setStack(current=>pushRoute(current,route));},
    back:()=>{if(sheet)setSheet(null);else setStack(popRoute);},
    popTo:(name,next)=>{setSheet(null);setStack(current=>returnTo(current,name,next));},
    deleted:(entity,id)=>{setSheet(null);setStack(current=>pruneDeleted(current,entity,id));},
    showSheet:next=>{setToast(null);setSheet(next);},say:setToast}),[services,stack,sheet,toast,session,online,revision]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useUi():State {const value=useContext(Context);if(!value)throw new Error('UI provider missing');return value;}
export function useData<T>(read:()=>Promise<T>,keys:readonly unknown[]) {
  const {revision}=useUi();
  const [state,setState]=useState<{data:T|null;error:string|null;loading:boolean}>({data:null,error:null,loading:true});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setState(current=>({...current,error:null,loading:true}));void read().then(data=>{if(live)setState({data,error:null,loading:false});}).catch(()=>{if(live)setState({data:null,error:'Could not load your saved data.',loading:false});});return()=>{live=false;};},[...keys,revision,retry]);
  return {...state,retry:()=>setRetry(value=>value+1)};
}
export async function listAll<K extends keyof EntityMap>(services:Services, entity:K, filter:{tripId?:string;shopId?:string;origin?:'shop'|'wardrobe'}={}):Promise<EntityMap[K][]> {
  const items:EntityMap[K][]=[];let cursor:string|undefined;
  do {const page=await services.store.list({entity,...filter,limit:200,cursor});items.push(...page.items);cursor=page.nextCursor??undefined;}while(cursor);
  return items;
}
