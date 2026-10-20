import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}

/** Reads the environment per request so the Google button follows the deployed config. */
async function Form() {
  await connection();
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return <AuthForm mode="sign-up" googleEnabled={googleEnabled} />;
}
