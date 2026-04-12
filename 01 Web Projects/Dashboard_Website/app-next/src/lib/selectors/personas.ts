import type { DashboardConfig } from '../config/schema';

type ProfileConfig = DashboardConfig['profile'];

// Typed accessors for the two user profiles.
export const useUser1 = (profile: ProfileConfig) => profile.user1;
export const useUser2 = (profile: ProfileConfig) => profile.user2;

// Display-name aliases per Q1 Option C (resolved 2026-04-11, CRITICAL-FIXES §2.1).
// "matty" → user1, "partner" → user2. These aliases exist ONLY in this file.
// Never use "matty"/"partner" as keys in persisted storage, API payloads, or
// other lib code. Phase 2 will move these into Zustand selectors once the store
// exists; for now they are pure profile-object functions.
export const useMatty = useUser1;
export const usePartner = useUser2;
