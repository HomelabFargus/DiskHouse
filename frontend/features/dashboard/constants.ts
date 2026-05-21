import type { AdminFormState, DiskFormState, TabOption } from "./types";

export const storageKey = "diskhub-auth-session";

export const baseTabs: TabOption[] = [
  { id: "overview", label: "Обзор" },
  { id: "disks", label: "Диски" }
];

export const initialDiskForm: DiskFormState = {
  name: "team-volume",
  sizeGb: "120",
  filesystem: "xfs",
  performanceTier: "standard"
};

export const initialAdminForm: AdminFormState = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  enabled: true,
  isAdmin: false
};
