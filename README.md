## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Guías para agregar juegos

- [GAME-INTEGRATION-GUIDE.md](GAME-INTEGRATION-GUIDE.md): cómo construir un juego a mano en TypeScript e integrarlo a la plataforma.
- [JAVA-GAME-INTEGRATION-GUIDE.md](JAVA-GAME-INTEGRATION-GUIDE.md): lo mismo para un juego escrito en Java, compilado a JavaScript con TeaVM (el ejemplo es Dot Catcher, que ya está en el catálogo).

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```


```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint (flat config, eslint.config.mjs)
npm run build:java  # compila java/dot-catcher a public/game-assets/dot-catcher/dot-catcher.js (requiere JDK 17+)
```