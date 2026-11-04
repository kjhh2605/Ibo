import {useRef, useState} from 'react';
import type {ComponentProps, ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Thumbnail as AstryxThumbnail} from '@astryxdesign/core/Thumbnail';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useUi} from './state';
import {useImageUrl} from './images';
export {Button, VStack, HStack, Heading, Text, TextInput};
export function Thumbnail({src, ...props}: ComponentProps<typeof AstryxThumbnail>) {
  const image = useImageUrl(src);
  return <AstryxThumbnail {...props} src={image?.url}/>;
}
export function Section({title,children}:{title:string;children:ReactNode}) {return <VStack as="section" gap={4}><Heading level={2}>{title}</Heading>{children}</VStack>;}
export function Empty({title,children}:{title:string;children?:ReactNode}) {return <VStack gap={3} paddingBlock={6}><Heading level={3}>{title}</Heading>{children}</VStack>;}
export function Problem({message,retry}:{message:string;retry?:()=>void}) {return <VStack role="alert" gap={3}><Text>{message}</Text>{retry&&<Button label="Try again" variant="secondary" onClick={retry}/>}</VStack>;}
export function Loading() {return <Text type="supporting">Loading…</Text>;}
export function PhotoView({file,label}:{file:string;label:string}) {
  const image = useImageUrl(file);
  if (image?.failed) return <Problem message="This saved image could not be opened."/>;
  if (!image?.url) return <Loading/>;
  return <img src={image.url} alt={label} style={{width:'100%',maxHeight:'60dvh',objectFit:'contain',borderRadius:'var(--radius-md)'}}/>;
}
export function Action({label,run,variant='primary',disabled=false}:{label:string;run:()=>Promise<unknown>;variant?:'primary'|'secondary'|'ghost'|'destructive';disabled?:boolean}) {
  const pending=useRef(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
  return <><Button label={label} variant={variant} isDisabled={disabled||busy} isLoading={busy} onClick={()=>{if(pending.current||disabled)return;pending.current=true;setBusy(true);setError(null);void run().catch((cause:unknown)=>{const code=typeof cause==='object'&&cause!==null&&'code'in cause?String(cause.code):'';setError(code==='offline'?'You’re offline. Connect and try again.':'That didn’t work. Please try again.');}).finally(()=>{pending.current=false;setBusy(false);});}}/>{error&&<Problem message={error}/>}</>;
}
export function Confirm({title,description,action,onConfirm}:{title:string;description:string;action:string;onConfirm:()=>Promise<unknown>}) {const {showSheet}=useUi();return <Button label={action} variant="ghost" onClick={()=>showSheet({title,content:<VStack gap={4}><Text>{description}</Text><Action label={action} variant="destructive" run={async()=>{await onConfirm();showSheet(null);}}/><Button label="Cancel" variant="secondary" onClick={()=>showSheet(null)}/></VStack>})}/>;}
export function EditFields({label,category,onSave}:{label:string;category?:string;onSave:(label:string,category:string)=>Promise<unknown>}) {
  const [name,setName]=useState(label);const [kind,setKind]=useState(category??'');const {showSheet,say}=useUi();
  return <VStack gap={4}>{category===undefined&&<Text>Anything that helps you find it again.</Text>}<TextInput label={category===undefined?'Note':'Name'} placeholder={category===undefined?'e.g. cash only, army jackets at the back':undefined} value={name} onChange={setName}/>{category!==undefined&&<TextInput label="Category" value={kind} onChange={setKind}/>}<Action label="Save" disabled={!name.trim()} run={async()=>{await onSave(name.trim(),kind.trim());showSheet(null);say(category===undefined?'Note saved':'Changes saved');}}/><Button label="Cancel" variant="secondary" onClick={()=>showSheet(null)}/></VStack>;
}
