import type { LucideIcon } from 'lucide-react'

export default function StatCard({ label, value, subtext, Icon }: { label: string; value: string | number; subtext: string; Icon: LucideIcon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon size={19} /></div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-subtext">{subtext}</div>
      </div>
    </div>
  )
}
