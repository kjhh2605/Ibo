export function browserScenario(scenario:'full'|'states',url:string):string {
  return `
const tab = await openTab(${JSON.stringify(url)});
const routes = new Set(); const matrix = []; const screenshots = [];
const assert = (condition,message) => { if(!condition) throw new Error(message); };
async function readScreen() { const state=await snapshot(tab); console.log(state.diff||state.tree); return state.tree; }
async function click(label,scope) {
  await readScreen();
  const base=scope?tab.getByRole('dialog'):tab;
  const target=base.getByRole('button',{name:label,exact:typeof label==='string'}).first();
  await target.waitFor({state:'visible'});
  const tree=await readScreen();
  if(typeof label==='string')assert(tree.includes(label),'Missing accessible action '+label);
  await target.click();
  await readScreen();
}
async function route(name,state='normal') {
  await tab.locator('[data-route="'+name+'"]').waitFor({state:'visible'});
  const tree=await readScreen();
  assert(!/\\bDemo\\b|Walk a step|Go off route|dev badge|mock mode/i.test(tree),'Forbidden product control');
  assert(!/Download result/.test(tree),'Result download gate exposed');
  routes.add(name);matrix.push({route:name,state,passed:true});
}
async function shot(name) {
  const bytes=await tab.screenshot({fullPage:true});
  console.log('SF_SCREENSHOT:'+JSON.stringify({name,data:Buffer.from(bytes).toString('base64')}));screenshots.push(name+'.png');
}
async function inspect() {return tab.evaluate(()=>window.__sfUi.inspect());}
try {
  console.log((await snapshot(tab,{interactive:true})).tree);
  await readScreen();
  await tab.locator('[data-route="home"]').waitFor({state:'visible'});
  ${scenario==='full'?full:states}
  const counters=await inspect();
  assert(counters.rawSelfUploads===0,'Raw self upload occurred');
  assert(counters.resultDownloads===0,'Result downloaded while flag disabled');
  assert(routes.size===13,'Expected all13 routes, saw '+[...routes].join(','));
  console.log('SF_EVIDENCE:'+JSON.stringify({passed:true,scenario:${JSON.stringify(scenario)},routes:[...routes],matrix,screenshots,counters,approval:'Pending prototype layout/copy session; browser checks are not human approval'}));
} catch(error) {
  console.log('SF_FAILURE:'+String(error));
  await readScreen();
  await shot('failure');
  throw error;
} finally {await closeTab(tab);}
`;
}

const full=String.raw`
  await tab.evaluate(()=>window.__sfUi.reset({seed:false}));
  await route('home');await shot('01-home');
  await click('Start shopping');await route('capture');
  await click('Storefront photo');await click('Capture storefront');
  await click('Take photo');await shot('02-capture');
  await click('New shop');await click('Take photo');
  await click('End shopping');
  assert((await readScreen()).includes('raw location trail'),'End confirmation missing privacy consequence');
  await click('End shopping',true);await route('home');
  await click('Find it');await route('ask');
  await tab.getByRole('textbox').fill('a blue jacket');
  await click('Find');
  await shot('03-search');
  await click('Best match');await route('pick');
  await click(/^1\./);
  await shot('04-pick');
  await click('Use this item');await route('item');await shot('05-item');
  await click('Try it on');await route('outfit');
  await click('Add a companion');await click('From a trip photo');await route('trips');await shot('06-trips');
  await tab.getByRole('button').filter({hasText:/Nov|November/}).first().click();await route('trip');await shot('07-trip');
  assert(!/Walk back|Walk there/.test(await readScreen()),'Trip offers direct Walk');
  await click(/Open photo/);await route('pick');
  await tab.getByRole('button',{name:/^Tap the item in the photo/}).click({position:{x:100,y:100}});
  await click(/^1\./);
  await click('Add to outfit');await route('outfit');
  await click('Add your photo');await click('Choose from gallery');
  assert((await inspect()).generations===0,'Generated without explicit action');await shot('08-outfit');
  await click('Generate');await route('result');await shot('09-result');
  assert((await inspect()).generations===1,'Generate must occur exactly once');
  await click(/Walk to Shop|Walk back to the photo spot/);await route('walk');
  await tab.evaluate(()=>window.__sfUi.setWalkMode('nearby'));await readScreen();
  await click('I found this shop');await shot('10-arrived');await click('Done');
  await tab.evaluate(()=>window.__sfUi.emitDeepLink('streetfitting://home'));await route('home');
  await click('Try-ons');await route('results');await shot('11-results');
  await click(/Open look from/);await route('result');await click('Delete look');await click('Delete look',true);await route('results');
  await click('Back');await route('home');await click('Wardrobe');await route('wardrobe');
  await click('Add a piece');await click('Choose from gallery');await route('pick');
  await tab.getByRole('button',{name:/^Tap the item in the photo/}).click({position:{x:100,y:100}});
  await click(/^1\./);await click('Add to wardrobe');await route('wardrobe');await shot('12-wardrobe');
  await click('Back');await route('home');await click('Privacy');await route('privacy');await shot('13-privacy');
`;

const states=String.raw`
  await tab.evaluate(()=>window.__sfUi.reset({seed:true}));
  const ids=(await inspect()).ids;
  const visits=[{name:'home'},{name:'capture'},{name:'trips'},{name:'trip',tripId:ids.trips[0]},{name:'ask'},{name:'pick',photoId:ids.photos[0],mode:'shop'},{name:'item',pieceId:ids.pieces[0]},{name:'outfit'},{name:'result',resultId:ids.results[0]},{name:'results'},{name:'walk',source:'result',id:ids.results[0]},{name:'wardrobe'},{name:'privacy'}];
  await route('home');await click('Start shopping');await route('capture');
  for(const entry of visits) {
    await tab.evaluate(value=>window.__sfUi.visit(value),entry);await route(entry.name,'normal');
    await tab.evaluate(()=>window.__sfUi.setOffline(true));
    await tab.getByText(/You.re offline/).first().waitFor({state:'visible'});
    assert((await readScreen()).includes('offline'),'Offline state missing on '+entry.name);
    matrix.push({route:entry.name,state:'offline',passed:true});
    await tab.evaluate(()=>window.__sfUi.setOffline(false));
    await shot(entry.name+'-normal');
  }
  await tab.evaluate(()=>window.__sfUi.reset({seed:false}));
  const emptyText={home:'No trips yet',capture:'Shopping mode is off',trips:'No trips yet',trip:'This trip is no longer available',pick:'Photo deleted',item:'This piece is no longer saved',outfit:'Choose a shop piece first',result:'This look is no longer saved',results:'No looks yet',walk:'No saved photo location',wardrobe:'Your wardrobe is empty'};
  for(const entry of visits) {
    await tab.evaluate(value=>window.__sfUi.visit(value),entry);
    if(emptyText[entry.name])await tab.getByText(emptyText[entry.name],{exact:true}).first().waitFor({state:'visible'});
    else if(entry.name==='ask')assert(await tab.getByRole('textbox').inputValue()==='','Search query did not reset');
    await route(entry.name,'empty');
    if(entry.name==='privacy')matrix[matrix.length-1].reason='Static local disclosure; no data-dependent empty state';
    await shot(entry.name+'-empty');
  }
  await tab.evaluate(()=>window.__sfUi.reset({seed:true}));
  await route('home');await click('Start shopping');await route('capture');
  for(const entry of visits) {
    if(entry.name==='privacy') {matrix.push({route:'privacy',state:'error',applicable:false,reason:'Static local text; no fallible operation'});continue;}
    await tab.evaluate(()=>window.__sfUi.setFailure('all'));
    await tab.evaluate(value=>window.__sfUi.visit(value),entry);
    if(entry.name==='ask'){await tab.getByRole('textbox').fill('a blue jacket');await click('Find');}
    await tab.getByRole('alert').first().waitFor({state:'visible'});
    assert(/could not|couldn.t|didn.t work|unavailable|failed|try again/i.test(await readScreen()),'Error message missing on '+entry.name);
    await route(entry.name,'error');await shot(entry.name+'-error');
    await tab.evaluate(()=>window.__sfUi.setFailure(null));
  }
  await tab.evaluate(()=>window.__sfUi.emitDeepLink('streetfitting://home'));await route('home');
  assert((await inspect()).generations===0,'States generated automatically');
`;
