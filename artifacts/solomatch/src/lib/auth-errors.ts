// Translate a Supabase auth error into friendly, specific copy, falling back to
// the raw message. Duck-typed so it works on AuthError instances and any thrown
// error shape (Supabase errors carry a stable `code` plus a `message`).
export function mapAuthError(err: unknown): string {
  const e = err as
    | { code?: string; message?: string; status?: number }
    | null
    | undefined;
  switch (e?.code) {
    case "invalid_credentials":
      return "The email or password is incorrect. Please try again.";
    case "email_not_confirmed":
      return "Please verify your email first. Enter the code we emailed you.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return "Your password isn't strong enough. Please use at least 8 characters.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    case "otp_expired":
    case "otp_disabled":
      return "That code is incorrect or has expired. Please request a new one.";
    case "user_banned":
      return "This account has been suspended. Please contact support.";
    default:
      return e?.message || "Something went wrong. Please try again.";
  }
}
