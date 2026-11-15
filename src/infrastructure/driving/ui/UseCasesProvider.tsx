import constate from "constate";
import type { AppUseCases } from "../../../application/app-use-cases";

// Gives components the use cases they call directly, built by the composition root.
export const [UseCasesProvider, useUseCases] = constate(
  function useCasesFromProps({ useCases }: { useCases: AppUseCases }) {
    return useCases;
  },
);
