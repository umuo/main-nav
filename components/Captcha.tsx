import Script from 'next/script';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const TURNSTILE_LOAD_TIMEOUT_MS = 15_000;

type TurnstileWidgetId = string;

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  language: string;
  theme: 'auto';
  retry: 'auto';
  'response-field': false;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'error-callback': (code: string) => boolean;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => TurnstileWidgetId;
  remove: (widgetId: TurnstileWidgetId) => void;
  reset: (widgetId: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface CaptchaProps {
  onValidate: (token: string) => void;
}

type ChallengeState = 'loading' | 'ready' | 'verified' | 'expired' | 'error' | 'configuration-error';

const Captcha: React.FC<CaptchaProps> = ({ onValidate }) => {
  const { t, language } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [challengeState, setChallengeState] = useState<ChallengeState>(
    TURNSTILE_SITE_KEY ? 'loading' : 'configuration-error'
  );

  const clearToken = useCallback((state: ChallengeState) => {
    onValidate('');
    setChallengeState(state);
  }, [onValidate]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || scriptReady) return;

    const timeout = window.setTimeout(
      () => clearToken('error'),
      TURNSTILE_LOAD_TIMEOUT_MS
    );
    return () => window.clearTimeout(timeout);
  }, [clearToken, scriptReady]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !scriptReady || !containerRef.current || !window.turnstile) return;

    let active = true;
    queueMicrotask(() => {
      if (active) onValidate('');
    });

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: 'admin_login',
        language: language === 'zh' ? 'zh-cn' : 'en',
        theme: 'auto',
        retry: 'auto',
        'response-field': false,
        callback: token => {
          onValidate(token);
          setChallengeState('verified');
        },
        'expired-callback': () => clearToken('expired'),
        'timeout-callback': () => clearToken('expired'),
        'error-callback': () => {
          clearToken('error');
          return true;
        },
      });
      widgetIdRef.current = widgetId;
    } catch {
      queueMicrotask(() => {
        if (active) clearToken('error');
      });
    }

    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [clearToken, language, onValidate, scriptReady]);

  const resetChallenge = () => {
    if (!widgetIdRef.current || !window.turnstile) {
      window.location.reload();
      return;
    }
    clearToken('ready');
    window.turnstile.reset(widgetIdRef.current);
  };

  const isLoading = challengeState === 'loading' || challengeState === 'ready';
  const hasError = challengeState === 'error' || challengeState === 'configuration-error';

  return (
    <div className="space-y-2.5">
      {TURNSTILE_SITE_KEY && (
        <Script
          id="cloudflare-turnstile-script"
          src={TURNSTILE_SCRIPT_URL}
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() => clearToken('error')}
        />
      )}

      <div className="relative min-h-[4.25rem] overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--surface-muted)] p-2">
        {isLoading && !scriptReady && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
            <LoaderCircle size={16} className="animate-spin" />
            {t('login.captchaLoading')}
          </div>
        )}
        {challengeState === 'configuration-error' && (
          <div className="flex min-h-12 items-center justify-center gap-2 px-3 text-center text-sm font-medium text-[var(--status-offline-text)]">
            <CircleAlert size={16} className="flex-none" />
            {t('login.captchaConfigError')}
          </div>
        )}
        <div ref={containerRef} className="flex min-h-12 w-full items-center justify-center" />
      </div>

      <div className="flex min-h-6 items-center justify-between gap-3 text-xs font-medium">
        <span className={`flex items-center gap-1.5 ${
          challengeState === 'verified'
            ? 'text-[var(--status-online-text)]'
            : hasError || challengeState === 'expired'
              ? 'text-[var(--status-offline-text)]'
              : 'text-[var(--text-tertiary)]'
        }`}>
          {challengeState === 'verified' ? (
            <><CheckCircle2 size={13} /> {t('login.captchaCorrect')}</>
          ) : challengeState === 'expired' ? (
            <><CircleAlert size={13} /> {t('login.captchaExpired')}</>
          ) : hasError ? (
            <><CircleAlert size={13} /> {t('login.captchaLoadError')}</>
          ) : (
            <><ShieldCheck size={13} /> {t('login.captchaManaged')}</>
          )}
        </span>

        {(challengeState === 'expired' || challengeState === 'error') && (
          <button
            type="button"
            onClick={resetChallenge}
            className="flex items-center gap-1 font-semibold text-[var(--accent-color)] hover:underline"
          >
            <RefreshCw size={12} /> {t('login.refreshCaptcha')}
          </button>
        )}
      </div>
    </div>
  );
};

export default Captcha;
