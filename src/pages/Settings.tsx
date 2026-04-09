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

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.statuses) setStatuses(data.statuses);
          if (data.priorities) setPriorities(data.priorities);
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

  return (
    <div className="max-w-3xl mx-auto space-y-8">
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
