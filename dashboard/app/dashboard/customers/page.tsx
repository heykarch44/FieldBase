'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CustomerTable } from '@/components/dashboard/customer-table'
import { AddCustomerForm } from '@/components/forms/add-customer-form'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/skeleton'
import { UserPlus } from 'lucide-react'
import type { Customer } from '@/lib/types'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  async function fetchCustomers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('last_name')

    setCustomers((data as Customer[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Customers</h1>
          <p className="text-sm text-sand-500">
            Manage your customer accounts and service details
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <UserPlus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <CustomerTable customers={customers} />
      )}

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Customer"
        className="max-w-xl"
      >
        <AddCustomerForm
          onSuccess={() => {
            setShowAddModal(false)
            fetchCustomers()
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
    </div>
  )
}
