import {VStack,Heading,Text} from './components';
import {IboMark} from './IboMark';

// Shown at app start until the device services are ready (and for a short minimum so it never flashes).
export function Splash() {
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return <VStack role="status" aria-label="Ibo is starting" align="center" justify="center" gap={4} width="100%" height="100dvh" style={{background:'var(--color-hero)',color:'var(--color-on-hero)'}}>
    <IboMark size={144} animated={!reduced}/>
    <Heading level={1} style={{color:'var(--color-on-hero)'}}>Ibo</Heading>
    <Text style={{color:'var(--color-hanok-earth)'}}>Find it. Try it. Walk back.</Text>
  </VStack>;
}
