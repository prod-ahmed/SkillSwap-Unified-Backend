import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Promo, PromoDocument } from './schemas/promo.schema';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

@Injectable()
export class PromosService {
  constructor(
    @InjectModel(Promo.name)
    private readonly promoModel: Model<PromoDocument>,
  ) { }

  create(dto: CreatePromoDto, userId: string) {
    const doc = new this.promoModel({ ...dto, user: new Types.ObjectId(userId) });
    return doc.save();
  }

  findAll() {
    return this.promoModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByUser(userId: string) {
    return this.promoModel.find({ user: new Types.ObjectId(userId) }).exec();
  }

  async findOne(id: string) {
    const found = await this.promoModel.findById(id).exec();
    if (!found) throw new NotFoundException('Promo not found');
    return found;
  }

  async update(id: string, dto: UpdatePromoDto) {
    const updated = await this.promoModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Promo not found');
    return updated;
  }

  async remove(id: string) {
    await this.promoModel.findByIdAndDelete(id).exec();
    // Note: In a real app, we should also delete the file from disk
  }

  async updateImage(id: string, filename: string) {
    const updated = await this.promoModel
      .findByIdAndUpdate(id, { imageUrl: filename }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Promo not found');
    return updated;
  }
}
