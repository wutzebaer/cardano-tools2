"use client";

import { createContext, ReactNode, useState } from "react";

export interface ApplicationState {
  count: number;
}

export interface ApplicationStateContext {
  state: ApplicationState;
  setState: (state: ApplicationState) => void;
}

export const ApplicationContext = createContext<ApplicationStateContext>({
  state: { count: 0 },
  setState: () => {},
});

const StateProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ApplicationState>({ count: 0 });

  return (
    <ApplicationContext.Provider value={{ state, setState }}>
      {children}
    </ApplicationContext.Provider>
  );
};

export default StateProvider;
