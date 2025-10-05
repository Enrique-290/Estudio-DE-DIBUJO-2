# Bloc de Dibujo + AutoTexto (Azure OCR, listo para Vercel)
## ¿Qué hay nuevo?
- Arreglado: el overlay ya **no bloquea** el dibujo (`pointer-events:none` y `[hidden]{display:none}`).
- **AutoTexto con Azure OCR**: selecciona "AutoTexto → Azure OCR", escribe y al soltar se recorta la zona del trazo y se manda a OCR. El texto regresa y aparece en una caja editable.
- Incluye función serverless `/api/recognize` (Vercel Edge) que **protege tu clave**.

## Cómo desplegar en Vercel
1. Crea un proyecto nuevo con estos archivos.
2. En **Project → Settings → Environment Variables** agrega:
   - `AZURE_VISION_ENDPOINT` → p. ej. `https://tu-recurso.cognitiveservices.azure.com`
   - `AZURE_VISION_KEY` → tu clave de Azure Vision
3. Deploy. Abre la app, elige **AutoTexto → Azure OCR**, escribe y suelta.

> Si no tienes Azure, puedes cambiar la función para Google Cloud Vision o MyScript. Yo te paso el adaptador si lo pides.

## Local
- Abre `index.html` directo para probar (el modo Azure requiere estar detrás de un servidor por CORS; en Vercel funciona).

## Notas
- El recorte manda solo la franja del trazo (mejor precisión y menos costo).
- Exportar PNG/PDF compone las cajas de texto sobre el lienzo.
