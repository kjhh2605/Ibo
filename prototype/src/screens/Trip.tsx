import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Images } from 'lucide-react'
import { Badge, Row } from '../kit'
import { useNav, useStore } from '../state'
import { ConfirmSheet, I, NoteSheet, Screen, Section, ShopDescription, ShopImage, TextLink, Thumb, TopBar } from '../ui'

export function Trips({ forOutfit = false }: { forOutfit?: boolean }) {
  const { push } = useNav()
  const { trips, shopsOf, tripPhotos } = useStore()
  const dates = [...new Set(trips.map((trip) => trip.date))]
  return (
    <Screen bar={<TopBar title="All trips" sub={forOutfit ? 'Pick a photo for the try-on' : 'Your shopping, kept on this phone'} />}>
      {!trips.length && <div className="sf-pad"><div className="sf-hint">No trips yet. Start shopping from Home to record your first trip.</div></div>}
      {dates.map((date) => (
        <Section key={date} title={date}>
          <div className="sf-list">
            {trips.filter((trip) => trip.date === date).map((trip) => {
              const photos = tripPhotos(trip.id)
              return (
                <Row key={trip.id} className="sf-row"
                  lead={photos[0] ? <Thumb src={photos[0].src} size={64} /> : <span className="sf-tile"><I icon={Images} /></span>}
                  title={`${trip.start}–${trip.end ?? 'Now'}`}
                  subtitle={`${shopsOf(trip.id).length} shops · ${photos.length} photos`}
                  meta={trip.recording ? <Badge tone="danger" dot>Recording</Badge> : undefined}
                  onClick={() => push({ name: 'trip', tripId: trip.id, forOutfit })}>
                  <I icon={ChevronRight} size={20} className="sf-chev" />
                </Row>
              )
            })}
          </div>
        </Section>
      ))}
    </Screen>
  )
}

export function Trip({ tripId, shopId, forOutfit = false }: { tripId: string; shopId?: string; forOutfit?: boolean }) {
  const { push, pop } = useNav()
  const { trip, shopsOf, photosOf, deleteTrip, say } = useStore()
  const current = trip(tripId)
  const shops = shopsOf(tripId)
  const [noting, setNoting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const selectedShop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    selectedShop.current?.scrollIntoView({ block: 'start' })
  }, [shopId, tripId])
  if (!current) return null
  const noteShop = shops.find((shop) => shop.id === noting)
  return (
    <Screen bar={<TopBar title="Trip" sub={forOutfit ? 'Pick a photo for the try-on' : `${current.date} · ${current.start}–${current.end ?? 'Now'}`}
      actions={<TextLink onClick={() => setDeleting(true)}>Delete trip</TextLink>} />}>
      {current.recording && <div className="sf-pad"><Badge tone="danger" dot>Recording</Badge></div>}
      {!shops.length && <div className="sf-pad"><div className="sf-hint">No shops in this trip yet.</div></div>}
      {shops.map((shop) => {
        const photos = photosOf(shop.id)
        return (
          <div key={shop.id} ref={shop.id === shopId ? selectedShop : undefined} className="sf-trip-shop">
            <Section title={shop.name} action={<span className="sf-count">{shop.time}</span>}>
              <div className="sf-pad">
                <ShopImage shop={shop} height={180} />
                <div className="sf-caption"><ShopDescription shop={shop} /></div>
                <div className="sf-visit-note">
                  <strong>Note</strong>
                  {shop.note && <span>{shop.note}</span>}
                  <TextLink onClick={() => setNoting(shop.id)}>{shop.note ? 'Edit' : 'Add note'}</TextLink>
                </div>
                <div className="sf-trip-photos-title"><strong>Photos</strong><span className="sf-count">{photos.length}</span></div>
                {photos.length ? <div className="sf-trip-photos">
                  {photos.map((photo) => <button type="button" className="sf-trip-photo" key={photo.id}
                    aria-label={`Pick from photo at ${photo.time}`}
                    onClick={() => push({ name: 'pick', photoId: photo.id, mode: forOutfit ? 'outfit' : 'shop' })}>
                    <img src={photo.src} alt={photo.candidates.map((candidate) => candidate.label).join(', ')} />
                    <span>{photo.time}</span>
                  </button>)}
                </div> : <div className="sf-hint">No photos in this shop yet.</div>}
              </div>
            </Section>
          </div>
        )
      })}
      <div className="sf-pad sf-pad--last"><div className="sf-fineprint">{current.recording ? 'Your location trail is recorded while shopping mode is on.' : 'Your location trail was deleted when shopping mode ended. Each shop’s spot and its photos stay on this phone.'}</div></div>
      {noteShop && <NoteSheet shop={noteShop} onClose={() => setNoting(null)} />}
      <ConfirmSheet open={deleting} title="Delete this trip?" text="Its shops, original photos and location trail will be deleted. Saved pieces and their walk-back locations stay on this phone."
        action="Delete trip" onClose={() => setDeleting(false)} onConfirm={() => {
          deleteTrip(tripId)
          pop()
          say('Trip deleted · saved pieces kept')
        }} />
    </Screen>
  )
}
