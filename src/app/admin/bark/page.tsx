import { cookies } from "next/headers";

import { AccessGate } from "@/components/auth/AccessGate";
import { BarkConfigPage } from "@/components/admin/BarkConfigPage";
import { isOwnerSessionValue, OWNER_SESSION_COOKIE } from "@/lib/auth/session";

export default async function AdminBarkPage() {
  const cookieStore = await cookies();
  const isOwner = isOwnerSessionValue(cookieStore.get(OWNER_SESSION_COOKIE)?.value);

  if (!isOwner) {
    return <AccessGate redirectPath="/admin/bark" />;
  }

  return <BarkConfigPage />;
}
