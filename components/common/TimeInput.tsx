'use client';

import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 자동으로 HH:MM:SS 형식으로 포맷하는 시간 입력 컴포넌트
 * - 숫자만 입력 가능
 * - 자동으로 콜론(:) 추가
 * - "HH MM SS" 형식 붙여넣기 지원
 */
export function TimeInput({ value, onChange, placeholder = '00:00:00', className }: TimeInputProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const formatTime = (input: string): string => {
    // 숫자만 추출
    const numbers = input.replace(/\D/g, '');

    // 최대 6자리까지만 허용 (HHMMSS)
    const truncated = numbers.slice(0, 6);

    if (truncated.length === 0) return '';

    // 자동으로 콜론 삽입
    let formatted = '';
    for (let i = 0; i < truncated.length; i++) {
      if (i === 2 || i === 4) {
        formatted += ':';
      }
      formatted += truncated[i];
    }

    return formatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // 붙여넣기 시 공백으로 구분된 형식 처리 (예: "01 23 45" → "01:23:45")
    const normalized = inputValue.replace(/\s+/g, '');

    const formatted = formatTime(normalized);
    setDisplayValue(formatted);
    onChange(formatted);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    // "HH MM SS" 또는 "HHMMSS" 형식 처리
    const formatted = formatTime(pastedText);
    setDisplayValue(formatted);
    onChange(formatted);
  };

  const handleBlur = () => {
    // 포커스를 잃을 때 값 검증
    const numbers = displayValue.replace(/\D/g, '');

    if (numbers.length === 0) {
      setDisplayValue('');
      onChange('');
      return;
    }

    // 6자리 미만이면 앞에 0 채우기
    const padded = numbers.padStart(6, '0');
    const formatted = formatTime(padded);
    setDisplayValue(formatted);
    onChange(formatted);
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onPaste={handlePaste}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      maxLength={8} // HH:MM:SS = 8 characters
    />
  );
}
