# ELARED — Sistema de Reportes

Sistema de análisis automático de reportes del call center. Todo el procesamiento ocurre localmente en el navegador.

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4, Firebase (Auth + Firestore), Recharts, pptxgenjs, xlsx, jsPDF

## Desarrollo

```
npm install
npm run dev      # http://localhost:5173
npm run build    # build de producción
```

## Changelog — 2026-06-09

### Sidebar colapsable (UX)
- Props collapsed/onToggle en Sidebar.tsx
- Colapsado: solo iconos + tooltips; expandido: layout completo con labels
- Estado persistido en localStorage, inicia colapsado en pantallas < 1200px
- Main content transiciona ml-16/ml-60 con CSS smooth

### Activity tracking en HomePage
- src/utils/activityTracker.ts: recordActivity(), getAllActivity(), formatActivityDate()
- Todos los módulos registran el último archivo cargado
- Cards del Home muestran "Último análisis: hace X" o "Sin datos cargados"
- Comisiones Móvil y Fibra promovidos de "En desarrollo" a "Módulos activos"

### Ventas — columna "Días activos"
- FuncionarioStat.diasActivos: días únicos con ventas por vendedor
- Columna nueva en tabla de performance entre Total y Renovaciones

### Vicidial — Mejoras de layout y performance
- Layout estándar con Header sticky en todos los estados (upload/loading/analysis)
- useMemo en sortAgentes para evitar re-sorts en cada render
- Tooltip en columna Venta explicando que es tiempo productivo
- recordActivity al parsear archivo exitosamente

### Comisiones — Calculadora de Proyección
- Pestaña Proyección independiente del Excel
- Calcula comisión en tiempo real, barra de progreso, tarjeta de impacto
- Export Excel y copiar resumen al portapapeles
