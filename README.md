# Flama

Interfaz de venta de panchos con Vite y TypeScript. Sin backend ni envío de pedidos por ahora.

## Desarrollo

```sh
npm install
npm run dev
```

## Producción

```sh
npm run build
npm run preview
```

En Vercel: framework Vite, comando `npm run build`, directorio de salida `dist`.

Las salsas y los aderezos son opciones de ejemplo editables en `src/main.ts`. Se pueden elegir hasta dos salsas y cualquier combinación de aderezos. Las selecciones se mantienen al volver al menú y se reinician al recargar. El carrusel soporta botones, teclado y gestos táctiles; la navegación permanece deshabilitada mientras haya un solo producto.
