import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export const initDB = async (): Promise<Database> => {
  if (db) return db;

  try {
 
    db = await Database.load("sqlite:emp_player.db");
    console.log("Database connection established.");
    return db;
  } catch (error) {
    console.error("Database Load Error:", error);
    throw error;
  }
};

export const getDB = (): Database => {
  if (!db) {

    throw new Error("Database belum siap! Pastikan initDB selesai sebelum mount app.");
  }
  return db;
};