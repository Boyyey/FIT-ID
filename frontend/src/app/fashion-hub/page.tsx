"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { FashionHubPanel } from "@/components/fashion/FashionHubPanel";
import { getFitIdSession } from "@/lib/auth";

export default function FashionHubPage() {
  const router = useRouter();
  const session = useMemo(() => getFitIdSession(), []);

  useEffect(() => {
    if (!session?.email) router.replace("/");
  }, [router, session?.email]);

  if (!session?.email) return null;

  return (
    <main className="dashboard-app fade-in">
      <FashionHubPanel email={session.email} showFooterLink />
    </main>
  );
}
