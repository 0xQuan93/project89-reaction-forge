import React from 'react';
import './Panel.css';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
}

export function Panel({ title, children, className, ...props }: PanelProps) {
  const classNames = `
    panel
    ${className || ''}
  `;

  return (
    <div className={classNames} {...props}>
      {title && (
        <div className="panel__header">
          <h2 className="panel__title">{title}</h2>
        </div>
      )}
      <div className="panel__body">{children}</div>
    </div>
  );
}
