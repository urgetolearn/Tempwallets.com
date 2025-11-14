"use client";

import { useEffect, useRef } from "react";
import { initMixpanel, trackMixpanelEvent } from "@/lib/mixpanel";

export function LandingPageTracker() {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      initMixpanel();
      trackMixpanelEvent("V2-Landing Page", {
        path: window.location.pathname,
        timestamp: new Date().toISOString(),
        source: "web-app",
      });
      hasTracked.current = true;
    }
  }, []);

  return null;
}
