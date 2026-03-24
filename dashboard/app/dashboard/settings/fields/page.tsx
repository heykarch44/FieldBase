'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, GripVertical, Pencil, Archive, Smartphone } from 'lucide-react'
import type { FieldDefinition, EntityType, FieldType } from '@/lib/types'

const ENTITY_TABS: { key: EntityType; label: string }[] = [
  { key: 'visit', label: 'Visit Fields' },
  { key: 'jobsite', label: 'Jobsite Fields' },
  { key: 'service_order', label: 'Service Order Fields' },
  { key: 'equipment', label: 'Equipment Fields' },
]

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'enum', label: 'Dropdown' },
  { value: 'boolean', label: 'Toggle' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'photo', label: 'Photo' },
  { value: 'signature', label: 'Signature' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
]

export default function FieldManagerPage() {
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<EntityType>('visit')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null)

  useEffect(() => {
    fetchFields()
  }, [])

  async function fetchFields() {
    const supabase = createClient()
    const { data } = await supabase
      .from('field_definitions')
      .select('*')
      .order('display_order')

    setFields((data as FieldDefinition[]) ?? [])
    setLoading(false)
  }

  const currentFields = fields
    .filter((f) => f.entity_type === activeTab && f.active)

  const inactiveFields = fields
    .filter((f) => f.entity_type === activeTab && !f.active)

  async function handleDeactivate(fieldId: string) {
    const supabase = createClient()
    await supabase
      .from('field_definitions')
      .update({ active: false })
      .eq('id', fieldId)
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, active: false } : f))
    )
  }

  async function handleReactivate(fieldId: string) {
    const supabase = createClient()
    await supabase
      .from('field_definitions')
      .update({ active: true })
      .eq('id', fieldId)
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, active: true } : f))
    )
  }

  async function handleInlineEdit(fieldId: string, updates: Partial<FieldDefinition>) {
    const supabase = createClient()
    await supabase
      .from('field_definitions')
      .update(updates)
      .eq('id', fieldId)
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f))
    )
    setEditingField(null)
  }

  // Group fields by group_name for preview
  const groupedFields = currentFields.reduce<Record<string, FieldDefinition[]>>((acc, f) => {
    const key = f.group_name ?? 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Field Manager</h1>
          <p className="text-sm text-sand-500">
            Configure the fields your team fills out in the mobile app
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Field
        </Button>
      </div>

      {/* Entity type tabs */}
      <div className="flex gap-1 rounded-lg bg-sand-100 p-1">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-sand-900 shadow-sm'
                : 'text-sand-500 hover:text-sand-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Field definitions table */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardTitle>Active Fields ({currentFields.length})</CardTitle>
              {currentFields.length === 0 ? (
                <p className="py-8 text-center text-sm text-sand-400">
                  No fields configured. Add your first field above.
                </p>
              ) : (
                <div className="space-y-1">
                  {currentFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 rounded-lg border border-sand-100 p-3 hover:bg-sand-50"
                    >
                      <GripVertical className="h-4 w-4 text-sand-300 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sand-900">{field.label}</span>
                          {field.is_required && (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                              Required
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-sand-400">
                          <span>{field.field_key}</span>
                          <span>&middot;</span>
                          <span className="capitalize">{field.field_type}</span>
                          {field.group_name && (
                            <>
                              <span>&middot;</span>
                              <span>{field.group_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingField(field)}
                        className="rounded-md p-1.5 text-sand-400 hover:bg-sand-100 hover:text-sand-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivate(field.id)}
                        className="rounded-md p-1.5 text-sand-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {inactiveFields.length > 0 && (
              <Card>
                <CardTitle>Inactive Fields ({inactiveFields.length})</CardTitle>
                <div className="space-y-1">
                  {inactiveFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-lg border border-sand-100 p-3 opacity-60"
                    >
                      <div>
                        <span className="text-sand-600">{field.label}</span>
                        <span className="ml-2 text-xs text-sand-400">({field.field_type})</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReactivate(field.id)}
                      >
                        Reactivate
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Live mobile preview */}
          <div className="hidden lg:block">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-sand-400" />
                <CardTitle>Mobile Preview</CardTitle>
              </div>
              <div className="rounded-2xl border-2 border-sand-200 bg-sand-50 p-4 min-h-[500px]">
                {Object.entries(groupedFields).map(([group, groupFields]) => (
                  <div key={group} className="mb-4">
                    <div className="mb-2 rounded-md bg-sand-200/50 px-3 py-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-sand-500">
                        {group}
                      </p>
                    </div>
                    {groupFields.map((field) => (
                      <div key={field.id} className="mb-3 px-1">
                        <div className="mb-1 flex items-center gap-1">
                          <p className="text-xs font-semibold text-sand-700">
                            {field.label}
                          </p>
                          {field.is_required && (
                            <span className="text-xs text-red-500">*</span>
                          )}
                        </div>
                        {field.field_type === 'boolean' ? (
                          <div className="flex items-center justify-between rounded-md border border-sand-200 bg-white p-2">
                            <span className="text-xs text-sand-400">No</span>
                            <div className="h-4 w-8 rounded-full bg-sand-200" />
                          </div>
                        ) : field.field_type === 'enum' ? (
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(field.options) ? field.options : []).map(
                              (opt: string, i: number) => (
                                <span
                                  key={i}
                                  className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] text-sand-500"
                                >
                                  {opt}
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <div className="rounded-md border border-sand-200 bg-white px-2 py-1.5">
                            <p className="text-xs text-sand-300">
                              {field.field_type === 'textarea'
                                ? 'Multi-line text...'
                                : field.field_type === 'number'
                                ? '0.00'
                                : field.field_type === 'date'
                                ? 'YYYY-MM-DD'
                                : 'Enter value...'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {currentFields.length === 0 && (
                  <div className="flex h-40 items-center justify-center">
                    <p className="text-xs text-sand-400">No fields to preview</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Add Field Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Field"
        className="max-w-md"
      >
        <AddFieldForm
          entityType={activeTab}
          onSuccess={() => {
            setShowAddModal(false)
            fetchFields()
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Field Modal */}
      {editingField && (
        <Modal
          open={!!editingField}
          onClose={() => setEditingField(null)}
          title="Edit Field"
          className="max-w-md"
        >
          <EditFieldForm
            field={editingField}
            onSave={(updates) => handleInlineEdit(editingField.id, updates)}
            onCancel={() => setEditingField(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function AddFieldForm({
  entityType,
  onSuccess,
  onCancel,
}: {
  entityType: EntityType
  onSuccess: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [fieldType, setFieldType] = useState<FieldType>('text')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const label = form.get('label') as string
    const fieldKey = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    const supabase = createClient()
    const optionsRaw = form.get('options') as string
    const options = fieldType === 'enum' && optionsRaw
      ? optionsRaw.split(',').map((o) => o.trim()).filter(Boolean)
      : null

    const { error } = await supabase.from('field_definitions').insert({
      entity_type: entityType,
      field_key: fieldKey,
      label,
      field_type: fieldType,
      options,
      group_name: (form.get('group_name') as string) || null,
      is_required: form.get('is_required') === 'on',
      description: (form.get('description') as string) || null,
    })

    setSaving(false)
    if (!error) onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Label *</label>
        <Input name="label" required placeholder="e.g., pH Before" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Type *</label>
        <select
          className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm"
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as FieldType)}
        >
          {FIELD_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {fieldType === 'enum' && (
        <div>
          <label className="mb-1 block text-sm font-medium text-sand-700">Options (comma-separated)</label>
          <Input name="options" placeholder="Good, Fair, Poor" />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Group</label>
        <Input name="group_name" placeholder="e.g., Water Chemistry" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Help Text</label>
        <Input name="description" placeholder="Shown below the field" />
      </div>
      <label className="flex items-center gap-2 text-sm text-sand-700">
        <input type="checkbox" name="is_required" className="rounded" />
        Required field
      </label>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Adding...' : 'Add Field'}
        </Button>
      </div>
    </form>
  )
}

function EditFieldForm({
  field,
  onSave,
  onCancel,
}: {
  field: FieldDefinition
  onSave: (updates: Partial<FieldDefinition>) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(field.label)
  const [isRequired, setIsRequired] = useState(field.is_required)
  const [showOnReport, setShowOnReport] = useState(field.show_on_report)
  const [groupName, setGroupName] = useState(field.group_name ?? '')
  const [description, setDescription] = useState(field.description ?? '')

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Label</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Group</label>
        <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-sand-700">Help Text</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-sand-700">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="rounded"
        />
        Required
      </label>
      <label className="flex items-center gap-2 text-sm text-sand-700">
        <input
          type="checkbox"
          checked={showOnReport}
          onChange={(e) => setShowOnReport(e.target.checked)}
          className="rounded"
        />
        Show on report
      </label>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() =>
            onSave({
              label,
              is_required: isRequired,
              show_on_report: showOnReport,
              group_name: groupName || null,
              description: description || null,
            })
          }
        >
          Save Changes
        </Button>
      </div>
    </div>
  )
}
