import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'gold' | 'wood' | 'ghost' | 'danger' | 'felt'

const VARIANTS: Record<Variant, string> = {
  gold:
    'text-[#241808] bg-[linear-gradient(180deg,#fbe7a6_0%,#e2bf66_45%,#b68b35_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.7),inset_0_-2px_0_rgba(0,0,0,.2),0_6px_18px_-6px_rgba(214,172,82,.55)] hover:brightness-110',
  wood:
    'text-[#f8f4ea] bg-[linear-gradient(180deg,#5b2a15_0%,#3a190b_100%)] ring-1 ring-inset ring-[#d4af5a]/45 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_6px_16px_-8px_rgba(0,0,0,.8)] hover:ring-[#f3dc9a]/80 hover:brightness-110',
  felt:
    'text-[#f8f4ea] bg-[linear-gradient(180deg,#1d6b45_0%,#0f4a2e_100%)] ring-1 ring-inset ring-[#d4af5a]/40 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_6px_16px_-8px_rgba(0,0,0,.8)] hover:ring-[#f3dc9a]/80 hover:brightness-110',
  danger:
    'text-[#fff4f0] bg-[linear-gradient(180deg,#8e1b22_0%,#5a0d13_100%)] ring-1 ring-inset ring-[#f3a3a3]/30 shadow-[inset_0_1px_0_rgba(255,255,255,.15),0_6px_16px_-8px_rgba(0,0,0,.8)] hover:brightness-115',
  ghost: 'text-[#e9dcb8] hover:text-[#fff4d0] hover:bg-white/5 ring-1 ring-inset ring-white/10',
}

export function Button({
  variant = 'wood',
  size = 'md',
  className = '',
  kbd,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; kbd?: string }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-14 px-7 text-lg' : 'h-11 px-5 text-[15px]'
  return (
    <button
      className={`relative inline-flex select-none items-center whitespace-nowrap justify-center gap-2 rounded-xl font-semibold tracking-wide transition duration-150 active:translate-y-px active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50 ${sz} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
      {kbd && (
        <kbd className="ml-1 rounded-md bg-black/25 px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase leading-none opacity-70">{kbd}</kbd>
      )}
    </button>
  )
}

/** Modal built on the native <dialog>: focus trap, Esc and inert background for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className = '',
  dismissable = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  dismissable?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current!
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissable) onClose()
      }}
      onClick={(e) => dismissable && e.target === ref.current && onClose()}
      className={`m-auto max-h-[90vh] w-[min(92vw,460px)] overflow-visible rounded-2xl bg-transparent p-0 text-[#f8f4ea] backdrop:bg-black/60 backdrop:backdrop-blur-[2px] open:animate-[dialog-in_.28s_cubic-bezier(.2,.9,.3,1.2)] ${className}`}
    >
      <div className="relative rounded-2xl border border-[#d4af5a]/40 bg-[radial-gradient(ellipse_at_top,#1f5a3b_0%,#0d3322_60%,#0a2519_100%)] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]">
        <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#d4af5a]/20" />
        <div className="relative mb-4 flex items-center justify-between">
          <h2 className="gold-text font-serif text-2xl font-bold">{title}</h2>
          {dismissable && (
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#e9dcb8] hover:bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        <div className="relative">{children}</div>
      </div>
    </dialog>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="text-[15px] text-[#efe6cf]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full ring-1 ring-inset transition-colors duration-200 ${checked ? 'bg-[#c9a24a] ring-[#f3dc9a]/60' : 'bg-black/40 ring-white/15'}`}
      >
        <span
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-[linear-gradient(180deg,#fff,#e7dcc2)] shadow-md transition-transform duration-200 [transition-timing-function:cubic-bezier(.3,1.4,.5,1)] ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </label>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  id,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  label: string
  id?: string
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input
      id={id}
      type="range"
      aria-label={label}
      className="gold-range w-full"
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--pct' as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  disabled?: (v: T) => boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value
        const off = disabled?.(o.value)
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            disabled={off}
            onClick={() => onChange(o.value)}
            className={`min-w-14 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
              on
                ? 'bg-[linear-gradient(180deg,#fbe7a6,#c9a24a)] text-[#241808] shadow-[0_0_0_1px_#f3dc9a,0_8px_20px_-8px_rgba(214,172,82,.7)]'
                : 'bg-black/30 text-[#efe6cf] ring-1 ring-inset ring-[#d4af5a]/25 hover:ring-[#d4af5a]/60'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
