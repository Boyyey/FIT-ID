import { type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import { FitIdCornerDrawer } from "@/components/FitIdCornerDrawer";
import { PartnerAuthProvider, usePartnerAuth } from "@/context/PartnerAuth";
import { CallbackPage } from "@/pages/Callback";
import { HomePage } from "@/pages/Home";
import { SignInPage } from "@/pages/SignIn";

import "./index.css";

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <Link className="brand" to="/">
              <span className="brand-mark">Luma</span>
              <span className="brand-name">Atelier</span>
            </Link>
            <span className="pill">Partner demo</span>
          </div>
          <FitIdCornerDrawer />
        </div>
      </header>
      {children}
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = usePartnerAuth();
  if (!session) {
    return <Navigate to="/signin" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <PartnerAuthProvider>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <HomePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </PartnerAuthProvider>
    </BrowserRouter>
  );
}
