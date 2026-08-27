import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, FileText, Plus, Save, RotateCcw, Trash2, Loader2, AlertTriangle,
  CheckCircle2, X, Upload,
} from 'lucide-react';
import {
  contarPlaceholders, PLACEHOLDERS_ESPERADOS, DOCX_MIME,
} from './contratosParser';
import {
  agregarPlantilla, eliminarPlantilla, guardarDocx, restaurarBuiltin,
  type PlantillaRecord,
} from './plantillasStore';
import { extraerParrafos, aplicarEdiciones, type ParrafoDocx } from './docxTextEdit';

interface Props {
  plantillas: PlantillaRecord[];
  loading: boolean;
  selId: string | null;
  onSelect: (id: string | null) => void;
  onCambio: (idAseleccionar?: string) => void;
}

function fechaLegible(ts: number): string {
  return new Date(ts).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Textarea que crece con el contenido — para no tener scrolls internos por párrafo.
function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

export default function PlantillasOriginales({ plantillas, loading, selId, onSelect, onCambio }: Props) {
  const [parrafos, setParrafos] = useState<ParrafoDocx[]>([]);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [cargandoParrafos, setCargandoParrafos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmarMismatch, setConfirmarMismatch] = useState(false);
  const [agregando, setAgregando] = useState(false);

  // Selección efectiva: si la elegida ya no existe (recién borrada), cae a la primera.
  const seleccionada = plantillas.find(p => p.id === selId) ?? plantillas[0] ?? null;

  const porEmpresa = useMemo(() => {
    const map = new Map<string, PlantillaRecord[]>();
    for (const p of plantillas) {
      const arr = map.get(p.empresa) ?? [];
      arr.push(p);
      map.set(p.empresa, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [plantillas]);

  const empresasExistentes = useMemo(
    () => [...new Set(plantillas.map(p => p.empresa))].sort((a, b) => a.localeCompare(b, 'es')),
    [plantillas],
  );

  // Cargar los párrafos editables del .docx seleccionado.
  useEffect(() => {
    let cancelado = false;
    const run = async () => {
      setError('');
      setAviso('');
      setConfirmarMismatch(false);
      if (!seleccionada) { setParrafos([]); setValores({}); return; }
      setCargandoParrafos(true);
      try {
        const ps = await extraerParrafos(seleccionada.docx);
        if (cancelado) return;
        setParrafos(ps);
        setValores(Object.fromEntries(ps.map(p => [p.indice, p.texto])));
      } catch (e) {
        if (!cancelado) setError((e as Error).message || 'No se pudo leer el .docx.');
      } finally {
        if (!cancelado) setCargandoParrafos(false);
      }
    };
    void run();
    return () => { cancelado = true; };
  }, [seleccionada?.id, seleccionada?.actualizada]); // eslint-disable-line react-hooks/exhaustive-deps

  const indicesCambiados = parrafos.filter(p => (valores[p.indice] ?? '') !== p.texto).map(p => p.indice);
  const hayCambios = indicesCambiados.length > 0;

  const placeholdersActuales = parrafos.reduce(
    (n, p) => n + ((valores[p.indice] ?? p.texto).match(/XXXXXXXX/g)?.length ?? 0),
    0,
  );
  const placeholdersOk = placeholdersActuales === PLACEHOLDERS_ESPERADOS;

  async function handleGuardar() {
    if (!seleccionada || !hayCambios) return;
    if (!placeholdersOk && !confirmarMismatch) {
      setConfirmarMismatch(true);
      setAviso(`Detectamos ${placeholdersActuales} campos "XXXXXXXX" y el armado necesita ${PLACEHOLDERS_ESPERADOS}. Volvé a tocar "Guardar" para hacerlo igual.`);
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const ediciones: Record<number, string> = {};
      for (const i of indicesCambiados) ediciones[i] = valores[i];
      const nuevoBlob = await aplicarEdiciones(seleccionada.docx, ediciones);
      await guardarDocx(seleccionada.id, nuevoBlob);
      setAviso('Cambios guardados.');
      setConfirmarMismatch(false);
      onCambio(seleccionada.id);
    } catch (e) {
      setError((e as Error).message || 'No se pudieron guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  function handleDescartar() {
    setValores(Object.fromEntries(parrafos.map(p => [p.indice, p.texto])));
    setConfirmarMismatch(false);
    setAviso('');
    setError('');
  }

  async function handleRestaurar() {
    if (!seleccionada) return;
    if (!confirm(`¿Restaurar "${seleccionada.empresa} · ${seleccionada.area}" al contrato original de la app? Se pierden las ediciones guardadas.`)) return;
    setGuardando(true);
    setError('');
    try {
      await restaurarBuiltin(seleccionada.id);
      setAviso('Plantilla restaurada al original.');
      onCambio(seleccionada.id);
    } catch (e) {
      setError((e as Error).message || 'No se pudo restaurar.');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!seleccionada) return;
    if (!confirm(`¿Eliminar la plantilla "${seleccionada.empresa} · ${seleccionada.area}"? Esta acción no se puede deshacer.`)) return;
    setGuardando(true);
    setError('');
    try {
      await eliminarPlantilla(seleccionada.id);
      onSelect(null);
      onCambio();
    } catch (e) {
      setError((e as Error).message || 'No se pudo eliminar.');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Cargando plantillas…
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Lista + Agregar */}
      <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4">
        <button
          onClick={() => { setAgregando(true); setError(''); setAviso(''); }}
          className="w-full flex items-center justify-center gap-2 bg-[#003DA5] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-800 transition-colors mb-4"
        >
          <Plus size={15} /> Agregar contrato
        </button>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Editá el texto de un contrato cuando cambie una condición contractual.
          Mantené los campos <code>XXXXXXXX</code> (son los datos que completa el armado).
        </p>

        {porEmpresa.map(([empresa, items]) => (
          <div key={empresa} className="mb-5">
            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              <Building2 size={12} /> {empresa}
              <span className="ml-auto font-medium text-gray-400 normal-case">{items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map(p => {
                const isSel = p.id === selId;
                return (
                  <button
                    key={p.id}
                    onClick={() => { onSelect(p.id); setAgregando(false); }}
                    className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                      isSel ? 'border-[#003DA5] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <FileText size={14} className="text-[#003DA5] flex-shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-gray-800 truncate">{p.area}</span>
                      <span className="block text-[11px] text-gray-400">actualizada {fechaLegible(p.actualizada)}</span>
                    </span>
                    {p.builtin
                      ? p.modificada
                        ? <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 flex-shrink-0">Modif.</span>
                        : <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0">Original</span>
                      : <span className="text-[10px] font-semibold text-[#003DA5] bg-blue-50 rounded px-1.5 py-0.5 flex-shrink-0">Cargada</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Editor / Alta */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {agregando ? (
          <FormAgregar
            empresasExistentes={empresasExistentes}
            onCancelar={() => setAgregando(false)}
            onCreada={(id) => { setAgregando(false); onCambio(id); }}
          />
        ) : !seleccionada ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Seleccioná una plantilla para editar su texto.
          </div>
        ) : (
          <>
            {/* Barra de acciones */}
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 truncate">
                  {seleccionada.empresa} · {seleccionada.area}
                </h3>
                <p className={`text-[11px] flex items-center gap-1 ${placeholdersOk ? 'text-gray-400' : 'text-amber-600'}`}>
                  {placeholdersOk
                    ? <><CheckCircle2 size={11} className="text-green-600" /> {placeholdersActuales}/{PLACEHOLDERS_ESPERADOS} campos automáticos</>
                    : <><AlertTriangle size={11} /> {placeholdersActuales}/{PLACEHOLDERS_ESPERADOS} campos "XXXXXXXX"</>}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {seleccionada.builtin && seleccionada.modificada && (
                  <button
                    onClick={handleRestaurar}
                    disabled={guardando}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    <RotateCcw size={13} /> Restaurar original
                  </button>
                )}
                {!seleccionada.builtin && (
                  <button
                    onClick={handleEliminar}
                    disabled={guardando}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                )}
                <button
                  onClick={handleDescartar}
                  disabled={!hayCambios || guardando}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Descartar
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={!hayCambios || guardando || placeholdersActuales < PLACEHOLDERS_ESPERADOS}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-[#003DA5] hover:bg-blue-800 disabled:opacity-40 transition-colors"
                >
                  {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Guardar cambios{hayCambios ? ` (${indicesCambiados.length})` : ''}
                </button>
              </div>
            </div>

            {(error || aviso) && (
              <div className={`px-5 py-2 text-xs flex items-center gap-2 border-b ${
                error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-[#003DA5]'
              }`}>
                {error ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                <span>{error || aviso}</span>
              </div>
            )}

            {/* Párrafos */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {cargandoParrafos ? (
                <div className="flex items-center justify-center text-gray-400 text-sm gap-2 mt-10">
                  <Loader2 size={16} className="animate-spin" /> Leyendo el documento…
                </div>
              ) : parrafos.length === 0 && !error ? (
                <p className="text-sm text-gray-400 text-center mt-10">Este .docx no tiene texto editable.</p>
              ) : (
                <div className="max-w-[820px] mx-auto space-y-2">
                  <p className="text-[11px] text-gray-400 mb-3">
                    Cada bloque es un párrafo del contrato. Editá el texto directamente; se guarda solo lo que cambies.
                  </p>
                  {parrafos.map(p => {
                    const cambiado = (valores[p.indice] ?? '') !== p.texto;
                    return (
                      <div key={p.indice} className="relative">
                        <AutoTextarea
                          value={valores[p.indice] ?? ''}
                          onChange={e => setValores(v => ({ ...v, [p.indice]: e.target.value }))}
                          className={`w-full resize-none border rounded-lg px-3 py-2 text-[13px] leading-relaxed font-serif focus:outline-none focus:ring-1 focus:ring-[#003DA5] focus:border-[#003DA5] ${
                            cambiado ? 'border-[#003DA5] bg-blue-50/40' : 'border-gray-200 bg-white'
                          }`}
                        />
                        {p.multiFormato && (
                          <span
                            title="Este párrafo mezcla formatos (negrita/subrayado en parte del texto). Si lo editás, queda con un formato uniforme."
                            className="absolute top-1.5 right-2 text-amber-500"
                          >
                            <AlertTriangle size={12} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Formulario "Agregar contrato" ────────────────────────────────────────────

function FormAgregar({
  empresasExistentes,
  onCancelar,
  onCreada,
}: {
  empresasExistentes: string[];
  onCancelar: () => void;
  onCreada: (id: string) => void;
}) {
  const [empresa, setEmpresa] = useState('');
  const [area, setArea] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [placeholders, setPlaceholders] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function handleArchivo(f: File | null) {
    setArchivo(f);
    setPlaceholders(null);
    setError('');
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.docx')) {
      setError('El archivo tiene que ser un .docx de Word.');
      setArchivo(null);
      return;
    }
    try {
      setPlaceholders(contarPlaceholders(await f.arrayBuffer()));
    } catch {
      setError('No se pudo leer el .docx.');
      setArchivo(null);
    }
  }

  async function handleCrear() {
    if (!empresa.trim() || !area.trim() || !archivo) {
      setError('Completá empresa, área y subí el .docx.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const docx = new Blob([await archivo.arrayBuffer()], { type: DOCX_MIME });
      const rec = await agregarPlantilla({ empresa: empresa.trim(), area: area.trim(), docx });
      onCreada(rec.id);
    } catch (e) {
      setError((e as Error).message || 'No se pudo crear la plantilla.');
    } finally {
      setGuardando(false);
    }
  }

  const phMal = placeholders !== null && placeholders !== PLACEHOLDERS_ESPERADOS;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[560px] mx-auto bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-800">Agregar contrato</h3>
          <button onClick={onCancelar} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed mb-5">
          Subí el <b>.docx</b> del contrato con <code>XXXXXXXX</code> en los 6 lugares que completa el armado,
          en este orden: <b>día, mes, año, nombre, cédula, dirección</b>.
          Una vez cargado, la empresa y el área aparecen en los desplegables de <b>Armado</b>.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Empresa</label>
            <input
              list="empresas-existentes"
              value={empresa}
              onChange={e => setEmpresa(e.target.value)}
              placeholder="Elared, Phonehouse…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
            <datalist id="empresas-existentes">
              {empresasExistentes.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Área</label>
            <input
              value={area}
              onChange={e => setArea(e.target.value)}
              placeholder="Móvil, Fibra, Back Office…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Archivo .docx</label>
          <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
            <Upload size={15} className="text-[#003DA5]" />
            {archivo ? archivo.name : 'Elegir archivo…'}
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={e => handleArchivo(e.target.files?.[0] ?? null)}
            />
          </label>
          {placeholders !== null && (
            <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${phMal ? 'text-amber-600' : 'text-green-600'}`}>
              {phMal ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
              {placeholders} campos <code>XXXXXXXX</code> detectados{phMal ? ` (se esperan ${PLACEHOLDERS_ESPERADOS})` : ''}.
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={guardando || !empresa.trim() || !area.trim() || !archivo}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-[#003DA5] hover:bg-blue-800 disabled:opacity-40"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
