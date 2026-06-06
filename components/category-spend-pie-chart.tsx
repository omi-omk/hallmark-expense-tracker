import { Card, CardContent } from '@/components/ui/card'
import { buildPieSlices, type CategorySpend } from '@/lib/reports/analytics'

interface CategorySpendPieChartProps {
  title: string
  description?: string
  categorySpend: CategorySpend[]
  emptyMessage?: string
}

export function CategorySpendPieChart({
  title,
  description,
  categorySpend,
  emptyMessage = 'No category spend to chart yet.',
}: CategorySpendPieChartProps) {
  const slices = buildPieSlices(categorySpend)
  const total = categorySpend.reduce((sum, category) => sum + category.amount, 0)

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
                  <div key={slice.name} className="flex items-center justify-between gap-3 text-sm">
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
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto flex w-48 shrink-0 flex-col items-center">
            {slices.length > 0 ? (
              <>
                <svg viewBox="0 0 100 100" role="img" aria-label={`${title}: ₹${total.toLocaleString('en-IN')} total spend`} className="h-44 w-44">
                  {slices.map(slice => (
                    <path
                      key={slice.name}
                      d={slice.path}
                      fill={slice.color}
                      stroke="white"
                      strokeWidth="1"
                      className="cursor-pointer transition-opacity hover:opacity-80"
                    >
                      <title>{slice.tooltip}</title>
                    </path>
                  ))}
                  <circle cx="50" cy="50" r="20" fill="white" />
                  <text x="50" y="47" textAnchor="middle" className="fill-muted-foreground text-[6px]">
                    Total
                  </text>
                  <text x="50" y="56" textAnchor="middle" className="fill-foreground text-[8px] font-semibold">
                    ₹{compactAmount(total)}
                  </text>
                </svg>
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

function compactAmount(amount: number): string {
  if (amount >= 100000) return `${Math.round(amount / 1000).toLocaleString('en-IN')}k`
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`
  return amount.toLocaleString('en-IN')
}
