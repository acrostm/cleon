"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Pencil, Plus, Power, RadioTower, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { BarkConfigItem } from "@/lib/bark-config";
import { CommandCenterBackground } from "@/components/command-center/CommandCenterBackground";
import { CommandCenterSurface } from "@/components/command-center/CommandCenterSurface";
import { HomeReturnButton } from "@/components/HomeReturnButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const emptyForm = {
  name: "",
  url: "",
  enabled: true,
  defaultGroup: "Cleon",
  defaultCategory: "通知",
  defaultIcon: "https://r2.jiachz.com/jiachz-light.svg",
  defaultSound: "default",
  description: "",
};

type BarkConfigForm = typeof emptyForm;

export function BarkConfigPage() {
  const [configs, setConfigs] = useState<BarkConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BarkConfigItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BarkConfigItem | null>(null);
  const [formData, setFormData] = useState<BarkConfigForm>(emptyForm);

  const enabledCount = useMemo(() => configs.filter((config) => config.enabled).length, [configs]);

  const updateForm = <Key extends keyof BarkConfigForm>(
    key: Key,
    value: BarkConfigForm[Key],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/bark-config", {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Failed to load configs");

      const data = (await response.json()) as { configs: BarkConfigItem[] };
      setConfigs(data.configs);
    } catch (error) {
      console.error("[Bark Config Load Error]:", error);
      toast.error("无法加载 Bark 配置");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfigs();
  }, []);

  const openDialog = (config?: BarkConfigItem) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        name: config.name,
        url: config.url,
        enabled: config.enabled,
        defaultGroup: config.defaultGroup,
        defaultCategory: config.defaultCategory,
        defaultIcon: config.defaultIcon,
        defaultSound: config.defaultSound,
        description: config.description ?? "",
      });
    } else {
      setEditingConfig(null);
      setFormData(emptyForm);
    }

    setDialogOpen(true);
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/bark-config", {
        method: editingConfig ? "PUT" : "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingConfig ? { id: editingConfig.id, ...formData } : formData,
        ),
      });

      if (!response.ok) throw new Error("Failed to save config");

      toast.success(editingConfig ? "配置已更新" : "配置已创建");
      setDialogOpen(false);
      await loadConfigs();
    } catch (error) {
      console.error("[Bark Config Save Error]:", error);
      toast.error("无法保存 Bark 配置");
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async () => {
    if (!deleteTarget) return;

    try {
      const response = await fetch(
        `/api/admin/bark-config?id=${encodeURIComponent(deleteTarget.id)}`,
        {
          method: "DELETE",
          cache: "no-store",
        },
      );

      if (!response.ok) throw new Error("Failed to delete config");

      toast.success("配置已删除");
      setDeleteTarget(null);
      await loadConfigs();
    } catch (error) {
      console.error("[Bark Config Delete Error]:", error);
      toast.error("无法删除 Bark 配置");
    }
  };

  const testNotification = async () => {
    try {
      setTesting(true);
      const response = await fetch("/api/admin/bark-config/test", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to send test notification");

      toast.success("测试通知已发送");
    } catch (error) {
      console.error("[Bark Config Test Error]:", error);
      toast.error("无法发送测试通知");
    } finally {
      setTesting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-100 selection:bg-cyan-300/20">
      <CommandCenterBackground />
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-5 px-4 py-6 md:px-6 md:py-10">
        <header className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <HomeReturnButton />
            <ThemeToggle />
          </div>

          <CommandCenterSurface className="rounded-lg p-4 md:p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200/80">
                  <RadioTower className="size-4" />
                  Notification Ops
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-normal text-white md:text-5xl">Bark Console</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Manage build and capture notification endpoints without leaving the command center.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testNotification}
                  disabled={testing || enabledCount === 0}
                  className="h-10 rounded-md border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]"
                >
                  <Send className={testing ? "animate-pulse" : ""} />
                  Test notification
                </Button>
                <Button type="button" onClick={() => openDialog()} className="h-10 rounded-md bg-cyan-300 px-4 font-black text-slate-950 hover:bg-cyan-200">
                  <Plus />
                  Add endpoint
                </Button>
              </div>
            </div>
          </CommandCenterSurface>
        </header>

        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="grid gap-3 lg:content-start">
            <StatusMetric label="Total endpoints" value={configs.length} />
            <StatusMetric label="Enabled" value={enabledCount} tone="emerald" />
            <StatusMetric label="Muted" value={configs.length - enabledCount} tone="amber" />
          </aside>

          <section className="grid gap-3">
            {loading ? (
              <CommandCenterSurface className="rounded-lg p-8 text-center text-sm text-slate-400">
                Loading Bark endpoints...
              </CommandCenterSurface>
            ) : configs.length === 0 ? (
              <CommandCenterSurface className="rounded-lg border-dashed p-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-md border border-white/10 bg-white/[0.06] text-slate-300">
                  <Bell className="size-5" />
                </span>
                <h2 className="mt-4 text-xl font-black text-white">No Bark endpoints yet</h2>
                <p className="mt-2 text-sm text-slate-400">Add a Bark server URL to receive build and capture notifications.</p>
              </CommandCenterSurface>
            ) : (
              configs.map((config) => (
                <CommandCenterSurface key={config.id} interactive className="rounded-lg p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid size-10 place-items-center rounded-md bg-white/[0.06] text-cyan-100">
                          <Bell className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-black text-white">{config.name}</h2>
                          <p className="mt-1 text-sm text-slate-500">{config.description || "No description"}</p>
                        </div>
                        <span
                          className={
                            config.enabled
                              ? "inline-flex items-center gap-1 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-100"
                              : "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-slate-500"
                          }
                        >
                          {config.enabled ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                          {config.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <ConfigField label="URL" value={config.url} mono />
                        <ConfigField label="Group / Category" value={`${config.defaultGroup} / ${config.defaultCategory}`} />
                        <ConfigField label="Sound" value={config.defaultSound} />
                        <ConfigField label="Icon" value={config.defaultIcon} mono />
                      </dl>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        aria-label="编辑配置"
                        onClick={() => openDialog(config)}
                        className="rounded-md border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-lg"
                        aria-label="删除配置"
                        onClick={() => setDeleteTarget(config)}
                        className="rounded-md"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </CommandCenterSurface>
              ))
            )}
          </section>
        </div>

        <ConfigDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingConfig={editingConfig}
          formData={formData}
          updateForm={updateForm}
          saveConfig={saveConfig}
          saving={saving}
        />

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent showCloseButton className="rounded-lg border-white/10 bg-[#0b0f17]/95 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white">Delete Bark endpoint?</DialogTitle>
              <DialogDescription className="text-slate-400">
                This removes {deleteTarget?.name}. Existing notifications already sent are not affected.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-md border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]">
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={deleteConfig} className="rounded-md">
                Delete endpoint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

function StatusMetric({ label, value, tone = "cyan" }: { label: string; value: number; tone?: "cyan" | "emerald" | "amber" }) {
  const toneClass = {
    cyan: "text-cyan-100",
    emerald: "text-emerald-100",
    amber: "text-amber-100",
  }[tone];

  return (
    <CommandCenterSurface className="rounded-lg p-4">
      <p className={`text-3xl font-black ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    </CommandCenterSurface>
  );
}

function ConfigField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className={`mt-1 truncate text-slate-200 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</dd>
    </div>
  );
}

function ConfigDialog({
  open,
  onOpenChange,
  editingConfig,
  formData,
  updateForm,
  saveConfig,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConfig: BarkConfigItem | null;
  formData: BarkConfigForm;
  updateForm: <Key extends keyof BarkConfigForm>(key: Key, value: BarkConfigForm[Key]) => void;
  saveConfig: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[90vh] overflow-y-auto rounded-lg border-white/10 bg-[#0b0f17]/95 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-white">
            {editingConfig ? "Edit Bark endpoint" : "Add Bark endpoint"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Bark URL must include the full server address and device key.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <ControlLabel label="Endpoint name">
            <Input
              value={formData.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="例如：主通知"
              className="border-white/10 bg-white/[0.05] text-white"
            />
          </ControlLabel>

          <ControlLabel label="Bark URL">
            <Input
              value={formData.url}
              onChange={(event) => updateForm("url", event.target.value)}
              placeholder="https://bark.example.com/your-key/"
              className="border-white/10 bg-white/[0.05] text-white"
            />
          </ControlLabel>

          <label className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold text-slate-200">
            <span className="inline-flex items-center gap-2">
              <Power className="size-4 text-cyan-200" />
              Enabled
            </span>
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(event) => updateForm("enabled", event.target.checked)}
              className="size-4 rounded border-white/20 bg-black"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <ControlLabel label="Default group">
              <Input value={formData.defaultGroup} onChange={(event) => updateForm("defaultGroup", event.target.value)} className="border-white/10 bg-white/[0.05] text-white" />
            </ControlLabel>
            <ControlLabel label="Default category">
              <Input value={formData.defaultCategory} onChange={(event) => updateForm("defaultCategory", event.target.value)} className="border-white/10 bg-white/[0.05] text-white" />
            </ControlLabel>
          </div>

          <ControlLabel label="Default icon URL">
            <Input value={formData.defaultIcon} onChange={(event) => updateForm("defaultIcon", event.target.value)} className="border-white/10 bg-white/[0.05] text-white" />
          </ControlLabel>

          <ControlLabel label="Default sound">
            <Input value={formData.defaultSound} onChange={(event) => updateForm("defaultSound", event.target.value)} placeholder="default" className="border-white/10 bg-white/[0.05] text-white" />
          </ControlLabel>

          <label className="grid gap-2 text-sm font-bold text-slate-300">
            Description
            <textarea
              value={formData.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={3}
              className="min-h-20 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus-visible:border-cyan-300/45 focus-visible:ring-3 focus-visible:ring-cyan-300/20"
              placeholder="Optional"
            />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-md border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]">
            Cancel
          </Button>
          <Button type="button" onClick={saveConfig} disabled={saving} className="rounded-md bg-cyan-300 px-4 font-black text-slate-950 hover:bg-cyan-200">
            Save endpoint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ControlLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-300">
      {label}
      {children}
    </label>
  );
}
