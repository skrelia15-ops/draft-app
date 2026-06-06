import {
  DEFAULT_PROFILE,
  useProfile,
  type Bike,
  type SkillLevel,
} from '@/lib/profile';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * The slice of profile data collected during the step-by-step setup
 * wizard. Avatar and pace are intentionally left out — those are edited
 * later via profile-setup's edit mode.
 */
type WizardDraft = {
  name: string;
  skillLevel: SkillLevel;
  bike: Bike | null;
};

type WizardContextValue = {
  draft: WizardDraft;
  setDraft: (patch: Partial<WizardDraft>) => void;
  /** Persist the collected draft to the profile store. */
  commit: () => Promise<void>;
};

const WizardContext = createContext<WizardContextValue | null>(null);

const INITIAL_DRAFT: WizardDraft = {
  // Start the name empty so the user types it; the root gate keys off a
  // non-empty name to advance out of the wizard.
  name: '',
  skillLevel: DEFAULT_PROFILE.skillLevel,
  bike: null,
};

export function WizardProvider({ children }: { children: ReactNode }) {
  const { update } = useProfile();
  const [draft, setDraftState] = useState<WizardDraft>(INITIAL_DRAFT);

  const setDraft = useCallback((patch: Partial<WizardDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const commit = useCallback(async () => {
    await update({
      name: draft.name.trim(),
      skillLevel: draft.skillLevel,
      bike: draft.bike,
    });
  }, [draft, update]);

  const value = useMemo<WizardContextValue>(
    () => ({ draft, setDraft, commit }),
    [draft, setDraft, commit],
  );

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error('useWizard must be used inside <WizardProvider>.');
  }
  return ctx;
}
