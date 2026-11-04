import {config} from '../config';
import {Heading, Section, Text, VStack} from '../ui/components';

const localOnly = [
  ['Your original self photo, face and hair', 'One self photo is kept in app-private storage. Its original and face-and-hair mask are used only on this phone. Registration must safely remove face and hair before a copy can be used for try-on; an unsuccessful mask never falls back to sending the original.'],
  ['Your location trail', 'Recorded only while shopping. The raw trail is deleted when you end the trip and is never uploaded. Saved photo locations remain for walking back. Walking guidance does not create a shopping trail.'],
  ['Photo embeddings', 'The photo search index is processed and stored on this phone. Photo vectors are not uploaded. A text vector comes back from the relay and is compared with the local index.'],
  ['Your wardrobe originals', 'Wardrobe photos are cut out on this phone. The whole wardrobe photo is not sent; only a garment cut-out can leave for the purposes below.'],
  ['Your face-restored looks', 'Any face restoration happens on this phone. The finished look is not uploaded again. If the automatic neck and shoulder checks do not pass, the look is saved without your face.'],
] as const;
const sentToMeta = [
  ['Queries, shop notes and visit summaries', 'Your query and visit summaries, including shop memos, go through the relay to Meta Spark. The summaries do not contain raw coordinates, images or photo embeddings. Tool results contain only the references, scores and counts allowed for the search.'],
  ['Selected shopping photos', 'Shopping originals are stored locally, but up to 3 selected shopping photos per query can go through the relay to Meta SAM to find garments. Other people in these photos are not automatically masked. The protection for your self photo is not a promise to hide everyone in shopping photos.'],
  ['Storefront photos', 'An optional storefront photo goes through the relay to Meta Spark for a short English description. The description and your note are shown with the shop in its trip and can help you recognize it when walking back.'],
  ['Garment names and categories', 'Wardrobe cut-outs and shop garments picked directly from a trip photo without a search go to Meta Spark for a name and category. This request sends the cut-out, not the whole wardrobe or trip photo. Shop pieces selected from search use the search concept as their name.'],
  ['Try-on inputs', 'One self photo with face and hair removed, one shop target cut-out and up to 5 companion cut-outs go through the relay to Muse Image. Wardrobe pieces may be companions, not the target. The original self photo and head mask are never part of this request.'],
  ['Voice searches', 'Only Find it offers recording. Up to 15 seconds of audio goes through the relay to Meta Voice Transcribe. The transcript starts the search immediately. The temporary recording is removed after transcription, failure or cancellation.'],
  ['Pseudonymous authentication', 'The relay verifies Firebase anonymous authentication and App Check. A pseudonymous identifier derived from your anonymous user ID is sent to Meta as a safety identifier.'],
] as const;

export function Privacy() {
  return <>
    <Text>What stays and what leaves</Text>
    <Text>This explanation is available offline. It is not a separate sending approval screen.</Text>
    <Section title="Stays on this phone">
      {localOnly.map(([title, description]) => <VStack key={title} gap={2}><Heading level={3}>{title}</Heading><Text>{description}</Text></VStack>)}
    </Section>
    <Section title="Sent through our relay to Meta">
      {sentToMeta.map(([title, description]) => <VStack key={title} gap={2}><Heading level={3}>{title}</Heading><Text>{description}</Text></VStack>)}
      <Text>Removing face and hair is not full anonymity: your body, background, tattoos or other details may still identify you. Meta’s own service and safety retention policies apply. We do not promise immediate deletion or zero retention by Meta.</Text>
    </Section>
    <Section title="Maps and walking">
      <VStack gap={2}><Heading level={3}>Only the route endpoints</Heading><Text>Your current and destination coordinates go through the relay to FOSSGIS OSRM foot for walking directions, not to Meta. The destination is the target item’s saved photo location, or the independent location snapshot saved with a look. Shop pins and companion pieces do not replace it.</Text></VStack>
      <VStack gap={2}><Heading level={3}>Map tiles</Heading><Text>The app requests the visible map area directly from OpenFreeMap, without going through the relay. Map requests are not Meta requests.</Text></VStack>
      <Text>Guidance runs while this screen is in the foreground. It does not provide voice, background or indoor navigation.</Text>
    </Section>
    <Section title="What the relay keeps">
      <VStack gap={2}><Heading level={3}>Images, audio and coordinates are not stored</Heading><Text>These pass through request memory and are not written to relay files, databases or logs. The relay runs on a local Mac; its handling is separate from the external providers’ retention policies.</Text></VStack>
      <VStack gap={2}><Heading level={3}>Limited operational logs</Heading><Text>Default logs contain only endpoint, pseudonymous ID, latency, status code and Spark turn count. A local development flag may additionally log query text and Spark response bodies. Images, audio and coordinates remain excluded even with that flag, including coordinates embedded in text. This is not a general exception for shop memos, audio transcripts or upload bytes.</Text></VStack>
      <Text>Supported Meta requests use store:false and send image bytes within the request rather than uploading them through a Files API. That setting does not remove Meta’s service or safety retention.</Text>
    </Section>
    <Section title="Saved data and deletion">
      <Text>Ending a shopping trip deletes its raw location trail, not its photos, shop descriptions, notes or photo locations.</Text>
      <Text>Deleting a trip or original shopping photo removes its original-photo link from saved pieces. A saved cut-out and its walking destination stay until you delete that piece.</Text>
      <Text>Every look keeps independent copies of its garment names, cut-outs, shop details and target photo location. Deleting the original target does not delete the look or its walking destination; only Change pieces becomes unavailable. Deleting the look removes the look and its owned snapshot copies without deleting your original pieces.</Text>
      <Text>Photos are not automatically added to your gallery. A gallery copy you have already exported is separate from the app and is not removed by an in-app deletion.</Text>
    </Section>
    <Section title="Offline and gallery export">
      <Text>You can capture, record shopping, browse local photos and saved looks, add wardrobe pieces, rename and delete while offline. Only storefront descriptions and garment naming wait in a local queue. Deleted sources are removed from those jobs. Search, voice, generation and walking requests are not queued; connect and retry them yourself.</Text>
      <Text>Importing from the gallery is offered only for wardrobe and self photos, not shopping photos. Explicit photo exports remove EXIF GPS from the gallery copy without changing the app’s saved photo location.</Text>
      <Text>{config.resultDownload ? 'Generated-look export is enabled only with a verified exporter that preserves the provider’s watermark and provenance metadata while removing GPS. Export is refused if those requirements cannot both be met.' : 'Saving generated looks to the gallery is currently unavailable. This feature stays off until watermark and provenance metadata preservation are verified; enabling it must also preserve provenance while removing GPS.'}</Text>
    </Section>
  </>;
}
