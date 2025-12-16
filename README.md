# Study App MVP

Aplicación de estudio con preguntas, respuestas y métricas básicas.

## Stack

- Next.js 16 (App Router)
- TypeScript
- TailwindCSS
- Supabase (Auth + Postgres)
- OpenAI API (opcional, solo para evaluación)

## Setup Completo

### 1. Crear proyecto Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto (espera a que termine de inicializar)
3. Ve a Settings → API
4. Anota los siguientes valores:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Configuración de Autenticación (IMPORTANTE para MVP):**

Para que el registro funcione sin problemas de email, configura lo siguiente:

1. Ve a **Authentication** → **Providers** en el panel de Supabase
2. Asegúrate de que **Email** esté habilitado
3. Ve a **Authentication** → **Email Templates** (opcional, para personalizar emails)
4. **Para desarrollo/MVP**: Ve a **Authentication** → **Settings** y desactiva **"Enable email confirmations"** si quieres que los usuarios puedan iniciar sesión inmediatamente sin confirmar email
5. **Para producción**: Configura un proveedor SMTP en **Settings** → **Auth** → **SMTP Settings** para enviar emails reales

### 2. Configurar base de datos

1. En Supabase, ve al SQL Editor
2. Copia y pega todo el contenido del archivo `supabase.sql`
3. Ejecuta el script (botón "Run" o Cmd/Ctrl + Enter)
4. Si obtienes el error "Could not find table 'study_routes'", ejecuta también el archivo `supabase_migration_study_routes.sql`
5. Si obtienes el error "Could not find the 'item_type' column", ejecuta el archivo `supabase_migration_hierarchical_structure.sql`
6. Verifica que se crearon las tablas:
   - `topics` (temas principales)
   - `subtopics` (subtemas con contenido educativo)
   - `questions` (preguntas)
   - `attempts` (intentos de usuarios)
   - `study_routes` (rutas de estudio)
   - `study_route_items` (items de rutas con estructura jerárquica: temas → subtemas → clases)
   - `study_planner` (planner semanal)

**Nota sobre la estructura jerárquica:**
- Las rutas de estudio tienen una estructura jerárquica: **Temas** → **Subtemas** → **Clases**
- Cada subtema tiene contenido educativo (`content`) que se muestra como "clase"
- Las clases se crean automáticamente cuando se genera una ruta con IA
- En el planner, solo se pueden asignar clases (no temas o subtemas completos)

### 3. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
OPENAI_API_KEY=tu_openai_api_key_opcional
```

**Importante:**
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` son **obligatorias**
- `OPENAI_API_KEY` es **opcional**. Si no la configuras, el endpoint `/api/ai/evaluate` devolverá 501 pero no romperá el build ni la app

### 4. Instalar dependencias

```bash
npm install
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:3000`

### 6. Verificar que todo funciona

1. Ve a `http://localhost:3000`
2. Haz clic en "Login / Signup" y crea una cuenta
3. Ve a "Study" y responde algunas preguntas
4. Ve a "Dashboard" para ver tus estadísticas

**Nota sobre warnings de build**: Puedes ver warnings sobre `wrapper.mjs` durante el build. Estos son warnings conocidos de webpack con módulos ESM de Supabase y no afectan la funcionalidad. El build se completa exitosamente y la app funciona correctamente tanto en desarrollo como en producción.

### 7. Deploy en Vercel

1. Sube tu código a GitHub/GitLab/Bitbucket
2. Ve a [vercel.com](https://vercel.com) y conecta tu repositorio
3. En la configuración del proyecto, añade las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY` (opcional)
4. Haz clic en "Deploy"

**Nota**: El endpoint `/api/ai/evaluate` devolverá 501 si `OPENAI_API_KEY` no está configurado, pero no romperá el build. La app funcionará normalmente sin IA.

## Estructura de Rutas

- `/` - Landing page con CTAs a Study/Dashboard
- `/auth` - Login/Signup con Supabase Auth (redirige a `/study` después del login)
- `/study` - Lista de preguntas y formulario para responder
  - Muestra hasta 10 preguntas
  - Permite responder y guardar intentos
  - Opción de evaluar con IA (checkbox)
- `/dashboard` - Métricas básicas:
  - Total de intentos, correctas, incorrectas
  - Precisión general
  - Estadísticas por tema (aciertos/errores por tema)
- `/api/ai/evaluate` - Endpoint POST para clasificar respuestas abiertas
  - Recibe: `{ userAnswer, answerKey, prompt }`
  - Devuelve: `{ isCorrect: boolean, reasoning?: string }`
  - Retorna 501 si `OPENAI_API_KEY` no está configurado

## Base de Datos

### Tablas

- **topics**: Temas de estudio (JavaScript, React, TypeScript, Next.js)
- **questions**: Preguntas con prompt, respuesta clave y explicación
- **attempts**: Intentos de los usuarios (user_id, question_id, is_correct, user_answer)

### Seguridad (RLS)

- `topics` y `questions`: Lectura pública
- `attempts`: Cada usuario solo puede ver/insertar sus propios intentos

## Tecnologías Utilizadas

- **Next.js 14**: App Router, Server Components, Server Actions
- **TypeScript**: Tipado estático
- **TailwindCSS**: Estilos
- **Supabase**: Auth y base de datos PostgreSQL
- **Zod**: Validación de schemas
- **OpenAI API**: Evaluación de respuestas con IA (opcional)

## Solución de Problemas

### No recibo emails de confirmación

**Problema**: Al registrarte, no recibes el email de confirmación.

**Soluciones**:

1. **Para desarrollo/MVP (recomendado)**: Desactiva la confirmación de email
   - Ve a Supabase Dashboard → **Authentication** → **Settings**
   - Desactiva **"Enable email confirmations"**
   - Los usuarios podrán iniciar sesión inmediatamente después de registrarse

2. **Para producción**: Configura SMTP
   - Ve a Supabase Dashboard → **Settings** → **Auth** → **SMTP Settings**
   - Configura un proveedor SMTP (Gmail, SendGrid, Mailgun, etc.)
   - O usa el servicio de email de Supabase (limitado)

3. **Verificar carpeta de spam**: Los emails pueden llegar a spam

4. **Revisar logs de Supabase**: Ve a **Authentication** → **Users** para ver el estado de los usuarios

### Error: "Invalid API key"
- Verifica que las variables de entorno estén correctamente configuradas
- En Vercel, asegúrate de que las variables estén en "Environment Variables"

### Error: "relation does not exist"
- Ejecuta el archivo `supabase.sql` completo en el SQL Editor de Supabase
- Verifica que todas las tablas se crearon correctamente

### La evaluación con IA no funciona
- Verifica que `OPENAI_API_KEY` esté configurado correctamente
- Si no está configurado, la app usa comparación simple (case-insensitive)
- El endpoint devuelve 501 si la key no está disponible (esto es normal)

## Próximos Pasos (fuera del MVP)

- Paginación de preguntas
- Más temas y preguntas
- Filtros por tema en Study
- Gráficos en Dashboard
- Historial de intentos
- Modo de práctica vs. examen

