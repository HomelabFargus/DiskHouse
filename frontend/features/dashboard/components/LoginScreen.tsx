"use client";

import type { FormEvent } from "react";

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
        <p className="summaryLabel">diskHub</p>
        <h1 className="loginTitle">Проверяем сессию</h1>
        <p className="loginText">Подождите немного, загружаем данные пользователя.</p>
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
              <p className="brandTitle">diskHub</p>
              <p className="brandText">Storage control panel</p>
            </div>
          </div>

          <div className="loginHeroContent">
            <p className="summaryLabel">Вход в систему</p>
            <h1 className="loginTitle">Войдите в diskHub</h1>
            <p className="loginText">Авторизуйтесь через Keycloak и откройте рабочую панель.</p>
          </div>
        </section>

        <section className="loginCard">
          <form className="authPanel loginPanel" onSubmit={onSubmit}>
            <div className="authHeader">
              <div>
                <p className="summaryLabel">Keycloak</p>
                <h2 className="panelTitle">Вход в diskHub</h2>
              </div>
              <p className="panelSubtitle">
                Realm: <strong>diskhub</strong>.
              </p>
            </div>

            <label className="field">
              <span className="fieldLabel">Логин</span>
              <input
                className="fieldInput"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="field">
              <span className="fieldLabel">Пароль</span>
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
                {isSubmittingAuth ? "Вход..." : "Войти"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
