import { ELEMENT_BY_ID } from '../data/elements'
import { gateElementOf, gateKindLabel, gateLabel, type GateCard } from '../data/gates'

export function GateChip({ gate }: { gate: GateCard }) {
  const element = ELEMENT_BY_ID[gateElementOf(gate)]
  return (
    <div
      className="flex items-center gap-2 rounded-md border bg-black/50 px-2 py-1"
      style={{ borderColor: `${element.color}88` }}
      title={gate.text}
    >
      <img src={element.icon} alt="" className="h-6 w-6" />
      <div className="leading-tight">
        <p className="text-xs font-bold">{gateLabel(gate)}</p>
        <p className="text-[10px] text-white/45">{gateKindLabel(gate)}</p>
      </div>
    </div>
  )
}
