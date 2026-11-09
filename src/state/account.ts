import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../lib/storage";

export interface Profile {
  name: string;
  email: string;
  /** Opted in to occasional ARMGDN // LABS release notes. */
  newsletter: boolean;
  joinedAt: string;
}

interface AccountState {
  profile: Profile | null;
  signIn: (p: Omit<Profile, "joinedAt">) => void;
  update: (p: Partial<Omit<Profile, "joinedAt">>) => void;
  signOut: () => void;
}

/**
 * Optional local profile. MONITOR is free and fully featured without one; a profile only
 * names your saved presets and (if you opt in) adds you to the release-notes list.
 * Nothing leaves the browser unless a newsletter endpoint is configured and you opt in.
 */
export const useAccount = create<AccountState>()(
  persist(
    (set, get) => ({
      profile: null,
      signIn: (p) => set({ profile: { ...p, joinedAt: new Date().toISOString() } }),
      update: (p) => { const cur = get().profile; if (cur) set({ profile: { ...cur, ...p } }); },
      signOut: () => set({ profile: null }),
    }),
    { name: "monitor.account", storage: createJSONStorage(() => safeStorage) },
  ),
);
