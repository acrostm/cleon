"use client";

import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Cloud,
  Database,
  ExternalLink,
  FileClock,
  ImageIcon,
  KeyRound,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { CommandCenterBackground } from "@/components/command-center/CommandCenterBackground";
import { CommandCenterSurface } from "@/components/command-center/CommandCenterSurface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ArchiveAccount = {
  id: string;
  profileUrl: string;
  displayName?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  accountType: string;
  authMode: string;
  authProfileId?: string | null;
  authProfile?: ArchiveAuthProfile | null;
  authStatus: string;
  lastAuthCheckAt?: string | null;
  authFailureReason?: string | null;
  scanEnabled: boolean;
  scanIntervalSeconds: number;
  lastScannedAt?: string | null;
  nextScanAt?: string | null;
  lastSuccessAt?: string | null;
  recentNewPostAt?: string | null;
  consecutiveFailures: number;
  status: string;
  remark?: string | null;
  createdAt: string;
  _count?: { posts: number; scanJobs: number };
};

type ArchiveAuthProfile = {
  id: string;
  name: string;
  provider: string;
  workerBaseUrl?: string | null;
  authStateKey?: string | null;
  status: string;
  lastLoginStartedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastFailureAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  accounts?: ArchiveAccount[];
  _count?: { accounts: number };
};

type ArchiveWorkerHeartbeat = {
  id: string;
  workerId: string;
  workerUrl?: string | null;
  status: string;
  dailyBudgetSeconds: number;
  dailyUsedSeconds: number;
  pausedUntil?: string | null;
  lastError?: string | null;
  lastSeenAt: string;
};

type ArchiveAsset = {
  id: string;
  assetType: string;
  sourceUrl: string;
  storageUrl?: string | null;
  sha256?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  downloadStatus: string;
  errorMessage?: string | null;
  createdAt: string;
};

type ArchiveSnapshot = {
  id: string;
  triggerType: string;
  title?: string | null;
  contentText: string;
  status?: string | null;
  contentHash?: string | null;
  capturedAt: string;
};

type ArchiveStatusEvent = {
  id: string;
  oldStatus?: string | null;
  newStatus: string;
  reason?: string | null;
  checkedAt: string;
};

type ArchivePost = {
  id: string;
  accountId?: string | null;
  account?: ArchiveAccount | null;
  originalUrl: string;
  platformNoteId?: string | null;
  title?: string | null;
  contentText: string;
  coverStorageUrl?: string | null;
  coverSourceUrl?: string | null;
  authorName?: string | null;
  publishTime?: string | null;
  firstSeenAt: string;
  archivedAt?: string | null;
  lastSeenAt?: string | null;
  lastCheckedAt?: string | null;
  status: string;
  archiveError?: string | null;
  assets?: ArchiveAsset[];
  snapshots?: ArchiveSnapshot[];
  statusEvents?: ArchiveStatusEvent[];
  _count?: { assets: number; snapshots: number; statusEvents: number };
};

type ArchiveAuditLog = {
  id: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  actorName?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

type DashboardData = {
  accountCount: number;
  activeAccountCount: number;
  postCount: number;
  todayNewPostCount: number;
  recentNewPostCount: number;
  unavailablePostCount: number;
  failedAccountCount: number;
  queueBacklog: number;
  storageUsedBytes: number;
  latestPosts: ArchivePost[];
  authProfiles: ArchiveAuthProfile[];
  workerHeartbeats: ArchiveWorkerHeartbeat[];
  failedScans: Array<{
    id: string;
    errorMessage?: string | null;
    errorCode?: string | null;
    createdAt: string;
    account?: ArchiveAccount | null;
  }>;
};

type Tab = "dashboard" | "accounts" | "posts" | "audit";

const tabs: Array<{ value: Tab; label: string; icon: LucideIcon }> = [
  { value: "dashboard", label: "Dashboard", icon: Activity },
  { value: "accounts", label: "Accounts", icon: Database },
  { value: "posts", label: "Archive Posts", icon: Archive },
  { value: "audit", label: "Audit", icon: FileClock },
];

const statusTone: Record<string, string> = {
  visible: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  discovered: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  unavailable: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  deleted_or_hidden: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  restricted: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  login_required: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  captcha_required: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  pending_confirmation: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  verification_code_required: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  phone_code_required: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  phone_code_unavailable: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  active: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  pending: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  expired: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  parse_failed: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  archive_failed: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

const emptyAccountForm = {
  profileUrl: "",
  displayName: "",
  accountType: "public",
  authMode: "public",
  authProfileId: "",
  scanIntervalSeconds: "600",
  remark: "",
  consentNote: "",
};

const emptyAuthProfileForm = {
  name: "XHS Cloudflare Auth",
  workerBaseUrl: "",
};

const postStatuses = [
  "all",
  "discovered",
  "visible",
  "unavailable",
  "deleted_or_hidden",
  "restricted",
  "login_required",
  "captcha_required",
  "parse_failed",
];

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null) as T & { error?: string; details?: string };
  if (!response.ok || (data as { success?: boolean })?.success === false) {
    console.error("[Archive API Error]:", url, data?.error || response.statusText, data?.details || "");
    throw new Error(data?.error || response.statusText);
  }
  return data;
}

function getAccountLabel(account?: ArchiveAccount | null) {
  return account?.displayName || account?.nickname || account?.profileUrl || "Manual import";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-normal", statusTone[status] || "border-white/10 bg-white/[0.06] text-slate-200")}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function ArchiveConsole() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<ArchiveAccount[]>([]);
  const [authProfiles, setAuthProfiles] = useState<ArchiveAuthProfile[]>([]);
  const [posts, setPosts] = useState<ArchivePost[]>([]);
  const [auditLogs, setAuditLogs] = useState<ArchiveAuditLog[]>([]);
  const [selectedPost, setSelectedPost] = useState<ArchivePost | null>(null);
  const [editingAccount, setEditingAccount] = useState<ArchiveAccount | null>(null);
  const [authProfileForm, setAuthProfileForm] = useState(emptyAuthProfileForm);
  const [authLogin, setAuthLogin] = useState<{
    profileId: string;
    sessionId: string;
    screenshotDataUrl?: string;
    status: string;
    message?: string;
  } | null>(null);
  const [authPhoneNumber, setAuthPhoneNumber] = useState("");
  const [authVerificationCode, setAuthVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [editAccountForm, setEditAccountForm] = useState(emptyAccountForm);
  const [importUrl, setImportUrl] = useState("");
  const [importAccountId, setImportAccountId] = useState("");
  const [postKeyword, setPostKeyword] = useState("");
  const [postStatus, setPostStatus] = useState("all");
  const [postAccountId, setPostAccountId] = useState("all");

  const loadDashboard = useCallback(async () => {
    const data = await fetchJson<{ success: boolean; data: DashboardData }>("/api/archive/dashboard");
    setDashboard(data.data);
  }, []);

  const loadAccounts = useCallback(async () => {
    const data = await fetchJson<{ success: boolean; data: ArchiveAccount[] }>("/api/archive/accounts");
    setAccounts(data.data);
  }, []);

  const loadAuthProfiles = useCallback(async () => {
    const data = await fetchJson<{ success: boolean; data: ArchiveAuthProfile[] }>("/api/archive/auth-profiles");
    setAuthProfiles(data.data);
  }, []);

  const loadPosts = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: "30" });
    if (postKeyword.trim()) params.set("keyword", postKeyword.trim());
    if (postStatus !== "all") params.set("status", postStatus);
    if (postAccountId !== "all") params.set("accountId", postAccountId);

    const data = await fetchJson<{ success: boolean; data: ArchivePost[] }>(`/api/archive/posts?${params.toString()}`);
    setPosts(data.data);
  }, [postAccountId, postKeyword, postStatus]);

  const loadAuditLogs = useCallback(async () => {
    const data = await fetchJson<{ success: boolean; data: ArchiveAuditLog[] }>("/api/archive/audit-logs?pageSize=30");
    setAuditLogs(data.data);
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadDashboard(), loadAccounts(), loadAuthProfiles(), loadPosts(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Load Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to load archive console");
    } finally {
      setIsLoading(false);
    }
  }, [loadAccounts, loadAuditLogs, loadAuthProfiles, loadDashboard, loadPosts]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadPosts().catch((error) => {
      console.error("[Archive Post Filter Error]:", error);
      toast.error("Unable to filter archive posts");
    });
  }, [loadPosts]);

  const accountOptions = useMemo(() => accounts.map((account) => ({
    id: account.id,
    label: getAccountLabel(account),
  })), [accounts]);

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountForm.profileUrl.trim() || isBusy) return;

    setIsBusy(true);
    try {
      await fetchJson("/api/archive/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...accountForm,
          scanIntervalSeconds: Number.parseInt(accountForm.scanIntervalSeconds, 10),
        }),
      });
      setAccountForm(emptyAccountForm);
      toast.success("Archive account added");
      await Promise.all([loadAccounts(), loadDashboard()]);
    } catch (error) {
      console.error("[Archive Account Create Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to add account");
    } finally {
      setIsBusy(false);
    }
  };

  const openEditAccount = (account: ArchiveAccount) => {
    setEditingAccount(account);
    setEditAccountForm({
      profileUrl: account.profileUrl,
      displayName: account.displayName || "",
      accountType: account.accountType,
      authMode: account.authMode || "public",
      authProfileId: account.authProfileId || "",
      scanIntervalSeconds: String(account.scanIntervalSeconds),
      remark: account.remark || "",
      consentNote: "",
    });
  };

  const handleUpdateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAccount || isBusy) return;

    setIsBusy(true);
    try {
      await fetchJson(`/api/archive/accounts/${editingAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editAccountForm,
          scanIntervalSeconds: Number.parseInt(editAccountForm.scanIntervalSeconds, 10),
          scanEnabled: editingAccount.scanEnabled,
        }),
      });
      setEditingAccount(null);
      toast.success("Archive account updated");
      await Promise.all([loadAccounts(), loadDashboard(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Account Update Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to update account");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateAuthProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;

    setIsBusy(true);
    try {
      await fetchJson("/api/archive/auth-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authProfileForm),
      });
      setAuthProfileForm(emptyAuthProfileForm);
      toast.success("Cloudflare auth profile created");
      await Promise.all([loadAuthProfiles(), loadDashboard(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Auth Profile Create Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to create auth profile");
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartAuthLogin = async (profile: ArchiveAuthProfile) => {
    setIsBusy(true);
    try {
      const data = await fetchJson<{
        success: boolean;
        data: {
          worker?: {
            sessionId?: string;
            screenshotDataUrl?: string;
            status?: string;
            message?: string;
          };
        };
      }>(`/api/archive/auth-profiles/${profile.id}/start`, { method: "POST" });
      const sessionId = data.data.worker?.sessionId;
      if (!sessionId) throw new Error("Cloudflare worker did not return a login session");
      setAuthPhoneNumber("");
      setAuthVerificationCode("");
      setAuthLogin({
        profileId: profile.id,
        sessionId,
        screenshotDataUrl: data.data.worker?.screenshotDataUrl,
        status: data.data.worker?.status || "pending",
        message: data.data.worker?.message,
      });
      toast.success("Cloudflare login session started");
      await Promise.all([loadAuthProfiles(), loadDashboard(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Auth Login Start Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to start Cloudflare login");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePollAuthLogin = async () => {
    if (!authLogin || isBusy) return;

    setIsBusy(true);
    try {
      const params = new URLSearchParams({ sessionId: authLogin.sessionId });
      const data = await fetchJson<{
        success: boolean;
        data?: {
          status?: string;
          authenticated?: boolean;
          screenshotDataUrl?: string;
          message?: string;
        };
      }>(`/api/archive/auth-profiles/${authLogin.profileId}/status?${params.toString()}`);
      setAuthLogin({
        ...authLogin,
        status: data.data?.status || authLogin.status,
        screenshotDataUrl: data.data?.screenshotDataUrl || authLogin.screenshotDataUrl,
        message: data.data?.message,
      });
      if (data.data?.authenticated) {
        setAuthPhoneNumber("");
        setAuthVerificationCode("");
        toast.success("Cloudflare auth profile is active");
        await Promise.all([loadAuthProfiles(), loadAccounts(), loadDashboard(), loadAuditLogs()]);
      }
    } catch (error) {
      console.error("[Archive Auth Login Poll Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to poll Cloudflare login");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRequestAuthSmsCode = async () => {
    if (!authLogin || isBusy) return;

    const phoneNumber = authPhoneNumber.replace(/\D/g, "").slice(0, 15);
    if (phoneNumber.length < 8) {
      toast.error("Enter the phone number for Xiaohongshu SMS login");
      return;
    }

    setIsBusy(true);
    try {
      const data = await fetchJson<{
        success: boolean;
        data?: {
          status?: string;
          authenticated?: boolean;
          screenshotDataUrl?: string;
          message?: string;
        };
      }>(`/api/archive/auth-profiles/${authLogin.profileId}/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: authLogin.sessionId,
          phoneNumber,
        }),
      });
      setAuthLogin({
        ...authLogin,
        status: data.data?.status || authLogin.status,
        screenshotDataUrl: data.data?.screenshotDataUrl || authLogin.screenshotDataUrl,
        message: data.data?.message,
      });
      if (data.data?.authenticated) {
        setAuthPhoneNumber("");
        setAuthVerificationCode("");
        toast.success("Cloudflare auth profile is active");
        await Promise.all([loadAuthProfiles(), loadAccounts(), loadDashboard(), loadAuditLogs()]);
      } else {
        toast(data.data?.message || "SMS code requested");
      }
    } catch (error) {
      console.error("[Archive Auth Login Code Request Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to request verification code");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitAuthVerificationCode = async () => {
    if (!authLogin || isBusy) return;

    const verificationCode = authVerificationCode.replace(/\D/g, "").slice(0, 8);
    if (verificationCode.length < 4) {
      toast.error("Enter the SMS verification code sent to your phone");
      return;
    }

    setIsBusy(true);
    try {
      const data = await fetchJson<{
        success: boolean;
        data?: {
          status?: string;
          authenticated?: boolean;
          screenshotDataUrl?: string;
          message?: string;
        };
      }>(`/api/archive/auth-profiles/${authLogin.profileId}/submit-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: authLogin.sessionId,
          code: verificationCode,
        }),
      });
      setAuthLogin({
        ...authLogin,
        status: data.data?.status || authLogin.status,
        screenshotDataUrl: data.data?.screenshotDataUrl || authLogin.screenshotDataUrl,
        message: data.data?.message,
      });
      if (data.data?.authenticated) {
        setAuthPhoneNumber("");
        setAuthVerificationCode("");
        toast.success("Cloudflare auth profile is active");
        await Promise.all([loadAuthProfiles(), loadAccounts(), loadDashboard(), loadAuditLogs()]);
      } else {
        toast(data.data?.message || "Verification code submitted");
      }
    } catch (error) {
      console.error("[Archive Auth Login Code Submit Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to submit verification code");
    } finally {
      setIsBusy(false);
    }
  };

  const handleEnableAuthorizedWorker = async (account: ArchiveAccount) => {
    const profile = authProfiles.find((item) => item.status === "active") || authProfiles[0];
    if (!profile) {
      toast.error("Create a Cloudflare auth profile first");
      return;
    }

    setIsBusy(true);
    try {
      await fetchJson(`/api/archive/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authMode: "authorized_browser",
          authProfileId: profile.id,
          accountType: account.accountType === "public" ? "authorized" : account.accountType,
          scanEnabled: true,
          action: "resume",
        }),
      });
      toast.success("Account switched to Cloudflare authorized worker");
      await Promise.all([loadAccounts(), loadDashboard(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Enable Authorized Worker Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to enable authorized worker");
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importUrl.trim() || isBusy) return;

    setIsBusy(true);
    try {
      const data = await fetchJson<{ success: boolean; data: ArchivePost }>("/api/archive/posts/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: importUrl.trim(),
          accountId: importAccountId || undefined,
        }),
      });
      setImportUrl("");
      setSelectedPost(data.data);
      toast.success("Post archived");
      await Promise.all([loadPosts(), loadDashboard(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Import Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to archive post");
    } finally {
      setIsBusy(false);
    }
  };

  const handleAccountAction = async (account: ArchiveAccount, action: "pause" | "resume" | "scan") => {
    setIsBusy(true);
    try {
      if (action === "scan") {
        await fetchJson(`/api/archive/accounts/${account.id}/scan`, { method: "POST" });
        toast.success("Manual scan completed");
      } else {
        await fetchJson(`/api/archive/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        toast.success(action === "pause" ? "Scanning paused" : "Scanning resumed");
      }

      await Promise.all([loadAccounts(), loadPosts(), loadDashboard(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Account Action Error]:", error);
      toast.error(error instanceof Error ? error.message : "Account action failed");
    } finally {
      setIsBusy(false);
    }
  };

  const loadPostDetail = async (postId: string) => {
    try {
      const data = await fetchJson<{ success: boolean; data: ArchivePost }>(`/api/archive/posts/${postId}`);
      setSelectedPost(data.data);
      await loadAuditLogs();
    } catch (error) {
      console.error("[Archive Detail Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to open archive post");
    }
  };

  const handleRecheckPost = async (post: ArchivePost) => {
    setIsBusy(true);
    try {
      await fetchJson(`/api/archive/posts/${post.id}/recheck`, { method: "POST" });
      toast.success("Status rechecked");
      await Promise.all([loadPosts(), loadDashboard(), loadPostDetail(post.id)]);
    } catch (error) {
      console.error("[Archive Recheck Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to recheck post");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeletePost = async (post: ArchivePost) => {
    setIsBusy(true);
    try {
      await fetchJson(`/api/archive/posts/${post.id}`, { method: "DELETE" });
      setSelectedPost(null);
      toast.success("Archive post deleted");
      await Promise.all([loadPosts(), loadDashboard(), loadAuditLogs()]);
    } catch (error) {
      console.error("[Archive Delete Error]:", error);
      toast.error(error instanceof Error ? error.message : "Unable to delete post");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#070a10] text-slate-100 selection:bg-cyan-300/20">
      <CommandCenterBackground />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]">
              <ArrowLeft className="size-4" />
              Command Center
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 text-4xl font-black tracking-normal text-white md:text-6xl"
            >
              Xiaohongshu Archive
            </motion.h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Low-frequency public content archive with accountable scans, R2 media retention, snapshots, and status checks.
            </p>
          </div>
          <Button
            type="button"
            onClick={loadAll}
            disabled={isLoading || isBusy}
            className="h-10 rounded-md bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </header>

        <nav className="mb-5 grid gap-2 sm:grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition",
                  activeTab === tab.value
                    ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50"
                    : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]",
                )}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {isLoading ? (
          <LoadingGrid />
        ) : (
          <>
            {activeTab === "dashboard" && dashboard && (
              <DashboardView dashboard={dashboard} onOpenPost={loadPostDetail} />
            )}
            {activeTab === "accounts" && (
              <AccountsView
                form={accountForm}
                setForm={setAccountForm}
                authProfileForm={authProfileForm}
                setAuthProfileForm={setAuthProfileForm}
                accounts={accounts}
                authProfiles={authProfiles}
                isBusy={isBusy}
                onSubmit={handleCreateAccount}
                onCreateAuthProfile={handleCreateAuthProfile}
                onStartAuthLogin={handleStartAuthLogin}
                onAction={handleAccountAction}
                onEdit={openEditAccount}
                onEnableAuthorizedWorker={handleEnableAuthorizedWorker}
              />
            )}
            {activeTab === "posts" && (
              <PostsView
                accounts={accountOptions}
                posts={posts}
                importUrl={importUrl}
                setImportUrl={setImportUrl}
                importAccountId={importAccountId}
                setImportAccountId={setImportAccountId}
                keyword={postKeyword}
                setKeyword={setPostKeyword}
                status={postStatus}
                setStatus={setPostStatus}
                accountId={postAccountId}
                setAccountId={setPostAccountId}
                isBusy={isBusy}
                onImport={handleImportPost}
                onOpenPost={loadPostDetail}
              />
            )}
            {activeTab === "audit" && (
              <AuditView logs={auditLogs} />
            )}
          </>
        )}
      </div>

      <PostDetailDialog
        post={selectedPost}
        isBusy={isBusy}
        onOpenChange={(open) => {
          if (!open) setSelectedPost(null);
        }}
        onRecheck={handleRecheckPost}
        onDelete={handleDeletePost}
      />
      <AccountEditDialog
        account={editingAccount}
        form={editAccountForm}
        setForm={setEditAccountForm}
        isBusy={isBusy}
        onSubmit={handleUpdateAccount}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null);
        }}
        authProfiles={authProfiles}
      />
      <AuthLoginDialog
        login={authLogin}
        isBusy={isBusy}
        phoneNumber={authPhoneNumber}
        onPhoneNumberChange={setAuthPhoneNumber}
        onRequestCode={handleRequestAuthSmsCode}
        verificationCode={authVerificationCode}
        onVerificationCodeChange={setAuthVerificationCode}
        onSubmitCode={handleSubmitAuthVerificationCode}
        onPoll={handlePollAuthLogin}
        onOpenChange={(open) => {
          if (!open) {
            setAuthLogin(null);
            setAuthPhoneNumber("");
            setAuthVerificationCode("");
          }
        }}
      />
    </main>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <CommandCenterSurface key={index} className="p-5">
          <Skeleton className="h-6 w-28 bg-white/10" />
          <Skeleton className="mt-6 h-24 w-full bg-white/10" />
        </CommandCenterSurface>
      ))}
    </div>
  );
}

function DashboardView({ dashboard, onOpenPost }: { dashboard: DashboardData; onOpenPost: (id: string) => void }) {
  const metrics = [
    { label: "Accounts", value: dashboard.accountCount, icon: Database },
    { label: "Active", value: dashboard.activeAccountCount, icon: CheckCircle2 },
    { label: "Posts", value: dashboard.postCount, icon: Archive },
    { label: "Today", value: dashboard.todayNewPostCount, icon: Plus },
    { label: "7 Days", value: dashboard.recentNewPostCount, icon: CalendarClock },
    { label: "Unavailable", value: dashboard.unavailablePostCount, icon: ShieldAlert },
    { label: "Failed Accounts", value: dashboard.failedAccountCount, icon: XCircle },
    { label: "Backlog", value: dashboard.queueBacklog, icon: RefreshCw },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <CommandCenterSurface className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Cloudflare Worker</h2>
              <p className="mt-1 text-sm text-slate-500">Cron, Browser Run budget, and latest heartbeat.</p>
            </div>
            <Cloud className="size-5 text-cyan-200" />
          </div>
          <div className="mt-4 grid gap-3">
            {dashboard.workerHeartbeats.length === 0 ? (
              <EmptyState label="No worker heartbeat yet" />
            ) : dashboard.workerHeartbeats.map((worker) => {
              const percent = worker.dailyBudgetSeconds > 0 ? Math.min(100, Math.round((worker.dailyUsedSeconds / worker.dailyBudgetSeconds) * 100)) : 0;
              return (
                <div key={worker.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-white">{worker.workerId}</p>
                    <StatusBadge status={worker.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{worker.workerUrl || "Worker URL not reported"}</p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                    <MiniStat label="Budget" value={`${worker.dailyUsedSeconds}/${worker.dailyBudgetSeconds}s`} />
                    <MiniStat label="Used" value={`${percent}%`} />
                    <MiniStat label="Last seen" value={formatDate(worker.lastSeenAt)} />
                  </div>
                  {worker.lastError && <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-2 text-xs text-amber-100">{worker.lastError}</p>}
                </div>
              );
            })}
          </div>
        </CommandCenterSurface>

        <CommandCenterSurface className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Authorized Users</h2>
              <p className="mt-1 text-sm text-slate-500">Cloudflare Browser Run login profiles.</p>
            </div>
            <KeyRound className="size-5 text-cyan-200" />
          </div>
          <div className="mt-4 grid gap-3">
            {dashboard.authProfiles.length === 0 ? (
              <EmptyState label="No auth profiles configured" />
            ) : dashboard.authProfiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-white">{profile.name}</p>
                  <StatusBadge status={profile.status} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                  <MiniStat label="Accounts" value={String(profile._count?.accounts ?? 0)} />
                  <MiniStat label="Verified" value={formatDate(profile.lastVerifiedAt)} />
                  <MiniStat label="Failure" value={profile.failureReason || "None"} />
                </div>
              </div>
            ))}
          </div>
        </CommandCenterSurface>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <CommandCenterSurface className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white">Latest archive posts</h2>
              <p className="mt-1 text-sm text-slate-500">Recently discovered public notes.</p>
            </div>
            <Badge className="border-white/10 bg-white/[0.06] text-slate-200" variant="outline">
              {formatBytes(dashboard.storageUsedBytes)}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {dashboard.latestPosts.length === 0 ? (
              <EmptyState label="No archive posts yet" />
            ) : dashboard.latestPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => onOpenPost(post.id)}
                className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10 md:grid-cols-[4.5rem_1fr_auto]"
              >
                <PostThumb post={post} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{post.title || post.contentText || "Untitled archive post"}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{post.contentText || post.originalUrl}</p>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <StatusBadge status={post.status} />
                  <span className="text-xs text-slate-500">{formatDate(post.firstSeenAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </CommandCenterSurface>

        <CommandCenterSurface className="p-5">
          <h2 className="text-xl font-black text-white">Recent scan failures</h2>
          <div className="mt-4 grid gap-3">
            {dashboard.failedScans.length === 0 ? (
              <EmptyState label="No failed scans" />
            ) : dashboard.failedScans.map((scan) => (
              <div key={scan.id} className="rounded-lg border border-rose-300/15 bg-rose-300/5 p-3">
                <p className="text-sm font-black text-rose-100">{getAccountLabel(scan.account)}</p>
                <p className="mt-1 text-xs leading-5 text-rose-100/70">{scan.errorMessage || scan.errorCode || "Unknown failure"}</p>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-normal text-slate-500">{formatDate(scan.createdAt)}</p>
              </div>
            ))}
          </div>
        </CommandCenterSurface>
      </div>
    </div>
  );
}

function AccountsView({
  form,
  setForm,
  authProfileForm,
  setAuthProfileForm,
  accounts,
  authProfiles,
  isBusy,
  onSubmit,
  onCreateAuthProfile,
  onStartAuthLogin,
  onAction,
  onEdit,
  onEnableAuthorizedWorker,
}: {
  form: typeof emptyAccountForm;
  setForm: (form: typeof emptyAccountForm) => void;
  authProfileForm: typeof emptyAuthProfileForm;
  setAuthProfileForm: (form: typeof emptyAuthProfileForm) => void;
  accounts: ArchiveAccount[];
  authProfiles: ArchiveAuthProfile[];
  isBusy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCreateAuthProfile: (event: React.FormEvent<HTMLFormElement>) => void;
  onStartAuthLogin: (profile: ArchiveAuthProfile) => void;
  onAction: (account: ArchiveAccount, action: "pause" | "resume" | "scan") => void;
  onEdit: (account: ArchiveAccount) => void;
  onEnableAuthorizedWorker: (account: ArchiveAccount) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-4">
      <CommandCenterSurface className="p-5">
        <h2 className="text-xl font-black text-white">Add public account</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Only public or authorized Xiaohongshu profile URLs are accepted. Public accounts are clamped to 600 seconds or slower.
          Vercel Cron only wakes the worker; this interval decides whether this account is due when the worker runs.
        </p>
        <form onSubmit={onSubmit} className="mt-5 grid gap-3">
          <Control label="Profile URL">
            <Input
              value={form.profileUrl}
              onChange={(event) => setForm({ ...form, profileUrl: event.target.value })}
              placeholder="https://www.xiaohongshu.com/user/profile/..."
              className="h-11 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
            />
          </Control>
          <Control label="Display name">
            <Input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Campaign, brand, or account label"
              className="h-11 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
            />
          </Control>
          <div className="grid gap-3 sm:grid-cols-2">
            <Control label="Account type">
              <select
                value={form.accountType}
                onChange={(event) => setForm({
                  ...form,
                  accountType: event.target.value,
                  scanIntervalSeconds: event.target.value === "public" ? "600" : "300",
                })}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
              >
                <option value="public">public</option>
                <option value="authorized">authorized</option>
                <option value="own">own</option>
              </select>
            </Control>
            <Control label="Scan interval (seconds)">
              <Input
                type="number"
                min={form.accountType === "public" ? 600 : 300}
                step={60}
                value={form.scanIntervalSeconds}
                onChange={(event) => setForm({ ...form, scanIntervalSeconds: event.target.value })}
                className="h-11 border-white/10 bg-black/25 text-white"
              />
            </Control>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Control label="Auth mode">
              <select
                value={form.authMode}
                onChange={(event) => setForm({
                  ...form,
                  authMode: event.target.value,
                  accountType: event.target.value === "authorized_browser" && form.accountType === "public" ? "authorized" : form.accountType,
                  scanIntervalSeconds: event.target.value === "authorized_browser" ? "300" : form.scanIntervalSeconds,
                })}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
              >
                <option value="public">public fetch</option>
                <option value="authorized_browser">Cloudflare authorized browser</option>
              </select>
            </Control>
            <Control label="Auth profile">
              <select
                value={form.authProfileId}
                onChange={(event) => setForm({ ...form, authProfileId: event.target.value })}
                disabled={form.authMode !== "authorized_browser"}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40 disabled:opacity-50"
              >
                <option value="">None</option>
                {authProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </Control>
          </div>
          <Control label="Remark">
            <textarea
              value={form.remark}
              onChange={(event) => setForm({ ...form, remark: event.target.value })}
              placeholder="Public archive purpose or operating note"
              className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </Control>
          <Button type="submit" disabled={isBusy || !form.profileUrl.trim()} className="h-11 rounded-md bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add account
          </Button>
        </form>
      </CommandCenterSurface>

      <CommandCenterSurface className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Cloudflare Auth Profiles</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Browser Run login state for own or authorized Xiaohongshu accounts.</p>
          </div>
          <Cloud className="size-5 text-cyan-200" />
        </div>
        <form onSubmit={onCreateAuthProfile} className="mt-4 grid gap-3">
          <Control label="Profile name">
            <Input
              value={authProfileForm.name}
              onChange={(event) => setAuthProfileForm({ ...authProfileForm, name: event.target.value })}
              className="h-11 border-white/10 bg-black/25 text-white"
            />
          </Control>
          <Control label="Worker URL">
            <Input
              value={authProfileForm.workerBaseUrl}
              onChange={(event) => setAuthProfileForm({ ...authProfileForm, workerBaseUrl: event.target.value })}
              placeholder="https://cleon-xhs-archive-worker.<subdomain>.workers.dev"
              className="h-11 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
            />
          </Control>
          <Button type="submit" disabled={isBusy} className="h-11 rounded-md bg-white text-slate-950 font-black hover:bg-cyan-100">
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Add auth profile
          </Button>
        </form>
        <div className="mt-4 grid gap-3">
          {authProfiles.length === 0 ? (
            <EmptyState label="No Cloudflare auth profiles" />
          ) : authProfiles.map((profile) => (
            <div key={profile.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-white">{profile.name}</p>
                    <StatusBadge status={profile.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{profile.workerBaseUrl || "Worker URL from env"}</p>
                </div>
                <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onStartAuthLogin(profile)} className="border-white/10 bg-white/[0.05] text-slate-100">
                  <QrCode className="size-3.5" />
                  Start Login
                </Button>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <MiniStat label="Accounts" value={String(profile._count?.accounts ?? profile.accounts?.length ?? 0)} />
                <MiniStat label="Verified" value={formatDate(profile.lastVerifiedAt)} />
                <MiniStat label="Failure" value={profile.failureReason || "None"} />
              </div>
            </div>
          ))}
        </div>
      </CommandCenterSurface>
      </div>

      <CommandCenterSurface className="p-5">
        <h2 className="text-xl font-black text-white">Managed accounts</h2>
        <div className="mt-4 grid gap-3">
          {accounts.length === 0 ? (
            <EmptyState label="No archive accounts yet" />
          ) : accounts.map((account) => (
            <div key={account.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black text-white">{getAccountLabel(account)}</h3>
                    <StatusBadge status={account.status} />
                    <Badge className="border-white/10 bg-white/[0.06] text-slate-300" variant="outline">{account.accountType}</Badge>
                    <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100" variant="outline">{account.authMode || "public"}</Badge>
                    {account.authStatus && account.authStatus !== "none" && <StatusBadge status={account.authStatus} />}
                  </div>
                  <p className="mt-2 truncate text-xs text-slate-500">{account.profileUrl}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onEdit(account)} className="border-white/10 bg-white/[0.05] text-slate-100">
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(account, "scan")} className="border-white/10 bg-white/[0.05] text-slate-100">
                    <RefreshCw className="size-3.5" />
                    Scan
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAction(account, account.scanEnabled ? "pause" : "resume")} className="border-white/10 bg-white/[0.05] text-slate-100">
                    {account.scanEnabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    {account.scanEnabled ? "Pause" : "Resume"}
                  </Button>
                  {account.status === "login_required" && account.authMode !== "authorized_browser" && (
                    <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onEnableAuthorizedWorker(account)} className="border-cyan-300/30 bg-cyan-300/10 text-cyan-50">
                      <Cloud className="size-3.5" />
                      Use Auth
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-4">
                <MiniStat label="Posts" value={String(account._count?.posts ?? 0)} />
                <MiniStat label="Interval" value={`${account.scanIntervalSeconds} sec`} />
                <MiniStat label="Last scan" value={formatDate(account.lastScannedAt)} />
                <MiniStat label="Failures" value={String(account.consecutiveFailures)} />
              </div>
              {account.authFailureReason && (
                <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">{account.authFailureReason}</p>
              )}
            </div>
          ))}
        </div>
      </CommandCenterSurface>
    </div>
  );
}

function PostsView({
  accounts,
  posts,
  importUrl,
  setImportUrl,
  importAccountId,
  setImportAccountId,
  keyword,
  setKeyword,
  status,
  setStatus,
  accountId,
  setAccountId,
  isBusy,
  onImport,
  onOpenPost,
}: {
  accounts: Array<{ id: string; label: string }>;
  posts: ArchivePost[];
  importUrl: string;
  setImportUrl: (value: string) => void;
  importAccountId: string;
  setImportAccountId: (value: string) => void;
  keyword: string;
  setKeyword: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  accountId: string;
  setAccountId: (value: string) => void;
  isBusy: boolean;
  onImport: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenPost: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <CommandCenterSurface className="p-5">
        <form onSubmit={onImport} className="grid gap-3 lg:grid-cols-[1fr_16rem_auto] lg:items-end">
          <Control label="Manual note URL">
            <Input
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder="Paste a public Xiaohongshu note URL"
              className="h-11 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
            />
          </Control>
          <Control label="Attach to account">
            <select
              value={importAccountId}
              onChange={(event) => setImportAccountId(event.target.value)}
              className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
            >
              <option value="">Manual import</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </select>
          </Control>
          <Button type="submit" disabled={isBusy || !importUrl.trim()} className="h-11 rounded-md bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
            Archive
          </Button>
        </form>
      </CommandCenterSurface>

      <CommandCenterSurface className="p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_12rem_16rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search title, content, author, or URL"
              className="h-11 border-white/10 bg-black/25 pl-9 text-white placeholder:text-slate-600"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
          >
            {postStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
          >
            <option value="all">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-5 grid gap-3">
          {posts.length === 0 ? (
            <EmptyState label="No archive posts match this filter" />
          ) : posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpenPost(post.id)}
              className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10 md:grid-cols-[5rem_1fr_auto]"
            >
              <PostThumb post={post} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-black text-white">{post.title || post.contentText || "Untitled archive post"}</p>
                  <StatusBadge status={post.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{post.contentText || post.originalUrl}</p>
                <p className="mt-2 truncate text-[11px] font-bold uppercase tracking-normal text-slate-600">{getAccountLabel(post.account)} · {post.authorName || "Unknown author"}</p>
              </div>
              <div className="grid gap-2 text-xs text-slate-500 md:justify-items-end">
                <span>{formatDate(post.firstSeenAt)}</span>
                <span>{post._count?.assets ?? post.assets?.length ?? 0} assets</span>
              </div>
            </button>
          ))}
        </div>
      </CommandCenterSurface>
    </div>
  );
}

function AuditView({ logs }: { logs: ArchiveAuditLog[] }) {
  return (
    <CommandCenterSurface className="p-5">
      <h2 className="text-xl font-black text-white">Audit logs</h2>
      <div className="mt-4 grid gap-3">
        {logs.length === 0 ? (
          <EmptyState label="No archive audit logs yet" />
        ) : logs.map((log) => (
          <div key={log.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-white">{log.action}</p>
              <span className="text-xs text-slate-500">{formatDate(log.createdAt)}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{log.targetType || "System"} {log.targetId ? `· ${log.targetId}` : ""}</p>
          </div>
        ))}
      </div>
    </CommandCenterSurface>
  );
}

function AccountEditDialog({
  account,
  form,
  setForm,
  isBusy,
  onSubmit,
  onOpenChange,
  authProfiles,
}: {
  account: ArchiveAccount | null;
  form: typeof emptyAccountForm;
  setForm: (form: typeof emptyAccountForm) => void;
  isBusy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenChange: (open: boolean) => void;
  authProfiles: ArchiveAuthProfile[];
}) {
  return (
    <Dialog open={Boolean(account)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="rounded-lg border-white/10 bg-[#0b0f17]/95 p-0 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-2xl">
        <form onSubmit={onSubmit} className="grid gap-4 p-5">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white">Edit archive account</DialogTitle>
            <DialogDescription className="text-slate-500">
              Change profile metadata and the per-account scan interval. Public accounts cannot scan faster than 600 seconds.
            </DialogDescription>
          </DialogHeader>

          <Control label="Profile URL">
            <Input
              value={form.profileUrl}
              onChange={(event) => setForm({ ...form, profileUrl: event.target.value })}
              className="h-11 border-white/10 bg-black/25 text-white"
            />
          </Control>
          <Control label="Display name">
            <Input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              className="h-11 border-white/10 bg-black/25 text-white"
            />
          </Control>
          <div className="grid gap-3 sm:grid-cols-2">
            <Control label="Account type">
              <select
                value={form.accountType}
                onChange={(event) => setForm({
                  ...form,
                  accountType: event.target.value,
                  scanIntervalSeconds: event.target.value === "public" ? "600" : "300",
                })}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
              >
                <option value="public">public</option>
                <option value="authorized">authorized</option>
                <option value="own">own</option>
              </select>
            </Control>
            <Control label="Scan interval (seconds)">
              <Input
                type="number"
                min={form.accountType === "public" ? 600 : 300}
                step={60}
                value={form.scanIntervalSeconds}
                onChange={(event) => setForm({ ...form, scanIntervalSeconds: event.target.value })}
                className="h-11 border-white/10 bg-black/25 text-white"
              />
            </Control>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Control label="Auth mode">
              <select
                value={form.authMode}
                onChange={(event) => setForm({
                  ...form,
                  authMode: event.target.value,
                  accountType: event.target.value === "authorized_browser" && form.accountType === "public" ? "authorized" : form.accountType,
                  scanIntervalSeconds: event.target.value === "authorized_browser" ? "300" : form.scanIntervalSeconds,
                })}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
              >
                <option value="public">public fetch</option>
                <option value="authorized_browser">Cloudflare authorized browser</option>
              </select>
            </Control>
            <Control label="Auth profile">
              <select
                value={form.authProfileId}
                onChange={(event) => setForm({ ...form, authProfileId: event.target.value })}
                disabled={form.authMode !== "authorized_browser"}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40 disabled:opacity-50"
              >
                <option value="">None</option>
                {authProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </Control>
          </div>
          <Control label="Remark">
            <textarea
              value={form.remark}
              onChange={(event) => setForm({ ...form, remark: event.target.value })}
              className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </Control>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.05] text-slate-100">
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy || !form.profileUrl.trim()} className="rounded-md bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AuthLoginDialog({
  login,
  isBusy,
  phoneNumber,
  onPhoneNumberChange,
  onRequestCode,
  verificationCode,
  onVerificationCodeChange,
  onSubmitCode,
  onPoll,
  onOpenChange,
}: {
  login: {
    profileId: string;
    sessionId: string;
    screenshotDataUrl?: string;
    status: string;
    message?: string;
  } | null;
  isBusy: boolean;
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  onRequestCode: () => void;
  verificationCode: string;
  onVerificationCodeChange: (value: string) => void;
  onSubmitCode: () => void;
  onPoll: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(login)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="rounded-lg border-white/10 bg-[#0b0f17]/95 p-0 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-lg">
        {login && (
          <div className="grid gap-4 p-5">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white">Cloudflare Login</DialogTitle>
              <DialogDescription className="text-slate-500">
                Scan or complete the Xiaohongshu login shown in the Browser Run screenshot, then poll status.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
              {login.screenshotDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={login.screenshotDataUrl} alt="Cloudflare Xiaohongshu login session" className="mx-auto max-h-[560px] w-full object-contain" />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-slate-500">No screenshot yet</div>
              )}
            </div>
            <div className="grid gap-2 text-xs text-slate-500">
              <MiniStat label="Session" value={login.sessionId} />
              <MiniStat label="Status" value={login.status} />
              <MiniStat label="Message" value={login.message || "Waiting"} />
            </div>
            <form
              className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                onRequestCode();
              }}
            >
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-slate-500">Phone SMS login</p>
                <p className="mt-1 text-xs text-slate-500">Use this when QR login asks for an SMS check outside the Browser Run page.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={phoneNumber}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={15}
                  placeholder="Phone number"
                  disabled={isBusy}
                  onChange={(event) => onPhoneNumberChange(event.target.value.replace(/\D/g, "").slice(0, 15))}
                  className="h-11 border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-600"
                />
                <Button
                  type="submit"
                  disabled={isBusy || phoneNumber.replace(/\D/g, "").length < 8}
                  className="h-11 rounded-md bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"
                >
                  {isBusy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Send code
                </Button>
              </div>
            </form>
            <form
              className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitCode();
              }}
            >
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-slate-500">SMS verification code</p>
                <p className="mt-1 text-xs text-slate-500">Use this after the Browser Run page has requested a phone verification code.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={verificationCode}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="Enter code"
                  disabled={isBusy}
                  onChange={(event) => onVerificationCodeChange(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="h-11 border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-600"
                />
                <Button
                  type="submit"
                  disabled={isBusy || verificationCode.replace(/\D/g, "").length < 4}
                  className="h-11 rounded-md bg-amber-300 font-black text-slate-950 hover:bg-amber-200"
                >
                  {isBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Submit code
                </Button>
              </div>
            </form>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={isBusy} onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.05] text-slate-100">
                Close
              </Button>
              <Button type="button" disabled={isBusy} onClick={onPoll} className="rounded-md bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Poll status
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PostDetailDialog({
  post,
  isBusy,
  onOpenChange,
  onRecheck,
  onDelete,
}: {
  post: ArchivePost | null;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onRecheck: (post: ArchivePost) => void;
  onDelete: (post: ArchivePost) => void;
}) {
  const assets = post?.assets?.filter((asset) => asset.downloadStatus === "success" && asset.storageUrl) ?? [];

  return (
    <Dialog open={Boolean(post)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[90vh] overflow-hidden rounded-lg border-white/10 bg-[#0b0f17]/95 p-0 text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:max-w-5xl">
        {post && (
          <ScrollArea className="max-h-[90vh]">
            <div className="p-5 md:p-6">
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-4 pr-8">
                  <div className="min-w-0">
                    <DialogTitle className="text-2xl font-black leading-tight text-white">
                      {post.title || post.contentText || "Untitled archive post"}
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-slate-500">
                      {getAccountLabel(post.account)} · {post.authorName || "Unknown author"} · {formatDate(post.firstSeenAt)}
                    </DialogDescription>
                  </div>
                  <StatusBadge status={post.status} />
                </div>
              </DialogHeader>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={isBusy} onClick={() => onRecheck(post)} className="border-white/10 bg-white/[0.05] text-slate-100">
                  {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Recheck
                </Button>
                <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.05] text-slate-100" onClick={() => window.open(post.originalUrl, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="size-3.5" />
                  Source
                </Button>
                <Button variant="destructive" size="sm" disabled={isBusy} onClick={() => onDelete(post)}>
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.75fr]">
                <section className="grid gap-4">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="text-sm font-black uppercase tracking-normal text-slate-400">Content</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">{post.contentText || "No text captured."}</p>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="text-sm font-black uppercase tracking-normal text-slate-400">Images</h3>
                    {assets.length === 0 ? (
                      <EmptyState label="No stored images" />
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {assets.map((asset) => (
                          <a key={asset.id} href={asset.storageUrl || asset.sourceUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={asset.storageUrl || asset.sourceUrl} alt="" className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                            <div className="p-2 text-[11px] text-slate-500">
                              {asset.mimeType || "image"} · {asset.sizeBytes ? formatBytes(asset.sizeBytes) : "unknown size"}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <aside className="grid gap-4">
                  <TimelinePanel title="Snapshot history" items={post.snapshots || []} />
                  <StatusPanel events={post.statusEvents || []} />
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="text-sm font-black uppercase tracking-normal text-slate-400">Metadata</h3>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500">
                      <MiniStat label="Archived" value={formatDate(post.archivedAt)} />
                      <MiniStat label="Last seen" value={formatDate(post.lastSeenAt)} />
                      <MiniStat label="Last checked" value={formatDate(post.lastCheckedAt)} />
                      <MiniStat label="Note ID" value={post.platformNoteId || "Unknown"} />
                    </div>
                    {post.archiveError && (
                      <p className="mt-3 rounded-md border border-rose-300/20 bg-rose-300/10 p-3 text-xs leading-5 text-rose-100">{post.archiveError}</p>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TimelinePanel({ title, items }: { title: string; items: ArchiveSnapshot[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-black uppercase tracking-normal text-slate-400">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-600">No snapshots.</p>
        ) : items.slice(0, 8).map((snapshot) => (
          <div key={snapshot.id} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
            <p className="text-xs font-black text-white">{snapshot.triggerType}</p>
            <p className="mt-1 text-[11px] text-slate-500">{formatDate(snapshot.capturedAt)} · {snapshot.status || "unknown"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPanel({ events }: { events: ArchiveStatusEvent[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-black uppercase tracking-normal text-slate-400">Status events</h3>
      <div className="mt-3 grid gap-2">
        {events.length === 0 ? (
          <p className="text-xs text-slate-600">No status changes.</p>
        ) : events.slice(0, 8).map((event) => (
          <div key={event.id} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
            <p className="text-xs font-black text-white">{event.oldStatus || "unknown"}{" -> "}{event.newStatus}</p>
            <p className="mt-1 text-[11px] text-slate-500">{formatDate(event.checkedAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <CommandCenterSurface className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-cyan-300/10 text-cyan-100">
          <Icon className="size-5" />
        </span>
        <p className="text-3xl font-black text-white">{value}</p>
      </div>
      <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
    </CommandCenterSurface>
  );
}

function PostThumb({ post }: { post: ArchivePost }) {
  const imageUrl = post.coverStorageUrl || post.assets?.find((asset) => asset.storageUrl)?.storageUrl;
  return (
    <div className="grid aspect-square size-20 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] text-slate-500 md:size-[4.5rem]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="size-5" />
      )}
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-300">{value}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm font-bold text-slate-500">
      {label}
    </div>
  );
}
