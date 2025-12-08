import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Annonce, AnnonceDocument } from './schemas/annonce.schema';
import { CreateAnnonceDto } from './dto/create-annonce.dto';
import { UpdateAnnonceDto } from './dto/update-annonce.dto';

@Injectable()
export class AnnoncesService {
  constructor(
    @InjectModel(Annonce.name)
    private readonly annonceModel: Model<AnnonceDocument>,
  ) { }

  /**
   * Création d'une annonce pour un utilisateur donné
   * (utilisé par POST /annonces avec JwtAuthGuard)
   */
  async create(dto: CreateAnnonceDto, userId: string): Promise<Annonce> {
    const doc = new this.annonceModel({
      ...dto,
      user: new Types.ObjectId(userId),
      isNew: true,
    });
    return doc.save();
  }

  /**
   * Toutes les annonces (tous utilisateurs)
   */
  findAll(): Promise<Annonce[]> {
    return this.annonceModel
      .find()
      .populate('user', 'username image')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Toutes les annonces d'un utilisateur
   * (utilisé par GET /annonces/me)
   */
  async findByUser(userId: string): Promise<Annonce[]> {
    return this.annonceModel
      .find({ user: new Types.ObjectId(userId) })
      .populate('user', 'username image')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Une annonce par id (lecture simple)
   */
  async findOne(id: string): Promise<Annonce> {
    const found = await this.annonceModel
      .findById(id)
      .populate('user', 'username image')
      .exec();
    if (!found) throw new NotFoundException('Annonce not found');
    return found;
  }

  /**
   * Update générique par id (si tu en as besoin côté admin, etc.)
   * ⚠️ ne vérifie PAS le propriétaire
   */
  async update(id: string, dto: UpdateAnnonceDto): Promise<Annonce> {
    const updated = await this.annonceModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Annonce not found');
    return updated;
  }

  /**
   * Update sécurisé : ne permet la modification que si l'annonce
   * appartient à l'utilisateur donné (req.user.userId)
   */
  async updateForUser(
    id: string,
    userId: string,
    dto: UpdateAnnonceDto,
  ): Promise<Annonce> {
    const annonce = await this.annonceModel.findById(id).exec();
    if (!annonce) throw new NotFoundException('Annonce not found');

    if (annonce.user.toString() !== userId) {
      throw new ForbiddenException("You cannot edit this annonce");
    }

    Object.assign(annonce, dto);
    return annonce.save();
  }

  /**
   * Suppression générique par id (sans vérif de propriétaire)
   */
  async remove(id: string): Promise<Annonce> {
    const deleted = await this.annonceModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Annonce not found');
    return deleted;
  }

  /**
   * Suppression sécurisée : seulement le propriétaire
   */
  async removeForUser(id: string, userId: string): Promise<void> {
    const annonce = await this.annonceModel.findById(id).exec();
    if (!annonce) throw new NotFoundException('Annonce not found');

    if (annonce.user.toString() !== userId) {
      throw new ForbiddenException("You cannot delete this annonce");
    }

    await this.annonceModel.deleteOne({ _id: id }).exec();
  }

  async updateImage(id: string, userId: string, filename: string): Promise<Annonce> {
    const annonce = await this.annonceModel.findById(id).exec();
    if (!annonce) throw new NotFoundException('Annonce not found');

    if (annonce.user.toString() !== userId) {
      throw new ForbiddenException("You cannot edit this annonce");
    }

    annonce.imageUrl = filename;
    return annonce.save();
  }
}
