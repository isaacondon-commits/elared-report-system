import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const [animacionTerminada, setAnimacionTerminada] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimacionTerminada(true), 2900);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    if (!animacionTerminada || saliendo) return;
    setSaliendo(true);
    setTimeout(() => onComplete(), 500);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: animacionTerminada ? 'pointer' : 'default',
        animation: saliendo ? 'splashExit 0.5s cubic-bezier(0.4,0,1,1) forwards' : undefined,
      }}
    >
      {/* Logo */}
      <div style={{ animation: 'splashFadeIn 1.2s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
        <img
          src="./splash-logo.png"
          alt="Eficiencia"
          style={{ height: 420, objectFit: 'contain' }}
        />
      </div>

      {/* "EL PODER DE LA" */}
      <div style={{
        color: '#CADCFC', fontSize: 14, letterSpacing: 6,
        textTransform: 'uppercase', marginTop: 24,
        animation: 'splashFadeIn 0.6s ease 0.9s both',
      }}>
        EL PODER DE LA
      </div>

      {/* "EFICIENCIA" */}
      <div style={{
        background: 'linear-gradient(135deg, #003DA5 0%, #7B68EE 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        fontSize: 72, fontWeight: 900, letterSpacing: 8,
        filter: 'drop-shadow(0 0 20px rgba(0,100,255,0.7))',
        lineHeight: 1.1, paddingBottom: 4,
        animation: 'splashFadeIn 0.8s cubic-bezier(0.16,1,0.3,1) 1.1s both',
      }}>
        EFICIENCIA
      </div>

      {/* "IA + ESTRATEGIA + AUTOMATIZACIÓN" */}
      <div style={{
        color: '#20c997', fontSize: 13, letterSpacing: 4,
        textTransform: 'uppercase', marginTop: 16,
        animation: 'splashFadeIn 0.5s ease 1.5s both',
      }}>
        IA + ESTRATEGIA + AUTOMATIZACIÓN
      </div>

      {/* "CRECEMOS JUNTOS" */}
      <div style={{
        color: '#CADCFC', fontSize: 12, letterSpacing: 3,
        marginTop: 10,
        animation: 'splashFadeIn 0.5s ease 1.7s both',
      }}>
        CRECEMOS JUNTOS
      </div>

      {/* Loading bar */}
      <div style={{
        position: 'absolute', bottom: 60,
        left: '50%', transform: 'translateX(-50%)',
        width: 200, height: 2,
        background: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: '0%', height: '100%',
          background: '#003DA5',
          boxShadow: '0 0 8px #003DA5',
          animation: 'loadingBar 2.5s ease 0.2s both',
        }} />
      </div>

      {/* TOCA PARA CONTINUAR */}
      <div style={{
        position: 'absolute', bottom: 45,
        left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 3,
        opacity: animacionTerminada ? 1 : 0,
        transition: 'opacity 0.5s ease',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        <div style={{
          color: '#CADCFC', fontSize: 13, letterSpacing: 2,
          animation: animacionTerminada ? 'pulse 1.2s ease-in-out infinite' : undefined,
        }}>
          ⌄⌄
        </div>
        <div style={{
          color: '#CADCFC', fontSize: 11,
          letterSpacing: 3, textTransform: 'uppercase',
          animation: animacionTerminada ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}>
          TOCA PARA CONTINUAR
        </div>
      </div>
    </div>
  );
}
