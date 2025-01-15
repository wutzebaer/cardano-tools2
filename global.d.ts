import { Cardano } from "./app/types";

export {};

declare global {
  interface Window {
    cardano: Cardano;
  }
}
