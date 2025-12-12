/**
 * Parse error and return user-friendly message
 */
export function parseError(error: any): { title: string; message: string; details?: string } {
  if (!error) {
    return { title: "Error", message: "An unknown error occurred" };
  }

  const errorString = error.toString?.() || JSON.stringify(error);
  const errorMessage = error.message || errorString;

  // User rejected transaction
  if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("User denied") ||
    errorMessage.includes("user rejected")
  ) {
    return {
      title: "Transaction Cancelled",
      message: "You cancelled the transaction in your wallet.",
    };
  }

  // Insufficient funds
  if (errorMessage.includes("insufficient funds") || errorMessage.includes("insufficient balance")) {
    return {
      title: "Insufficient Funds",
      message: "You don't have enough IP to complete this transaction.",
    };
  }

  // Network error
  if (errorMessage.includes("network") || errorMessage.includes("fetch failed")) {
    return {
      title: "Network Error",
      message: "Unable to connect. Please check your internet connection and try again.",
    };
  }

  // Contract error
  if (errorMessage.includes("execution reverted") || errorMessage.includes("revert")) {
    return {
      title: "Transaction Failed",
      message: "The contract rejected this transaction. Please check your inputs and try again.",
      details: errorMessage,
    };
  }

  // Gas estimation error
  if (errorMessage.includes("gas")) {
    return {
      title: "Gas Estimation Failed",
      message: "Unable to estimate gas for this transaction. Please try again.",
      details: errorMessage,
    };
  }

  // Generic error with short message
  if (errorMessage.length < 100) {
    return {
      title: "Error",
      message: errorMessage,
    };
  }

  // Long technical error - extract meaningful part
  const shortMessage = errorMessage.substring(0, 150) + "...";
  return {
    title: "Transaction Error",
    message: "An error occurred while processing your transaction.",
    details: errorMessage,
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
