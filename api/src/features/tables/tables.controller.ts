import { mongoose } from '../../shared/db/index.js';

export async function getTablesData(c: any) {
  const modelNames = mongoose.modelNames().sort((a, b) => a.localeCompare(b));
  const tables = await Promise.all(
    modelNames.map(async (modelName) => {
      const model = mongoose.model(modelName);
      const count = await model.countDocuments();
      return { model: modelName, collection: model.collection.name, count };
    }),
  );
  const totalDocuments = tables.reduce((total, table) => total + table.count, 0);
  return c.json({ data: tables, meta: { totalTables: tables.length, totalDocuments } });
}
