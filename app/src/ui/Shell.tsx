// Adapted from Astryx shell-top-nav: AppShell padding 6, body gap 10, section gap 4.
import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import {App as CapacitorApp} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {AppShell} from '@astryxdesign/core/AppShell';
import {TopNav,TopNavHeading} from '@astryxdesign/core/TopNav';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {Button,VStack,Text,Heading} from './components';
import {titles} from './navigation';
import {useUi} from './state';

export function Shell({children}:{children:ReactNode}) {
  const {route,stack,back,sheet,showSheet,toast,online,services}=useUi();
  const capturing=route.name==='capture';
  const body=useRef<HTMLElement>(null);
  const backRef=useRef(back);backRef.current=back;
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))backRef.current();};
    window.addEventListener('keydown',escape);
    const listener=Capacitor.isNativePlatform()?CapacitorApp.addListener('backButton',()=>backRef.current()):null;
    return()=>{window.removeEventListener('keydown',escape);void listener?.then(handle=>handle.remove());};
  },[]);
  useEffect(()=>{
    body.current?.scrollIntoView({block:'start'});
    if(route.name!=='capture'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches) body.current?.animate([{opacity:0,transform:'translateX(3%)'},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'ease-out'});
    if(!stack.some(entry=>entry.name==='ask'||entry.name==='pick'))void services.agent.cancel().catch(()=>{});
  },[route,stack,services]);
  return <AppShell variant="surface" contentPadding={capturing?3:6} mobileNav={false} topNav={<TopNav label="Ibo navigation" heading={<TopNavHeading heading="Ibo"/>} endContent={stack.length>1?<Button label="Back" variant="ghost" onClick={back}/>:undefined}/>} banner={!online?<VStack padding={3}><Text>You’re offline. Saved photos and pieces are still available.</Text></VStack>:undefined}>
    <VStack gap={capturing?3:10} width="100%" height={capturing?'100%':undefined} minHeight={capturing?0:undefined} maxWidth="var(--layout-max-width, 70rem)" ref={body} data-route={route.name} style={{marginInline:'auto'}}>
      <Heading level={1}>{titles[route.name]}</Heading>
      {children}
    </VStack>
    {toast&&<VStack role="status" padding={4} style={{position:'fixed',insetInline:'var(--spacing-6)',bottom:'var(--spacing-6)',background:'var(--color-surface)',borderRadius:'var(--radius-md)',boxShadow:'var(--shadow-md)',zIndex:20,pointerEvents:'none'}}><Text>{toast}</Text></VStack>}
    <BottomSheet isOpen={sheet!==null} onOpenChange={open=>{if(!open)showSheet(null);}} label={sheet?.title??'Options'} purpose="form" padding={6}>{sheet&&<VStack gap={4}><Heading level={2}>{sheet.title}</Heading>{sheet.content}<Button label="Close" variant="ghost" onClick={()=>showSheet(null)}/></VStack>}</BottomSheet>
  </AppShell>;
}
