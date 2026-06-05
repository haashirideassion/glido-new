/**
 * Alpine.js store registration.
 *
 * LOAD ORDER — this file MUST be loaded as a plain synchronous <script>
 * (no defer, no async) BEFORE the Alpine CDN <script defer> tag.
 * This guarantees our 'alpine:init' listener is registered before Alpine
 * fires the event during its own deferred execution.
 */

document.addEventListener('alpine:init', function () {
  window.Alpine.store('wizard', wizardStore())
  window.Alpine.store('kiosk', kioskStore())
})

/* ── Global keyboard navigation — Enter advances the wizard ── */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return
  var tag = document.activeElement ? document.activeElement.tagName : ''
  if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return
  /* only fire if wizard is on-page and active */
  if (!window.Alpine) return
  var store = window.Alpine.store('wizard')
  if (!store) return
  if (store.currentStep >= 8) return
  if (store.canProceed) store.nextStep()
})

function wizardStore() {
  return {
    currentStep: 1,
    totalSteps: 7,
    stepDirection: 1,  /* 1 = forward, -1 = backward */

    // Step 1
    slotCount: 1,
    guestName: '',
    guestPhone: '',
    guestEmail: '',

    // Step 2
    serviceType: null,   // 'pickup' | 'dropoff'

    // Step 3
    loadType: null,      // 'fcl' | 'lcl'

    // Step 4 — date/slot selection
    selectedDate: null,
    selectedSlotId: null,
    selectedSlotLabel: null,
    slots: [],
    slotsLoading: false,

    // Hold timer
    holdSecondsRemaining: 600,
    holdTimerInterval: null,

    // Step 5 — shipment details (fields vary by combo)
    houseBillNumber: '',
    containerNumber: '',
    // auto-populated (mock)
    shipmentData: null,   // { weightKg, volumeCbm, packageCount, palletCount, palletType, storageStartDate, storageCharge, shrinkWrapCharge, icsStatus }
    shipmentFetched: false,
    shipmentFetching: false,
    // drop-off fields
    cargoDescription: '',
    estimatedWeightKg: '',
    estimatedVolumeCbm: '',
    destinationPort: '',
    // always required
    driverName: '',
    driverPhone: '',

    // Step 6
    documents: [],

    // Step 7
    paymentMethod: 'card',   // 'card' | 'eft'
    eftConfirmed: false,
    termsAccepted: false,
    confirmationRef: null,
    submitError: null,
    isSubmitting: false,
    // Tenant EFT bank details (loaded from /api/tenants/config)
    eftBankName: 'Commonwealth Bank',
    eftBsb: '062-000',
    eftAccountNumber: '12345678',
    eftAccountName: 'Sydney CFS Pty Ltd',

    /* ── Session persistence ──────────────────────────────────────── */

    init() {
      this._load()
      var self = this
      // Auto-save to sessionStorage on every reactive change
      window.Alpine.effect(function () { self._save() })
    },

    _save() {
      try {
        var holdExpires = (this.holdTimerInterval !== null && this.holdSecondsRemaining > 0)
          ? Date.now() + (this.holdSecondsRemaining * 1000)
          : null
        sessionStorage.setItem('glido-wizard', JSON.stringify({
          v:                  1,
          currentStep:        this.currentStep,
          slotCount:          this.slotCount,
          guestName:          this.guestName,
          guestPhone:         this.guestPhone,
          guestEmail:         this.guestEmail,
          serviceType:        this.serviceType,
          loadType:           this.loadType,
          selectedDate:       this.selectedDate,
          selectedSlotId:     this.selectedSlotId,
          selectedSlotLabel:  this.selectedSlotLabel,
          houseBillNumber:    this.houseBillNumber,
          containerNumber:    this.containerNumber,
          shipmentData:       this.shipmentData,
          shipmentFetched:    this.shipmentFetched,
          cargoDescription:   this.cargoDescription,
          estimatedWeightKg:  this.estimatedWeightKg,
          estimatedVolumeCbm: this.estimatedVolumeCbm,
          destinationPort:    this.destinationPort,
          driverName:         this.driverName,
          driverPhone:        this.driverPhone,
          paymentMethod:      this.paymentMethod,
          holdExpires:        holdExpires,
        }))
      } catch (e) { /* ignore quota errors */ }
    },

    _load() {
      try {
        var raw = sessionStorage.getItem('glido-wizard')
        if (!raw) return
        var s = JSON.parse(raw)
        if (!s || s.v !== 1) return

        this.currentStep        = s.currentStep        || 1
        this.slotCount          = s.slotCount          || 1
        this.guestName          = s.guestName          || ''
        this.guestPhone         = s.guestPhone         || ''
        this.guestEmail         = s.guestEmail         || ''
        this.serviceType        = s.serviceType        || null
        this.loadType           = s.loadType           || null
        this.selectedDate       = s.selectedDate       || null
        this.selectedSlotId     = s.selectedSlotId     || null
        this.selectedSlotLabel  = s.selectedSlotLabel  || null
        this.houseBillNumber    = s.houseBillNumber    || ''
        this.containerNumber    = s.containerNumber    || ''
        this.shipmentData       = s.shipmentData       || null
        this.shipmentFetched    = s.shipmentFetched    || false
        this.cargoDescription   = s.cargoDescription   || ''
        this.estimatedWeightKg  = s.estimatedWeightKg  || ''
        this.estimatedVolumeCbm = s.estimatedVolumeCbm || ''
        this.destinationPort    = s.destinationPort    || ''
        this.driverName         = s.driverName         || ''
        this.driverPhone        = s.driverPhone        || ''
        this.paymentMethod      = s.paymentMethod      || 'card'

        // Restore hold timer if it was running and hasn't expired
        if (s.holdExpires && this.currentStep > 4) {
          var remaining = Math.floor((s.holdExpires - Date.now()) / 1000)
          if (remaining > 0) {
            this.holdSecondsRemaining = remaining
            this._resumeHoldTimer()
          } else {
            // Hold expired while away — send back to slot selection
            this.currentStep = 4
            this.selectedSlotId = null
            this.selectedSlotLabel = null
            this.holdSecondsRemaining = 600
          }
        }

        // Re-fetch slot list if restored to step 4 with a date
        if (this.currentStep === 4 && this.selectedDate) {
          this.fetchSlots(this.selectedDate)
        }
      } catch (e) { /* ignore parse errors */ }
    },

    _clear() {
      sessionStorage.removeItem('glido-wizard')
    },

    _resumeHoldTimer() {
      clearInterval(this.holdTimerInterval)
      var self = this
      this.holdTimerInterval = setInterval(function () {
        self.holdSecondsRemaining--
        if (self.holdSecondsRemaining <= 0) {
          clearInterval(self.holdTimerInterval)
          self.holdTimerInterval = null
          self.selectedSlotId = null
          self.selectedSlotLabel = null
          self.currentStep = 4
          alert('Your slot hold has expired. Please select a new time slot.')
        }
      }, 1000)
    },

    get holdMinutes() {
      return String(Math.floor(this.holdSecondsRemaining / 60)).padStart(2, '0')
    },
    get holdSeconds() {
      return String(this.holdSecondsRemaining % 60).padStart(2, '0')
    },
    get holdExpiring() {
      return this.holdSecondsRemaining <= 120
    },
    get holdActive() {
      return this.holdSecondsRemaining < 600 && this.holdTimerInterval !== null
    },
    get isPickupLcl() { return this.serviceType === 'pickup' && this.loadType === 'lcl' },
    get isPickupFcl() { return this.serviceType === 'pickup' && this.loadType === 'fcl' },
    get isDropoffLcl() { return this.serviceType === 'dropoff' && this.loadType === 'lcl' },
    get isDropoffFcl() { return this.serviceType === 'dropoff' && this.loadType === 'fcl' },
    get showChepWarning() {
      return this.shipmentData && this.shipmentData.palletType === 'chep'
    },
    get showIcsHeld() {
      return this.shipmentData && this.shipmentData.icsStatus === 'held'
    },
    get storageChargeFormatted() {
      if (!this.shipmentData) return '$0.00'
      return '$' + (this.shipmentData.storageCharge || 0).toFixed(2)
    },
    get shrinkWrapFormatted() {
      if (!this.shipmentData) return '$0.00'
      return '$' + (this.shipmentData.shrinkWrapCharge || 0).toFixed(2)
    },
    get totalCharges() {
      if (!this.shipmentData) return 5.00
      return (this.shipmentData.storageCharge || 0) + (this.shipmentData.shrinkWrapCharge || 0) + 5.00
    },
    get totalWithGst() {
      return (this.totalCharges * 1.10).toFixed(2)
    },

    get canProceed() {
      switch (this.currentStep) {
        case 1: return this.slotCount >= 1 && this.guestName.trim().length >= 2
        case 2: return this.serviceType !== null
        case 3: return this.loadType !== null
        case 4: return this.selectedSlotId !== null
        case 5:
          if (this.serviceType === 'pickup') {
            if (this.loadType === 'lcl') return this.houseBillNumber.trim().length >= 6 && this.containerNumber.trim().length >= 4 && this.driverName.trim().length >= 2
            if (this.loadType === 'fcl') return this.containerNumber.trim().length >= 4 && this.driverName.trim().length >= 2
          }
          if (this.serviceType === 'dropoff') {
            return this.cargoDescription.trim().length >= 2 && this.driverName.trim().length >= 2
          }
          return false
        case 6: return true  // documents optional for some combos
        default: return false
      }
    },

    nextStep() {
      if (!this.canProceed && this.currentStep < 7) return
      if (this.currentStep === 4 && this.selectedSlotId) {
        this.startHoldTimer()
      }
      // Reset shipment lookup state when entering step 5 so cards
      // never appear before the user clicks Look Up
      if (this.currentStep === 4) {
        this.shipmentFetched = false
        this.shipmentData = null
        this.shipmentFetching = false
      }
      this.stepDirection = 1
      this.currentStep++
    },

    prevStep() {
      if (this.currentStep <= 1) return
      this.stepDirection = -1
      // Reset shipment lookup state when going back to step 5 from step 6
      if (this.currentStep === 6) {
        this.shipmentFetched = false
        this.shipmentData = null
        this.shipmentFetching = false
      }
      // Reset shipment lookup state when leaving step 5 backwards (step 5 → 4)
      // so that re-entering step 5 always starts clean
      if (this.currentStep === 5) {
        this.shipmentFetched = false
        this.shipmentData = null
        this.shipmentFetching = false
      }
      this.currentStep--
    },

    selectServiceType(type) { this.serviceType = type },
    selectLoadType(type) { this.loadType = type },

    selectSlot(slotId, label) {
      this.selectedSlotId = slotId
      this.selectedSlotLabel = label
    },

    selectDate(date) {
      this.selectedDate = date
      this.selectedSlotId = null
      this.selectedSlotLabel = null
      this.fetchSlots(date)
    },

    fetchSlots(date) {
      if (!date) return
      this.slotsLoading = true
      this.slots = []
      var self = this
      fetch('/api/slots?date=' + date)
        .then(function (r) { return r.json() })
        .then(function (data) {
          self.slotsLoading = false
          self.slots = data.slots || []
        })
        .catch(function () {
          self.slotsLoading = false
          self.slots = []
        })
    },

    startHoldTimer() {
      this.holdSecondsRemaining = 600
      clearInterval(this.holdTimerInterval)
      var self = this
      this.holdTimerInterval = setInterval(function () {
        self.holdSecondsRemaining--
        if (self.holdSecondsRemaining <= 0) {
          clearInterval(self.holdTimerInterval)
          self.holdTimerInterval = null
          self.selectedSlotId = null
          self.selectedSlotLabel = null
          self.currentStep = 4
          alert('Your slot hold has expired. Please select a new time slot.')
        }
      }, 1000)
    },

    // ── Supabase helpers ─────────────────────────────────────────────────────

    _cachedTenant: null,

    async _sbGet(table, qs) {
      var sb  = window.__sb || {}
      var url = 'https://lnknynjqxyfvtjpnaljc.supabase.co/rest/v1/' + table + '?' + qs
      var res = await fetch(url, {
        headers: {
          'apikey':        sb.key || '',
          'Authorization': 'Bearer ' + (sb.key || ''),
        },
      })
      if (!res.ok) throw new Error('sb ' + res.status)
      return res.json()
    },

    async _getTenant() {
      if (this._cachedTenant) return this._cachedTenant
      var rows = await this._sbGet('tenants', 'id=eq.a0000000-0000-0000-0000-000000000001&select=*')
      this._cachedTenant = rows && rows[0] ? rows[0] : null
      return this._cachedTenant
    },

    _calcCharges(row, serviceType, loadType, slotDate, tenant) {
      var t           = tenant || {}
      var gstRate     = t.gst_enabled ? (parseFloat(t.gst_rate) || 0) / 100 : 0
      var storageDays = 0
      var storageCharge = 0
      function r2(n) { return Math.round(n * 100) / 100 }

      if (row && row.storage_start_date && loadType === 'lcl') {
        var diffMs  = new Date(slotDate) - new Date(row.storage_start_date)
        var rawDays = Math.max(0, Math.floor(diffMs / 86400000))
        storageDays = Math.max(0, rawDays - (t.storage_free_days || 0))
        if (storageDays > 0) {
          var billableCbm = Math.max((row.weight_kg || 0) / 1000, row.volume_cbm || 0)
          storageCharge   = r2(billableCbm * (parseFloat(t.storage_rate_per_cbm) || 0) * storageDays)
        }
      }
      var shrinkWrapCharge = 0
      if (loadType === 'lcl' && row && (row.pallet_count || 0) > 0) {
        shrinkWrapCharge = r2((row.pallet_count || 0) * (parseFloat(t.shrink_wrap_rate_per_pallet) || 0))
      }
      var slotFee     = r2(parseFloat(serviceType === 'pickup' ? t.slot_fee_pickup : t.slot_fee_dropoff) || 5)
      var subtotal    = r2(storageCharge + shrinkWrapCharge + slotFee)
      var gstAmount   = r2(subtotal * gstRate)
      var totalAmount = r2(subtotal + gstAmount)
      return { storageCharge: storageCharge, storageDays: storageDays, shrinkWrapCharge: shrinkWrapCharge, slotFee: slotFee, subtotal: subtotal, gstAmount: gstAmount, totalAmount: totalAmount }
    },

    async _doShipmentLookup(hbl, container, serviceType, loadType, slotDate) {
      var row = null
      try {
        var tenant = await this._getTenant()
        var tid    = 'a0000000-0000-0000-0000-000000000001'

        // Try HBL first, fall back to container
        if (hbl) {
          var rows = await this._sbGet('cfs_shipments',
            'tenant_id=eq.' + tid + '&house_bill_number=ilike.' + encodeURIComponent(hbl) + '&select=*')
          row = rows && rows[0] ? rows[0] : null
        }
        if (!row && container) {
          var rows2 = await this._sbGet('cfs_shipments',
            'tenant_id=eq.' + tid + '&container_number=ilike.' + encodeURIComponent(container) + '&select=*')
          row = rows2 && rows2[0] ? rows2[0] : null
        }

        var charges = this._calcCharges(row, serviceType, loadType, slotDate, tenant)

        if (!row) {
          return Object.assign({ found: false, icsStatus: 'unavailable' }, charges)
        }
        return Object.assign({
          found:              true,
          hbl:                row.house_bill_number,
          containerNumber:    row.container_number || null,
          weightKg:           row.weight_kg        || null,
          volumeCbm:          row.volume_cbm       || null,
          packageCount:       row.package_count    || null,
          palletCount:        row.pallet_count     || null,
          palletType:         row.pallet_type      || null,
          storageStartDate:   row.storage_start_date || null,
          readyForCollection: row.ready_for_collection || false,
          icsStatus:          row.ics_status       || 'unavailable',
        }, charges)
      } catch (err) {
        console.error('[shipment lookup] direct Supabase error:', err)
        return { found: false, storageCharge: 0, shrinkWrapCharge: 0, slotFee: 5, subtotal: 5, gstAmount: 0.5, totalAmount: 5.5, icsStatus: 'unavailable' }
      }
    },

    // ── Public lookup methods ─────────────────────────────────────────────────

    fetchShipmentDetails() {
      if (!this.houseBillNumber.trim() && !this.containerNumber.trim()) return
      this.shipmentFetching = true
      this.shipmentFetched  = false
      var self = this
      this._doShipmentLookup(
        self.houseBillNumber.trim(), self.containerNumber.trim(),
        self.serviceType, self.loadType, self.selectedDate
      ).then(function (data) {
        self.shipmentFetching = false
        self.shipmentFetched  = true
        self.shipmentData     = data
      })
    },

    fetchFclDetails() {
      if (!this.containerNumber.trim()) return
      this.shipmentFetching = true
      this.shipmentFetched  = false
      var self = this
      this._doShipmentLookup(
        '', self.containerNumber.trim(),
        self.serviceType, 'fcl', self.selectedDate
      ).then(function (data) {
        self.shipmentFetching = false
        self.shipmentFetched  = true
        self.shipmentData     = data
      })
    },

    async submitBooking() {
      // Guard: slot data must be present before submitting
      if (!this.selectedDate || !this.selectedSlotLabel) {
        this.submitError = 'Please select a time slot before confirming.'
        return
      }
      this.submitError = null
      this.isSubmitting = true
      clearInterval(this.holdTimerInterval)
      this.holdTimerInterval = null

      var sd    = this.shipmentData
      var parts = this.selectedSlotLabel.split(' – ')

      // Generate reference number client-side (same format as server)
      var ref = 'GLD-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 90000) + 10000)

      // Map to Supabase column names (snake_case)
      var row = {
        reference_number:   ref,
        status:             'scheduled',
        service_type:       this.serviceType,
        load_type:          this.loadType,
        slot_date:          this.selectedDate,
        slot_start_time:    parts[0] || '',
        slot_end_time:      parts[1] || '',
        driver_name:        this.driverName  || 'Guest',
        driver_phone:       this.driverPhone || null,
        guest_name:         this.guestName   || null,
        guest_phone:        this.guestPhone  || null,
        house_bill_number:  this.houseBillNumber  || null,
        container_number:   this.containerNumber  || null,
        weight_kg:          sd ? (sd.weightKg          || null) : null,
        volume_cbm:         sd ? (sd.volumeCbm         || null) : null,
        package_count:      sd ? (sd.packageCount      || null) : null,
        pallet_count:       sd ? (sd.palletCount       || null) : null,
        pallet_type:        sd ? (sd.palletType        || null) : null,
        storage_start_date: sd ? (sd.storageStartDate  || null) : null,
        storage_days:       sd ? (sd.storageDays       || null) : null,
        storage_charge:     sd ? (sd.storageCharge     || null) : null,
        shrink_wrap_charge: sd ? (sd.shrinkWrapCharge  || null) : null,
        slot_fee:           sd ? (sd.slotFee           || null) : null,
        subtotal:           sd ? (sd.subtotal          || null) : null,
        gst_amount:         sd ? (sd.gstAmount         || null) : null,
        total_amount:       sd ? (sd.totalAmount       || null) : null,
        payment_method:     this.paymentMethod || 'card',
        payment_status:     this.paymentMethod === 'eft' ? 'pending_eft' : 'pending',
        tenant_id:          'a0000000-0000-0000-0000-000000000001',
        user_id:            null,
      }

      try {
        // POST directly to Supabase REST — bypasses the Vercel serverless function entirely
        var sb  = window.__sb || {}
        var url = 'https://lnknynjqxyfvtjpnaljc.supabase.co/rest/v1/bookings'
        var key = sb.key || ''

        var res = await fetch(url, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        key,
            'Authorization': 'Bearer ' + key,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify(row),
        })

        console.log('[submitBooking] Supabase status:', res.status)

        if (!res.ok) {
          var errText = await res.text().catch(function() { return '' })
          console.error('[submitBooking] Supabase error:', res.status, errText)
          this.submitError = 'Booking failed (' + res.status + '). Please try again.'
          return
        }

        this._clear()
        window.location.href = '/booking-confirmed/' + ref
      } catch (err) {
        console.error('[submitBooking] fetch threw:', err)
        this.submitError = (err && err.message) ? err.message : 'Something went wrong. Please try again.'
      } finally {
        this.isSubmitting = false
      }
    },

    reset() {
      clearInterval(this.holdTimerInterval)
      this._clear()
      this.currentStep = 1
      this.slotCount = 1
      this.guestName = ''
      this.guestPhone = ''
      this.guestEmail = ''
      this.serviceType = null
      this.loadType = null
      this.selectedDate = null
      this.selectedSlotId = null
      this.selectedSlotLabel = null
      this.slots = []
      this.slotsLoading = false
      this.holdSecondsRemaining = 600
      this.holdTimerInterval = null
      this.houseBillNumber = ''
      this.containerNumber = ''
      this.shipmentData = null
      this.shipmentFetched = false
      this.shipmentFetching = false
      this.cargoDescription = ''
      this.estimatedWeightKg = ''
      this.estimatedVolumeCbm = ''
      this.destinationPort = ''
      this.driverName = ''
      this.driverPhone = ''
      this.documents = []
      this.paymentMethod = 'card'
      this.eftConfirmed = false
      this.termsAccepted = false
      this.confirmationRef = null
      this.submitError = null
      this.isSubmitting = false
    },
  }
}

function kioskStore() {
  return {
    // ── Screen state ──────────────────────────────────────────────────────────
    // Valid screens: 'welcome' | 'lookup' | 'scan' | 'confirm' | 'consent' |
    //               'idscan' | 'arrived' | 'purpose' | 'walkin' | 'screensaver'
    currentScreen: 'welcome',
    idleSeconds: 0,
    idleInterval: null,

    // ── Booking flow ──────────────────────────────────────────────────────────
    referenceInput: '',
    lookupResult:   null,
    lookupError:    false,

    // ── ID scan ───────────────────────────────────────────────────────────────
    licenceData:    null,
    licenceExpired: false,

    // ── Arrived screen countdown ──────────────────────────────────────────────
    arrivedCountdown: 0,
    arrivedTimer:     null,
    arrivedVisitorName: '',

    // ── Walk-in form fields ───────────────────────────────────────────────────
    walkInPurpose:       null,
    walkInName:          '',
    walkInPhone:         '',
    walkInVehicle:       '',
    walkInBLRef:         '',
    walkInPersonVisited: '',
    walkInReason:        '',

    // ─────────────────────────────────────────────────────────────────────────
    init() {
      var self = this
      function resetIdle() { self.idleSeconds = 0 }
      document.addEventListener('mousemove', resetIdle)
      document.addEventListener('touchstart', resetIdle)
      document.addEventListener('keydown', resetIdle)
      document.addEventListener('click', resetIdle)

      self.idleInterval = setInterval(function () {
        // Don't trigger screensaver while on welcome, screensaver, or arrived screens
        if (['welcome', 'screensaver', 'arrived'].includes(self.currentScreen)) return
        self.idleSeconds++
        if (self.idleSeconds >= 60) {
          self.goTo('screensaver')
          self.idleSeconds = 0
        }
      }, 1000)
    },

    goTo(screen) {
      this.currentScreen = screen
      this.idleSeconds   = 0
    },

    wakeFromScreensaver() {
      if (this.currentScreen === 'screensaver') {
        this._resetFlow()
        this.goTo('welcome')
      }
    },

    _resetFlow() {
      this.referenceInput      = ''
      this.lookupResult        = null
      this.lookupError         = false
      this.licenceData         = null
      this.licenceExpired      = false
      this.arrivedVisitorName  = ''
      this.walkInPurpose       = null
      this.walkInName          = ''
      this.walkInPhone         = ''
      this.walkInVehicle       = ''
      this.walkInBLRef         = ''
      this.walkInPersonVisited = ''
      this.walkInReason        = ''
      if (this.arrivedTimer) {
        clearInterval(this.arrivedTimer)
        this.arrivedTimer    = null
        this.arrivedCountdown = 0
      }
    },

    // ── Booking flow ──────────────────────────────────────────────────────────
    startBookingLookup() {
      this._resetFlow()
      this.goTo('lookup')
    },

    startVisitingFlow() {
      this._resetFlow()
      this.goTo('purpose')
    },

    performLookup() {
      if (!this.referenceInput.trim()) return
      var self = this
      var ref  = this.referenceInput.trim().toUpperCase()
      self.lookupError = false
      fetch('/kiosk/lookup/' + encodeURIComponent(ref))
        .then(function (r) { return r.json() })
        .then(function (data) {
          if (data.found) {
            self.lookupResult = data
            self.lookupError  = false
            self.goTo('confirm')   // show booking summary first
          } else {
            self.lookupError  = true
            self.lookupResult = null
          }
        })
        .catch(function () {
          self.lookupError  = true
          self.lookupResult = null
        })
    },

    // User confirmed it's their booking → show data consent notice
    confirmBooking() { this.goTo('consent') },

    // User accepted consent → show ID scan
    acceptConsent() { this.goTo('idscan') },

    // ── Fuzzy name match — Jaro-Winkler ──────────────────────────────────────
    _jaroWinkler(s1, s2) {
      if (!s1 || !s2) return 0
      s1 = s1.toLowerCase().trim()
      s2 = s2.toLowerCase().trim()
      if (s1 === s2) return 1
      var len1 = s1.length, len2 = s2.length
      var matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)
      var s1m = new Array(len1).fill(false)
      var s2m = new Array(len2).fill(false)
      var matches = 0, transpositions = 0
      for (var i = 0; i < len1; i++) {
        var start = Math.max(0, i - matchDist)
        var end   = Math.min(i + matchDist + 1, len2)
        for (var j = start; j < end; j++) {
          if (s2m[j] || s1[i] !== s2[j]) continue
          s1m[i] = s2m[j] = true
          matches++
          break
        }
      }
      if (!matches) return 0
      var k = 0
      for (var i = 0; i < len1; i++) {
        if (!s1m[i]) continue
        while (!s2m[k]) k++
        if (s1[i] !== s2[k]) transpositions++
        k++
      }
      var jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
      var prefix = 0
      for (var i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
        if (s1[i] !== s2[i]) break
        prefix++
      }
      return jaro + prefix * 0.1 * (1 - jaro)
    },

    _parseExpiryDate(str) {
      // Accepts DD/MM/YYYY
      if (!str) return null
      var parts = str.split('/')
      if (parts.length !== 3) return null
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
    },

    // ── ID scan ───────────────────────────────────────────────────────────────
    simulateScan() {
      var scannedName  = 'Carlos Mendez'
      var bookingName  = this.lookupResult ? (this.lookupResult.driverName || '') : ''
      var score        = this._jaroWinkler(scannedName, bookingName)
      var matchResult  = score >= 0.85 ? 'matched' : (score >= 0.60 ? 'warning' : 'mismatch')
      var expiryStr    = '12/06/2028'
      var expiryDate   = this._parseExpiryDate(expiryStr)
      var expired      = expiryDate ? expiryDate < new Date() : false

      this.licenceExpired = expired
      this.licenceData = {
        name:            scannedName,
        licenceNo:       'NSW8832145',
        dob:             '12/06/1983',
        expiry:          expiryStr,
        address:         '18 Harbour St, Sydney NSW 2000',
        nameMatchResult: matchResult,
        nameMatchScore:  Math.round(score * 100),
      }
    },

    // ── Countdown helper ──────────────────────────────────────────────────────
    _startArrivedCountdown() {
      var self = this
      if (self.arrivedTimer) clearInterval(self.arrivedTimer)
      self.arrivedCountdown = 5
      self.arrivedTimer = setInterval(function () {
        self.arrivedCountdown--
        if (self.arrivedCountdown <= 0) {
          clearInterval(self.arrivedTimer)
          self.arrivedTimer = null
          self._resetFlow()
          self.goTo('welcome')
        }
      }, 1000)
    },

    // ── Complete booking check-in ─────────────────────────────────────────────
    completeCheckIn() {
      var self         = this
      var bookingId    = self.lookupResult ? self.lookupResult.bookingId : null
      var ld           = self.licenceData || {}

      self.arrivedVisitorName = ld.name || (self.lookupResult ? self.lookupResult.name : '') || 'Visitor'

      if (bookingId) {
        fetch('/kiosk/checkin', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId:       bookingId,
            licenceName:     ld.name            || '',
            licenceNumber:   ld.licenceNo       || '',
            licenceDob:      ld.dob             || '',
            licenceExpiry:   ld.expiry          || '',
            licenceAddress:  ld.address         || '',
            nameMatchResult: ld.nameMatchResult || 'not_checked',
            nameMatchScore:  ld.nameMatchScore  || 0,
            expiryValid:     !self.licenceExpired,
          }),
        }).catch(function (err) { console.warn('[kiosk] check-in POST failed:', err) })
      }

      self.goTo('arrived')
      self._startArrivedCountdown()
    },

    // ── Submit walk-in ────────────────────────────────────────────────────────
    submitWalkIn() {
      var self = this
      if (!self.walkInName.trim()) return   // guard: name required

      self.arrivedVisitorName = self.walkInName.trim()

      fetch('/kiosk/walk-in', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose:            self.walkInPurpose       || 'visit_person',
          visitorName:        self.walkInName.trim()   || 'Kiosk Walk-In',
          contactNumber:      self.walkInPhone.trim()  || null,
          vehicleReg:         self.walkInVehicle.trim() || null,
          blRef:              self.walkInBLRef.trim()  || null,
          personBeingVisited: self.walkInPersonVisited.trim() || null,
          reason:             self.walkInReason.trim() || null,
        }),
      }).catch(function (err) { console.warn('[kiosk] walk-in POST failed:', err) })

      self.goTo('arrived')
      self._startArrivedCountdown()
    },
  }
}
