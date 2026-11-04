import {config} from '../config';
import type {Asset, BBox} from '../native/contracts';
import {createMockContext, setMockContext} from '../native/web/context';
import {binaryPixels, decodeWebRaster} from '../native/segmenter';
import type {SegmenterFixture} from '../native/segmenter';
import {getWebRepository} from '../data/web/repository';
import {installWebMockTransport} from '../relay/client';

type Mask = {image:string; mask:string; bbox:BBox; score:number; tap:[number,number]};
type Seed = {now:string; trips:{id:string;startedAt:string;endedAt:string}[]; shops:{id:string;tripId:string;startedAt:string;spot:{lat:number;lng:number};note?:string}[]; photos:{id:string;tripId:string;shopId:string;takenAt:string;image:string;location:{lat:number;lng:number};vector:number[]}[];captureManifest:string[]};
type NativePersonExport = {point:[number,number];cases:{id:string;sourceSha256:string;w:number;h:number;masks:{binary:string;binarySha256:string;score:number}[]}[]};

/** Explicit local verification only: fixtures feed the real native-web plugins and durable Store. */
export async function installWebFixtures():Promise<()=>void> {
  const root=import.meta.env.VITE_SF_WEB_FIXTURES as string|undefined;
  if(config.runtime!=='web-mock'||!root)return ()=>{};
  const base=new URL(root.endsWith('/')?root:`${root}/`,location.href);
  if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('Web fixtures require a local server.');
  const repository=getWebRepository();
  async function fetchFixture(path:string):Promise<Response> {
    const url=new URL(path,base);
    if(!url.href.startsWith(base.href))throw new Error('Fixture path escapes its root.');
    const response=await fetch(url);
    if(!response.ok)throw new Error(`Missing verification fixture: ${path}`);
    return response;
  }
  async function json<T>(path:string):Promise<T>{return (await fetchFixture(path)).json() as Promise<T>;}
  const seed=await json<Seed>('store/e2e.json');
  const context=createMockContext({now:Date.parse(seed.now),permissions:{camera:'granted',location:'granted',notification:'granted',microphone:'granted'}});
  setMockContext(context);
  const destination=await json<{destination:{lat:number;lng:number}}>('gpx/walk.expected.json');
  context.setFixture('location',{...destination.destination,t:context.clock.now(),accuracyM:5});
  const masks=(await json<{candidates:Mask[]}>('masks/items/cases.json')).candidates;
  const assets=new Map<string,Asset>();
  async function asset(path:string):Promise<Asset> {
    const cached=assets.get(path);if(cached)return cached;
    const blob=await (await fetchFixture(path)).blob(),raster=await decodeWebRaster(blob);
    const value={id:crypto.randomUUID(),file:await repository.writeBlob(blob,'fixture'),w:raster.w,h:raster.h};
    assets.set(path,value);return value;
  }
  async function itemFixture(image:string):Promise<SegmenterFixture> {
    const input=await asset(image),choices=masks.filter(mask=>mask.image===image);
    const decoded=await Promise.all(choices.map(async mask=>({pixels:binaryPixels(await decodeWebRaster(await(await fetchFixture(mask.mask)).blob())),score:mask.score})));
    // Keyboard's initial center prompt has an explicit supplied three-mask fixture, not model inference.
    return {person:[],taps:[{x:0.5,y:0.5,masks:decoded.slice(0,3)},...choices.map((mask,index)=>({x:mask.tap[0]/input.w,y:mask.tap[1]/input.h,masks:[decoded[index],...decoded.filter((_,i)=>i!==index)].slice(0,3)}))]};
  }
  for(const image of new Set(masks.map(mask=>mask.image))){const input=await asset(image);context.setFixture(`Segmenter.asset:${input.id}`,await itemFixture(image));}
  const captures:Asset[]=[];
  for(const path of seed.captureManifest){
    const input=await asset(path);captures.push(input);
    const index=seed.captureManifest.indexOf(path);
    if(index%2===1){
      const source=`images/shops/shop-${Math.floor(index/2)+1}-items.png`;
      context.setFixture(`Segmenter.asset:${input.id}`,await itemFixture(source));
      context.setFixture(`PhotoIndex.vector:${input.id}`,seed.photos.find(photo=>photo.image===source)?.vector??seed.photos[0].vector);
    }else context.setFixture(`PhotoIndex.vector:${input.id}`,seed.photos[0].vector);
  }
  context.setFixture('capture',captures);
  context.setFixture('media.self',await asset('images/self/positive/calibration-hat.png'));
  context.setFixture('media.wardrobe',await asset('images/wardrobe/jeans-original.png'));
  if(import.meta.env.VITE_SF_WEB_NATIVE_MASKS==='1'){
    const report=await json<NativePersonExport>('native-proof/person-mask-export-after.json');
    if(report.point?.length!==2||report.point.some(value=>!Number.isFinite(value)||value<0||value>1))throw new Error('Invalid actual native prompt point.');
    const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
    for(const [id,image] of [
      ['calibration-hat','images/self/positive/calibration-hat.png'],
      ['synthetic-mock-provider','relay/normal/assets/synthetic-mock-output.png'],
      ['wardrobe-jeans','images/wardrobe/jeans-original.png'],
    ] as const){
      const input=await asset(image),row=report.cases.find(value=>value.id===id);
      if(!row||row.w!==input.w||row.h!==input.h||row.masks.length!==3||row.sourceSha256!==await digest(await(await repository.readBlob(input.file)).arrayBuffer()))throw new Error(`Native mask input mismatch: ${id}`);
      const person=await Promise.all(row.masks.map(async mask=>{
        const bytes=await(await fetchFixture(`native-proof/${mask.binary}`)).arrayBuffer(),pixels=new Uint8Array(bytes);
        if(await digest(bytes)!==mask.binarySha256||pixels.length!==input.w*input.h||pixels.some(value=>value!==0&&value!==255)||!Number.isFinite(mask.score)||mask.score<0||mask.score>1)throw new Error(`Invalid actual native mask: ${id}`);
        return {pixels,score:mask.score};
      }));
      const fixture={person,taps:[{x:report.point[0],y:report.point[1],masks:person}]} satisfies SegmenterFixture;
      context.setFixture(`Segmenter.asset:${input.id}`,fixture);
      context.setFixture(`Segmenter.provider:${row.sourceSha256}`,fixture);
    }
  }
  const wav=await(await fetchFixture('audio/tone-silence.wav')).arrayBuffer();
  const view=new DataView(wav);let samples:Int16Array|undefined;
  for(let at=12;at+8<=view.byteLength;){const size=view.getUint32(at+4,true);if(String.fromCharCode(...new Uint8Array(wav,at,4))==='data'){samples=new Int16Array(wav.slice(at+8,at+8+size));break;}at+=8+size+(size%2);}
  if(!samples)throw new Error('Missing PCM16 fixture samples.');context.setFixture('voice',samples);
  // The marker prevents deleted historical records from being silently recreated on reload.
  if(!localStorage.getItem('sf-web-fixtures-seeded')&&!(await repository.list({entity:'Trip',limit:1})).items.length){
    for(const trip of seed.trips){
      const shops=seed.shops.filter(shop=>shop.tripId===trip.id);
      const first=shops[0];
      const session=await repository.startSession({fix:{...first.spot,t:Date.parse(trip.startedAt),accuracyM:5}});
      for(let index=0;index<shops.length;index++){
        const source=shops[index];
        const shop=index===0?session.shop:await repository.newShop({tripId:session.trip.id,fix:{...source.spot,t:Date.parse(source.startedAt),accuracyM:5}});
        if(source.note)await repository.updateShop({id:shop.id,note:source.note});
        for(const photo of seed.photos.filter(row=>row.shopId===source.id)){
          const input=await asset(photo.image),file=await repository.writeBlob(await repository.readBlob(input.file),'fixture');
          await repository.commitPhoto({photo:{id:photo.id,tripId:session.trip.id,shopId:shop.id,file,w:input.w,h:input.h,kind:'item',takenAt:Date.parse(photo.takenAt),location:{...photo.location,accuracyM:5},indexState:'pending'}});
          await repository.commitEmbedding({embedding:{photoId:photo.id,model:'pe-core-t16-image',dim:512,vector:photo.vector}});
        }
      }
      await repository.stopSession({tripId:session.trip.id,endedAt:Date.parse(trip.endedAt)});
    }
    localStorage.setItem('sf-web-fixtures-seeded','1');
  }
  for(const photo of seed.photos){if(await repository.getPhoto({id:photo.id}))context.setFixture(`Segmenter.asset:${photo.id}`,await itemFixture(photo.image));}
  const calls=new Map<string,number>();
  async function resolveFixture(value:unknown,request:unknown):Promise<unknown>{
    if(typeof value==='string'&&value.startsWith('{{')&&value.endsWith('}}')){
      let current:unknown=request;
      for(const part of value.slice(2,-2).replaceAll('[','.').replaceAll(']','').split('.')){if(current===null||typeof current!=='object')throw new Error('Unresolved fixture token.');current=(current as Record<string,unknown>)[part];}
      if(current===undefined)throw new Error('Unresolved fixture token.');return current;
    }
    if(Array.isArray(value))return Promise.all(value.map(item=>resolveFixture(item,request)));
    if(value&&typeof value==='object'){
      if('asset' in value&&typeof value.asset==='string'){
        const bytes=new Uint8Array(await(await fetchFixture(`relay/normal/${value.asset}`)).arrayBuffer());
        let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);
      }
      return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,item])=>[key,await resolveFixture(item,request)])));
    }
    return value;
  }
  const removeTransport=installWebMockTransport(async(input,init)=>{
    init?.signal?.throwIfAborted();
    const endpoint=new URL(input instanceof Request?input.url:String(input)).pathname.replace(/^\/v1\//,'').replaceAll('/','-');
    const request=JSON.parse(String(init?.body));
    if(endpoint==='search-turn'&&!request.queryToken)calls.set(endpoint,0);
    const count=(calls.get(endpoint)??0)+1;calls.set(endpoint,count);
    const sequence=endpoint==='search-turn'?count:1;
    const fixture=await json<{status:number;body:unknown}>(`relay/normal/${endpoint}.${String(sequence).padStart(2,'0')}.response.json`);
    const resolved=await resolveFixture(fixture.body,request);init?.signal?.throwIfAborted();
    const body=endpoint.startsWith('search-')&&resolved&&typeof resolved==='object'?{...resolved,queryToken:'explicit-web-fixture-query'}:resolved;
    return Response.json(body,{status:fixture.status,headers:{'X-Query-Token':'explicit-web-fixture-query'}});
  });
  return removeTransport;
}
