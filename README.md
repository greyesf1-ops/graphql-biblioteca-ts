# Biblioteca GraphQL en TypeScript

Servicio GraphQL reproducible para consultar y administrar un catalogo de
libros y autores. Esta implementado con TypeScript, GraphQL Yoga y datos en
memoria. El contrato publico se encuentra en [`schema.graphql`](schema.graphql).

## Requisitos

- Node.js 20 o superior
- npm

## Instalacion y ejecucion

```bash
npm install
npm run dev
```

Abrir <http://localhost:4000/graphql>. GraphiQL permite ejecutar las operaciones
incluidas en [`demo/operations.graphql`](demo/operations.graphql) con los juegos
de variables de [`demo/variables.json`](demo/variables.json). Tambien se pueden
enviar directamente las solicitudes de [`demo/requests.http`](demo/requests.http)
con la extension REST Client de VS Code.

Comprobacion completa:

```bash
npm run check
```

Este comando verifica tipos, ejecuta las pruebas y genera `dist/`. Para ejecutar
esa compilacion:

```bash
npm start
```

Los datos viven en memoria y regresan al estado inicial al reiniciar el proceso.

## Estructura

```text
graphql-biblioteca-ts/
├── demo/                  # Operaciones nombradas, variables y HTTP reproducible
├── src/
│   ├── data/store.ts      # Repositorios y datos en memoria
│   ├── domain/types.ts    # Modelo interno TypeScript
│   ├── context.ts         # DataLoader creado por solicitud
│   ├── errors.ts          # Errores publicos controlados
│   ├── schema.ts          # Resolvers
│   ├── security.ts        # Limites operativos y regla de profundidad
│   ├── server.ts          # GraphQL Yoga sobre node:http
│   └── validation.ts      # Reglas Zod
├── scripts/copy-schema.mjs # Copia el SDL al artefacto compilado
├── test/api.test.ts       # Pruebas de aceptacion
└── schema.graphql         # Contrato SDL
```

## Decisiones del esquema

- `Book` y `Author` son objetos relacionados en los dos sentidos. `Book.author`
  permite que el cliente recorra la relacion y seleccione unicamente los campos
  que necesita; `Author.books` recorre la relacion inversa y acepta `status` y
  `first` para que nunca devuelva una lista sin limite.
- `BookStatus` restringe el estado a `AVAILABLE`, `LOANED`, `RESERVED` o
  `MAINTENANCE`. Las entradas de crear, actualizar, filtrar y paginar son tipos
  separados; no se expone el modelo interno como entrada publica.
- `Book.summary`, `Book.publishedYear` y `Author.biography` son anulables porque
  esos datos pueden ser desconocidos sin invalidar el recurso.
- `Query.book` es anulable: un identificador bien formado que no existe produce
  `{ "book": null }`. En cambio, modificar un libro inexistente devuelve un
  error `NOT_FOUND`, porque la mutation no puede cumplir su efecto.
- El modelo interno tambien contiene `authorId`, `shelfCode` y
  `acquisitionCost`. No se copiaron mecanicamente al esquema: son detalles de
  almacenamiento que el cliente del catalogo no necesita.

## Operaciones implementadas

| Operacion | Proposito |
| --- | --- |
| `GetBook` | Consulta un elemento por ID y puede recorrer su autor. |
| `ListBooks` | Filtra por texto, estado o autor y pagina el resultado. |
| `CreateBook` | Crea un libro mediante una entrada tipada. |
| `UpdateBook` | Modifica estado, contenido, ISBN o autor. |
| `ListBooksWithSiblings` | Recorre la relacion en ambos sentidos con un lote por direccion. |
| `DeepQuery` | Documento de nueve niveles que el limite de profundidad rechaza. |

Todas las demostraciones usan un nombre de operacion, variables separadas y no
concatenan datos dentro del documento GraphQL.

## Validacion y errores

Zod valida los datos mas alla de los tipos basicos de GraphQL:

- titulo entre 3 y 120 caracteres;
- resumen nulo o entre 10 y 500 caracteres;
- ISBN de 10 o 13 digitos y unico;
- ano entre 1450 y el ano siguiente al actual;
- existencia del autor relacionado;
- al menos un campo en `UpdateBookInput`;
- pagina positiva y `pageSize` entre 1 y 20.

Los errores esperados usan codigos estables en `extensions.code`:
`BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT` y `QUERY_TOO_DEEP`.
Sus detalles indican campos que el
cliente puede corregir. GraphQL Yoga conserva el enmascaramiento de errores
inesperados con el mensaje generico `Ocurrio un error interno.`; las respuestas
no incluyen stack traces.

## Paginacion y limites operativos

`ListBooks` usa paginacion por numero de pagina. Primero aplica los filtros,
despues calcula metadatos (`totalItems`, `totalPages`, `hasNextPage` y
`hasPreviousPage`) y finalmente toma el segmento solicitado.

El servicio define tres limites, todos en [`src/security.ts`](src/security.ts):

| Limite | Valor | Donde se aplica | Que ocurre al excederlo |
| --- | --- | --- | --- |
| Tamano de pagina | 20 elementos | `Query.books` y `Author.books` | `BAD_USER_INPUT` |
| Profundidad de la operacion | 8 niveles | Validacion, antes de ejecutar | `QUERY_TOO_DEEP` |
| Tiempo de la solicitud HTTP | 10 s | `server.requestTimeout` | La conexion se cierra |

El limite de profundidad importa precisamente porque la relacion es
bidireccional: `Book.author` y `Author.books` permiten escribir un documento que
se recorre a si mismo indefinidamente. La regla expande fragmentos, protege
contra fragmentos ciclicos y **no cuenta la introspeccion**, para que GraphiQL
siga mostrando la documentacion del esquema. Los tres controles tienen pruebas
automatizadas.

## Relacion sin N+1

Cada solicitud crea sus propios `DataLoader`, uno por direccion de la relacion.
Los resolvers piden un autor o los libros de un autor de forma individual, pero
DataLoader agrupa los identificadores del mismo ciclo y elimina duplicados antes
de llamar una sola vez al repositorio.

Listar cinco libros de tres autores, pidiendo ademas los libros de cada autor,
produce exactamente dos accesos y no diez:

```text
[DataLoader] consulta de autores #1; lote=[author-1, author-2, author-3]
[DataLoader] consulta de libros por autor #1; lote=[author-1, author-2, author-3]
```

Las pruebas de `test/api.test.ts` ejecutan las queries reales y exigen que
`authorRepository.findByIds` y `bookRepository.findByAuthorIds` se invoquen
exactamente una vez, cada una con los tres IDs. El cache no es global: se crea
por solicitud para no mezclar datos entre clientes.

## Comparacion con una alternativa REST

Una representacion REST razonable podria usar:

```text
GET    /books/:id
GET    /books?search=&status=&authorId=&page=&pageSize=
POST   /books
PATCH  /books/:id
GET    /authors/:id
```

En esta pantalla de catalogo, GraphQL permite solicitar en una sola operacion
solo `id`, `title`, `status` y `author.name`. Con REST, `GET /books` tendria que
incrustar siempre cierta representacion del autor, admitir un parametro como
`include=author`, o exigir solicitudes adicionales. GraphQL hace explicita la
seleccion y facilita que distintos clientes pidan formas diferentes sin crear
endpoints por vista.

El costo aparece justo en lo que este repositorio tuvo que construir. REST no
necesita un limite de profundidad porque `GET /books` no puede recorrerse a si
mismo; aqui si hizo falta, junto con el esquema, los resolvers, la carga por
lotes y una estrategia de cache menos directa que el cache HTTP por URL. REST puede ser mas simple para recursos con
representaciones estables y operaciones CRUD directas. Ninguno es ganador
universal: en este caso GraphQL aporta valor por la relacion y las selecciones
variables; REST conserva una ventaja de simplicidad operacional.

## Video de demostracion

El video muestra el esquema, una query con relacion y seleccion de campos, una
mutation valida, una entrada invalida y la estrategia de paginacion/profundidad.
Antes de entregar, verificar en una ventana privada que el enlace del video
tenga permiso de lectura y que su duracion sea menor de tres minutos.

## Referencias tecnicas

- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server/)
- [DataLoader](https://github.com/graphql/dataloader)
- [GraphQL: Learn](https://graphql.org/learn/)
- [Zod](https://zod.dev/)

## Licencia

MIT
