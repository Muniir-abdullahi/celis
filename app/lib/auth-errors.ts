interface AuthFailure {
  name?: string;
  message?: string;
  code?: string;
  status?: number;
}

/** Keep provider/network details out of the sign-in response. */
export function getSignInErrorMessage(error: AuthFailure): string {
  if (
    error.name === "AuthRetryableFetchError" ||
    /fetch failed|network|timeout|timed out/i.test(error.message ?? "") ||
    error.status === 0 ||
    (error.status !== undefined && error.status >= 500)
  ) {
    return "Unable to connect to the sign-in service. Please try again in a moment.";
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Too many sign-in attempts. Please wait a moment before trying again.";
  }
  if (error.code === "email_not_confirmed") {
    return "Please confirm your email address before signing in.";
  }
  return "Invalid email or password";
}
