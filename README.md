# Biblioteca GraphQL en TypeScript

Servicio GraphQL reproducible para consultar y administrar un catalogo de
libros y autores. Esta implementado con TypeScript, GraphQL Yoga y Prisma sobre
SQLite. El contrato publico se encuentra en [`schema.graphql`](schema.graphql).

## Requisitos

- Node.js 20 o superior
- npm

## Persistencia, migraciones y conexion

La aplicacion usa Prisma con SQLite por defecto. Copia `.env.example` como
`.env` y cambia `DATABASE_URL` si necesitas otra ubicacion. No se guardan
secretos en el repositorio.

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

El historial versionado esta en `prisma/migrations/`:

1. `20260911120000_initial_relational_schema`: crea `Author` y `Book`, la
   relacion `Author 1:N Book`, la clave primaria de cada entidad, la clave
   foranea `Book.authorId` y el indice unico `Book.isbn`.
2. `20260912021324_add_loan_entity`: agrega la entidad relacionada `Loan`
   (un libro puede tener muchos prestamos a lo largo del tiempo). Es
   puramente aditiva —solo `CREATE TABLE`/`CREATE INDEX`— por lo que no
   arriesga los datos ya existentes de `Author` y `Book`. Ademas del `CREATE
   TABLE` que genera `prisma migrate dev`, esta migracion se ajusto a mano
   para agregar `CREATE UNIQUE INDEX ... WHERE "returnedAt" IS NULL`: un
   indice unico parcial que impide que un libro tenga dos prestamos activos
   al mismo tiempo. Prisma no expresa indices parciales en `schema.prisma`,
   por lo que la restriccion real vive solo en el SQL de la migracion (queda
   documentado con un comentario ahi mismo). La base la exige aunque alguien
   inserte un registro directamente por SQL, sin pasar por GraphQL.

La base protege esas reglas aun si se salta la capa GraphQL. El seed
(`prisma/seed.ts`, con los datos en `prisma/seed-data.ts`) usa `upsert` por
identificador, por lo que se puede ejecutar varias veces sin duplicar datos.

En desarrollo se usa `prisma migrate dev`, que compara el esquema con el
historial, genera la migracion nueva y la aplica de inmediato; con
`--create-only` la crea sin aplicarla para poder revisar y ajustar el SQL
primero (asi se agrego el indice parcial de `Loan`). En un entorno de
despliegue se usa exclusivamente `prisma migrate deploy` (asi lo hace
`npm run db:migrate` y el `pretest` de `npm test`): aplica el historial
existente en orden, no genera migraciones nuevas y no modifica las ya
aplicadas. Nunca se usa `db push` como sustituto del historial, y ninguna
migracion aplicada se edita para "corregirla" retroactivamente.

Reconstruccion desde una base vacia (Prisma resuelve `DATABASE_URL` en
relacion a `prisma/schema.prisma`, por lo que el archivo real es
`prisma/dev.db`, no `./dev.db`):

```bash
rm -f prisma/dev.db
npm run db:migrate
npm run db:seed
```

En PowerShell:

```powershell
Remove-Item prisma/dev.db -ErrorAction SilentlyContinue
npm run db:migrate
npm run db:seed
```

`npm run db:reset:demo` hace lo mismo con `prisma migrate reset --force`,
pero esa bandera **borra la base sin confirmar**; usarla solo a mano y nunca
contra una base que no sea la de desarrollo local.

El recorrido de una solicitud es: HTTP/GraphQL Yoga recibe la operacion
(`src/server.ts`) -> el resolver en `src/schema.ts` actua como controlador ->
los schemas de Zod (`src/validation.ts`) transforman y validan la entrada ->
el propio resolver coordina el caso de uso (existencia del libro, un solo
prestamo activo) -> el repositorio Prisma (`src/data/store.ts`, sobre
`src/data/prisma.ts`) ejecuta la consulta o transaccion contra SQLite y
traduce las fechas nativas al formato del dominio -> los errores de
persistencia (`src/domain/errors.ts`) o de validacion se traducen a un error
publico estable (`src/errors.ts`: `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`) ->
Yoga devuelve una respuesta consistente. `Book.author`, `Author.books` y
`Book.activeLoan`/`Loan.book` muestran las relaciones sin exponer detalles de
almacenamiento.

Ejemplo concreto con la entidad nueva: `createLoan` valida el input con Zod,
confirma que el libro existe y no tiene un prestamo activo, y llama a
`loanRepository.create`, que abre una transaccion Prisma (crea el `Loan` y
pone `Book.status = LOANED`). Si dos solicitudes llegan al mismo tiempo y
ambas pasan la verificacion antes de escribir, el indice unico parcial de la
migracion rechaza la segunda insercion (error `P2002`); el repositorio lo
traduce a `LoanAlreadyActiveError` y el resolver lo expone como `CONFLICT` —
la regla la garantiza la base, no una condicion de carrera en memoria.

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

Los datos persisten en la base indicada por `DATABASE_URL`.

## Estructura

```text
graphql-biblioteca-ts/
├── demo/                  # Operaciones nombradas, variables y HTTP reproducible
├── src/
│   ├── data/
│   │   ├── prisma.ts      # Cliente Prisma unico (singleton)
│   │   └── store.ts       # Adaptador de persistencia y repositorios
│   ├── domain/
│   │   ├── types.ts       # Modelo interno TypeScript
│   │   └── errors.ts      # Errores de dominio (independientes de GraphQL)
│   ├── context.ts         # DataLoader creado por solicitud
│   ├── errors.ts          # Errores publicos controlados
│   ├── schema.ts          # Resolvers
│   ├── security.ts        # Limites operativos y regla de profundidad
│   ├── server.ts          # GraphQL Yoga sobre node:http
│   └── validation.ts      # Reglas Zod
├── scripts/copy-schema.mjs # Copia el SDL al artefacto compilado
├── test/api.test.ts       # Pruebas de aceptacion
└── schema.graphql         # Contrato SDL
prisma/
├── schema.prisma          # Modelo relacional y restricciones
├── migrations/            # Historial SQL versionado
├── seed-data.ts           # Datos minimos compartidos por seed.ts y las pruebas
└── seed.ts                # Seed reproducible e idempotente
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
- `Loan` es la entidad agregada para S7: relaciona un libro con quien lo
  solicito. `Book.activeLoan` es anulable porque la mayoria de los libros no
  tiene un prestamo vigente; `Loan.returnedAt` es anulable mientras el
  prestamo sigue activo. La base impide, con un indice unico parcial, que un
  mismo libro tenga dos prestamos activos simultaneos.

## Operaciones implementadas

| Operacion | Proposito |
| --- | --- |
| `GetBook` | Consulta un elemento por ID y puede recorrer su autor. |
| `ListBooks` | Filtra por texto, estado o autor y pagina el resultado. |
| `CreateBook` | Crea un libro mediante una entrada tipada. |
| `UpdateBook` | Modifica estado, contenido, ISBN o autor. |
| `ListBooksWithSiblings` | Recorre la relacion en ambos sentidos con un lote por direccion. |
| `CreateLoan` | Registra un prestamo y marca el libro como `LOANED`. |
| `ReturnLoan` | Marca un prestamo como devuelto y regresa el libro a `AVAILABLE`. |
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

El video (guion en `GUION-VIDEO-S7.md`) muestra: la estructura del proyecto
antes/despues de agregar `Loan`, el recorrido de una solicitud a traves de
validacion/resolver/repositorio, la migracion aplicada, la restriccion de un
solo prestamo activo funcionando en vivo, y la reconstruccion completa desde
una base vacia (`prisma/dev.db` eliminado, `npm run db:migrate` y
`npm run db:seed`). Antes de entregar, verificar en una ventana privada que el
enlace del video tenga permiso de lectura y que su duracion sea menor de tres
minutos.

## Referencias tecnicas

- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server/)
- [DataLoader](https://github.com/graphql/dataloader)
- [GraphQL: Learn](https://graphql.org/learn/)
- [Zod](https://zod.dev/)

## Licencia

MIT
