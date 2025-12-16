# Instrucciones para Corregir Intentos Existentes

## Problema
Los intentos anteriores se guardaron con el texto completo de la opción en lugar de la letra (A, B, C, D). Esto causaba que las validaciones no funcionaran correctamente.

## Solución
Se ha creado un script SQL que:
1. Convierte las respuestas del formato antiguo (texto completo) al nuevo formato (letra)
2. Recalcula el campo `is_correct` basado en la letra correcta
3. Actualiza todos los intentos existentes

## Pasos para Ejecutar la Migración

1. **Abre el Supabase Dashboard**
   - Ve a tu proyecto en https://supabase.com
   - Navega a "SQL Editor"

2. **Ejecuta el Script de Migración**
   - Abre el archivo `supabase_migration_fix_user_answers.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en "Run" o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)

3. **Verifica los Resultados**
   - El script mostrará un mensaje con el número de intentos actualizados
   - Revisa que los intentos ahora tengan `user_answer` como una letra (A, B, C, D)
   - Verifica que `is_correct` esté calculado correctamente

## Notas Importantes

- **Backup**: Aunque el script es seguro, siempre es recomendable hacer un backup de tu base de datos antes de ejecutar migraciones
- **Tiempo**: El script puede tardar unos segundos dependiendo de cuántos intentos tengas
- **Retrocompatibilidad**: El código ahora es retrocompatible, así que funcionará con ambos formatos hasta que ejecutes la migración

## ¿Qué Hace el Script?

1. Crea una función temporal que convierte texto de opción a letra
2. Busca todos los intentos donde `user_answer` no es una sola letra
3. Para cada intento:
   - Encuentra la letra correspondiente al texto de la opción
   - Actualiza `user_answer` con la letra
   - Recalcula `is_correct` comparando la letra con `answer_key`
4. Elimina la función temporal

## Después de la Migración

Una vez ejecutado el script:
- Todos los intentos existentes estarán en el formato correcto
- Las validaciones funcionarán correctamente
- El Dashboard de Errores mostrará correctamente las respuestas

