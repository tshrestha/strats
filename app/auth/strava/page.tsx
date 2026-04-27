import Link from "next/link";

import { readTokens } from "@/lib/strava/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.6rem 1rem",
  background: "#fc4c02",
  color: "#fff",
  textDecoration: "none",
  borderRadius: "4px",
};

export default async function StravaAuthPage() {
  const tokens = await readTokens();

  if (tokens) {
    return (
      <main>
        <h1>Connected to Strava</h1>
        <p>
          Authenticated as athlete <code>#{tokens.athleteId}</code>.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Connect with Strava</h1>
      <p>
        Grant <code>strats</code> access to your Strava activity data.
      </p>
      <p>
        <Link href="/auth/strava/login" style={buttonStyle}>
          Connect with Strava
        </Link>
      </p>
    </main>
  );
}
