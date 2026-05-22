import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { WorkerWithBalance } from '@/types'

interface WorkerCardProps {
  worker: WorkerWithBalance
}

export function WorkerCard({ worker }: WorkerCardProps) {
  const isLow = worker.balance < worker.low_balance_threshold

  return (
    <Link href={`/owner/workers/${worker.id}`}>
      <Card className={`cursor-pointer hover:bg-gray-50 ${isLow ? 'border-red-300' : ''}`}>
        <CardContent className="py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {isLow && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
            <div>
              <p className="font-medium">{worker.name}</p>
              <p className="text-sm text-muted-foreground">{worker.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`font-semibold ${isLow ? 'text-red-600' : ''}`}>
                ₹{worker.balance.toLocaleString('en-IN')}
              </p>
              {isLow && <Badge variant="destructive" className="text-xs">Low</Badge>}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
