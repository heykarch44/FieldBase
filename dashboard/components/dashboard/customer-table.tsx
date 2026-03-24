'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import type { Customer } from '@/lib/types'
import { formatCurrency, formatDayOfWeekShort, formatPoolType } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, ArrowUpDown, Download } from 'lucide-react'

const columnHelper = createColumnHelper<Customer>()

const statusVariants: Record<string, 'green' | 'gray' | 'amber'> = {
  active: 'green',
  inactive: 'gray',
  lead: 'amber',
}

interface CustomerTableProps {
  customers: Customer[]
}

export function CustomerTable({ customers }: CustomerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return customers
    return customers.filter((c) => c.status === statusFilter)
  }, [customers, statusFilter])

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => `${row.first_name} ${row.last_name}`, {
        id: 'name',
        header: 'Name',
        cell: (info) => (
          <Link
            href={`/dashboard/customers/${info.row.original.id}`}
            className="font-medium text-aqua-700 hover:text-aqua-800"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => <span className="text-sand-600">{info.getValue() ?? '—'}</span>,
      }),
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: (info) => <span className="text-sand-600">{info.getValue() ?? '—'}</span>,
      }),
      columnHelper.accessor('city', {
        header: 'City',
      }),
      columnHelper.accessor('pool_type', {
        header: 'Pool Type',
        cell: (info) => formatPoolType(info.getValue()),
      }),
      columnHelper.accessor('service_day', {
        header: 'Service Day',
        cell: (info) => (info.getValue() ? formatDayOfWeekShort(info.getValue()!) : '—'),
      }),
      columnHelper.accessor('monthly_rate', {
        header: 'Monthly Rate',
        cell: (info) => (info.getValue() ? formatCurrency(Number(info.getValue())) : '—'),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge variant={statusVariants[info.getValue()] ?? 'gray'}>
            {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
          </Badge>
        ),
      }),
    ],
    []
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  function exportCsv() {
    const headers = ['Name', 'Email', 'Phone', 'City', 'Pool Type', 'Service Day', 'Monthly Rate', 'Status']
    const rows = filteredData.map((c) => [
      `${c.first_name} ${c.last_name}`,
      c.email ?? '',
      c.phone ?? '',
      c.city,
      c.pool_type,
      c.service_day ?? '',
      c.monthly_rate?.toString() ?? '',
      c.status,
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search customers..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-sand-700"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="lead">Lead</option>
        </select>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-sand-200 bg-sand-50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-sand-600"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3 w-3 text-sand-400" />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-sand-100 hover:bg-sand-50 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sand-400">
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-sand-500">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{' '}
          of {table.getFilteredRowModel().rows.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-sand-600">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
