"use client";

import type { RefObject } from "react";

import { uiText } from "../constants";
import type { AdminSection, TabId, TabOption } from "../types";

type SidebarProps = {
  activeTab: TabId;
  activeAdminSection: AdminSection;
  isAdmin: boolean;
  isAdminPanelOpen: boolean;
  isSidebarMenuOpen: boolean;
  sidebarMenuRef: RefObject<HTMLDivElement>;
  baseTabs: TabOption[];
  onAdminSectionChange: (section: AdminSection) => void;
  onOpenAdminPanel: () => void;
  onSidebarMenuToggle: () => void;
  onTabChange: (tab: TabId) => void;
  onBack: () => void;
  onLogout: () => void;
};

export function Sidebar({
  activeTab,
  activeAdminSection,
  isAdmin,
  isAdminPanelOpen,
  isSidebarMenuOpen,
  sidebarMenuRef,
  baseTabs,
  onAdminSectionChange,
  onOpenAdminPanel,
  onSidebarMenuToggle,
  onTabChange,
  onBack,
  onLogout
}: SidebarProps) {
  return (
    <aside className="sidebar">
      {isAdminPanelOpen ? (
        <button type="button" className="sidebarBackButton" onClick={onBack}>
          <span className="sidebarBackArrow" aria-hidden="true">
            &lt;
          </span>
          <span>{uiText.sidebar.back}</span>
        </button>
      ) : (
        <div className="brand">
          <div className="brandMark">D</div>
          <div>
            <p className="brandTitle">{uiText.common.brandName}</p>
            <p className="brandText">{uiText.common.brandTagline}</p>
          </div>
        </div>
      )}

      <nav className="nav">
        {isAdminPanelOpen ? (
          <>
            <button
              type="button"
              className={`navItem ${activeAdminSection === "disks" ? "navItemActive" : ""}`}
              onClick={() => onAdminSectionChange("disks")}
            >
              {uiText.sidebar.adminSections.disks}
            </button>
            <button
              type="button"
              className={`navItem ${activeAdminSection === "users" ? "navItemActive" : ""}`}
              onClick={() => onAdminSectionChange("users")}
            >
              {uiText.sidebar.adminSections.users}
            </button>
            <button
              type="button"
              className={`navItem ${activeAdminSection === "monitoring" ? "navItemActive" : ""}`}
              onClick={() => onAdminSectionChange("monitoring")}
            >
              {uiText.sidebar.adminSections.monitoring}
            </button>
          </>
        ) : (
          baseTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`navItem ${activeTab === tab.id ? "navItemActive" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))
        )}
      </nav>

      <div className="sidebarFooter">
        <div className="sidebarMenuShell" ref={sidebarMenuRef}>
          {isSidebarMenuOpen ? (
            <div className="sidebarMenu" role="menu" aria-label={uiText.sidebar.profileMenu}>
              {isAdmin ? (
                <button
                  type="button"
                  className="sidebarMenuItem"
                  onClick={onOpenAdminPanel}
                  role="menuitem"
                >
                  {uiText.sidebar.admin}
                </button>
              ) : null}
              <button type="button" className="sidebarMenuItem" onClick={onLogout} role="menuitem">
                {uiText.sidebar.logout}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className={`sidebarSettingsButton ${
              isSidebarMenuOpen ? "sidebarSettingsButtonActive" : ""
            }`}
            aria-label={uiText.common.closeMenu}
            aria-expanded={isSidebarMenuOpen}
            aria-haspopup="menu"
            onClick={onSidebarMenuToggle}
          >
            <svg
              className="sidebarSettingsIcon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3.75v2.1" />
              <path d="M12 18.15v2.1" />
              <path d="M20.25 12h-2.1" />
              <path d="M5.85 12h-2.1" />
              <path d="M17.83 6.17l-1.49 1.49" />
              <path d="M7.66 16.34l-1.49 1.49" />
              <path d="M17.83 17.83l-1.49-1.49" />
              <path d="M7.66 7.66L6.17 6.17" />
              <path d="M13.95 5.15l.38-1.42" />
              <path d="M9.67 20.27l.38-1.42" />
              <path d="M18.85 13.95l1.42.38" />
              <path d="M3.73 9.67l1.42.38" />
              <path d="M18.85 10.05l1.42-.38" />
              <path d="M3.73 14.33l1.42-.38" />
              <path d="M13.95 18.85l.38 1.42" />
              <path d="M9.67 3.73l.38 1.42" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
