import { Routes, Route } from 'react-router-dom'
import PublicLayout    from './layouts/PublicLayout'
import ReceptionLayout from './layouts/ReceptionLayout'
import LandingPage     from './pages/LandingPage'
import BookPage         from './pages/BookPage'
import MyBookingsPage    from './pages/MyBookingsPage'
import VisitorLoginPage  from './pages/VisitorLoginPage'
import StaffLoginPage    from './pages/StaffLoginPage'
import DashboardPage   from './pages/reception/DashboardPage'
import BookingsPage    from './pages/reception/BookingsPage'
import WalkInsPage     from './pages/reception/WalkInsPage'
import ReportsPage      from './pages/reception/ReportsPage'
import VisitorLogPage  from './pages/reception/VisitorLogPage'
import SettingsPage         from './pages/reception/SettingsPage'
import BookingDetailPage   from './pages/reception/BookingDetailPage'
import KioskPage       from './pages/KioskPage'
import NotFound        from './pages/NotFound'
import ReceptionGuard  from './components/ReceptionGuard'

const Placeholder = ({ name }: { name: string }) => (
  <div className="flex items-center justify-center min-h-[60vh] text-stone-500 text-sm">{name} (coming soon)</div>
)

export default function App() {
  return (
    <Routes>
      {/* Public — shared nav + footer */}
      <Route element={<PublicLayout />}>
        <Route path="/"              element={<LandingPage />} />
        <Route path="/login"         element={<StaffLoginPage />} />
        <Route path="/visitor-login" element={<VisitorLoginPage />} />
        <Route path="/bookings"      element={<MyBookingsPage />} />
        {/* /book sits inside PublicLayout for the nav bar; wizard CSS hides the footer */}
        <Route path="/book"          element={<BookPage />} />
      </Route>

      {/* Reception — guarded: must be reception_staff or reception_admin */}
      <Route path="/reception" element={<ReceptionGuard />}>
      <Route element={<ReceptionLayout />}>
        <Route index              element={<DashboardPage />} />
        <Route path="bookings"   element={<BookingsPage />} />
        <Route path="bookings/new" element={<Placeholder name="New Booking" />} />
        <Route path="bookings/:id" element={<BookingDetailPage />} />
        <Route path="bookings/group/:groupRef" element={<BookingDetailPage />} />
        <Route path="visitors"   element={<WalkInsPage />} />
        <Route path="reports"                  element={<ReportsPage />} />
        <Route path="reports/visitor-log"    element={<VisitorLogPage />} />
        <Route path="reports/activity"       element={<ReportsPage />} />
        <Route path="settings"   element={<SettingsPage />} />
      </Route>
      </Route>

      {/* Kiosk — fullscreen standalone, no nav/footer */}
      <Route path="/kiosk" element={<KioskPage />} />

      {/* 404 — catch-all, must be last */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
