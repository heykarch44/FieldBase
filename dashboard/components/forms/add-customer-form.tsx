'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address_line1: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  zip: z.string().min(5, 'ZIP is required'),
  pool_type: z.enum(['chlorine', 'saltwater', 'other']),
  monthly_rate: z.string().optional(),
  status: z.enum(['active', 'inactive', 'lead']),
})

type FormData = z.infer<typeof schema>

interface AddCustomerFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function AddCustomerForm({ onSuccess, onCancel }: AddCustomerFormProps) {
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pool_type: 'chlorine',
      status: 'lead',
    },
  })

  async function onSubmit(data: FormData) {
    setError('')
    const supabase = createClient()

    const { error: insertError } = await supabase.from('customers').insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      address_line1: data.address_line1,
      city: data.city,
      state: 'AZ',
      zip: data.zip,
      pool_type: data.pool_type,
      monthly_rate: data.monthly_rate ? parseFloat(data.monthly_rate) : null,
      status: data.status,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          {...register('first_name')}
          error={errors.first_name?.message}
        />
        <Input
          label="Last Name"
          {...register('last_name')}
          error={errors.last_name?.message}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Phone" {...register('phone')} />
      </div>
      <Input
        label="Address"
        {...register('address_line1')}
        error={errors.address_line1?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="City" {...register('city')} error={errors.city?.message} />
        <Input label="ZIP" {...register('zip')} error={errors.zip?.message} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-sand-700">Pool Type</label>
          <select
            {...register('pool_type')}
            className="block w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm"
          >
            <option value="chlorine">Chlorine</option>
            <option value="saltwater">Saltwater</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Input label="Monthly Rate" type="number" step="0.01" {...register('monthly_rate')} />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-sand-700">Status</label>
          <select
            {...register('status')}
            className="block w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm"
          >
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Customer'}
        </Button>
      </div>
    </form>
  )
}
