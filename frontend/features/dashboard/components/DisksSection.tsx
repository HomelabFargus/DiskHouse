"use client";

import { formatTimestamp, getDiskStatusClassName } from "../utils";
import type { DiskSummary } from "../types";

type DisksSectionProps = {
  deletingDiskId: string | null;
  diskRequestId: string | null;
  disks: DiskSummary[];
  isDiskComplete: boolean;
  isDiskListLoading: boolean;
  pendingDisks: number;
  selectedDiskId: string | null;
  totalDiskSize: number;
  onCreateDisk: () => void;
  onDeleteDiskRequest: (diskId: string) => void;
  onOpenDisk: (diskId: string) => void;
};

export function DisksSection({
  deletingDiskId,
  diskRequestId,
  disks,
  isDiskComplete,
  isDiskListLoading,
  pendingDisks,
  selectedDiskId,
  totalDiskSize,
  onCreateDisk,
  onDeleteDiskRequest,
  onOpenDisk
}: DisksSectionProps) {
  return (
    <section className="contentGrid contentGridSingle">
      <section className="panel panelMain tablePanel panelFlat">
        <div className="panelHeader">
          <div>
            <h2 className="panelTitle">Ваши диски</h2>
            <p className="panelSubtitle">Панель управления блочными устройствами</p>
          </div>
          <div className="tableActions">
            <button type="button" className="action" onClick={onCreateDisk}>
              Создать диск
            </button>
            <div className={`statusPill ${isDiskComplete ? "statusDone" : ""}`}>
              {diskRequestId
                ? isDiskComplete
                  ? "Операция завершена"
                  : "Операция выполняется"
                : "Ожидание действий"}
            </div>
          </div>
        </div>

        <section className="inventoryToolbar">
          <div className="inventoryStats">
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Всего</span>
              <span className="inventoryStatValue">{disks.length}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">В работе</span>
              <span className="inventoryStatValue">{pendingDisks}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Общий объём</span>
              <span className="inventoryStatValue">{totalDiskSize} GB</span>
            </article>
          </div>
          <p className="inventoryHint">
            Нажмите на диск, чтобы посмотреть информацию по подключению.
          </p>
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
            {disks.length === 0 ? (
              <div className="tableRow tableRowEmpty tableRowEmptyState">
                <span className="placeholder">
                  {isDiskListLoading ? "Загружаем список дисков..." : "Пока нет созданных дисков"}
                </span>
              </div>
            ) : (
              disks.map((disk) => (
                <article
                  className={`tableRow tableRowDisks tableRowInteractive ${
                    selectedDiskId === disk.disk_id ? "tableRowSelected" : ""
                  }`}
                  key={disk.disk_id}
                  onClick={() => onOpenDisk(disk.disk_id)}
                >
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
                  <span className="tableActions">
                    <button
                      type="button"
                      className="action actionInline actionDanger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteDiskRequest(disk.disk_id);
                      }}
                      disabled={deletingDiskId === disk.disk_id || disk.status === "deleting"}
                    >
                      {deletingDiskId === disk.disk_id || disk.status === "deleting"
                        ? "Удаление..."
                        : "Удалить"}
                    </button>
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </section>
  );
}
