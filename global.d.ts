import { Cardano } from "./app/cardano/types";

export {};

declare global {
  interface Window {
    cardano: Cardano;
  }
}
