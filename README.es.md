# Tab Merge N Sort

<p><img src="extension_chrome/icons/icon-128.png" width="96" height="96" alt="Tab Merge N Sort"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

## Resumen

Combina pestañas y ordena la ventana actual o todas las ventanas por URL o título. Chrome declara 0.99.1 y Safari de escritorio conserva 0.99.0.

## Uso

Cargue extension_chrome/ con “Cargar descomprimida” en Chrome y use las acciones de combinar y ordenar. Conserve el ID fijado por clave pública y las claves de almacenamiento al actualizar. No requiere hub ni enlaces simbólicos.

## Límites de plataforma

Safari de escritorio no admite tabs.move, necesario para combinar y ordenar. Si falta, la extensión informa que no puede mover pestañas y las deja intactas. No cierra y reabre pestañas ni añade permisos de automatización nativa. La versión no prueba equivalencia con Chrome. La construcción nativa requiere macOS, Xcode, XcodeGen y configuración privada de firma. No incluye iOS／VIA ni publicación Firefox.

## Código y compilación

Instale Deno2.x y Git y ejecute estos comandos en el repositorio. Las pruebas usan ejemplos locales sintéticos. La compilación crea un candidato en Local/candidates, ignorado por Git, y verifica sus bytes exactos. No instala la extensión, abre el navegador ni accede a ajustes personales. Las comprobaciones normales usan dependencias locales fijadas, sin repositorios hermanos.

```sh
deno task check
deno task build
```

## Privacidad y revisión

Prepare los archivos revisados por nombre y ejecute deno task public:check y deno task public:prepare. public-source.json selecciona entradas exactas del índice Git; excluye registros privados, configuración e historial Git. El candidato es inmutable: al repetir se compara y se rechazan diferencias sin sobrescribir. El escaneo limitado no verifica todo el historial ni detecta todos los secretos. La preparación no cambia destinos, datos ni ajustes del navegador.

## Licencia

El código propio de esta versión usa GNU GPL versión3 solamente, GPL-3.0-only. Las concesiones MIT de versiones anteriores siguen vigentes. Las fuentes y recursos ajenos conservan sus términos. Mantenga LICENSE, la concesión MIT anterior y todos los avisos. La revisión de derechos y contenido sigue siendo necesaria antes de publicar. Un candidato local no acredita publicación, instalación ni limpieza del historial completo.
