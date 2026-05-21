"use client";

import type { FormEvent } from "react";
import { startTransition, useEffect, useRef, useState } from "react";

import { baseTabs, initialAdminForm, initialDiskForm, storageKey } from "../features/dashboard/constants";
import { AdminDisksSection } from "../features/dashboard/components/AdminDisksSection";
import { AdminMonitoringSection } from "../features/dashboard/components/AdminMonitoringSection";
import { AdminUsersSection } from "../features/dashboard/components/AdminUsersSection";
import {
  AdminUserModal,
  CreateDiskModal,
  DeleteDiskModal,
  IscsiAccessModal
} from "../features/dashboard/components/DashboardModals";
import { LoadingScreen, LoginScreen } from "../features/dashboard/components/LoginScreen";
import { OverviewSection } from "../features/dashboard/components/OverviewSection";
import { DisksSection } from "../features/dashboard/components/DisksSection";
import { Sidebar } from "../features/dashboard/components/Sidebar";
import { ToastPortal } from "../features/dashboard/components/ToastPortal";
import { readStoredSession } from "../features/dashboard/utils";
import type {
  AdminFormState,
  AdminSection,
  AdminUser,
  DiskCreateResponse,
  DiskFormState,
  DiskSummary,
  MonitoringHistoryPoint,
  MonitoringSnapshot,
  SessionState,
  StageOutput,
  TabId,
  ToastKind,
  ToastState,
  TokenPayload,
  UserProfile,
  WorkflowResponse
} from "../features/dashboard/types";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSection>("disks");
  const [session, setSession] = useState<SessionState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [disks, setDisks] = useState<DiskSummary[]>([]);
  const [monitoringSnapshot, setMonitoringSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [monitoringHistory, setMonitoringHistory] = useState<MonitoringHistoryPoint[]>([]);
  const [isMonitoringLoading, setIsMonitoringLoading] = useState(false);
  const [adminMonitoringSnapshot, setAdminMonitoringSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [adminMonitoringHistory, setAdminMonitoringHistory] = useState<MonitoringHistoryPoint[]>([]);
  const [isAdminMonitoringLoading, setIsAdminMonitoringLoading] = useState(false);
  const [isDiskListLoading, setIsDiskListLoading] = useState(false);
  const [isCreatingDisk, setIsCreatingDisk] = useState(false);
  const [deletingDiskId, setDeletingDiskId] = useState<string | null>(null);
  const [diskPendingDeleteId, setDiskPendingDeleteId] = useState<string | null>(null);
  const [diskRequestId, setDiskRequestId] = useState<string | null>(null);
  const [createdDiskId, setCreatedDiskId] = useState<string | null>(null);
  const [diskUpdates, setDiskUpdates] = useState<StageOutput[]>([]);
  const [isDiskComplete, setIsDiskComplete] = useState(false);
  const [diskForm, setDiskForm] = useState<DiskFormState>(initialDiskForm);
  const [isCreateDiskModalOpen, setIsCreateDiskModalOpen] = useState(false);
  const [isIscsiModalOpen, setIsIscsiModalOpen] = useState(false);
  const [selectedDiskId, setSelectedDiskId] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isAdminUsersLoading, setIsAdminUsersLoading] = useState(false);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [adminDisks, setAdminDisks] = useState<DiskSummary[]>([]);
  const [isAdminDisksLoading, setIsAdminDisksLoading] = useState(false);
  const [adminDiskActionId, setAdminDiskActionId] = useState<string | null>(null);
  const [adminDiskOwnerDrafts, setAdminDiskOwnerDrafts] = useState<Record<string, string>>({});
  const [editingAdminUserId, setEditingAdminUserId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState<AdminFormState>(initialAdminForm);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!session?.accessToken) {
      setDisks([]);
      setMonitoringSnapshot(null);
      setMonitoringHistory([]);
      setAdminMonitoringSnapshot(null);
      setAdminMonitoringHistory([]);
      return;
    }

    void fetchDisks(session.accessToken);
    void fetchMonitoring(session.accessToken);
  }, [session?.accessToken]);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchMonitoring(session.accessToken);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [session?.accessToken]);

  useEffect(() => {
    if (!diskRequestId || isDiskComplete || !session?.accessToken) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/request/${diskRequestId}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as WorkflowResponse;
      setDiskUpdates(data.updates);
      setIsDiskComplete(data.complete);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [diskRequestId, isDiskComplete, session?.accessToken]);

  useEffect(() => {
    if (!isDiskComplete || !session?.accessToken) {
      return;
    }

    void fetchDisks(session.accessToken);
  }, [isDiskComplete, session?.accessToken]);

  useEffect(() => {
    if (!isCreateDiskModalOpen && !isIscsiModalOpen && !isAdminModalOpen && !diskPendingDeleteId) {
      return;
    }

    const { overflow } = document.body.style;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isAdminModalOpen) {
          setIsAdminModalOpen(false);
          return;
        }

        if (isIscsiModalOpen) {
          setIsIscsiModalOpen(false);
          return;
        }

        if (diskPendingDeleteId) {
          if (deletingDiskId) {
            return;
          }

          setDiskPendingDeleteId(null);
          return;
        }

        setIsCreateDiskModalOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    deletingDiskId,
    diskPendingDeleteId,
    isAdminModalOpen,
    isCreateDiskModalOpen,
    isIscsiModalOpen
  ]);

  useEffect(() => {
    if (disks.length === 0) {
      setSelectedDiskId(null);
      return;
    }

    if (selectedDiskId && disks.some((disk) => disk.disk_id === selectedDiskId)) {
      return;
    }

    setSelectedDiskId(disks[0]?.disk_id ?? null);
  }, [disks, selectedDiskId]);

  useEffect(() => {
    if (!isSidebarMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!sidebarMenuRef.current?.contains(event.target as Node)) {
        setIsSidebarMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarMenuOpen]);

  const isAdmin = Boolean(
    session &&
      (profile?.is_admin ||
        profile?.groups?.some((group) => group.replace(/^\//, "") === "Admin") ||
        profile?.realm_roles?.some((role) => role.toLowerCase() === "admin") ||
        profile?.client_roles?.some((role) =>
          ["admin", "manage-users", "query-users", "view-users"].includes(role.toLowerCase())
        ))
  );

  useEffect(() => {
    if (!isAdminPanelOpen || !session?.accessToken || !isAdmin) {
      return;
    }

    void fetchAdminUsers(session.accessToken);
    void fetchAdminDisks(session.accessToken);
  }, [isAdmin, isAdminPanelOpen, session?.accessToken]);

  useEffect(() => {
    if (!session?.accessToken || !isAdmin || !isAdminPanelOpen || activeAdminSection !== "monitoring") {
      return;
    }

    void fetchAdminMonitoring(session.accessToken);

    const intervalId = window.setInterval(() => {
      void fetchAdminMonitoring(session.accessToken);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [activeAdminSection, isAdmin, isAdminPanelOpen, session?.accessToken]);

  useEffect(() => {
    if (isAdmin || !isAdminPanelOpen) {
      return;
    }

    setIsAdminPanelOpen(false);
    setActiveAdminSection("disks");
  }, [isAdmin, isAdminPanelOpen]);

  function clearToast() {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    setToast(null);
  }

  function showToast(kind: ToastKind, message: string) {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    const nextToast = {
      id: Date.now(),
      kind,
      message
    };

    setToast(nextToast);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === nextToast.id ? null : current));
      toastTimeoutRef.current = null;
    }, 5000);
  }

  async function restoreSession() {
    setIsAuthLoading(true);

    const stored = readStoredSession();
    if (!stored?.accessToken) {
      clearSessionState();
      setIsAuthLoading(false);
      return;
    }

    const valid = await hydrateProfile(stored.accessToken);
    if (valid) {
      setSession(stored);
      setIsAuthLoading(false);
      return;
    }

    clearSessionState();
    showToast("error", "Сессия истекла");
    setIsAuthLoading(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);
    clearToast();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ username, password }),
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Не удалось авторизоваться через Keycloak");
      }

      const tokens = (await response.json()) as TokenPayload;
      const nextSession = storeSession(tokens);
      const valid = await hydrateProfile(nextSession.accessToken);

      if (!valid) {
        throw new Error("Не удалось получить профиль пользователя");
      }

      setSession(nextSession);
      setPassword("");
      setActiveTab("overview");
    } catch (requestError) {
      clearSessionState();
      showToast("error", requestError instanceof Error ? requestError.message : "Ошибка входа");
    } finally {
      setIsSubmittingAuth(false);
      setIsAuthLoading(false);
    }
  }

  async function handleCreateDisk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) {
      showToast("error", "Сначала войдите");
      return;
    }

    setIsCreatingDisk(true);
    clearToast();
    setDiskRequestId(null);
    setDiskUpdates([]);
    setIsDiskComplete(false);
    setCreatedDiskId(null);

    try {
      const sizeGb = Number(diskForm.sizeGb);
      if (!Number.isFinite(sizeGb) || sizeGb <= 0) {
        throw new Error("Размер диска должен быть положительным числом");
      }

      const response = await fetch("/api/disks", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: diskForm.name.trim(),
          size_gb: sizeGb,
          filesystem: diskForm.filesystem,
          performance_tier: diskForm.performanceTier
        }),
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (!response.ok) {
        throw new Error("Не удалось создать диск");
      }

      const data = (await response.json()) as DiskCreateResponse;
      setDiskRequestId(data.request_id);
      setCreatedDiskId(data.disk_id);
      showToast("success", "Диск создан");
      setIsCreateDiskModalOpen(false);
      await fetchDisks(session.accessToken);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Ошибка создания диска"
      );
    } finally {
      setIsCreatingDisk(false);
    }
  }

  async function hydrateProfile(accessToken: string) {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      });

      if (!response.ok) {
        setProfile(null);
        return false;
      }

      const user = (await response.json()) as UserProfile;
      setProfile(user);
      return true;
    } catch {
      setProfile(null);
      return false;
    }
  }

  async function fetchDisks(accessToken: string) {
    setIsDiskListLoading(true);

    try {
      const response = await fetch("/api/disks", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Не удалось загрузить список дисков");
      }

      const items = (await response.json()) as DiskSummary[];
      setDisks(items);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Не удалось загрузить диски"
      );
    } finally {
      setIsDiskListLoading(false);
    }
  }

  async function fetchMonitoring(accessToken: string) {
    setIsMonitoringLoading(true);

    try {
      const response = await fetch("/api/monitoring", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (!response.ok) {
        throw new Error("Не удалось загрузить monitoring snapshot.");
      }

      const snapshot = (await response.json()) as MonitoringSnapshot;

      startTransition(() => {
        setMonitoringSnapshot(snapshot);
        setMonitoringHistory((current) => {
          const nextPoint = {
            timestamp: snapshot.generated_at_ms,
            throughput_bytes_per_sec: snapshot.system.throughput_bytes_per_sec,
            total_iops: snapshot.system.total_iops,
            busy_percent: snapshot.system.peak_busy_percent
          };
          const withoutDuplicate = current.filter((point) => point.timestamp !== nextPoint.timestamp);

          return [...withoutDuplicate, nextPoint].slice(-18);
        });
      });
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message.includes("Сессия")) {
        showToast("error", requestError.message);
      }
    } finally {
      setIsMonitoringLoading(false);
    }
  }

  async function fetchAdminMonitoring(accessToken: string) {
    setIsAdminMonitoringLoading(true);

    try {
      const response = await fetch("/api/admin/monitoring", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Недостаточно прав для monitoring.");
      }

      if (!response.ok) {
        throw new Error("Не удалось загрузить admin monitoring snapshot.");
      }

      const snapshot = (await response.json()) as MonitoringSnapshot;

      startTransition(() => {
        setAdminMonitoringSnapshot(snapshot);
        setAdminMonitoringHistory((current) => {
          const nextPoint = {
            timestamp: snapshot.generated_at_ms,
            throughput_bytes_per_sec: snapshot.system.throughput_bytes_per_sec,
            total_iops: snapshot.system.total_iops,
            busy_percent: snapshot.system.peak_busy_percent
          };
          const withoutDuplicate = current.filter((point) => point.timestamp !== nextPoint.timestamp);

          return [...withoutDuplicate, nextPoint].slice(-18);
        });
      });
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message.includes("Сессия")) {
        showToast("error", requestError.message);
      }
    } finally {
      setIsAdminMonitoringLoading(false);
    }
  }

  async function handleDeleteDisk(diskId: string) {
    if (!session?.accessToken) {
      showToast("error", "Сначала войдите");
      return;
    }

    setDeletingDiskId(diskId);
    clearToast();

    try {
      const response = await fetch("/api/disks", {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ disk_id: diskId }),
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Удалять можно только диски, запрошенные текущим пользователем.");
      }

      if (response.status === 404) {
        throw new Error("Диск не найден или уже удалён.");
      }

      if (response.status === 409) {
        throw new Error("Удаление этого диска уже завершено или недоступно.");
      }

      if (!response.ok) {
        throw new Error("Не удалось удалить диск.");
      }

      const data = (await response.json()) as DiskCreateResponse;

      if (createdDiskId === diskId) {
        setCreatedDiskId(null);
      }

      setDiskRequestId(data.request_id);
      setDiskUpdates([]);
      setIsDiskComplete(false);
      showToast("success", "Диск удалён");
      await fetchDisks(session.accessToken);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Ошибка удаления диска"
      );
    } finally {
      setDeletingDiskId(null);
    }
  }

  async function fetchAdminUsers(accessToken: string) {
    setIsAdminUsersLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Недостаточно прав для доступа к админ-панели.");
      }

      if (!response.ok) {
        throw new Error("Не удалось загрузить пользователей.");
      }

      const users = (await response.json()) as AdminUser[];
      setAdminUsers(users);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Не удалось загрузить пользователей"
      );
    } finally {
      setIsAdminUsersLoading(false);
    }
  }

  async function fetchAdminDisks(accessToken: string) {
    setIsAdminDisksLoading(true);

    try {
      const response = await fetch("/api/admin/disks", {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Недостаточно прав для доступа к дискам.");
      }

      if (!response.ok) {
        throw new Error("Не удалось загрузить все диски.");
      }

      const items = (await response.json()) as DiskSummary[];
      setAdminDisks(items);
      setAdminDiskOwnerDrafts((current) => {
        const next = { ...current };

        for (const disk of items) {
          next[disk.disk_id] = current[disk.disk_id] ?? disk.owner_sub ?? "";
        }

        return next;
      });
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Не удалось загрузить все диски"
      );
    } finally {
      setIsAdminDisksLoading(false);
    }
  }

  async function handleAdminDeleteDisk(disk: DiskSummary) {
    if (!session?.accessToken) {
      showToast("error", "Сначала войдите");
      return;
    }

    setAdminDiskActionId(disk.disk_id);
    clearToast();

    try {
      const response = await fetch("/api/admin/disks", {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          disk_id: disk.disk_id,
          owner_sub: disk.owner_sub
        }),
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Недостаточно прав для удаления диска.");
      }

      if (!response.ok) {
        throw new Error("Не удалось удалить диск.");
      }

      showToast("success", "Диск удалён");
      await fetchAdminDisks(session.accessToken);
      await fetchDisks(session.accessToken);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Ошибка удаления диска"
      );
    } finally {
      setAdminDiskActionId(null);
    }
  }

  async function handleAdminTransferDisk(disk: DiskSummary) {
    if (!session?.accessToken) {
      showToast("error", "Сначала войдите");
      return;
    }

    const nextOwnerSub = adminDiskOwnerDrafts[disk.disk_id]?.trim();
    if (!nextOwnerSub) {
      showToast("error", "Выберите владельца");
      return;
    }

    if (nextOwnerSub === disk.owner_sub) {
      showToast("error", "Владелец не изменился");
      return;
    }

    const nextOwner = adminUsers.find((user) => user.id === nextOwnerSub);
    if (!nextOwner) {
      showToast("error", "Пользователь не найден");
      return;
    }

    const nextOwnerDisplay =
      [nextOwner.first_name, nextOwner.last_name].filter(Boolean).join(" ") ||
      nextOwner.username ||
      nextOwner.email ||
      nextOwner.id;

    setAdminDiskActionId(disk.disk_id);
    clearToast();

    try {
      const response = await fetch("/api/admin/disks", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          disk_id: disk.disk_id,
          owner_sub: nextOwner.id,
          owner_display: nextOwnerDisplay
        }),
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Недостаточно прав для изменения владельца.");
      }

      if (!response.ok) {
        throw new Error("Не удалось изменить владельца.");
      }

      showToast("success", "Владелец изменён");
      await fetchAdminDisks(session.accessToken);
      await fetchDisks(session.accessToken);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Ошибка смены владельца"
      );
    } finally {
      setAdminDiskActionId(null);
    }
  }

  async function handleAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) {
      showToast("error", "Сначала войдите");
      return;
    }

    setIsAdminSaving(true);
    clearToast();

    try {
      const payload = {
        username: adminForm.username.trim(),
        email: adminForm.email.trim() || null,
        first_name: adminForm.firstName.trim() || null,
        last_name: adminForm.lastName.trim() || null,
        enabled: adminForm.enabled,
        password: adminForm.password,
        is_admin: adminForm.isAdmin
      };

      if (!payload.username) {
        throw new Error("Username обязателен.");
      }

      if (!editingAdminUserId && !payload.password.trim()) {
        throw new Error("Для нового пользователя нужен пароль.");
      }

      const response = await fetch(
        editingAdminUserId ? `/api/admin/users/${editingAdminUserId}` : "/api/admin/users",
        {
          method: editingAdminUserId ? "PUT" : "POST",
          headers: {
            authorization: `Bearer ${session.accessToken}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(payload),
          cache: "no-store"
        }
      );

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Недостаточно прав для изменения пользователей.");
      }

      if (!response.ok) {
        throw new Error(
          editingAdminUserId ? "Не удалось обновить пользователя." : "Не удалось создать пользователя."
        );
      }

      resetAdminForm();
      showToast("success", editingAdminUserId ? "Пользователь обновлён" : "Пользователь создан");
      setIsAdminModalOpen(false);
      await fetchAdminUsers(session.accessToken);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Не удалось сохранить пользователя"
      );
    } finally {
      setIsAdminSaving(false);
    }
  }

  async function handleDeleteAdminUser(userId: string) {
    if (!session?.accessToken) {
      showToast("error", "Сначала войдите");
      return;
    }

    setIsAdminSaving(true);
    clearToast();

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${session.accessToken}`
        },
        cache: "no-store"
      });

      if (response.status === 401) {
        clearSessionState();
        throw new Error("Сессия больше не действительна. Войдите снова.");
      }

      if (response.status === 403) {
        throw new Error("Недостаточно прав для удаления пользователя.");
      }

      if (!response.ok) {
        throw new Error("Не удалось удалить пользователя.");
      }

      if (editingAdminUserId === userId) {
        resetAdminForm();
      }

      showToast("success", "Пользователь удалён");
      await fetchAdminUsers(session.accessToken);
    } catch (requestError) {
      showToast(
        "error",
        requestError instanceof Error ? requestError.message : "Не удалось удалить пользователя"
      );
    } finally {
      setIsAdminSaving(false);
    }
  }

  function startEditAdminUser(user: AdminUser) {
    setEditingAdminUserId(user.id);
    clearToast();
    setIsAdminModalOpen(true);
    setAdminForm({
      username: user.username,
      email: user.email ?? "",
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
      password: "",
      enabled: user.enabled,
      isAdmin: user.is_admin
    });
  }

  function resetAdminForm() {
    setEditingAdminUserId(null);
    setAdminForm(initialAdminForm);
  }

  function storeSession(tokens: TokenPayload): SessionState {
    const nextSession = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null
    };

    localStorage.setItem(storageKey, JSON.stringify(nextSession));
    setSession(nextSession);

    return nextSession;
  }

  function clearSessionState() {
    localStorage.removeItem(storageKey);
    setSession(null);
    setProfile(null);
    setMonitoringSnapshot(null);
    setMonitoringHistory([]);
    setAdminMonitoringSnapshot(null);
    setAdminMonitoringHistory([]);
    setIsAdminPanelOpen(false);
    setActiveAdminSection("disks");
    setAdminUsers([]);
    setAdminDisks([]);
    setAdminDiskOwnerDrafts({});
    setAdminDiskActionId(null);
  }

  function handleLogout() {
    setIsSidebarMenuOpen(false);
    setIsAdminPanelOpen(false);
    setActiveAdminSection("disks");
    clearSessionState();
    setUsername("");
    setPassword("");
    clearToast();
    setDiskRequestId(null);
    setDiskUpdates([]);
    setIsDiskComplete(false);
    setCreatedDiskId(null);
    setDisks([]);
    setMonitoringSnapshot(null);
    setMonitoringHistory([]);
    setAdminMonitoringSnapshot(null);
    setAdminMonitoringHistory([]);
    setAdminUsers([]);
    setAdminDisks([]);
    setAdminDiskOwnerDrafts({});
    setAdminDiskActionId(null);
    setIsAdminModalOpen(false);
    resetAdminForm();
    setActiveTab("overview");
  }

  function handleTabChange(tab: TabId) {
    setIsAdminPanelOpen(false);
    setActiveAdminSection("disks");
    setActiveTab(tab);
  }

  function handleSidebarBack() {
    setIsAdminPanelOpen(false);
    setActiveAdminSection("disks");
    setActiveTab("overview");
  }

  function handleOpenAdminPanel() {
    setIsSidebarMenuOpen(false);
    setIsAdminPanelOpen(true);
    setActiveAdminSection("disks");
  }

  function handleOpenDisk(diskId: string) {
    setSelectedDiskId(diskId);
    setIsIscsiModalOpen(true);
  }

  function handleCreateUser() {
    resetAdminForm();
    clearToast();
    setIsAdminModalOpen(true);
  }

  const selectedDisk = disks.find((disk) => disk.disk_id === selectedDiskId) ?? null;
  const displayName = profile?.name ?? profile?.preferred_username ?? profile?.email ?? "unknown";
  const issuedDisks = monitoringSnapshot?.logical_disks ?? [];
  const activeDisks = issuedDisks.length;
  const pendingDisks = disks.filter(
    (disk) => disk.status !== "ready" || disk.iscsi_status !== "ready"
  ).length;
  const inventoryTotalDiskSize = disks.reduce((total, disk) => total + disk.size_gb, 0);
  const totalDiskSize = issuedDisks.reduce((total, disk) => total + disk.size_gb, 0);
  const adminTotalDiskSize = adminDisks.reduce((total, disk) => total + disk.size_gb, 0);
  const enabledAdminUsers = adminUsers.filter((user) => user.enabled).length;
  const adminCount = adminUsers.filter((user) => user.is_admin).length;
  const userMeta = profile?.email ?? profile?.preferred_username ?? "Профиль загружен";

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <>
        <LoginScreen
          isSubmittingAuth={isSubmittingAuth}
          username={username}
          password={password}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
        />
        <ToastPortal toast={toast} />
      </>
    );
  }

  return (
    <>
      <main className="dashboard">
        <Sidebar
          activeTab={activeTab}
          activeAdminSection={activeAdminSection}
          isAdmin={isAdmin}
          isAdminPanelOpen={isAdminPanelOpen}
          isSidebarMenuOpen={isSidebarMenuOpen}
          sidebarMenuRef={sidebarMenuRef}
          baseTabs={baseTabs}
          onAdminSectionChange={setActiveAdminSection}
          onOpenAdminPanel={handleOpenAdminPanel}
          onSidebarMenuToggle={() => setIsSidebarMenuOpen((current) => !current)}
          onTabChange={handleTabChange}
          onBack={handleSidebarBack}
          onLogout={handleLogout}
        />

        <section
          className={`workspace ${
            activeTab === "disks" || isAdminPanelOpen ? "workspaceDisks" : ""
          }`}
        >
          {!isAdminPanelOpen && activeTab !== "disks" ? (
            <header className="topbar">
              <div className="topbarActions">
                <div className="badge">
                  <span className="badgeDot" />
                  Доступ открыт
                </div>
                {activeTab === "overview" ? (
                  <button className="action" onClick={() => setActiveTab("disks")}>
                    К дискам
                  </button>
                ) : null}
              </div>
            </header>
          ) : null}

          {!isAdminPanelOpen && activeTab === "overview" ? (
            <OverviewSection
              activeDisks={activeDisks}
              displayName={displayName}
              isAdmin={isAdmin}
              isLoading={isMonitoringLoading}
              monitoringHistory={monitoringHistory}
              monitoringSnapshot={monitoringSnapshot}
              totalDiskSize={totalDiskSize}
              userMeta={userMeta}
              onOpenDisks={() => setActiveTab("disks")}
            />
          ) : null}

          {!isAdminPanelOpen && activeTab === "disks" ? (
            <DisksSection
              deletingDiskId={deletingDiskId}
              diskRequestId={diskRequestId}
              disks={disks}
              isDiskComplete={isDiskComplete}
              isDiskListLoading={isDiskListLoading}
              pendingDisks={pendingDisks}
              selectedDiskId={selectedDiskId}
              totalDiskSize={inventoryTotalDiskSize}
              onCreateDisk={() => setIsCreateDiskModalOpen(true)}
              onDeleteDiskRequest={setDiskPendingDeleteId}
              onOpenDisk={handleOpenDisk}
            />
          ) : null}

          {isAdminPanelOpen && isAdmin && activeAdminSection === "disks" ? (
            <AdminDisksSection
              adminDiskActionId={adminDiskActionId}
              adminDiskOwnerDrafts={adminDiskOwnerDrafts}
              adminDisks={adminDisks}
              adminTotalDiskSize={adminTotalDiskSize}
              adminUsers={adminUsers}
              isAdminDisksLoading={isAdminDisksLoading}
              isAdminUsersLoading={isAdminUsersLoading}
              onDeleteDisk={(disk) => void handleAdminDeleteDisk(disk)}
              onOwnerDraftChange={(diskId, ownerId) =>
                setAdminDiskOwnerDrafts((current) => ({
                  ...current,
                  [diskId]: ownerId
                }))
              }
              onTransferDisk={(disk) => void handleAdminTransferDisk(disk)}
            />
          ) : null}

          {isAdminPanelOpen && isAdmin && activeAdminSection === "users" ? (
            <AdminUsersSection
              adminCount={adminCount}
              adminUsers={adminUsers}
              enabledAdminUsers={enabledAdminUsers}
              isAdminSaving={isAdminSaving}
              isAdminUsersLoading={isAdminUsersLoading}
              onCreateUser={handleCreateUser}
              onDeleteUser={(userId) => void handleDeleteAdminUser(userId)}
              onEditUser={startEditAdminUser}
            />
          ) : null}

          {isAdminPanelOpen && isAdmin && activeAdminSection === "monitoring" ? (
            <AdminMonitoringSection
              isLoading={isAdminMonitoringLoading}
              monitoringHistory={adminMonitoringHistory}
              monitoringSnapshot={adminMonitoringSnapshot}
            />
          ) : null}
        </section>

        <CreateDiskModal
          diskForm={diskForm}
          isCreatingDisk={isCreatingDisk}
          isOpen={isCreateDiskModalOpen}
          onClose={() => setIsCreateDiskModalOpen(false)}
          onFieldChange={(field, value) =>
            setDiskForm((current) => ({
              ...current,
              [field]: value
            }))
          }
          onSubmit={handleCreateDisk}
        />
        <IscsiAccessModal
          isOpen={isIscsiModalOpen}
          selectedDisk={selectedDisk}
          onClose={() => setIsIscsiModalOpen(false)}
        />
        <AdminUserModal
          adminForm={adminForm}
          editingAdminUserId={editingAdminUserId}
          isOpen={isAdminModalOpen}
          isAdminSaving={isAdminSaving}
          onClose={() => setIsAdminModalOpen(false)}
          onFieldChange={(field, value) =>
            setAdminForm((current) => ({
              ...current,
              [field]: value
            }))
          }
          onReset={resetAdminForm}
          onSubmit={handleAdminSubmit}
        />
        <DeleteDiskModal
          deletingDiskId={deletingDiskId}
          diskId={diskPendingDeleteId}
          onCancel={() => setDiskPendingDeleteId(null)}
          onConfirm={handleDeleteDisk}
        />
      </main>
      <ToastPortal toast={toast} />
    </>
  );
}
