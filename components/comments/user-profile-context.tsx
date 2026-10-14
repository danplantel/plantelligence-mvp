"use client";

/**
 * user-profile-context — the rail's one piece of "whose card is open" state.
 *
 * A name appears in several places inside the panel (a message's author, an assignment's assignee,
 * and whatever comes next), and each of them sits a few components deep. Threading an
 * `onOpenProfile` prop through every one of those would put a new required prop on three unrelated
 * components — and the next place a name is rendered would have to remember to add it again. A
 * context puts the seam where the meaning is: ANY name can ask for a card, and the panel owns the one
 * dialog that answers.
 *
 * Mounted by `CommentsRail`, so the dialog is scoped to the panel rather than to the dashboard — but
 * the conversation it hands off to is the Messages rail, which lives above both.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { UserProfileDialog } from "./user-profile-dialog";

interface UserProfileValue {
  /** Open the card for this person. */
  open: (userId: string) => void;
}

const UserProfileContext = createContext<UserProfileValue | null>(null);

export function UserProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userId, setUserId] = useState<string | null>(null);

  const open = useCallback((next: string) => {
    // `"pending"` is the placeholder a half-sent message carries while its author is still being
    // resolved. There is no account behind it yet, so asking the server who it is would be a request
    // nobody can answer — and a failed fetch would flash an error at the reader for a message they
    // just sent themselves.
    if (!next || next === "pending") return;
    setUserId(next);
  }, []);

  const value = useMemo<UserProfileValue>(() => ({ open }), [open]);

  return (
    <UserProfileContext.Provider value={value}>
      {children}
      <UserProfileDialog
        userId={userId}
        onOpenChange={(next) => {
          if (!next) setUserId(null);
        }}
      />
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileValue {
  const value = useContext(UserProfileContext);
  if (!value) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return value;
}
