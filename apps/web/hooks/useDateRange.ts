"use client";

import { useState, useEffect } from "react";
import { getTodayUTC, getDateOffsetUTC } from "@/lib/date-utils";

/**
 * Shared hook for the 3-day date range used by markets fixtures queries.
 * Ensures LeagueSidebar and MarketsPageClient use identical date boundaries.
 */
export function useDateRange(initialToday?: string, initialEndDate?: string) {
  const [today, setToday] = useState(() => initialToday ?? getTodayUTC());
  const [endDate, setEndDate] = useState(() => initialEndDate ?? getDateOffsetUTC(3));

  useEffect(() => {
    const id = setInterval(() => {
      const nowToday = getTodayUTC();
      const nowEnd = getDateOffsetUTC(3);
      setToday((prev) => (nowToday !== prev ? nowToday : prev));
      setEndDate((prev) => (nowEnd !== prev ? nowEnd : prev));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return { today, endDate };
}
