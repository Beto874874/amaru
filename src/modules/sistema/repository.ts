import { sql } from 'drizzle-orm';
import { db } from '../../config/db.js';

// Prueba minima de conectividad. Se hace con Drizzle para respetar la regla
// "solo el repository importa Drizzle".
export async function comprobarBaseDeDatos(): Promise<void> {
  await db.execute(sql`select 1`);
}
