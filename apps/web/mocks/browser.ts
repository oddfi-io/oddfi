import { setupWorker } from "msw/browser";
import { swapHandlers } from "./handlers/swap";
import { inviteHandlers } from "./handlers/invite";
import { tokenPriceHandlers } from "./handlers/token-prices";
import { lendingHandlers } from "./handlers/lending";

export const worker = setupWorker(
  ...swapHandlers,
  ...inviteHandlers,
  ...tokenPriceHandlers,
  ...lendingHandlers
);
