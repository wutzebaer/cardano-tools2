import { WalletInfo } from "./app/types";

export {};

declare global {
  interface Window {
    cardano?: Record<string, WalletInfo>;
  }
}
