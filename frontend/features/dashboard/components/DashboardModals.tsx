"use client";

import type { FormEvent } from "react";
import { createPortal } from "react-dom";

import { uiText } from "../constants";
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
            <span className="modalEyebrow">{uiText.modals.createDisk.eyebrow}</span>
            <h2 className="modalTitle" id="create-disk-modal-title">
              {uiText.modals.createDisk.title}
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onClose}
            disabled={isCreatingDisk}
            aria-label={uiText.modals.createDisk.closeLabel}
          >
            ×
          </button>
        </div>

        <section className="modalIntro">
          <div>
            <p className="summaryLabel">{uiText.modals.createDisk.introLabel}</p>
            <p className="panelSubtitle">{uiText.modals.createDisk.introText}</p>
          </div>
          <div className="modalChips">
            {uiText.modals.createDisk.chips.map((chip) => (
              <span className="chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </section>

        <form className="modalFormShell" onSubmit={onSubmit}>
          <section className="authPanel diskForm modalFormPanel">
            <div className="modalSectionHead">
              <div>
                <p className="summaryLabel">{uiText.modals.createDisk.paramsLabel}</p>
                <p className="panelSubtitle">{uiText.modals.createDisk.paramsText}</p>
              </div>
              <div className="statusPill">{uiText.modals.createDisk.templateVolume}</div>
            </div>

            <div className="modalFieldGrid">
              <label className="field modalFieldWide">
                <span className="fieldLabel">{uiText.modals.createDisk.name}</span>
                <input
                  className="fieldInput"
                  value={diskForm.name}
                  onChange={(event) => onFieldChange("name", event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="fieldLabel">{uiText.modals.createDisk.size}</span>
                <input
                  className="fieldInput"
                  inputMode="numeric"
                  value={diskForm.sizeGb}
                  onChange={(event) => onFieldChange("sizeGb", event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="fieldLabel">{uiText.modals.createDisk.filesystem}</span>
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
                <span className="fieldLabel">{uiText.modals.createDisk.performanceTier}</span>
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
              {uiText.common.cancel}
            </button>
            <button className="action modalSubmit" type="submit" disabled={isCreatingDisk}>
              {isCreatingDisk ? uiText.modals.createDisk.submitting : uiText.modals.createDisk.submit}
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
            <span className="modalEyebrow">{uiText.modals.iscsi.eyebrow}</span>
            <h2 className="modalTitle" id="iscsi-access-modal-title">
              {uiText.modals.iscsi.title}
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onClose}
            aria-label={uiText.modals.iscsi.closeLabel}
          >
            ×
          </button>
        </div>

        <section className="modalIntro">
          <div>
            <p className="summaryLabel">{uiText.modals.iscsi.introLabel}</p>
            <p className="panelSubtitle">{uiText.modals.iscsi.introText}</p>
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
                    {selectedDisk.iscsi ? uiText.modals.iscsi.ready : uiText.modals.iscsi.noTarget}
                  </div>
                </div>

                {selectedDisk.iscsi ? (
                  <>
                    <div className="connectionGrid">
                      <div className="connectionFact">
                        <span className="fieldLabel">{uiText.modals.iscsi.portal}</span>
                        <code className="inlineCode">
                          {selectedDisk.iscsi.portal_address}:{selectedDisk.iscsi.portal_port}
                        </code>
                      </div>
                      <div className="connectionFact">
                        <span className="fieldLabel">{uiText.modals.iscsi.iqn}</span>
                        <code className="inlineCode">{selectedDisk.iscsi.target_iqn}</code>
                      </div>
                      <div className="connectionFact">
                        <span className="fieldLabel">{uiText.modals.iscsi.lun}</span>
                        <code className="inlineCode">{selectedDisk.iscsi.lun}</code>
                      </div>
                      <div className="connectionFact">
                        <span className="fieldLabel">{uiText.modals.iscsi.auth}</span>
                        <code className="inlineCode">{selectedDisk.iscsi.auth_type}</code>
                      </div>
                    </div>

                    <div className="commandStack">
                      <div className="commandBlock">
                        <span className="fieldLabel">{uiText.modals.iscsi.steps.discovery}</span>
                        <code className="commandCode">{selectedDisk.iscsi.discovery_command}</code>
                      </div>
                      <div className="commandBlock">
                        <span className="fieldLabel">{uiText.modals.iscsi.steps.login}</span>
                        <code className="commandCode">{selectedDisk.iscsi.login_command}</code>
                      </div>
                      <div className="commandBlock">
                        <span className="fieldLabel">{uiText.modals.iscsi.steps.device}</span>
                        <code className="commandCode">{selectedDisk.iscsi.device_path}</code>
                      </div>
                      <div className="commandBlock">
                        <span className="fieldLabel">{uiText.modals.iscsi.steps.mount}</span>
                        <code className="commandCode">{selectedDisk.iscsi.mount_hint}</code>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="panelSubtitle">
                    {uiText.modals.iscsi.pendingTarget}
                    <strong>{uiText.modals.iscsi.readyPair}</strong>
                    {uiText.modals.iscsi.pendingTargetSuffix}
                  </p>
                )}
              </div>
            ) : (
              <p className="panelSubtitle">{uiText.modals.iscsi.empty}</p>
            )}
          </section>

          <div className="modalFooter">
            <button type="button" className="action actionSecondary" onClick={onClose}>
              {uiText.common.close}
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
            <span className="modalEyebrow">
              {editingAdminUserId ? uiText.modals.adminUser.editEyebrow : uiText.modals.adminUser.newEyebrow}
            </span>
            <h2 className="modalTitle" id="admin-user-modal-title">
              {editingAdminUserId ? uiText.modals.adminUser.editTitle : uiText.modals.adminUser.createTitle}
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onClose}
            disabled={isAdminSaving}
            aria-label={uiText.modals.adminUser.closeLabel}
          >
            ×
          </button>
        </div>

        <section className="modalIntro">
          <div>
            <p className="summaryLabel">
              {editingAdminUserId ? uiText.modals.adminUser.editMode : uiText.modals.adminUser.newMode}
            </p>
            <p className="panelSubtitle">
              {editingAdminUserId
                ? uiText.modals.adminUser.editText
                : uiText.modals.adminUser.createText}
            </p>
          </div>
          <div className="modalChips">
            <span className="chip">
              {editingAdminUserId ? uiText.modals.adminUser.editChip : uiText.modals.adminUser.createChip}
            </span>
            <span className="chip">{adminForm.isAdmin ? "Admin" : "User"}</span>
            <span className="chip">
              {adminForm.enabled ? uiText.modals.adminUser.active : uiText.modals.adminUser.disabled}
            </span>
          </div>
        </section>

        <form className="modalFormShell" onSubmit={onSubmit}>
          <section className="authPanel adminForm modalFormPanel">
            <section className="adminFormSection">
              <div className="adminFormSectionHead">
                <h3 className="adminSectionTitle">{uiText.modals.adminUser.profileSection}</h3>
              </div>

              <div className="adminFormGrid">
                <label className="field">
                  <span className="fieldLabel">{uiText.modals.adminUser.username}</span>
                  <input
                    className="fieldInput"
                    value={adminForm.username}
                    onChange={(event) => onFieldChange("username", event.target.value)}
                    placeholder={uiText.modals.adminUser.usernamePlaceholder}
                    required
                  />
                  <span className="fieldHint">{uiText.modals.adminUser.required}</span>
                </label>

                <label className="field">
                  <span className="fieldLabel">{uiText.modals.adminUser.email}</span>
                  <input
                    className="fieldInput"
                    type="email"
                    value={adminForm.email}
                    onChange={(event) => onFieldChange("email", event.target.value)}
                    placeholder={uiText.modals.adminUser.emailPlaceholder}
                  />
                  <span className="fieldHint">{uiText.modals.adminUser.required}</span>
                </label>

                <label className="field">
                  <span className="fieldLabel">{uiText.modals.adminUser.firstName}</span>
                  <input
                    className="fieldInput"
                    value={adminForm.firstName}
                    onChange={(event) => onFieldChange("firstName", event.target.value)}
                    placeholder={uiText.modals.adminUser.firstNamePlaceholder}
                  />
                </label>

                <label className="field">
                  <span className="fieldLabel">{uiText.modals.adminUser.lastName}</span>
                  <input
                    className="fieldInput"
                    value={adminForm.lastName}
                    onChange={(event) => onFieldChange("lastName", event.target.value)}
                    placeholder={uiText.modals.adminUser.lastNamePlaceholder}
                  />
                </label>
              </div>
            </section>

            <section className="adminFormSection">
              <div className="adminFormSectionHead">
                <h3 className="adminSectionTitle">{uiText.modals.adminUser.accessSection}</h3>
              </div>

              <div className="adminToggleGrid">
                <label className="toggleCard toggleCardRich">
                  <input
                    type="checkbox"
                    checked={adminForm.enabled}
                    onChange={(event) => onFieldChange("enabled", event.target.checked)}
                  />
                  <span className="toggleCopy">
                    <span className="toggleTitle">{uiText.modals.adminUser.enableUser}</span>
                    <span className="toggleHint">{uiText.modals.adminUser.enableUserHint}</span>
                  </span>
                </label>

                <label className="toggleCard toggleCardRich">
                  <input
                    type="checkbox"
                    checked={adminForm.isAdmin}
                    onChange={(event) => onFieldChange("isAdmin", event.target.checked)}
                  />
                  <span className="toggleCopy">
                    <span className="toggleTitle">{uiText.modals.adminUser.adminRole}</span>
                    <span className="toggleHint">{uiText.modals.adminUser.adminRoleHint}</span>
                  </span>
                </label>
              </div>

              <label className="field">
                <span className="fieldLabel">
                  {editingAdminUserId ? uiText.modals.adminUser.newPassword : uiText.modals.adminUser.password}
                </span>
                <input
                  className="fieldInput"
                  type="password"
                  value={adminForm.password}
                  onChange={(event) => onFieldChange("password", event.target.value)}
                  placeholder={
                    editingAdminUserId
                      ? uiText.modals.adminUser.editPasswordPlaceholder
                      : uiText.modals.adminUser.createPasswordPlaceholder
                  }
                />
                <span className="fieldHint">
                  {editingAdminUserId
                    ? uiText.modals.adminUser.editPasswordHint
                    : uiText.modals.adminUser.createPasswordHint}
                </span>
              </label>
            </section>

            <section className="adminPreviewCard">
              <div>
                <p className="summaryLabel">{uiText.modals.adminUser.preview}</p>
                <p className="adminPreviewName">
                  {[adminForm.firstName, adminForm.lastName].filter(Boolean).join(" ") ||
                    adminForm.username ||
                    uiText.modals.adminUser.newUserFallback}
                </p>
                <p className="adminPreviewMeta">
                  {adminForm.email || uiText.modals.adminUser.emailMissing}
                </p>
              </div>
              <div className="chipRow">
                <span className="chip">
                  {adminForm.enabled ? uiText.modals.adminUser.active : uiText.modals.adminUser.disabled}
                </span>
                <span className="chip">{adminForm.isAdmin ? "Admin" : "User"}</span>
                <span className="chip">
                  {editingAdminUserId ? uiText.modals.adminUser.editState : uiText.modals.adminUser.createState}
                </span>
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
                {uiText.modals.adminUser.reset}
              </button>
            ) : null}
            <button
              className="action actionSecondary"
              type="button"
              onClick={onClose}
              disabled={isAdminSaving}
            >
              {uiText.common.cancel}
            </button>
            <button className="action modalSubmit" type="submit" disabled={isAdminSaving}>
              {isAdminSaving
                ? uiText.common.saving
                : editingAdminUserId
                  ? uiText.modals.adminUser.save
                  : uiText.modals.adminUser.create}
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
            <span className="modalEyebrow">{uiText.modals.deleteDisk.eyebrow}</span>
            <h2 className="modalTitle" id="delete-disk-modal-title">
              {uiText.modals.deleteDisk.title}
            </h2>
          </div>
          <button
            type="button"
            className="modalIconButton"
            onClick={onCancel}
            disabled={Boolean(deletingDiskId)}
            aria-label={uiText.modals.deleteDisk.closeLabel}
          >
            ×
          </button>
        </div>

        <section className="modalIntro modalIntroConfirm">
          <div>
            <p className="summaryLabel">{uiText.modals.deleteDisk.question}</p>
            <p className="panelSubtitle">
              {uiText.modals.deleteDisk.textBeforeId}
              <strong>{diskId}</strong>
              {uiText.modals.deleteDisk.textAfterId}
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
            {uiText.common.cancel}
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
            {deletingDiskId === diskId ? uiText.common.deleting : uiText.common.delete}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
