import type {BBox, Candidate, Listener, SegMask} from '../native/contracts';
import type {components} from '../generated/relay-api';

type RouteResponse = components['schemas']['RouteResponse'];
type FixturePoint = {lat:number; lng:number; accuracyM?:number};
export type StoreFixture = {
  now:string;
  trips:{id:string; startedAt:string; endedAt:string|null; status:'recording'|'ended'}[];
  shops:{id:string; tripId:string; n:number; startedAt:string; spot:FixturePoint; descriptionState:'none'|'pending'|'done'|'failed'; description?:string; note?:string}[];
  photos:{id:string; tripId:string; shopId:string; takenAt:string; image:string; location:FixturePoint; indexState:'pending'|'done'|'failed'; vector:number[]}[];
  captureManifest:string[];
};
export type FixtureMask = {image:string; mask:string; cutout:string; bbox:BBox; score:number};
export type MaskPixels = {w:number; h:number; binary:Uint8Array; bbox:BBox};
type Envelope<T> = {status:number; body:T};

export function deviceError(code:string, message:string, retryable=true) {
  return Object.assign(new Error(message), {code, retryable});
}

export function createEvents<E>() {
  const listeners = new Map<keyof E, Set<(event:unknown)=>void>>();
  return {
    async addListener<K extends keyof E & string>(name:K, callback:(event:E[K])=>void):Promise<Listener> {
      let group = listeners.get(name);
      if (!group) {group=new Set(); listeners.set(name,group);}
      const listener=callback as (event:unknown)=>void;
      group.add(listener);
      return {async remove() {group.delete(listener);}};
    },
    emit<K extends keyof E & string>(name:K, event:E[K]) {
      for (const listener of [...(listeners.get(name)??[])]) listener(structuredClone(event));
    },
    clear() {listeners.clear();},
  };
}

/** Only reads S11 assets. The returned images and masks are unreviewed fixtures, not inference. */
export class UiFixtures {
  readonly base:URL;
  readonly store:StoreFixture;
  readonly masks:FixtureMask[];
  readonly route:RouteResponse;
  readonly transcript:string;
  readonly concept:string;
  readonly summary:string;
  readonly generatedFile:string;
  readonly pieceDescription:{label:string; category:string};
  readonly storeDescription:string;
  readonly walkDestination:{lat:number; lng:number};
  readonly walkFixes:{lat:number; lng:number; t:number; accuracyM:number}[];
  private images=new Map<string,Promise<HTMLImageElement>>();
  private pixels=new Map<string,Promise<MaskPixels>>();
  private blobs=new Map<string,Promise<Blob>>();
  private imageUrls=new Set<string>();
  private owned=new Set<string>();

  private constructor(base:URL, store:StoreFixture, masks:FixtureMask[], route:RouteResponse, transcript:string, final:{concept:string; summary:string}, generatedFile:string, walkDestination:{lat:number; lng:number}, walkFixes:UiFixtures['walkFixes'], pieceDescription:{label:string; category:string}, storeDescription:string) {
    this.base=base; this.store=store; this.masks=masks; this.route=route;
    this.transcript=transcript; this.concept=final.concept; this.summary=final.summary;
    this.generatedFile=generatedFile; this.walkDestination=walkDestination; this.walkFixes=walkFixes;
    this.pieceDescription=pieceDescription; this.storeDescription=storeDescription;
  }

  static async load(baseValue:string):Promise<UiFixtures> {
    const base=new URL(baseValue.endsWith('/')?baseValue:`${baseValue}/`,window.location.href);
    if (base.protocol!=='http:' && base.protocol!=='https:') throw deviceError('fixture_invalid','An HTTP fixture server is required.',false);
    async function json<T>(path:string):Promise<T> {
      const response=await fetch(new URL(path,base));
      if (!response.ok) throw deviceError('fixture_invalid','A required verification fixture could not be loaded.',false);
      return response.json() as Promise<T>;
    }
    const [store,masks,route,voice,final,generated,walkExpected,gpxResponse,pieceDescription,storeDescription]=await Promise.all([
      json<StoreFixture>('store/e2e.json'),
      json<{candidates:FixtureMask[]}>('masks/items/cases.json'),
      json<Envelope<RouteResponse>>('relay/normal/route.01.response.json'),
      json<Envelope<{text:string}>>('relay/normal/transcribe.01.response.json'),
      json<Envelope<{final:{concept:string; summary:string}}>>('relay/normal/search-turn.04.response.json'),
      json<Envelope<{image:{data:{asset:string}}}>>('relay/normal/tryon.01.response.json'),
      json<{destination:{lat:number; lng:number}; checkpoints:{accuracyM:number}[]}>('gpx/walk.expected.json'),
      fetch(new URL('gpx/walk.gpx',base)),
      json<Envelope<{label:string; category:string}>>('relay/normal/describe-piece.01.response.json'),
      json<Envelope<{description:string}>>('relay/normal/describe-storefront.01.response.json'),
    ]);
    if (!gpxResponse.ok || !store.captureManifest.length || !masks.candidates.length) throw deviceError('fixture_empty','Required verification assets are missing.',false);
    const gpx=new DOMParser().parseFromString(await gpxResponse.text(),'application/xml');
    const fixes=Array.from(gpx.getElementsByTagName('trkpt')).map((point,index)=>({
      lat:Number(point.getAttribute('lat')), lng:Number(point.getAttribute('lon')),
      t:Date.parse(point.getElementsByTagName('time')[0]?.textContent??''),
      accuracyM:walkExpected.checkpoints[index]?.accuracyM??5,
    }));
    if (fixes.length<6 || fixes.some(point=>!Number.isFinite(point.lat+point.lng+point.t))) throw deviceError('fixture_invalid','The walking fixture is invalid.',false);
    return new UiFixtures(base,store,masks.candidates,route.body,voice.body.text,final.body.final,
      `relay/normal/${generated.body.image.data.asset}`,walkExpected.destination,fixes,pieceDescription.body,storeDescription.body.description);
  }

  url(path:string):string {
    const url=new URL(path,this.base);
    if (!url.href.startsWith(this.base.href)) throw deviceError('invalid_argument','Only verification fixture assets are allowed.',false);
    return url.href;
  }

  private ref(file:string):string {
    if (this.owned.has(file)) return file;
    return this.url(file);
  }

  private blob(file:string):Promise<Blob> {
    const ref=this.ref(file);
    if (this.owned.has(ref)) return fetch(ref).then(response=>response.blob());
    let blob=this.blobs.get(ref);
    if (!blob) {
      blob=fetch(ref).then(response=>{
        if (!response.ok) throw deviceError('fixture_invalid','A verification image could not be loaded.',false);
        return response.blob();
      });
      this.blobs.set(ref,blob);
    }
    return blob;
  }

  image(file:string):Promise<HTMLImageElement> {
    const ref=this.ref(file);
    let image=this.images.get(ref);
    if (!image) {
      image=this.blob(ref).then(async blob=>{
        const source=URL.createObjectURL(blob); this.imageUrls.add(source);
        const element=new Image(); element.src=source;
        await element.decode().catch(()=>{throw deviceError('fixture_invalid','A verification image is invalid.',false);});
        return element;
      });
      this.images.set(ref,image);
    }
    return image;
  }

  maskPixels(mask:string):Promise<MaskPixels> {
    const ref=this.ref(mask);
    let pixels=this.pixels.get(ref);
    if (!pixels) {
      pixels=this.image(ref).then(image=>{
        const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
        const context=canvas.getContext('2d',{willReadFrequently:true});
        if (!context) throw deviceError('io_error','Image processing is unavailable.');
        context.drawImage(image,0,0);
        const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
        const binary=new Uint8Array(canvas.width*canvas.height);
        let left=canvas.width, top=canvas.height, right=-1, bottom=-1;
        for (let index=0;index<binary.length;index++) {
          if (rgba[index*4]>=128 && rgba[index*4+3]>0) {
            binary[index]=255;
            const x=index%canvas.width, y=Math.floor(index/canvas.width);
            left=Math.min(left,x); top=Math.min(top,y); right=Math.max(right,x); bottom=Math.max(bottom,y);
          }
        }
        if (right<left) throw deviceError('inference_failed','The fixture mask is empty.');
        return {w:canvas.width,h:canvas.height,binary,bbox:[left,top,right-left+1,bottom-top+1] as BBox};
      });
      this.pixels.set(ref,pixels);
    }
    return pixels;
  }

  forImage(image:string):FixtureMask[] {return this.masks.filter(mask=>mask.image===image);}
  findMask(file:string):FixtureMask|undefined {return this.masks.find(mask=>this.url(mask.mask)===file);}

  async candidate(photoId:string,source:Candidate['source'],mask:FixtureMask,label:string):Promise<Candidate> {
    const {binary,bbox}=await this.maskPixels(mask.mask);
    const prefix=new TextEncoder().encode(photoId+source);
    const input=new Uint8Array(prefix.length+binary.length); input.set(prefix); input.set(binary,prefix.length);
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',input));
    const id=[...digest].map(value=>value.toString(16).padStart(2,'0')).join('');
    return {id,photoId,source,label,score:mask.score,mask:this.url(mask.mask),bbox:[...bbox]};
  }

  async segMask(mask:FixtureMask):Promise<SegMask> {
    return {mask:this.url(mask.mask),bbox:[...(await this.maskPixels(mask.mask)).bbox],score:mask.score};
  }

  async wardrobe(kind:'jeans'|'shoes'):Promise<FixtureMask> {
    const mask=`masks/items/${kind}-draft.png`;
    return {image:`images/wardrobe/${kind}-original.png`,mask,cutout:`images/wardrobe/${kind}-cutout.png`,bbox:(await this.maskPixels(mask)).bbox,score:1};
  }

  async cutout(mask:FixtureMask):Promise<string> {
    const image=await this.image(mask.cutout);
    const {bbox:[x,y,w,h]}=await this.maskPixels(mask.mask);
    const canvas=new OffscreenCanvas(w,h);
    const context=canvas.getContext('2d');
    if (!context) throw deviceError('io_error','Image processing is unavailable.');
    context.drawImage(image,x,y,w,h,0,0,w,h);
    const blob=await canvas.convertToBlob({type:'image/png'});
    return this.makeFile(blob);
  }

  private makeFile(blob:Blob):string {const file=URL.createObjectURL(blob);this.owned.add(file);return file;}
  async copyFile(file:string):Promise<string> {return this.makeFile(await this.blob(file));}
  release(file:string):void {if(this.owned.delete(file)){URL.revokeObjectURL(file);this.images.delete(file);}}
  releaseOwned():void {for(const file of [...this.owned])this.release(file);}
  stop():void {this.releaseOwned();for(const file of this.imageUrls)URL.revokeObjectURL(file);this.imageUrls.clear();this.images.clear();this.blobs.clear();this.pixels.clear();}
}
