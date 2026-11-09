import type { Metadata } from "next";
import { ForgotForm } from "@/components/forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return <ForgotForm />;
}
