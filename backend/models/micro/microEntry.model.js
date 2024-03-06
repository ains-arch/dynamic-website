import mongoose from 'mongoose';
import { generateRssForFeed, generateRssForMicro } from '../../helpers/rss.js';
import db from '../db.js';

const MicroEntrySchema = new mongoose.Schema(
  {
    title: { type: String },
    slug: { type: String, required: true, unique: true },
    post: { type: Object, required: true },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    relatedPost: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedPostModel',
    },
    relatedPostModel: {
      type: String,
      enum: ['ShortformEntry', 'BlockchainEntry', 'PressEntry'],
    },
    socialLinks: [
      {
        type: {
          type: String,
          enum: ['twitter', 'mastodon', 'bluesky', 'tiktok', 'youtube'],
        },
        postId: { type: String },
      },
    ],
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

// Generate RSS on each save
MicroEntrySchema.post('save', async () => {
  await Promise.all([generateRssForFeed(), generateRssForMicro()]);
});

export default db.microConnection.model(
  'MicroEntry',
  MicroEntrySchema,
  'entries',
);
