import { createContext, ReactNode, useContext } from "react";
import type { AppUseCases } from "../../../application/app-use-cases";

const UseCasesContext = createContext<AppUseCases | null>(null);

// Gives components the use cases they call directly, built by the composition root.
export function UseCasesProvider({
  useCases,
  children,
}: {
  useCases: AppUseCases;
  children: ReactNode;
}) {
  return (
    <UseCasesContext.Provider value={useCases}>
      {children}
    </UseCasesContext.Provider>
  );
}

export function useUseCases(): AppUseCases {
  const useCases = useContext(UseCasesContext);

  if (useCases === null) {
    throw new Error("useUseCases needs a UseCasesProvider");
  }

  return useCases;
}
