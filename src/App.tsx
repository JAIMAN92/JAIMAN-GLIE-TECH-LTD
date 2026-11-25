import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { SiteProvider } from './context/SiteContext.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { CbtPage } from './pages/CbtPage.tsx';
import { CbtPortalPage } from './pages/CbtPortalPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { VisionPage } from './pages/VisionPage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/cbt" element={<CbtPage />} />
            <Route path="/cbt/portal" element={<CbtPortalPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/vision" element={<VisionPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </SiteProvider>
    </BrowserRouter>
  );
}
