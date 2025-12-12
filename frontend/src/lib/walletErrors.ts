/**
 * Utility functions for handling wallet errors gracefully
 */

/**
 * Check if an error is a user rejection (user clicked cancel in wallet)
 */
export function isUserRejection(error: any): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || error.toString().toLowerCase();

  // Common rejection messages from different wallets
  const rejectionPatterns = [
    'user rejected',
    'user denied',
    'user cancelled',
    'user canceled',
    'rejected by user',
    'denied by user',
    'cancelled by user',
    'canceled by user',
    'transaction rejected',
    'user disapproved',
    'action_rejected',
    'request rejected',
  ];

  return rejectionPatterns.some(pattern => message.includes(pattern));
}

/**
 * Get a user-friendly error message
 */
export function getUserFriendlyError(error: any): string | null {
  if (!error) return null;

  // Don't show error message for user rejections
  if (isUserRejection(error)) {
    return null;
  }

  const message = error.message || error.toString();

  // Handle common error types
  if (message.includes('insufficient funds')) {
    return 'Insufficient funds to complete this transaction';
  }

  if (message.includes('gas required exceeds')) {
    return 'Transaction may fail - insufficient gas';
  }

  if (message.includes('nonce')) {
    return 'Transaction conflict - please try again';
  }

  if (message.includes('network')) {
    return 'Network error - please check your connection';
  }

  // Return generic error for other cases
  return message.length > 150 ? 'Transaction failed - please try again' : message;
}
