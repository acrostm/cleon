import { cookies } from "next/headers";

import { ArchiveConsole } from "@/components/archive/ArchiveConsole";
import { AccessGate } from "@/components/auth/AccessGate";
import { isOwnerSessionValue, OWNER_SESSION_COOKIE } from "@/lib/auth/session";

export default async function ArchivePage() {
  const cookieStore = await cookies();
  const isOwner = isOwnerSessionValue(cookieStore.get(OWNER_SESSION_COOKIE)?.value);

  if (!isOwner) {
    return <AccessGate redirectPath="/archive" />;
  }

  return <ArchiveConsole />;
}
