// Adapted from Astryx shell-top-nav: AppShell padding 6, body gap 10, section gap 4.
import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import {App as CapacitorApp} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {AppShell} from '@astryxdesign/core/AppShell';
import {TopNav,TopNavHeading} from '@astryxdesign/core/TopNav';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {IconButton} from '@astryxdesign/core/IconButton';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {Button,VStack,HStack,Text,Heading,Icon} from './components';
import {ArrowBackIcon,ShieldIcon,WifiOffIcon} from './icons';
import {IboMark} from './IboMark';
import {EASE_OUT,EASE_SPRING,reducedMotion} from './easing';
import {titles} from './navigation';
import {useUi} from './state';

export function Shell({children}:{children:ReactNode}) {
  const {route,stack,back,push,sheet,showSheet,toast,online,services}=useUi();
  const capturing=route.name==='capture';
  const body=useRef<HTMLElement>(null);
  const backRef=useRef(back);backRef.current=back;
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))backRef.current();};
    window.addEventListener('keydown',escape);
    const listener=Capacitor.isNativePlatform()?CapacitorApp.addListener('backButton',()=>backRef.current()):null;
    // Web runtime only: Capacitor loads each plugin's web code on first use. Load the ones Walk needs now,
    // while online, so opening Walk later without a connection still reaches its offline state instead of failing.
    if(!Capacitor.isNativePlatform()){void CapacitorApp.getState().catch(()=>{});void Geolocation.checkPermissions().catch(()=>{});}
    return()=>{window.removeEventListener('keydown',escape);void listener?.then(handle=>handle.remove());};
  },[]);
  // Remember where each page in the stack was scrolled, so Back returns to the same spot instead of the top.
  const positions=useRef<number[]>([]);
  const depth=useRef(stack.length);
  useEffect(()=>{
    const save=(event:Event)=>{const target=event.target;if(target instanceof HTMLElement&&body.current&&target.contains(body.current))positions.current[depth.current-1]=target.scrollTop;};
    window.addEventListener('scroll',save,true);
    return()=>window.removeEventListener('scroll',save,true);
  },[]);
  useEffect(()=>{
    const previous=depth.current;depth.current=stack.length;
    const direction=stack.length>previous?'forward':stack.length<previous?'back':'replace';
    positions.current.length=stack.length;
    const scroller=scrollParent(body.current);
    let frame=0;
    if(direction==='back'&&scroller&&positions.current[stack.length-1]){
      // The page re-renders from saved data; keep trying for a moment until it is tall enough to restore.
      const target=positions.current[stack.length-1];let tries=0;
      const restore=()=>{scroller.scrollTop=target;if(Math.abs(scroller.scrollTop-target)>2&&tries++<45)frame=requestAnimationFrame(restore);};
      restore();
    }else{
      positions.current[stack.length-1]=0;
      if(scroller)scroller.scrollTop=0;else body.current?.scrollIntoView({block:'start'});
    }
    if(route.name!=='capture'&&!reducedMotion()){
      const offset=direction==='forward'?'1.5rem':direction==='back'?'-1.5rem':'0';
      body.current?.animate([{opacity:0,transform:`translateX(${offset})`},{opacity:1,transform:'none'}],{duration:direction==='replace'?180:280,easing:EASE_OUT});
    }
    if(!stack.some(entry=>entry.name==='ask'||entry.name==='pick'))void services.agent.cancel().catch(()=>{});
    return()=>cancelAnimationFrame(frame);
  },[route,stack,services]);
  const home=route.name==='home';
  const brand=<TopNavHeading heading="Ibo" logo={<VStack aria-hidden align="center" justify="center" width="var(--spacing-8)" height="var(--spacing-8)" style={{background:'var(--color-hero)',borderRadius:'var(--radius-element)'}}><IboMark size={26}/></VStack>}/>;
  const heading=stack.length>1?<IconButton label="Back" variant="ghost" icon={<Icon icon={ArrowBackIcon}/>} onClick={back}/>:brand;
  // Home keeps Privacy in the top bar, as in the prototype.
  const nav=<TopNav label="Ibo navigation" heading={heading} endContent={home?<IconButton label="Privacy" variant="ghost" icon={<Icon icon={ShieldIcon}/>} onClick={()=>push({name:'privacy'})}/>:undefined}/>;
  return <AppShell variant="surface" contentPadding={capturing?3:5} mobileNav={false} topNav={nav} banner={!online?<HStack gap={2} vAlign="center" hAlign="center" paddingBlock={2} paddingInline={4} style={{background:'var(--color-warning-muted)',color:'var(--color-on-warning-muted)'}}><Icon icon={WifiOffIcon} size="sm" color="inherit"/><Text type="label" size="sm" color="inherit">You’re offline. Saved photos and pieces are still available.</Text></HStack>:undefined}>
    <VStack gap={capturing?3:8} width="100%" height={capturing?'100%':undefined} minHeight={capturing?0:undefined} maxWidth="var(--layout-max-width, 40rem)" ref={body} data-route={route.name} style={{marginInline:'auto',paddingBottom:capturing?undefined:'var(--spacing-10)'}}>
      {home||capturing?<VisuallyHidden><Heading level={1}>{titles[route.name]}</Heading></VisuallyHidden>:<Heading level={1} style={{letterSpacing:'-0.02em'}}>{titles[route.name]}</Heading>}
      {children}
    </VStack>
    {toast&&<Toast key={toast} text={toast} raised={capturing||route.name==='pick'||route.name==='outfit'}/>}
    <BottomSheet isOpen={sheet!==null} onOpenChange={open=>{if(!open)showSheet(null);}} label={sheet?.title??'Options'} purpose={sheet?.form?'form':'info'} padding={6}>{sheet&&<VStack gap={4}><Heading level={2}>{sheet.title}</Heading>{sheet.content}<Button label="Close" variant="ghost" onClick={()=>showSheet(null)}/></VStack>}</BottomSheet>
  </AppShell>;
}

function Toast({text,raised}:{text:string;raised:boolean}) {
  const pill=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(reducedMotion())return;
    const animation=pill.current?.animate([{opacity:0,transform:'translate(-50%, 1rem) scale(0.96)'},{opacity:1,transform:'translate(-50%, 0) scale(1)'}],{duration:320,easing:EASE_SPRING});
    return()=>animation?.cancel();
  },[]);
  return <HStack ref={pill} role="status" gap={2} vAlign="center" paddingInline={4} paddingBlock={3} style={{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:raised?'calc(var(--spacing-12) * 2 + var(--spacing-6))':'var(--spacing-6)',maxWidth:'calc(100% - var(--spacing-10))',width:'max-content',background:'var(--color-background-inverted)',color:'var(--color-on-dark)',borderRadius:'var(--radius-full)',boxShadow:'var(--shadow-high)',zIndex:20,pointerEvents:'none'}}><Icon icon="check" size="sm" color="inherit"/><Text type="label" color="inherit">{text}</Text></HStack>;
}

function scrollParent(element:HTMLElement|null):HTMLElement|null {
  let current=element?.parentElement??null;
  while(current){
    const overflow=getComputedStyle(current).overflowY;
    if(overflow==='auto'||overflow==='scroll')return current;
    current=current.parentElement;
  }
  const page=document.scrollingElement;
  return page instanceof HTMLElement?page:null;
}
