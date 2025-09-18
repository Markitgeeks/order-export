import mongoose from "mongoose";

const exportHistorySchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  exported_at: {
    type: Date,
    default: Date.now,
  },
  filters: {
    type: Object,
    default: {},
  },
  order_count: {
    type: Number,
    required: true,
  },
  file_path: {
    type: String,
    required: true,
  },
});

const ExportHistory = mongoose.models.ExportHistory || mongoose.model("ExportHistory", exportHistorySchema);

export default ExportHistory;
