# Guion de video (duracion objetivo: 2:40)

> Grabar la pantalla en 1080p, hablar con ritmo normal y comprobar antes de
> entregar que el enlace tenga permiso **Cualquier persona con el enlace puede
> ver**. El video nunca debe superar 3:00.

## 0:00-0:20 — Presentacion

“Este es un servicio GraphQL de biblioteca implementado en TypeScript con
GraphQL Yoga. El repositorio incluye el esquema SDL, codigo, operaciones con
variables, pruebas y documentacion reproducible.”

Mostrar rapidamente `schema.graphql`: `Book`, `Author`, `BookStatus` e inputs.

## 0:20-0:55 — Ejecucion y relacion

Ejecutar `npm run dev`, abrir `http://localhost:4000/graphql` y correr
`ListBooksWithSiblings` desde `demo/operations.graphql` con las variables de
`demo/variables.json`.

Señalar que el cliente selecciona `id`, `title`, `author { name }` y ademas
`author { books { title } }`: la relacion se recorre en los dos sentidos.
Mostrar en la terminal solo dos lineas de DataLoader, una por direccion. Esa es
la evidencia visible de que no se hizo una consulta adicional por libro.

## 0:55-1:25 — Mutacion valida

Ejecutar `CreateBook` con las variables validas. Mostrar el libro creado, su ID,
estado predeterminado `AVAILABLE` y el autor relacionado.

## 1:25-1:55 — Entrada invalida

Volver a ejecutar `CreateBook` con `CreateBookInvalid`. Mostrar el codigo
`BAD_USER_INPUT`, los campos con error y que no aparece ninguna traza interna.

## 1:55-2:20 — Limites operativos

Ejecutar `ListBooks` con `PageLimitInvalid` (`pageSize: 21`). Mostrar que la API
lo rechaza porque el maximo permitido es 20.

Ejecutar `DeepQuery` y mostrar el error `QUERY_TOO_DEEP`: nueve niveles contra un
maximo de ocho. Decir en una frase por que hace falta ese limite: la relacion es
bidireccional y un documento puede recorrerse a si mismo.

## 2:20-2:40 — Verificacion y cierre

En la terminal ejecutar `npm test`. Mostrar las pruebas aprobadas, en especial
la que verifica una sola carga por lotes. Cerrar indicando que el README explica
las decisiones de nulabilidad, errores y la comparacion equilibrada con REST.

## Lista antes de pegar el enlace en Canvas

- [ ] Dura menos de 3 minutos.
- [ ] Se ve el esquema.
- [ ] Se ve una query con relacion y seleccion de campos.
- [ ] Se ve una mutation valida.
- [ ] Se ve una entrada invalida.
- [ ] Se ve paginacion o el limite de 20.
- [ ] Se ve el limite de profundidad (`QUERY_TOO_DEEP`).
- [ ] Se ven las lineas de carga por lotes.
- [ ] El enlace abre sin solicitar acceso.
