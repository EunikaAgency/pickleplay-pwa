import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI ||
  'mongodb://localhost:27017/pickleballers';

export async function connectDb(): Promise<void> {
  await mongoose.connect(mongoUri);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export { mongoose };
export default mongoose;
