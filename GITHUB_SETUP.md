# Instrucciones para Subir a GitHub

## ✅ Paso 1: Commit Inicial Completado
El repositorio local ya está inicializado y el commit inicial está hecho.

## 📝 Paso 2: Crear Repositorio en GitHub

1. **Ve a GitHub.com** y inicia sesión
2. **Haz clic en el botón "+"** (arriba a la derecha) → "New repository"
3. **Configura el repositorio:**
   - **Repository name**: `study-app-mvp` (o el nombre que prefieras)
   - **Description**: "MVP Study Application with Next.js, Supabase, and TypeScript"
   - **Visibility**: Elige "Public" o "Private" según prefieras
   - ⚠️ **NO marques** "Initialize this repository with a README" (ya tenemos uno)
   - ⚠️ **NO agregues** .gitignore ni license (ya los tenemos)
4. **Haz clic en "Create repository"**

## 🔗 Paso 3: Conectar con GitHub

Después de crear el repositorio, GitHub te mostrará instrucciones. Ejecuta estos comandos:

```bash
cd "/Users/Angevalcent/Desktop/EDK 2"

# Agrega el remote (reemplaza USERNAME con tu usuario de GitHub)
git remote add origin https://github.com/USERNAME/study-app-mvp.git

# O si prefieres SSH:
# git remote add origin git@github.com:USERNAME/study-app-mvp.git

# Verifica que el remote esté configurado
git remote -v

# Sube el código
git branch -M main
git push -u origin main
```

## 🔐 Paso 4: Configurar Variables de Entorno en GitHub

Si planeas usar GitHub Actions o quieres documentar las variables necesarias:

1. Ve a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions** (si usas Actions)
3. O crea un archivo `.env.example` en el repositorio con:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

## 📋 Archivos Importantes que NO se Suben

Gracias al `.gitignore`, estos archivos NO se subirán (y está bien):
- `.env` - Variables de entorno locales
- `node_modules/` - Dependencias
- `.next/` - Build de Next.js
- Archivos de sistema (`.DS_Store`, etc.)

## ✅ Verificación

Después del push, verifica que:
- ✅ Todos los archivos estén en GitHub
- ✅ El README.md se muestre correctamente
- ✅ Los archivos SQL de migración estén incluidos
- ✅ El `.gitignore` esté funcionando (no deberías ver `.env` ni `node_modules`)

## 🚀 Siguiente Paso: Deploy en Vercel

Una vez en GitHub, puedes conectar el repositorio a Vercel para deploy automático:
1. Ve a [vercel.com](https://vercel.com)
2. Importa el repositorio de GitHub
3. Configura las variables de entorno
4. ¡Deploy automático en cada push!

