import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PromosService } from './promos.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('promos')
export class PromosController {
  constructor(private readonly promosService: PromosService) { }

  @Post()
  create(@Body() dto: CreatePromoDto, @Request() req) {
    const userId = req.user.userId;
    return this.promosService.create(dto, userId);
  }

  @Get()
  findAll() {
    return this.promosService.findAll();
  }

  @Get('me')
  findMine(@Request() req) {
    const userId = req.user.userId;
    return this.promosService.findByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoDto) {
    return this.promosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promosService.remove(id);
  }

  @Patch(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/promos',
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
  ) {
    return this.promosService.updateImage(id, file.filename);
  }
}
