"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** A persisted notification as the API returns it. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  /** ISO string, or null when unread. */
  readAt: string | null;
  createdAt: string;
}

const REFRESH_INTERVAL_MS = 60 * 1000;

export interface NotificationsResult {
  items: AppNotification[];
  unreadCount: number;
  /** True only for the initial load. */
  isLoading: boolean;
  refresh: () => void;
  /** Mark one notification read (optimistic; persists in the background). */
  markRead: (id: string) => void;
  /** Mark every unread notification read. */
  markAllRead: () => void;
}

/**
 * Loads the caller's persisted notifications and keeps them fresh on a 60s interval.
 *
 * Read/unread state lives on the server, so this is deliberately NOT the
 * localStorage dismissal the meeting/document reminders use: closing a notification
 * here is a real write, and a second device sees the same state.
 */
export function useNotifications(): NotificationsResult {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Mirror of `items` for the callbacks, so `markRead` can tell whether the row was
  // actually unread without depending on the state updater's timing.
  const itemsRef = useRef<AppNotification[]>([]);
  itemsRef.current = items;

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: AppNotification[];
        unreadCount?: number;
      } | null;
      if (!isMountedRef.current || !payload?.success) return;
      setItems(Array.isArray(payload.data) ? payload.data : []);
      setUnreadCount(
        typeof payload.unreadCount === "number" ? payload.unreadCount : 0,
      );
    } catch {
      // A failed poll keeps the previous list; the next interval retries.
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [load]);

  const markRead = useCallback((id: string) => {
    const target = itemsRef.current.find((item) => item.id === id);
    if (!target || target.readAt) return; // already read — nothing to write

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((count) => Math.max(count - 1, 0));

    void fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) =>
      prev.map((item) =>
        item.readAt ? item : { ...item, readAt: new Date().toISOString() },
      ),
    );
    setUnreadCount(0);

    void fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined);
  }, []);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { items, unreadCount, isLoading, refresh, markRead, markAllRead };
}
