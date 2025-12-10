import { useEffect } from "react";
import { KBarProvider, KBarPortal, KBarPositioner, KBarAnimator, KBarSearch, useMatches } from "kbar";
import { commands } from "./commands";
import type { ReactNode } from "react";
import { interactionManager } from "../three/interactionManager";
import { useToast } from "./Toast";

const searchStyle = {
  padding: '12px 16px',
  fontSize: '16px',
  width: '100%',
  boxSizing: 'border-box' as const,
  outline: 'none',
  border: 'none',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
};

const animatorStyle = {
  maxWidth: '600px',
  width: '100%',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  border: '1px solid var(--border-color)',
};

const groupNameStyle = {
  padding: '8px 16px',
  fontSize: '10px',
  textTransform: 'uppercase' as const,
  opacity: 0.5,
  letterSpacing: '1px',
};

function RenderResults() {
  const { results } = useMatches();

  return (
    <div className="kbar-results">
      {results.map((item, index) => (
        <div
          key={typeof item === 'string' ? item : item.id}
          className="kbar-item"
          style={{
            padding: '12px 16px',
            background: index === 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
            borderLeft: index === 0 ? '2px solid var(--accent)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          {typeof item === 'string' ? (
            <div style={groupNameStyle}>{item}</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</span>
                {item.subtitle && (
                  <span style={{ fontSize: '12px', opacity: 0.6 }}>{item.subtitle}</span>
                )}
              </div>
              {item.shortcut && (
                <div style={{ display: 'grid', gridAutoFlow: 'column', gap: '4px' }}>
                  {item.shortcut.map((sc) => (
                    <kbd
                      key={sc}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {sc}
                    </kbd>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function CommandPalette({ children }: { children: ReactNode }) {
  const { addToast } = useToast();
  
  // Handle global Escape key to turn off tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if KBar is not open (KBar handles its own Esc)
      // Actually, we want Esc to turn off tools regardless, but KBar usually swallows Esc when open.
      // If KBar is closed, this listener will catch Esc.
      if (e.key === 'Escape') {
        if (interactionManager.enabled) {
          interactionManager.toggle(false);
          addToast('Tools: Off', 'info');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addToast]);

  return (
    <KBarProvider actions={commands}>
      <KBarPortal>
        <KBarPositioner style={{ zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <KBarAnimator style={animatorStyle}>
                <KBarSearch style={searchStyle} placeholder="Type a command or search..." />
                <RenderResults />
            </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </KBarProvider>
  );
}
