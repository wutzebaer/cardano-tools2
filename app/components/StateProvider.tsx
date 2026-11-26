"use client";

import { WalletInfo } from "@cardano/types";
import { createContext, ReactNode, useMemo, useState } from "react";

export interface ApplicationState {
  walletInfo: WalletInfo | null;
}

export interface ApplicationStateContext {
  state: ApplicationState;
  setState: (state: ApplicationState) => void;
}

export const ApplicationContext = createContext<ApplicationStateContext>({
  state: {
    walletInfo: null,
  },
  setState: () => {},
});

const StateProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ApplicationState>({
    walletInfo: null,
  });

  // stable while the state is unchanged, so consumers only re-render on a real change
  const value = useMemo(() => ({ state, setState }), [state]);

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
};

export default StateProvider;
