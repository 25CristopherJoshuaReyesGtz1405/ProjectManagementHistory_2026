// ServiciosActivos/TriageIA.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
// Importamos tu tipo de dato estricto
import type { EstadoConservacion } from '../ModelosAplicacion/ModelosAplicacion.model.js'; 

// Inicializamos el SDK con la llave de entorno
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * ============================================================================
 * KILLER FEATURE 6: SMART TRIAGE (Clasificación Automática)
 * ============================================================================
 * Analiza el texto extraído por OCR y devuelve una clasificación estructurada.
 */
export const analizarDocumentoHistorico = async (textoOCR: string) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Prompt sistémico (Ingeniería de Prompts)
  const prompt = `
    Eres un archivista experto del Instituto Tecnológico de Durango. 
    Analiza el siguiente texto extraído de un documento histórico deteriorado mediante OCR.
    
    Tu tarea es clasificar el documento y devolver ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
    {
      "estadoSugerido": "BUENO" | "REGULAR" | "MALO" | "DETERIORADO" | "INCOMPLETO",
      "observaciones": "Breve descripción de anomalías encontradas (ej. falta firma, documento ilegible en ciertas partes, etc.)",
      "tipoDocumento": "ACTA" | "CERTIFICADO" | "TITULO" | "BOLETA" | "OTRO"
    }

    Texto a analizar:
    """
    ${textoOCR}
    """
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Limpiamos la respuesta por si la IA añade formato Markdown (```json)
    const jsonString = response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error en el motor cognitivo:', error);
    throw new Error('No se pudo procesar el análisis semántico del documento.');
  }
};