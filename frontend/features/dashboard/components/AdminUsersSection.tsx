"use client";

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
            <p className="summaryLabel">Администрирование</p>
            <h2 className="panelTitle">Пользователи</h2>
          </div>
          <div className="tableActions">
            <button className="action" type="button" onClick={onCreateUser}>
              Создать пользователя
            </button>
          </div>
        </div>

        <section className="inventoryToolbar">
          <div className="inventoryStats">
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Пользователи</span>
              <span className="inventoryStatValue">{adminUsers.length}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Активные</span>
              <span className="inventoryStatValue">{enabledAdminUsers}</span>
            </article>
            <article className="inventoryStat">
              <span className="inventoryStatLabel">Admins</span>
              <span className="inventoryStatValue">{adminCount}</span>
            </article>
          </div>
        </section>

        <section className="inventoryTableShell">
          <div className="tableHead tableHeadUsers">
            <span>Пользователь</span>
            <span>Email</span>
            <span>Статус</span>
            <span>Группы</span>
            <span>Действия</span>
          </div>

          <div className="tableBody">
            {adminUsers.length === 0 ? (
              <div className="tableRow tableRowEmpty tableRowEmptyState">
                <span className="placeholder">
                  {isAdminUsersLoading ? "Загружаем пользователей..." : "Пользователи пока не найдены."}
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
                    <span className="tablePrimary">{user.email ?? "не указан"}</span>
                  </span>
                  <span className="tableStatusStack">
                    <span
                      className={`statusBadge ${
                        user.enabled ? "statusBadgeReady" : "statusBadgeDeleting"
                      }`}
                    >
                      {user.enabled ? "активен" : "отключён"}
                    </span>
                    {user.is_admin ? <span className="statusBadge statusBadgePending">admin</span> : null}
                  </span>
                  <span className="tableMessage">{user.groups.join(", ") || "нет"}</span>
                  <span className="tableActions">
                    <button
                      className="action actionSecondary actionInline"
                      type="button"
                      onClick={() => onEditUser(user)}
                    >
                      Изменить
                    </button>
                    <button
                      className="action actionDanger actionInline"
                      type="button"
                      onClick={() => onDeleteUser(user.id)}
                      disabled={isAdminSaving}
                    >
                      Удалить
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
