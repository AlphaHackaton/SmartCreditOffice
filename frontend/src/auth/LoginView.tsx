import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { Text, TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useId, useRef, useState, type FormEvent } from 'react';
import './login-view.css';

/** Local form values, not a declaration of the backend login DTO. */
export interface LoginValues {
  login: string;
  password: string;
}

export interface LoginViewProps {
  onSubmit: (values: LoginValues) => void | Promise<void>;
  pending?: boolean;
  error?: string | null;
  initialAudience?: 'client' | 'employee';
}

export function LoginView({ onSubmit, pending = false, error, initialAudience = 'client' }: LoginViewProps) {
  const id = useId();
  const loginRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [audience, setAudience] = useState(initialAudience);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = pending || submitting;
  const employee = audience === 'employee';
  const message = submitError ?? error;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current) return;
    const nextErrors = {
      login: login.trim() ? undefined : 'Введите логин',
      password: password ? undefined : 'Введите пароль',
    };
    setFieldErrors(nextErrors);
    if (nextErrors.login || nextErrors.password) {
      (nextErrors.login ? loginRef : passwordRef).current?.focus();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({ login: login.trim(), password });
    } catch {
      // Raw transport errors may contain private details; the parent can pass safe text via error.
      setSubmitError('Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setPassword('');
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function changeAudience() {
    if (busy) return;
    setAudience(employee ? 'client' : 'employee');
    setPassword('');
    setFieldErrors({});
    setSubmitError(null);
  }

  return (
    <section className="login-view" aria-labelledby={`${id}-title`}>
      <div className="login-intro">
        <p className="eyebrow">{employee ? 'СОТРУДНИК БАНКА' : 'ДЛЯ ПРЕДПРИНИМАТЕЛЕЙ'}</p>
        <TitleDesktop tag="h1" view="medium" font="system" defaultMargins={false} id={`${id}-title`}>
          {employee ? 'Вход для сотрудников' : 'Вход в кабинет'}
        </TitleDesktop>
        <Text tag="p" view="primary-medium" className="login-description">
          {employee ? 'Рабочее место кредитного специалиста: рассмотрение заявок и кредитные решения.' : 'Заявки, условия финансирования и решения — в вашем личном кабинете.'}
        </Text>
        <div className="login-account-note">
          <span className="note-icon" aria-hidden="true">i</span>
          <p>Используйте свою учётную запись</p>
          <span>Доступ к разделам определяется после проверки учётных данных.</span>
        </div>
      </div>
      <div className="login-form-panel">
        <TitleDesktop tag="h2" view="xsmall" font="system" defaultMargins={false}>Данные для входа</TitleDesktop>
        <form noValidate onSubmit={(event) => { void submit(event); }} aria-label="Вход по учётной записи" aria-busy={busy}>
          <InputDesktop
            id={`${id}-login`} ref={loginRef} name="login" label="Логин" labelView="outer"
            value={login} autoComplete="username" autoCapitalize="none" spellCheck={false}
            required block disabled={busy} error={fieldErrors.login} aria-invalid={Boolean(fieldErrors.login)}
            onChange={(_event, { value }) => { setLogin(value); setFieldErrors((current) => ({ ...current, login: undefined })); }}
          />
          <InputDesktop
            id={`${id}-password`} ref={passwordRef} name="password" label="Пароль" labelView="outer" type="password"
            value={password} autoComplete="current-password" required block disabled={busy}
            error={fieldErrors.password} aria-invalid={Boolean(fieldErrors.password)}
            onChange={(_event, { value }) => { setPassword(value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
          />
          {message && <p className="login-error" role="alert">{message}</p>}
          <ButtonDesktop type="submit" size={48} view="primary" block disabled={busy}>
            {busy ? 'Выполняется вход…' : 'Войти'}
          </ButtonDesktop>
          {busy && <span className="login-progress" role="status">Проверяем учётные данные</span>}
        </form>
        <ButtonDesktop view="text" size={40} disabled={busy} onClick={changeAudience}>
          {employee ? 'Вход для предпринимателей' : 'Вход для сотрудников'}
        </ButtonDesktop>
      </div>
    </section>
  );
}
