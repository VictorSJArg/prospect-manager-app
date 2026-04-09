import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit, where, getDocs, updateDoc, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const DEFAULT_WIDTHS = {
  name: 240,
  phone: 140,
  status: 140,
  priority: 130,
  details: 300,
  message: 300,
  observation: 250,
  action: 140
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [lastActions, setLastActions] = useState<Record<string, any>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [showReminders, setShowReminders] = useState(false);
  const [showHighPotential, setShowHighPotential] = useState(false);
  const [availablePriorities, setAvailablePriorities] = useState<string[]>(['Baja', 'Media', 'Alta', 'Crítica']);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>(['Sin Análisis', 'Analizado', 'En Proceso', 'Citado', 'Urgente', 'Finalizado', 'Archivado']);
  const [dbError, setDbError] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editDetailsDraft, setEditDetailsDraft] = useState('');

  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('colWidths');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved); 
        return { ...DEFAULT_WIDTHS, ...parsed };
      } catch (e) {}
    }
    return DEFAULT_WIDTHS;
  });

  useEffect(() => {
    localStorage.setItem('colWidths', JSON.stringify(columns));
  }, [columns]);
  
  const startResize = (e: React.MouseEvent, id: keyof typeof DEFAULT_WIDTHS) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = columns[id];

    const doDrag = (dragEvent: MouseEvent) => {
      const newWidth = Math.max(80, startW + dragEvent.clientX - startX);
      setColumns((prev: any) => ({ ...prev, [id]: newWidth }));
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  };

  const gridTemplate = `${columns.name}px ${columns.phone}px ${columns.status}px ${columns.priority}px ${columns.details}px ${columns.message}px ${columns.observation}px ${columns.action}px`;

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          if (docSnap.data().priorities) setAvailablePriorities(docSnap.data().priorities);
          if (docSnap.data().statuses) setAvailableStatuses(docSnap.data().statuses);
        }
      } catch (error) {}
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'leads'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const leadsData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setLeads(leadsData);
      setDbError(null);

      const actions: Record<string, any> = {};
      const messages: Record<string, any> = {};

      for (const lead of leadsData) {
        try {
          const obsQ = query(
            collection(db, 'observations'),
            where('leadId', '==', lead.id),
            orderBy('createdAt', 'desc')
          );
          const obsSnap = await getDocs(obsQ);
          const docs = obsSnap.docs.map(d => d.data());
          if (docs.length > 0) {
            actions[lead.id] = docs[0];
            const lastMsg = docs.find(d => d.category === 'client_message');
            if (lastMsg) messages[lead.id] = lastMsg;
          }
        } catch (_) { /* ignore */ }
      }
      setLastActions(actions);
      setLastMessages(messages);
    }, (error) => {
      console.error('Firestore error:', error.message);
      setDbError('Sin permisos para acceder a los datos. Verifica las reglas de Firestore.');
    });
    return unsubscribe;
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Urgente': return 'bg-error';
      case 'Sin Análisis': return 'bg-outline-variant';
      case 'En Proceso': return 'bg-surface-tint';
      case 'Analizado': return 'bg-primary';
      default: return 'bg-outline-variant';
    }
  };

  // Collect unique statuses for the filter
  const allStatuses = Array.from(new Set(leads.map(l => l.status || 'Sin Análisis')));

  const filteredLeads = leads.filter(lead => {
    if (showReminders || showHighPotential) {
      if (showReminders && !lead.followUpDate) return false;
      if (showHighPotential && !lead.isHighPotential) return false;
    } else {
      if (statusFilter !== 'Todos' && (lead.status || 'Sin Análisis') !== statusFilter) return false;
      if (priorityFilter !== 'Todas' && (lead.priority || 'Media') !== priorityFilter) return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(term) ||
      lead.phone?.toLowerCase().includes(term) ||
      lead.dni?.toLowerCase().includes(term)
    );
  });

  if (showReminders) {
    filteredLeads.sort((a, b) => {
      const dateA = new Date(a.followUpDate || '9999-12-31').getTime();
      const dateB = new Date(b.followUpDate || '9999-12-31').getTime();
      return dateA - dateB;
    });
  }

  const [exportSuccess, setExportSuccess] = useState(false);

  const exportToTXT = () => {
    // Helper inline to clean cell values: replaces line breaks and pipes with spaces
    const clean = (v: any): string => {
      if (v === null || v === undefined) return '';
      return String(v).replace(/[\r\n|]+/g, ' ').trim();
    };

    try {
      const sep = ' | ';
      const lines: string[] = [];
      lines.push(['Nombre', 'DNI', 'Telefono', 'Estado', 'Prioridad', 'Resumen', 'Mensaje Enviado', 'Ultima Observacion', 'Fecha de Carga', 'Ultima Accion'].join(sep));

      for (const lead of filteredLeads) {
        const lastAction = lastActions[lead.id];
        const lastMsg = lastMessages[lead.id];
        let fecha = 'Sin fecha';
        try { if (lead.createdAt) fecha = format(lead.createdAt.toDate(), 'dd/MM/yyyy HH:mm'); } catch(_) {}
        let accion = 'Sin actividad';
        try { if (lastAction?.createdAt) accion = formatDistanceToNow(lastAction.createdAt.toDate(), { locale: es }); } catch(_) {}
        const obsValue = lastAction ? (lastAction.type === 'audio' ? 'Mensaje de audio' : lastAction.content) : '';

        const cells = [
          clean(lead.name),
          clean(lead.dni),
          clean(lead.phone),
          clean(lead.status || 'Sin Analisis'),
          clean(lead.priority || 'Media'),
          clean(lead.details),
          clean(lastMsg?.content),
          clean(obsValue),
          clean(fecha),
          clean(accion),
        ];
        lines.push(cells.join(sep));
      }

      const txtContent = '\uFEFF' + lines.join('\r\n');
      console.log('TXT generado con', lines.length, 'lineas');

      const fileName = 'base principal.txt';

      // Use a pure HTML5 download mechanism with Blob to avoid size limits
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Synchronous click ensures browser registers it as a user action
      link.click();
      
      // Remove immediately after click to clean DOM
      document.body.removeChild(link);

      // CRITICAL: Do NOT revoke URL immediately. Edge/Chrome antiviruses need time to scan.
      setTimeout(() => window.URL.revokeObjectURL(url), 120000);

      // Show strong immediate feedback so user checks their folder
      setExportSuccess(true);
      window.alert('✅ ¡EXPORTACIÓN EXITOSA!\n\nEl archivo "' + fileName + '" ya se descargó en tu computadora.\n\n👉 Por favor, abre tu carpeta de "Descargas" (Downloads) o presiona Ctrl+J en tu navegador para ver el archivo de texto.');
      setTimeout(() => setExportSuccess(false), 5000);

    } catch (err: any) {
      console.error('Error TXT:', err);
      window.alert('Error al exportar: ' + (err?.message || err));
    }
  };

  const handleDeleteLead = async (lead: any) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${lead.name}"?\n\nEsta acción eliminará también todas sus observaciones, mensajes enviados y registros asociados de la base de datos secundaria.`)) {
      try {
        const batch = writeBatch(db);
        
        // Buscar y eliminar observaciones vinculadas (base secundaria)
        const obsQ = query(collection(db, 'observations'), where('leadId', '==', lead.id));
        const obsSnap = await getDocs(obsQ);
        obsSnap.forEach((d) => {
          batch.delete(d.ref);
        });

        // Eliminar el prospecto en sí
        batch.delete(doc(db, 'leads', lead.id));

        await batch.commit();
        
      } catch (err: any) {
        console.error('Error deleting lead:', err);
        window.alert('Error al eliminar el prospecto: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Search Section */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[2.75rem] font-extrabold tracking-tight text-primary">Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToTXT}
              title="Exportar a Archivo de Texto (TXT)"
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all group ${exportSuccess ? 'bg-green-500 text-white border-green-600' : 'bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-800 border-green-200'}`}
            >
              <span className="material-symbols-outlined text-[20px] font-medium group-hover:-translate-y-0.5 transition-transform">
                {exportSuccess ? 'check_circle' : 'download'}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
                {exportSuccess ? '¡Descargado!' : 'Exportar TXT'}
              </span>
            </button>
            <Link to="/settings" className="flex items-center gap-2 px-4 py-2 bg-surface-container-low hover:bg-surface-container-high text-secondary hover:text-primary rounded-lg transition-all group">
              <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-300">settings</span>
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Configuración</span>
            </Link>
          </div>
        </div>
        <p className="text-secondary font-medium mb-8">Administración central de expedientes y prospectos legales.</p>

        {/* Search + Status Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group flex-1">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline">search</span>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-5 bg-surface-container-lowest border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-lg transition-all rounded-t-xl shadow-sm placeholder:text-outline/60"
              placeholder="Búsqueda por DNI, Nombre o Teléfono..."
            />
          </div>
          {/* Status and Priority Filters */}
          {/* Status and Priority Filters */}
          <div className="flex items-end gap-3 custom-scrollbar overflow-x-auto pb-1 md:pb-0">
            <button
               onClick={() => setShowReminders(!showReminders)}
               className={`h-[66px] px-5 py-3 border-0 border-b-2 text-sm font-semibold rounded-t-xl shadow-sm cursor-pointer transition-colors whitespace-nowrap flex items-center gap-2 ${showReminders ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}
             >
               <span className="material-symbols-outlined text-[18px]">calendar_month</span>
               Recordatorios
            </button>
            <button
               onClick={() => setShowHighPotential(!showHighPotential)}
               className={`h-[66px] px-5 py-3 border-0 border-b-2 text-sm font-semibold rounded-t-xl shadow-sm cursor-pointer transition-colors whitespace-nowrap flex items-center gap-2 ${showHighPotential ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}
             >
               <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: showHighPotential ? "'FILL' 1" : "'FILL' 0" }}>star</span>
               Alto Potencial
            </button>
            {!showReminders && !showHighPotential && (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-[66px] px-5 py-3 bg-surface-container-lowest border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-sm font-semibold text-on-surface-variant rounded-t-xl shadow-sm cursor-pointer appearance-none min-w-[180px]"
                >
                  <option value="Todos">📋 Todos los estados</option>
                  {allStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-[66px] px-5 py-3 bg-surface-container-lowest border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-sm font-semibold text-on-surface-variant rounded-t-xl shadow-sm cursor-pointer appearance-none min-w-[180px]"
                >
                  <option value="Todas">🏳️ Todas las prioridades</option>
                  {availablePriorities.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Prospects Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-on-surface">Prospectos Recientes</h2>
          <span className="text-xs font-bold text-secondary bg-surface-container-high px-3 py-1 rounded-full uppercase tracking-wider">
            {filteredLeads.length} registros
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-xl overflow-x-auto shadow-[0_12px_32px_rgba(25,28,29,0.04)]">
          <div className="min-w-max md:min-w-0">
            {/* Table Header (Desktop Only) */}
            <div 
              className="hidden md:grid gap-4 px-6 py-3 bg-surface-container-low/50 border-b border-outline-variant/10"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {[
                { id: 'name', label: 'Nombre / DNI' },
                { id: 'phone', label: 'Teléfono' },
                { id: 'status', label: 'Estado' },
                { id: 'priority', label: 'Prioridad' },
                { id: 'details', label: 'Resumen' },
                { id: 'message', label: 'Mensaje Enviado' },
                { id: 'observation', label: 'Última Observación' },
                { id: 'action', label: 'Última Acción', align: 'end' }
              ].map((col) => (
                <div key={col.id} className={`relative flex items-center group/header select-none ${col.align === 'end' ? 'justify-end' : ''}`}>
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{col.label}</span>
                  <div 
                    onMouseDown={(e) => startResize(e, col.id as keyof typeof DEFAULT_WIDTHS)}
                    className="absolute right-[-10px] top-[-5px] bottom-[-5px] w-[20px] cursor-col-resize hover:bg-primary/20 z-10"
                  />
                </div>
              ))}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-outline-variant/10">
              {dbError ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-3xl text-error mb-2 block">cloud_off</span>
                  <p className="text-secondary text-sm">{dbError}</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center text-secondary">
                  {searchTerm || statusFilter !== 'Todos' ? 'No se encontraron resultados con los filtros aplicados.' : 'No hay prospectos recientes.'}
                </div>
              ) : (
                filteredLeads.map((lead) => {
                  const lastAction = lastActions[lead.id];
                  const lastMsg = lastMessages[lead.id];
                  return (
                    <div
                      key={lead.id}
                      onClick={() => {
                        if (editingLeadId === lead.id) return;
                        navigate(`/clients/${lead.id}`);
                      }}
                      className="group relative cursor-pointer hover:bg-surface-container-low transition-colors"
                    >
                      {/* DESKTOP ROW */}
                      <div 
                        className="hidden md:grid gap-4 items-center px-6 py-4"
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        {/* Name + DNI */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-1 h-10 rounded-full flex-shrink-0 ${getStatusColor(lead.status)}`}></div>
                          <div className="min-w-0 w-full overflow-hidden">
                            <h3 className="text-sm font-bold text-on-surface truncate flex items-center gap-1">
                              {lead.isHighPotential && <span className="material-symbols-outlined text-[16px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
                              {lead.name}
                            </h3>
                            <p className="text-[0.6875rem] font-semibold text-secondary tracking-wider uppercase truncate">
                              {lead.dni ? `DNI: ${lead.dni}` : 'SIN DNI'}
                            </p>
                            {lead.profession && (
                              <p className="text-[0.6875rem] text-primary/70 font-medium truncate flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]">work</span>
                                {lead.profession}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Phone */}
                        <div className="truncate min-w-0">
                          <span className="text-sm text-on-surface-variant truncate block w-full">{lead.phone || '—'}</span>
                        </div>

                        {/* Status */}
                        <div className="w-full min-w-0" onClick={(e) => e.stopPropagation()}>
                          <div className="relative flex items-center">
                            <span className={`absolute left-2 w-2 h-2 rounded-full flex-shrink-0 pointer-events-none z-10 ${getStatusColor(lead.status)}`}></span>
                            <select
                              value={lead.status || 'Sin Análisis'}
                              onChange={(e) => updateDoc(doc(db, 'leads', lead.id), { status: e.target.value })}
                              className="text-xs font-medium text-on-surface-variant pl-6 pr-6 py-1.5 rounded-lg w-full cursor-pointer focus:ring-1 focus:ring-primary truncate appearance-none border-0 bg-transparent hover:bg-surface-container-highest transition-colors"
                            >
                              {!lead.status && <option value="Sin Análisis">Sin Análisis</option>}
                              {availableStatuses.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[14px] pointer-events-none opacity-50 hidden md:block">expand_more</span>
                          </div>
                        </div>

                        {/* Priority */}
                        <div className="w-full min-w-0" onClick={(e) => e.stopPropagation()}>
                          <div className="relative">
                            <select
                              value={lead.priority || 'Media'}
                              onChange={(e) => updateDoc(doc(db, 'leads', lead.id), { priority: e.target.value })}
                              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1.5 rounded-lg w-full cursor-pointer focus:ring-1 focus:ring-primary truncate appearance-none border-0 ${lead.priority === 'Crítica' || lead.priority === 'Alta' ? 'bg-error-container text-error' : lead.priority === 'Media' ? 'bg-surface-tint text-on-primary' : 'bg-surface-container-highest text-secondary'}`}
                            >
                              {!lead.priority && <option value="Media">Media</option>}
                              {availablePriorities.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[14px] pointer-events-none opacity-50">expand_more</span>
                          </div>
                          {lead.followUpDate && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary">
                              <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                              {format(new Date(lead.followUpDate + 'T00:00:00'), 'dd/MM')}
                            </div>
                          )}
                        </div>

                        {/* Details Editable */}
                        <div className="w-full min-w-0" onClick={(e) => e.stopPropagation()}>
                           {editingLeadId === lead.id ? (
                            <div className="flex flex-col gap-1 w-full relative group/edit">
                              <textarea
                                autoFocus
                                value={editDetailsDraft}
                                onChange={(e) => setEditDetailsDraft(e.target.value)}
                                className="w-full text-xs p-2 pr-8 border border-primary rounded bg-white min-h-[110px] resize-none focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                placeholder="Escribe el resumen..."
                              />
                              <div className="flex flex-col items-center justify-start gap-1 absolute top-1 right-1 opacity-100">
                                <button onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, 'leads', lead.id), { details: editDetailsDraft });
                                  } catch(e) {}
                                  setEditingLeadId(null);
                                }} className="w-5 h-5 flex items-center justify-center text-white bg-primary rounded shadow-sm hover:scale-110 transition-transform">
                                  <span className="material-symbols-outlined text-[13px] font-bold">check</span>
                                </button>
                                <button onClick={() => setEditingLeadId(null)} className="w-5 h-5 flex items-center justify-center text-secondary bg-surface-container-high rounded shadow-sm hover:scale-110 transition-transform hover:bg-outline-variant">
                                  <span className="material-symbols-outlined text-[13px] font-bold">close</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLeadId(lead.id);
                                setEditDetailsDraft(lead.details || '');
                              }}
                              className="text-xs text-on-surface-variant line-clamp-3 hover:bg-surface-container-highest cursor-text p-1.5 rounded transition-colors group-hover:bg-white"
                              title="Click para editar resumen"
                            >
                              {lead.details || <span className="text-outline italic">Sin resumen...</span>}
                            </div>
                          )}
                        </div>

                        {/* Message */}
                        <div className="w-full min-w-0">
                           <p className="text-xs text-blue-800 bg-blue-50/50 p-1.5 rounded line-clamp-3">
                             {lastMsg ? lastMsg.content : <span className="text-outline/50 italic text-xs">Aún no se enviaron...</span>}
                           </p>
                        </div>

                        {/* Last Observation */}
                        <div className="w-full min-w-0">
                           <p className="text-xs text-slate-700 bg-slate-50/80 p-1.5 rounded line-clamp-3">
                             {lastAction ? (lastAction.type === 'audio' ? '🎙️ Mensaje de audio' : lastAction.content) : <span className="text-outline/50 italic text-xs">Sin registros...</span>}
                           </p>
                        </div>

                        {/* Last Action */}
                        <div className="flex flex-col items-end whitespace-nowrap min-w-0">
                          {lastAction?.createdAt ? (
                            <>
                              <span className="text-xs font-semibold text-on-surface-variant truncate block max-w-full">
                                {formatDistanceToNow(lastAction.createdAt.toDate(), { locale: es }).replace('alrededor ', '')}
                              </span>
                              <span className="text-[10px] text-secondary truncate block max-w-full">
                                {lastAction.type === 'audio' ? '🎙️ Audio' : (lastAction.category === 'client_message' ? '💬 Mensaje' : '📝 Nota')}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-outline italic">Sin actividad</span>
                          )}
                        </div>
                      </div>

                      {/* MOBILE ROW */}
                      <div className="md:hidden flex flex-col gap-2 p-5 pr-10">
                        {/* Name + DNI (Mobile) */}
                        <div className="flex items-center gap-3 w-full">
                          <div className={`w-1 h-10 rounded-full flex-shrink-0 ${getStatusColor(lead.status)}`}></div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-on-surface truncate flex items-center gap-1">
                              {lead.isHighPotential && <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
                              {lead.name}
                            </h3>
                            <p className="text-[0.6875rem] font-semibold text-secondary tracking-wider uppercase truncate">
                              {lead.dni ? `DNI: ${lead.dni}` : 'SIN DNI'}
                            </p>
                          </div>
                        </div>
                        {/* Summary Mobile */}
                        <div className="flex items-center justify-between w-full text-xs text-secondary mt-1">
                          <span className="truncate max-w-[80px]">{lead.phone || 'Sin tel.'}</span>
                          <span className="flex items-center gap-1 truncate max-w-[100px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(lead.status)}`}></span>
                            {lead.status || 'Sin'}
                          </span>
                        </div>
                      </div>

                      {/* Delete button (Visible on hover desktop, always mapped) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLead(lead);
                        }}
                        title="Eliminar prospecto y registros"
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-error bg-red-50 hover:bg-error rounded-full z-10 hover:text-white shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <Link to="/new-lead" className="fixed bottom-24 md:bottom-8 right-8 w-16 h-16 signature-gradient text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all z-40 group">
        <span className="material-symbols-outlined text-3xl">add</span>
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-on-surface text-surface text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">NUEVO PROSPECTO</span>
      </Link>
    </div>
  );
}
