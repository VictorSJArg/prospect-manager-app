import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_STATUSES = ['Sin Análisis', 'Analizado', 'En Proceso', 'Urgente', 'Archivado'];
const DEFAULT_PRIORITIES = ['Baja', 'Media', 'Alta', 'Crítica'];

export default function Settings() {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities] = useState<string[]>(DEFAULT_PRIORITIES);
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<'status' | 'priority' | null>(null);
  const [editValue, setEditValue] = useState('');

  // Templates state
  const [templates, setTemplates] = useState<Array<{ id: string, name: string, subject: string, content: string }>>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateContent, setTemplateContent] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.statuses) setStatuses(data.statuses);
          if (data.priorities) setPriorities(data.priorities);
          if (data.templates) setTemplates(data.templates);
          if (data.activeTemplateId) setActiveTemplateId(data.activeTemplateId);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  const saveSettingsParams = async (newStatuses?: string[], newPriorities?: string[]) => {
    setSaving(true);
    setSaved(false);
    try {
      const updates: any = { updatedAt: new Date(), updatedBy: user?.uid };
      if (newStatuses) { updates.statuses = newStatuses; setStatuses(newStatuses); }
      if (newPriorities) { updates.priorities = newPriorities; setPriorities(newPriorities); }
      
      await setDoc(doc(db, 'settings', 'general'), updates, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
    setSaving(false);
  };

  const saveTemplates = async (newTemplates: any[], newActiveId?: string) => {
    setSaving(true);
    setSaved(false);
    try {
      const updates: any = { 
        updatedAt: new Date(), 
        updatedBy: user?.uid,
        templates: newTemplates
      };
      if (newActiveId !== undefined) {
        updates.activeTemplateId = newActiveId;
        setActiveTemplateId(newActiveId);
      }
      setTemplates(newTemplates);
      
      await setDoc(doc(db, 'settings', 'general'), updates, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving templates:', error);
    }
    setSaving(false);
  };

  const addItem = async (type: 'status' | 'priority') => {
    if (type === 'status') {
      const trimmed = newStatus.trim();
      if (!trimmed || statuses.includes(trimmed)) return;
      await saveSettingsParams([...statuses, trimmed], undefined);
      setNewStatus('');
    } else {
      const trimmed = newPriority.trim();
      if (!trimmed || priorities.includes(trimmed)) return;
      await saveSettingsParams(undefined, [...priorities, trimmed]);
      setNewPriority('');
    }
  };

  const removeItem = async (type: 'status' | 'priority', index: number) => {
    if (type === 'status') {
      await saveSettingsParams(statuses.filter((_, i) => i !== index), undefined);
    } else {
      await saveSettingsParams(undefined, priorities.filter((_, i) => i !== index));
    }
  };

  const startEdit = (type: 'status' | 'priority', index: number) => {
    setEditingType(type);
    setEditingIndex(index);
    setEditValue(type === 'status' ? statuses[index] : priorities[index]);
  };

  const confirmEdit = async () => {
    if (editingIndex === null || !editingType) return;
    const trimmed = editValue.trim();
    if (!trimmed) return;
    
    if (editingType === 'status') {
      const updated = [...statuses];
      updated[editingIndex] = trimmed;
      await saveSettingsParams(updated, undefined);
    } else {
      const updated = [...priorities];
      updated[editingIndex] = trimmed;
      await saveSettingsParams(undefined, updated);
    }
    setEditingIndex(null);
    setEditingType(null);
    setEditValue('');
  };

  const moveItem = async (type: 'status' | 'priority', index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (type === 'status') {
      const updated = [...statuses];
      if (newIndex < 0 || newIndex >= updated.length) return;
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      await saveSettingsParams(updated, undefined);
    } else {
      const updated = [...priorities];
      if (newIndex < 0 || newIndex >= updated.length) return;
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      await saveSettingsParams(undefined, updated);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateSubject.trim() || !templateContent.trim()) return;

    let updatedTemplates = [...templates];
    let newActiveId = activeTemplateId;

    if (editingTemplateId) {
      updatedTemplates = updatedTemplates.map(t => 
        t.id === editingTemplateId 
          ? { ...t, name: templateName.trim(), subject: templateSubject.trim(), content: templateContent.trim() }
          : t
      );
    } else {
      const newTemplate = {
        id: 'tpl_' + Date.now(),
        name: templateName.trim(),
        subject: templateSubject.trim(),
        content: templateContent.trim()
      };
      updatedTemplates.push(newTemplate);
      if (updatedTemplates.length === 1) {
        newActiveId = newTemplate.id;
      }
    }

    await saveTemplates(updatedTemplates, newActiveId);
    
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateSubject('');
    setTemplateContent('');
  };

  const handleEditTemplate = (tpl: any) => {
    setEditingTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setTemplateSubject(tpl.subject);
    setTemplateContent(tpl.content);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta plantilla?')) return;
    
    const updatedTemplates = templates.filter(t => t.id !== id);
    let newActiveId = activeTemplateId;
    if (activeTemplateId === id) {
      newActiveId = updatedTemplates.length > 0 ? updatedTemplates[0].id : '';
    }
    await saveTemplates(updatedTemplates, newActiveId);
  };

  const handleSetActiveTemplate = async (id: string) => {
    await saveTemplates(templates, id);
  };

  const handleCancelTemplateEdit = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateSubject('');
    setTemplateContent('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <section>
        <Link to="/" className="inline-flex items-center gap-2 text-secondary hover:text-primary mb-6 group transition-colors">
          <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span className="text-sm font-bold uppercase tracking-wider">Volver al Dashboard</span>
        </Link>
        <h1 className="text-[2.75rem] font-extrabold tracking-tight text-primary mb-2">Configuración</h1>
        <p className="text-secondary font-medium">Administre los parámetros generales de la aplicación.</p>
        {saved && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-full animate-pulse">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Cambios guardados
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Status Configuration */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">label</span>
              Estados del Prospecto
            </h2>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {statuses.map((status, index) => (
              <div key={index} className="flex items-center gap-3 px-6 py-3 group hover:bg-surface-container-low/50 transition-colors">
                <span className="text-[10px] font-bold text-outline w-4">{index + 1}</span>
                <div className="w-2 h-2 rounded-full bg-surface-tint flex-shrink-0"></div>
                {editingIndex === index && editingType === 'status' ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                      className="flex-1 bg-surface-container-highest border-b-2 border-primary focus:ring-0 focus:outline-none py-1 px-1 text-sm font-medium"
                      autoFocus
                    />
                    <button onClick={confirmEdit} className="material-symbols-outlined text-primary text-[18px] hover:bg-primary/10 rounded p-1">check</button>
                    <button onClick={() => setEditingIndex(null)} className="material-symbols-outlined text-outline text-[18px] hover:bg-slate-100 rounded p-1">close</button>
                  </div>
                ) : (
                  <span className="flex-1 text-sm font-medium text-on-surface truncate">{status}</span>
                )}
                {!(editingIndex === index && editingType === 'status') && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveItem('status', index, 'up')} disabled={index === 0 || saving} className="material-symbols-outlined text-[16px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10 disabled:opacity-30">arrow_upward</button>
                    <button onClick={() => moveItem('status', index, 'down')} disabled={index === statuses.length - 1 || saving} className="material-symbols-outlined text-[16px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10 disabled:opacity-30">arrow_downward</button>
                    <button onClick={() => startEdit('status', index)} disabled={saving} className="material-symbols-outlined text-[16px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10">edit</button>
                    <button onClick={() => removeItem('status', index)} disabled={saving || statuses.length <= 1} className="material-symbols-outlined text-[16px] text-outline hover:text-error p-1 rounded hover:bg-error/10 disabled:opacity-30">delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-outline-variant/10 bg-surface-container-low/30">
            <div className="flex items-center gap-2">
              <input type="text" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem('status')} className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1" placeholder="Nuevo estado..." />
              <button onClick={() => addItem('status')} disabled={!newStatus.trim() || saving} className="material-symbols-outlined signature-gradient text-white rounded p-1 shadow hover:opacity-90 disabled:opacity-50">add</button>
            </div>
          </div>
        </div>

        {/* Priority Configuration */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10">
            <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-[20px]">flag</span>
              Niveles de Prioridad
            </h2>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {priorities.map((priority, index) => (
              <div key={index} className="flex items-center gap-3 px-6 py-3 group hover:bg-surface-container-low/50 transition-colors">
                <span className="text-[10px] font-bold text-outline w-4">{index + 1}</span>
                <div className="w-2 h-2 rounded-full bg-error/80 flex-shrink-0"></div>
                {editingIndex === index && editingType === 'priority' ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                      className="flex-1 bg-surface-container-highest border-b-2 border-primary focus:ring-0 focus:outline-none py-1 px-1 text-sm font-medium"
                      autoFocus
                    />
                    <button onClick={confirmEdit} className="material-symbols-outlined text-primary text-[18px] hover:bg-primary/10 rounded p-1">check</button>
                    <button onClick={() => setEditingIndex(null)} className="material-symbols-outlined text-outline text-[18px] hover:bg-slate-100 rounded p-1">close</button>
                  </div>
                ) : (
                  <span className="flex-1 text-sm font-medium text-on-surface truncate">{priority}</span>
                )}
                {!(editingIndex === index && editingType === 'priority') && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveItem('priority', index, 'up')} disabled={index === 0 || saving} className="material-symbols-outlined text-[16px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10 disabled:opacity-30">arrow_upward</button>
                    <button onClick={() => moveItem('priority', index, 'down')} disabled={index === priorities.length - 1 || saving} className="material-symbols-outlined text-[16px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10 disabled:opacity-30">arrow_downward</button>
                    <button onClick={() => startEdit('priority', index)} disabled={saving} className="material-symbols-outlined text-[16px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10">edit</button>
                    <button onClick={() => removeItem('priority', index)} disabled={saving || priorities.length <= 1} className="material-symbols-outlined text-[16px] text-outline hover:text-error p-1 rounded hover:bg-error/10 disabled:opacity-30">delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-outline-variant/10 bg-surface-container-low/30">
            <div className="flex items-center gap-2">
              <input type="text" value={newPriority} onChange={(e) => setNewPriority(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem('priority')} className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1" placeholder="Nueva prioridad..." />
              <button onClick={() => addItem('priority')} disabled={!newPriority.trim() || saving} className="material-symbols-outlined signature-gradient text-white rounded p-1 shadow hover:opacity-90 disabled:opacity-50">add</button>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Section */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">description</span>
            Plantillas de Email para Envíos Masivos (n8n)
          </h2>
          {editingTemplateId && (
            <button onClick={handleCancelTemplateEdit} className="text-xs font-bold text-outline hover:text-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">close</span>
              Cancelar Edición
            </button>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* List */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2">Plantillas Guardadas</h3>
            {templates.length === 0 ? (
              <p className="text-sm text-outline italic py-4">No hay plantillas creadas.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {templates.map((tpl) => (
                  <div 
                    key={tpl.id} 
                    className={`p-3 rounded-lg border transition-all cursor-pointer relative group flex items-start justify-between ${
                      activeTemplateId === tpl.id 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-outline-variant/50 hover:border-outline-variant hover:bg-surface-container-low/30'
                    }`}
                    onClick={() => handleSetActiveTemplate(tpl.id)}
                  >
                    <div className="flex-1 min-w-0 pr-12">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-bold text-sm text-on-surface truncate">{tpl.name}</span>
                        {activeTemplateId === tpl.id && (
                          <span className="text-[10px] font-extrabold text-white bg-primary px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                            Activa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-secondary truncate font-medium">{tpl.subject}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 p-1 rounded-md shadow-sm border border-outline-variant/30">
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEditTemplate(tpl); }}
                        className="material-symbols-outlined text-[16px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10"
                        title="Editar"
                      >
                        edit
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                        className="material-symbols-outlined text-[16px] text-outline hover:text-error p-1 rounded hover:bg-error/10"
                        title="Eliminar"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-outline bg-surface-container-low/20 p-3 rounded-lg border border-outline-variant/10 space-y-1 mt-4">
              <span className="font-bold block text-secondary">Variables utilizables:</span>
              <p>Puedes usar marcadores en el asunto o cuerpo que la integración reemplazará dinámicamente:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><code className="text-primary font-bold">{"{{nombre}}"}</code>: Nombre completo</li>
                <li><code className="text-primary font-bold">{"{{dni}}"}</code>: DNI</li>
                <li><code className="text-primary font-bold">{"{{telefono}}"}</code>: Teléfono</li>
                <li><code className="text-primary font-bold">{"{{email}}"}</code>: Correo electrónico</li>
              </ul>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveTemplate} className="lg:col-span-7 space-y-4 border-t lg:border-t-0 lg:border-l border-outline-variant/10 pt-6 lg:pt-0 lg:pl-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
              {editingTemplateId ? 'Editar Plantilla' : 'Nueva Plantilla'}
            </h3>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-secondary">Nombre de la Plantilla</label>
              <input 
                type="text" 
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-2 px-3 text-sm font-medium focus:outline-none"
                placeholder="Ej: Primer contacto jubilados"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-secondary">Asunto del Email</label>
              <input 
                type="text" 
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-2 px-3 text-sm font-medium focus:outline-none"
                placeholder="Ej: Requisitos para tu trámite de jubilación"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-secondary">Contenido del Mensaje</label>
              <textarea 
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                required
                rows={6}
                className="w-full bg-surface-container-lowest border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-2 px-3 text-sm font-medium focus:outline-none font-sans"
                placeholder="Hola {{nombre}},&#10;&#10;Nos contactamos con usted en referencia a su DNI {{dni}}..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={saving || !templateName.trim() || !templateSubject.trim() || !templateContent.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white signature-gradient rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{editingTemplateId ? 'save' : 'add'}</span>
                {editingTemplateId ? 'Guardar Cambios' : 'Crear Plantilla'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => saveSettingsParams(DEFAULT_STATUSES, DEFAULT_PRIORITIES)}
          disabled={saving}
          className="text-xs font-semibold text-secondary hover:text-error transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
          Restaurar valores predeterminados
        </button>
      </div>
    </div>
  );
}
