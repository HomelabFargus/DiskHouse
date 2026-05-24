"use client";

import { uiText } from "../constants";
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
            <h2 className="panelTitle">{uiText.disks.title}</h2>
            <p className="panelSubtitle">{uiText.disks.subtitle}</p>
          </div>
          <div className="tableActions">
            <button type="button" className="action" onClick={onCreateDisk}>
              {uiText.disks.create}
            </button>
            <div className={`statusPill ${isDiskComplete ? "statusDone" : ""}`}>
              {diskRequestId
                ? isDiskComplete
                  ? uiText.disks.statusComplete
                  : uiText.disks.statusInProgress
                : uiText.disks.statusIdle}
            </div>
          </div>
        </div>

        <section className="inventoryToolbar">
          <div className="inventoryStats">
            <article className="inventoryStat">
              <span className="inventoryStatLabel">{uiText.disks.stats.total}</span>
              <span className="inventoryStatValue">{disks.length}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">{uiText.disks.stats.pending}</span>
              <span className="inventoryStatValue">{pendingDisks}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">{uiText.disks.stats.capacity}</span>
              <span className="inventoryStatValue">{totalDiskSize} GB</span>
            </article>
          </div>
          <p className="inventoryHint">{uiText.disks.hint}</p>
        </section>

        <section className="inventoryTableShell">
          <div className="tableHead tableHeadDisks">
            <span>{uiText.disks.table.name}</span>
            <span>{uiText.disks.table.size}</span>
            <span>{uiText.disks.table.owner}</span>
            <span>{uiText.disks.table.status}</span>
            <span>{uiText.disks.table.updated}</span>
            <span>{uiText.disks.table.actions}</span>
          </div>

          <div className="tableBody">
            {disks.length === 0 ? (
              <div className="tableRow tableRowEmpty tableRowEmptyState">
                <span className="placeholder">
                  {isDiskListLoading ? uiText.disks.emptyLoading : uiText.disks.empty}
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
                        ? uiText.common.deleting
                        : uiText.common.delete}
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
