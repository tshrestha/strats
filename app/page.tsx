import Link from "next/link";
import { redirect } from "next/navigation";

import { readTokens } from "@/lib/strava/tokens";

export default async function HomePage() {
  if (await readTokens()) redirect("/dashboard");

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">strats</h1>
      <nav className="flex flex-col gap-2">
        <Link href="/dashboard" className="text-blue-700 hover:underline">
          Dashboard →
        </Link>
        <Link href="/activities" className="text-blue-700 hover:underline">
          Activities →
        </Link>
        <Link href="/auth/strava" className="text-blue-700 hover:underline">
          Strava connection →
        </Link>
      </nav>
    </main>
  );
}
