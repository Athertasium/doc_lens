"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      style={{
        padding: "6px 14px",
        background: "transparent",
        border: "1px solid var(--border-mid)",
        color: "var(--text-secondary)",
        borderRadius: 999,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.08em",
        cursor: "pointer",
      }}
    >
      SIGN OUT
    </button>
  );
}
