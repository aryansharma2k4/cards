import { CardDefs } from './cards/art'
import { ChipDefs } from './chips/Chip'

/** Shared gradients, filters and symbols referenced by every card/chip SVG on the page. */
export function GlobalDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="soft-shadow-lg" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="blur4" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="blur8" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <CardDefs />
        <ChipDefs />
      </defs>
    </svg>
  )
}
