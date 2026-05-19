// Script para buscar un lead específico en Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0932299961",
  appId: "1:885262980400:web:042ebb53ad64b1d86ae4f5",
  apiKey: "AIzaSyBWCCoir0F4tPdLxLzvUkIWxFQa-1gwLZc",
  authDomain: "gen-lang-client-0932299961.firebaseapp.com",
  storageBucket: "gen-lang-client-0932299961.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-a6278b9a-2b8a-4ac0-9165-4a9d6ea34455");

async function searchLead() {
  console.log("=== Buscando lead con DNI 20969869 o teléfono 2646744423 ===\n");

  // Search by DNI
  try {
    console.log("1. Buscando por DNI '20969869'...");
    const dniQuery = query(collection(db, 'leads'), where('dni', '==', '20969869'));
    const dniSnap = await getDocs(dniQuery);
    if (dniSnap.empty) {
      console.log("   ❌ No se encontró ningún lead con DNI '20969869'");
    } else {
      dniSnap.forEach(doc => {
        console.log("   ✅ ENCONTRADO por DNI:", JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
      });
    }
  } catch (err) {
    console.error("   Error buscando por DNI:", err.message);
  }

  // Search by phone
  try {
    console.log("\n2. Buscando por teléfono '2646744423'...");
    const phoneQuery = query(collection(db, 'leads'), where('phone', '==', '2646744423'));
    const phoneSnap = await getDocs(phoneQuery);
    if (phoneSnap.empty) {
      console.log("   ❌ No se encontró ningún lead con teléfono '2646744423'");
    } else {
      phoneSnap.forEach(doc => {
        console.log("   ✅ ENCONTRADO por teléfono:", JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
      });
    }
  } catch (err) {
    console.error("   Error buscando por teléfono:", err.message);
  }

  // Also get total count of leads
  try {
    console.log("\n3. Contando total de leads en la base...");
    const allQuery = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const allSnap = await getDocs(allQuery);
    console.log(`   📊 Total de leads en Firestore: ${allSnap.size}`);
    
    // Print all DNIs to help identify
    console.log("\n4. Lista de todos los DNIs en la base:");
    allSnap.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || 'sin fecha';
      console.log(`   - ${data.name || '(sin nombre)'} | DNI: ${data.dni || '(vacío)'} | Tel: ${data.phone || '(vacío)'} | Estado: ${data.status || 'Sin Análisis'} | Creado: ${createdAt}`);
    });
  } catch (err) {
    console.error("   Error listando leads:", err.message);
  }

  console.log("\n=== Búsqueda finalizada ===");
  process.exit(0);
}

searchLead();
