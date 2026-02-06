import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({ label, leftIcon, rightIcon, className, ...props }: InputProps) {
  const classNames = `
    input-wrapper
    ${className || ''}
  `;

  return (
    <div className={classNames}>
      {label && <label className="input-label">{label}</label>}
      <div className="input-field">
        {leftIcon && <span className="input-icon input-icon--left">{leftIcon}</span>}
        <input {...props} />
        {rightIcon && <span className="input-icon input-icon--right">{rightIcon}</span>}
      </div>
    </div>
  );
}
