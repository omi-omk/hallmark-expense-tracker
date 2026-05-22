import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface BalanceCardProps {
  balance: number
  threshold: number
}

export function BalanceCard({ balance, threshold }: BalanceCardProps) {
  const isLow = balance < threshold
  return (
    <Card className={isLow ? 'border-red-300 bg-red-50' : ''}>
      <CardContent className="pt-6">
        {isLow && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Low balance — please inform your manager</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">Your Balance</p>
        <p className={`text-4xl font-bold mt-1 ${isLow ? 'text-red-600' : ''}`}>
          ₹{balance.toLocaleString('en-IN')}
        </p>
      </CardContent>
    </Card>
  )
}
