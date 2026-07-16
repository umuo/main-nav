import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

interface CaptchaProps {
  onValidate: (isValid: boolean, token: string, answer: string) => void;
}

const Captcha: React.FC<CaptchaProps> = ({ onValidate }) => {
  const { t } = useTranslation();
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [token, setToken] = useState('');
  const [userInput, setUserInput] = useState('');

  const generateCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/captcha/generate');
      if (!res.ok) throw new Error('Captcha request failed');
      const data = await res.json();
      setNum1(data.num1);
      setNum2(data.num2);
      setToken(data.token);
      setUserInput('');
      onValidate(false, '', '');
    } catch (error) {
      console.error('Failed to generate captcha:', error);
    }
  }, [onValidate]);

  useEffect(() => {
    // Loading a new server challenge after mount intentionally resets the form state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generateCaptcha();
  }, [generateCaptcha]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserInput(val);

    if (val) {
      try {
        const res = await fetch('/api/captcha/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, answer: val })
        });
        const data = await res.json();
        onValidate(data.valid, token, val);
      } catch {
        onValidate(false, token, val);
      }
    } else {
      onValidate(false, token, val);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-stretch gap-2">
        <div className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--surface-muted)] px-4 font-mono text-base font-bold tracking-wider text-[var(--text-primary)]">
          {num1} + {num2} = ?
        </div>
        <button
          type="button"
          onClick={generateCaptcha}
          className="icon-button flex w-11 items-center justify-center rounded-xl"
          title={t('login.refreshCaptcha')}
          aria-label={t('login.refreshCaptcha')}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <input
        type="number"
        placeholder={t('login.enterCode')}
        value={userInput}
        onChange={handleInputChange}
        className="field-control rounded-xl px-4 py-3 text-sm"
      />
    </div>
  );
};

export default Captcha;
