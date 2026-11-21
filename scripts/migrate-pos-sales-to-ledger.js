const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

function loadEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

async function main() {
  loadEnvironmentFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvironmentFile(path.resolve(process.cwd(), '.env'));

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Set MONGODB_URI in the environment or in .env.local/.env before migrating.');
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'Inpay' });
  const sales = mongoose.connection.db.collection('sales');
  const ledger = mongoose.connection.db.collection('ledgers');
  const session = await mongoose.startSession();
  let migrated = 0;
  let unchanged = 0;

  try {
    await session.withTransaction(async () => {
      migrated = 0;
      unchanged = 0;
      const existingEntries = await ledger.find(
        { type: 'item' },
        { session, projection: { reference: 1 } }
      ).toArray();
      const existingReferences = new Set(existingEntries.map((entry) => entry.reference));
      const existingSales = await sales.find({}, { session })
        .sort({ createdAt: 1, _id: 1 })
        .toArray();

      for (const sale of existingSales) {
        if (typeof sale.receiptNo !== 'string' || existingReferences.has(sale.receiptNo)) {
          unchanged += 1;
          continue;
        }

        const amount = Number(sale.total);
        const date = sale.createdAt ? new Date(sale.createdAt) : sale._id.getTimestamp();
        if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(date.getTime())) {
          throw new Error(`Sale ${sale.receiptNo} has an invalid total or date.`);
        }

        await ledger.insertOne({
          type: 'item',
          pnlCategory: 'sales_income',
          reference: sale.receiptNo,
          description: `POS sale (${sale.paymentMethod || 'unknown payment method'})`,
          amount,
          balance: 0,
          date,
          createdBy: sale.cashierName || 'POS',
          createdAt: new Date(),
        }, { session });
        existingReferences.add(sale.receiptNo);
        migrated += 1;
      }

      const entries = await ledger.find(
        {},
        { session, projection: { _id: 1, amount: 1 } }
      ).sort({ date: 1, createdAt: 1, _id: 1 }).toArray();
      let balance = 0;
      const balanceUpdates = entries.map((entry) => {
        const amount = Number(entry.amount);
        if (!Number.isFinite(amount)) {
          throw new Error(`Ledger entry ${entry._id} has an invalid amount.`);
        }
        balance += amount;
        return {
          updateOne: {
            filter: { _id: entry._id },
            update: { $set: { balance } },
          },
        };
      });

      for (let offset = 0; offset < balanceUpdates.length; offset += 500) {
        await ledger.bulkWrite(balanceUpdates.slice(offset, offset + 500), { session });
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(`Added ${migrated} POS sale(s) to the ledger.`);
  console.log(`Already recorded or skipped: ${unchanged} sale(s).`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('POS sales ledger migration failed:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
