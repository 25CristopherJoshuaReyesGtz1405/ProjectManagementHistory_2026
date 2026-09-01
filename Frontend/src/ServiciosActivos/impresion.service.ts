import { Injectable } from '@angular/core';
import { Expediente } from './../ModelosActivos/ModelosAplicacion.model';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;

@Injectable({
  providedIn: 'root'
})
export class ImpresionService {

  // Paleta de Colores Ultra Premium ITD
  private C_GUINDA = '#5a121c';
  private C_DORADO = '#C5A059';
  private C_TEXTO_MAIN = '#2c3e50';
  private C_TEXTO_MUTED = '#7f8c8d';
  private C_BG_LIGHT = '#f8fafc';

  constructor() { }

  imprimirCaratulaExpediente(expediente: Expediente, nombreCompleto: string, usuarioImpresion: string = 'Administrador') {
    
    // Obtener fecha actual formateada
    const fechaHoy = new Date().toLocaleDateString('es-MX', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const docDefinition: any = {
      pageSize: 'LETTER',
      pageMargins: [ 50, 60, 50, 60 ],

      // Metadatos del PDF
      info: {
        title: `Carátula de Expediente - ${expediente.numControl}`,
        author: 'SIGAH ITD',
        subject: 'Documento Oficial de Archivo Histórico'
      },

      // MARCA DE AGUA INSTITUCIONAL
      watermark: { text: 'SIGAH - ITD', color: '#e0e0e0', opacity: 0.3, bold: true, italics: false },

      // PIE DE PÁGINA (Se repite en todas las hojas si hubiera más de una)
      footer: (currentPage: number, pageCount: number) => {
        return {
          columns: [
            { text: `Impreso por: ${usuarioImpresion} el ${fechaHoy}`, style: 'footerText', alignment: 'left' },
            { text: 'Técnica al Servicio de la Patria', style: 'footerText', alignment: 'center', color: this.C_DORADO, bold: true },
            { text: `Página ${currentPage} de ${pageCount}`, style: 'footerText', alignment: 'right' }
          ],
          margin: [50, 20, 50, 0]
        };
      },

      content: [
        // --- 1. ENCABEZADO PREMIUM ---
        {
          columns: [
            {
              // Placeholder para el logo en Base64. 
              text: '[ ESCUDO ITD ]', 
              color: this.C_DORADO,
              bold: true,
              fontSize: 14,
              width: 100,
              margin: [0, 10, 0, 0]
            },
            {
              text: [
                { text: 'INSTITUTO TECNOLÓGICO DE DURANGO\n', style: 'headerMain' },
                { text: 'DEPARTAMENTO DE SERVICIOS ESCOLARES\n', style: 'headerSub' },
                { text: 'SISTEMA INTEGRAL DE GESTIÓN DE ARCHIVOS HISTÓRICOS', style: 'headerSub', color: this.C_DORADO }
              ],
              alignment: 'right',
              width: '*'
            }
          ],
          margin: [0, 0, 0, 10]
        },
        
        // Línea divisoria elegante (Guinda gruesa y Dorado fina)
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 510, y2: 0, lineWidth: 3, lineColor: this.C_GUINDA }] },
        { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 510, y2: 2, lineWidth: 0.5, lineColor: this.C_DORADO }] },
        
        { text: 'CARÁTULA DE EXPEDIENTE HISTÓRICO', style: 'documentTitle' },

        // --- 2. CÓDIGO QR Y FOLIO ---
        {
          columns: [
            { width: '*', text: '' }, // Espaciador
            {
              width: 'auto',
              table: {
                widths: ['auto'],
                body: [
                  [
                    {
                      stack: [
                        { text: 'FOLIO DE SISTEMA', fontSize: 7, color: this.C_TEXTO_MUTED, alignment: 'center', bold: true },
                        { text: expediente.folioDigital, fontSize: 12, color: this.C_GUINDA, alignment: 'center', bold: true, margin: [0, 2, 0, 5] },
                        // Generación automática de Código QR (Super Premium para inventario)
                        { qr: expediente.folioDigital, fit: 70, alignment: 'center', foreground: this.C_TEXTO_MAIN }
                      ],
                      fillColor: this.C_BG_LIGHT,
                      border: [true, true, true, true],
                      borderColor: [this.C_DORADO, this.C_DORADO, this.C_DORADO, this.C_DORADO],
                      margin: [10, 10, 10, 10]
                    }
                  ]
                ]
              },
              layout: { defaultBorder: false }
            }
          ],
          margin: [0, -40, 0, 20] // Margen negativo para subirlo al lado del título
        },

        // --- 3. DATOS DE IDENTIFICACIÓN ---
        { text: 'INFORMACIÓN DEL EGRESADO', style: 'sectionHeader' },
        {
          table: {
            widths: [130, '*'],
            body: [
              [ { text: 'NÚMERO DE CONTROL', style: 'label' }, { text: expediente.numControl, style: 'valueHighlight' } ],
              [ { text: 'NOMBRE COMPLETO', style: 'label' }, { text: nombreCompleto.toUpperCase(), style: 'value' } ],
              [ { text: 'NIVEL ACADÉMICO', style: 'label' }, { text: expediente.nivel, style: 'value' } ],
              [ { text: 'GENERACIÓN', style: 'label' }, { text: expediente.generacion, style: 'value' } ],
              [ { text: 'ESTATUS', style: 'label' }, { text: expediente.estatus, style: 'value' } ]
            ]
          },
          layout: this.crearLayoutTablaPremium(),
          margin: [0, 0, 0, 25]
        },

        // --- 4. UBICACIÓN TOPOGRÁFICA ---
        { text: 'COORDENADAS FÍSICAS DE ARCHIVO', style: 'sectionHeader' },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [
              // Fila de encabezados de tabla
              [ 
                { text: 'EDIFICIO', style: 'tableHeader' }, 
                { text: 'ESTANTE', style: 'tableHeader' }, 
                { text: 'CAJA', style: 'tableHeader' }, 
                { text: 'CARPETA', style: 'tableHeader' } 
              ],
              // Fila de datos
              [ 
                { text: expediente.ubicacion.edificio || 'N/A', style: 'tableCell' }, 
                { text: expediente.ubicacion.estante || 'N/A', style: 'tableCell' }, 
                { text: expediente.ubicacion.caja, style: 'tableCellHighlight' }, 
                { text: expediente.ubicacion.carpeta, style: 'tableCellHighlight' } 
              ]
            ]
          },
          layout: {
            hLineWidth: (i: number, node: { table: { body: string | any[]; }; }) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: (i: any, node: any) => 0, // Sin líneas verticales para un look más limpio
            fillColor: (i: number, node: any) => (i === 0) ? this.C_GUINDA : (i % 2 === 0 ? this.C_BG_LIGHT : null)
          },
          margin: [0, 0, 0, 25]
        },

        // --- 5. FIRMAS OBLIGATORIAS ---
        {
          columns: [
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: this.C_TEXTO_MAIN }] },
                { text: 'FIRMA DE DIGITALIZACIÓN', style: 'signatureLabel' }
              ],
              alignment: 'center'
            },
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: this.C_TEXTO_MAIN }] },
                { text: 'FIRMA DE JEFATURA DE ARCHIVO', style: 'signatureLabel' }
              ],
              alignment: 'center'
            }
          ],
          margin: [0, 60, 0, 0] // Espacio grande para firmar
        }
      ],

      styles: {
        // Tipografías
        headerMain: { fontSize: 16, bold: true, color: this.C_GUINDA, letterSpacing: 1 },
        headerSub: { fontSize: 9, color: this.C_TEXTO_MUTED, margin: [0, 2, 0, 0], bold: true, letterSpacing: 0.5 },
        documentTitle: { fontSize: 16, bold: true, color: this.C_TEXTO_MAIN, alignment: 'center', margin: [0, 20, 0, 20], letterSpacing: 1 },
        
        sectionHeader: { fontSize: 11, bold: true, color: '#ffffff', fillColor: this.C_GUINDA, margin: [0, 0, 0, 8], padding: [10, 4, 10, 4] },
        
        label: { fontSize: 9, bold: true, color: this.C_TEXTO_MUTED, margin: [5, 6, 5, 6], alignment: 'right' },
        value: { fontSize: 10, color: this.C_TEXTO_MAIN, margin: [10, 6, 5, 6], bold: true },
        valueHighlight: { fontSize: 11, color: this.C_GUINDA, margin: [10, 6, 5, 6], bold: true },
        
        tableHeader: { fontSize: 9, bold: true, color: '#ffffff', margin: [5, 8, 5, 8], alignment: 'center' },
        tableCell: { fontSize: 10, color: this.C_TEXTO_MAIN, margin: [5, 10, 5, 10], alignment: 'center' },
        tableCellHighlight: { fontSize: 12, color: this.C_GUINDA, margin: [5, 10, 5, 10], alignment: 'center', bold: true },

        signatureLabel: { fontSize: 8, color: this.C_TEXTO_MUTED, bold: true, margin: [0, 5, 0, 0] },
        footerText: { fontSize: 8, color: '#95a5a6' }
      }
    };

    pdfMake.createPdf(docDefinition).open();
  }

  /**
   * Helper para crear tablas sin bordes rígidos, solo líneas horizontales sutiles
   */
  private crearLayoutTablaPremium() {
    return {
      hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#e2e8f0',
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 4,
      paddingBottom: () => 4
    };
  }
}