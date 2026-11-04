import { Row } from '../kit'
import { Screen, Section, TopBar } from '../ui'

const STAYS = [
  ['Your original self photo', 'Your face and hair stay here. Only a face-and-hair-removed copy is sent for try-on.'],
  ['Your location trail', 'Recorded only while shopping, deleted when the trip ends.'],
  ['Photo embeddings', 'The image search index is processed and kept on this phone.'],
  ['Your wardrobe originals', 'Only garment cut-outs leave, never the full wardrobe photo.'],
  ['Your finished looks', 'Your face is put back on this phone. The result is not uploaded again.'],
]

const LEAVES = [
  ['Queries and shop notes', 'Query text and visit summaries, including memos, go to Meta Spark.'],
  ['Selected shopping photos', 'Up to 3 photos per query go to Meta SAM to find garments.'],
  ['Storefront photos', 'Go to Meta Spark for a short shop description.'],
  ['Garment cut-outs', 'Wardrobe and directly picked trip pieces go to Spark for names. Target and companion crops go to Muse Image for try-on.'],
  ['Your photo without face or hair', 'One masked self photo, one target and up to 5 companion crops go to Muse Image through our relay.'],
  ['Voice searches', 'Up to 15 seconds of audio goes to Meta Voice Transcribe.'],
]

export function Privacy() {
  return (
    <Screen bar={<TopBar title="Privacy" sub="What stays and what leaves" />}>
      <Section title="Stays on this phone">
        <div className="sf-list">
          {STAYS.map(([t, s]) => (
            <Row key={t} className="sf-row sf-row--wrap" title={t} subtitle={s} />
          ))}
        </div>
      </Section>
      <Section title="Sent through our relay to Meta">
        <div className="sf-list">
          {LEAVES.map(([t, s]) => (
            <Row key={t} className="sf-row sf-row--wrap" title={t} subtitle={s} />
          ))}
        </div>
        <div className="sf-pad">
          <div className="sf-fineprint">Removing face and hair is not full anonymity: body, background or tattoos may still identify you. Meta’s own service and safety retention policies apply.</div>
        </div>
      </Section>
      <Section title="Maps and walking">
        <div className="sf-list">
          <Row className="sf-row sf-row--wrap" title="Only the route endpoints" subtitle="Your current and destination coordinates go through the relay to OSRM for walking directions, not to Meta." />
          <Row className="sf-row sf-row--wrap" title="Map tiles" subtitle="The app requests the visible map area directly from OpenFreeMap." />
        </div>
      </Section>
      <Section title="What the relay keeps">
        <div className="sf-list">
          <Row className="sf-row sf-row--wrap" title="No stored images, audio or coordinates" subtitle="These pass through request memory and are never saved to relay files, databases or logs." />
          <Row className="sf-row sf-row--wrap" title="Limited operational logs" subtitle="Endpoint, pseudonymous ID, latency, status and Spark turn count. A local development flag may log query text and Spark responses, never images, audio or coordinates." />
          <Row className="sf-row sf-row--wrap" title="Gallery export" subtitle="Photo exports remove GPS metadata. Saving generated looks to the gallery is currently unavailable." />
        </div>
      </Section>
    </Screen>
  )
}
