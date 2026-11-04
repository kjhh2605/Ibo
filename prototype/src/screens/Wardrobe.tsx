import { useState } from 'react'
import { Camera, ImagePlus, Plus } from 'lucide-react'
import { Button, Row } from '../kit'
import { useNav, useStore } from '../state'
import { I, PieceTile, Screen, Sheet, TopBar } from '../ui'

export function Wardrobe() {
  const { push } = useNav()
  const { wardrobe } = useStore()
  const [adding, setAdding] = useState(false)
  const open = () => {
    setAdding(false)
    push({ name: 'pick', photoId: 'w-i21', mode: 'wardrobe' })
  }

  return (
    <Screen
      bar={<TopBar title="Wardrobe" sub={`${wardrobe.length} pieces you own`} />}
      foot={
        <Button variant="primary" size="large" className="sf-grow" icon={<I icon={Plus} size={20} />} onClick={() => setAdding(true)}>
          Add a piece
        </Button>
      }
    >
      <div className="sf-pad">
        <div className="sf-grid sf-grid--last">
          {wardrobe.map((p) => (
            <PieceTile key={p.id} piece={p} size={172} onClick={() => push({ name: 'item', pieceId: p.id })} />
          ))}
        </div>
        <div className="sf-fineprint">Mix these with what you saved to see them together. Only the cut-out piece is ever sent, never the whole photo.</div>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} label="Add a piece">
        <div className="sf-sheet__title">Add a piece</div>
        <div className="sf-sheet__text">Lay it flat or hang it up. You’ll tap it to cut it out.</div>
        <div className="sf-sheet__list">
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={Camera} /></span>} title="Take a photo" onClick={open} />
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={ImagePlus} /></span>} title="Choose from gallery" onClick={open} />
        </div>
      </Sheet>
    </Screen>
  )
}
