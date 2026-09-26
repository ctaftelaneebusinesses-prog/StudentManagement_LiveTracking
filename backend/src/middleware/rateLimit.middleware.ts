import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/**
 * General API ceiling — generous enough for normal dashboard polling, still
 * blocks scraping/abuse. Raised from 600: a whole school (students, staff,
 * a computer lab) can sit behind one NAT'd IP, so the old limit was shared
 * by potentially hundreds of legitimate users, not one client.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Tighter limiter for auth endpoints — the highest-value target for
 * credential stuffing / brute force. Keyed by IP + the account being
 * targeted (not IP alone): a school building shares one public IP, so a
 * pure per-IP key would let one wave of students' logins lock out everyone
 * else on the same network after 20 attempts. Keying by account still caps
 * brute-forcing any single account from that IP at the same 20/15min.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
  keyGenerator: (req: Request): string => {
    const account =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : undefined;
    return account ? `${ipKeyGenerator(req.ip ?? "")}:${account}` : ipKeyGenerator(req.ip ?? "");
  },
});

/**
 * SEC-01 hardening: dedicated cap for PUBLIC self-registration. authLimiter
 * keys by IP+email, so an attacker rotating email addresses from one IP gets a
 * fresh 20-request budget per email — no ceiling on mass account creation.
 * This limiter is keyed by IP ALONE, capping how many registration attempts
 * (across all emails) a single source can make. Registered accounts are still
 * approval-gated (users.status) and cannot self-assign a privileged role
 * (077_signup_trigger_privilege_fix.sql), so this closes the remaining
 * abuse vector: automated bulk sign-ups.
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts from this network. Please try again later." },
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? ""),
});
