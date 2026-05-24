"use client";

import type { FormEvent } from "react";

import { uiText } from "../constants";

type LoginScreenProps = {
  isSubmittingAuth: boolean;
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function LoadingScreen() {
  return (
    <main className="loginScreen">
      <section className="loginCard loginCardCompact">
        <p className="summaryLabel">{uiText.common.brandName}</p>
        <h1 className="loginTitle">{uiText.auth.loadingTitle}</h1>
        <p className="loginText">{uiText.auth.loadingText}</p>
      </section>
    </main>
  );
}

export function LoginScreen({
  isSubmittingAuth,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit
}: LoginScreenProps) {
  return (
    <main className="loginScreen">
      <section className="loginLayout">
        <section className="loginHero">
          <div className="brand loginBrand">
            <div className="brandMark">D</div>
            <div>
              <p className="brandTitle">{uiText.common.brandName}</p>
              <p className="brandText">{uiText.common.brandTagline}</p>
            </div>
          </div>

          <div className="loginHeroContent">
            <p className="summaryLabel">{uiText.auth.heroEyebrow}</p>
            <h1 className="loginTitle">{uiText.auth.heroTitle}</h1>
            <p className="loginText">{uiText.auth.heroText}</p>
          </div>
        </section>

        <section className="loginCard">
          <form className="authPanel loginPanel" onSubmit={onSubmit}>
            <div className="authHeader">
              <div>
                <p className="summaryLabel">Keycloak</p>
                <h2 className="panelTitle">{uiText.auth.cardTitle}</h2>
              </div>
              <p className="panelSubtitle">
                {uiText.auth.realmLabel}: <strong>{uiText.auth.realmName}</strong>.
              </p>
            </div>

            <label className="field">
              <span className="fieldLabel">{uiText.auth.username}</span>
              <input
                className="fieldInput"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="field">
              <span className="fieldLabel">{uiText.auth.password}</span>
              <input
                className="fieldInput"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <div className="authActions">
              <button className="action" type="submit" disabled={isSubmittingAuth}>
                {isSubmittingAuth ? uiText.auth.submitting : uiText.auth.submit}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
