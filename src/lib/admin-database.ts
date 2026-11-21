import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AppSettings from '@/models/AppSettings';
import Attendance from '@/models/Attendance';
import CashierCredential from '@/models/CashierCredential';
import Category from '@/models/Category';
import Employee from '@/models/Employee';
import EmployeeAccount from '@/models/EmployeeAccount';
import Item from '@/models/Item';
import Ledger from '@/models/Ledger';
import Location from '@/models/Location';
import PayrollDetail from '@/models/PayrollDetail';
import PayrollRun from '@/models/PayrollRun';
import Purchase from '@/models/Purchase';
import StockAdjustment from '@/models/StockAdjustment';
import StockBalance from '@/models/StockBalance';
import StockTransfer from '@/models/StockTransfer';
import Sale from '@/models/Sale';
import SystemAccount from '@/models/SystemAccount';
import Unit from '@/models/Unit';

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const BACKUP_FORMAT = 'inpay-database-backup';
export const BACKUP_VERSION = 2;
export const BACKUP_BUCKET_NAME = 'inpayAdminBackups';

export const BUSINESS_COLLECTIONS = [
  Attendance.collection.name,
  CashierCredential.collection.name,
  Category.collection.name,
  Employee.collection.name,
  EmployeeAccount.collection.name,
  Item.collection.name,
  Ledger.collection.name,
  Location.collection.name,
  PayrollDetail.collection.name,
  PayrollRun.collection.name,
  Purchase.collection.name,
  StockAdjustment.collection.name,
  StockBalance.collection.name,
  StockTransfer.collection.name,
  Sale.collection.name,
  Unit.collection.name,
];

export const BACKUP_COLLECTIONS = [
  ...BUSINESS_COLLECTIONS,
  AppSettings.collection.name,
  SystemAccount.collection.name,
];
const LEGACY_BACKUP_VERSION = 1;
const SYSTEM_ACCOUNT_COLLECTION = SystemAccount.collection.name;

type BackupArchive = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: Date;
  database: string;
  collections: Record<string, Record<string, unknown>[]>;
};

function getDatabase() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection is not available.');
  return db;
}

function getBackupBucket() {
  return new mongoose.mongo.GridFSBucket(getDatabase(), { bucketName: BACKUP_BUCKET_NAME });
}

export function serializeBackup(archive: BackupArchive) {
  const content = Buffer.from(EJSON.stringify(archive, { relaxed: false }), 'utf8');
  if (content.byteLength > MAX_BACKUP_BYTES) {
    throw new Error(`Backup exceeds the ${MAX_BACKUP_BYTES / (1024 * 1024)} MB limit.`);
  }
  return content;
}

export function parseBackup(content: Buffer): BackupArchive {
  if (content.byteLength > MAX_BACKUP_BYTES) {
    throw new Error(`Backup exceeds the ${MAX_BACKUP_BYTES / (1024 * 1024)} MB limit.`);
  }
  let archive: unknown;
  try {
    archive = EJSON.parse(content.toString('utf8'));
  } catch {
    throw new Error('Backup file is not valid Extended JSON.');
  }
  if (
    typeof archive !== 'object' ||
    archive === null ||
    !('format' in archive) ||
    archive.format !== BACKUP_FORMAT ||
    !('version' in archive) ||
    ![LEGACY_BACKUP_VERSION, BACKUP_VERSION].includes(archive.version as number) ||
    !('collections' in archive) ||
    typeof archive.collections !== 'object' ||
    archive.collections === null ||
    Array.isArray(archive.collections)
  ) {
    throw new Error('Backup file has an unsupported format or version.');
  }

  const collections = archive.collections as Record<string, unknown>;
  const allowed = new Set(BACKUP_COLLECTIONS);
  if (Object.keys(collections).some((name) => !allowed.has(name))) {
    throw new Error('Backup contains unsupported collection names.');
  }
  const requiredCollections = archive.version === LEGACY_BACKUP_VERSION
    ? BACKUP_COLLECTIONS.filter((name) => name !== SYSTEM_ACCOUNT_COLLECTION)
    : BACKUP_COLLECTIONS;
  if (
    requiredCollections.some(
      (name) => !Array.isArray(collections[name]) ||
        (collections[name] as unknown[]).some(
          (document) => typeof document !== 'object' || document === null || Array.isArray(document)
        )
    ) ||
    (SYSTEM_ACCOUNT_COLLECTION in collections &&
      (!Array.isArray(collections[SYSTEM_ACCOUNT_COLLECTION]) ||
        (collections[SYSTEM_ACCOUNT_COLLECTION] as unknown[]).some(
          (document) => typeof document !== 'object' || document === null || Array.isArray(document)
        )))
  ) {
    throw new Error('Backup must include every application collection as an array of documents.');
  }

  return archive as BackupArchive;
}

export async function captureDatabaseSnapshot() {
  const db = getDatabase();
  const existingCollections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name)
  );
  const collections: Record<string, Record<string, unknown>[]> = {};
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of BACKUP_COLLECTIONS) {
        collections[name] = existingCollections.has(name)
          ? await db.collection(name).find({}, { session }).toArray() as Record<string, unknown>[]
          : [];
      }
    }, { readConcern: { level: 'snapshot' } });
  } finally {
    await session.endSession();
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date(),
    database: db.databaseName,
    collections,
  } satisfies BackupArchive;
}

export async function storeRecoveryBackup(purpose: 'before-restore' | 'before-reset') {
  const archive = await captureDatabaseSnapshot();
  const content = serializeBackup(archive);
  const filename = `inpay-${purpose}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const upload = getBackupBucket().openUploadStream(filename, {
    metadata: { purpose, database: archive.database },
  });
  await pipeline(Readable.from([content]), upload);
  return { id: String(upload.id), filename, size: content.byteLength };
}

export async function exportDatabaseBackup() {
  return serializeBackup(await captureDatabaseSnapshot());
}

export async function replaceDatabaseData(archive: BackupArchive) {
  const db = getDatabase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of BACKUP_COLLECTIONS) {
        if (!(name in archive.collections)) continue;
        const collection = db.collection(name);
        await collection.deleteMany({}, { session });
        const documents = archive.collections[name];
        if (documents.length) {
          await collection.insertMany(documents as never[], { session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function resetBusinessData() {
  const db = getDatabase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of BUSINESS_COLLECTIONS) {
        await db.collection(name).deleteMany({}, { session });
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function listRecoveryBackups() {
  const db = getDatabase();
  const filesCollection = db.collection(`${BACKUP_BUCKET_NAME}.files`);
  const hasCollection = await db.listCollections({ name: filesCollection.collectionName }, { nameOnly: true }).hasNext();
  if (!hasCollection) return [];

  const files = await filesCollection
    .find({}, { projection: { filename: 1, uploadDate: 1, length: 1, metadata: 1 } })
    .sort({ uploadDate: -1 })
    .limit(50)
    .toArray();
  return files.map((file) => ({
    id: String(file._id),
    filename: file.filename,
    uploadDate: file.uploadDate,
    length: file.length,
    purpose: file.metadata?.purpose,
  }));
}

export async function downloadRecoveryBackup(id: string) {
  const stream = getBackupBucket().openDownloadStream(new mongoose.mongo.ObjectId(id));
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function isValidBackupId(id: string) {
  return mongoose.mongo.ObjectId.isValid(id);
}
