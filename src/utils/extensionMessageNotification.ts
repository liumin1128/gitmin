import type { ExtensionMessage } from "../../shared/messages";
import { t } from "../../shared/i18n";

export type NativeNotification = {
  level: "information" | "warning" | "error";
  message: string;
};

export function toNativeNotification(
  response: ExtensionMessage,
): NativeNotification | null {
  switch (response.type) {
    case "repo/none":
      return { level: "warning", message: response.reason };
    case "repositories/error":
    case "commits/error":
    case "commitDetails/error":
    case "diff/error":
    case "workingTree/error":
    case "stashes/error":
    case "selectionDetails/error":
      return { level: "error", message: response.error };
    case "workingTree/actionResult":
      if (!response.ok) {
        return response.message === "Cancelled"
          ? null
          : {
              level: "error",
              message: response.message ?? t("common.operationFailed"),
            };
      }
      return response.operation === "stash"
        ? {
            level: "information",
            message: response.message ?? t("changes.stashed"),
          }
        : null;
    case "workingTree/commitMessageResult":
      return !response.ok && !response.cancelled
        ? {
            level: "error",
            message: response.error ?? t("error.commitMessageGeneration"),
          }
        : null;
    case "action/result":
      return !response.ok && response.message !== "Cancelled"
        ? {
            level: "error",
            message: t("error.gitOperation", {
              message: response.message ?? t("common.operationFailed"),
            }),
          }
        : null;
    default:
      return null;
  }
}
