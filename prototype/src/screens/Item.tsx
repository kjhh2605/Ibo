import { useState } from 'react'
import { Footprints, Image, MapPin, Shirt } from 'lucide-react'
import { Button, Card } from '../kit'
import { useNav, useStore } from '../state'
import { ConfirmSheet, Crop, I, Screen, Sheet, ShopDescription, Storefront, TopBar } from '../ui'

export function Item({ pieceId }: { pieceId: string }) {
  const { push, pop } = useNav()
  const { piece, shop, photo, demo, renamePiece, deletePiece } = useStore()
  const p = piece(pieceId)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [label, setLabel] = useState('')
  if (!p) return null
  const s = p.shop ? shop(p.shop) : undefined
  const ph = p.photoId ? photo(p.photoId) : undefined
  const place = p.place
  const storefront = s?.storefront || place?.storefront
  const shopName = s?.name || place?.shopName
  const isShop = p.from === 'shop'

  return <Screen bar={<TopBar title={p.label} sub={isShop ? `${shopName || 'Saved from a shop'}${ph ? ` · ${ph.time}` : ''}` : 'In your wardrobe'} actions={<Button size="small" onClick={() => setDeleting(true)}>Delete</Button>} />} foot={isShop ? <div className="sf-foot-row"><Button size="large" icon={<I icon={Footprints} size={18} />} onClick={() => push({ name: 'walk', pieceId: p.id })}>Walk back</Button><Button variant="primary" size="large" className="sf-grow" icon={<I icon={Shirt} size={18} />} onClick={() => push({ name: 'outfit', seed: p.id })}>Try it on</Button></div> : undefined}>
    <div className="sf-pad">
      <div className="sf-hero-piece"><Crop src={p.src} w={p.w} h={p.h} box={p.box} width={364} height={340} fill={0.92} /></div>
      <div className="sf-item-name"><div><strong>{p.label}</strong>{p.naming && <div className="sf-fineprint">{demo.offline ? 'Waiting for connection to name this piece.' : 'Spark is naming this piece…'}</div>}</div><Button size="small" onClick={() => { setLabel(p.label); setRenaming(true) }}>Rename</Button></div>
      {isShop && <Card pad="medium" gap={12} className="sf-shopcard">
        {storefront ? <Storefront src={storefront.src} w={storefront.w} h={storefront.h} height={148} /> : <div className="sf-empty">No storefront photo</div>}
        <div className="sf-shopcard__name">{shopName || 'Saved shop'}</div>
        {s ? <ShopDescription shop={s} /> : place?.description && <div className="sf-shopcard__desc">{place.description}</div>}
        {(s?.note || place?.note) && <div className="sf-fineprint">Note: {s?.note || place?.note}</div>}
        <div className="sf-facts"><span className="sf-fact"><I icon={MapPin} size={16} /> {s?.distance || place?.distance} · {s?.walk || place?.walk} walk</span>{ph && <button type="button" className="sf-fact sf-fact--link" onClick={() => push({ name: 'pick', photoId: ph.id, mode: 'shop' })}><I icon={Image} size={16} /> Original photo</button>}</div>
      </Card>}
      {!isShop && <div className="sf-fineprint">Wear this with a saved shop piece. Choose it as a companion on the Try on screen.</div>}
    </div>
    <Sheet open={renaming} label="Rename piece" onClose={() => setRenaming(false)}>
      <div className="sf-sheet__title">Rename piece</div><label className="sf-rename-label" htmlFor="piece-name">Name</label><input id="piece-name" className="sf-rename-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
      <Button variant="primary" size="large" data-disabled={!label.trim() || undefined} onClick={() => { if (label.trim()) { renamePiece(p.id, label.trim()); setRenaming(false) } }}>Save name</Button>
    </Sheet>
    <ConfirmSheet open={deleting} title="Delete this piece?" text="It will be removed from your saved pieces. Existing try-ons keep their own copy." onClose={() => setDeleting(false)} onConfirm={() => { deletePiece(p.id); setDeleting(false); pop() }} />
  </Screen>
}
