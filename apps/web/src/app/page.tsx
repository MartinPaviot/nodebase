import { redirect } from "next/navigation";

/**
 * Root page - redirects to agents page
 */
export default function RootPage() {
  redirect("/agents");
}
