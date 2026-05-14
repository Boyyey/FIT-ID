import { type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import { FitIdCornerDrawer } from "@/components/FitIdCornerDrawer";
import { PartnerAuthProvider } from "@/context/PartnerAuth";
import { CallbackPage } from "@/pages/Callback";
import { HomePage } from "@/pages/Home";

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

export default function App() {
  return (
    <BrowserRouter>
      <PartnerAuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/callback" element={<CallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </PartnerAuthProvider>
    </BrowserRouter>
  );
}
