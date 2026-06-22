import { cookies } from "next/headers";

import { AccessGate } from "@/components/auth/AccessGate";
import { HomeExperience } from "@/components/home/HomeExperience";
import { isOwnerSessionValue, OWNER_SESSION_COOKIE } from "@/lib/auth/session";

export default async function Home() {
  const cookieStore = await cookies();
  const isOwner = isOwnerSessionValue(cookieStore.get(OWNER_SESSION_COOKIE)?.value);

  if (!isOwner) {
    return <AccessGate />;
  }

  return <HomeExperience />;
}
