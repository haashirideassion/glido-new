import { createBrowserRouter } from 'react-router-dom'
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
import VisitorLogPage      from './pages/reception/VisitorLogPage'
import ReportsConfigPage   from './pages/reception/ReportsConfigPage'
import SettingsPage        from './pages/reception/SettingsPage'
import BookingDetailPage   from './pages/reception/BookingDetailPage'
import VisitorDetailPage  from './pages/reception/VisitorDetailPage'
import NewBookingPage  from './pages/reception/NewBookingPage'
import ProfilePage     from './pages/ProfilePage'
import KioskPage       from './pages/KioskPage'
import ModulesPage     from './pages/ModulesPage'
import NotFound        from './pages/NotFound'
import ReceptionGuard  from './components/ReceptionGuard'

export const router = createBrowserRouter([
  {
    /* Public — shared nav + footer */
    element: <PublicLayout />,
    children: [
      { path: '/',              element: <LandingPage /> },
      { path: '/login',         element: <StaffLoginPage /> },
      { path: '/visitor-login', element: <VisitorLoginPage /> },
      { path: '/bookings',      element: <MyBookingsPage /> },
      { path: '/book',          element: <BookPage /> },
      { path: '/modules',       element: <ModulesPage /> },
      { path: '/profile',       element: <ProfilePage /> },
    ],
  },
  {
    /* Reception — guarded */
    path: '/reception',
    element: <ReceptionGuard />,
    children: [
      {
        element: <ReceptionLayout />,
        children: [
          { index: true,                                   element: <DashboardPage /> },
          { path: 'bookings',                              element: <BookingsPage /> },
          { path: 'bookings/new',                          element: <NewBookingPage /> },
          { path: 'bookings/:id',                          element: <BookingDetailPage /> },
          { path: 'bookings/group/:groupRef',              element: <BookingDetailPage /> },
          { path: 'visitors',                              element: <WalkInsPage /> },
          { path: 'visitors/:id',                          element: <VisitorDetailPage /> },
          { path: 'reports',                               element: <ReportsPage /> },
          { path: 'reports/visitor-log',                   element: <VisitorLogPage /> },
          { path: 'reports/configure',                     element: <ReportsConfigPage /> },
          { path: 'reports/activity',                      element: <ReportsPage /> },
          { path: 'settings',                              element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    /* Kiosk — fullscreen standalone */
    path: '/kiosk',
    element: <KioskPage />,
  },
  {
    /* 404 catch-all */
    path: '*',
    element: <NotFound />,
  },
])
