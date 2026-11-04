import {useEffect,useRef,useState} from 'react';
import type {Route} from '../ui/navigation';
import type {Photo,Shop} from '../native/contracts';
import {useUi,useData,listAll} from '../ui/state';
import {Action,Button,Confirm,EditFields,Empty,HStack,Loading,PhotoView,Problem,Section,Text,Thumbnail,VStack} from '../ui/components';
import {fileUrl} from '../ui/services';

function EndShopping() {
  const {services,popTo}=useUi();
  return <Confirm title="End shopping mode?" description="Your photos and saved locations stay on this device. The raw location trail will be deleted." action="End shopping" onConfirm={async()=>{await services.shopping.stop();popTo('home');}}/>;
}
export function Home() {
  const {services,push,session,showSheet,online}=useUi();
  const data=useData(async()=>{const [trips,pieces,shops]=await Promise.all([listAll(services,'Trip'),listAll(services,'Piece',{origin:'shop'}),listAll(services,'Shop')]);trips.sort((a,b)=>b.startedAt-a.startedAt);const photos=trips[0]?await listAll(services,'Photo',{tripId:trips[0].id}):[];return {trips,pieces:pieces.sort((a,b)=>b.createdAt-a.createdAt),shops:shops.filter(shop=>shop.tripId===trips[0]?.id).sort((a,b)=>a.n-b.n),photos};},[services]);
  const recording=session?.phase==='recording';
  return <>
    <Section title={recording?'Shopping mode is on':'Keep what catches your eye'}>
      <Text>Take photos while you shop. Find a piece later, try it on, and walk back to it.</Text>
      {recording?<><Text>{session.photos} photos · {session.elapsedMinutes} min · Shop {session.shop?.n}</Text><Button label="Take photo" onClick={()=>push({name:'capture'})}/><EndShopping/></>:<Action label="Start shopping" run={async()=>{
        try {await services.shopping.start();push({name:'capture'});}
        catch(error){
          const code=typeof error==='object'&&error!==null&&'code'in error?error.code:null;
          if(code==='location_permission_denied'||code==='location_disabled')showSheet({title:'Shopping mode needs your location',content:<VStack gap={4}><Text>It's how each shop gets pinned so you can walk back to it. Shopping mode can't start without it.</Text><Button label="Not now" variant="secondary" onClick={()=>showSheet(null)}/><Action label="Open settings" run={()=>services.shopping.openSettings()}/></VStack>});
          else throw error;
        }
      }}/>}
      <Button label="Find it" variant="secondary" onClick={()=>push({name:'ask'})}/>
    </Section>
    <Section title="Latest trip">{data.loading?<Loading/>:data.error?<Problem message={data.error} retry={data.retry}/>:data.data?.trips[0]?<Button variant="secondary" label={new Date(data.data.trips[0].startedAt).toLocaleDateString('en-US',{dateStyle:'medium'})} onClick={()=>push({name:'trip',tripId:data.data!.trips[0].id})}/>:<Empty title="No trips yet"><Text>Start shopping to create your first trip.</Text></Empty>}<Button label="All trips" variant="ghost" onClick={()=>push({name:'trips'})}/></Section>
    {data.data?.shops.map(shop=><VStack key={shop.id} gap={2}><Button label={`Shop ${shop.n}`} variant="ghost" onClick={()=>push({name:'trip',tripId:shop.tripId,shopId:shop.id})}/><Text type="supporting">{new Date(shop.startedAt).toLocaleTimeString('en-US',{timeStyle:'short'})} · {data.data!.photos.filter(photo=>photo.shopId===shop.id&&photo.kind==='item').length} photos</Text><Text type="supporting">{shop.descriptionState==='pending'?(online?'Describing the storefront…':'Will describe when you’re back online'):shop.descriptionState==='failed'?'Couldn’t describe the storefront':shop.description??shop.note??'No storefront photo'}</Text></VStack>)}
    <Section title="Saved pieces">{data.data?.pieces.length?data.data.pieces.map(piece=><HStack key={piece.id} gap={3} vAlign="center"><Thumbnail src={fileUrl(piece.cutoutFile)} alt={piece.label} label={piece.label} onClick={()=>push({name:'item',pieceId:piece.id})}/><Button label={piece.label} variant="ghost" onClick={()=>push({name:'item',pieceId:piece.id})}/></HStack>):<Empty title="No saved pieces"><Text>Find a garment in your trip photos to save it.</Text></Empty>}</Section>
    <HStack gap={3} wrap="wrap"><Button label="Wardrobe" variant="secondary" onClick={()=>push({name:'wardrobe'})}/><Button label="Try-ons" variant="secondary" onClick={()=>push({name:'results'})}/><Button label="Privacy" variant="ghost" onClick={()=>push({name:'privacy'})}/></HStack>
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
  return <Section title={route.forOutfit?'Choose a trip photo':'Your trips'}>{data.loading?<Loading/>:data.error?<Problem message={data.error} retry={data.retry}/>:!data.data?.trips.length?<Empty title="No trips yet"><Text>Your shopping trips will appear here.</Text></Empty>:data.data.trips.map(trip=><VStack key={trip.id} gap={2}><Button variant="secondary" label={new Date(trip.startedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})} onClick={()=>push({name:'trip',tripId:trip.id,forOutfit:route.forOutfit})}/><Text type="supporting">{trip.status==='recording'?'Recording':`Ended ${new Date(trip.endedAt!).toLocaleTimeString('en-US',{timeStyle:'short'})}`} · {data.data!.counts.get(trip.id)?.shops??0} shops · {data.data!.counts.get(trip.id)?.photos??0} photos</Text></VStack>)}{route.forOutfit&&<Button label="Cancel selection" variant="ghost" onClick={back}/>}</Section>;
}
function ShopSection({shop,forOutfit}:{shop:Shop;forOutfit?:boolean}) {
  const {services,push,showSheet,online}=useUi();const data=useData(()=>listAll(services,'Photo',{shopId:shop.id}),[services,shop.id]);
  const storefront=data.data?.find(photo=>photo.id===shop.storefrontPhotoId);
  return <VStack as="section" id={`shop-${shop.id}`} gap={4}>
    <Section title={`Shop ${shop.n}`}>
      <Text type="supporting">{new Date(shop.startedAt).toLocaleTimeString('en-US',{timeStyle:'short'})}</Text>
      {storefront?<PhotoView file={storefront.file} label={`Shop ${shop.n} storefront`}/>:<Text>No storefront photo</Text>}
      {shop.descriptionState==='pending'?<Text>{online?'Describing the storefront…':'Will describe when you’re back online'}</Text>:shop.descriptionState==='failed'?<><Text>Couldn’t describe the storefront</Text><Action label="Retry description" variant="secondary" run={()=>services.store.enqueue({kind:'describe_storefront',refId:shop.id})}/></>:shop.description?<Text>{shop.description}</Text>:null}
      {shop.note&&<Text>{shop.note}</Text>}<Button variant="ghost" label={shop.note?'Edit note':'Add note'} onClick={()=>showSheet({title:`Note for Shop ${shop.n}`,content:<EditFields label={shop.note??''} onSave={note=>services.store.updateShop({id:shop.id,note:note||null})}/>})}/>
      {data.loading?<Loading/>:data.error?<Problem message={data.error} retry={data.retry}/>:data.data?.filter(photo=>photo.kind==='item').length?<HStack gap={3} wrap="wrap">{data.data.filter(photo=>photo.kind==='item').map(photo=><Thumbnail key={photo.id} label={`Open photo ${new Date(photo.takenAt).toLocaleTimeString('en-US',{timeStyle:'short'})}`} src={fileUrl(photo.file)} alt="Shopping photo" onClick={()=>push({name:'pick',photoId:photo.id,mode:forOutfit?'outfit':'shop'})}/>)}</HStack>:<Text>No garment photos in this shop.</Text>}
    </Section>
  </VStack>;
}
export function Trip({route}:{route:Extract<Route,{name:'trip'}>}) {
  const {services,deleted,popTo}=useUi();const data=useData(async()=>({trip:await services.store.get({entity:'Trip',id:route.tripId}),shops:await listAll(services,'Shop',{tripId:route.tripId})}),[services,route.tripId]);
  useEffect(()=>{if(data.data&&route.shopId)document.getElementById(`shop-${route.shopId}`)?.scrollIntoView({block:'start'});},[data.data,route.shopId]);
  if(data.loading)return <Loading/>;if(data.error)return <Problem message={data.error} retry={data.retry}/>;
  if(!data.data?.trip)return <Empty title="This trip is no longer available"><Button label="All trips" onClick={()=>popTo('home',{name:'trips'})}/></Empty>;
  return <><Text>{new Date(data.data.trip.startedAt).toLocaleDateString('en-US',{dateStyle:'full'})}</Text><Text type="supporting">{data.data.trip.status==='recording'?'Your location trail is recorded while shopping mode is on.':'The raw location trail was deleted when shopping ended. Saved photo and shop locations remain on this device.'}</Text>{data.data.shops.length?data.data.shops.toSorted((a,b)=>a.n-b.n).map(shop=><ShopSection key={shop.id} shop={shop} forOutfit={route.forOutfit}/>):<Empty title="No shops recorded"/>}{route.forOutfit&&<Button label="Cancel selection" variant="secondary" onClick={()=>popTo('outfit')}/>}<Confirm title="Delete this trip?" description="Trip photos, shop notes, and the location trail will be deleted. Saved cutouts and their walking destinations stay. Shopping mode will stop if this trip is recording." action="Delete trip" onConfirm={async()=>{await services.store.deleteTrip({id:route.tripId});deleted('Trip',route.tripId);}}/></>;
}
export function Capture({route}:{route:Extract<Route,{name:'capture'}>}) {
  const {services,session,push,popTo,back,showSheet,say}=useUi();const purpose=route.purpose??'shopping';
  const view=useRef<HTMLElement>(null);const [ready,setReady]=useState(false);const [error,setError]=useState(false);const [attempt,setAttempt]=useState(0);const [storefront,setStorefront]=useState(false);const [banner,setBanner]=useState(true);const [last,setLast]=useState<Photo|null>(null);
  const recording=session?.phase==='recording';
  const recent=useData(async()=>{
    if(!session?.shop)return null;
    const photos=await listAll(services,'Photo',{shopId:session.shop.id});
    return photos.reduce<Photo|null>((latest,photo)=>photo.kind==='item'&&(!latest||photo.takenAt>latest.takenAt)?photo:latest,null);
  },[services,session?.shop?.id]);
  const latest=last??recent.data;
  const active=useRef(true);
  const previewQueue=useRef<Promise<void>>(Promise.resolve());
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{setBanner(true);setStorefront(false);setLast(null);},[session?.shop?.id]);
  useEffect(()=>{
    if(purpose==='shopping'&&!recording)return;
    let active=true;let observer:ResizeObserver|undefined;
    const ancestors:HTMLElement[]=[];let parent=view.current?.parentElement;while(parent){ancestors.push(parent);parent=parent.parentElement;}const backgrounds=ancestors.map(element=>element.style.background);ancestors.forEach(element=>{element.style.background='transparent';});
    const resize=()=>{const rect=view.current?.getBoundingClientRect();if(rect)void services.capture.setPreviewRect({x:rect.x,y:rect.y,width:rect.width,height:rect.height}).catch(()=>{if(active)setError(true);});};
    setReady(false);setError(false);
    const opened=previewQueue.current.catch(()=>{}).then(()=>services.capture.openPreview({purpose,facing:purpose==='self'?'front':'back'}));
    previewQueue.current=opened;
    void opened.then(()=>{if(!active)return;resize();observer=new ResizeObserver(resize);if(view.current)observer.observe(view.current);window.addEventListener('resize',resize);window.addEventListener('scroll',resize,true);setReady(true);}).catch(()=>{if(active)setError(true);});
    return()=>{active=false;observer?.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('scroll',resize,true);previewQueue.current=previewQueue.current.catch(()=>{}).then(()=>services.capture.closePreview());ancestors.forEach((element,index)=>{element.style.background=backgrounds[index];});};
  },[services,purpose,attempt,recording]);
  if(purpose==='shopping'&&session&&session.phase!=='recording')return <Empty title="Shopping mode is off"><Text>Start shopping from Home before taking shop photos.</Text><Button label="Home" onClick={()=>popTo('home')}/></Empty>;
  return <>
    <VStack gap={3}>{purpose==='shopping'?<><Text>Shop {session?.shop?.n??'—'} · {session?.photos??0} photos</Text><Text type="supporting">{session?.latestFix?`Location accuracy ${Math.round(session.latestFix.accuracyM)} m`:'Waiting for location…'}</Text></>:<Text>{purpose==='self'?'Stand back so your full body is visible. Your original photo stays on this device.':'Photograph one wardrobe piece.'}</Text>}</VStack>
    <VStack ref={view} role="img" aria-label="Camera preview" width="100%" minHeight="45dvh" style={{background:'transparent',aspectRatio:'3 / 4',position:'relative'}}/>
    {error?<Problem message="Camera is unavailable. Check camera permission in device settings, then try again." retry={()=>setAttempt(value=>value+1)}/>:!ready?<Loading/>:null}
    {purpose==='shopping'&&banner&&session?.shop&&<Section title={`Shop ${session.shop.n} started`}><Text>This spot is saved.</Text><HStack gap={3} wrap="wrap"><Button label="Storefront photo" variant="secondary" onClick={()=>setStorefront(true)}/><Button label="Add note" variant="secondary" onClick={()=>showSheet({title:`Note for Shop ${session.shop!.n}`,content:<EditFields label={session.shop?.note??''} onSave={note=>services.store.updateShop({id:session.shop!.id,note:note||null})}/>})}/><Button label="Dismiss" variant="ghost" onClick={()=>setBanner(false)}/></HStack></Section>}
    {storefront&&<Text>Fit the whole shop front in the frame</Text>}
    <Action label={storefront?'Capture storefront':purpose==='self'?'Use this photo':'Take photo'} disabled={!ready||error} run={async()=>{
      const {asset,photo}=await services.capture.takePhoto({kind:storefront?'storefront':'item'});
      if(!active.current){if(purpose!=='shopping')await services.media.discard({assetId:asset.id});return;}
      if(purpose==='self'){
        const ok=await services.fitting.registerSelf(asset);
        if(!active.current)return;
        if(ok)popTo('outfit');else say('Could not safely remove your head. Please retake your photo.');
      }else if(purpose==='wardrobe')push({name:'pick',mode:'wardrobe',asset});
      else{if(photo?.kind==='item')setLast(photo);setStorefront(false);if(!storefront)setBanner(false);say(storefront?'Storefront saved':'Photo saved');}
    }}/>
    {storefront?<Button label="Cancel storefront" variant="ghost" onClick={()=>setStorefront(false)}/>:purpose==='shopping'?<HStack gap={3} wrap="wrap"><Action label="New shop" variant="secondary" run={async()=>{await services.shopping.newShop();setBanner(true);}}/>{latest&&<Thumbnail src={fileUrl(latest.file)} alt="Latest captured garment" label="Latest photo" onClick={()=>push({name:'pick',photoId:latest.id,mode:'shop'})}/>}<EndShopping/></HStack>:<Button label="Cancel" variant="ghost" onClick={back}/>}</>;
}
