import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: Props) => {
  const [animacionTerminada, setAnimacionTerminada] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimacionTerminada(true);
    }, 2900);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    if (!animacionTerminada) return;
    setSaliendo(true);
    setTimeout(() => onComplete(), 500);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000000',
        zIndex: 9999,
        cursor: animacionTerminada ? 'pointer' : 'default',
        animation: saliendo
          ? 'splashExit 0.5s ease forwards'
          : 'splashFadeIn 1s ease forwards',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* IMAGEN FULL SCREEN */}
      <img
        src="./splash-logo.png"
        alt="Eficiencia"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
        }}
      />

      {/* OVERLAY para legibilidad de elementos inferiores */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '120px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
      }} />

      {/* BARRA DE CARGA */}
      <div style={{
        position: 'absolute',
        bottom: '50px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '200px',
        height: '2px',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          backgroundColor: '#003DA5',
          boxShadow: '0 0 8px #003DA5',
          animation: 'loadingBar 2.8s ease forwards',
        }} />
      </div>

      {/* TOCA PARA CONTINUAR */}
      {animacionTerminada && (
        <div style={{
          position: 'absolute',
          bottom: '22px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#CADCFC',
          fontSize: '11px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          animation: 'pulse 1.5s ease-in-out infinite',
          whiteSpace: 'nowrap',
        }}>
          ⌄ TOCA PARA CONTINUAR ⌄
        </div>
      )}
    </div>
  );
};

export default SplashScreen;
