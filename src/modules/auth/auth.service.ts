import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // 📝 Register a new user
  async register(dto: CreateUserDto, image?: string) {
    // Delegate to UsersService
    return this.usersService.createUser(dto, image);
  }

  // 🔑 Login user
  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { userId: user._id.toString(), role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  // 🔄 Refresh Token
  async refreshToken(user: any) {
    const payload = { userId: user.userId, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // 🔐 Google OAuth Authentication
  async authenticateWithGoogle(dto: GoogleAuthDto) {
    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestException('Invalid Google token');
      }

      const { email, given_name, family_name, picture, sub: googleId } = payload;

      // Check if user exists
      let user = await this.usersService.findByEmail(email);
      let isNewUser = false;

      if (!user) {
        // Create new user
        isNewUser = true;
        const createUserDto: CreateUserDto = {
          email,
          password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
          firstName: given_name || 'User',
          lastName: family_name || '',
          role: 'user',
          city: '',
          referralCode: dto.referralCode,
        };

        user = await this.usersService.createUser(createUserDto, picture);
      }

      // Generate JWT
      const jwtPayload = { userId: user._id.toString(), role: user.role };
      const accessToken = this.jwtService.sign(jwtPayload);

      return {
        accessToken,
        refreshToken: accessToken, // In production, use separate refresh token
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl || picture,
        },
        isNewUser,
      };
    } catch (error) {
      throw new UnauthorizedException('Google authentication failed: ' + error.message);
    }
  }
}
