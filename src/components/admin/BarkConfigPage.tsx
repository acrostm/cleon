"use client";

import { useEffect, useState } from "react";
import { Bell, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { BarkConfigItem } from "@/lib/bark-config";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [editingConfig, setEditingConfig] = useState<BarkConfigItem | null>(
    null,
  );
  const [formData, setFormData] = useState<BarkConfigForm>(emptyForm);

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
      console.error(error);
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
      console.error(error);
      toast.error("无法保存 Bark 配置");
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (id: string) => {
    if (!window.confirm("确定要删除这个 Bark 配置吗？")) return;

    try {
      const response = await fetch(
        `/api/admin/bark-config?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          cache: "no-store",
        },
      );

      if (!response.ok) throw new Error("Failed to delete config");

      toast.success("配置已删除");
      await loadConfigs();
    } catch (error) {
      console.error(error);
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
      console.error(error);
      toast.error("无法发送测试通知");
    } finally {
      setTesting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 md:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-semibold tracking-normal">
              Bark 通知配置
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              管理 Cleon 的 Bark 端点，构建完成和内容采集成功后会使用启用的配置发送通知。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={testNotification}
              disabled={testing}
            >
              <Bell />
              测试通知
            </Button>
            <Button type="button" onClick={() => openDialog()}>
              <Plus />
              添加配置
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : configs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            暂无 Bark 配置。
          </div>
        ) : (
          <div className="grid gap-3">
            {configs.map((config) => (
              <Card key={config.id} size="sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        {config.name}
                        <span
                          className={
                            config.enabled
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-300"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          }
                        >
                          {config.enabled ? "已启用" : "已禁用"}
                        </span>
                      </CardTitle>
                      {config.description && (
                        <CardDescription>{config.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="编辑配置"
                        onClick={() => openDialog(config)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        aria-label="删除配置"
                        onClick={() => deleteConfig(config.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">URL</dt>
                      <dd className="truncate font-mono text-xs">
                        {config.url}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">分组 / 分类</dt>
                      <dd>
                        {config.defaultGroup} / {config.defaultCategory}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">音效</dt>
                      <dd>{config.defaultSound}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">图标</dt>
                      <dd className="truncate font-mono text-xs">
                        {config.defaultIcon}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? "编辑 Bark 配置" : "添加 Bark 配置"}
              </DialogTitle>
              <DialogDescription>
                Bark URL 需要包含完整 server 地址和 device key。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <label className="grid gap-1 text-sm">
                配置名称
                <Input
                  value={formData.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="例如：主通知"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Bark URL
                <Input
                  value={formData.url}
                  onChange={(event) => updateForm("url", event.target.value)}
                  placeholder="https://bark.example.com/your-key/"
                />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(event) =>
                    updateForm("enabled", event.target.checked)
                  }
                  className="size-4 rounded border-border"
                />
                启用此配置
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  默认分组
                  <Input
                    value={formData.defaultGroup}
                    onChange={(event) =>
                      updateForm("defaultGroup", event.target.value)
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  默认分类
                  <Input
                    value={formData.defaultCategory}
                    onChange={(event) =>
                      updateForm("defaultCategory", event.target.value)
                    }
                  />
                </label>
              </div>

              <label className="grid gap-1 text-sm">
                默认图标 URL
                <Input
                  value={formData.defaultIcon}
                  onChange={(event) =>
                    updateForm("defaultIcon", event.target.value)
                  }
                />
              </label>

              <label className="grid gap-1 text-sm">
                默认音效
                <Input
                  value={formData.defaultSound}
                  onChange={(event) =>
                    updateForm("defaultSound", event.target.value)
                  }
                  placeholder="default"
                />
              </label>

              <label className="grid gap-1 text-sm">
                描述
                <textarea
                  value={formData.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  rows={3}
                  className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="可选"
                />
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="button" onClick={saveConfig} disabled={saving}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
