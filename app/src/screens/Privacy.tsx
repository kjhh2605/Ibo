import {config} from '../config';
import type {ComponentType, SVGProps} from 'react';
import {Divider} from '@astryxdesign/core/Divider';
import {Heading, Hint, HStack, IconTile, Panel, Reveal, Section, Text, VStack} from '../ui/components';
import {LockIcon, PinIcon, SendIcon, ShieldIcon, TrashIcon, WifiOffIcon} from '../ui/icons';

const localOnly = [
  ['Your original self photo', 'Your full-body photo is stored privately in the app. Ibo removes your face and hair on this phone before a copy is used for try-on. If that doesn’t work, nothing is sent.'],
  ['Your route', 'Ibo records your route only while shopping mode is on, and deletes it when you end the trip. It’s never uploaded. Each photo keeps the spot where you took it, so you can walk back. Retaking a storefront photo saves your current location once, without recording a route.'],
  ['Photo search index', 'Ibo indexes your photos on this phone so you can search them. The index never leaves your phone. Only your search text is processed on our server, and the result is matched against the index here.'],
  ['Your wardrobe photos', 'Wardrobe photos are cut out on this phone. Only the cut-out of a piece can be sent, for the uses listed below.'],
  ['Your finished looks', 'Your face is put back into a look on this phone, and the finished look isn’t uploaded. If the neck and shoulder check doesn’t pass, the look is saved without your face.'],
] as const;
const sentToMeta = [
  ['Searches and shop notes', 'Your question and short summaries of your shops, including your notes, go to Meta’s Muse Spark model. They don’t include locations, images or your photo index.'],
  ['Shop photos you search', 'Up to 3 shop photos per search can go to Meta’s SAM model to outline the items. Other people in those photos aren’t blurred out.'],
  ['Storefront photos', 'If you take one, it goes to Muse Spark for a short description that helps you recognize the shop later.'],
  ['Naming pieces', 'Wardrobe cut-outs, and shop pieces you pick straight from a trip photo, go to Muse Spark for a name and category. Only the cut-out is sent. Pieces you find by searching are named after your search.'],
  ['Trying on', 'Your photo with face and hair removed, one shop piece and up to 5 more cut-outs go to Meta’s Muse Image model. Your original photo and head mask are never sent.'],
  ['Voice search', 'Only Find it records audio, up to 15 seconds, which goes to Meta’s speech-to-text model. The recording is deleted once it’s transcribed or cancelled.'],
  ['Anonymous sign-in', 'Ibo signs you in anonymously. Meta receives an anonymous ID based on it, for safety checks.'],
] as const;
function Group({icon, tone, rows}: {icon: ComponentType<SVGProps<SVGSVGElement>>; tone: 'success' | 'accent' | 'muted'; rows: readonly (readonly [string, string])[]}) {
  return <Panel gap={0} padding={4}>{rows.map(([title, description], index) => <Reveal key={title} index={index} gap={0}>{index > 0 && <Divider/>}<HStack gap={3} vAlign="start" paddingBlock={3}><IconTile icon={icon} tone={tone} size="sm"/><VStack gap={1} style={{flex: 1, minWidth: 0}}><Heading level={3} style={{fontSize: 'var(--font-size-base)'}}>{title}</Heading><Text size="sm" color="secondary">{description}</Text></VStack></HStack></Reveal>)}</Panel>;
}
const maps = [
  ['Walking routes', 'Your current location and the photo spot go through our server to the FOSSGIS OSRM routing service, not to Meta. The destination is always where you photographed the piece. A saved look keeps its own copy of that spot.'],
  ['Map tiles', 'The map loads directly from OpenFreeMap, not through our server or Meta.'],
] as const;
const relay = [
  ['No images, audio or locations', 'Our server passes them along without saving them to files, databases or logs. Meta’s own policies are separate.'],
  ['Minimal logs', 'Logs record only the request type, an anonymous ID, timing, status and the number of AI steps. Development builds may also log search text and AI replies, but never images, audio or locations.'],
] as const;

export function Privacy() {
  return <>
    <VStack gap={3} padding={5} style={{background: 'var(--color-hero)', color: 'var(--color-on-hero)', borderRadius: 'var(--radius-container)'}}>
      <IconTile icon={ShieldIcon} tone="accent"/>
      <Text type="large" weight="semibold" color="inherit">What stays and what leaves</Text>
      <Text size="sm" style={{color: 'color-mix(in srgb, var(--color-on-hero) 80%, transparent)'}}>What Ibo keeps on your phone, and what it sends to Meta’s AI to search, name pieces and create looks. This page works offline.</Text>
    </VStack>
    <Section title="Stays on this phone"><Group icon={LockIcon} tone="success" rows={localOnly}/></Section>
    <Section title="Sent to Meta’s AI through our server">
      <Group icon={SendIcon} tone="accent" rows={sentToMeta}/>
      <Hint icon="warning">Removing your face and hair doesn’t make you anonymous. Your body, background or tattoos may still identify you. Meta’s own retention policies apply, and we can’t promise that Meta deletes data right away or keeps none.</Hint>
    </Section>
    <Section title="Maps and walking">
      <Group icon={PinIcon} tone="muted" rows={maps}/>
      <Hint>Directions only run while this screen is open. There’s no voice, background or indoor navigation.</Hint>
    </Section>
    <Section title="What our server keeps">
      <Group icon={ShieldIcon} tone="muted" rows={relay}/>
      <Hint>Ibo asks Meta not to store requests, and sends images inside the request instead of uploading them as files. Meta’s service and safety retention still applies.</Hint>
    </Section>
    <Section title="Saved data and deletion">
      <Panel gap={3} padding={4}>
        <HStack gap={3} vAlign="start"><IconTile icon={TrashIcon} tone="muted" size="sm"/><VStack gap={3} style={{flex: 1, minWidth: 0}}>
          <Text size="sm">Ending a trip deletes its route history, but keeps its photos, shop descriptions, notes and photo locations.</Text>
          <Text size="sm">Deleting a trip or shop photo unlinks it from pieces you saved. A saved piece and its walk-back spot stay until you delete the piece.</Text>
          <Text size="sm">Each look keeps its own copy of its pieces, shop details and walk-back spot, so deleting the original shop piece doesn’t delete the look. You just can’t change its pieces anymore. Deleting a look removes only the look and its copies.</Text>
          <Text size="sm">Ibo doesn’t add photos to your gallery on its own. Photos you’ve already saved to your gallery stay there when you delete them in Ibo.</Text>
        </VStack></HStack>
      </Panel>
    </Section>
    <Section title="Offline and your gallery">
      <Panel gap={3} padding={4}>
        <HStack gap={3} vAlign="start"><IconTile icon={WifiOffIcon} tone="muted" size="sm"/><VStack gap={3} style={{flex: 1, minWidth: 0}}>
          <Text size="sm">Offline, you can take photos, shop, browse your photos and looks, add wardrobe pieces, rename and delete. Storefront descriptions and piece names finish when you reconnect. Search, voice, try-on and walking need a connection and aren’t queued, so try again once you’re online.</Text>
          <Text size="sm">You can import from your gallery only for wardrobe and self photos, not shop photos. Photos you save to your gallery have their GPS location removed. Ibo keeps its own record of where each photo was taken.</Text>
          <Text size="sm">{config.resultDownload ? 'Saving looks to your gallery keeps the image service’s watermark and provenance data and removes GPS. If both can’t be guaranteed, saving is blocked.' : 'Saving looks to your gallery isn’t available yet. It stays off until Ibo can keep the image service’s watermark and provenance data while removing GPS.'}</Text>
        </VStack></HStack>
      </Panel>
    </Section>
  </>;
}
