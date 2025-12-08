import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from 'src/modules/auth/common/role.enum';
import { BadgeTier } from '../dto/badge-tier.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  bio: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.Client })
  role: Role;

  @Prop()
  image?: string;

  @Prop({ type: [String], default: [] })
  skillsTeach: string[]; // ex: ["guitare", "Photoshop"]

  @Prop({ type: [String], default: [] })
  skillsLearn: string[]; // ex: ["anglais", "python"]

  @Prop({
    type: {
      lat: { type: Number },
      lon: { type: Number },
      city: { type: String },
    },
    default: null,
  })
  location: {
    lat: number;
    lon: number;
    city: string;
  };
  @Prop()
  resetCode?: string;

  @Prop({
    type: [
      {
        day: { type: String }, // e.g. "monday"
        start: { type: String }, // e.g. "10:00"
        end: { type: String }, // e.g. "12:00"
      },
    ],
    default: [],
  })
  availability: {
    day: string;
    start: string;
    end: string;
  }[];

  @Prop({ type: Number, default: 0 })
  credits: number;

  @Prop({ type: Number, default: 0, min: 0 })
  xp: number;

  @Prop({ type: Number, default: 0, min: 0 })
  nombreParainnage: number;

  @Prop({ type: Number, default: 20, min: 0 })
  maxParannaige: number;

  @Prop({ type: String, unique: true, minlength: 5, maxlength: 5 })
  codeParainnage: string;

  @Prop({ type: Number, default: 0 })
  ratingAvg: number;

  @Prop({ type: [String], enum: Object.values(BadgeTier), default: [] })
  badges: BadgeTier[];

  @Prop({ required: false })
  verificationCode?: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ required: false })
  googleRefreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

function generateReferralCode(length = 5): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    code += alphabet[index];
  }
  return code;
}

UserSchema.pre('save', async function (next) {
  if (this.codeParainnage) {
    return next();
  }

  let unique = false;
  while (!unique) {
    const candidate = generateReferralCode();
    const existing = await this.model('User').countDocuments({
      codeParainnage: candidate,
    });
    if (existing === 0) {
      this.codeParainnage = candidate;
      unique = true;
    }
  }

  next();
});
