import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [lead, setLead] = useState<any>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [newObservation, setNewObservation] = useState('');
  const [observationCategory, setObservationCategory] = useState<'internal' | 'client_message'>('internal');
  const [dbError, setDbError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<string[]>(['Sin Análisis', 'Analizado', 'En Proceso', 'Urgente', 'Archivado']);
  const [priorities, setPriorities] = useState<string[]>(['Baja', 'Media', 'Alta', 'Crítica']);
  const [changingStatus, setChangingStatus] = useState(false);
  const [changingPriority, setChangingPriority] = useState(false);
  const [changingHighPotential, setChangingHighPotential] = useState(false);
  const [changingFollowUp, setChangingFollowUp] = useState(false);

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: '', dni: '', phone: '', email: '', profession: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Summary editing state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const lastClientMessage = observations.filter(o => o.category === 'client_message').pop();
  const observationsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;

    const fetchLead = async () => {
      try {
        const docRef = doc(db, 'leads', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLead({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error: any) {
        console.error('Error fetching lead:', error.message);
        setDbError('Error al cargar el prospecto.');
      }
    };
    fetchLead();

    // Load statuses and priorities from settings
    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          if (settingsDoc.data().statuses) setStatuses(settingsDoc.data().statuses);
          if (settingsDoc.data().priorities) setPriorities(settingsDoc.data().priorities);
        }
      } catch (_) { /* use defaults */ }
    };
    loadSettings();

    // Listen to observations for this lead
    const q = query(
      collection(db, 'observations'),
      where('leadId', '==', id),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const obs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setObservations(obs);
      // Scroll to bottom when new observations arrive
      setTimeout(() => observationsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.error('Error fetching observations:', error.message);
    });

    return unsubscribe;
  }, [id, user]);

  // Save a text observation
  const handleSendObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObservation.trim() || !user || !id) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'observations'), {
        leadId: id,
        type: 'text',
        category: observationCategory,
        content: newObservation.trim(),
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuario',
      });
      setNewObservation('');
    } catch (error: any) {
      console.error('Error saving observation:', error.message);
    }
    setSaving(false);
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await saveAudioObservation(audioBlob);
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const saveAudioObservation = async (audioBlob: Blob) => {
    if (!user || !id) return;
    setSaving(true);

    // Convert blob to base64 for storage in Firestore
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;

      try {
        await addDoc(collection(db, 'observations'), {
          leadId: id,
          type: 'audio',
          content: base64Audio,
          duration: recordingTime,
          createdAt: serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email || 'Usuario',
        });
      } catch (error: any) {
        console.error('Error saving audio observation:', error.message);
      }
      setSaving(false);
    };
    reader.readAsDataURL(audioBlob);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (dbError) {
    return (
      <div className="p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-error mb-4 block">cloud_off</span>
        <p className="text-secondary">{dbError}</p>
        <Link to="/" className="text-primary font-semibold mt-4 inline-block hover:underline">Volver al Dashboard</Link>
      </div>
    );
  }

  if (!lead) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div>
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 mb-8 text-secondary font-label text-[0.6875rem] uppercase tracking-wider">
        <Link to="/" className="hover:text-primary transition-colors">CLIENTES</Link>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-on-surface">FICHA PERSONAL</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Sidebar: Profile Header */}
        <aside className="md:col-span-4 space-y-6">
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-surface-tint"></div>
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-surface-container-low mb-4 ring-4 ring-surface overflow-hidden flex items-center justify-center text-3xl text-primary font-bold">
                {lead.name?.charAt(0) || '?'}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-headline font-bold text-primary">{lead.name}</h2>
                <button
                  onClick={async () => {
                    const newValue = !lead.isHighPotential;
                    setChangingHighPotential(true);
                    try {
                      await updateDoc(doc(db, 'leads', id!), { isHighPotential: newValue });
                      setLead((prev: any) => ({ ...prev, isHighPotential: newValue }));
                    } catch (err) {}
                    setChangingHighPotential(false);
                  }}
                  disabled={changingHighPotential}
                  title={lead.isHighPotential ? "Quitar de Alto Potencial" : "Marcar como Alto Potencial"}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${lead.isHighPotential ? 'bg-amber-100 text-amber-500 hover:bg-amber-200' : 'bg-surface-container-high text-outline hover:bg-surface-container-highest'}`}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: lead.isHighPotential ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                </button>
              </div>
              <span className="text-secondary font-label text-[0.6875rem] uppercase tracking-[0.05em] mb-4">CLIENTE ACTIVO</span>

              {/* Status and Priority Dropdowns */}
              <div className="w-full mb-6 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-2">Estado del caso</label>
                  <div className="relative">
                    <select
                      value={lead.status || 'Sin Análisis'}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        setChangingStatus(true);
                        try {
                          await updateDoc(doc(db, 'leads', id!), { status: newStatus });
                          setLead((prev: any) => ({ ...prev, status: newStatus }));
                        } catch (err) {
                          console.error('Error updating status:', err);
                        }
                        setChangingStatus(false);
                      }}
                      disabled={changingStatus}
                      className="w-full appearance-none bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2.5 pr-8 text-[0.8125rem] font-semibold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-secondary pointer-events-none">unfold_more</span>
                  </div>
                </div>
                <div>
                  <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-2">Nivel de Prioridad</label>
                  <div className="relative">
                    <select
                      value={lead.priority || 'Media'}
                      onChange={async (e) => {
                        const newPriority = e.target.value;
                        setChangingPriority(true);
                        try {
                          await updateDoc(doc(db, 'leads', id!), { priority: newPriority });
                          setLead((prev: any) => ({ ...prev, priority: newPriority }));
                        } catch (err) { }
                        setChangingPriority(false);
                      }}
                      disabled={changingPriority}
                      className={`w-full appearance-none border rounded-lg px-3 py-2.5 pr-8 text-[0.8125rem] font-semibold focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer disabled:opacity-50 ${lead.priority === 'Crítica' || lead.priority === 'Alta' ? 'bg-error-container text-error border-error/50' : lead.priority === 'Media' ? 'bg-surface-tint text-on-primary border-primary/50' : 'bg-surface-container-highest text-secondary border-outline-variant/20'}`}
                    >
                      {!lead.priority && <option value="Media">Media</option>}
                      {priorities.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none opacity-50">unfold_more</span>
                  </div>
                </div>
              </div>

              {/* Follow-up Date */}
              <div className="w-full mb-6 text-left">
                <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-2">
                  <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">calendar_month</span>
                  Fecha de Seguimiento
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={lead.followUpDate || ''}
                    onChange={async (e) => {
                      const newDate = e.target.value;
                      setChangingFollowUp(true);
                      try {
                        await updateDoc(doc(db, 'leads', id!), { followUpDate: newDate || null });
                        setLead((prev: any) => ({ ...prev, followUpDate: newDate || null }));
                      } catch (err) {}
                      setChangingFollowUp(false);
                    }}
                    disabled={changingFollowUp}
                    className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-2.5 text-[0.8125rem] font-semibold text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
                  />
                </div>
                {lead.followUpDate && (
                  <p className="text-[10px] text-primary mt-1 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[12px]">info</span>
                    Agendado para seguimiento.
                  </p>
                )}
              </div>

              {isEditingProfile ? (
                 <div className="w-full space-y-3 text-left border-t border-outline-variant/15 pt-6">
                   <div>
                     <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-1">Nombre Completo</label>
                     <input type="text" value={profileDraft.name} onChange={(e) => setProfileDraft(p => ({...p, name: e.target.value}))} className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Ej. Juan Pérez" />
                   </div>
                   <div>
                     <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-1">DNI / Identificación</label>
                     <input type="text" value={profileDraft.dni} onChange={(e) => setProfileDraft(p => ({...p, dni: e.target.value}))} className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Ej. 12345678" />
                   </div>
                   <div>
                     <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-1">Teléfono Contacto</label>
                     <input type="text" value={profileDraft.phone} onChange={(e) => setProfileDraft(p => ({...p, phone: e.target.value}))} className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Ej. +54 9 11..." />
                   </div>
                   <div>
                     <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-1">Correo Electrónico</label>
                     <input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft(p => ({...p, email: e.target.value}))} className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="correo@ejemplo.com" />
                   </div>
                   <div>
                     <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-1">Profesión o Régimen</label>
                     <input type="text" value={profileDraft.profession} onChange={(e) => setProfileDraft(p => ({...p, profession: e.target.value}))} className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Ej. Docente, IPS, Autónomo" />
                   </div>
                   
                   <div className="flex gap-2 mt-4 pt-2">
                     <button
                       onClick={async () => {
                         setSavingProfile(true);
                         try {
                           await updateDoc(doc(db, 'leads', id!), profileDraft);
                           setLead((prev: any) => ({ ...prev, ...profileDraft }));
                           setIsEditingProfile(false);
                         } catch (err: any) {
                           console.error('Error updating profile:', err);
                           window.alert('Error al actualizar el perfil: ' + err.message);
                         }
                         setSavingProfile(false);
                       }}
                       disabled={savingProfile}
                       className="flex-1 py-2 bg-primary text-white font-semibold rounded-lg shadow hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                       {savingProfile ? 'Guardando...' : 'Guardar'}
                     </button>
                     <button
                       onClick={() => setIsEditingProfile(false)}
                       disabled={savingProfile}
                       className="flex-1 py-2 border border-outline-variant/20 text-secondary font-semibold rounded-lg hover:bg-surface-container-low transition-colors text-sm"
                     >
                       Cancelar
                     </button>
                   </div>
                 </div>
              ) : (
                <div className="w-full space-y-4 text-left border-t border-outline-variant/15 pt-6">
                  {lead.dni && (
                    <div className="flex flex-col">
                      <span className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider">DNI / Identificación</span>
                      <span className="text-on-surface font-medium">{lead.dni}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider">Teléfono Contacto</span>
                    <span className="text-on-surface font-medium">{lead.phone || 'No registrado'}</span>
                  </div>
                  {lead.email && (
                    <div className="flex flex-col">
                      <span className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider">Correo Electrónico</span>
                      <span className="text-on-surface font-medium">{lead.email}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider">Profesión / Régimen</span>
                    <span className="text-on-surface font-medium">{lead.profession || 'No registrado'}</span>
                  </div>

                  <button
                    onClick={() => {
                      setIsEditingProfile(true);
                      setProfileDraft({
                        name: lead.name || '',
                        dni: lead.dni || '',
                        phone: lead.phone || '',
                        email: lead.email || '',
                        profession: lead.profession || ''
                      });
                    }}
                    className="w-full mt-8 py-3 signature-gradient text-on-primary font-semibold rounded-lg shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    EDITAR PERFIL
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Resumen de Situación */}
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] border-l-4 border-primary">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">description</span>
                Resumen de Situación
              </h3>
              {!isEditingSummary && (
                <button
                  onClick={() => {
                    setIsEditingSummary(true);
                    setSummaryDraft(lead.details || '');
                  }}
                  className="material-symbols-outlined text-[18px] text-outline hover:text-primary p-1 rounded hover:bg-primary/10 transition-colors"
                  title="Editar resumen"
                >edit</button>
              )}
            </div>

            {isEditingSummary ? (
              <div className="space-y-4">
                {/* AI Generation Button */}
                <button
                  onClick={async () => {
                    if (observations.length === 0) return;
                    setGeneratingAI(true);
                    try {
                      const { GoogleGenAI } = await import('@google/genai');
                      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY || 'AIzaSyDpYWNTb3X_9-0W67nvrb_7dfdNTnTG3SA';
                      if (!apiKey) {
                        setSummaryDraft('Error: No se encontró la clave API de Gemini.');
                        setGeneratingAI(false);
                        return;
                      }
                      const ai = new GoogleGenAI({ apiKey });

                      const textObs = observations
                        .filter(o => o.type === 'text')
                        .map(o => `[${o.createdAt ? new Date(o.createdAt.toDate()).toLocaleDateString('es-AR') : 'Sin fecha'}] ${o.userName}: ${o.content}`)
                        .join('\n');

                      const prompt = `Sos un asesor previsional argentino. A continuación tenés las observaciones registradas de un caso de un cliente llamado "${lead.name}" (DNI: ${lead.dni || 'No disponible'}).

Observaciones del caso:
${textObs || 'No hay observaciones de texto registradas.'}

Generá un resumen profesional y conciso de la situación del caso. Incluí:
- Estado actual del trámite
- Puntos clave identificados
- Próximos pasos sugeridos

Usá un tono profesional pero claro. Máximo 200 palabras.`;

                      const response = await ai.models.generateContent({
                        model: 'gemini-2.0-flash',
                        contents: prompt,
                      });
                      setSummaryDraft(response.text || 'No se pudo generar el resumen.');
                    } catch (err: any) {
                      console.error('AI Error:', err);
                      setSummaryDraft('Error al generar resumen con IA: ' + (err.message || 'Error desconocido'));
                    }
                    setGeneratingAI(false);
                  }}
                  disabled={generatingAI || observations.length === 0}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold rounded-lg shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generatingAI ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generando resumen con IA...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                      Generar Resumen con IA
                    </>
                  )}
                </button>
                {observations.length === 0 && (
                  <p className="text-[10px] text-outline text-center">Agregue observaciones al caso para que la IA pueda generar un resumen.</p>
                )}

                {/* Editable textarea */}
                <div>
                  <label className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-2">Resumen (editable)</label>
                  <textarea
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    rows={8}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-y placeholder:text-outline"
                    placeholder="Escriba o genere el resumen del caso..."
                  />
                </div>

                {/* Confirm / Cancel */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      setSavingSummary(true);
                      try {
                        await updateDoc(doc(db, 'leads', id!), { details: summaryDraft });
                        setLead((prev: any) => ({ ...prev, details: summaryDraft }));
                        setIsEditingSummary(false);
                      } catch (err) {
                        console.error('Error saving summary:', err);
                      }
                      setSavingSummary(false);
                    }}
                    disabled={savingSummary}
                    className="flex-1 py-2.5 signature-gradient text-white font-semibold rounded-lg shadow hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {savingSummary ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    )}
                    Confirmar Resumen
                  </button>
                  <button
                    onClick={() => setIsEditingSummary(false)}
                    className="px-4 py-2.5 border border-outline-variant/20 text-secondary font-semibold rounded-lg hover:bg-surface-container-low transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <span className="text-secondary font-label text-[0.6875rem] uppercase tracking-wider block mb-1">Detalles del Caso</span>
                <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{lead.details || 'Sin detalles registrados.'}</p>
                {!lead.details && (
                  <button
                    onClick={() => {
                      setIsEditingSummary(true);
                      setSummaryDraft('');
                    }}
                    className="mt-3 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Agregar resumen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Último Mensaje a Enviar */}
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] border-l-4 border-blue-500">
            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-800 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">chat</span>
              Mensaje a Enviar
            </h3>
            <div>
              <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap bg-blue-50/50 p-4 rounded-lg">
                {lastClientMessage ? lastClientMessage.content : <span className="italic text-outline">Aún no se ha redactado ningún mensaje para enviar al cliente.</span>}
              </p>
              {lastClientMessage && lastClientMessage.createdAt && (
                <span className="text-[10px] text-secondary mt-2 block">
                  Actualizado {formatDistanceToNow(lastClientMessage.createdAt.toDate(), { locale: es, addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low p-4 rounded-xl">
              <span className="text-secondary font-label text-[0.6875rem] uppercase block mb-1">Observaciones</span>
              <span className="text-lg font-bold text-primary">{observations.length}</span>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl">
              <span className="text-secondary font-label text-[0.6875rem] uppercase block mb-1">Audios</span>
              <span className="text-lg font-bold text-primary">{observations.filter(o => o.type === 'audio').length}</span>
            </div>
          </div>
        </aside>

        {/* Main Content: Observations */}
        <section className="md:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] overflow-hidden flex flex-col min-h-[700px]">
            {/* Header */}
            <div className="px-8 py-5 border-b border-outline-variant/10 flex justify-between items-center bg-white">
              <div>
                <h4 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">note_alt</span>
                  Observaciones del Caso
                </h4>
                <p className="text-xs text-secondary">Registro cronológico de notas, análisis y audios</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest bg-surface-container-high px-3 py-1 rounded">
                  {observations.length} registros
                </span>
              </div>
            </div>

            {/* Observations Timeline */}
            <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar bg-surface/30 max-h-[500px]">
              {observations.length === 0 ? (
                <div className="text-center text-secondary py-10">
                  <span className="material-symbols-outlined text-4xl text-outline-variant mb-2 block">edit_note</span>
                  <p className="mb-1">No hay observaciones registradas.</p>
                  <p className="text-xs text-outline">Escriba una nota o grabe un audio para comenzar.</p>
                </div>
              ) : (
                observations.map((obs) => (
                  <div key={obs.id} className="group relative">
                    {/* Observation Card */}
                    <div className="bg-white p-5 rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${obs.type === 'audio' ? 'bg-tertiary-container' : 'signature-gradient'}`}>
                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1", color: obs.type === 'audio' ? '#506169' : 'white' }}>
                              {obs.type === 'audio' ? 'mic' : 'edit_note'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-on-surface">{obs.userName || 'Usuario'}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                                    {obs.type === 'audio' ? 'NOTA DE VOZ' : 'OBSERVACIÓN ESCRITA'}
                                  </span>
                                  {obs.category === 'client_message' && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded uppercase flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[10px]">chat</span>
                                      Mensaje a enviar
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-secondary">
                          {obs.createdAt ? format(obs.createdAt.toDate(), "d MMM yyyy, HH:mm", { locale: es }) : ''}
                        </span>
                      </div>

                      {obs.type === 'audio' ? (
                        <div className="mt-2">
                          <audio controls className="w-full h-10" preload="metadata">
                            <source src={obs.content} type="audio/webm" />
                            Tu navegador no soporta la reproducción de audio.
                          </audio>
                          {obs.duration && (
                            <p className="text-[10px] text-secondary mt-1">Duración: {formatTime(obs.duration)}</p>
                          )}
                          {obs.transcription && (
                            <div className="mt-3 p-3 bg-surface-container-low rounded-lg">
                              <p className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">Transcripción</p>
                              <p className="text-sm text-on-surface-variant leading-relaxed">{obs.transcription}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{obs.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={observationsEndRef} />
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="px-8 py-3 bg-error-container flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-error animate-pulse"></div>
                  <span className="text-sm font-bold text-error">Grabando...</span>
                  <span className="text-sm font-mono text-on-error-container">{formatTime(recordingTime)}</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 bg-error text-white text-xs font-bold rounded-lg hover:bg-error/90 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">stop</span>
                  DETENER
                </button>
              </div>
            )}

            {/* Saving indicator */}
            {saving && (
              <div className="px-8 py-2 bg-surface-container-high flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-secondary">Guardando observación...</span>
              </div>
            )}

            {/* Input Area */}
            <div className="px-8 py-6 bg-white border-t border-outline-variant/10">
              {/* Category tabs */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setObservationCategory('internal')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                    observationCategory === 'internal' 
                      ? 'bg-surface-tint text-on-primary' 
                      : 'bg-surface-container-low text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  Observación Interna
                </button>
                <button
                  type="button"
                  onClick={() => setObservationCategory('client_message')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                    observationCategory === 'client_message' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-surface-container-low text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                  Comentario a enviar
                </button>
              </div>

              <form onSubmit={handleSendObservation} className="space-y-3">
                <div className="flex items-end gap-3">
                  <div className={`flex-1 rounded-xl px-4 py-2 border transition-colors ${
                    observationCategory === 'client_message' 
                      ? 'bg-blue-50/50 border-blue-200 focus-within:border-blue-500' 
                      : 'bg-surface-container-low border-outline-variant/15 focus-within:border-primary'
                  }`}>
                    <textarea
                      value={newObservation}
                      onChange={(e) => setNewObservation(e.target.value)}
                      rows={5}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 placeholder:text-outline resize-none"
                      placeholder={observationCategory === 'internal' ? "Escriba una observación interna sobre el caso..." : "Escriba el comentario final para enviar al cliente..."}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendObservation(e);
                        }
                      }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    {/* Record audio button */}
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={saving}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md transition-all ${
                        isRecording
                          ? 'bg-error text-white animate-pulse'
                          : 'bg-surface-container-high text-primary hover:bg-surface-container-highest hover:scale-105'
                      } disabled:opacity-50`}
                      title={isRecording ? 'Detener grabación' : 'Grabar audio'}
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isRecording ? 'stop' : 'mic'}
                      </span>
                    </button>

                    {/* Send text button */}
                    <button
                      type="submit"
                      disabled={!newObservation.trim() || saving}
                      className="w-10 h-10 signature-gradient rounded-lg flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform active:scale-95 disabled:opacity-50"
                      title="Enviar observación"
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">info</span>
                  Presione Enter para enviar. Shift+Enter para nueva línea. Use el micrófono para grabar audio.
                </p>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
