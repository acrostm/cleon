import prisma from "@/lib/prisma";

export interface BarkConfigItem {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  defaultGroup: string;
  defaultCategory: string;
  defaultIcon: string;
  defaultSound: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarkConfigFile {
  configs: BarkConfigItem[];
}

type StoredBarkConfigItem = Omit<
  BarkConfigItem,
  "description" | "createdAt" | "updatedAt"
> & {
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const BARK_CONFIG_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "BarkConfig" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultGroup" TEXT NOT NULL DEFAULT 'Cleon',
  "defaultCategory" TEXT NOT NULL DEFAULT '通知',
  "defaultIcon" TEXT NOT NULL,
  "defaultSound" TEXT NOT NULL DEFAULT 'default',
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarkConfig_pkey" PRIMARY KEY ("id")
);
`;

const isMissingBarkConfigTable = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2021";

async function ensureBarkConfigTable() {
  await prisma.$executeRawUnsafe(BARK_CONFIG_TABLE_SQL);
}

const normalizeBarkConfigItem = (
  config: StoredBarkConfigItem,
): BarkConfigItem => ({
  ...config,
  description: config.description ?? undefined,
  createdAt: config.createdAt.toISOString(),
  updatedAt: config.updatedAt.toISOString(),
});

const toBarkConfigUpdate = (
  item: Omit<BarkConfigItem, "createdAt" | "updatedAt">,
) => ({
  name: item.name,
  url: item.url,
  enabled: item.enabled,
  defaultGroup: item.defaultGroup,
  defaultCategory: item.defaultCategory,
  defaultIcon: item.defaultIcon,
  defaultSound: item.defaultSound,
  description: item.description ?? null,
});

export async function readBarkConfig(): Promise<BarkConfigFile> {
  let configs: StoredBarkConfigItem[];

  try {
    configs = await prisma.barkConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    if (!isMissingBarkConfigTable(error)) throw error;

    await ensureBarkConfigTable();
    configs = [];
  }

  return {
    configs: configs.map(normalizeBarkConfigItem),
  };
}

export async function getEnabledBarkConfigs(): Promise<BarkConfigItem[]> {
  const config = await readBarkConfig();
  return config.configs.filter((item) => item.enabled);
}

export async function getBarkConfigById(
  id: string,
): Promise<BarkConfigItem | null> {
  await ensureBarkConfigTable();
  const config = await prisma.barkConfig.findUnique({
    where: { id },
  });

  return config ? normalizeBarkConfigItem(config) : null;
}

export async function addBarkConfig(
  newConfig: Omit<BarkConfigItem, "id" | "createdAt" | "updatedAt">,
): Promise<BarkConfigItem> {
  await ensureBarkConfigTable();
  const id = `bark_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const configItem = await prisma.barkConfig.create({
    data: {
      id,
      ...newConfig,
      description: newConfig.description ?? null,
    },
  });

  return normalizeBarkConfigItem(configItem);
}

export async function updateBarkConfig(
  id: string,
  updates: Partial<Omit<BarkConfigItem, "id" | "createdAt" | "updatedAt">>,
): Promise<BarkConfigItem | null> {
  const existing = await getBarkConfigById(id);
  if (!existing) return null;

  const updatedConfig = await prisma.barkConfig.update({
    where: { id },
    data: toBarkConfigUpdate({ ...existing, ...updates }),
  });

  return normalizeBarkConfigItem(updatedConfig);
}

export async function deleteBarkConfig(id: string): Promise<boolean> {
  try {
    await ensureBarkConfigTable();
    await prisma.barkConfig.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error("Failed to delete bark config:", error);
    return false;
  }
}
