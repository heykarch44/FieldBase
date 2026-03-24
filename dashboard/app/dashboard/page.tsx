'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { ServiceFeed } from '@/components/dashboard/service-feed'
import { Button } from '@/components/ui/button'
import { UserPlus, Wrench, MapPin } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Dashboard</h1>
        <p className="text-sm text-sand-500">Overview of Aqua Palm Pool Service operations</p>
      </div>

      <KpiCards />

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/customers">
          <Button variant="secondary" size="sm">
            <UserPlus className="h-4 w-4" />
            Add Customer
          </Button>
        </Link>
        <Link href="/dashboard/repairs">
          <Button variant="secondary" size="sm">
            <Wrench className="h-4 w-4" />
            View Repair Queue
          </Button>
        </Link>
        <Link href="/dashboard/routes">
          <Button variant="secondary" size="sm">
            <MapPin className="h-4 w-4" />
            {"Today's Routes"}
          </Button>
        </Link>
      </div>

      <ServiceFeed />
    </div>
  )
}
