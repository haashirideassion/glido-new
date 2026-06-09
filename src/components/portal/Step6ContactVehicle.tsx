import { useRef, useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import type { DocumentFile } from '@/contexts/WizardContext'
import { Icon, ICONS } from '@/lib/Icon'
import documentsImg from '@/assets/documents.png'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { todaySydney } from '@/lib/time'

// ─── Document slot definitions per combination ────────────────────────────────

interface DocSlot { docType: string; label: string; required: boolean; badge?: string; acceptAttr?: string }

// Convert "PDF, JPG, PNG" → ".pdf,.jpg,.jpeg,.png"
function toAccept(fileTypes: string): string {
  return fileTypes.split(',').map(t => {
    const ext = t.trim().toLowerCase()
    if (ext === 'pdf')               return '.pdf'
    if (ext === 'jpg' || ext === 'jpeg') return '.jpg,.jpeg'
    if (ext === 'png')               return '.png'
    if (ext === 'docx')              return '.docx'
    return '.' + ext
  }).join(',')
}

const DOC_SLOTS: Record<string, DocSlot[]> = {
  'pickup-lcl': [
    { docType: 'delivery_order',    label: 'Delivery Order',                             required: true  },
    { docType: 'biosecurity',       label: 'Biosecurity Direction (if required)',          required: false },
  ],
  'dropoff-lcl': [
    { docType: 'interim_receipt',      label: 'Interim Receipt',       required: true  },
    { docType: 'booking_confirmation', label: 'Booking Confirmation',  required: true  },
    { docType: 'packing_list',         label: 'Packing List (not mandatory)', required: false },
  ],
  'pickup-fcl': [
    { docType: 'cartage_advice',   label: 'Cartage Advice',                              required: true  },
    { docType: 'delivery_order',   label: 'Delivery Order',                              required: true  },
    { docType: 'dangerous_goods',  label: 'Dangerous Goods Docs (if required)',           required: false },
  ],
  'dropoff-fcl': [
    { docType: 'cartage_advice',   label: 'Cartage Advice',                              required: true  },
    { docType: 'delivery_order',   label: 'Delivery Order',                              required: true  },
    { docType: 'dangerous_goods',  label: 'Dangerous Goods Docs (if required)',           required: false },
    { docType: 'biosecurity',      label: 'Biosecurity Direction (if required)',          required: false },
  ],
}

export function Step6ContactVehicle() {
  const { state, dispatch } = useWizard()
  const multi = state.slotCount > 1

  // ── Resolve doc slots for a given combo ──────────────────────────────────────
  function resolveDocSlots(serviceType: string, loadType: string): DocSlot[] {
    const comboCode = `${serviceType}_${loadType}`
    const comboKey  = `${serviceType}-${loadType}`
    if (state.tenantDocs && state.tenantDocs.length > 0) {
      const filtered = state.tenantDocs.filter(d => !d.appliesTo || d.appliesTo.length === 0 || d.appliesTo.includes(comboCode))
      const list = filtered.length > 0 ? filtered : state.tenantDocs
      return list.map(d => ({
        docType:    d.id,
        label:      d.name,
        required:   d.required,
        acceptAttr: toAccept(Array.isArray(d.fileTypes) ? d.fileTypes.join(', ') : (d.fileTypes as unknown as string ?? 'PDF')),
      }))
    }
    return DOC_SLOTS[comboKey] ?? DOC_SLOTS['pickup-lcl']
  }

  // Single-slot: uses top-level state.documentFiles + ADD_DOCUMENT/REMOVE_DOCUMENT
  const [dragging,   setDragging]  = useState(false)
  const [uploading,  setUploading] = useState<Record<string, boolean>>({})
  const generalInputRef = useRef<HTMLInputElement>(null)
  const slotInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const uploadFileSingle = async (file: File, docType: string) => {
    const date = todaySydney()
    const path = `${date}/${docType}/${file.name}`
    setUploading(u => ({ ...u, [docType]: true }))
    try {
      const { error } = await supabase.storage.from('booking-documents').upload(path, file, { upsert: true, contentType: file.type || undefined })
      if (error) throw error
      dispatch({ type: 'ADD_DOCUMENT', doc: { name: file.name, size: file.size, docType, storagePath: path } })
    } catch { toast('Upload failed. Please try again.', 'error') }
    finally { setUploading(u => ({ ...u, [docType]: false })) }
  }

  // ── Multi-slot: render one DocSection per slot ────────────────────────────────
  if (multi) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={documentsImg} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>Documents</h2>
            <p style={{ fontSize: 14, color: '#4F4F4F', lineHeight: 1.5, margin: '4px 0 0' }}>Upload the required documents for each booking slot.</p>
          </div>
        </div>
        {state.slotConfigs.map(cfg => (
          <div key={cfg.index} style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
              Slot {cfg.index} — {cfg.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} · {(cfg.loadType ?? '').toUpperCase()}
            </p>
            <SlotDocSection
              slotIndex={cfg.index}
              docFiles={cfg.documentFiles}
              docSlots={resolveDocSlots(cfg.serviceType ?? 'pickup', cfg.loadType ?? 'lcl')}
              onAdd={(doc) => {
                const existing = cfg.documentFiles ?? []
                const updated = existing.find(d => d.name === doc.name) ? existing : [...existing, doc]
                dispatch({ type: 'SET_SLOT_DETAIL', slotIndex: cfg.index, field: 'documentFiles', value: updated })
              }}
              onRemove={(name) => {
                const existing = cfg.documentFiles ?? []
                dispatch({ type: 'SET_SLOT_DETAIL', slotIndex: cfg.index, field: 'documentFiles', value: existing.filter(d => d.name !== name) })
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  // ── Single-slot UI (unchanged) ────────────────────────────────────────────────
  const serviceType = state.slotConfigs?.[0]?.serviceType ?? state.serviceType ?? 'pickup'
  const loadType    = state.slotConfigs?.[0]?.loadType    ?? state.loadType    ?? 'lcl'
  const slots       = resolveDocSlots(serviceType, loadType)

  const filesForSlot = (docType: string) => state.documentFiles.filter(d => d.docType === docType)
  const hasSlot      = (docType: string) => filesForSlot(docType).length > 0
  const missingRequired = slots.filter(s => s.required && !hasSlot(s.docType))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src={documentsImg} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>Documents</h2>
          <p style={{ fontSize: 14, color: '#4F4F4F', lineHeight: 1.5, margin: '4px 0 0' }}>Upload the required documents for your booking. Required documents must be uploaded before you can continue.</p>
        </div>
      </div>

      {/* ── Per-combination document slots ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {slots.map(slot => {
          const uploaded    = filesForSlot(slot.docType)
          const isMissing   = slot.required && uploaded.length === 0
          const isUploaded  = uploaded.length > 0

          return (
            <div key={slot.docType} style={{ background: '#fff', border: `1.5px solid ${isMissing ? '#EF4444' : isUploaded ? 'rgba(34,197,94,0.35)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 16, padding: '14px 16px', transition: 'border-color 0.15s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isUploaded ? 'rgba(34,197,94,0.14)' : 'rgba(0,0,0,0.05)', color: isUploaded ? '#22C55E' : '#A8A29E', transition: 'all 0.15s' }}>
                    <Icon name={ICONS.check} size={12} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1917' }}>{slot.label}</span>
                  {slot.required
                    ? <span style={{ fontSize: 11, fontWeight: 600, color: isMissing ? '#EF4444' : '#78716C', background: isMissing ? 'rgba(239,68,68,0.08)' : 'transparent', padding: isMissing ? '2px 6px' : 0, borderRadius: 4 }}>Required</span>
                    : <span style={{ fontSize: 11, color: '#A8A29E' }}>Optional</span>
                  }
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#78716C', background: '#F7F6F5', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 8, flexShrink: 0, transition: 'all 0.12s ease', cursor: uploading[slot.docType] ? 'not-allowed' : 'pointer', opacity: uploading[slot.docType] ? 0.6 : 1 }}
                  onClick={uploading[slot.docType] ? e => e.preventDefault() : undefined}
                  onMouseOver={e => { if (!uploading[slot.docType]) { e.currentTarget.style.background = '#EBEBEA'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)' } }}
                  onMouseOut={e  => { e.currentTarget.style.background = '#F7F6F5'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)' }}>
                  <Icon name={ICONS.upload} size={13} />
                  {uploading[slot.docType] ? 'Uploading…' : isUploaded ? 'Replace' : 'Upload'}
                  <input type="file" multiple accept={slot.acceptAttr ?? '.pdf,.jpg,.jpeg,.png'} style={{ display: 'none' }} disabled={uploading[slot.docType]}
                    ref={el => { slotInputRefs.current[slot.docType] = el }}
                    onChange={e => { if (!e.target.files) return; Array.from(e.target.files).forEach(f => uploadFileSingle(f, slot.docType)) }} />
                </label>
              </div>
              {uploaded.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {uploaded.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Icon name={ICONS.document} size={14} style={{ color: '#78716C', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                        {doc.size > 0 && <span style={{ fontSize: 11, color: '#A8A29E', flexShrink: 0 }}>{(doc.size / 1024).toFixed(0)} KB</span>}
                      </div>
                      <button type="button" onClick={() => dispatch({ type: 'REMOVE_DOCUMENT', name: doc.name })}
                        style={{ marginLeft: 8, flexShrink: 0, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                        onMouseOver={e => (e.currentTarget.style.color = '#DC2626')} onMouseOut={e => (e.currentTarget.style.color = '#EF4444')}>
                        <Icon name={ICONS.trash} size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isMissing && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 8 }}>This document is required before you can continue.</p>}
            </div>
          )
        })}
      </div>

      {/* ── General drag-and-drop zone ── */}
      <div style={{ border: `2px dashed ${dragging ? 'var(--brand-color)' : '#e5e7eb'}`, borderRadius: 12, background: dragging ? 'rgba(var(--brand-rgb),0.03)' : '#fafafa', padding: '32px 24px', textAlign: 'center', transition: 'border-color 0.15s ease,background 0.15s ease', cursor: 'pointer' }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); Array.from(e.dataTransfer.files).forEach(f => uploadFileSingle(f, 'general')) }}
        onClick={() => generalInputRef.current?.click()}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Icon name={ICONS.upload} size={22} style={{ color: '#78716C' }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', marginBottom: 3 }}>Add additional documents</p>
        <p style={{ fontSize: 12, color: '#78716C', marginBottom: 14 }}>Drag &amp; drop or click to browse — PDF, JPG, PNG, max 10 MB</p>
        <label className="btn-ghost" style={{ padding: '8px 16px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          <Icon name={ICONS.upload} size={13} />Browse files
          <input ref={generalInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFileSingle(f, 'general')) }} />
        </label>
      </div>

      {state.documentFiles.filter(d => !d.docType).length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#78716C', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 4 }}>Additional uploaded files</p>
          {state.documentFiles.filter(d => !d.docType).map((doc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Icon name={ICONS.document} size={18} style={{ color: '#78716C', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                  <p style={{ fontSize: 11, color: '#78716C' }}>{doc.size ? (doc.size / 1024).toFixed(0) + ' KB' : ''}</p>
                </div>
              </div>
              <button type="button" onClick={() => dispatch({ type: 'REMOVE_DOCUMENT', name: doc.name })}
                style={{ marginLeft: 12, flexShrink: 0, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                onMouseOver={e => (e.currentTarget.style.color = '#DC2626')} onMouseOut={e => (e.currentTarget.style.color = '#EF4444')}>
                <Icon name={ICONS.trash} size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {false && missingRequired.length > 0 && (
        <div style={{ marginTop: 16, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#DC2626' }}>
          Please upload the following required documents before continuing: {missingRequired.map(d => d.label).join(', ')}.
        </div>
      )}
    </div>
  )
}

// ─── Per-slot document section for multi-slot mode ───────────────────────────

function SlotDocSection({ slotIndex, docFiles, docSlots, onAdd, onRemove }: {
  slotIndex:  number
  docFiles:   DocumentFile[]
  docSlots:   DocSlot[]
  onAdd:      (doc: DocumentFile) => void
  onRemove:   (name: string) => void
}) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  const uploadFile = async (file: File, docType: string) => {
    const date = todaySydney()
    const path = `slot${slotIndex}/${date}/${docType}/${file.name}`
    setUploading(u => ({ ...u, [docType]: true }))
    try {
      const { error } = await supabase.storage.from('booking-documents').upload(path, file, { upsert: true, contentType: file.type || undefined })
      if (error) throw error
      onAdd({ name: file.name, size: file.size, docType, storagePath: path })
    } catch { toast('Upload failed. Please try again.', 'error') }
    finally { setUploading(u => ({ ...u, [docType]: false })) }
  }

  const safeDocFiles = docFiles ?? []
  const filesFor = (docType: string) => safeDocFiles.filter(d => d.docType === docType)
  const missingRequired = docSlots.filter(s => s.required && filesFor(s.docType).length === 0)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {docSlots.map(slot => {
          const uploaded   = filesFor(slot.docType)
          const isMissing  = slot.required && uploaded.length === 0
          const isUploaded = uploaded.length > 0
          return (
            <div key={slot.docType} style={{ background: '#fff', border: `1.5px solid ${isMissing ? '#EF4444' : isUploaded ? 'rgba(34,197,94,0.35)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 16, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isUploaded ? 'rgba(34,197,94,0.14)' : 'rgba(0,0,0,0.05)', color: isUploaded ? '#22C55E' : '#A8A29E' }}>
                    <Icon name={ICONS.check} size={11} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1917' }}>{slot.label}</span>
                  {slot.required ? <span style={{ fontSize: 11, fontWeight: 600, color: isMissing ? '#EF4444' : '#78716C' }}>Required</span> : <span style={{ fontSize: 11, color: '#A8A29E' }}>Optional</span>}
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#78716C', background: '#F7F6F5', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 8, cursor: uploading[slot.docType] ? 'not-allowed' : 'pointer', opacity: uploading[slot.docType] ? 0.6 : 1 }}>
                  <Icon name={ICONS.upload} size={12} />
                  {uploading[slot.docType] ? 'Uploading…' : isUploaded ? 'Replace' : 'Upload'}
                  <input type="file" multiple accept={slot.acceptAttr ?? '.pdf,.jpg,.jpeg,.png'} style={{ display: 'none' }} disabled={uploading[slot.docType]}
                    onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadFile(f, slot.docType)) }} />
                </label>
              </div>
              {uploaded.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {uploaded.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <Icon name={ICONS.document} size={13} style={{ color: '#78716C', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                        {doc.size > 0 && <span style={{ fontSize: 11, color: '#A8A29E', flexShrink: 0 }}>{(doc.size / 1024).toFixed(0)} KB</span>}
                      </div>
                      <button type="button" onClick={() => onRemove(doc.name)}
                        style={{ marginLeft: 8, flexShrink: 0, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4 }}>
                        <Icon name={ICONS.trash} size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isMissing && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 6 }}>This document is required before you can continue.</p>}
            </div>
          )
        })}
      </div>
      {false && missingRequired.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#DC2626' }}>
          Missing: {missingRequired.map(d => d.label).join(', ')}.
        </div>
      )}
    </div>
  )
}
