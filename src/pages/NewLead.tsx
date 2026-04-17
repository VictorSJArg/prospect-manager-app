import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// Lazy AI import - only when user triggers AI features
let _ai: any = null;
async function getAI() {
  if (!_ai) {
    const apiKey = (globalThis as any).process?.env?.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('La clave API de Gemini no está configurada. Las funciones de IA no están disponibles.');
    }
    const { GoogleGenAI } = await import('@google/genai');
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

export default function NewLead() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setAiError('');
    try {
      const ai = await getAI();
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: file.type } },
                { text: 'Extract the following information from this conversation screenshot: Name of the prospect, Phone number, DNI if visible, and a brief summary of their legal case/details. Return ONLY a JSON object with keys: name, phone, dni, details.' },
              ],
            },
            config: { responseMimeType: 'application/json' },
          });

          if (response.text) {
            const data = JSON.parse(response.text);
            if (data.name) setName(data.name);
            if (data.phone) setPhone(data.phone);
            if (data.dni) setDni(data.dni);
            if (data.details) setDetails(data.details);
          }
        } catch (err: any) {
          console.error("Failed to process image", err);
          setAiError('Error al procesar la imagen con IA.');
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error("AI not available", error);
      setAiError(error.message || 'Error al inicializar la IA.');
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAiError('');
    } catch (error) {
      console.error("Error accessing microphone", error);
      setAiError('No se pudo acceder al micrófono.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setLoading(true);
    setAiError('');
    try {
      const ai = await getAI();
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: audioBlob.type } },
                { text: 'Transcribe this audio and summarize the legal case details. Return ONLY a JSON object with keys: details.' },
              ],
            },
            config: { responseMimeType: 'application/json' },
          });

          if (response.text) {
            const data = JSON.parse(response.text);
            if (data.details) setDetails(prev => prev ? `${prev}\n\nAudio: ${data.details}` : data.details);
          }
        } catch (err: any) {
          console.error("Failed to transcribe", err);
          setAiError('Error al transcribir el audio.');
        }
        setLoading(false);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error: any) {
      console.error("AI not available", error);
      setAiError(error.message || 'Error al inicializar la IA.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'leads'), {
        name,
        phone,
        dni,
        details,
        status: 'Sin Análisis',
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuario',
      });
      navigate(`/clients/${docRef.id}`);
    } catch (error: any) {
      console.error('Error creating lead:', error.message);
      setAiError('Error al crear el prospecto. Verifica tus permisos.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Editorial Header Section */}
      <section className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-primary mb-2">Nuevo Prospecto</h1>
        <p className="text-on-surface-variant text-sm max-w-lg">
          Capture la información esencial del cliente potencial. Utilice nuestra extracción por IA para capturas de pantalla o grabe notas de voz para transcripción automática.
        </p>
      </section>

      {aiError && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container text-sm rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined">warning</span>
          {aiError}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Intelligent Extraction */}
        <div className="lg:col-span-5 space-y-6">
          {/* Image Upload / IA Extraction Bento Card */}
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] transition-all">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-bold tracking-widest text-primary uppercase bg-primary-fixed px-2 py-1 rounded">IA EXTRACTION</span>
              <span className="material-symbols-outlined text-outline">auto_awesome</span>
            </div>

            <label className="border-2 border-dashed border-outline-variant/30 rounded-lg p-10 flex flex-col items-center justify-center bg-surface-container-low/50 hover:bg-surface-container-low transition-colors cursor-pointer group">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={loading} />
              <span className="material-symbols-outlined text-4xl text-outline mb-4 group-hover:text-primary transition-colors">add_photo_alternate</span>
              <p className="text-sm font-medium text-on-surface text-center">Cargar captura de WhatsApp</p>
              <p className="text-xs text-on-surface-variant mt-2 text-center">Formatos PNG, JPG soportados</p>
            </label>

            <div className="mt-8 flex items-center justify-center">
              <div className="h-[1px] bg-outline-variant/20 flex-grow"></div>
              <span className="px-4 text-[10px] font-bold text-outline uppercase tracking-tighter">O</span>
              <div className="h-[1px] bg-outline-variant/20 flex-grow"></div>
            </div>

            {/* Voice Note Component */}
            <div className="mt-8">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
                className={`w-full flex items-center justify-between p-4 rounded-lg transition-all group ${isRecording ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high hover:bg-surface-container-highest'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecording ? 'bg-error text-white animate-pulse' : 'bg-primary text-on-primary'}`}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isRecording ? 'stop' : 'mic'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-bold tracking-tight ${isRecording ? 'text-error' : 'text-primary'}`}>
                      {isRecording ? 'Detener Grabación' : 'Grabar Nota de Voz'}
                    </p>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">AI Voice Transcriber</p>
                  </div>
                </div>
                {!isRecording && <span className="material-symbols-outlined text-outline group-hover:translate-x-1 transition-transform">chevron_right</span>}
              </button>
            </div>
          </div>

          {/* Guidance Info */}
          <div className="bg-secondary-container/30 p-6 rounded-xl border-l-4 border-surface-tint">
            <h4 className="text-sm font-bold text-on-secondary-container mb-2">Consejo de Autoridad</h4>
            <p className="text-xs text-on-secondary-container/80 leading-relaxed">
              Al cargar una captura, la IA identificará automáticamente nombres, fechas y el tono legal de la conversación para clasificar la urgencia del caso.
            </p>
          </div>
        </div>

        {/* Right Column: Manual Data Entry Form */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-8 lg:p-10 rounded-xl shadow-[0_12px_32px_rgba(25,28,29,0.04)] relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Name Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-wider text-secondary uppercase">Nombre Completo del Prospecto</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container-highest border-b-2 border-outline/30 focus:border-primary focus:ring-0 focus:outline-none py-3 px-0 text-on-surface placeholder:text-outline transition-colors text-lg font-medium"
                placeholder="Ej. Lic. Gabriel Montenegro"
              />
            </div>

            {/* DNI Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-wider text-secondary uppercase">DNI / Identificación</label>
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className="w-full bg-surface-container-highest border-b-2 border-outline/30 focus:border-primary focus:ring-0 focus:outline-none py-3 px-0 text-on-surface placeholder:text-outline transition-colors text-lg font-medium"
                placeholder="45.892.102"
              />
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-wider text-secondary uppercase">Teléfono / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-surface-container-highest border-b-2 border-outline/30 focus:border-primary focus:ring-0 focus:outline-none py-3 px-0 text-on-surface placeholder:text-outline transition-colors text-lg font-medium"
                placeholder="+54 11 1234 5678"
              />
            </div>

            {/* Client Message Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-wider text-secondary uppercase">Mensaje o Detalles del Caso</label>
              <textarea
                rows={5}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full bg-surface-container-highest border-b-2 border-outline/30 focus:border-primary focus:ring-0 focus:outline-none py-3 px-0 text-on-surface placeholder:text-outline transition-colors leading-relaxed resize-none"
                placeholder="Describa el asunto legal del prospecto..."
              ></textarea>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 flex flex-col sm:flex-row gap-4 items-center justify-end">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full sm:w-auto px-8 py-3 text-sm font-bold text-primary hover:bg-slate-100 transition-colors rounded-lg"
              >
                DESCARTAR
              </button>
              <button
                type="submit"
                disabled={loading || !name}
                className="w-full sm:w-auto px-12 py-4 signature-gradient text-on-primary text-sm font-bold tracking-widest rounded-lg shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                CREAR PROSPECTO
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
