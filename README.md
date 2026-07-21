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

## Firestore — reglas de seguridad

El botón "Eliminar" en Administración de Usuarios (`src/pages/admin/UsuariosPage.tsx`)
llama a `deleteDoc(doc(db, 'usuarios', uid))`. Si las reglas de Firestore no
incluyen permiso de `delete` en la colección `usuarios`, la llamada falla en
el navegador con `permission-denied` (el modal de confirmación va a mostrar
ese error). Verificar en la consola de Firebase → Firestore → Reglas que
exista algo equivalente a:

```
match /usuarios/{uid} {
  allow delete: if request.auth != null &&
    get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
}
```

Si las reglas solo tienen `allow get, list, create, update` (sin `delete`,
y sin un `allow write` que lo cubra), hay que agregar la línea de arriba y
publicar las reglas desde la consola de Firebase — no hay forma de aplicarlas
desde este repo, no están versionadas acá.

## Clonar en otra PC

1. Instalar Node.js (https://nodejs.org)
2. Instalar Git (https://git-scm.com)
3. Abrir terminal y ejecutar:

```
git clone https://github.com/isaacondon-commits/elared-report-system.git
cd elared-report-system
npm install
npm run dev
```

4. Abrir http://localhost:5173 en el navegador

## Para actualizar desde GitHub (si ya está clonado)

```
git pull origin master
npm install  (solo si cambiaron dependencias)
npm run dev
```

## Sincronizar cambios (sync.bat)

Ejecutar `sync.bat` desde la raíz del proyecto hace commit y push
automático de todos los cambios pendientes a `origin/master`. Útil para
sincronizar rápido entre PCs sin escribir los comandos de git a mano.

## Changelog — 2026-07-17

### Usuarios — eliminar
- Modal de confirmación ahora muestra "¿Eliminar a [nombre]?" como título
  (antes decía "¿Eliminar usuario?" genérico).
- Si `deleteDoc` falla con `permission-denied`, el modal ahora explica que es
  un problema de reglas de Firestore en vez de mostrar el mensaje crudo de
  Firebase (ver sección de arriba).

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
