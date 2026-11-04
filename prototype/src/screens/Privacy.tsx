import { Row } from '../kit'
import { Screen, Section, TopBar } from '../ui'

const STAYS = [
  ['Photos of you', 'With your face, and the originals'],
  ['Your location trail', 'Only while shopping mode is on, deleted when it ends'],
  ['Shop photos', 'And the index used to search them'],
  ['Try-on results', 'Your face is put back here'],
]

const LEAVES = [
  ['What you ask', 'With a short summary of today’s shops'],
  ['Up to 3 shop photos', 'To outline the items in them'],
  ['Storefront photos', 'To write a short description of each shop'],
  ['Your photo without face or hair', 'Plus the pieces, to make a try-on'],
  ['Start and end of a walk', 'To draw the route'],
]

export function Privacy() {
  return (
    <Screen bar={<TopBar title="Privacy" sub="What stays and what leaves" />}>
      <Section title="Stays on this phone">
        <div className="sf-list">
          {STAYS.map(([t, s]) => (
            <Row key={t} className="sf-row" title={t} subtitle={s} />
          ))}
        </div>
      </Section>
      <Section title="Leaves once, not stored">
        <div className="sf-list">
          {LEAVES.map(([t, s]) => (
            <Row key={t} className="sf-row" title={t} subtitle={s} />
          ))}
        </div>
        <div className="sf-pad">
          <div className="sf-fineprint">Sent through our relay to Meta’s models. The relay keeps nothing.</div>
        </div>
      </Section>
    </Screen>
  )
}
