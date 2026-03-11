import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let connectionPromise: Promise<Database> | null = null;

export const initDB = async (): Promise<Database> => {
  if (db) return db;
  
  // Jika sedang dalam proses loading, tunggu promise yang sudah ada
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      // Kita tambahkan timeout di level koneksi jika didukung oleh driver (default plugin)
      const instance = await Database.load("sqlite:emp_player.db");
      db = instance;
      console.log("Database connection established.");
      return instance;
    } catch (error) {
      connectionPromise = null; // Reset agar bisa coba lagi jika gagal
      console.error("Database Load Error:", error);
      throw error;
    }
  })();

  return connectionPromise;
};

export const getDB = (): Database => {
  if (!db) {
    throw new Error("Database belum siap! Pastikan initDB selesai di main.ts");
  }
  return db;
};