"use client";

import { formatTimestamp, getDiskStatusClassName } from "../utils";
import type { AdminUser, DiskSummary } from "../types";

type AdminDisksSectionProps = {
  adminDiskActionId: string | null;
  adminDiskOwnerDrafts: Record<string, string>;
  adminDisks: DiskSummary[];
  adminTotalDiskSize: number;
  adminUsers: AdminUser[];
  isAdminDisksLoading: boolean;
  isAdminUsersLoading: boolean;
  onDeleteDisk: (disk: DiskSummary) => void;
  onOwnerDraftChange: (diskId: string, ownerId: string) => void;
  onTransferDisk: (disk: DiskSummary) => void;
};

export function AdminDisksSection({
  adminDiskActionId,
  adminDiskOwnerDrafts,
  adminDisks,
  adminTotalDiskSize,
  adminUsers,
  isAdminDisksLoading,
  isAdminUsersLoading,
  onDeleteDisk,
  onOwnerDraftChange,
  onTransferDisk
}: AdminDisksSectionProps) {
  return (
    <section className="contentGrid contentGridSingle">
      <section className="panel panelMain tablePanel panelFlat">
        <div className="panelHeader">
          <div>
            <p className="summaryLabel">Администрирование</p>
            <h2 className="panelTitle">Все диски</h2>
          </div>
        </div>

        <section className="inventoryToolbar">
          <div className="inventoryStats">
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Все диски</span>
              <span className="inventoryStatValue">{adminDisks.length}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Общий объём</span>
              <span className="inventoryStatValue">{adminTotalDiskSize} GB</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Владельцы</span>
              <span className="inventoryStatValue">
                {new Set(adminDisks.map((disk) => disk.owner_sub)).size}
              </span>
            </article>
          </div>
        </section>

        <section className="inventoryTableShell">
          <div className="tableHead tableHeadDisks">
            <span>Имя</span>
            <span>Размер</span>
            <span>Владелец</span>
            <span>Статус</span>
            <span>Обновлено</span>
            <span>Действия</span>
          </div>

          <div className="tableBody">
            {adminDisks.length === 0 ? (
              <div className="tableRow tableRowEmpty tableRowEmptyState">
                <span className="placeholder">
                  {isAdminDisksLoading ? "Загружаем диски..." : "Диски пока не найдены."}
                </span>
              </div>
            ) : (
              adminDisks.map((disk) => {
                const ownerDraft = adminDiskOwnerDrafts[disk.disk_id] ?? disk.owner_sub;
                const isBusy = adminDiskActionId === disk.disk_id;
                const hasOwnerOption = adminUsers.some((user) => user.id === ownerDraft);

                return (
                  <article className="tableRow tableRowDisks" key={disk.disk_id}>
                    <span className="tableService tableServiceDisk">
                      {disk.name}
                      <span className="rowMeta">{disk.disk_id}</span>
                    </span>
                    <span className="tableMessage">
                      <span className="tablePrimary">{disk.size_gb} GB</span>
                      <span className="rowMeta rowMetaInline">{disk.filesystem}</span>
                    </span>
                    <span className="tableMessage">
                      <span className="tablePrimary">{disk.owner_display}</span>
                      <span className="rowMeta rowMetaInline">{disk.owner_sub}</span>
                    </span>
                    <span className="tableStatusStack">
                      <span className={`statusBadge ${getDiskStatusClassName(disk.status)}`}>
                        {disk.status}
                      </span>
                      <span className={`statusBadge ${getDiskStatusClassName(disk.iscsi_status)}`}>
                        iSCSI {disk.iscsi_status}
                      </span>
                    </span>
                    <span className="tableMessage">{formatTimestamp(disk.updated_at_ms)}</span>
                    <div className="tableActions tableActionsAdmin">
                      <select
                        className="fieldInput"
                        value={ownerDraft}
                        onChange={(event) => onOwnerDraftChange(disk.disk_id, event.target.value)}
                        disabled={isBusy || isAdminUsersLoading}
                      >
                        {!hasOwnerOption ? <option value={ownerDraft}>{disk.owner_display}</option> : null}
                        {adminUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                              user.username}
                          </option>
                        ))}
                      </select>
                      <button
                        className="action actionSecondary actionInline"
                        type="button"
                        onClick={() => onTransferDisk(disk)}
                        disabled={isBusy || isAdminUsersLoading || adminUsers.length === 0}
                      >
                        {isBusy ? "Сохранение..." : "Сменить владельца"}
                      </button>
                      <button
                        className="action actionDanger actionInline"
                        type="button"
                        onClick={() => onDeleteDisk(disk)}
                        disabled={isBusy || disk.status === "deleting"}
                      >
                        {isBusy || disk.status === "deleting" ? "Удаление..." : "Удалить"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
    </section>
  );
}
