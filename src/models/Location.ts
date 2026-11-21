import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  code: string;
}

const LocationSchema = new Schema<ILocation>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
});

export default mongoose.models.Location ||
  mongoose.model<ILocation>('Location', LocationSchema);
