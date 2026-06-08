'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { buildPieSlices, type CategorySpend } from '@/lib/reports/analytics'
import { startAppLoading } from '@/lib/loading/app-loading-events'

interface CategorySpendPieChartProps {
  title: string
  description?: string
  categorySpend: CategorySpend[]
  emptyMessage?: string
  filterKind?: 'category' | 'employee'
  baseHref?: string
}

export function CategorySpendPieChart({
  title,
  description,
  categorySpend,
  emptyMessage = 'No category spend to chart yet.',
  filterKind,
  baseHref = '/owner/reports',
}: CategorySpendPieChartProps) {
  const slices = useMemo(() => buildPieSlices(categorySpend), [categorySpend])
  const total = categorySpend.reduce((sum, category) => sum + category.amount, 0)
  const [activeName, setActiveName] = useState<string | null>(null)
  const activeSlice = slices.find(slice => slice.name === activeName) ?? slices[0]

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}

            {slices.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <div className="mt-4 grid gap-2">
                {slices.map(slice => (
                  <LegendRow
                    key={slice.name}
                    slice={slice}
                    active={activeSlice?.name === slice.name}
                    href={buildFilterHref(baseHref, filterKind, slice.id)}
                    onFocus={() => setActiveName(slice.name)}
                    onMouseEnter={() => setActiveName(slice.name)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto flex w-48 shrink-0 flex-col items-center">
            {slices.length > 0 && activeSlice ? (
              <>
                <svg viewBox="0 0 100 100" role="img" aria-label={`${title}: ₹${total.toLocaleString('en-IN')} total spend`} className="h-44 w-44 overflow-visible">
                  {slices.map(slice => {
                    const href = buildFilterHref(baseHref, filterKind, slice.id)
                    const isActive = activeSlice.name === slice.name
                    const path = (
                      <path
                        d={slice.path}
                        fill={slice.color}
                        stroke="white"
                        strokeWidth={isActive ? '2' : '1'}
                        transform={isActive ? 'scale(1.025 1.025) translate(-1.25 -1.25)' : undefined}
                        className="cursor-pointer transition-opacity hover:opacity-85 focus:opacity-85"
                        onMouseEnter={() => setActiveName(slice.name)}
                        onFocus={() => setActiveName(slice.name)}
                      >
                        <title>{slice.tooltip}</title>
                      </path>
                    )

                    return href ? (
                      <a key={slice.name} href={href} onClick={startAppLoading} aria-label={`Open ${slice.name} report`}>
                        {path}
                      </a>
                    ) : (
                      <g key={slice.name}>{path}</g>
                    )
                  })}
                  <circle cx="50" cy="50" r="20" fill="white" />
                  <text x="50" y="45" textAnchor="middle" className="fill-muted-foreground text-[5.5px]">
                    {activeSlice.percentage}%
                  </text>
                  <text x="50" y="54" textAnchor="middle" className="fill-foreground text-[7.5px] font-semibold">
                    ₹{compactAmount(activeSlice.amount)}
                  </text>
                  <text x="50" y="62" textAnchor="middle" className="fill-muted-foreground text-[4.5px]">
                    selected
                  </text>
                </svg>
                <p className="mt-1 max-w-48 truncate text-center text-sm font-medium">{activeSlice.name}</p>
                <p className="text-center text-xs text-muted-foreground">
                  ₹{activeSlice.amount.toLocaleString('en-IN')} of ₹{total.toLocaleString('en-IN')}
                </p>
              </>
            ) : (
              <div className="grid h-44 w-44 place-items-center rounded-full border bg-muted/30 text-center text-xs text-muted-foreground">
                No spend
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface LegendRowProps {
  slice: ReturnType<typeof buildPieSlices>[number]
  active: boolean
  href: string | null
  onFocus: () => void
  onMouseEnter: () => void
}

function LegendRow({ slice, active, href, onFocus, onMouseEnter }: LegendRowProps) {
  const className = `flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
    active ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted/60'
  }`

  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: slice.color }}
        />
        <span className="truncate">{slice.name}</span>
      </div>
      <span className="shrink-0 text-muted-foreground">
        ₹{slice.amount.toLocaleString('en-IN')} / {slice.percentage}%
      </span>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        onClick={startAppLoading}
        onFocus={onFocus}
        onMouseEnter={onMouseEnter}
        className={className}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onFocus={onFocus}
      onMouseEnter={onMouseEnter}
      className={className}
    >
      {content}
    </button>
  )
}

function buildFilterHref(baseHref: string, filterKind?: 'category' | 'employee', id?: string | null): string | null {
  if (!filterKind || !id) return null
  const param = filterKind === 'category' ? 'category_id' : 'worker_id'
  return `${baseHref}?${param}=${encodeURIComponent(id)}`
}

function compactAmount(amount: number): string {
  if (amount >= 100000) return `${Math.round(amount / 1000).toLocaleString('en-IN')}k`
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`
  return amount.toLocaleString('en-IN')
}
