import {check} from './android.mjs';

/** Select only documented phase IDs on real requests; never inspect bodies or replace responses. */
export async function installPhaseHeaders(context) {
  if(context.options.mode!=='mock'||context.phasePage===context.page)return;
  context.phasePage=context.page;context.phaseHeaders??=[];context.tryonPhase??='e2e';
  const base=`http://10.0.2.2:${process.env.RELAY_PORT||'8787'}`;
  for(const endpoint of ['/v1/route','/v1/tryon']){
    await context.page.route(base+endpoint,async route=>{
      const request=route.request();
      if(request.method()!=='POST'){await route.continue();return;}
      const selected=endpoint==='/v1/route'?context.routePhase:context.tryonPhase;
      const allowed=endpoint==='/v1/route'?['e2e-route-start','e2e-route-reroute']:['e2e','e2e-tryon-other','e2e-tryon-target-only'];
      if(!allowed.includes(selected)){context.phaseHeaderError=true;await route.abort('blockedbyclient');return;}
      const headers=await request.allHeaders();headers['x-sf-fixture']=selected;
      context.phaseHeaders.push({endpoint,fixture:selected});
      await route.continue({headers});
    });
  }
}

export function phaseProof(context) {
  check(!context.phaseHeaderError,'fixture_phase_not_declared');
  return context.phaseHeaders||[];
}
