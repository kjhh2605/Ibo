import {useEffect,useState} from 'react';
import {Shell} from './ui/Shell';
import {UiProvider,useUi} from './ui/state';
import {loadServices} from './ui/services';
import type {Services} from './ui/services';
import {VStack,Heading,Problem,Loading,Button} from './ui/components';
import {Home,Trips,Trip,Capture} from './screens/Shopping';
import {Ask,Pick} from './screens/Search';
import {Item,Outfit,Result,Results,Wardrobe} from './screens/Fitting';
import {Walk} from './screens/Walk';
import {Privacy} from './screens/Privacy';

function Screen() {
  const {route}=useUi();
  switch(route.name) {
    case 'home': return <Home/>;
    case 'capture': return <Capture route={route}/>;
    case 'trips': return <Trips route={route}/>;
    case 'trip': return <Trip route={route}/>;
    case 'ask': return <Ask/>;
    case 'pick': return <Pick route={route}/>;
    case 'item': return <Item route={route}/>;
    case 'outfit': return <Outfit/>;
    case 'result': return <Result route={route}/>;
    case 'results': return <Results/>;
    case 'walk': return <Walk route={route}/>;
    case 'wardrobe': return <Wardrobe/>;
    case 'privacy': return <Privacy/>;
  }
}

export default function App() {
  const [services,setServices]=useState<Services|null>(null);
  const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{let live=true;setError(false);
    void loadServices().then(value=>{if(live)setServices(value);}).catch(()=>{if(live)setError(true);});
    return()=>{live=false;};
  },[attempt]);
  if(!services)return <VStack padding={6} gap={4}><Heading level={1}>Street Fitting</Heading>{error?<><Problem message="Your device services could not start. Your saved data has not been changed."/><Button label="Try again" onClick={()=>setAttempt(value=>value+1)}/></>:<Loading/>}</VStack>;
  return <UiProvider services={services}><Shell><Screen/></Shell></UiProvider>;
}
