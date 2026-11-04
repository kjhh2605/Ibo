import {useEffect,useRef,useState} from 'react';
import type {Route} from '../ui/navigation';
import type {Photo,Shop} from '../native/contracts';
import {useUi,useData,listAll} from '../ui/state';
import type {CSSProperties} from 'react';
import {Grid} from '@astryxdesign/core/Grid';
import {Divider} from '@astryxdesign/core/Divider';
import {Thumbnail,Action,Button,Chip,Confirm,EditFields,Empty,Eyebrow,Heading,Hint,HStack,Icon,IconTile,Loading,Media,Panel,PhotoView,Problem,Reveal,RowButton,Section,SkeletonGrid,SkeletonPhoto,SkeletonRows,SkeletonText,Stat,Text,TileButton,VStack} from '../ui/components';
import {reducedMotion,returning} from '../ui/easing';
import {BagIcon,CameraIcon,HangerIcon,NoteIcon,PinIcon,ShieldIcon,SparkleIcon,StoreIcon,TrashIcon,PencilIcon,ImageIcon} from '../ui/icons';

function failureCode(error:unknown):string {
  return typeof error==='object'&&error!==null&&'code'in error?String(error.code):'unknown';
}

// Serialize the shared camera across route unmount/remount and a pending shutter.
let captureOperation: Promise<unknown> = Promise.resolve();
function withCamera<T>(operation: () => Promise<T>): Promise<T> {
  const next = captureOperation.catch(() => {}).then(operation);
  captureOperation = next;
  return next;
}

const ON_HERO:CSSProperties={color:'var(--color-on-hero)'};
const HERO_GHOST:CSSProperties={color:'var(--color-on-hero)',border:'thin solid color-mix(in srgb, var(--color-on-hero) 40%, transparent)'};
const shortDate=(time:number)=>new Date(time).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const clock=(time:number)=>new Date(time).toLocaleTimeString('en-US',{timeStyle:'short'});
function shopLine(shop:Shop,online:boolean){
  return shop.descriptionState==='pending'?(online?'Describing the storefront…':'Will describe when you’re back online'):shop.descriptionState==='failed'?'Couldn’t describe the storefront':shop.description??shop.note??'No storefront photo';
}
function EndShopping({style}:{style?:CSSProperties}) {
  const {services,popTo}=useUi();
  return <Confirm tone="plain" style={style} title="End shopping mode?" description="Your photos and saved locations stay on this device. The raw location trail will be deleted." action="End shopping" onConfirm={async()=>{await services.shopping.stop();popTo('home');}}/>;
}
export function Home() {
  const {services,push,session,showSheet,online}=useUi();
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const data=useData(async()=>{const [trips,pieces,shops]=await Promise.all([listAll(services,'Trip'),listAll(services,'Piece',{origin:'shop'}),listAll(services,'Shop')]);trips.sort((a,b)=>b.startedAt-a.startedAt);const photos=trips[0]?await listAll(services,'Photo',{tripId:trips[0].id}):[];return {trips,pieces:pieces.sort((a,b)=>b.createdAt-a.createdAt),shops:shops.filter(shop=>shop.tripId===trips[0]?.id).sort((a,b)=>a.n-b.n),photos};},[services]);
  const recording=session?.phase==='recording';
  const start=async()=>{
    try {await services.shopping.start();if(active.current)push({name:'capture'});}
    catch(error){
      if(!active.current)return;
      const code=failureCode(error);
      if(code==='location_permission_denied'||code==='location_disabled')showSheet({title:'Shopping mode needs your location',content:<VStack gap={4}><Text>It's how each shop gets pinned so you can walk back to it. Shopping mode can't start without it.</Text><Button label="Not now" variant="secondary" onClick={()=>showSheet(null)}/><Action label="Open settings" run={()=>services.shopping.openSettings()}/></VStack>});
      else if(code==='location_unavailable')showSheet({title:'Your location is unavailable',content:<VStack gap={4}><Text>A current location fix is needed before shopping can start. Move somewhere with a clearer signal, then try again. No trip has been started.</Text><Button label="OK" onClick={()=>showSheet(null)}/></VStack>});
      else throw error;
    }
  };
  const latest=data.data?.trips[0];
  const itemPhotos=(shopId?:string)=>data.data?.photos.filter(photo=>photo.kind==='item'&&(!shopId||photo.shopId===shopId)).length??0;
  return <>
    <VStack as="section" gap={5} padding={6} style={{background:'var(--color-hero)',color:'var(--color-on-hero)',borderRadius:'var(--radius-page)',position:'relative',overflow:'hidden'}}>
            {recording?<Chip tone="onHero" live>Recording · Shop {session.shop?.n??'—'}</Chip>:<Eyebrow color="var(--color-hanok-earth)">Your shopping memory</Eyebrow>}
      <VStack gap={2}>
        <Heading level={2} style={{...ON_HERO,letterSpacing:'-0.02em'}}>{recording?'Shopping mode is on':'Keep what catches your eye'}</Heading>
        <Text style={{color:'color-mix(in srgb, var(--color-on-hero) 82%, transparent)'}}>Take photos while you shop. Find a piece later, try it on, and walk back to it.</Text>
      </VStack>
      {recording?<HStack gap={3} paddingBlock={3} style={{borderBlock:'thin solid color-mix(in srgb, var(--color-on-hero) 22%, transparent)'}}>
        <Stat onHero value={session.photos} label="photos"/><Stat onHero value={`${session.elapsedMinutes}`} label="minutes"/><Stat onHero value={session.shop?.n??'—'} label="current shop"/>
      </HStack>:<HStack gap={2} wrap="wrap">{[[CameraIcon,'Snap'],[SparkleIcon,'Find'],[PinIcon,'Walk back']].map(([glyph,word])=><HStack key={word as string} gap={1.5} vAlign="center" paddingInline={3} paddingBlock={1.5} style={{background:'color-mix(in srgb, var(--color-on-hero) 12%, transparent)',borderRadius:'var(--radius-full)'}}><Icon icon={glyph as typeof CameraIcon} size="sm" color="inherit"/><Text type="label" size="sm" color="inherit">{word as string}</Text></HStack>)}</HStack>}
      <VStack gap={2}>
        {recording?<><Button label="Take photo" variant="secondary" icon={<Icon icon={CameraIcon}/>} width="100%" size="lg" onClick={()=>push({name:'capture'})}/><EndShopping style={HERO_GHOST}/></>:<Action label="Start shopping" variant="secondary" size="lg" width="100%" icon={<Icon icon={BagIcon}/>} run={start}/>}
        <Button label="Find it" variant="ghost" icon={<Icon icon="search"/>} width="100%" style={HERO_GHOST} onClick={()=>push({name:'ask'})}/>
      </VStack>
    </VStack>
    <Grid columns={3} gap={3}>
      <Reveal index={0} from="scale"><TileButton label="Wardrobe" onClick={()=>push({name:'wardrobe'})}><IconTile icon={HangerIcon}/><Text type="label" weight="semibold">Wardrobe</Text></TileButton></Reveal>
      <Reveal index={1} from="scale"><TileButton label="Try-ons" onClick={()=>push({name:'results'})}><IconTile icon={SparkleIcon}/><Text type="label" weight="semibold">Try-ons</Text></TileButton></Reveal>
      <Reveal index={2} from="scale"><TileButton label="Privacy" onClick={()=>push({name:'privacy'})}><IconTile icon={ShieldIcon}/><Text type="label" weight="semibold">Privacy</Text></TileButton></Reveal>
    </Grid>
    <Section title="Latest trip" action={<Button label="All trips" variant="ghost" size="sm" endContent={<Icon icon="chevronRight" size="sm"/>} onClick={()=>push({name:'trips'})}/>}>
      {data.loading&&!data.data?<Panel gap={1} padding={3}><SkeletonRows flat count={3} label="Loading your latest trip"/></Panel>:data.error?<Problem message={data.error} retry={data.retry}/>:latest?<Reveal><Panel gap={1} padding={3}>
        <RowButton flat label={new Date(latest.startedAt).toLocaleDateString('en-US',{dateStyle:'medium'})} start={<IconTile icon="calendar" tone="hero"/>} meta={`${latest.status==='recording'?'Recording now':`Ended ${clock(latest.endedAt??latest.startedAt)}`} · ${data.data!.shops.length} ${data.data!.shops.length===1?'shop':'shops'} · ${itemPhotos()} photos`} onClick={()=>push({name:'trip',tripId:latest.id})}/>
        {data.data!.shops.map((shop,index)=><Reveal key={shop.id} index={index+1} gap={1}><Divider/><RowButton flat label={`Shop ${shop.n}`} start={<IconTile icon={StoreIcon} tone="muted"/>} meta={<>{clock(shop.startedAt)} · {itemPhotos(shop.id)} photos<br/>{shopLine(shop,online)}</>} onClick={()=>push({name:'trip',tripId:shop.tripId,shopId:shop.id})}/></Reveal>)}
      </Panel></Reveal>:<Empty title="No trips yet" icon={BagIcon}><Text type="supporting">Start shopping to create your first trip.</Text></Empty>}
    </Section>
    <Section title="Saved pieces" action={data.data?.pieces.length?<Text type="supporting">{data.data.pieces.length} saved</Text>:undefined}>
      {data.loading&&!data.data?<SkeletonGrid count={2} label="Loading saved pieces"/>:data.data?.pieces.length?<Grid columns={2} gap={3}>{data.data.pieces.map((piece,index)=><Reveal key={piece.id} index={index} from="scale"><TileButton label={piece.label} onClick={()=>push({name:'item',pieceId:piece.id})}>
        <Media file={piece.cutoutFile} label="" ratio="1" fit="contain"/>
        <VStack gap={0.5} paddingInline={1}><Text type="label" weight="semibold" maxLines={1} hasTruncateTooltip={false}>{piece.label}</Text><Text type="supporting" size="xsm">{piece.category!=='unknown'?`${piece.category} · `:''}{shortDate(piece.createdAt)}</Text></VStack>
      </TileButton></Reveal>)}</Grid>:<Empty title="No saved pieces" icon={HangerIcon}><Text type="supporting">Find a garment in your trip photos to save it.</Text></Empty>}
    </Section>
    <Hint icon={ShieldIcon}>Your original self photo and raw location trail never leave this phone.</Hint>
  </>;
}
export function Trips({route}:{route:Extract<Route,{name:'trips'}>}) {
  const {services,push,back}=useUi();const data=useData(async()=>{
    const [trips,shops,photos]=await Promise.all([listAll(services,'Trip'),listAll(services,'Shop'),listAll(services,'Photo')]);
    const counts=new Map<string,{shops:number;photos:number}>();
    for(const trip of trips)counts.set(trip.id,{shops:0,photos:0});
    for(const shop of shops){const count=counts.get(shop.tripId);if(count)count.shops++;}
    for(const photo of photos){const count=counts.get(photo.tripId);if(count&&photo.kind==='item')count.photos++;}
    return {trips:trips.sort((a,b)=>b.startedAt-a.startedAt),counts};
  },[services]);
  return <Section title={route.forOutfit?'Choose a trip photo':'Your trips'} description={route.forOutfit?'Open a trip, then tap a photo to cut out a companion piece.':undefined}>{data.loading&&!data.data?<SkeletonRows count={3} label="Loading your trips"/>:data.error?<Problem message={data.error} retry={data.retry}/>:!data.data?.trips.length?<Empty title="No trips yet" icon={BagIcon}><Text type="supporting">Your shopping trips will appear here.</Text></Empty>:<VStack gap={2}>{data.data.trips.map((trip,index)=>{const count=data.data!.counts.get(trip.id);const live=trip.status==='recording';return <Reveal key={trip.id} index={index}><RowButton label={new Date(trip.startedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})} title={new Date(trip.startedAt).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})} start={<IconTile icon="calendar" tone={live?'hero':'accent'}/>} meta={`${live?'Recording now':`${clock(trip.startedAt)} – ${clock(trip.endedAt!)}`} · ${count?.shops??0} ${count?.shops===1?'shop':'shops'} · ${count?.photos??0} photos`} end={live?<Chip tone="success" live>Live</Chip>:undefined} onClick={()=>push({name:'trip',tripId:trip.id,forOutfit:route.forOutfit})}/></Reveal>;})}</VStack>}{route.forOutfit&&<Button label="Cancel selection" variant="ghost" onClick={back}/>}</Section>;
}
function ShopSection({shop,forOutfit}:{shop:Shop;forOutfit?:boolean}) {
  const {services,push,showSheet,online}=useUi();const data=useData(()=>listAll(services,'Photo',{shopId:shop.id}),[services,shop.id]);
  const storefront=data.data?.find(photo=>photo.id===shop.storefrontPhotoId);
  const items=data.data?.filter(photo=>photo.kind==='item')??[];
  const description=shop.descriptionState==='pending'?<Hint icon="clock">{online?'Describing the storefront…':'Will describe when you’re back online'}</Hint>:shop.descriptionState==='failed'?<VStack gap={2}><Hint icon="warning">Couldn’t describe the storefront</Hint>{shop.storefrontPhotoId&&<Action label="Retry description" variant="secondary" size="sm" run={()=>services.store.enqueue({kind:'describe_storefront',refId:shop.storefrontPhotoId!})}/>}</VStack>:shop.description?<Text>{shop.description}</Text>:null;
  return <VStack as="section" id={`shop-${shop.id}`} gap={4}>
    <Panel gap={4}>
      <HStack gap={3} vAlign="center">
        <IconTile icon={StoreIcon} tone="hero"/>
        <VStack gap={0.5} style={{flex:1,minWidth:0}}><Heading level={2}>{`Shop ${shop.n}`}</Heading><Text type="supporting" size="sm">{clock(shop.startedAt)} · {items.length} {items.length===1?'photo':'photos'}</Text></VStack>
      </HStack>
      {storefront?<PhotoView file={storefront.file} label={`Shop ${shop.n} storefront`}/>:<HStack gap={3} vAlign="center" padding={4} style={{background:'var(--color-background-muted)',borderRadius:'var(--radius-element)'}}><Icon icon={ImageIcon} color="secondary"/><Text type="supporting">No storefront photo</Text></HStack>}
      {description}
      {shop.note&&<HStack gap={2} vAlign="start" padding={3} style={{background:'var(--color-hanok-bead)',borderRadius:'var(--radius-element)'}}><Icon icon={NoteIcon} size="sm" color="secondary"/><Text size="sm">{shop.note}</Text></HStack>}
      <HStack gap={2} wrap="wrap">
        <Button label={storefront?'Retake storefront':'Add storefront photo'} variant="secondary" size="sm" icon={<Icon icon={CameraIcon}/>} onClick={()=>push({name:'capture',purpose:'storefront',shopId:shop.id})}/>
        <Button variant="secondary" size="sm" icon={<Icon icon={PencilIcon}/>} label={shop.note?'Edit note':'Add note'} onClick={()=>showSheet({title:`Note for Shop ${shop.n}`,content:<EditFields label={shop.note??''} onSave={note=>services.store.updateShop({id:shop.id,note:note||null})}/>})}/>
        {storefront&&<Confirm title="Delete storefront photo?" description="The storefront and its description will be removed. Saved look snapshots stay." action="Delete storefront photo" icon={<Icon icon={TrashIcon}/>} onConfirm={()=>services.store.deletePhoto({id:storefront.id})}/>}
      </HStack>
      <Divider/>
      <Eyebrow>{forOutfit?'Tap a photo to pick a companion':'Garment photos'}</Eyebrow>
      {data.loading&&!data.data?<SkeletonGrid count={4} columns={4} captions={false} label="Loading garment photos"/>:data.error?<Problem message={data.error} retry={data.retry}/>:items.length?<Grid columns={4} gap={2}>{items.map((photo,index)=><Reveal key={photo.id} index={index} from="scale"><Thumbnail label={`photo ${clock(photo.takenAt)}`} src={photo.file} alt="Shopping photo" style={{width:'100%',height:'auto',aspectRatio:'1'}} onClick={()=>push({name:'pick',photoId:photo.id,mode:forOutfit?'outfit':'shop'})}/></Reveal>)}</Grid>:<Text type="supporting">No garment photos in this shop.</Text>}
    </Panel>
  </VStack>;
}
export function Trip({route}:{route:Extract<Route,{name:'trip'}>}) {
  const {services,deleted,popTo,push}=useUi();const data=useData(async()=>({trip:await services.store.get({entity:'Trip',id:route.tripId}),shops:await listAll(services,'Shop',{tripId:route.tripId})}),[services,route.tripId]);
  // Land on the chosen shop once. Later refreshes (a note saved, a description arriving) and coming Back must not jump the page.
  const landed=useRef(returning());
  useEffect(()=>{if(landed.current||!data.data||!route.shopId)return;landed.current=true;document.getElementById(`shop-${route.shopId}`)?.scrollIntoView({block:'start',behavior:reducedMotion()?'auto':'smooth'});},[data.data,route.shopId]);
  if(data.loading&&!data.data)return <><VStack gap={3}><SkeletonText lines={1} width="60%"/><SkeletonText lines={2} width="90%" index={1}/></VStack><SkeletonPhoto height="40dvh" label="Loading trip"/><SkeletonRows count={1}/></>;if(data.error)return <Problem message={data.error} retry={data.retry}/>;
  if(!data.data?.trip)return <Empty title="This trip is no longer available"><Button label="All trips" onClick={()=>popTo('home',{name:'trips'})}/></Empty>;
  const live=data.data.trip.status==='recording';
  return <>
    <VStack gap={3}>
      <HStack gap={2} vAlign="center" wrap="wrap"><Text type="large" weight="semibold">{new Date(data.data.trip.startedAt).toLocaleDateString('en-US',{dateStyle:'full'})}</Text>{live&&<Chip tone="success" live>Recording</Chip>}</HStack>
      <Hint icon={live?PinIcon:ShieldIcon}>{live?'Your location trail is recorded while shopping mode is on.':'The raw location trail was deleted when shopping ended. Saved photo and shop locations remain on this device.'}</Hint>
      {!route.forOutfit&&<Button label="Find it" variant="secondary" icon={<Icon icon="search"/>} onClick={()=>push({name:'ask'})}/>}
    </VStack>
    {data.data.shops.length?data.data.shops.toSorted((a,b)=>a.n-b.n).map((shop,index)=><Reveal key={shop.id} index={index}><ShopSection shop={shop} forOutfit={route.forOutfit}/></Reveal>):<Empty title="No shops recorded" icon={StoreIcon}/>}
    {route.forOutfit&&<Button label="Cancel selection" variant="secondary" onClick={()=>popTo('outfit')}/>}
    <Confirm title="Delete this trip?" description="Trip photos, shop notes, and the location trail will be deleted. Saved cutouts and their walking destinations stay. Shopping mode will stop if this trip is recording." action="Delete trip" icon={<Icon icon={TrashIcon}/>} onConfirm={async()=>{await services.store.deleteTrip({id:route.tripId});deleted('Trip',route.tripId);}}/>
  </>;
}
export function Capture({route}:{route:Extract<Route,{name:'capture'}>}) {
  const {services,session,push,popTo,back,showSheet,say}=useUi();const purpose=route.purpose??'shopping';
  const view=useRef<HTMLElement>(null);const [ready,setReady]=useState(false);const [error,setError]=useState<string|null>(null);const [attempt,setAttempt]=useState(0);const [storefront,setStorefront]=useState(false);const [banner,setBanner]=useState(true);const [last,setLast]=useState<Photo|null>(null);
  const recording=session?.phase==='recording';
  const recent=useData(async()=>{
    if(!session?.shop)return null;
    const photos=await listAll(services,'Photo',{shopId:session.shop.id});
    return photos.reduce<Photo|null>((latest,photo)=>photo.kind==='item'&&(!latest||photo.takenAt>latest.takenAt)?photo:latest,null);
  },[services,session?.shop?.id]);
  const latest=last??recent.data;
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{setBanner(true);setStorefront(false);setLast(null);},[session?.shop?.id]);
  useEffect(()=>{
    if(purpose==='shopping'&&!recording)return;
    let active=true;let observer:ResizeObserver|undefined;
    const ancestors:HTMLElement[]=[];let parent=view.current?.parentElement;while(parent){ancestors.push(parent);parent=parent.parentElement;}const backgrounds=ancestors.map(element=>element.style.background);ancestors.forEach(element=>{element.style.background='transparent';});
    const resize=()=>{const rect=view.current?.getBoundingClientRect();if(rect)void services.capture.setPreviewRect({x:rect.x,y:rect.y,width:rect.width,height:rect.height}).catch(cause=>{if(active)setError(failureCode(cause));});};
    setReady(false);setError(null);
    const opened=withCamera(()=>services.capture.openPreview(route.purpose==='storefront'?{purpose:'storefront',shopId:route.shopId,facing:'back'}:{purpose:route.purpose??'shopping',facing:purpose==='self'?'front':'back'}));
    void opened.then(()=>{if(!active)return;resize();observer=new ResizeObserver(resize);if(view.current)observer.observe(view.current);window.addEventListener('resize',resize);window.addEventListener('scroll',resize,true);setReady(true);}).catch(cause=>{if(active)setError(failureCode(cause));});
    return()=>{active=false;observer?.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('scroll',resize,true);void withCamera(()=>services.capture.closePreview()).catch(()=>{});ancestors.forEach((element,index)=>{element.style.background=backgrounds[index];});};
  },[services,purpose,route.purpose,route.shopId,attempt,recording]);
  if(purpose==='shopping'&&session&&session.phase!=='recording')return <Empty title="Shopping mode is off"><Text>Start shopping from Home before taking shop photos.</Text><Button label="Home" onClick={()=>popTo('home')}/></Empty>;
  return <VStack gap={3} minHeight={0} style={{flex:1}}>
    <VStack gap={3} minHeight={0} isScrollable style={{flex:1}}>
      {purpose==='shopping'?<HStack gap={3} hAlign="between" vAlign="center"><HStack gap={3} vAlign="center"><IconTile icon={StoreIcon} tone="hero" size="sm"/><VStack gap={0.5}><Text type="label" weight="semibold">Shop {session?.shop?.n??'—'} · {session?.photos??0} photos</Text><HStack gap={1} vAlign="center" style={{color:'var(--color-text-secondary)'}}><Icon icon={PinIcon} size="xsm" color="inherit"/><Text type="supporting" size="xsm">{session?.latestFix?`Location accuracy ${Math.round(session.latestFix.accuracyM)} m`:'Waiting for location…'}</Text></HStack></VStack></HStack><EndShopping/></HStack>:<Hint icon={purpose==='self'?ShieldIcon:CameraIcon}>{purpose==='self'?'Stand back so your full body is visible. Your original photo stays on this device.':purpose==='storefront'?'Fit the whole shop front in the frame. Taking this photo uses your current location once; it does not start a shopping trail.':'Photograph one wardrobe piece.'}</Hint>}
      {purpose==='shopping'&&banner&&session?.shop&&<VStack gap={3} padding={4} style={{background:'var(--color-accent-muted)',borderRadius:'var(--radius-container)'}}><HStack gap={3} vAlign="center"><IconTile icon={PinIcon} tone="hero" size="sm"/><VStack gap={0.5}><Heading level={2} style={{fontSize:'var(--font-size-lg)'}}>Shop {session.shop.n} started</Heading><Text type="supporting" size="sm">This spot is saved.</Text></VStack></HStack><HStack gap={2} wrap="wrap"><Button label="Storefront photo" variant="secondary" size="sm" icon={<Icon icon={StoreIcon}/>} onClick={()=>setStorefront(true)}/><Button label="Add note" variant="secondary" size="sm" icon={<Icon icon={NoteIcon}/>} onClick={()=>showSheet({title:`Note for Shop ${session.shop!.n}`,content:<EditFields label={session.shop?.note??''} onSave={note=>services.store.updateShop({id:session.shop!.id,note:note||null})}/>})}/><Button label="Dismiss" variant="ghost" size="sm" onClick={()=>setBanner(false)}/></HStack></VStack>}
      {storefront&&<Chip tone="accent">Fit the whole shop front in the frame</Chip>}
      <VStack ref={view} role="img" aria-label="Camera preview" width="100%" minHeight="25dvh" style={{background:'transparent',position:'relative',flex:1,borderRadius:'var(--radius-container)',overflow:'hidden',outline:'thin solid var(--color-border)'}}/>
      {error?<Problem message={error==='camera_permission_denied'?'Camera access is off. Allow access in device settings, then try again.':'The camera preview could not start. Try again or return to your saved photos.'} retry={()=>setAttempt(value=>value+1)}/>:!ready?<Loading label="Starting camera…"/>:null}
    </VStack>
    <HStack role="group" aria-label="Camera controls" gap={2} hAlign="between" vAlign="center" wrap="wrap" padding={3} style={{flexShrink:0,background:'var(--color-background-card)',borderRadius:'var(--radius-page)',boxShadow:'var(--shadow-low)'}}>
    {purpose==='shopping'&&!storefront&&latest&&<Thumbnail src={latest.file} alt="Latest captured garment" label="Latest photo" style={{width:'var(--spacing-12)',height:'var(--spacing-12)'}} onClick={()=>push({name:'pick',photoId:latest.id,mode:'shop'})}/>}
    <Action label={storefront||purpose==='storefront'?'Capture storefront':purpose==='self'?'Use this photo':'Take photo'} size="lg" icon={<Icon icon={CameraIcon}/>} style={{flex:1,minWidth:'fit-content'}} disabled={!ready||Boolean(error)} run={async()=>{
      const {asset,photo}=await withCamera(()=>services.capture.takePhoto({kind:storefront||purpose==='storefront'?'storefront':'item'}));
      if(!active.current){if(purpose==='self'||purpose==='wardrobe')await services.media.discard({assetId:asset.id});return;}
      if(purpose==='self'){
        const ok=await services.fitting.registerSelf(asset);
        if(!active.current)return;
        if(ok)popTo('outfit');else say('Could not safely remove your head. Please retake your photo.');
      }else if(purpose==='wardrobe')push({name:'pick',mode:'wardrobe',asset});
      else if(purpose==='storefront'){say('Storefront saved');back();}
      else{if(photo?.kind==='item')setLast(photo);setStorefront(false);if(!storefront)setBanner(false);say(storefront?'Storefront saved':'Photo saved');}
    }}/>
    {storefront?<Button label="Cancel storefront" variant="ghost" onClick={()=>setStorefront(false)}/>:purpose==='shopping'?<Action label="New shop" variant="secondary" icon={<Icon icon={StoreIcon}/>} run={async()=>{await services.shopping.newShop();setBanner(true);}}/>:<Button label="Cancel" variant="ghost" onClick={back}/>}
    </HStack>
  </VStack>;
}
