import Link from "next/link";

import { getUnitSystem } from "@/lib/units/preference";

import { UnitToggle } from "./UnitToggle";

export async function Header() {
  const system = await getUnitSystem();
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold text-zinc-900 hover:underline">
          strats
        </Link>
        <UnitToggle current={system} />
      </div>
    </header>
  );
}
