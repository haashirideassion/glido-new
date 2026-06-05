import { useState, useEffect } from 'react'
import { getTenant } from '@/lib/db/tenants'
import { DEFAULT_TENANT_ID } from '@/lib/supabase'

export interface TenantInfo {
  name:               string
  eftBankName:        string
  eftAccountName:     string
  eftBsb:             string
  eftAccountNumber:   string
  logoUrl:            string | null
  primaryColor:       string | null
  compayClientNumber: string | null
}

const FALLBACK: TenantInfo = {
  name:               '',
  eftBankName:        '',
  eftAccountName:     '',
  eftBsb:             '',
  eftAccountNumber:   '',
  logoUrl:            null,
  primaryColor:       null,
  compayClientNumber: null,
}

/**
 * Fetches and caches basic tenant display info.
 * Returns null while loading so callers can hide/skeleton appropriately.
 */
export function useTenantInfo(): TenantInfo | null {
  const [info, setInfo] = useState<TenantInfo | null>(null)

  useEffect(() => {
    getTenant(DEFAULT_TENANT_ID)
      .then(t => {
        if (!t) return
        setInfo({
          name:             t.name               ?? '',
          eftBankName:      t.eft_bank_name      ?? '',
          eftAccountName:   t.eft_account_name   ?? '',
          eftBsb:           t.eft_bsb            ?? '',
          eftAccountNumber: t.eft_account_number ?? '',
          logoUrl:            t.logo_url                        ?? null,
          primaryColor:       t.primary_color                   ?? null,
          compayClientNumber: (t as any).compay_client_number   ?? null,
        })
      })
      .catch(() => setInfo(FALLBACK))
  }, [])

  return info
}
