"use client";

import { WalletInfo } from "@types";
import { createContext, ReactNode, useState } from "react";

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
  setState: () => { },
});

const StateProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ApplicationState>({
    walletInfo: null,
  });

  return (
    <ApplicationContext.Provider value={{ state, setState }}>
      {children}
    </ApplicationContext.Provider>
  );
};

export default StateProvider;
