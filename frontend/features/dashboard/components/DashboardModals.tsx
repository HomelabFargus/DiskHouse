"use client";

import type { FormEvent } from "react";
import { createPortal } from "react-dom";

import type { AdminFormState, DiskFormState, DiskSummary } from "../types";

type CreateDiskModalProps = {
  diskForm: DiskFormState;
  isCreatingDisk: boolean;
  isOpen: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof DiskFormState, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateDiskModal({
  diskForm,
  isCreatingDisk,
  isOpen,
  onClose,
  onFieldChange,
  onSubmit
}: CreateDiskModalProps) {
  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="modalBackdrop"
      onClick={() => {
        if (!isCreatingDisk) {
          onClose();
        }
      }}
    >
      <section
        className="modalCard"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="create-disk-modal-title"
      >
        <div className="modalTopbar">
          <div className="modalTopbarCopy">
            <span className="modalEyebrow">Volume wizard</span>
            <h2 className="modalTitle" id="create-disk-modal-title">
              Создание диска
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onClose}
            disabled={isCreatingDisk}
            aria-label="Закрыть окно создания диска"
          >
            ×
          </button>
        </div>

        <section className="modalIntro">
          <div>
            <p className="summaryLabel">Новый том</p>
            <p className="panelSubtitle">
              Настройте параметры тома и отправьте его в pipeline. После создания он появится в
              inventory и справа откроется инструкция по подключению.
            </p>
          </div>
          <div className="modalChips">
            <span className="chip">MongoDB inventory</span>
            <span className="chip">Personal pipeline</span>
            <span className="chip">iSCSI export</span>
          </div>
        </section>

        <form className="modalFormShell" onSubmit={onSubmit}>
          <section className="authPanel diskForm modalFormPanel">
            <div className="modalSectionHead">
              <div>
                <p className="summaryLabel">Параметры</p>
                <p className="panelSubtitle">
                  Базовые настройки тома для публикации в storage pipeline.
                </p>
              </div>
              <div className="statusPill">Template volume</div>
            </div>

            <div className="modalFieldGrid">
              <label className="field modalFieldWide">
                <span className="fieldLabel">Название диска</span>
                <input
                  className="fieldInput"
                  value={diskForm.name}
                  onChange={(event) => onFieldChange("name", event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Размер, ГБ</span>
                <input
                  className="fieldInput"
                  inputMode="numeric"
                  value={diskForm.sizeGb}
                  onChange={(event) => onFieldChange("sizeGb", event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Файловая система</span>
                <select
                  className="fieldInput"
                  value={diskForm.filesystem}
                  onChange={(event) => onFieldChange("filesystem", event.target.value)}
                >
                  <option value="xfs">xfs</option>
                  <option value="ext4">ext4</option>
                  <option value="zfs">zfs</option>
                </select>
              </label>

              <label className="field modalFieldWide">
                <span className="fieldLabel">Класс производительности</span>
                <select
                  className="fieldInput"
                  value={diskForm.performanceTier}
                  onChange={(event) => onFieldChange("performanceTier", event.target.value)}
                >
                  <option value="standard">standard</option>
                  <option value="balanced">balanced</option>
                  <option value="premium">premium</option>
                </select>
              </label>
            </div>
          </section>

          <div className="modalFooter">
            <button
              type="button"
              className="action actionSecondary"
              onClick={onClose}
              disabled={isCreatingDisk}
            >
              Отмена
            </button>
            <button className="action modalSubmit" type="submit" disabled={isCreatingDisk}>
              {isCreatingDisk ? "Создание..." : "Создать диск"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

type IscsiAccessModalProps = {
  isOpen: boolean;
  selectedDisk: DiskSummary | null;
  onClose: () => void;
};

export function IscsiAccessModal({ isOpen, selectedDisk, onClose }: IscsiAccessModalProps) {
  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="modalBackdrop" onClick={onClose}>
      <section
        className="modalCard modalCardWide"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="iscsi-access-modal-title"
      >
        <div className="modalTopbar">
          <div className="modalTopbarCopy">
            <span className="modalEyebrow">Connection guide</span>
            <h2 className="modalTitle" id="iscsi-access-modal-title">
              iSCSI access
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onClose}
            aria-label="Закрыть окно iSCSI access"
          >
            ×
          </button>
        </div>

        <section className="modalIntro">
          <div>
            <p className="summaryLabel">Подключение</p>
            <p className="panelSubtitle">
              Инструкция по target, discovery и mount для выбранного диска.
            </p>
          </div>
          {selectedDisk ? (
            <div className="modalChips">
              <span className="chip">{selectedDisk.name}</span>
              <span className="chip">{selectedDisk.size_gb} GB</span>
              <span className="chip">{selectedDisk.filesystem}</span>
            </div>
          ) : null}
        </section>

        <section className="modalFormShell modalConnectionShell">
          <section className="authPanel modalFormPanel">
            {selectedDisk ? (
              <div className="connectionInfo">
                <div className="modalSectionHead">
                  <div>
                    <p className="connectionDiskName">{selectedDisk.name}</p>
                    <p className="rowMeta">{selectedDisk.disk_id}</p>
                  </div>
                  <div className={`statusPill ${selectedDisk.iscsi ? "statusDone" : ""}`}>
                    {selectedDisk.iscsi ? "Ready" : "Нет target"}
                  </div>
                </div>

                {selectedDisk.iscsi ? (
                  <>
                    <div className="connectionGrid">
                      <div className="connectionFact">
                        <span className="fieldLabel">Portal</span>
                        <code className="inlineCode">
                          {selectedDisk.iscsi.portal_address}:{selectedDisk.iscsi.portal_port}
                        </code>
                      </div>
                      <div className="connectionFact">
                        <span className="fieldLabel">IQN</span>
                        <code className="inlineCode">{selectedDisk.iscsi.target_iqn}</code>
                      </div>
                      <div className="connectionFact">
                        <span className="fieldLabel">LUN</span>
                        <code className="inlineCode">{selectedDisk.iscsi.lun}</code>
                      </div>
                      <div className="connectionFact">
                        <span className="fieldLabel">Auth</span>
                        <code className="inlineCode">{selectedDisk.iscsi.auth_type}</code>
                      </div>
                    </div>

                    <div className="commandStack">
                      <div className="commandBlock">
                        <span className="fieldLabel">1. Discovery</span>
                        <code className="commandCode">{selectedDisk.iscsi.discovery_command}</code>
                      </div>
                      <div className="commandBlock">
                        <span className="fieldLabel">2. Login</span>
                        <code className="commandCode">{selectedDisk.iscsi.login_command}</code>
                      </div>
                      <div className="commandBlock">
                        <span className="fieldLabel">3. Device</span>
                        <code className="commandCode">{selectedDisk.iscsi.device_path}</code>
                      </div>
                      <div className="commandBlock">
                        <span className="fieldLabel">4. Mount</span>
                        <code className="commandCode">{selectedDisk.iscsi.mount_hint}</code>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="panelSubtitle">
                    Для этого диска target ещё не готов. Дождитесь статуса <strong>ready / ready</strong>{" "}
                    после завершения pipeline.
                  </p>
                )}
              </div>
            ) : (
              <p className="panelSubtitle">
                Выберите диск в inventory, затем откройте окно iSCSI access.
              </p>
            )}
          </section>

          <div className="modalFooter">
            <button type="button" className="action actionSecondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </section>
      </section>
    </div>,
    document.body
  );
}

type AdminUserModalProps = {
  adminForm: AdminFormState;
  editingAdminUserId: string | null;
  isOpen: boolean;
  isAdminSaving: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof AdminFormState, value: string | boolean) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AdminUserModal({
  adminForm,
  editingAdminUserId,
  isOpen,
  isAdminSaving,
  onClose,
  onFieldChange,
  onReset,
  onSubmit
}: AdminUserModalProps) {
  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="modalBackdrop"
      onClick={() => {
        if (!isAdminSaving) {
          onClose();
        }
      }}
    >
      <section
        className="modalCard modalCardWide"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="admin-user-modal-title"
      >
        <div className="modalTopbar">
          <div className="modalTopbarCopy">
            <span className="modalEyebrow">{editingAdminUserId ? "Edit user" : "New user"}</span>
            <h2 className="modalTitle" id="admin-user-modal-title">
              {editingAdminUserId ? "Редактирование пользователя" : "Создание пользователя"}
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onClose}
            disabled={isAdminSaving}
            aria-label="Закрыть окно пользователя"
          >
            ×
          </button>
        </div>

        <section className="modalIntro">
          <div>
            <p className="summaryLabel">
              {editingAdminUserId ? "Режим редактирования" : "Новый пользователь"}
            </p>
            <p className="panelSubtitle">
              {editingAdminUserId
                ? "Обновите профиль, доступ или пароль. Пустой пароль оставит текущий без изменений."
                : "Заполните базовые данные и сразу задайте уровень доступа для новой учётной записи."}
            </p>
          </div>
          <div className="modalChips">
            <span className="chip">
              {editingAdminUserId ? "Изменение профиля" : "Создание профиля"}
            </span>
            <span className="chip">{adminForm.isAdmin ? "Admin" : "User"}</span>
            <span className="chip">{adminForm.enabled ? "Активен" : "Отключён"}</span>
          </div>
        </section>

        <form className="modalFormShell" onSubmit={onSubmit}>
          <section className="authPanel adminForm modalFormPanel">
            <section className="adminFormSection">
              <div className="adminFormSectionHead">
                <h3 className="adminSectionTitle">Профиль</h3>
              </div>

              <div className="adminFormGrid">
                <label className="field">
                  <span className="fieldLabel">Логин</span>
                  <input
                    className="fieldInput"
                    value={adminForm.username}
                    onChange={(event) => onFieldChange("username", event.target.value)}
                    placeholder="Например, a.smirnov"
                    required
                  />
                  <span className="fieldHint">Обязательно</span>
                </label>

                <label className="field">
                  <span className="fieldLabel">Email</span>
                  <input
                    className="fieldInput"
                    type="email"
                    value={adminForm.email}
                    onChange={(event) => onFieldChange("email", event.target.value)}
                    placeholder="user@diskhub.local"
                  />
                  <span className="fieldHint">Обязательно</span>
                </label>

                <label className="field">
                  <span className="fieldLabel">Имя</span>
                  <input
                    className="fieldInput"
                    value={adminForm.firstName}
                    onChange={(event) => onFieldChange("firstName", event.target.value)}
                    placeholder="Алексей"
                  />
                </label>

                <label className="field">
                  <span className="fieldLabel">Фамилия</span>
                  <input
                    className="fieldInput"
                    value={adminForm.lastName}
                    onChange={(event) => onFieldChange("lastName", event.target.value)}
                    placeholder="Смирнов"
                  />
                </label>
              </div>
            </section>

            <section className="adminFormSection">
              <div className="adminFormSectionHead">
                <h3 className="adminSectionTitle">Доступ</h3>
              </div>

              <div className="adminToggleGrid">
                <label className="toggleCard toggleCardRich">
                  <input
                    type="checkbox"
                    checked={adminForm.enabled}
                    onChange={(event) => onFieldChange("enabled", event.target.checked)}
                  />
                  <span className="toggleCopy">
                    <span className="toggleTitle">Активировать пользователя</span>
                    <span className="toggleHint">Разрешает авторизацию и работу с системой.</span>
                  </span>
                </label>

                <label className="toggleCard toggleCardRich">
                  <input
                    type="checkbox"
                    checked={adminForm.isAdmin}
                    onChange={(event) => onFieldChange("isAdmin", event.target.checked)}
                  />
                  <span className="toggleCopy">
                    <span className="toggleTitle">Администратор</span>
                    <span className="toggleHint">
                      Даёт доступ к управлению пользователями и расширенным разделам.
                    </span>
                  </span>
                </label>
              </div>

              <label className="field">
                <span className="fieldLabel">
                  {editingAdminUserId ? "Новый пароль" : "Пароль"}
                </span>
                <input
                  className="fieldInput"
                  type="password"
                  value={adminForm.password}
                  onChange={(event) => onFieldChange("password", event.target.value)}
                  placeholder={
                    editingAdminUserId
                      ? "Оставьте пустым, чтобы не менять"
                      : "Минимум для первого входа"
                  }
                />
                <span className="fieldHint">
                  {editingAdminUserId
                    ? "Заполняйте только если нужно сбросить пароль."
                    : "Обязателен только для новой учётной записи."}
                </span>
              </label>
            </section>

            <section className="adminPreviewCard">
              <div>
                <p className="summaryLabel">Предпросмотр</p>
                <p className="adminPreviewName">
                  {[adminForm.firstName, adminForm.lastName].filter(Boolean).join(" ") ||
                    adminForm.username ||
                    "Новый пользователь"}
                </p>
                <p className="adminPreviewMeta">{adminForm.email || "Email пока не указан"}</p>
              </div>
              <div className="chipRow">
                <span className="chip">{adminForm.enabled ? "Активен" : "Отключён"}</span>
                <span className="chip">{adminForm.isAdmin ? "Admin" : "User"}</span>
                <span className="chip">{editingAdminUserId ? "Редактирование" : "Создание"}</span>
              </div>
            </section>
          </section>

          <div className="modalFooter">
            {editingAdminUserId ? (
              <button
                className="action actionSecondary"
                type="button"
                onClick={onReset}
                disabled={isAdminSaving}
              >
                Сбросить
              </button>
            ) : null}
            <button
              className="action actionSecondary"
              type="button"
              onClick={onClose}
              disabled={isAdminSaving}
            >
              Отмена
            </button>
            <button className="action modalSubmit" type="submit" disabled={isAdminSaving}>
              {isAdminSaving
                ? "Сохранение..."
                : editingAdminUserId
                  ? "Сохранить изменения"
                  : "Создать пользователя"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

type DeleteDiskModalProps = {
  deletingDiskId: string | null;
  diskId: string | null;
  onCancel: () => void;
  onConfirm: (diskId: string) => Promise<void>;
};

export function DeleteDiskModal({
  deletingDiskId,
  diskId,
  onCancel,
  onConfirm
}: DeleteDiskModalProps) {
  if (!diskId || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="modalBackdrop"
      onClick={() => {
        if (!deletingDiskId) {
          onCancel();
        }
      }}
    >
      <section
        className="modalCard modalCardConfirm"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="delete-disk-modal-title"
      >
        <div className="modalTopbar">
          <div className="modalTopbarCopy">
            <span className="modalEyebrow">Подтверждение</span>
            <h2 className="modalTitle" id="delete-disk-modal-title">
              Удаление диска
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onCancel}
            disabled={Boolean(deletingDiskId)}
            aria-label="Закрыть окно подтверждения удаления"
          >
            ×
          </button>
        </div>

        <section className="modalIntro modalIntroConfirm">
          <div>
            <p className="summaryLabel">Вы уверены?</p>
            <p className="panelSubtitle">
              Диск <strong>{diskId}</strong> будет отправлен на удаление.
            </p>
          </div>
        </section>

        <div className="modalFooter modalFooterConfirm">
          <button
            type="button"
            className="action actionSecondary"
            onClick={onCancel}
            disabled={Boolean(deletingDiskId)}
          >
            Отмена
          </button>
          <button
            type="button"
            className="action actionDanger"
            onClick={async () => {
              await onConfirm(diskId);
              onCancel();
            }}
            disabled={Boolean(deletingDiskId)}
          >
            {deletingDiskId === diskId ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
