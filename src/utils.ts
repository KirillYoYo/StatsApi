import Dexie from 'dexie';

export async function checkDatabaseExists(dbName: string): Promise<boolean> {
  try {
    return await Dexie.exists(dbName);
  } catch (error) {
    console.error('Ошибка при проверке существования базы:', error);
    return false;
  }
}
