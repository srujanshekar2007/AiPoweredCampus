import { redirect } from "next/navigation";

// All campus workspaces begin with the sign-in and verification flow.
export default function HomePage() {
  redirect("/login");
}
