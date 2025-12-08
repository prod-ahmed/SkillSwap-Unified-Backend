import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AnnoncesService } from './annonces.service';
import { CreateAnnonceDto } from './dto/create-annonce.dto';
import { UpdateAnnonceDto } from './dto/update-annonce.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ⬅️ adapte le chemin si besoin

@UseGuards(JwtAuthGuard)
@Controller('annonces')
export class AnnoncesController {
  constructor(private readonly annoncesService: AnnoncesService) { }

  /**
   * POST /annonces
   * Créer une annonce pour l'utilisateur connecté
   */
  @Post()
  create(@Body() dto: CreateAnnonceDto, @Request() req) {
    // req.user.userId doit venir de ton JwtStrategy
    const userId = req.user.userId;
    return this.annoncesService.create(dto, userId);
  }

  /**
   * GET /annonces
   * (optionnel) Toutes les annonces, tous utilisateurs confondus
   */
  @Get()
  findAll() {
    return this.annoncesService.findAll();
  }

  /**
   * GET /annonces/me
   * Toutes les annonces de l'utilisateur connecté
   */
  @Get('me')
  findMine(@Request() req) {
    const userId = req.user.userId;
    return this.annoncesService.findByUser(userId);
  }

  /**
   * GET /annonces/:id
   * Récupérer une annonce par id (lecture simple)
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.annoncesService.findOne(id);
  }

  /**
   * PATCH /annonces/:id
   * Modifier une annonce appartenant à l'utilisateur connecté
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnonceDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.annoncesService.updateForUser(id, userId, dto);
  }

  /**
   * DELETE /annonces/:id
   * Supprimer une annonce appartenant à l'utilisateur connecté
   */
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId;
    return this.annoncesService.removeForUser(id, userId);
  }

  @Patch(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/annonces',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    const userId = req.user.userId;
    // Verify ownership inside service or here
    return this.annoncesService.updateImage(id, userId, file.filename);
  }
}
