import {
  Controller,
  Get,
  Patch,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Post,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorators';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CreateMailDto } from '../mail/dto/create-mail.dto';

import { ForgotPasswordDto } from '../mail/dto/forgot-password.dto';
import { ResetPasswordDto } from '../mail/dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidateReferralDto } from './dto/validate-referral.dto';
import { extname } from 'path';

@ApiTags('User')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // 👑 Admin only: Get all users
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  getAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    console.log('🧠 Current user from JWT:', user);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.usersService.findById(user.userId);
  }

  // 🖼️ Upload / update profile image
  @Patch('me/image')
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/users',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async updateImage(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No image uploaded');
    }

    return this.usersService.updateImageById(user.userId, file.filename);
  }

  @Post('send-verification')
  @UseGuards(JwtAuthGuard)
  sendVerification(@CurrentUser() user: any) {
    return this.usersService.sendVerificationCodeById(user.userId);
  }
  @Post('me/verify')
  @UseGuards(JwtAuthGuard)
  async verifyMe(@CurrentUser() user: any, @Body() body: CreateMailDto) {
    return this.usersService.verifyEmailById(user.userId, body.code);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.usersService.sendPasswordResetCode(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.usersService.resetPassword(
      body.code,
      body.newPassword,
      body.confirmPassword,
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateUserDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post('referrals/validate')
  async validateReferral(@Body() dto: ValidateReferralDto) {
    return this.usersService.validateReferralCode(dto.codeParainnage);
  }

  @Get('me/rewards')
  @UseGuards(JwtAuthGuard)
  getMyRewards(@CurrentUser() user: any) {
    return this.usersService.getRewardsSummary(user.userId);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  searchUsers(@CurrentUser() user: any, @Query('q') query?: string) {
    return this.usersService.searchUsers(user.userId, query);
  }

  @Get('by-email/:email')
  @UseGuards(JwtAuthGuard)
  async getUserByEmail(@CurrentUser() user: any, @Param('email') email: string) {
    // Try to find by email first, then by username
    let foundUser = await this.usersService.findByEmail(email);
    if (!foundUser) {
      foundUser = await this.usersService.findByUsername(email);
    }
    if (!foundUser) {
      throw new BadRequestException('User not found');
    }
    return foundUser;
  }

}
