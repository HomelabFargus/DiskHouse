"use client";

import { uiText } from "../constants";
import type { AdminUser } from "../types";

type AdminUsersSectionProps = {
  adminCount: number;
  adminUsers: AdminUser[];
  enabledAdminUsers: number;
  isAdminSaving: boolean;
  isAdminUsersLoading: boolean;
  onCreateUser: () => void;
  onDeleteUser: (userId: string) => void;
  onEditUser: (user: AdminUser) => void;
};

export function AdminUsersSection({
  adminCount,
  adminUsers,
  enabledAdminUsers,
  isAdminSaving,
  isAdminUsersLoading,
  onCreateUser,
  onDeleteUser,
  onEditUser
}: AdminUsersSectionProps) {
  return (
    <section className="contentGrid contentGridSingle">
      <section className="panel panelMain tablePanel panelFlat">
        <div className="panelHeader">
          <div>
            <p className="summaryLabel">{uiText.adminUsers.eyebrow}</p>
            <h2 className="panelTitle">{uiText.adminUsers.title}</h2>
          </div>
          <div className="tableActions">
            <button className="action" type="button" onClick={onCreateUser}>
              {uiText.adminUsers.create}
            </button>
          </div>
        </div>

        <section className="inventoryToolbar">
          <div className="inventoryStats">
            <article className="inventoryStat">
              <span className="inventoryStatLabel">{uiText.adminUsers.stats.total}</span>
              <span className="inventoryStatValue">{adminUsers.length}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">{uiText.adminUsers.stats.active}</span>
              <span className="inventoryStatValue">{enabledAdminUsers}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">{uiText.adminUsers.stats.admins}</span>
              <span className="inventoryStatValue">{adminCount}</span>
            </article>
          </div>
        </section>

        <section className="inventoryTableShell">
          <div className="tableHead tableHeadUsers">
            <span>{uiText.adminUsers.table.user}</span>
            <span>{uiText.adminUsers.table.email}</span>
            <span>{uiText.adminUsers.table.status}</span>
            <span>{uiText.adminUsers.table.groups}</span>
            <span>{uiText.adminUsers.table.actions}</span>
          </div>

          <div className="tableBody">
            {adminUsers.length === 0 ? (
              <div className="tableRow tableRowEmpty tableRowEmptyState">
                <span className="placeholder">
                  {isAdminUsersLoading ? uiText.adminUsers.emptyLoading : uiText.adminUsers.empty}
                </span>
              </div>
            ) : (
              adminUsers.map((user) => (
                <article className="tableRow tableRowUsers" key={user.id}>
                  <span className="tableService tableServiceDisk">
                    {user.username}
                    <span className="rowMeta">
                      {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.id}
                    </span>
                  </span>
                  <span className="tableMessage">
                    <span className="tablePrimary">{user.email ?? uiText.adminUsers.noEmail}</span>
                  </span>
                  <span className="tableStatusStack">
                    <span
                      className={`statusBadge ${
                        user.enabled ? "statusBadgeReady" : "statusBadgeDeleting"
                      }`}
                    >
                      {user.enabled ? uiText.adminUsers.active : uiText.adminUsers.disabled}
                    </span>
                    {user.is_admin ? (
                      <span className="statusBadge statusBadgePending">{uiText.adminUsers.adminBadge}</span>
                    ) : null}
                  </span>
                  <span className="tableMessage">{user.groups.join(", ") || uiText.adminUsers.noGroups}</span>
                  <span className="tableActions">
                    <button
                      className="action actionSecondary actionInline"
                      type="button"
                      onClick={() => onEditUser(user)}
                    >
                      {uiText.adminUsers.edit}
                    </button>
                    <button
                      className="action actionDanger actionInline"
                      type="button"
                      onClick={() => onDeleteUser(user.id)}
                      disabled={isAdminSaving}
                    >
                      {uiText.common.delete}
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
