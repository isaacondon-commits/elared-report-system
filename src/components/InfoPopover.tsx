import { useState } from 'react';

type InfoPopoverProps = {
  texto: string;
};

export function InfoPopover({ texto }: InfoPopoverProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onClick={e => { e.stopPropagation(); setVisible(v => !v); }}
        style={{
          cursor: 'pointer',
          fontSize: '14px',
          color: '#003DA5',
          marginLeft: '6px',
          userSelect: 'none',
        }}
      >
        ℹ️
      </span>
      {visible && (
        <>
          {/* overlay para cerrar al clickear afuera */}
          <div
            onClick={e => { e.stopPropagation(); setVisible(false); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99,
            }}
          />
          <div style={{
            position: 'absolute',
            top: '24px',
            left: '0',
            zIndex: 100,
            backgroundColor: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '12px 16px',
            width: '320px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            fontSize: '13px',
            color: '#1A1A2E',
            lineHeight: '1.5',
          }}
          onClick={e => e.stopPropagation()}
          >
            {texto}
          </div>
        </>
      )}
    </div>
  );
}
