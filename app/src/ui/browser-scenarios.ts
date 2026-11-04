import {chromium, expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

type Inspection = {route:string;sheet:string|null;ids:{trips:string[];photos:string[];pieces:string[];results:string[]};fitting:{phase:string;selfState:string;draft:{targetPieceId:string|null;companionPieceIds:string[]}};agent:{status:string;visibleCandidates:{id:string}[];candidates:{id:string}[]};walk:{mode:string;errorCode:string|null;destination:{lat:number;lng:number};fix:{lat:number;lng:number;t:number}|null}|null;transport:{counts:Record<string,number>;rawSelfReads:number;headMaskReads:number;resultExports:number;scope:string}|null};
async function inspect(page:Page):Promise<Inspection>{
  return page.evaluate(async()=>{
    const observer=(window as Window&{__sfVerification?:{inspect():Promise<Inspection>}}).__sfVerification;
    if(!observer)throw new Error('Explicit verification observer is unavailable.');
    return observer.inspect();
  });
}

/** No route setters, service replacements, Store writes, or synthetic UI success controls. */
export async function runBrowserScenario(scenario:'full'|'states',url:string,output:string) {
  const browser=await chromium.launch({headless:true});
  const initialLocation={latitude:37.5454,longitude:127.0555,accuracy:5};
  const context=await browser.newContext({viewport:{width:412,height:892},permissions:['geolocation'],geolocation:initialLocation});
  const page=await context.newPage();
  const routes=new Set<string>(),matrix:{route:string;state:string;passed:boolean;detail?:string}[]=[];
  const screenshots:string[]=[];
  let failure:string|null=null;
  const button=(name:string|RegExp)=>page.getByRole('button',{name,exact:typeof name==='string'}).first();
  async function click(name:string|RegExp){await button(name).click();}
  async function route(name:string,exerciseOffline=true){
    await expect(page.locator(`[data-route="${name}"]`)).toBeVisible();
    await expect.poll(async()=>(await inspect(page)).route).toBe(name);
    routes.add(name);matrix.push({route:name,state:'normal',passed:true});
    await expect(page.getByRole('button',{name:/^(Demo|Walk a step|Go off route|Download result)$/})).toHaveCount(0);
    if(scenario==='states'&&exerciseOffline){
      await context.setOffline(true);
      await expect(page.getByText('You’re offline. Saved photos and pieces are still available.')).toBeVisible();
      matrix.push({route:name,state:'offline',passed:true});
      await context.setOffline(false);
      await expect(page.getByText('You’re offline. Saved photos and pieces are still available.')).toHaveCount(0);
      if(name==='walk'){
        await context.setGeolocation(initialLocation);
        await expect.poll(async()=>(await inspect(page)).walk?.mode).not.toBe('loading');
        const walk=(await inspect(page)).walk;
        if(walk?.mode==='error')expect(walk.errorCode).toBe('location_unavailable');
        if(walk?.mode==='offline'||walk?.mode==='error')await click('Try again');
      }
    }
  }
  async function shot(name:string){const file=`${name}.png`;await page.screenshot({path:resolve(output,file),fullPage:true});screenshots.push(file);}
  async function home(){while((await inspect(page)).route!=='home'){await click('Back');await expect(page.locator('dialog[open]')).toHaveCount(0);}await route('home');}
  async function confirm(name:string){await page.locator('dialog[open]').getByRole('button',{name,exact:true}).click();await expect(page.locator('dialog[open]')).toHaveCount(0);}
  try{
    await page.goto(url);await route('home');await shot('01-home');
    await click('Start shopping');await route('capture');
    await click('Storefront photo');await click('Capture storefront');await click('Take photo');
    await expect.poll(async()=>(await inspect(page)).ids.photos.length).toBe(9);
    await shot('02-capture');await click('End shopping');await confirm('End shopping');await route('home');
    await click('Find it');await route('ask');await page.getByRole('searchbox').fill('a blue jacket');await click('Find');
    await expect.poll(async()=>(await inspect(page)).agent.status,{timeout:30000}).toBe('results');
    const candidates=(await inspect(page)).agent;
    expect(candidates.visibleCandidates).toHaveLength(3);expect(candidates.candidates).toHaveLength(4);
    const textCounts=(await inspect(page)).transport!.counts;
    expect(textCounts['/v1/search/turn']).toBe(4);expect(textCounts['/v1/search/segment']).toBe(1);
    await click('Speak');
    await expect.poll(async()=>(await inspect(page)).transport?.counts['/v1/transcribe'],{timeout:10000}).toBe(1);
    await expect.poll(async()=>(await inspect(page)).agent.status,{timeout:30000}).toBe('results');
    expect((await inspect(page)).transport!.counts['/v1/search/turn']).toBe(8);
    matrix.push({route:'ask',state:'voice-vad-transcribe-automatic-search',passed:true});
    await shot('03-search');await click('Best match');await route('pick');
    await context.setOffline(true);await click('Show all (4)');
    await expect(button(/^4\./)).toBeVisible();
    expect((await inspect(page)).transport!.counts['/v1/search/segment']).toBe(2);
    await context.setOffline(false);
    matrix.push({route:'pick',state:'offline-show-all-without-inference',passed:true});
    await expect(button('Use this item')).toBeEnabled();await shot('04-pick');await click('Use this item');await route('item');
    await expect(button('Try it on')).toBeVisible();await shot('05-item');
    const pieceId=(await inspect(page)).ids.pieces[0];
    await page.reload();await route('home');await expect.poll(async()=>(await inspect(page)).ids.pieces).toContain(pieceId);
    matrix.push({route:'home',state:'restart-persistence',passed:true});
    await click('a blue jacket');await route('item');await click('Walk back');await route('walk');
    await expect.poll(async()=>(await inspect(page)).walk?.mode,{timeout:20000}).toBe('route');await shot('06-walk-route');
    const pin=(await inspect(page)).walk!.destination;
    await context.setGeolocation({latitude:pin.lat+0.00005,longitude:pin.lng,accuracy:5});
    await expect.poll(async()=>(await inspect(page)).walk?.fix?.lat).toBe(pin.lat+0.00005);
    // Chromium clears its old GPS override with POSITION_UNAVAILABLE before the next fix.
    if((await inspect(page)).walk?.mode==='error')await click('Try again');
    matrix.push({route:'walk',state:'location-recovery-via-retry',passed:true});
    await expect.poll(async()=>(await inspect(page)).walk?.mode).toBe('direction');
    // The product's nearby rule requires two real GPS samples at least five seconds apart.
    await page.waitForTimeout(5100);
    await context.setGeolocation({latitude:pin.lat+0.00004,longitude:pin.lng,accuracy:5});
    await expect.poll(async()=>(await inspect(page)).walk?.fix?.lat).toBe(pin.lat+0.00004);
    if((await inspect(page)).walk?.mode==='error')await click('Try again');
    await expect.poll(async()=>(await inspect(page)).walk?.mode).toBe('nearby');
    await click('I found this shop');await expect.poll(async()=>(await inspect(page)).walk?.mode).toBe('arrived');await shot('07-arrived');await click('Done');await route('item');
    await click('Try it on');await route('outfit');
    const target=(await inspect(page)).fitting.draft.targetPieceId;expect(target).toBe(pieceId);
    await click('Add a companion');await click('From a trip photo');await route('trips');await shot('08-trips');
    await button(/Oct 31/).click();await route('trip');await shot('09-trip');
    await expect(button('Walk back')).toHaveCount(0);
    await button(/Open photo/).first().click();await route('pick');
    await click('Cancel and return to outfit');await route('outfit');expect((await inspect(page)).fitting.draft.targetPieceId).toBe(target);
    matrix.push({route:'outfit',state:'companion-cancel-preserves-target',passed:true});
    await click('Add a companion');await click('From a trip photo');await route('trips');
    await button(/Oct 31/).click();await route('trip');await button(/Open photo/).first().click();await route('pick');
    await expect(page.getByRole('button',{name:/^Tap the item in the photo/})).toHaveAttribute('aria-disabled','false');
    await page.getByRole('button',{name:/^Tap the item in the photo/}).press('Enter');
    await expect(button('Add to outfit')).toBeEnabled();await click('Add to outfit');await route('outfit');
    expect((await inspect(page)).fitting.draft.companionPieceIds).toHaveLength(1);
    matrix.push({route:'outfit',state:'trip-cutout-saved-and-added',passed:true});
    await home();await click('Wardrobe');await route('wardrobe');await shot('10-wardrobe');
    await click('Add a piece');await click('Choose from gallery');await route('pick');await click('Cancel');await route('wardrobe');
    const beforeWardrobe=(await inspect(page)).ids.pieces;
    await click('Add a piece');await click('Choose from gallery');await route('pick');
    await expect(page.getByRole('button',{name:/^Tap the item in the photo/})).toHaveAttribute('aria-disabled','false');
    // Wait for the departing picker sheet to stop intercepting input; Enter uses the exact recorded center prompt.
    await page.getByRole('button',{name:/^Tap the item in the photo/}).click({trial:true});
    await page.getByRole('button',{name:/^Tap the item in the photo/}).press('Enter');
    if(scenario==='states'){
      await context.setOffline(true);
      await expect(page.getByText('You’re offline. Saved photos and pieces are still available.')).toBeVisible();
    }
    await expect(button('Add to wardrobe')).toBeEnabled();await click('Add to wardrobe');await route('wardrobe',false);
    if(scenario==='states'){
      await expect(page.getByText('Waiting for connection to name this piece.',{exact:true})).toBeVisible();
      await context.setOffline(false);
    }
    await expect(button('Open Blue jacket')).toBeVisible();
    const wardrobeId=(await inspect(page)).ids.pieces.find(id=>!beforeWardrobe.includes(id));
    expect(wardrobeId).toBeDefined();await shot('10b-wardrobe-saved');
    matrix.push({route:'wardrobe',state:scenario==='states'?'actual-tap-save-offline-naming-recovery':'actual-tap-save-and-name',passed:true});
    await home();await click('Privacy');await route('privacy');await shot('11-privacy');
    await home();await click('Try-ons');await route('results');await shot('12-results-empty');
    await home();await click('a blue jacket');await route('item');await click('Try it on');await route('outfit');
    await click('Add your photo');await click('Choose from gallery');
    // Media import starts asynchronously; the initial empty state is not a finished registration.
    await expect.poll(async()=>(await inspect(page)).fitting.selfState,{timeout:30000}).toBe('ready');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await shot('13-outfit');
    const before=(await inspect(page)).transport?.counts['/v1/tryon']??0;
    await click('Generate');await route('result');await shot('14-result');
    expect((await inspect(page)).transport?.counts['/v1/tryon']).toBe(before+1);
    await click('Delete look');await confirm('Delete look');await route('results');
    await home();await click('a blue jacket');await route('item');await click('Delete piece');await confirm('Delete piece');
    await expect.poll(async()=>(await inspect(page)).ids.pieces).not.toContain(pieceId);
    await page.reload();await route('home');await expect.poll(async()=>(await inspect(page)).ids.pieces).not.toContain(pieceId);
    matrix.push({route:'home',state:'deletion-persists',passed:true});
    expect((await inspect(page)).ids.pieces).toContain(wardrobeId);
    await click('Wardrobe');await route('wardrobe');await click('Open Blue jacket');await route('item');
    await expect(button('Walk back')).toHaveCount(0);
    await click('Delete piece');await confirm('Delete piece');await route('wardrobe');
    expect((await inspect(page)).ids.pieces).not.toContain(wardrobeId);
    await expect(page.getByText('Your wardrobe is empty',{exact:true})).toBeVisible();
    matrix.push({route:'wardrobe',state:'reload-preserves-cutout-and-delete-removes-it',passed:true});
    expect(routes.size).toBe(13);
  }catch(error){failure=error instanceof Error?error.message:String(error);await shot('failure').catch(()=>{});}
  finally{
    const snapshot=await inspect(page).catch(()=>null);
    await writeFile(resolve(output,'matrix.json'),JSON.stringify({passed:failure===null,scenario,routes:[...routes],matrix,screenshots,failure,snapshot,engine:'Playwright Chromium',runtime:'web-mock with real durable Store and owner controllers',approval:'Prototype layout/copy session not performed; no native/model success claimed'},null,2)+'\n');
    await context.close();await browser.close();
  }
  if(failure)throw new Error(failure);
}
