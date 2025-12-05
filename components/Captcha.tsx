import React, { useState, useEffect } from 'react';
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

  const generateCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha/generate');
      const data = await res.json();
      setNum1(data.num1);
      setNum2(data.num2);
      setToken(data.token);
      setUserInput('');
      onValidate(false, '', '');
    } catch (error) {
      console.error('Failed to generate captcha:', error);
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

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
      } catch (error) {
        onValidate(false, token, val);
      }
    } else {
      onValidate(false, token, val);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="px-4 py-3 bg-gray-100 rounded border border-gray-300 text-lg font-mono font-bold text-gray-700">
          {num1} + {num2} = ?
        </div>
        <button
          type="button"
          onClick={generateCaptcha}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
        >
          <RefreshCw size={20} />
        </button>
      </div>
      <input
        type="number"
        placeholder={t('login.enterCode')}
        value={userInput}
        onChange={handleInputChange}
        className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
};

export default Captcha;
